import { getSql } from "../db.js";
import { getEnv } from "../config.js";
import { REPORT_THRESHOLDS } from "../pipeline/thresholds.js";
import type { MarketMover, MoversPacket, ReportFileSet } from "../types.js";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedPercent,
  slugify,
  toFiniteNumber,
} from "../utils.js";

export async function generateMoversReport(
  category?: string,
): Promise<ReportFileSet> {
  const sql = getSql();
  const env = getEnv();
  const rows = await sql<MarketMover[]>`
    with prior_snapshots as (
      select
        m.id,
        (
          select s.yes_price
          from market_snapshots s
          where s.market_id = m.id
            and s.snapshot_time <= now() - interval '24 hours'
          order by s.snapshot_time desc
          limit 1
        ) as prior_yes_price
      from markets m
      where m.platform = 'kalshi'
        and m.is_active = true
        ${category ? sql`and m.category::text = ${category}` : sql``}
    ),
    latest_snapshots as (
      select distinct on (s.market_id)
        s.market_id,
        s.yes_price,
        s.volume_24h,
        s.liquidity
      from market_snapshots s
      join markets m on m.id = s.market_id
      where m.platform = 'kalshi'
        and m.is_active = true
        ${category ? sql`and m.category::text = ${category}` : sql``}
      order by s.market_id, s.snapshot_time desc
    )
    select
      m.id,
      m.platform_id,
      m.title,
      m.category,
      coalesce(m.yes_price, ls.yes_price) as yes_price,
      p.prior_yes_price,
      case
        when p.prior_yes_price is null or coalesce(m.yes_price, ls.yes_price) is null then null
        else coalesce(m.yes_price, ls.yes_price) - p.prior_yes_price
      end as change_24h,
      m.closes_at,
      coalesce(m.volume_24h, ls.volume_24h) as volume_24h,
      coalesce(m.liquidity, ls.liquidity) as liquidity
    from markets m
    join prior_snapshots p on p.id = m.id
    left join latest_snapshots ls on ls.market_id = m.id
    where m.platform = 'kalshi'
      and m.is_active = true
      ${category ? sql`and m.category::text = ${category}` : sql``}
      and p.prior_yes_price is not null
      and coalesce(m.yes_price, ls.yes_price) is not null
    order by abs(coalesce(m.yes_price, ls.yes_price) - p.prior_yes_price) desc
    limit ${env.REPORT_MARKET_LIMIT}
  `;

  const movers = rows.map((row) => {
    const currentYes = toFiniteNumber(row.yes_price);
    const priorYes = toFiniteNumber(row.prior_yes_price);
    const change24h = toFiniteNumber(row.change_24h);
    const volume24h = toFiniteNumber(row.volume_24h);
    const liquidity = toFiniteNumber(row.liquidity);
    const hasCurrentPrice = currentYes !== null;
    const hasPriorPrice = priorYes !== null;
    const meetsMinMove =
      change24h !== null &&
      Math.abs(change24h) >= REPORT_THRESHOLDS.movers.minMoveAbs;
    const isHighConfidence =
      (volume24h ?? 0) >= REPORT_THRESHOLDS.movers.highConfidenceMinVolume24h ||
      (liquidity ?? 0) >= REPORT_THRESHOLDS.movers.highConfidenceMinLiquidity;

    return {
      market_id: row.id,
      platform_id: row.platform_id,
      title: row.title,
      category: row.category,
      current_yes_price: currentYes ?? 0,
      prior_yes_price: priorYes ?? 0,
      change_24h: change24h ?? 0,
      abs_change_24h: Math.abs(change24h ?? 0),
      volume_24h: volume24h,
      liquidity,
      closes_at: row.closes_at,
      quality: {
        has_current_price: hasCurrentPrice,
        has_prior_price: hasPriorPrice,
        meets_min_move: meetsMinMove,
        is_high_confidence: isHighConfidence,
        reason_flags: [
          ...(hasCurrentPrice ? [] : ["missing_current_price"]),
          ...(hasPriorPrice ? [] : ["missing_prior_price"]),
          ...(meetsMinMove ? [] : ["below_min_move"]),
          ...(isHighConfidence ? [] : ["thin_market"]),
        ],
      },
    };
  });

  const validMovers = movers.filter(
    (mover) =>
      mover.quality.has_current_price &&
      mover.quality.has_prior_price &&
      mover.quality.meets_min_move,
  );
  const highConfidenceMovers = validMovers.filter(
    (mover) => mover.quality.is_high_confidence,
  );
  const thinMovers = validMovers.filter(
    (mover) => !mover.quality.is_high_confidence,
  );

  const packet: MoversPacket = {
    slug: slugify(category ? `movers-${category}` : "movers-all"),
    title: category
      ? `Biggest Kalshi repricings in ${category} (24h)`
      : "Biggest Kalshi repricings (24h)",
    provenance: {
      generated_at: new Date().toISOString(),
      source: "musashi_truth_layer",
      packet_type: "movers_packet",
      query_window: "24h",
    },
    category: category ?? null,
    summary: {
      candidate_count: rows.length,
      valid_count: validMovers.length,
      high_confidence_count: highConfidenceMovers.length,
      thin_market_count: thinMovers.length,
    },
    movers,
  };

  const title = packet.title;
  const markdown = [
    `# ${title}`,
    "",
    `Source packet for top ${rows.length} markets by absolute 24h repricing from Musashi truth-layer data.`,
    "",
    `- candidates: ${packet.summary.candidate_count}`,
    `- valid movers: ${packet.summary.valid_count}`,
    `- high-confidence movers: ${packet.summary.high_confidence_count}`,
    `- thin-market movers: ${packet.summary.thin_market_count}`,
    "",
    ...packet.movers.map(
      (row, index) =>
        `${index + 1}. **${row.title}** | now ${formatPercent(row.current_yes_price)} | 24h ${formatSignedPercent(
          row.change_24h,
        )} | vol ${formatCurrency(row.volume_24h)} | liq ${formatCurrency(row.liquidity)} | closes ${formatDate(
          row.closes_at,
        )} | ${row.quality.is_high_confidence ? "high-confidence" : "thin-market"}`,
    ),
  ].join("\n");

  return {
    slug: packet.slug,
    title,
    markdown,
    json: packet,
  };
}

import { getSql } from "../db.js";
import { getEnv } from "../config.js";
import { REPORT_THRESHOLDS } from "../pipeline/thresholds.js";
import type {
  CaseStudyMarket,
  CaseStudyPacket,
  ReportFileSet,
  SnapshotPoint,
} from "../types.js";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedPercent,
  slugify,
  toFiniteNumber,
} from "../utils.js";

interface CaseStudyArgs {
  eventId: string;
}

export async function generateCaseStudy(
  args: CaseStudyArgs,
): Promise<ReportFileSet> {
  const sql = getSql();
  const env = getEnv();
  const markets = await sql<CaseStudyMarket[]>`
    with latest_snapshots as (
      select distinct on (s.market_id)
        s.market_id,
        s.yes_price,
        s.volume_24h,
        s.liquidity
      from market_snapshots s
      order by s.market_id, s.snapshot_time desc
    )
    select
      m.id,
      m.platform_id,
      m.title,
      m.category,
      coalesce(m.yes_price, ls.yes_price) as yes_price,
      coalesce(m.volume_24h, ls.volume_24h) as volume_24h,
      coalesce(m.liquidity, ls.liquidity) as liquidity,
      m.closes_at
    from markets m
    left join latest_snapshots ls on ls.market_id = m.id
    where m.platform = 'kalshi'
      and m.event_id = ${args.eventId}
    order by coalesce(m.liquidity, ls.liquidity, 0) desc, coalesce(m.volume_24h, ls.volume_24h, 0) desc
  `;

  if (markets.length === 0) {
    throw new Error(`No markets found for event_id=${args.eventId}`);
  }

  const normalizedMarkets = markets.map((market) => ({
    ...market,
    yes_price: toFiniteNumber(market.yes_price),
    volume_24h: toFiniteNumber(market.volume_24h),
    liquidity: toFiniteNumber(market.liquidity),
  }));

  const primary = normalizedMarkets[0]!;
  const snapshots = await sql<SnapshotPoint[]>`
    select
      snapshot_time,
      yes_price
    from market_snapshots
    where market_id = ${primary.id}
      and snapshot_time >= now() - (${env.CASE_STUDY_WINDOW_DAYS} * interval '1 day')
    order by snapshot_time asc
  `;

  const milestones = buildMilestones(snapshots);
  const latest = snapshots.at(-1) ?? null;
  const first = snapshots[0] ?? null;
  const totalChange =
    latest && first && latest.yes_price !== null && first.yes_price !== null
      ? latest.yes_price - first.yes_price
      : null;
  const totalVolume24h = normalizedMarkets.reduce(
    (sum, market) => sum + (market.volume_24h ?? 0),
    0,
  );
  const avgAbsMove =
    milestones.length <= 1
      ? null
      : milestones.reduce(
          (sum, milestone) => sum + Math.abs(milestone.change_from_prior ?? 0),
          0,
        ) /
        milestones.filter((milestone) => milestone.change_from_prior !== null)
          .length;

  const packet: CaseStudyPacket = {
    slug: slugify(`case-study-${args.eventId}`),
    title: `Case study: ${primary.title}`,
    provenance: {
      generated_at: new Date().toISOString(),
      source: "musashi_truth_layer",
      packet_type: "case_study_packet",
      query_window: `${env.CASE_STUDY_WINDOW_DAYS}d`,
    },
    event_id: args.eventId,
    primary_market: primary,
    related_markets: normalizedMarkets,
    milestones,
    summary: {
      market_count: normalizedMarkets.length,
      snapshot_count: snapshots.length,
      total_change: totalChange,
      total_volume_24h: totalVolume24h,
      average_abs_move: avgAbsMove,
      quality_flags: [
        ...(normalizedMarkets.length >=
        REPORT_THRESHOLDS.caseStudy.minMarketCount
          ? []
          : ["insufficient_market_count"]),
        ...(snapshots.length >= REPORT_THRESHOLDS.caseStudy.minSnapshotCount
          ? []
          : ["insufficient_snapshot_count"]),
        ...(totalVolume24h >= REPORT_THRESHOLDS.caseStudy.minTotalVolume24h
          ? []
          : ["insufficient_total_volume"]),
        ...((avgAbsMove ?? 0) >=
        REPORT_THRESHOLDS.caseStudy.minAverageAbsMove24h
          ? []
          : ["insufficient_average_abs_move"]),
      ],
    },
  };

  const markdown = [
    `# ${packet.title}`,
    "",
    `Source packet for event cluster ${args.eventId}.`,
    `- current yes: ${formatPercent(primary.yes_price)}`,
    `- ${env.CASE_STUDY_WINDOW_DAYS}d change: ${formatSignedPercent(totalChange)}`,
    `- liquidity: ${formatCurrency(primary.liquidity)}`,
    `- volume 24h: ${formatCurrency(primary.volume_24h)}`,
    `- closes: ${formatDate(primary.closes_at)}`,
    "",
    `Related markets in cluster: ${packet.summary.market_count}`,
    `Snapshots in window: ${packet.summary.snapshot_count}`,
    `Average absolute milestone move: ${formatSignedPercent(packet.summary.average_abs_move)}`,
    "",
    "## Timeline highlights",
    ...packet.milestones.map(
      (milestone, index) =>
        `${index + 1}. ${formatDate(milestone.snapshot_time)} | yes ${formatPercent(
          milestone.yes_price,
        )} | move vs prior ${formatSignedPercent(milestone.change_from_prior)}`,
    ),
    "",
    "## Related markets",
    ...packet.related_markets
      .slice(0, 10)
      .map(
        (market, index) =>
          `${index + 1}. **${market.title}** | yes ${formatPercent(market.yes_price)} | liq ${formatCurrency(
            market.liquidity,
          )}`,
      ),
  ].join("\n");

  return {
    slug: packet.slug,
    title: packet.title,
    markdown,
    json: packet,
  };
}

function buildMilestones(snapshots: SnapshotPoint[]) {
  const enriched = snapshots.map((snapshot, index) => {
    const prior = snapshots[index - 1];
    return {
      snapshot_time: snapshot.snapshot_time,
      yes_price: toFiniteNumber(snapshot.yes_price),
      change_from_prior:
        prior &&
        toFiniteNumber(snapshot.yes_price) !== null &&
        toFiniteNumber(prior.yes_price) !== null
          ? (toFiniteNumber(snapshot.yes_price) ?? 0) -
            (toFiniteNumber(prior.yes_price) ?? 0)
          : null,
    };
  });

  const withChanges = enriched.filter((row) => row.change_from_prior !== null);
  const topMoves = [...withChanges]
    .sort(
      (left, right) =>
        Math.abs(right.change_from_prior ?? 0) -
        Math.abs(left.change_from_prior ?? 0),
    )
    .slice(0, 5);

  const combined = new Map<
    string,
    {
      snapshot_time: string;
      yes_price: number | null;
      change_from_prior: number | null;
    }
  >();
  for (const milestone of [enriched[0], ...topMoves, enriched.at(-1)].filter(
    Boolean,
  ) as Array<{
    snapshot_time: string;
    yes_price: number | null;
    change_from_prior: number | null;
  }>) {
    combined.set(milestone.snapshot_time, milestone);
  }

  return Array.from(combined.values()).sort((left, right) =>
    left.snapshot_time.localeCompare(right.snapshot_time),
  );
}

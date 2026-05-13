import { getSql } from "../db.js";
import { getEnv } from "../config.js";
import type { MarketMover, ReportFileSet } from "../types.js";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedPercent,
  slugify,
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

  const title = category
    ? `Biggest Kalshi repricings in ${category} (24h)`
    : "Biggest Kalshi repricings (24h)";
  const markdown = [
    `# ${title}`,
    "",
    `Top ${rows.length} markets by absolute 24h repricing from Musashi truth-layer data.`,
    "",
    ...rows.map(
      (row, index) =>
        `${index + 1}. **${row.title}** | now ${formatPercent(row.yes_price)} | 24h ${formatSignedPercent(
          row.change_24h,
        )} | vol ${formatCurrency(row.volume_24h)} | liq ${formatCurrency(row.liquidity)} | closes ${formatDate(
          row.closes_at,
        )}`,
    ),
  ].join("\n");

  return {
    slug: slugify(category ? `movers-${category}` : "movers-all"),
    title,
    markdown,
    json: {
      title,
      category,
      generated_at: new Date().toISOString(),
      rows,
    },
  };
}

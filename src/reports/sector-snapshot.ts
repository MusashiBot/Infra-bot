import { sql } from "../db.js";
import { getEnv } from "../config.js";
import { getSector } from "../sectors.js";
import type { ReportFileSet, SectorSnapshotRow } from "../types.js";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  slugify,
  toFiniteNumber,
} from "../utils.js";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function generateSectorSnapshot(
  sectorSlug: string,
): Promise<ReportFileSet> {
  const env = getEnv();
  const sector = getSector(sectorSlug);
  const categoryPatterns = sector.categories;
  const keywordPatterns = sector.titleKeywords.map(
    (keyword) => `\\m${escapeRegex(keyword.toLowerCase())}\\M`,
  );

  const rows = await sql<SectorSnapshotRow[]>`
    with latest_snapshots as (
      select distinct on (s.market_id)
        s.market_id,
        s.yes_price,
        s.no_price,
        s.volume_24h,
        s.liquidity,
        s.spread
      from market_snapshots s
      order by s.market_id, s.snapshot_time desc
    )
    select
      m.id,
      m.platform_id,
      m.title,
      m.category,
      coalesce(m.yes_price, ls.yes_price) as yes_price,
      coalesce(m.no_price, ls.no_price) as no_price,
      m.closes_at,
      coalesce(m.volume_24h, ls.volume_24h) as volume_24h,
      coalesce(m.liquidity, ls.liquidity) as liquidity,
      coalesce(m.spread, ls.spread) as spread
    from markets m
    left join latest_snapshots ls on ls.market_id = m.id
    where m.platform = 'kalshi'
      and m.is_active = true
      and (
        lower(coalesce(m.category::text, '')) = any(${sql.array(categoryPatterns)})
        or lower(m.title) ~ any(${sql.array(keywordPatterns)})
      )
    order by coalesce(m.liquidity, ls.liquidity, 0) desc, coalesce(m.volume_24h, ls.volume_24h, 0) desc
    limit ${env.REPORT_MARKET_LIMIT}
  `;

  const rowsWithProbability = rows.filter((row) => row.yes_price !== null);
  const avgProbability =
    rowsWithProbability.length === 0
      ? null
      : rowsWithProbability.reduce(
          (sum, row) => sum + (toFiniteNumber(row.yes_price) ?? 0),
          0,
        ) / rowsWithProbability.length;

  const title = `${sector.title}: market-implied snapshot`;
  const markdown = [
    `# ${title}`,
    "",
    `Open Kalshi markets matched to the ${sector.title} sector using category/title heuristics.`,
    "",
    `- matched markets: ${rows.length}`,
    `- average implied yes probability: ${formatPercent(avgProbability)}`,
    "",
    ...rows.map(
      (row, index) =>
        `${index + 1}. **${row.title}** | yes ${formatPercent(row.yes_price)} | vol ${formatCurrency(
          row.volume_24h,
        )} | liq ${formatCurrency(row.liquidity)} | closes ${formatDate(row.closes_at)}`,
    ),
  ].join("\n");

  return {
    slug: slugify(`sector-${sector.slug}`),
    title,
    markdown,
    json: {
      title,
      sector,
      generated_at: new Date().toISOString(),
      summary: {
        matched_markets: rows.length,
        average_implied_yes_probability: avgProbability,
      },
      rows,
    },
  };
}

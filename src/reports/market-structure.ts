import { getSql } from "../db.js";
import { REPORT_THRESHOLDS } from "../pipeline/thresholds.js";
import type {
  LiquidityBucketStat,
  MarketStructureCategory,
  MarketStructurePacket,
  ReportFileSet,
} from "../types.js";
import { formatPercent, slugify, toFiniteNumber } from "../utils.js";

export async function generateMarketStructureReport(): Promise<ReportFileSet> {
  const sql = getSql();
  const byCategory = await sql<MarketStructureCategory[]>`
    with resolved_markets as (
      select
        m.id,
        coalesce(nullif(m.category::text, ''), 'unknown') as category,
        r.outcome,
        r.final_yes_price,
        (
          select s.yes_price
          from market_snapshots s
          where s.market_id = m.id
            and s.snapshot_time <= coalesce(m.settles_at, m.closes_at, m.resolved_at)
          order by s.snapshot_time desc
          limit 1
        ) as preclose_yes_price
      from markets m
      join market_resolutions r on r.market_id = m.id
      where m.platform = 'kalshi'
    )
    select
      category,
      count(*)::int as resolved_count,
      avg(final_yes_price)::float8 as avg_final_yes_price,
      avg(preclose_yes_price)::float8 as avg_preclose_yes_price,
      avg(case when outcome = 'YES' then 1.0 else 0.0 end)::float8 as yes_resolution_rate
    from resolved_markets
    group by category
    order by resolved_count desc
    limit 12
  `;

  const byLiquidity = await sql<LiquidityBucketStat[]>`
    with resolved_markets as (
      select
        case
          when coalesce(m.liquidity, 0) >= 100000 then '100k+'
          when coalesce(m.liquidity, 0) >= 25000 then '25k-100k'
          when coalesce(m.liquidity, 0) >= 5000 then '5k-25k'
          else '<5k'
        end as liquidity_bucket,
        r.outcome,
        (
          select s.yes_price
          from market_snapshots s
          where s.market_id = m.id
            and s.snapshot_time <= coalesce(m.settles_at, m.closes_at, m.resolved_at)
          order by s.snapshot_time desc
          limit 1
        ) as preclose_yes_price
      from markets m
      join market_resolutions r on r.market_id = m.id
      where m.platform = 'kalshi'
    )
    select
      liquidity_bucket,
      count(*)::int as resolved_count,
      avg(preclose_yes_price)::float8 as avg_preclose_yes_price,
      avg(case when outcome = 'YES' then 1.0 else 0.0 end)::float8 as yes_resolution_rate
    from resolved_markets
    group by liquidity_bucket
    order by resolved_count desc
  `;

  const packet: MarketStructurePacket = {
    slug: slugify("market-structure"),
    title: "Market structure: trust and resolution context",
    provenance: {
      generated_at: new Date().toISOString(),
      source: "musashi_truth_layer",
      packet_type: "market_structure_packet",
    },
    categories: byCategory.map((row) => ({
      category: row.category,
      resolved_count: row.resolved_count,
      avg_final_yes_price: toFiniteNumber(row.avg_final_yes_price),
      avg_preclose_yes_price: toFiniteNumber(row.avg_preclose_yes_price),
      yes_resolution_rate: toFiniteNumber(row.yes_resolution_rate),
      meets_min_sample:
        row.resolved_count >=
        REPORT_THRESHOLDS.marketStructure.minResolvedCount,
    })),
    liquidity_buckets: byLiquidity.map((row) => ({
      liquidity_bucket: row.liquidity_bucket,
      resolved_count: row.resolved_count,
      avg_preclose_yes_price: toFiniteNumber(row.avg_preclose_yes_price),
      yes_resolution_rate: toFiniteNumber(row.yes_resolution_rate),
      meets_min_sample:
        row.resolved_count >=
        REPORT_THRESHOLDS.marketStructure.minResolvedCount,
    })),
  };

  const markdown = [
    `# ${packet.title}`,
    "",
    "Source packet for resolved-market trust and calibration context.",
    "",
    "## Resolved markets by category",
    ...packet.categories.map(
      (row) =>
        `- **${row.category}** | resolved ${row.resolved_count} | avg pre-close yes ${formatPercent(
          row.avg_preclose_yes_price,
        )} | yes resolution rate ${formatPercent(row.yes_resolution_rate)} | ${row.meets_min_sample ? "publishable" : "below-sample-threshold"}`,
    ),
    "",
    "## Resolved markets by liquidity bucket",
    ...packet.liquidity_buckets.map(
      (row) =>
        `- **${row.liquidity_bucket}** | resolved ${row.resolved_count} | avg pre-close yes ${formatPercent(
          row.avg_preclose_yes_price,
        )} | yes resolution rate ${formatPercent(row.yes_resolution_rate)} | ${row.meets_min_sample ? "publishable" : "below-sample-threshold"}`,
    ),
  ].join("\n");

  return {
    slug: packet.slug,
    title: packet.title,
    markdown,
    json: packet,
  };
}

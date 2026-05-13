import { getSql } from "../db.js";
import { getEnv } from "../config.js";
import { REPORT_THRESHOLDS } from "../pipeline/thresholds.js";
import { getSector } from "../sectors.js";
import type { ReportFileSet, SectorFact, SectorSnapshotRow } from "../types.js";
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
  const sql = getSql();
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

  const markets = rows.map((row) => ({
    market_id: row.id,
    platform_id: row.platform_id,
    title: row.title,
    category: row.category,
    yes_price: toFiniteNumber(row.yes_price),
    no_price: toFiniteNumber(row.no_price),
    volume_24h: toFiniteNumber(row.volume_24h),
    liquidity: toFiniteNumber(row.liquidity),
    spread: toFiniteNumber(row.spread),
    closes_at: row.closes_at,
  }));

  const pricedMarkets = markets.filter((row) => row.yes_price !== null);
  const avgProbability =
    pricedMarkets.length === 0
      ? null
      : pricedMarkets.reduce((sum, row) => sum + (row.yes_price ?? 0), 0) /
        pricedMarkets.length;
  const totalVolume24h = markets.reduce(
    (sum, row) => sum + (row.volume_24h ?? 0),
    0,
  );
  const dominantMarket = [...markets].sort(
    (left, right) => (right.volume_24h ?? 0) - (left.volume_24h ?? 0),
  )[0];
  const dominanceShare =
    totalVolume24h > 0 && dominantMarket
      ? (dominantMarket.volume_24h ?? 0) / totalVolume24h
      : null;

  const packet: SectorFact = {
    slug: slugify(`sector-${sector.slug}`),
    title: `${sector.title}: market-implied snapshot`,
    provenance: {
      generated_at: new Date().toISOString(),
      source: "musashi_truth_layer",
      packet_type: "sector_packet",
      query_window: "current",
    },
    summary: {
      matched_markets: markets.length,
      priced_markets: pricedMarkets.length,
      average_implied_yes_probability: avgProbability,
      total_volume_24h: totalVolume24h,
      top_market_probability: dominantMarket?.yes_price ?? null,
      dominance_share: dominanceShare,
      quality_flags: [
        ...(markets.length >= REPORT_THRESHOLDS.sectors.minMatchedMarkets
          ? []
          : ["insufficient_matched_markets"]),
        ...(pricedMarkets.length >= REPORT_THRESHOLDS.sectors.minPricedMarkets
          ? []
          : ["insufficient_priced_markets"]),
        ...(totalVolume24h >= REPORT_THRESHOLDS.sectors.minTotalVolume24h
          ? []
          : ["insufficient_volume"]),
      ],
    },
    markets,
  };

  const markdown = [
    `# ${packet.title}`,
    "",
    `Source packet for open Kalshi markets matched to the ${sector.title} sector using category/title heuristics.`,
    "",
    `- matched markets: ${packet.summary.matched_markets}`,
    `- priced markets: ${packet.summary.priced_markets}`,
    `- average implied yes probability: ${formatPercent(packet.summary.average_implied_yes_probability)}`,
    `- total 24h volume: ${formatCurrency(packet.summary.total_volume_24h)}`,
    `- dominance share: ${formatPercent(packet.summary.dominance_share)}`,
    "",
    ...packet.markets
      .slice(0, REPORT_THRESHOLDS.sectors.topMarketsPerSector)
      .map(
        (row, index) =>
          `${index + 1}. **${row.title}** | yes ${formatPercent(row.yes_price)} | vol ${formatCurrency(
            row.volume_24h,
          )} | liq ${formatCurrency(row.liquidity)} | closes ${formatDate(row.closes_at)}`,
      ),
  ].join("\n");

  return {
    slug: packet.slug,
    title: packet.title,
    markdown,
    json: packet,
  };
}

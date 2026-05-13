export interface ReportFileSet {
  slug: string;
  title: string;
  markdown: string;
  json: unknown;
}

export interface NarrativeReportSection {
  heading: string;
  bullets: string[];
}

export interface NarrativeReportPayload {
  title: string;
  generated_at: string;
  summary: string;
  sections: NarrativeReportSection[];
  caveats: string[];
  source_report_slugs: string[];
}

export interface MarketMover {
  id: string;
  platform_id: string;
  title: string;
  category: string | null;
  yes_price: number | null;
  prior_yes_price: number | null;
  change_24h: number | null;
  closes_at: string | null;
  volume_24h: number | null;
  liquidity: number | null;
}

export interface SectorSnapshotRow {
  id: string;
  platform_id: string;
  title: string;
  category: string | null;
  yes_price: number | null;
  no_price: number | null;
  closes_at: string | null;
  volume_24h: number | null;
  liquidity: number | null;
  spread: number | null;
}

export interface CaseStudyMarket {
  id: string;
  platform_id: string;
  title: string;
  category: string | null;
  yes_price: number | null;
  volume_24h: number | null;
  liquidity: number | null;
  closes_at: string | null;
}

export interface SnapshotPoint {
  snapshot_time: string;
  yes_price: number | null;
}

export interface EventClusterCandidate {
  event_id: string;
  market_count: number;
  avg_abs_change_24h: number | null;
  total_volume_24h: number | null;
}

export interface MarketStructureCategory {
  category: string;
  resolved_count: number;
  avg_final_yes_price: number | null;
  avg_preclose_yes_price: number | null;
  yes_resolution_rate: number | null;
}

export interface LiquidityBucketStat {
  liquidity_bucket: string;
  resolved_count: number;
  avg_preclose_yes_price: number | null;
  yes_resolution_rate: number | null;
}

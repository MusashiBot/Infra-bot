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

export interface PacketProvenance {
  generated_at: string;
  source: "musashi_truth_layer";
  packet_type:
    | "movers_packet"
    | "sector_packet"
    | "market_structure_packet"
    | "case_study_packet"
    | "publish_packet";
  query_window?: string;
  source_slugs?: string[];
}

export interface MoverQuality {
  has_current_price: boolean;
  has_prior_price: boolean;
  meets_min_move: boolean;
  is_high_confidence: boolean;
  reason_flags: string[];
}

export interface MoverFact {
  market_id: string;
  platform_id: string;
  title: string;
  category: string | null;
  current_yes_price: number;
  prior_yes_price: number;
  change_24h: number;
  abs_change_24h: number;
  volume_24h: number | null;
  liquidity: number | null;
  closes_at: string | null;
  quality: MoverQuality;
}

export interface MoversPacket {
  slug: string;
  title: string;
  provenance: PacketProvenance;
  category: string | null;
  summary: {
    candidate_count: number;
    valid_count: number;
    high_confidence_count: number;
    thin_market_count: number;
  };
  movers: MoverFact[];
}

export interface SectorMarketFact {
  market_id: string;
  platform_id: string;
  title: string;
  category: string | null;
  yes_price: number | null;
  no_price: number | null;
  volume_24h: number | null;
  liquidity: number | null;
  spread: number | null;
  closes_at: string | null;
}

export interface SectorFact {
  slug: string;
  title: string;
  provenance: PacketProvenance;
  summary: {
    matched_markets: number;
    priced_markets: number;
    average_implied_yes_probability: number | null;
    total_volume_24h: number;
    top_market_probability: number | null;
    dominance_share: number | null;
    quality_flags: string[];
  };
  markets: SectorMarketFact[];
}

export interface MarketStructureFact {
  category: string;
  resolved_count: number;
  avg_final_yes_price: number | null;
  avg_preclose_yes_price: number | null;
  yes_resolution_rate: number | null;
  meets_min_sample: boolean;
}

export interface LiquidityBucketFact {
  liquidity_bucket: string;
  resolved_count: number;
  avg_preclose_yes_price: number | null;
  yes_resolution_rate: number | null;
  meets_min_sample: boolean;
}

export interface MarketStructurePacket {
  slug: string;
  title: string;
  provenance: PacketProvenance;
  categories: MarketStructureFact[];
  liquidity_buckets: LiquidityBucketFact[];
}

export interface CaseStudyMilestone {
  snapshot_time: string;
  yes_price: number | null;
  change_from_prior: number | null;
}

export interface CaseStudyPacket {
  slug: string;
  title: string;
  provenance: PacketProvenance;
  event_id: string;
  primary_market: CaseStudyMarket;
  related_markets: CaseStudyMarket[];
  milestones: CaseStudyMilestone[];
  summary: {
    market_count: number;
    snapshot_count: number;
    total_change: number | null;
    total_volume_24h: number;
    average_abs_move: number | null;
    quality_flags: string[];
  };
}

export interface PublishSectionStatus {
  included: boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface DailyPublishPacket {
  slug: string;
  title: string;
  date: string;
  provenance: PacketProvenance;
  headline: {
    summary_facts: string[];
  };
  movers: {
    status: PublishSectionStatus;
    top_repriced: MoverFact[];
    thin_watchlist: MoverFact[];
    thin_market_count: number;
  };
  sectors: {
    status: PublishSectionStatus;
    included: SectorFact[];
    omitted: Array<{ slug: string; reason: string }>;
  };
  market_structure: {
    status: PublishSectionStatus;
    categories: MarketStructureFact[];
    liquidity_buckets: LiquidityBucketFact[];
  };
  caveats: string[];
  quality: {
    is_low_signal_day: boolean;
    passed_global_gate: boolean;
    reason_flags: string[];
  };
}

export interface DeepCaseStudyPublishPacket {
  slug: string;
  title: string;
  provenance: PacketProvenance;
  case_study: CaseStudyPacket;
  caveats: string[];
  quality: {
    publishable: boolean;
    reason_flags: string[];
  };
}

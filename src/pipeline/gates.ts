import {
  type CaseStudyPacket,
  type DailyPublishPacket,
  type DeepCaseStudyPublishPacket,
  type MarketStructurePacket,
  type MoversPacket,
  type SectorFact,
} from "../types.js";
import { REPORT_THRESHOLDS } from "./thresholds.js";

function buildHeadlineFacts(
  movers: MoversPacket,
  includedSectors: SectorFact[],
  structure: MarketStructurePacket,
): string[] {
  const facts: string[] = [];
  const topMover = movers.movers.find(
    (mover) => mover.quality.is_high_confidence,
  );
  if (topMover) {
    facts.push(
      `${topMover.title} moved from ${(topMover.prior_yes_price * 100).toFixed(
        1,
      )}% to ${(topMover.current_yes_price * 100).toFixed(1)}% in 24h.`,
    );
  }

  for (const sector of includedSectors.slice(0, 2)) {
    if (sector.summary.average_implied_yes_probability !== null) {
      facts.push(
        `${sector.title} average implied yes probability is ${(sector.summary.average_implied_yes_probability * 100).toFixed(1)}%.`,
      );
    }
  }

  const topCategory = structure.categories.find(
    (item) => item.meets_min_sample,
  );
  if (topCategory && topCategory.yes_resolution_rate !== null) {
    facts.push(
      `Historically, ${topCategory.category} markets resolved yes ${(topCategory.yes_resolution_rate * 100).toFixed(1)}% of the time.`,
    );
  }

  return facts;
}

export function buildDailyPublishPacket(args: {
  date: string;
  movers: MoversPacket;
  sectors: SectorFact[];
  marketStructure: MarketStructurePacket;
}): DailyPublishPacket {
  const validMovers = args.movers.movers.filter(
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

  const includedSectors = args.sectors
    .filter(
      (sector) =>
        sector.summary.matched_markets >=
          REPORT_THRESHOLDS.sectors.minMatchedMarkets &&
        sector.summary.priced_markets >=
          REPORT_THRESHOLDS.sectors.minPricedMarkets &&
        sector.summary.total_volume_24h >=
          REPORT_THRESHOLDS.sectors.minTotalVolume24h,
    )
    .sort(
      (left, right) =>
        right.summary.total_volume_24h - left.summary.total_volume_24h,
    )
    .slice(0, REPORT_THRESHOLDS.sectors.maxIncludedSectors);

  const omittedSectors = args.sectors
    .filter(
      (sector) =>
        !includedSectors.some((included) => included.slug === sector.slug),
    )
    .map((sector) => ({
      slug: sector.slug,
      reason:
        sector.summary.total_volume_24h <
        REPORT_THRESHOLDS.sectors.minTotalVolume24h
          ? "insufficient_volume"
          : sector.summary.priced_markets <
              REPORT_THRESHOLDS.sectors.minPricedMarkets
            ? "insufficient_priced_markets"
            : "below_publish_priority",
    }));

  const structureCategories = args.marketStructure.categories.filter(
    (category) => category.meets_min_sample,
  );
  const structureBuckets = args.marketStructure.liquidity_buckets.filter(
    (bucket) => bucket.meets_min_sample,
  );

  const globalFlags: string[] = [];
  if (validMovers.length < REPORT_THRESHOLDS.movers.minValidMarkets) {
    globalFlags.push("insufficient_valid_movers");
  }
  if (includedSectors.length < REPORT_THRESHOLDS.global.minValidSectors) {
    globalFlags.push("insufficient_valid_sectors");
  }
  if (structureCategories.length === 0 && structureBuckets.length === 0) {
    globalFlags.push("missing_market_structure");
  }

  const passedGlobalGate = globalFlags.length === 0;
  const isLowSignalDay = !passedGlobalGate;

  const caveats = [
    ...(thinMovers.length > 0
      ? [
          `${thinMovers.length} repricings were suppressed from the main narrative because they failed the high-confidence liquidity/volume gate.`,
        ]
      : []),
    ...omittedSectors.map(
      (sector) =>
        `Sector '${sector.slug}' was omitted from the flagship memo due to ${sector.reason}.`,
    ),
    "Interpretations are market-implied readings, not external-world causal proof.",
  ];

  if (isLowSignalDay) {
    caveats.unshift(
      "This is a low-signal day under the publish gate; sections may be omitted rather than padded with weak claims.",
    );
  }

  return {
    slug: `publish-packet-${args.date}`,
    title: `Publish packet for ${args.date}`,
    date: args.date,
    provenance: {
      generated_at: new Date().toISOString(),
      source: "musashi_truth_layer",
      packet_type: "publish_packet",
      query_window: "24h",
      source_slugs: [
        args.movers.slug,
        ...args.sectors.map((sector) => sector.slug),
        args.marketStructure.slug,
      ],
    },
    headline: {
      summary_facts: buildHeadlineFacts(
        args.movers,
        includedSectors,
        args.marketStructure,
      ),
    },
    movers: {
      status: {
        included:
          validMovers.length >= REPORT_THRESHOLDS.movers.minValidMarkets,
        reason:
          validMovers.length >= REPORT_THRESHOLDS.movers.minValidMarkets
            ? "passed"
            : "insufficient_valid_movers",
        confidence:
          highConfidenceMovers.length >=
          REPORT_THRESHOLDS.movers.minValidMarkets
            ? "high"
            : highConfidenceMovers.length > 0
              ? "medium"
              : "low",
      },
      top_repriced: highConfidenceMovers.slice(
        0,
        REPORT_THRESHOLDS.movers.topCount,
      ),
      thin_watchlist: thinMovers.slice(0, REPORT_THRESHOLDS.movers.topCount),
      thin_market_count: thinMovers.length,
    },
    sectors: {
      status: {
        included:
          includedSectors.length >= REPORT_THRESHOLDS.global.minValidSectors,
        reason:
          includedSectors.length >= REPORT_THRESHOLDS.global.minValidSectors
            ? "passed"
            : "insufficient_valid_sectors",
        confidence:
          includedSectors.length >= 3
            ? "high"
            : includedSectors.length >= 2
              ? "medium"
              : "low",
      },
      included: includedSectors,
      omitted: omittedSectors,
    },
    market_structure: {
      status: {
        included: structureCategories.length > 0 || structureBuckets.length > 0,
        reason:
          structureCategories.length > 0 || structureBuckets.length > 0
            ? "passed"
            : "missing_market_structure",
        confidence: structureCategories.length > 0 ? "high" : "medium",
      },
      categories: structureCategories,
      liquidity_buckets: structureBuckets,
    },
    caveats,
    quality: {
      is_low_signal_day: isLowSignalDay,
      passed_global_gate: passedGlobalGate,
      reason_flags: globalFlags,
    },
  };
}

export function buildCaseStudyPublishPacket(
  caseStudy: CaseStudyPacket,
): DeepCaseStudyPublishPacket {
  const reasons = [...caseStudy.summary.quality_flags];
  const publishable = reasons.length === 0;

  return {
    slug: `publish-${caseStudy.slug}`,
    title: `Publish packet for ${caseStudy.title}`,
    provenance: {
      generated_at: new Date().toISOString(),
      source: "musashi_truth_layer",
      packet_type: "publish_packet",
      query_window: "case-study-window",
      source_slugs: [caseStudy.slug],
    },
    case_study: caseStudy,
    caveats: [
      ...(!publishable
        ? [
            "This event cluster failed the strict publish gate and should not be auto-published.",
          ]
        : []),
      "Interpretations are market-implied readings unless independently verified.",
    ],
    quality: {
      publishable,
      reason_flags: reasons,
    },
  };
}

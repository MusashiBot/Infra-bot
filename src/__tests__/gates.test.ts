import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCaseStudyPublishPacket,
  buildDailyPublishPacket,
} from "../pipeline/gates.js";
import type {
  CaseStudyPacket,
  MarketStructurePacket,
  MoversPacket,
  SectorFact,
} from "../types.js";

function makeMoversPacket(overrides: Partial<MoversPacket> = {}): MoversPacket {
  return {
    slug: "movers-all",
    title: "Movers",
    provenance: {
      generated_at: "2026-05-13T00:00:00.000Z",
      source: "musashi_truth_layer",
      packet_type: "movers_packet",
      query_window: "24h",
    },
    category: null,
    summary: {
      candidate_count: 6,
      valid_count: 6,
      high_confidence_count: 6,
      thin_market_count: 0,
    },
    movers: Array.from({ length: 6 }, (_, index) => ({
      market_id: `m${index}`,
      platform_id: `pm${index}`,
      title: `Mover ${index}`,
      category: "crypto",
      current_yes_price: 0.6,
      prior_yes_price: 0.3,
      change_24h: 0.3,
      abs_change_24h: 0.3,
      volume_24h: 2000,
      liquidity: 6000,
      closes_at: null,
      quality: {
        has_current_price: true,
        has_prior_price: true,
        meets_min_move: true,
        is_high_confidence: true,
        reason_flags: [],
      },
    })),
    ...overrides,
  };
}

function makeSector(slug: string, totalVolume = 8000): SectorFact {
  return {
    slug,
    title: slug,
    provenance: {
      generated_at: "2026-05-13T00:00:00.000Z",
      source: "musashi_truth_layer",
      packet_type: "sector_packet",
      query_window: "24h",
    },
    summary: {
      matched_markets: 6,
      priced_markets: 5,
      average_implied_yes_probability: 0.52,
      total_volume_24h: totalVolume,
      top_market_probability: 0.65,
      dominance_share: 0.4,
      quality_flags: [],
    },
    markets: Array.from({ length: 5 }, (_, index) => ({
      market_id: `${slug}-${index}`,
      platform_id: `${slug}-p${index}`,
      title: `${slug} market ${index}`,
      category: slug,
      yes_price: 0.45 + index * 0.05,
      no_price: 0.55 - index * 0.05,
      volume_24h: 1500,
      liquidity: 7000,
      spread: 0.02,
      closes_at: null,
    })),
  };
}

function makeMarketStructurePacket(): MarketStructurePacket {
  return {
    slug: "market-structure",
    title: "Market structure",
    provenance: {
      generated_at: "2026-05-13T00:00:00.000Z",
      source: "musashi_truth_layer",
      packet_type: "market_structure_packet",
    },
    categories: [
      {
        category: "crypto",
        resolved_count: 30,
        avg_final_yes_price: 0.55,
        avg_preclose_yes_price: 0.57,
        yes_resolution_rate: 0.6,
        meets_min_sample: true,
      },
    ],
    liquidity_buckets: [
      {
        liquidity_bucket: "high",
        resolved_count: 40,
        avg_preclose_yes_price: 0.58,
        yes_resolution_rate: 0.62,
        meets_min_sample: true,
      },
    ],
  };
}

function makeCaseStudyPacket(
  qualityFlags: string[] = [],
  overrides: Partial<CaseStudyPacket> = {},
): CaseStudyPacket {
  return {
    slug: "case-study-fed",
    title: "Case study: Fed",
    provenance: {
      generated_at: "2026-05-13T00:00:00.000Z",
      source: "musashi_truth_layer",
      packet_type: "case_study_packet",
      query_window: "7d",
    },
    event_id: "FED-SEP-2025",
    primary_market: {
      id: "1",
      platform_id: "fed-1",
      title: "Fed will cut",
      category: "fed",
      yes_price: 0.61,
      volume_24h: 5000,
      liquidity: 9000,
      closes_at: null,
    },
    related_markets: [
      {
        id: "1",
        platform_id: "fed-1",
        title: "Fed will cut",
        category: "fed",
        yes_price: 0.61,
        volume_24h: 5000,
        liquidity: 9000,
        closes_at: null,
      },
      {
        id: "2",
        platform_id: "fed-2",
        title: "Fed will hold",
        category: "fed",
        yes_price: 0.25,
        volume_24h: 3000,
        liquidity: 7000,
        closes_at: null,
      },
    ],
    milestones: [
      {
        snapshot_time: "2026-05-12T00:00:00.000Z",
        yes_price: 0.41,
        change_from_prior: null,
      },
      {
        snapshot_time: "2026-05-13T00:00:00.000Z",
        yes_price: 0.61,
        change_from_prior: 0.2,
      },
    ],
    summary: {
      market_count: 3,
      snapshot_count: 12,
      total_change: 0.2,
      total_volume_24h: 12000,
      average_abs_move: 0.15,
      quality_flags: qualityFlags,
    },
    ...overrides,
  };
}

test("buildDailyPublishPacket keeps only valid sectors and passes global gate", () => {
  const packet = buildDailyPublishPacket({
    date: "2026-05-13",
    movers: makeMoversPacket(),
    sectors: [
      makeSector("sector-crypto"),
      makeSector("sector-fed"),
      makeSector("sector-elections", 1000),
    ],
    marketStructure: makeMarketStructurePacket(),
  });

  assert.equal(packet.quality.passed_global_gate, true);
  assert.equal(packet.sectors.included.length, 2);
  assert.equal(packet.sectors.omitted.length, 1);
  assert.equal(packet.sectors.omitted[0]?.reason, "insufficient_volume");
  assert.equal(packet.movers.top_repriced.length, 6);
});

test("buildDailyPublishPacket marks low-signal day when gate fails", () => {
  const packet = buildDailyPublishPacket({
    date: "2026-05-13",
    movers: makeMoversPacket({
      summary: {
        candidate_count: 2,
        valid_count: 2,
        high_confidence_count: 2,
        thin_market_count: 0,
      },
      movers: makeMoversPacket().movers.slice(0, 2),
    }),
    sectors: [makeSector("sector-crypto", 1000)],
    marketStructure: {
      ...makeMarketStructurePacket(),
      categories: [],
      liquidity_buckets: [],
    },
  });

  assert.equal(packet.quality.passed_global_gate, false);
  assert.equal(packet.quality.is_low_signal_day, true);
  assert.deepEqual(packet.quality.reason_flags.sort(), [
    "insufficient_valid_movers",
    "insufficient_valid_sectors",
    "missing_market_structure",
  ]);
});

test("buildCaseStudyPublishPacket blocks weak clusters", () => {
  const packet = buildCaseStudyPublishPacket(
    makeCaseStudyPacket(["insufficient_snapshot_count"]),
  );

  assert.equal(packet.quality.publishable, false);
  assert.deepEqual(packet.quality.reason_flags, [
    "insufficient_snapshot_count",
  ]);
});

test("buildCaseStudyPublishPacket allows strong clusters", () => {
  const packet = buildCaseStudyPublishPacket(makeCaseStudyPacket());

  assert.equal(packet.quality.publishable, true);
  assert.deepEqual(packet.quality.reason_flags, []);
});

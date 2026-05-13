import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNoForbiddenWording,
  buildFlagshipSections,
  validateNarrativeFrame,
} from "../pipeline/memo.js";
import type { DailyPublishPacket } from "../types.js";

function makeDailyPublishPacket(): DailyPublishPacket {
  return {
    slug: "publish-packet-2026-05-13",
    title: "Publish packet",
    date: "2026-05-13",
    provenance: {
      generated_at: "2026-05-13T00:00:00.000Z",
      source: "musashi_truth_layer",
      packet_type: "publish_packet",
      query_window: "24h",
      source_slugs: [
        "movers-all",
        "sector-crypto",
        "sector-fed",
        "market-structure",
      ],
    },
    headline: {
      summary_facts: [
        "Mover A moved from 20.0% to 60.0% in 24h.",
        "Sector crypto average implied yes probability is 52.0%.",
      ],
    },
    movers: {
      status: {
        included: true,
        reason: "passed",
        confidence: "high",
      },
      top_repriced: [
        {
          market_id: "m1",
          platform_id: "pm1",
          title: "Mover A",
          category: "crypto",
          current_yes_price: 0.6,
          prior_yes_price: 0.2,
          change_24h: 0.4,
          abs_change_24h: 0.4,
          volume_24h: 3000,
          liquidity: 8000,
          closes_at: null,
          quality: {
            has_current_price: true,
            has_prior_price: true,
            meets_min_move: true,
            is_high_confidence: true,
            reason_flags: [],
          },
        },
      ],
      thin_watchlist: [
        {
          market_id: "m2",
          platform_id: "pm2",
          title: "Mover B",
          category: "crypto",
          current_yes_price: 0.1,
          prior_yes_price: 0.8,
          change_24h: -0.7,
          abs_change_24h: 0.7,
          volume_24h: 20,
          liquidity: 0,
          closes_at: null,
          quality: {
            has_current_price: true,
            has_prior_price: true,
            meets_min_move: true,
            is_high_confidence: false,
            reason_flags: ["thin_market"],
          },
        },
      ],
      thin_market_count: 1,
    },
    sectors: {
      status: {
        included: true,
        reason: "passed",
        confidence: "high",
      },
      included: [
        {
          slug: "sector-crypto",
          title: "Crypto",
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
            total_volume_24h: 8000,
            top_market_probability: 0.7,
            dominance_share: 0.45,
            quality_flags: [],
          },
          markets: [
            {
              market_id: "cm1",
              platform_id: "cpm1",
              title: "BTC above 120k",
              category: "crypto",
              yes_price: 0.7,
              no_price: 0.3,
              volume_24h: 2200,
              liquidity: 9000,
              spread: 0.01,
              closes_at: null,
            },
          ],
        },
        {
          slug: "sector-fed",
          title: "Fed",
          provenance: {
            generated_at: "2026-05-13T00:00:00.000Z",
            source: "musashi_truth_layer",
            packet_type: "sector_packet",
            query_window: "24h",
          },
          summary: {
            matched_markets: 5,
            priced_markets: 4,
            average_implied_yes_probability: 0.48,
            total_volume_24h: 8200,
            top_market_probability: 0.64,
            dominance_share: 0.39,
            quality_flags: [],
          },
          markets: [
            {
              market_id: "fm1",
              platform_id: "fpm1",
              title: "Fed cuts by September",
              category: "fed",
              yes_price: 0.64,
              no_price: 0.36,
              volume_24h: 2400,
              liquidity: 10000,
              spread: 0.02,
              closes_at: null,
            },
          ],
        },
      ],
      omitted: [],
    },
    market_structure: {
      status: {
        included: true,
        reason: "passed",
        confidence: "high",
      },
      categories: [
        {
          category: "crypto",
          resolved_count: 30,
          avg_final_yes_price: 0.55,
          avg_preclose_yes_price: 0.57,
          yes_resolution_rate: 0.61,
          meets_min_sample: true,
        },
      ],
      liquidity_buckets: [
        {
          liquidity_bucket: "high",
          resolved_count: 40,
          avg_preclose_yes_price: 0.58,
          yes_resolution_rate: 0.63,
          meets_min_sample: true,
        },
      ],
    },
    caveats: [
      "1 repricing was suppressed from the main narrative because it failed the high-confidence liquidity/volume gate.",
      "Interpretations are market-implied readings, not external-world causal proof.",
    ],
    quality: {
      is_low_signal_day: false,
      passed_global_gate: true,
      reason_flags: [],
    },
  };
}

test("buildFlagshipSections creates numeric mover bullets", () => {
  const sections = buildFlagshipSections(makeDailyPublishPacket());
  const repriced = sections.find(
    (section) => section.heading === "What repriced",
  );

  assert.ok(repriced);
  assert.match(repriced.bullets[0] ?? "", /20\.0%/);
  assert.match(repriced.bullets[0] ?? "", /60\.0%/);
  assert.match(repriced.bullets[0] ?? "", /\+40\.0 pts/);
});

test("assertNoForbiddenWording rejects unsupported causal phrasing", () => {
  assert.throws(
    () =>
      assertNoForbiddenWording(
        "This moved because CPI printed hot.",
        "summary",
      ),
    /Forbidden causal wording/,
  );
});

test("validateNarrativeFrame accepts neutral summary and title", () => {
  assert.doesNotThrow(() =>
    validateNarrativeFrame({
      title: "Kalshi Market Pulse: May 13",
      summary:
        "Kalshi repricings were concentrated in crypto and Fed contracts, with market-implied positioning strongest in liquid contracts.",
    }),
  );
});

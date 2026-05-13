import { z } from "zod";
import { generateStructuredNarrative } from "../llm/index.js";
import type {
  CaseStudyMilestone,
  DailyPublishPacket,
  DeepCaseStudyPublishPacket,
  NarrativeReportPayload,
  NarrativeReportSection,
  ReportFileSet,
} from "../types.js";
import { formatPercent, formatSignedPercent } from "../utils.js";

const NarrativeFrameSchema = z.object({
  title: z.string(),
  summary: z.string(),
});

const FORBIDDEN_PATTERNS = [
  /\bbecause\b/i,
  /\bdue to\b/i,
  /\bcaused by\b/i,
  /\bthe market learned\b/i,
];

function renderNarrativeMarkdown(payload: NarrativeReportPayload): string {
  return [
    `# ${payload.title}`,
    "",
    payload.summary,
    "",
    ...payload.sections.flatMap((section) => [
      `## ${section.heading}`,
      ...section.bullets.map((bullet) => `- ${bullet}`),
      "",
    ]),
    "## Caveats",
    ...payload.caveats.map((caveat) => `- ${caveat}`),
  ].join("\n");
}

export function assertNoForbiddenWording(value: string, label: string): void {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`Forbidden causal wording in ${label}: ${value}`);
    }
  }
}

export function validateNarrativeFrame(payload: {
  title: string;
  summary: string;
}): void {
  assertNoForbiddenWording(payload.title, "title");
  assertNoForbiddenWording(payload.summary, "summary");
}

function renderMoverBullet(args: {
  title: string;
  prior: number;
  current: number;
  change: number;
}): string {
  return `${args.title}: probability moved from ${formatPercent(
    args.prior,
  )} to ${formatPercent(args.current)} in 24h (${formatSignedPercent(
    args.change,
  )}); high-confidence repricing.`;
}

export function buildFlagshipSections(
  packet: DailyPublishPacket,
): NarrativeReportSection[] {
  const headlineBullets =
    packet.headline.summary_facts.length > 0
      ? packet.headline.summary_facts
      : [
          "No sufficiently strong cross-section of signals cleared the daily gate.",
        ];

  const moverBullets = packet.movers.top_repriced.map((mover) =>
    renderMoverBullet({
      title: mover.title,
      prior: mover.prior_yes_price,
      current: mover.current_yes_price,
      change: mover.change_24h,
    }),
  );

  const sectorBullets = packet.sectors.included.flatMap((sector) => {
    const bullets: string[] = [];
    if (sector.summary.average_implied_yes_probability !== null) {
      bullets.push(
        `${sector.title}: average implied yes probability is ${formatPercent(
          sector.summary.average_implied_yes_probability,
        )} across ${sector.summary.priced_markets} priced markets, with ${sector.summary.total_volume_24h.toLocaleString()} in 24h volume.`,
      );
    } else {
      bullets.push(
        `${sector.title}: ${sector.summary.priced_markets} priced markets cleared the sector gate, with ${sector.summary.total_volume_24h.toLocaleString()} in 24h volume.`,
      );
    }

    for (const market of sector.markets.slice(0, 2)) {
      if (market.yes_price === null) {
        continue;
      }

      bullets.push(
        `${sector.title} watchlist: ${market.title} sits at ${formatPercent(
          market.yes_price,
        )}.`,
      );
    }

    return bullets;
  });

  const trustBullets = [
    ...packet.market_structure.categories.slice(0, 2).map((category) => {
      const rate =
        category.yes_resolution_rate === null
          ? "n/a"
          : formatPercent(category.yes_resolution_rate);
      return `Historically, ${category.category} markets resolved yes ${rate} of the time across ${category.resolved_count} resolved markets.`;
    }),
    ...packet.market_structure.liquidity_buckets.slice(0, 2).map((bucket) => {
      const rate =
        bucket.yes_resolution_rate === null
          ? "n/a"
          : formatPercent(bucket.yes_resolution_rate);
      return `Historically, the ${bucket.liquidity_bucket} liquidity bucket resolved yes ${rate} of the time across ${bucket.resolved_count} resolved markets.`;
    }),
  ];

  return [
    {
      heading: "Headline",
      bullets: headlineBullets,
    },
    {
      heading: "What repriced",
      bullets:
        moverBullets.length > 0
          ? moverBullets
          : [
              "No high-confidence repricings cleared the flagship narrative gate; thin-market moves were suppressed and moved into caveats only.",
            ],
    },
    {
      heading: "What markets imply right now",
      bullets:
        sectorBullets.length > 0
          ? sectorBullets
          : [
              "No sector packet cleared the publication thresholds for this memo.",
            ],
    },
    {
      heading: "How trustworthy this signal is",
      bullets:
        trustBullets.length > 0
          ? trustBullets
          : [
              "No category or liquidity bucket cleared the minimum resolved-count threshold for publication.",
            ],
    },
  ];
}

function buildCaseStudyTimelineBullets(
  milestones: CaseStudyMilestone[],
): string[] {
  return milestones.map((milestone) => {
    const probabilityText =
      milestone.yes_price === null ? "n/a" : formatPercent(milestone.yes_price);
    return `Primary market sat at ${probabilityText} on ${milestone.snapshot_time}.`;
  });
}

export function buildCaseStudySections(
  packet: DeepCaseStudyPublishPacket,
): NarrativeReportSection[] {
  const caseStudy = packet.case_study;
  const relatedMarkets = caseStudy.related_markets.slice(0, 4).map((market) => {
    const currentText =
      market.yes_price === null ? "n/a" : formatPercent(market.yes_price);
    const moveText =
      market === caseStudy.primary_market
        ? ""
        : ` with liquidity ${market.liquidity?.toLocaleString() ?? "n/a"}`;
    return `${market.title}: current probability ${currentText}${moveText}.`;
  });

  return [
    {
      heading: "Headline",
      bullets: [
        `Cluster ${caseStudy.event_id} includes ${caseStudy.summary.market_count} tracked markets and ${caseStudy.summary.snapshot_count} primary-market snapshots.`,
      ],
    },
    {
      heading: "Timeline",
      bullets: buildCaseStudyTimelineBullets(caseStudy.milestones),
    },
    {
      heading: "Cluster context",
      bullets: [
        `Aggregate 24h volume across the cluster is ${caseStudy.summary.total_volume_24h.toLocaleString()}, and average absolute 24h move is ${formatSignedPercent(caseStudy.summary.average_abs_move)}.`,
        ...relatedMarkets,
      ],
    },
  ];
}

function buildLowSignalMemo(packet: DailyPublishPacket): ReportFileSet {
  const payload: NarrativeReportPayload = {
    title: `Kalshi Market Pulse: ${packet.date} – Low-Signal Day`,
    generated_at: new Date().toISOString(),
    summary:
      "Today’s Kalshi surface did not clear Musashi’s strict publication gate across enough sections to support a full flagship memo.",
    sections: [
      {
        heading: "Headline",
        bullets:
          packet.headline.summary_facts.length > 0
            ? packet.headline.summary_facts
            : [
                "No sufficiently strong cross-section of signals cleared the daily gate.",
              ],
      },
    ],
    caveats: packet.caveats,
    source_report_slugs: packet.provenance.source_slugs ?? [],
  };

  return {
    slug: `deep-daily-${packet.date}`,
    title: payload.title,
    markdown: renderNarrativeMarkdown(payload),
    json: {
      ...payload,
      source_publish_packet_slug: packet.slug,
      publish_packet: packet,
      low_signal: true,
    },
  };
}

async function generateFlagshipFrame(
  packet: DailyPublishPacket,
): Promise<{ title: string; summary: string }> {
  try {
    const raw = await generateStructuredNarrative({
      system: [
        "You write analytical, crisp public market-intelligence memo framing for Musashi.",
        "Use ONLY the validated publish packet provided by the user.",
        "Return strict JSON with keys: title and summary.",
        "Do not use unsupported causal language.",
        "Do not restate every detail; summarize the strongest validated signal set.",
      ].join(" "),
      user: [
        "Write a title and 2-4 sentence summary for the flagship daily memo.",
        "Frame everything as market-implied or observed repricing, not causal proof.",
        "Publish packet:",
        JSON.stringify(packet, null, 2),
      ].join("\n\n"),
      maxTokens: 500,
      temperature: 0.2,
    });

    const parsed = NarrativeFrameSchema.parse(JSON.parse(raw));
    validateNarrativeFrame(parsed);
    return parsed;
  } catch {
    const sectorTitles = packet.sectors.included.map((sector) => sector.title);
    const sectorSummary =
      sectorTitles.length > 0
        ? `Validated sector reads came from ${sectorTitles.join(", ")}.`
        : "No sector read cleared the publish gate.";

    return {
      title: `Kalshi Market Pulse: ${packet.date}`,
      summary: `${packet.headline.summary_facts[0] ?? "No top repricing cleared the publish gate."} ${sectorSummary} Historical trust context is included only from categories and liquidity buckets that met the minimum resolved-count threshold.`,
    };
  }
}

async function generateCaseStudyFrame(
  packet: DeepCaseStudyPublishPacket,
): Promise<{ title: string; summary: string }> {
  try {
    const raw = await generateStructuredNarrative({
      system: [
        "You write analytical case-study memo framing for Musashi.",
        "Use ONLY the validated case-study publish packet.",
        "Return strict JSON with keys: title and summary.",
        "Do not use unsupported causal language.",
        "Keep the framing grounded in timeline and cluster behavior.",
      ].join(" "),
      user: [
        "Write a title and 2-4 sentence summary for one event-cluster memo.",
        "Frame everything as observed repricing or market-implied interpretation.",
        "Publish packet:",
        JSON.stringify(packet, null, 2),
      ].join("\n\n"),
      maxTokens: 450,
      temperature: 0.2,
    });

    const parsed = NarrativeFrameSchema.parse(JSON.parse(raw));
    validateNarrativeFrame(parsed);
    return parsed;
  } catch {
    return {
      title: `Case Study: ${packet.case_study.primary_market.title}`,
      summary: `This memo tracks the ${packet.case_study.event_id} cluster through ${packet.case_study.summary.snapshot_count} primary-market snapshots and ${packet.case_study.summary.market_count} related markets. The framing is limited to observed repricing, timeline milestones, and cluster-level context that cleared the case-study publish gate.`,
    };
  }
}

export async function generateFlagshipMemoFromPublishPacket(
  packet: DailyPublishPacket,
): Promise<ReportFileSet> {
  if (!packet.quality.passed_global_gate) {
    return buildLowSignalMemo(packet);
  }

  const frame = await generateFlagshipFrame(packet);
  const payload: NarrativeReportPayload = {
    title: frame.title,
    generated_at: new Date().toISOString(),
    summary: frame.summary,
    sections: buildFlagshipSections(packet),
    caveats: packet.caveats,
    source_report_slugs: packet.provenance.source_slugs ?? [],
  };

  return {
    slug: `deep-daily-${packet.date}`,
    title: payload.title,
    markdown: renderNarrativeMarkdown(payload),
    json: {
      ...payload,
      source_publish_packet_slug: packet.slug,
      publish_packet: packet,
      low_signal: false,
    },
  };
}

export async function generateDeepCaseStudyMemoFromPublishPacket(
  packet: DeepCaseStudyPublishPacket,
): Promise<ReportFileSet> {
  if (!packet.quality.publishable) {
    throw new Error(
      `Case study did not pass publish gate: ${packet.quality.reason_flags.join(", ")}`,
    );
  }

  const frame = await generateCaseStudyFrame(packet);
  const payload: NarrativeReportPayload = {
    title: frame.title,
    generated_at: new Date().toISOString(),
    summary: frame.summary,
    sections: buildCaseStudySections(packet),
    caveats: packet.caveats,
    source_report_slugs: packet.provenance.source_slugs ?? [],
  };

  return {
    slug: `deep-case-study-${packet.case_study.event_id}`,
    title: payload.title,
    markdown: renderNarrativeMarkdown(payload),
    json: {
      ...payload,
      source_publish_packet_slug: packet.slug,
      publish_packet: packet,
      event_id: packet.case_study.event_id,
    },
  };
}

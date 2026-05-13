import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getEnv } from "../config.js";
import { generateStructuredNarrative } from "../llm.js";
import type { NarrativeReportPayload, ReportFileSet } from "../types.js";
import { slugify, todaySlug } from "../utils.js";

const NarrativePayloadSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      bullets: z.array(z.string()).min(1),
    }),
  ),
  caveats: z.array(z.string()).default([]),
});

interface DeepFromCacheArgs {
  date?: string | null;
}

async function readJson(date: string, slug: string): Promise<unknown | null> {
  const env = getEnv();
  const filePath = path.join(env.OUTPUT_DIR, date, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function compactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => compactValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        compactValue(inner),
      ]),
    );
  }

  if (typeof value === "string" && value.length > 280) {
    return `${value.slice(0, 277)}...`;
  }

  return value;
}

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

export async function generateDeepCachedDailyReport(
  args: DeepFromCacheArgs = {},
): Promise<ReportFileSet> {
  const date = args.date ?? todaySlug();
  const sourceSlugs = [
    "movers-all",
    "movers-crypto",
    "sector-crypto",
    "sector-fed",
    "sector-elections",
    "market-structure",
  ];

  const reports = await Promise.all(
    sourceSlugs.map(async (slug) => ({
      slug,
      json: await readJson(date, slug),
    })),
  );

  const availableReports = reports.filter((report) => report.json !== null);
  if (availableReports.length === 0) {
    throw new Error(`No cached reports found for ${date}`);
  }

  const system = [
    "You write grounded market-intelligence reports for Musashi.",
    "Use ONLY the structured data provided by the user.",
    "Do not invent outside news or causal claims not supported by the input.",
    "Frame any interpretation as a market-implied reading or hypothesis unless directly observed.",
    "Return strict JSON with keys: title, summary, sections, caveats.",
  ].join(" ");

  const user = [
    "Write an in-depth but readable report showing what Kalshi is saying this period.",
    "Prioritize: biggest repricings, sector-level readings, and market-structure implications.",
    "Every bullet should point to a specific observed signal from the input.",
    "Source data:",
    JSON.stringify(
      {
        date,
        reports: availableReports.map((report) => ({
          slug: report.slug,
          json: compactValue(report.json),
        })),
      },
      null,
      2,
    ),
  ].join("\n\n");

  const llmRaw = await generateStructuredNarrative({ system, user });
  const parsed = NarrativePayloadSchema.parse(JSON.parse(llmRaw));

  const payload: NarrativeReportPayload = {
    title: parsed.title,
    generated_at: new Date().toISOString(),
    summary: parsed.summary,
    sections: parsed.sections,
    caveats:
      parsed.caveats.length > 0
        ? parsed.caveats
        : [
            "This report is synthesized from Musashi truth-layer market data.",
            "Interpretations should be treated as market-implied readings unless independently verified.",
          ],
    source_report_slugs: availableReports.map((report) => report.slug),
  };

  return {
    slug: slugify(`deep-daily-${date}`),
    title: payload.title,
    markdown: renderNarrativeMarkdown(payload),
    json: {
      ...payload,
      source_date: date,
    },
  };
}

import { z } from "zod";
import { generateStructuredNarrative } from "../llm.js";
import type {
  NarrativeReportPayload,
  ReportFileSet,
  ReportFileSet as BaseReport,
} from "../types.js";
import { slugify } from "../utils.js";
import { generateDailyPack } from "./daily-pack.js";

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

function compactSourceReports(reports: BaseReport[]): unknown[] {
  return reports.map((report) => ({
    slug: report.slug,
    title: report.title,
    json: compactValue(report.json),
  }));
}

function compactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => compactValue(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, innerValue]) => [key, compactValue(innerValue)] as const,
    );

    return Object.fromEntries(entries);
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

export async function generateDeepDailyReport(): Promise<ReportFileSet> {
  const baseReports = await generateDailyPack();
  const sourceReports = baseReports;

  const system = [
    "You are writing a market-intelligence report for Musashi.",
    "Use ONLY the structured data provided by the user.",
    "Do not invent outside news, causal explanations, or facts not present in the input.",
    "You may describe observed repricings, sector positioning, cluster-level movement, and calibrated hypotheses.",
    "If a claim is interpretive rather than directly observed, label it as a hypothesis or market-implied reading.",
    "Return strict JSON with keys: title, summary, sections, caveats.",
    "Each section must have heading and bullets.",
  ].join(" ");

  const user = [
    "Write one concise but real report showing how prediction markets interacted with the world this period.",
    "Focus on: biggest repricings, sector-level readings, one case-study cluster if provided, and market-structure takeaways.",
    "Avoid generic filler. Every bullet should point to a concrete observed signal in the input.",
    "Source data:",
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        reports: compactSourceReports(sourceReports),
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
            "This report is grounded in Musashi truth-layer market data, not external news ingestion.",
            "Any causal interpretation should be treated as a market-implied hypothesis unless explicitly evidenced in the source data.",
          ],
    source_report_slugs: sourceReports.map((report) => report.slug),
  };

  return {
    slug: slugify("deep-daily"),
    title: payload.title,
    markdown: renderNarrativeMarkdown(payload),
    json: {
      ...payload,
    },
  };
}

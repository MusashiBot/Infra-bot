import { z } from "zod";
import { generateStructuredNarrative } from "../llm.js";
import type { NarrativeReportPayload, ReportFileSet } from "../types.js";
import { slugify } from "../utils.js";
import { generateCaseStudy } from "./case-study.js";

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

interface DeepCaseStudyArgs {
  eventId: string;
}

function compactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => compactValue(item));
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

export async function generateDeepCaseStudyReport(
  args: DeepCaseStudyArgs,
): Promise<ReportFileSet> {
  const caseStudy = await generateCaseStudy({ eventId: args.eventId });

  const system = [
    "You are writing a case-study thread for Musashi about one prediction-market event cluster.",
    "Use ONLY the structured data provided by the user.",
    "Do not invent outside events or news.",
    "Describe what repriced, when it repriced, and what related contracts did around the same period.",
    "If you infer a possible interpretation, label it as a market-implied hypothesis.",
    "Return strict JSON with keys: title, summary, sections, caveats.",
  ].join(" ");

  const user = [
    "Write a clean event-cluster case study that could be used as a high-quality social thread or research note.",
    "Focus on timeline, cluster behavior, and what the market appeared to learn over time.",
    "Source data:",
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        case_study: compactValue(caseStudy.json),
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
            "This case study is based on Musashi market and snapshot data, not external news ingestion.",
            "Interpretations should be treated as market-implied readings unless independently verified.",
          ],
    source_report_slugs: [caseStudy.slug],
  };

  return {
    slug: slugify(`deep-case-study-${args.eventId}`),
    title: payload.title,
    markdown: renderNarrativeMarkdown(payload),
    json: {
      ...payload,
      event_id: args.eventId,
      source_case_study_slug: caseStudy.slug,
    },
  };
}

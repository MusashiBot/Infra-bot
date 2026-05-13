import fs from "node:fs/promises";
import path from "node:path";
import { getEnv } from "./config.js";
import type { ReportFileSet } from "./types.js";

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function todaySlug(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatPercent(value: unknown): string {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return "n/a";
  }

  return `${(numeric * 100).toFixed(1)}%`;
}

export function formatSignedPercent(value: unknown): string {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return "n/a";
  }

  const pct = numeric * 100;
  const prefix = pct > 0 ? "+" : "";
  return `${prefix}${pct.toFixed(1)} pts`;
}

export function formatCurrency(value: unknown): string {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return "n/a";
  }

  return `$${Math.round(numeric).toLocaleString()}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "n/a";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toISOString().slice(0, 16).replace("T", " ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function writeReport(
  report: ReportFileSet,
): Promise<{ mdPath: string; jsonPath: string }> {
  const env = getEnv();
  const dateDir = path.join(env.OUTPUT_DIR, todaySlug());
  await fs.mkdir(dateDir, { recursive: true });

  const mdPath = path.join(dateDir, `${report.slug}.md`);
  const jsonPath = path.join(dateDir, `${report.slug}.json`);

  await fs.writeFile(mdPath, report.markdown, "utf8");
  await fs.writeFile(
    jsonPath,
    `${JSON.stringify(report.json, null, 2)}\n`,
    "utf8",
  );

  return { mdPath, jsonPath };
}

export function parseArg(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag);
  if (index === -1 || index === args.length - 1) return null;
  return args[index + 1] ?? null;
}

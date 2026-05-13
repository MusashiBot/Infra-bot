import type { ReportFileSet } from "../types.js";
import { generateCaseStudy } from "./case-study.js";
import { generateMarketStructureReport } from "./market-structure.js";
import { generateMoversReport } from "./movers.js";
import { generateSectorSnapshot } from "./sector-snapshot.js";

export async function generateDailyPack(): Promise<ReportFileSet[]> {
  const reports: ReportFileSet[] = [];

  reports.push(await generateMoversReport());
  reports.push(await generateMoversReport("crypto"));
  reports.push(await generateSectorSnapshot("crypto"));
  reports.push(await generateSectorSnapshot("fed"));
  reports.push(await generateSectorSnapshot("elections"));
  reports.push(await generateMarketStructureReport());

  return reports;
}

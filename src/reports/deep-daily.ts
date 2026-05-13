import { buildDailyPublishPacket } from "../pipeline/gates.js";
import { generateFlagshipMemoFromPublishPacket } from "../pipeline/memo.js";
import type {
  MarketStructurePacket,
  MoversPacket,
  ReportFileSet,
  SectorFact,
} from "../types.js";
import { todaySlug } from "../utils.js";
import { generateDailyPack } from "./daily-pack.js";

export async function generateDeepDailyReport(): Promise<ReportFileSet> {
  const sourceReports = await generateDailyPack();

  const movers = sourceReports.find((report) => report.slug === "movers-all")
    ?.json as MoversPacket | undefined;
  const marketStructure = sourceReports.find(
    (report) => report.slug === "market-structure",
  )?.json as MarketStructurePacket | undefined;
  const sectors = sourceReports
    .filter((report) => report.slug.startsWith("sector-"))
    .map((report) => report.json as SectorFact);

  if (!movers) {
    throw new Error("Daily source pack missing movers-all packet");
  }
  if (!marketStructure) {
    throw new Error("Daily source pack missing market-structure packet");
  }

  const publishPacket = buildDailyPublishPacket({
    date: todaySlug(),
    movers,
    sectors,
    marketStructure,
  });

  return generateFlagshipMemoFromPublishPacket(publishPacket);
}

import fs from "node:fs/promises";
import path from "node:path";
import { getEnv } from "../config.js";
import { buildDailyPublishPacket } from "../pipeline/gates.js";
import { generateFlagshipMemoFromPublishPacket } from "../pipeline/memo.js";
import type {
  MarketStructurePacket,
  MoversPacket,
  ReportFileSet,
  SectorFact,
} from "../types.js";
import { todaySlug } from "../utils.js";

interface DeepFromCacheArgs {
  date?: string | null;
}

async function readRequiredJson<T>(date: string, slug: string): Promise<T> {
  const env = getEnv();
  const filePath = path.join(env.OUTPUT_DIR, date, `${slug}.json`);
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

export async function generateDeepCachedDailyReport(
  args: DeepFromCacheArgs = {},
): Promise<ReportFileSet> {
  const date = args.date ?? todaySlug();
  const movers = await readRequiredJson<MoversPacket>(date, "movers-all");
  const sectorCrypto = await readRequiredJson<SectorFact>(
    date,
    "sector-crypto",
  );
  const sectorFed = await readRequiredJson<SectorFact>(date, "sector-fed");
  const sectorElections = await readRequiredJson<SectorFact>(
    date,
    "sector-elections",
  );
  const marketStructure = await readRequiredJson<MarketStructurePacket>(
    date,
    "market-structure",
  );

  const publishPacket = buildDailyPublishPacket({
    date,
    movers,
    sectors: [sectorCrypto, sectorFed, sectorElections],
    marketStructure,
  });

  return generateFlagshipMemoFromPublishPacket(publishPacket);
}

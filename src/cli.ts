import { closeDb } from "./db.js";
import { generateCaseStudy } from "./reports/case-study.js";
import { generateDeepCaseStudyReport } from "./reports/deep-case-study.js";
import { generateDeepCachedDailyReport } from "./reports/deep-from-cache.js";
import { generateDeepDailyReport } from "./reports/deep-daily.js";
import { generateDailyPack } from "./reports/daily-pack.js";
import { generateMarketStructureReport } from "./reports/market-structure.js";
import { generateMoversReport } from "./reports/movers.js";
import { generateSectorSnapshot } from "./reports/sector-snapshot.js";
import type { ReportFileSet } from "./types.js";
import { parseArg, writeReport } from "./utils.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    throw new Error(
      "Missing command. Use daily-pack, deep-daily, deep-daily-from-cache, deep-case-study, movers, sector-snapshot, case-study, or market-structure.",
    );
  }

  let reports: ReportFileSet[] = [];

  switch (command) {
    case "daily-pack":
      reports = await generateDailyPack();
      break;
    case "deep-daily":
      reports = [await generateDeepDailyReport()];
      break;
    case "deep-daily-from-cache":
      reports = [
        await generateDeepCachedDailyReport({
          date: parseArg(args, "--date"),
        }),
      ];
      break;
    case "deep-case-study": {
      const eventId = parseArg(args, "--event-id");
      if (!eventId) throw new Error("Missing --event-id");
      reports = [await generateDeepCaseStudyReport({ eventId })];
      break;
    }
    case "movers":
      reports = [
        await generateMoversReport(parseArg(args, "--category") ?? undefined),
      ];
      break;
    case "sector-snapshot": {
      const sector = parseArg(args, "--sector");
      if (!sector) throw new Error("Missing --sector");
      reports = [await generateSectorSnapshot(sector)];
      break;
    }
    case "case-study": {
      const eventId = parseArg(args, "--event-id");
      if (!eventId) throw new Error("Missing --event-id");
      reports = [await generateCaseStudy({ eventId })];
      break;
    }
    case "market-structure":
      reports = [await generateMarketStructureReport()];
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  const written = [];
  for (const report of reports) {
    written.push(await writeReport(report));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        command,
        generated_reports: reports.map((report) => report.slug),
        written,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });

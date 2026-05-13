import { buildCaseStudyPublishPacket } from "../pipeline/gates.js";
import { generateDeepCaseStudyMemoFromPublishPacket } from "../pipeline/memo.js";
import type { CaseStudyPacket, ReportFileSet } from "../types.js";
import { generateCaseStudy } from "./case-study.js";

interface DeepCaseStudyArgs {
  eventId: string;
}

export async function generateDeepCaseStudyReport(
  args: DeepCaseStudyArgs,
): Promise<ReportFileSet> {
  const caseStudyReport = await generateCaseStudy({ eventId: args.eventId });
  const caseStudyPacket = caseStudyReport.json as CaseStudyPacket;
  const publishPacket = buildCaseStudyPublishPacket(caseStudyPacket);

  return generateDeepCaseStudyMemoFromPublishPacket(publishPacket);
}

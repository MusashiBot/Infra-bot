import { getSql } from "../db.js";
import { getEnv } from "../config.js";
import type {
  CaseStudyMarket,
  ReportFileSet,
  SnapshotPoint,
} from "../types.js";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedPercent,
  parseArg,
  slugify,
} from "../utils.js";

interface CaseStudyArgs {
  eventId: string;
}

export async function generateCaseStudy(
  args: CaseStudyArgs,
): Promise<ReportFileSet> {
  const sql = getSql();
  const env = getEnv();
  const markets = await sql<CaseStudyMarket[]>`
    with latest_snapshots as (
      select distinct on (s.market_id)
        s.market_id,
        s.yes_price,
        s.volume_24h,
        s.liquidity
      from market_snapshots s
      order by s.market_id, s.snapshot_time desc
    )
    select
      m.id,
      m.platform_id,
      m.title,
      m.category,
      coalesce(m.yes_price, ls.yes_price) as yes_price,
      coalesce(m.volume_24h, ls.volume_24h) as volume_24h,
      coalesce(m.liquidity, ls.liquidity) as liquidity,
      m.closes_at
    from markets m
    left join latest_snapshots ls on ls.market_id = m.id
    where m.platform = 'kalshi'
      and m.event_id = ${args.eventId}
    order by coalesce(m.liquidity, ls.liquidity, 0) desc, coalesce(m.volume_24h, ls.volume_24h, 0) desc
  `;

  if (markets.length === 0) {
    throw new Error(`No markets found for event_id=${args.eventId}`);
  }

  const primary = markets[0]!;
  const snapshots = await sql<SnapshotPoint[]>`
    select
      snapshot_time,
      yes_price
    from market_snapshots
    where market_id = ${primary.id}
      and snapshot_time >= now() - (${env.CASE_STUDY_WINDOW_DAYS} * interval '1 day')
    order by snapshot_time asc
  `;

  const milestones = buildMilestones(snapshots);
  const latest = snapshots.at(-1) ?? null;
  const first = snapshots[0] ?? null;
  const totalChange =
    latest && first && latest.yes_price !== null && first.yes_price !== null
      ? latest.yes_price - first.yes_price
      : null;

  const title = `Case study: ${primary.title}`;
  const markdown = [
    `# ${title}`,
    "",
    `Primary market: **${primary.title}**`,
    `- current yes: ${formatPercent(primary.yes_price)}`,
    `- ${env.CASE_STUDY_WINDOW_DAYS}d change: ${formatSignedPercent(totalChange)}`,
    `- liquidity: ${formatCurrency(primary.liquidity)}`,
    `- volume 24h: ${formatCurrency(primary.volume_24h)}`,
    `- closes: ${formatDate(primary.closes_at)}`,
    "",
    `Related markets in cluster: ${markets.length}`,
    "",
    "## Timeline highlights",
    ...milestones.map(
      (milestone, index) =>
        `${index + 1}. ${formatDate(milestone.snapshot_time)} | yes ${formatPercent(
          milestone.yes_price,
        )} | move vs prior ${formatSignedPercent(milestone.change_from_prior)}`,
    ),
    "",
    "## Related markets",
    ...markets
      .slice(0, 10)
      .map(
        (market, index) =>
          `${index + 1}. **${market.title}** | yes ${formatPercent(market.yes_price)} | liq ${formatCurrency(
            market.liquidity,
          )}`,
      ),
  ].join("\n");

  return {
    slug: slugify(`case-study-${args.eventId}`),
    title,
    markdown,
    json: {
      title,
      event_id: args.eventId,
      generated_at: new Date().toISOString(),
      primary,
      markets,
      milestones,
    },
  };
}

interface Milestone extends SnapshotPoint {
  change_from_prior: number | null;
}

function buildMilestones(snapshots: SnapshotPoint[]): Milestone[] {
  const enriched = snapshots.map<Milestone>((snapshot, index) => {
    const prior = snapshots[index - 1];
    return {
      ...snapshot,
      change_from_prior:
        prior && snapshot.yes_price !== null && prior.yes_price !== null
          ? snapshot.yes_price - prior.yes_price
          : null,
    };
  });

  const withChanges = enriched.filter((row) => row.change_from_prior !== null);
  const topMoves = [...withChanges]
    .sort(
      (left, right) =>
        Math.abs(right.change_from_prior ?? 0) -
        Math.abs(left.change_from_prior ?? 0),
    )
    .slice(0, 5);

  const combined = new Map<string, Milestone>();
  for (const milestone of [enriched[0], ...topMoves, enriched.at(-1)].filter(
    Boolean,
  ) as Milestone[]) {
    combined.set(milestone.snapshot_time, milestone);
  }

  return Array.from(combined.values()).sort((left, right) =>
    left.snapshot_time.localeCompare(right.snapshot_time),
  );
}

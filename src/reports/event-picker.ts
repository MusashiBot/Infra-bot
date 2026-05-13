import { getSql } from "../db.js";
import type { EventClusterCandidate } from "../types.js";

export async function pickStrongestActiveEventCluster(): Promise<
  string | null
> {
  const sql = getSql();
  const rows = await sql<EventClusterCandidate[]>`
    with event_market_changes as (
      select
        m.event_id,
        m.id,
        abs(
          coalesce(
            m.yes_price,
            (
              select s_latest.yes_price
              from market_snapshots s_latest
              where s_latest.market_id = m.id
              order by s_latest.snapshot_time desc
              limit 1
            )
          ) - (
            select s_prior.yes_price
            from market_snapshots s_prior
            where s_prior.market_id = m.id
              and s_prior.snapshot_time <= now() - interval '24 hours'
            order by s_prior.snapshot_time desc
            limit 1
          )
        ) as abs_change_24h,
        coalesce(
          m.volume_24h,
          (
            select s_latest.volume_24h
            from market_snapshots s_latest
            where s_latest.market_id = m.id
            order by s_latest.snapshot_time desc
            limit 1
          )
        ) as volume_24h
      from markets m
      where m.platform = 'kalshi'
        and m.is_active = true
        and m.event_id is not null
    )
    select
      event_id,
      count(*)::int as market_count,
      avg(abs_change_24h)::float8 as avg_abs_change_24h,
      sum(volume_24h)::float8 as total_volume_24h
    from event_market_changes
    where abs_change_24h is not null
    group by event_id
    having count(*) >= 2
    order by avg_abs_change_24h desc nulls last, total_volume_24h desc nulls last
    limit 1
  `;

  return rows[0]?.event_id ?? null;
}

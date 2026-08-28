/**
 * Polls the host-side agent for CPU/RAM/disk + per-container usage and
 * persists raw samples, then periodically rolls raw samples up into
 * hourly/daily aggregates (for the week/month/year charts) and prunes old
 * rows — same `setInterval`, no-cron-library shape as the message-retention
 * sweep in collector.ts.
 */
import { getDb } from "./db";
import { config } from "./config";
import { logger } from "./logger";
import { getAgentSnapshot, type AgentSnapshot } from "./agent-client";

type SampleRow = [target: string, cpuPct: number | null, usedBytes: number | null, totalBytes: number | null];

function toRows(snapshot: AgentSnapshot): SampleRow[] {
  const rows: SampleRow[] = [
    ["host", snapshot.host.cpuPct, snapshot.host.memUsedBytes, snapshot.host.memTotalBytes],
  ];
  for (const disk of snapshot.host.disks) {
    rows.push([`disk:${disk.mount}`, null, disk.usedBytes, disk.totalBytes]);
  }
  for (const c of snapshot.containers) {
    rows.push([c.name, c.cpuPct, c.memUsedBytes, c.memLimitBytes]);
  }
  return rows;
}

function insertSnapshot(snapshot: AgentSnapshot): void {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO resource_samples_raw (target, cpu_pct, used_bytes, total_bytes) VALUES (?, ?, ?, ?)",
  );
  const insertAll = db.transaction((rows: SampleRow[]) => {
    for (const row of rows) insert.run(...row);
  });
  insertAll(toRows(snapshot));
}

/** Polls the agent every RESOURCE_POLL_INTERVAL_SECONDS and persists a raw sample set. */
export function startResourceCollector(): void {
  setInterval(() => {
    getAgentSnapshot()
      .then(insertSnapshot)
      .catch((err: unknown) => {
        logger.warn("resource-collector: poll failed:", err);
      });
  }, config.resources.pollIntervalSeconds * 1000);
}

const ROLLUP_HOURLY_SQL = `
INSERT INTO resource_samples_hourly (target, bucket, avg_cpu_pct, max_cpu_pct, avg_used_bytes, max_used_bytes, total_bytes)
SELECT
  target,
  strftime('%Y-%m-%dT%H', sampled_at),
  AVG(cpu_pct), MAX(cpu_pct),
  AVG(used_bytes), MAX(used_bytes),
  MAX(total_bytes)
FROM resource_samples_raw
GROUP BY target, strftime('%Y-%m-%dT%H', sampled_at)
ON CONFLICT(target, bucket) DO UPDATE SET
  avg_cpu_pct = excluded.avg_cpu_pct,
  max_cpu_pct = excluded.max_cpu_pct,
  avg_used_bytes = excluded.avg_used_bytes,
  max_used_bytes = excluded.max_used_bytes,
  total_bytes = excluded.total_bytes
`;

const ROLLUP_DAILY_SQL = `
INSERT INTO resource_samples_daily (target, bucket, avg_cpu_pct, max_cpu_pct, avg_used_bytes, max_used_bytes, total_bytes)
SELECT
  target,
  substr(bucket, 1, 10),
  AVG(avg_cpu_pct), MAX(max_cpu_pct),
  AVG(avg_used_bytes), MAX(max_used_bytes),
  MAX(total_bytes)
FROM resource_samples_hourly
GROUP BY target, substr(bucket, 1, 10)
ON CONFLICT(target, bucket) DO UPDATE SET
  avg_cpu_pct = excluded.avg_cpu_pct,
  max_cpu_pct = excluded.max_cpu_pct,
  avg_used_bytes = excluded.avg_used_bytes,
  max_used_bytes = excluded.max_used_bytes,
  total_bytes = excluded.total_bytes
`;

const RAW_RETENTION_HOURS = 48;
const HOURLY_RETENTION_DAYS = 90;

/**
 * Hourly: rolls raw samples up into resource_samples_hourly (idempotent —
 * re-aggregates the whole retained raw window each run, cheap at this data
 * volume), rolls resource_samples_hourly up into resource_samples_daily the
 * same way, then prunes rows past each table's retention window.
 */
export function startResourceRollupSweep(): void {
  setInterval(
    () => {
      const db = getDb();
      db.prepare(ROLLUP_HOURLY_SQL).run();
      db.prepare(ROLLUP_DAILY_SQL).run();

      const prunedRaw = db
        .prepare(`DELETE FROM resource_samples_raw WHERE sampled_at < datetime('now', '-${RAW_RETENTION_HOURS} hours')`)
        .run();
      const prunedHourly = db
        .prepare(
          `DELETE FROM resource_samples_hourly WHERE bucket < strftime('%Y-%m-%dT%H', datetime('now', '-${HOURLY_RETENTION_DAYS} days'))`,
        )
        .run();

      if (prunedRaw.changes > 0 || prunedHourly.changes > 0) {
        logger.info(
          `resource rollup sweep: pruned ${prunedRaw.changes} raw, ${prunedHourly.changes} hourly row(s)`,
        );
      }
    },
    60 * 60 * 1000,
  );
}

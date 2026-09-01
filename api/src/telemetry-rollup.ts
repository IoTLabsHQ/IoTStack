/**
 * Rolls device telemetry values and MQTT traffic volume up into hourly/daily
 * aggregates for the Control Panel's history-chart widget and the device
 * page's data-usage chart — same hourly-sweep shape as
 * resource-collector.ts's rollup, but reading from the `messages` table
 * (already populated by collector.ts) instead of polling an external agent.
 *
 * Traffic is a pure-SQL rollup (`messages.payload_bytes` is already a
 * structured column). Telemetry values live inside opaque JSON payload
 * text, so that rollup parses+flattens each message in JS. Both are bounded
 * to a short lookback window (not the whole retained history) so the sweep
 * stays cheap regardless of how much the `messages` table has grown — this
 * differs from resource-collector.ts's "reaggregate everything" approach,
 * which only works there because its raw table's own retention is short
 * (48h); `messages` retains RAW_RETENTION_DAYS (14 days by default).
 */
import { getDb } from "./db";
import { logger } from "./logger";
import { flattenNumericLeaves } from "./json-flatten";

const ROLLUP_LOOKBACK_HOURS = 2;
const HOURLY_RETENTION_DAYS = 90;

const TRAFFIC_HOURLY_ROLLUP_SQL = `
INSERT INTO device_traffic_hourly (device_id, bucket, message_count, total_bytes)
SELECT device_id, strftime('%Y-%m-%dT%H', received_at), COUNT(*), SUM(payload_bytes)
FROM messages
WHERE received_at >= datetime('now', '-${ROLLUP_LOOKBACK_HOURS} hours')
GROUP BY device_id, strftime('%Y-%m-%dT%H', received_at)
ON CONFLICT(device_id, bucket) DO UPDATE SET
  message_count = excluded.message_count,
  total_bytes = excluded.total_bytes
`;

const TRAFFIC_DAILY_ROLLUP_SQL = `
INSERT INTO device_traffic_daily (device_id, bucket, message_count, total_bytes)
SELECT device_id, substr(bucket, 1, 10), SUM(message_count), SUM(total_bytes)
FROM device_traffic_hourly
GROUP BY device_id, substr(bucket, 1, 10)
ON CONFLICT(device_id, bucket) DO UPDATE SET
  message_count = excluded.message_count,
  total_bytes = excluded.total_bytes
`;

const TELEMETRY_DAILY_ROLLUP_SQL = `
INSERT INTO telemetry_samples_daily (device_id, field, bucket, avg_value, min_value, max_value)
SELECT device_id, field, substr(bucket, 1, 10), AVG(avg_value), MIN(min_value), MAX(max_value)
FROM telemetry_samples_hourly
GROUP BY device_id, field, substr(bucket, 1, 10)
ON CONFLICT(device_id, field, bucket) DO UPDATE SET
  avg_value = excluded.avg_value,
  min_value = excluded.min_value,
  max_value = excluded.max_value
`;

interface TelemetryRow {
  device_id: number;
  payload: string;
  bucket: string;
}

interface BucketAgg {
  sum: number;
  min: number;
  max: number;
  count: number;
}

function rollupTelemetryHourly(): void {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT device_id, payload, strftime('%Y-%m-%dT%H', received_at) as bucket
       FROM messages
       WHERE message_type = 'telemetry' AND received_at >= datetime('now', '-${ROLLUP_LOOKBACK_HOURS} hours')`,
    )
    .all() as TelemetryRow[];

  const buckets = new Map<string, BucketAgg>();
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.payload);
    } catch {
      continue;
    }
    for (const leaf of flattenNumericLeaves(parsed)) {
      const key = `${row.device_id}|${leaf.path}|${row.bucket}`;
      const agg = buckets.get(key) ?? { sum: 0, min: Infinity, max: -Infinity, count: 0 };
      agg.sum += leaf.value;
      agg.min = Math.min(agg.min, leaf.value);
      agg.max = Math.max(agg.max, leaf.value);
      agg.count += 1;
      buckets.set(key, agg);
    }
  }

  const upsert = db.prepare(
    `INSERT INTO telemetry_samples_hourly (device_id, field, bucket, avg_value, min_value, max_value)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id, field, bucket) DO UPDATE SET
       avg_value = excluded.avg_value,
       min_value = excluded.min_value,
       max_value = excluded.max_value`,
  );
  const upsertAll = db.transaction((entries: [string, BucketAgg][]) => {
    for (const [key, agg] of entries) {
      const [deviceId, field, bucket] = key.split("|");
      upsert.run(Number(deviceId), field, bucket, agg.sum / agg.count, agg.min, agg.max);
    }
  });
  upsertAll([...buckets.entries()]);
}

/** Runs the full rollup pass once — exported directly (not only reachable
 * via the setInterval wrapper below) so tests can force a deterministic
 * rollup instead of waiting for the hourly sweep. */
export function runTelemetryRollupOnce(): void {
  const db = getDb();

  db.prepare(TRAFFIC_HOURLY_ROLLUP_SQL).run();
  rollupTelemetryHourly();
  db.prepare(TRAFFIC_DAILY_ROLLUP_SQL).run();
  db.prepare(TELEMETRY_DAILY_ROLLUP_SQL).run();

  const prunedTrafficHourly = db
    .prepare(
      `DELETE FROM device_traffic_hourly WHERE bucket < strftime('%Y-%m-%dT%H', datetime('now', '-${HOURLY_RETENTION_DAYS} days'))`,
    )
    .run();
  const prunedTelemetryHourly = db
    .prepare(
      `DELETE FROM telemetry_samples_hourly WHERE bucket < strftime('%Y-%m-%dT%H', datetime('now', '-${HOURLY_RETENTION_DAYS} days'))`,
    )
    .run();

  if (prunedTrafficHourly.changes > 0 || prunedTelemetryHourly.changes > 0) {
    logger.info(
      `telemetry rollup sweep: pruned ${prunedTrafficHourly.changes} traffic-hourly, ${prunedTelemetryHourly.changes} telemetry-hourly row(s)`,
    );
  }
}

export function startTelemetryRollupSweep(): void {
  setInterval(runTelemetryRollupOnce, 60 * 60 * 1000);
}

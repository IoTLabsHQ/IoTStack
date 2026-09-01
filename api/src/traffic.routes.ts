/**
 * Historical MQTT data-usage charting for the device page's Data usage
 * section — same granularity/response shape as telemetry.routes.ts, but
 * device-scoped only (no field) since traffic is message count/bytes, not
 * a published field.
 */
import { Router } from "express";
import { getDb } from "./db";
import { requireAuth } from "./middleware";

export const trafficRouter = Router();
trafficRouter.use(requireAuth);

const GRANULARITY_TABLES: Record<string, { table: "hourly" | "daily"; sinceSql: string }> = {
  week: { table: "hourly", sinceSql: "strftime('%Y-%m-%dT%H', datetime('now', '-7 days'))" },
  month: { table: "hourly", sinceSql: "strftime('%Y-%m-%dT%H', datetime('now', '-30 days'))" },
  year: { table: "daily", sinceSql: "strftime('%Y-%m-%d', datetime('now', '-365 days'))" },
};

trafficRouter.get("/:id/traffic/history", (req, res) => {
  const deviceId = Number(req.params.id);
  const granularity = typeof req.query.granularity === "string" ? req.query.granularity : "day";

  const device = getDb().prepare("SELECT id FROM devices WHERE id = ?").get(deviceId);
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  if (granularity === "day") {
    const points = getDb()
      .prepare(
        `SELECT strftime('%Y-%m-%dT%H', received_at) as bucket, COUNT(*) as message_count, SUM(payload_bytes) as total_bytes
         FROM messages
         WHERE device_id = ? AND received_at >= datetime('now', '-2 days')
         GROUP BY bucket
         ORDER BY bucket ASC`,
      )
      .all(deviceId);
    res.json({ granularity, points });
    return;
  }

  const spec = GRANULARITY_TABLES[granularity];
  if (!spec) {
    res.status(400).json({ error: "granularity must be one of: day, week, month, year" });
    return;
  }

  const table = spec.table === "hourly" ? "device_traffic_hourly" : "device_traffic_daily";
  const points = getDb()
    .prepare(
      `SELECT bucket, message_count, total_bytes FROM ${table}
       WHERE device_id = ? AND bucket >= ${spec.sinceSql}
       ORDER BY bucket ASC`,
    )
    .all(deviceId);

  res.json({ granularity, points });
});

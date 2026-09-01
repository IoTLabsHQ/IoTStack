/**
 * Historical telemetry-field charting for the Control Panel's history-chart
 * widget — same granularity/response shape as resources.routes.ts's
 * GET /resources/history, but device+field scoped and reading `messages`
 * directly for "day" instead of a dedicated raw table (see
 * telemetry-rollup.ts's file comment for why).
 */
import { Router } from "express";
import { getDb } from "./db";
import { requireAuth } from "./middleware";
import { getByPath } from "./json-flatten";

export const telemetryRouter = Router();
telemetryRouter.use(requireAuth);

const GRANULARITY_TABLES: Record<string, { table: "hourly" | "daily"; sinceSql: string }> = {
  week: { table: "hourly", sinceSql: "strftime('%Y-%m-%dT%H', datetime('now', '-7 days'))" },
  month: { table: "hourly", sinceSql: "strftime('%Y-%m-%dT%H', datetime('now', '-30 days'))" },
  year: { table: "daily", sinceSql: "strftime('%Y-%m-%d', datetime('now', '-365 days'))" },
};

interface DayRow {
  payload: string;
  received_at: string;
}

telemetryRouter.get("/:id/telemetry/history", (req, res) => {
  const deviceId = Number(req.params.id);
  const field = typeof req.query.field === "string" ? req.query.field : "";
  const granularity = typeof req.query.granularity === "string" ? req.query.granularity : "day";

  if (!field.trim()) {
    res.status(400).json({ error: "field is required" });
    return;
  }

  const device = getDb().prepare("SELECT id FROM devices WHERE id = ?").get(deviceId);
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  if (granularity === "day") {
    const rows = getDb()
      .prepare(
        `SELECT payload, received_at FROM messages
         WHERE device_id = ? AND message_type = 'telemetry' AND received_at >= datetime('now', '-2 days')
         ORDER BY received_at ASC`,
      )
      .all(deviceId) as DayRow[];

    const points = rows
      .map((row) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(row.payload);
        } catch {
          return null;
        }
        const value = getByPath(parsed, field);
        return typeof value === "number" ? { bucket: row.received_at, value } : null;
      })
      .filter((p): p is { bucket: string; value: number } => p !== null);

    res.json({ granularity, points });
    return;
  }

  const spec = GRANULARITY_TABLES[granularity];
  if (!spec) {
    res.status(400).json({ error: "granularity must be one of: day, week, month, year" });
    return;
  }

  const table = spec.table === "hourly" ? "telemetry_samples_hourly" : "telemetry_samples_daily";
  const points = getDb()
    .prepare(
      `SELECT bucket, avg_value, min_value, max_value FROM ${table}
       WHERE device_id = ? AND field = ? AND bucket >= ${spec.sinceSql}
       ORDER BY bucket ASC`,
    )
    .all(deviceId, field);

  res.json({ granularity, points });
});

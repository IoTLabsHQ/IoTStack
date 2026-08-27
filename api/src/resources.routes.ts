/**
 * VPS resource monitoring — live agent snapshot, historical charts at four
 * granularities, and the dashboard-editable warning/critical thresholds.
 */
import { Router } from "express";
import { getDb, getResourceThresholdsRow } from "./db";
import { requireAuth } from "./middleware";
import { requireInt, respondIfValidationError } from "./validation";
import { getAgentSnapshot } from "./agent-client";
import { logger } from "./logger";

export const resourcesRouter = Router();
resourcesRouter.use(requireAuth);

resourcesRouter.get("/live", async (_req, res) => {
  try {
    const snapshot = await getAgentSnapshot();
    res.json(snapshot);
  } catch (err) {
    logger.warn("resources/live: agent unreachable:", err);
    res.status(503).json({ error: "Resource agent unreachable" });
  }
});

const GRANULARITY_TABLES: Record<string, { table: string; sinceSql: string }> = {
  day: { table: "resource_samples_raw", sinceSql: "datetime('now', '-2 days')" },
  week: { table: "resource_samples_hourly", sinceSql: "strftime('%Y-%m-%dT%H', datetime('now', '-7 days'))" },
  month: { table: "resource_samples_hourly", sinceSql: "strftime('%Y-%m-%dT%H', datetime('now', '-30 days'))" },
  year: { table: "resource_samples_daily", sinceSql: "strftime('%Y-%m-%d', datetime('now', '-365 days'))" },
};

resourcesRouter.get("/history", (req, res) => {
  const granularity = typeof req.query.granularity === "string" ? req.query.granularity : "day";
  const spec = GRANULARITY_TABLES[granularity];
  if (!spec) {
    res.status(400).json({ error: "granularity must be one of: day, week, month, year" });
    return;
  }

  const db = getDb();
  if (spec.table === "resource_samples_raw") {
    const rows = db
      .prepare(
        `SELECT target, sampled_at as bucket, cpu_pct, used_bytes, total_bytes
         FROM resource_samples_raw WHERE sampled_at >= ${spec.sinceSql}
         ORDER BY sampled_at ASC`,
      )
      .all();
    res.json({ granularity, points: rows });
    return;
  }

  const rows = db
    .prepare(
      `SELECT target, bucket, avg_cpu_pct, max_cpu_pct, avg_used_bytes, max_used_bytes, total_bytes
       FROM ${spec.table} WHERE bucket >= ${spec.sinceSql}
       ORDER BY bucket ASC`,
    )
    .all();
  res.json({ granularity, points: rows });
});

resourcesRouter.get("/thresholds", (_req, res) => {
  res.json(getResourceThresholdsRow());
});

resourcesRouter.put("/thresholds", (req, res) => {
  try {
    const body = req.body ?? {};
    const hostRamWarn = requireInt(body.hostRamWarnPct, "hostRamWarnPct", { min: 1, max: 100 });
    const hostRamCritical = requireInt(body.hostRamCriticalPct, "hostRamCriticalPct", { min: 1, max: 100 });
    const hostCpuWarn = requireInt(body.hostCpuWarnPct, "hostCpuWarnPct", { min: 1, max: 100 });
    const hostCpuCritical = requireInt(body.hostCpuCriticalPct, "hostCpuCriticalPct", { min: 1, max: 100 });
    const hostDiskWarn = requireInt(body.hostDiskWarnPct, "hostDiskWarnPct", { min: 1, max: 100 });
    const hostDiskCritical = requireInt(body.hostDiskCriticalPct, "hostDiskCriticalPct", { min: 1, max: 100 });
    const containerMemWarn = requireInt(body.containerMemWarnPct, "containerMemWarnPct", { min: 1, max: 100 });
    const containerMemCritical = requireInt(body.containerMemCriticalPct, "containerMemCriticalPct", {
      min: 1,
      max: 100,
    });

    getDb()
      .prepare(
        `UPDATE resource_thresholds
         SET host_ram_warn_pct = ?, host_ram_critical_pct = ?,
             host_cpu_warn_pct = ?, host_cpu_critical_pct = ?,
             host_disk_warn_pct = ?, host_disk_critical_pct = ?,
             container_mem_warn_pct = ?, container_mem_critical_pct = ?,
             updated_at = datetime('now')
         WHERE id = 1`,
      )
      .run(
        hostRamWarn,
        hostRamCritical,
        hostCpuWarn,
        hostCpuCritical,
        hostDiskWarn,
        hostDiskCritical,
        containerMemWarn,
        containerMemCritical,
      );

    res.json(getResourceThresholdsRow());
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("thresholds update error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

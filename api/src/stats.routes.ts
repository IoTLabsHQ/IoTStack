import { Router } from "express";
import { getDb } from "./db";
import { requireAuth } from "./middleware";
import { getCollectorStatus } from "./collector";

export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get("/overview", (_req, res) => {
  const db = getDb();

  const deviceCount = (
    db.prepare("SELECT COUNT(*) as count FROM devices").get() as { count: number }
  ).count;

  const messagesToday = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM messages WHERE received_at >= datetime('now', 'start of day')",
      )
      .get() as { count: number }
  ).count;

  const totalStorageBytes = (
    db.prepare("SELECT COALESCE(SUM(bytes), 0) as total FROM storage_usage").get() as {
      total: number;
    }
  ).total;

  res.json({
    deviceCount,
    messagesToday,
    totalStorageBytes,
    collectorStatus: getCollectorStatus(),
  });
});

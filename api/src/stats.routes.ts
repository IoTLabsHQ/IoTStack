import { Router } from "express";
import { getDb } from "./db";
import { requireAuth } from "./middleware";
import { getCollectorStatus } from "./collector";
import { getMqttStats } from "./mqtt-stats";

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

statsRouter.get("/mqtt", (_req, res) => {
  res.json(getMqttStats());
});

interface RecentMessageRow {
  id: number;
  device_id: number;
  device_name: string;
  topic: string;
  message_type: string;
  payload: string;
  payload_bytes: number;
  received_at: string;
}

statsRouter.get("/recent-messages", (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 100);
  const messages = getDb()
    .prepare(
      `SELECT m.id, m.device_id, d.display_name as device_name, m.topic, m.message_type,
              m.payload, m.payload_bytes, m.received_at
       FROM messages m
       JOIN devices d ON d.id = m.device_id
       ORDER BY m.received_at DESC, m.id DESC
       LIMIT ?`,
    )
    .all(limit) as RecentMessageRow[];
  res.json({ messages });
});

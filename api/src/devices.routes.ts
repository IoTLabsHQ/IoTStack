/**
 * Device (credential) management — the dashboard's own CRUD, not an
 * external caller's API. Every route requires a dashboard session.
 *
 * Every create/regenerate/delete also pushes the credential/ACL change into
 * Mosquitto's Dynamic Security plugin (dynsec-client.ts) — live, no
 * reload. If that push fails, the SQLite change is rolled back so the two
 * stores never drift out of sync.
 */
import { randomBytes } from "crypto";
import { Router } from "express";
import { getDb } from "./db";
import { requireAuth } from "./middleware";
import { requireString, respondIfValidationError } from "./validation";
import {
  createDeviceCredential,
  regenerateDeviceCredential,
  deleteDeviceCredential,
  publishToDevice,
} from "./dynsec-client";
import { getStorageUsedBytes } from "./storage";
import { logger } from "./logger";
import {
  parseDashboardConfig,
  validateAndNormalizeControls,
  denormalizeControls,
} from "./dashboard-config";

const VALID_COMMANDS = new Set(["set", "status.request", "config.update", "restart", "ping"]);
const COMMAND_TIMEOUT_MS: Record<string, number> = {
  set: 5000,
  "status.request": 3000,
  "config.update": 10000,
  restart: 15000,
  ping: 5000,
};

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

interface DeviceRow {
  id: number;
  client_id: string;
  mqtt_username: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  dashboard: string | null;
}

function generateClientId(): string {
  return `dev_${randomBytes(6).toString("hex")}`;
}

function generatePassword(): string {
  return randomBytes(16).toString("hex");
}

devicesRouter.get("/", (_req, res) => {
  const devices = getDb()
    .prepare(
      `SELECT id, client_id, mqtt_username, display_name, created_at, updated_at, last_seen_at
       FROM devices ORDER BY created_at DESC`,
    )
    .all();
  res.json({ devices });
});

devicesRouter.get("/:id", (req, res) => {
  const device = getDb()
    .prepare(
      `SELECT id, client_id, mqtt_username, display_name, created_at, updated_at, last_seen_at, dashboard
       FROM devices WHERE id = ?`,
    )
    .get(req.params.id) as DeviceRow | undefined;

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }
  const { dashboard, ...rest } = device;
  res.json({
    device: { ...rest, dashboard: denormalizeControls(parseDashboardConfig(dashboard).controls) },
  });
});

devicesRouter.put("/:id/dashboard", (req, res) => {
  const device = getDb().prepare("SELECT id FROM devices WHERE id = ?").get(req.params.id) as
    | { id: number }
    | undefined;
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  try {
    const controls = validateAndNormalizeControls(req.body?.controls);
    getDb()
      .prepare(`UPDATE devices SET dashboard = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify({ version: 1, controls }), device.id);
    res.json({ dashboard: denormalizeControls(controls) });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("dashboard save error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

devicesRouter.post("/", async (req, res) => {
  let insertedId: number | bigint | null = null;
  try {
    const displayName = requireString(req.body?.displayName, "displayName");

    const clientId = generateClientId();
    const password = generatePassword();

    const result = getDb()
      .prepare(
        `INSERT INTO devices (client_id, mqtt_username, display_name)
         VALUES (?, ?, ?)`,
      )
      .run(clientId, clientId, displayName);
    insertedId = result.lastInsertRowid;

    getDb()
      .prepare(`INSERT INTO storage_usage (device_id, bytes) VALUES (?, 0)`)
      .run(insertedId);

    await createDeviceCredential(clientId, password);

    logger.info(`device "${clientId}" created`);
    res.status(201).json({
      device: { id: insertedId, clientId, mqttUsername: clientId, displayName },
      // Shown once — the dashboard must warn the user this won't be shown again.
      password,
    });
  } catch (err) {
    if (insertedId !== null) {
      getDb().prepare("DELETE FROM devices WHERE id = ?").run(insertedId);
    }
    if (respondIfValidationError(err, res)) return;
    logger.error("device create error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

devicesRouter.post("/:id/regenerate", async (req, res) => {
  const device = getDb()
    .prepare("SELECT id, client_id FROM devices WHERE id = ?")
    .get(req.params.id) as { id: number; client_id: string } | undefined;

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  try {
    const password = generatePassword();
    await regenerateDeviceCredential(device.client_id, password);

    getDb()
      .prepare("UPDATE devices SET updated_at = datetime('now') WHERE id = ?")
      .run(device.id);

    logger.info(`device "${device.client_id}" credential regenerated`);
    res.json({ clientId: device.client_id, password });
  } catch (err) {
    logger.error("device regenerate error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

devicesRouter.delete("/:id", async (req, res) => {
  const device = getDb()
    .prepare("SELECT id, client_id FROM devices WHERE id = ?")
    .get(req.params.id) as { id: number; client_id: string } | undefined;

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  try {
    await deleteDeviceCredential(device.client_id);
    getDb().prepare("DELETE FROM devices WHERE id = ?").run(device.id);
    res.json({ ok: true });
  } catch (err) {
    logger.error("device delete error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

devicesRouter.get("/:id/messages", (req, res) => {
  const device = getDb().prepare("SELECT id FROM devices WHERE id = ?").get(req.params.id) as
    | { id: number }
    | undefined;
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const messages = getDb()
    .prepare(
      `SELECT id, topic, message_type, payload, payload_bytes, received_at
       FROM messages WHERE device_id = ? ORDER BY received_at DESC, id DESC LIMIT ?`,
    )
    .all(device.id, limit);
  res.json({ messages });
});

devicesRouter.get("/:id/storage", (req, res) => {
  const device = getDb().prepare("SELECT id FROM devices WHERE id = ?").get(req.params.id) as
    | { id: number }
    | undefined;
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }
  res.json({ bytes: getStorageUsedBytes(device.id) });
});

devicesRouter.post("/:id/commands", (req, res) => {
  try {
    const target = requireString(req.body?.target, "target");
    const command = requireString(req.body?.command, "command");

    if (!VALID_COMMANDS.has(command)) {
      res.status(422).json({ error: `command must be one of: ${[...VALID_COMMANDS].join(", ")}` });
      return;
    }
    if (command === "set" && req.body?.value === undefined) {
      res.status(422).json({ error: "value is required for command 'set'" });
      return;
    }

    const device = getDb()
      .prepare("SELECT client_id FROM devices WHERE id = ?")
      .get(req.params.id) as { client_id: string } | undefined;
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const payload = JSON.stringify({ target, command, value: req.body?.value });
    publishToDevice(device.client_id, payload);

    res.json({ ok: true, commandTimeoutMs: COMMAND_TIMEOUT_MS[command] });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("command publish error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

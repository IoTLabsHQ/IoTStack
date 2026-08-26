/**
 * MQTT collector — subscribes to devices/# as the controller account (whose
 * admin role already has broad subscribe rights) and persists messages to
 * SQLite, enforcing the same per-device rate limit and storage cap the
 * dashboard's limits configure.
 *
 * Pipeline per message: validate message type → look up device by
 * client_id → rate limit → storage cap → persist with a TTL deadline.
 */
import mqtt, { MqttClient } from "mqtt";
import { config } from "./config";
import { logger } from "./logger";
import { getDb } from "./db";
import { checkRateLimit } from "./rate-limiter";
import { incrementStorageIfUnderCap } from "./storage";

const VALID_MESSAGE_TYPES = new Set(["ping", "status", "telemetry", "cmd"]);

export type CollectorStatus = "starting" | "connected" | "disconnected";
let status: CollectorStatus = "starting";
export function getCollectorStatus(): CollectorStatus {
  return status;
}

interface DeviceRow {
  id: number;
}

function buildMessageType(topic: string): string {
  const parts = topic.split("/");
  return parts.slice(2).join("/") || "unknown";
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  const parts = topic.split("/");
  const clientId = parts[1];
  if (!clientId) return;

  const messageType = buildMessageType(topic);
  if (!VALID_MESSAGE_TYPES.has(messageType)) {
    logger.warn(`[invalid-type] dropping "${messageType}" from "${clientId}"`);
    return;
  }

  const device = getDb()
    .prepare("SELECT id FROM devices WHERE client_id = ?")
    .get(clientId) as DeviceRow | undefined;
  if (!device) {
    logger.warn(`[unknown-device] dropping message from unknown clientId "${clientId}"`);
    return;
  }

  const allowed = checkRateLimit(clientId, config.limits.rateLimitMsgPerMin);
  if (!allowed) {
    logger.warn(`[rate-limit] "${clientId}" exceeded ${config.limits.rateLimitMsgPerMin} msg/min`);
    return;
  }

  const payloadStr = payload.toString("utf-8");
  const payloadBytes = Buffer.byteLength(payloadStr, "utf-8");
  const storageLimitBytes = config.limits.storageCapMB * 1024 * 1024;

  const withinCap = incrementStorageIfUnderCap(device.id, payloadBytes, storageLimitBytes);
  if (!withinCap) {
    logger.warn(`[storage-cap] "${clientId}" reached ${config.limits.storageCapMB} MB — dropping`);
    return;
  }

  const expiresAt = new Date(
    Date.now() + config.limits.rawRetentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  getDb()
    .prepare(
      `INSERT INTO messages (device_id, topic, message_type, payload, payload_bytes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(device.id, topic, messageType, payloadStr, payloadBytes, expiresAt);

  getDb()
    .prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?")
    .run(device.id);

  logger.info(`[${messageType}] ${topic}`);
}

export function startCollector(): void {
  const url = `mqtt://${config.mosquitto.host}:${config.mosquitto.port}`;
  const client: MqttClient = mqtt.connect(url, {
    username: config.dynsec.controllerUsername,
    password: config.dynsec.controllerPassword,
    clientId: "iotstack-collector",
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    status = "connected";
    client.subscribe("devices/#", { qos: 1 }, (err) => {
      if (err) logger.error("collector subscribe error:", err);
      else logger.info('collector subscribed to "devices/#"');
    });
  });

  client.on("close", () => {
    status = "disconnected";
  });

  client.on("error", (err) => {
    logger.error("collector connection error:", err);
  });

  client.on("message", (topic, payload) => {
    handleMessage(topic, payload).catch((err) => {
      logger.error("error processing message:", err);
    });
  });
}

/** Periodic TTL sweep — SQLite has no native TTL index. */
export function startRetentionSweep(): void {
  setInterval(
    () => {
      const result = getDb()
        .prepare("DELETE FROM messages WHERE expires_at < datetime('now')")
        .run();
      if (result.changes > 0) {
        logger.info(`retention sweep: removed ${result.changes} expired message(s)`);
      }
    },
    60 * 60 * 1000,
  );
}

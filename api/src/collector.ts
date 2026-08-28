/**
 * MQTT collector — subscribes to the device→server topics listed in
 * COLLECTOR_TOPICS (never devices/#, and never cmd — that's server→device)
 * and persists messages to SQLite, enforcing the same per-device rate limit
 * and storage cap the dashboard's limits configure.
 *
 * Pipeline per message: validate topic shape → validate message type →
 * look up device by client_id → validate payload size/shape → rate limit →
 * storage cap → persist with a TTL deadline → update last_seen_at.
 */
import mqtt, { MqttClient } from "mqtt";
import { config } from "./config";
import { logger } from "./logger";
import { getDb } from "./db";
import { checkRateLimit } from "./rate-limiter";
import { incrementStorageIfUnderCap } from "./storage";
import { COLLECTOR_TOPICS, DEVICE_MESSAGE_TYPES } from "./mqtt-topics";

const VALID_MESSAGE_TYPES = new Set<string>(DEVICE_MESSAGE_TYPES);

export type CollectorStatus = "starting" | "connected" | "disconnected";
let status: CollectorStatus = "starting";
export function getCollectorStatus(): CollectorStatus {
  return status;
}

interface DeviceRow {
  id: number;
}

/** Topic must be exactly `devices/{clientId}/{messageType}` — 3 segments,
 * root "devices". Anything else (deeper, shallower, wrong root) is rejected
 * outright, not just left to fall through the message-type check below. */
function parseDeviceTopic(topic: string): { clientId: string; messageType: string } | null {
  const parts = topic.split("/");
  if (parts.length !== 3 || parts[0] !== "devices" || !parts[1] || !parts[2]) return null;
  return { clientId: parts[1], messageType: parts[2] };
}

/** Nesting depth of a JSON value — a flat object is depth 1, scalars are 0. */
function jsonDepth(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map(jsonDepth));
}

/** Total key count across a JSON value, recursively — catches both a wide
 * flat object and a deep chain of small ones. */
function jsonKeyCount(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((sum: number, v) => sum + jsonKeyCount(v), 0);
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length + entries.reduce((sum, [, v]) => sum + jsonKeyCount(v), 0);
}

/**
 * PRD §46 — bound every message by size, key count, and nesting depth; a
 * device shouldn't be able to store a multi-MB or arbitrarily-nested
 * payload. Payloads that aren't a JSON object/array (or aren't valid JSON
 * at all) skip the key/depth checks — only the byte-size limit applies to
 * them, since there's nothing to count.
 */
function isWithinPayloadLimits(payloadStr: string, payloadBytes: number): boolean {
  if (payloadBytes > config.limits.maxPayloadBytes) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadStr);
  } catch {
    return true;
  }
  if (typeof parsed !== "object" || parsed === null) return true;

  return (
    jsonKeyCount(parsed) <= config.limits.maxPayloadKeys &&
    jsonDepth(parsed) <= config.limits.maxPayloadDepth
  );
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  const parsed = parseDeviceTopic(topic);
  if (!parsed) {
    logger.warn(`[invalid-topic] dropping message on "${topic}"`);
    return;
  }
  const { clientId, messageType } = parsed;

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

  const payloadStr = payload.toString("utf-8");
  const payloadBytes = Buffer.byteLength(payloadStr, "utf-8");

  if (!isWithinPayloadLimits(payloadStr, payloadBytes)) {
    logger.warn(`[payload-limits] dropping oversized/malformed payload from "${clientId}"`);
    return;
  }

  const allowed = checkRateLimit(clientId, config.limits.rateLimitMsgPerMin);
  if (!allowed) {
    logger.warn(`[rate-limit] "${clientId}" exceeded ${config.limits.rateLimitMsgPerMin} msg/min`);
    return;
  }

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
    username: config.mqttCollector.username,
    password: config.mqttCollector.password,
    clientId: "iotstack-collector",
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    status = "connected";
    client.subscribe(COLLECTOR_TOPICS, { qos: 1 }, (err) => {
      if (err) logger.error("collector subscribe error:", err);
      else logger.info(`collector subscribed to ${COLLECTOR_TOPICS.join(", ")}`);
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

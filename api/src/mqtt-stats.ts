/**
 * Reads Mosquitto's own $SYS broker-stats tree — real counters/loads the
 * broker has been computing and publishing every `sys_interval` (10s
 * default, `mosquitto/mosquitto.conf` never overrides it) the whole time,
 * just never subscribed to before. Authenticated as a dedicated, read-only
 * principal (role-mqtt-stats: subscribePattern $SYS/broker/#, nothing else
 * — see mosquitto/entrypoint.sh) kept separate from every other connection
 * for the same least-privilege reason as command-client.ts/collector.ts.
 *
 * Live-only, no persistence/history — the latest value of each $SYS
 * sub-topic is kept in an in-memory Map, same simplicity as
 * collector.ts's getCollectorStatus().
 */
import mqtt, { MqttClient } from "mqtt";
import { config } from "./config";
import { logger } from "./logger";

const latest = new Map<string, string>();
let client: MqttClient | null = null;

export function connectMqttStats(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `mqtt://${config.mosquitto.host}:${config.mosquitto.port}`;
    const c = mqtt.connect(url, {
      username: config.mqttStats.username,
      password: config.mqttStats.password,
      clientId: "iotstack-mqtt-stats",
      reconnectPeriod: 2000,
    });

    c.on("message", (topic, payload) => {
      latest.set(topic, payload.toString("utf-8"));
    });

    c.once("connect", () => {
      client = c;
      c.subscribe("$SYS/broker/#", { qos: 0 }, (err) => {
        if (err) logger.error("mqtt-stats subscribe error:", err);
        else logger.info("mqtt-stats subscribed to $SYS/broker/#");
      });
      resolve();
    });
    c.on("error", (err) => logger.error("mqtt-stats client connection error:", err));
    c.once("error", reject);
  });
}

function num(topic: string): number | null {
  const raw = latest.get(topic);
  if (raw === undefined) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export interface MqttStats {
  connected: boolean;
  messagesReceived: number | null;
  messagesSent: number | null;
  clientsConnected: number | null;
  clientsTotal: number | null;
  loadReceived1Min: number | null;
  loadSent1Min: number | null;
  uptimeSeconds: number | null;
}

export function getMqttStats(): MqttStats {
  return {
    connected: client !== null,
    messagesReceived: num("$SYS/broker/messages/received"),
    messagesSent: num("$SYS/broker/messages/sent"),
    clientsConnected: num("$SYS/broker/clients/connected"),
    clientsTotal: num("$SYS/broker/clients/total"),
    loadReceived1Min: num("$SYS/broker/load/messages/received/1min"),
    loadSent1Min: num("$SYS/broker/load/messages/sent/1min"),
    // "$SYS/broker/uptime" payload is "<n> seconds" — parseFloat stops at
    // the first non-numeric character, so the same `num()` helper works.
    uptimeSeconds: num("$SYS/broker/uptime"),
  };
}

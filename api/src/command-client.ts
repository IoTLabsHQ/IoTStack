/**
 * Publishes device commands over its own MQTT connection, authenticated as
 * a dedicated publish-only principal (role-api-command: publishClientSend
 * on devices/+/cmd, nothing else — see mosquitto/entrypoint.sh). Kept
 * separate from dynsec-client.ts's $CONTROL connection so a compromised
 * command-publish credential can't touch Dynamic Security, and separate
 * from the collector's connection so it can't read device data either.
 */
import mqtt, { MqttClient } from "mqtt";
import { config } from "./config";
import { logger } from "./logger";
import { MQTT_TOPIC } from "./mqtt-topics";

let client: MqttClient | null = null;

export function connectCommandClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `mqtt://${config.mosquitto.host}:${config.mosquitto.port}`;
    const c = mqtt.connect(url, {
      username: config.mqttApiCommand.username,
      password: config.mqttApiCommand.password,
      clientId: "iotstack-api-command",
      reconnectPeriod: 2000,
    });

    c.once("connect", () => {
      client = c;
      logger.info("command-publish client connected");
      resolve();
    });
    c.on("error", (err) => logger.error("command-publish client connection error:", err));
    c.once("error", reject);
  });
}

export function publishToDevice(clientId: string, payload: string): void {
  if (!client) {
    throw new Error("command-publish client not connected");
  }
  client.publish(MQTT_TOPIC.cmd(clientId), payload, { qos: 1, retain: false });
}

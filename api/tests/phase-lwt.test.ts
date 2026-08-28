/**
 * PRD "MQTT Topic & ACL Specification" §30 — optional LWT on `devices/{id}/event`.
 * LWT is a CONNECT-packet field, protocol-identical regardless of client
 * library — registering it via mqtt.js's real `will` option and forcing an
 * ungraceful disconnect (socket destroy, no DISCONNECT packet) exercises
 * the exact same broker/ACL behavior real firmware's PubSubClient will
 * option triggers. This also settles a question no existing repo doc
 * answered: does a device's own publishClientSend ACL grant cover a
 * broker-published LWT on its behalf?
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loginAdmin,
  createTestDevice,
  deleteTestDevice,
  connectMqttClient,
  closeClient,
  apiFetch,
  sleep,
  MQTT_URL,
  TestDevice,
} from "./setup";
import mqtt, { MqttClient } from "mqtt";

describe("LWT on devices/{id}/event (PRD §30)", () => {
  let token: string;
  let device: TestDevice;

  beforeAll(async () => {
    token = await loginAdmin();
    device = await createTestDevice(token, `phase-lwt-test-${Date.now()}`);
  });

  afterAll(async () => {
    await deleteTestDevice(token, device.id);
  });

  it("broker publishes the device's registered will on an ungraceful disconnect, and the collector stores it", async () => {
    const willPayload = JSON.stringify({ type: "network.disconnected" });

    // Observer connects first so it's already subscribed before the will fires.
    const observer = await connectMqttClient({
      username: process.env.DYNSEC_CONTROLLER_USERNAME!,
      password: process.env.DYNSEC_CONTROLLER_PASSWORD!,
      clientId: `test-lwt-observer-${Date.now()}`,
    });
    const eventTopic = `devices/${device.clientId}/event`;
    const received = new Promise<string>((resolve) => {
      observer.subscribe(eventTopic, { qos: 1 }, () => {
        observer.on("message", (topic, payload) => {
          if (topic === eventTopic) resolve(payload.toString("utf-8"));
        });
      });
    });

    // Device connects with a real MQTT will registered — same CONNECT-packet
    // field PubSubClient's 7-arg connect() overload sets.
    const deviceClient = mqtt.connect(MQTT_URL, {
      username: device.clientId,
      password: device.password,
      clientId: device.clientId,
      reconnectPeriod: 0,
      connectTimeout: 5000,
      will: { topic: eventTopic, payload: willPayload, qos: 1, retain: false },
    });
    await new Promise<void>((resolve, reject) => {
      deviceClient.once("connect", () => resolve());
      deviceClient.once("error", reject);
    });

    // Ungraceful disconnect: destroy the raw socket, no DISCONNECT packet —
    // this is what should trigger the broker to publish the will.
    // @ts-expect-error -- reaching into mqtt.js's internal stream to force a real ungraceful drop
    deviceClient.stream.destroy();

    const payload = await Promise.race([
      received,
      sleep(4000).then(() => {
        throw new Error("timed out waiting for LWT to arrive");
      }),
    ]);
    expect(payload).toBe(willPayload);

    await closeClient(observer);
    await sleep(400);

    const res = await apiFetch(`/devices/${device.id}/messages`, { token });
    const { messages } = (await res.json()) as {
      messages: Array<{ message_type: string; payload: string }>;
    };
    expect(
      messages.some((m) => m.message_type === "event" && m.payload === willPayload),
    ).toBe(true);
  });
});

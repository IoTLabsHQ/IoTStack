/**
 * PRD "MQTT Topic & ACL Specification" §8/§24/§26 — the `event` topic must
 * be accepted and stored by the collector, and `cmd` must never be (it's
 * server→device, not an inbound device message type).
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
  TestDevice,
} from "./setup";
import type { MqttClient } from "mqtt";

describe("event topic + cmd exclusion (PRD §8/§24/§26)", () => {
  let token: string;
  let device: TestDevice;
  let deviceClient: MqttClient;

  beforeAll(async () => {
    token = await loginAdmin();
    device = await createTestDevice(token, `phase1-test-${Date.now()}`);
    deviceClient = await connectMqttClient({ username: device.clientId, password: device.password });
  });

  afterAll(async () => {
    await closeClient(deviceClient);
    await deleteTestDevice(token, device.id);
  });

  it("stores a devices/{id}/event message as message_type=event and updates last_seen_at", async () => {
    const before = await apiFetch(`/devices/${device.id}`, { token });
    const beforeSeen = (await before.json()).device.last_seen_at as string | null;

    await new Promise<void>((resolve, reject) => {
      deviceClient.publish(
        `devices/${device.clientId}/event`,
        JSON.stringify({ type: "boot", ts: Date.now() }),
        { qos: 1 },
        (err) => (err ? reject(err) : resolve()),
      );
    });

    await sleep(500);

    const res = await apiFetch(`/devices/${device.id}/messages`, { token });
    const { messages } = (await res.json()) as { messages: Array<{ message_type: string }> };
    expect(messages.some((m) => m.message_type === "event")).toBe(true);

    const after = await apiFetch(`/devices/${device.id}`, { token });
    const afterSeen = (await after.json()).device.last_seen_at as string | null;
    expect(afterSeen).not.toBeNull();
    expect(afterSeen).not.toBe(beforeSeen);
  });

  it("never persists a devices/{id}/cmd message as a stored message (server→device only)", async () => {
    await new Promise<void>((resolve, reject) => {
      deviceClient.publish(
        `devices/${device.clientId}/cmd`,
        JSON.stringify({ command: "ping", request_id: "test-should-not-be-stored", data: {} }),
        { qos: 1 },
        (err) => (err ? reject(err) : resolve()),
      );
    });

    await sleep(500);

    const res = await apiFetch(`/devices/${device.id}/messages`, { token });
    const { messages } = (await res.json()) as { messages: Array<{ message_type: string }> };
    expect(messages.some((m) => m.message_type === "cmd")).toBe(false);
  });

  it("regression: telemetry/status/ping are still accepted and stored", async () => {
    for (const type of ["telemetry", "status", "ping"] as const) {
      await new Promise<void>((resolve, reject) => {
        deviceClient.publish(
          `devices/${device.clientId}/${type}`,
          JSON.stringify({ marker: type }),
          { qos: 1 },
          (err) => (err ? reject(err) : resolve()),
        );
      });
    }

    await sleep(500);

    const res = await apiFetch(`/devices/${device.id}/messages`, { token });
    const { messages } = (await res.json()) as { messages: Array<{ message_type: string }> };
    for (const type of ["telemetry", "status", "ping"]) {
      expect(messages.some((m) => m.message_type === type)).toBe(true);
    }
  });
});

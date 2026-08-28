/**
 * PRD "MQTT Topic & ACL Specification" §46 — messages must be bounded by
 * payload size, key count, and nesting depth. No limit exists today beyond
 * the cumulative per-device storage cap.
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

describe("payload validation (PRD §46)", () => {
  let token: string;
  let device: TestDevice;
  let deviceClient: MqttClient;

  beforeAll(async () => {
    token = await loginAdmin();
    device = await createTestDevice(token, `phase5-test-${Date.now()}`);
    deviceClient = await connectMqttClient({ username: device.clientId, password: device.password });
  });

  afterAll(async () => {
    await closeClient(deviceClient);
    await deleteTestDevice(token, device.id);
  });

  async function publish(marker: string, payload: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      deviceClient.publish(
        `devices/${device.clientId}/telemetry`,
        payload,
        { qos: 1 },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    await sleep(400);
  }

  async function hasMarker(marker: string): Promise<boolean> {
    const res = await apiFetch(`/devices/${device.id}/messages`, { token });
    const { messages } = (await res.json()) as { messages: Array<{ payload: string }> };
    return messages.some((m) => m.payload.includes(marker));
  }

  it("rejects an oversized payload", async () => {
    const marker = "oversize-marker";
    const big = "x".repeat(10_000);
    await publish(marker, JSON.stringify({ marker, big }));
    expect(await hasMarker(marker)).toBe(false);
  });

  it("rejects a payload with too many keys", async () => {
    const marker = "toomanykeys-marker";
    const obj: Record<string, unknown> = { marker };
    for (let i = 0; i < 100; i++) obj[`k${i}`] = i;
    await publish(marker, JSON.stringify(obj));
    expect(await hasMarker(marker)).toBe(false);
  });

  it("rejects a payload nested too deep", async () => {
    const marker = "toodeep-marker";
    const deep = { marker, a: { b: { c: { d: { e: "too deep" } } } } };
    await publish(marker, JSON.stringify(deep));
    expect(await hasMarker(marker)).toBe(false);
  });

  it("still accepts a normal small flat payload (regression)", async () => {
    const marker = "normal-marker";
    await publish(marker, JSON.stringify({ marker, temperature_c: 27.4 }));
    expect(await hasMarker(marker)).toBe(true);
  });
});

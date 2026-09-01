/**
 * v1.6.0 — GET /devices/:id/telemetry/history and /traffic/history, "day"
 * granularity (reads `messages` live, no rollup wait needed — week/month/
 * year depend on the hourly rollup sweep and are verified manually against
 * the real stack instead, per the same real-system testing philosophy this
 * suite already follows: no importing server internals into the test
 * process, since that would open a different, non-containerized SQLite
 * file than the one the real api actually writes to).
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

describe("telemetry/traffic history (day granularity)", () => {
  let token: string;
  let device: TestDevice;
  let deviceClient: MqttClient;

  beforeAll(async () => {
    token = await loginAdmin();
    device = await createTestDevice(token, `telemetry-history-test-${Date.now()}`);
    deviceClient = await connectMqttClient({ username: device.clientId, password: device.password });
  });

  afterAll(async () => {
    await closeClient(deviceClient);
    await deleteTestDevice(token, device.id);
  });

  async function publishTelemetry(payload: unknown): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      deviceClient.publish(
        `devices/${device.clientId}/telemetry`,
        JSON.stringify(payload),
        { qos: 1 },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    await sleep(400);
  }

  it("resolves a nested field via getByPath and returns it as a point", async () => {
    await publishTelemetry({ gps: { lat: 10.7, long: 106.6 } });
    const res = await apiFetch(`/devices/${device.id}/telemetry/history?field=gps.lat&granularity=day`, {
      token,
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { granularity: string; points: { value: number }[] };
    expect(body.granularity).toBe("day");
    expect(body.points.some((p) => p.value === 10.7)).toBe(true);
  });

  it("skips messages where the field isn't a number", async () => {
    await publishTelemetry({ status_text: "ok" });
    const res = await apiFetch(
      `/devices/${device.id}/telemetry/history?field=status_text&granularity=day`,
      { token },
    );
    const body = (await res.json()) as { points: unknown[] };
    expect(body.points).toEqual([]);
  });

  it("400s when field is missing", async () => {
    const res = await apiFetch(`/devices/${device.id}/telemetry/history?granularity=day`, { token });
    expect(res.status).toBe(400);
  });

  it("400s on an invalid granularity", async () => {
    const res = await apiFetch(
      `/devices/${device.id}/telemetry/history?field=x&granularity=fortnight`,
      { token },
    );
    expect(res.status).toBe(400);
  });

  it("404s for a device that doesn't exist", async () => {
    const res = await apiFetch(`/devices/999999999/telemetry/history?field=x&granularity=day`, { token });
    expect(res.status).toBe(404);
  });

  it("traffic history reports real message count and bytes for the day", async () => {
    await publishTelemetry({ marker: "traffic-count-check" });
    const res = await apiFetch(`/devices/${device.id}/traffic/history?granularity=day`, { token });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      granularity: string;
      points: { message_count: number; total_bytes: number }[];
    };
    expect(body.granularity).toBe("day");
    const totalMessages = body.points.reduce((sum, p) => sum + p.message_count, 0);
    const totalBytes = body.points.reduce((sum, p) => sum + p.total_bytes, 0);
    expect(totalMessages).toBeGreaterThan(0);
    expect(totalBytes).toBeGreaterThan(0);
  });
});

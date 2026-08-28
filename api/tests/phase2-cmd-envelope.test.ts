/**
 * PRD "MQTT Topic & ACL Specification" §13/§14 — cmd payload envelope must
 * be {command, request_id, data}, request_id generated server-side, unique
 * per call.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loginAdmin,
  createTestDevice,
  deleteTestDevice,
  connectMqttClient,
  closeClient,
  apiFetch,
  TestDevice,
} from "./setup";
import type { MqttClient } from "mqtt";

describe("cmd envelope reshape + request_id (PRD §13/§14)", () => {
  let token: string;
  let device: TestDevice;
  let deviceClient: MqttClient;

  beforeAll(async () => {
    token = await loginAdmin();
    device = await createTestDevice(token, `phase2-test-${Date.now()}`);
    deviceClient = await connectMqttClient({ username: device.clientId, password: device.password });
  });

  afterAll(async () => {
    await closeClient(deviceClient);
    await deleteTestDevice(token, device.id);
  });

  function waitForNextCmd(): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for cmd message")), 3000);
      deviceClient.once("message", (_topic, payload) => {
        clearTimeout(timer);
        resolve(JSON.parse(payload.toString("utf-8")));
      });
    });
  }

  it("publishes {command, request_id, data} with data={target, value} for a set command", async () => {
    await new Promise<void>((resolve, reject) => {
      deviceClient.subscribe(`devices/${device.clientId}/cmd`, { qos: 1 }, (err) =>
        err ? reject(err) : resolve(),
      );
    });

    const received = waitForNextCmd();
    const res = await apiFetch(`/devices/${device.id}/commands`, {
      method: "POST",
      token,
      body: { target: "led_1", command: "set", value: true },
    });
    expect(res.ok).toBe(true);

    const payload = await received;
    expect(payload.command).toBe("set");
    expect(typeof payload.request_id).toBe("string");
    expect((payload.request_id as string).length).toBeGreaterThan(0);
    expect(payload.data).toEqual({ target: "led_1", value: true });
    // no top-level target/value/command duplication outside the envelope
    expect(Object.keys(payload).sort()).toEqual(["command", "data", "request_id"]);
  });

  it("generates a unique request_id per call", async () => {
    await new Promise<void>((resolve, reject) => {
      deviceClient.subscribe(`devices/${device.clientId}/cmd`, { qos: 1 }, (err) =>
        err ? reject(err) : resolve(),
      );
    });

    const first = waitForNextCmd();
    await apiFetch(`/devices/${device.id}/commands`, {
      method: "POST",
      token,
      body: { target: "led_1", command: "set", value: true },
    });
    const firstPayload = await first;

    const second = waitForNextCmd();
    await apiFetch(`/devices/${device.id}/commands`, {
      method: "POST",
      token,
      body: { target: "led_1", command: "set", value: false },
    });
    const secondPayload = await second;

    expect(firstPayload.request_id).not.toBe(secondPayload.request_id);
  });
});

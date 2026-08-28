/**
 * PRD "MQTT Topic & ACL Specification" §16-18 — a device's publish and
 * subscribe rights must be split per-topic, not one shared
 * `devices/{clientId}/#` wildcard covering both directions. Today's code
 * grants that one wildcard for both publishClientSend and subscribePattern
 * (dynsec-client.ts createDeviceCredential) — these tests prove the two
 * concrete holes that leaves open: a device spoofing its own `cmd` topic,
 * and a device subscribing to its own telemetry/status/event/ping.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loginAdmin,
  createTestDevice,
  deleteTestDevice,
  connectMqttClient,
  closeClient,
  subscribeAndCheckGrant,
  publishThenObserve,
  TestDevice,
} from "./setup";
import type { MqttClient } from "mqtt";

describe("device ACL: publish/subscribe split (PRD §16-18)", () => {
  let token: string;
  let deviceA: TestDevice;
  let deviceB: TestDevice;
  let clientA: MqttClient;
  let clientB: MqttClient;
  let controllerObserver: MqttClient;

  beforeAll(async () => {
    token = await loginAdmin();
    deviceA = await createTestDevice(token, `phase3-a-${Date.now()}`);
    deviceB = await createTestDevice(token, `phase3-b-${Date.now()}`);
    clientA = await connectMqttClient({ username: deviceA.clientId, password: deviceA.password });
    clientB = await connectMqttClient({ username: deviceB.clientId, password: deviceB.password });
    controllerObserver = await connectMqttClient({
      username: process.env.DYNSEC_CONTROLLER_USERNAME!,
      password: process.env.DYNSEC_CONTROLLER_PASSWORD!,
      clientId: `test-observer-${Date.now()}`,
    });
  });

  afterAll(async () => {
    await closeClient(clientA);
    await closeClient(clientB);
    await closeClient(controllerObserver);
    await deleteTestDevice(token, deviceA.id);
    await deleteTestDevice(token, deviceB.id);
  });

  it("device CANNOT publish to its own cmd topic (self-spoofing server commands)", async () => {
    await new Promise<void>((resolve, reject) => {
      controllerObserver.subscribe(`devices/${deviceA.clientId}/cmd`, { qos: 1 }, (err) =>
        err ? reject(err) : resolve(),
      );
    });
    const received = await publishThenObserve(
      clientA,
      controllerObserver,
      `devices/${deviceA.clientId}/cmd`,
      JSON.stringify({ command: "set", request_id: "spoof-attempt", data: { target: "led_1", value: true } }),
    );
    expect(received).toBe(false);
  });

  it.each(["telemetry", "status", "event", "ping"])(
    "device CANNOT subscribe to its own %s topic",
    async (type) => {
      const result = await subscribeAndCheckGrant(clientA, `devices/${deviceA.clientId}/${type}`);
      expect(result.granted).toBe(false);
    },
  );

  it("device CAN still subscribe to and receive its own cmd topic", async () => {
    const result = await subscribeAndCheckGrant(clientA, `devices/${deviceA.clientId}/cmd`);
    expect(result.granted).toBe(true);
  });

  it("device still cannot touch another device's topics (regression)", async () => {
    const subResult = await subscribeAndCheckGrant(clientA, `devices/${deviceB.clientId}/telemetry`);
    expect(subResult.granted).toBe(false);
    void clientB;
  });

  it("device still cannot use devices/# wildcard (regression)", async () => {
    const result = await subscribeAndCheckGrant(clientA, "devices/#");
    expect(result.granted).toBe(false);
  });
});

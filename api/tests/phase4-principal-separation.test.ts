/**
 * PRD "MQTT Topic & ACL Specification" §15/§19-21 — collector, api-command,
 * and dynsec-admin must be separate MQTT principals, each with only the
 * rights its job needs. Today (pre-fix) collector.ts and dynsec-client.ts
 * both ride the single DYNSEC_CONTROLLER_USERNAME/PASSWORD account, and
 * that account's "admin" dynsec role additionally had a blanket
 * devices/# publish grant (mosquitto/entrypoint.sh) — so the first block
 * below proves that single shared account is over-privileged right now.
 * The second block exercises the dedicated collector/api-command accounts
 * this phase introduces; those accounts don't exist at all pre-fix, so
 * that block only passes once mosquitto/entrypoint.sh has bootstrapped
 * them (it errors on connect otherwise, which still fails the test — RED
 * either way, just via connection refusal instead of a granted-ACL check).
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

describe("principal separation (PRD §15/§19-21)", () => {
  let token: string;
  let device: TestDevice;
  let controllerObserver: MqttClient;

  beforeAll(async () => {
    token = await loginAdmin();
    device = await createTestDevice(token, `phase4-test-${Date.now()}`);
    // Superuser-equivalent observer to watch whether a publish actually
    // landed (admin has implicit subscribe+receive on "#" — a built-in
    // Mosquitto dynsec trait, confirmed against the real broker, not
    // granted by our own ACL code).
    controllerObserver = await connectMqttClient({
      username: process.env.DYNSEC_CONTROLLER_USERNAME!,
      password: process.env.DYNSEC_CONTROLLER_PASSWORD!,
      clientId: `test-observer-${Date.now()}`,
    });
  });

  afterAll(async () => {
    await closeClient(controllerObserver);
    await deleteTestDevice(token, device.id);
  });

  describe("the dynsec-admin/controller account is scoped to $CONTROL only", () => {
    it("cannot publish device telemetry", async () => {
      const asController = await connectMqttClient({
        username: process.env.DYNSEC_CONTROLLER_USERNAME!,
        password: process.env.DYNSEC_CONTROLLER_PASSWORD!,
        clientId: `test-ctrl-telemetry-${Date.now()}`,
      });
      await new Promise<void>((resolve, reject) => {
        controllerObserver.subscribe(`devices/${device.clientId}/telemetry`, { qos: 1 }, (err) =>
          err ? reject(err) : resolve(),
        );
      });
      const received = await publishThenObserve(
        asController,
        controllerObserver,
        `devices/${device.clientId}/telemetry`,
        JSON.stringify({ spoofed: true }),
      );
      await closeClient(asController);
      expect(received).toBe(false);
    });

    it("cannot publish device cmd", async () => {
      const asController = await connectMqttClient({
        username: process.env.DYNSEC_CONTROLLER_USERNAME!,
        password: process.env.DYNSEC_CONTROLLER_PASSWORD!,
        clientId: `test-ctrl-cmd-${Date.now()}`,
      });
      await new Promise<void>((resolve, reject) => {
        controllerObserver.subscribe(`devices/${device.clientId}/cmd`, { qos: 1 }, (err) =>
          err ? reject(err) : resolve(),
        );
      });
      const received = await publishThenObserve(
        asController,
        controllerObserver,
        `devices/${device.clientId}/cmd`,
        JSON.stringify({ command: "ping", request_id: "spoofed-by-admin", data: {} }),
      );
      await closeClient(asController);
      expect(received).toBe(false);
    });
  });

  describe("the dedicated collector account", () => {
    it("can subscribe and receive telemetry/status/event/ping for any device", async () => {
      const asCollector = await connectMqttClient({
        username: process.env.MQTT_COLLECTOR_USERNAME!,
        password: process.env.MQTT_COLLECTOR_PASSWORD!,
        clientId: `test-collector-${Date.now()}`,
      });
      for (const type of ["telemetry", "status", "event", "ping"]) {
        const result = await subscribeAndCheckGrant(asCollector, `devices/+/${type}`);
        expect(result.granted).toBe(true);
      }
      await closeClient(asCollector);
    });

    it("cannot publish anything", async () => {
      const asCollector = await connectMqttClient({
        username: process.env.MQTT_COLLECTOR_USERNAME!,
        password: process.env.MQTT_COLLECTOR_PASSWORD!,
        clientId: `test-collector-pub-${Date.now()}`,
      });
      await new Promise<void>((resolve, reject) => {
        controllerObserver.subscribe(`devices/${device.clientId}/telemetry`, { qos: 1 }, (err) =>
          err ? reject(err) : resolve(),
        );
      });
      const received = await publishThenObserve(
        asCollector,
        controllerObserver,
        `devices/${device.clientId}/telemetry`,
        JSON.stringify({ spoofed_by: "collector" }),
      );
      await closeClient(asCollector);
      expect(received).toBe(false);
    });

    it("cannot subscribe to cmd", async () => {
      const asCollector = await connectMqttClient({
        username: process.env.MQTT_COLLECTOR_USERNAME!,
        password: process.env.MQTT_COLLECTOR_PASSWORD!,
        clientId: `test-collector-cmd-${Date.now()}`,
      });
      const result = await subscribeAndCheckGrant(asCollector, `devices/${device.clientId}/cmd`);
      await closeClient(asCollector);
      expect(result.granted).toBe(false);
    });
  });

  describe("the dedicated api-command account", () => {
    it("can publish cmd for any device", async () => {
      const asApiCommand = await connectMqttClient({
        username: process.env.MQTT_API_COMMAND_USERNAME!,
        password: process.env.MQTT_API_COMMAND_PASSWORD!,
        clientId: `test-api-command-${Date.now()}`,
      });
      await new Promise<void>((resolve, reject) => {
        controllerObserver.subscribe(`devices/${device.clientId}/cmd`, { qos: 1 }, (err) =>
          err ? reject(err) : resolve(),
        );
      });
      const payload = JSON.stringify({ command: "ping", request_id: "from-api-command-test", data: {} });
      const received = await publishThenObserve(
        asApiCommand,
        controllerObserver,
        `devices/${device.clientId}/cmd`,
        payload,
      );
      await closeClient(asApiCommand);
      expect(received).toBe(true);
    });

    it("cannot publish telemetry", async () => {
      const asApiCommand = await connectMqttClient({
        username: process.env.MQTT_API_COMMAND_USERNAME!,
        password: process.env.MQTT_API_COMMAND_PASSWORD!,
        clientId: `test-api-command-telemetry-${Date.now()}`,
      });
      await new Promise<void>((resolve, reject) => {
        controllerObserver.subscribe(`devices/${device.clientId}/telemetry`, { qos: 1 }, (err) =>
          err ? reject(err) : resolve(),
        );
      });
      const received = await publishThenObserve(
        asApiCommand,
        controllerObserver,
        `devices/${device.clientId}/telemetry`,
        JSON.stringify({ spoofed_by: "api-command" }),
      );
      await closeClient(asApiCommand);
      expect(received).toBe(false);
    });
  });

  describe("collector still sees everything it needs (regression)", () => {
    it("collector.ts's own live connection still receives real device messages end-to-end", async () => {
      const deviceClient = await connectMqttClient({
        username: device.clientId,
        password: device.password,
      });
      await new Promise<void>((resolve, reject) => {
        deviceClient.publish(
          `devices/${device.clientId}/telemetry`,
          JSON.stringify({ regression_check: true }),
          { qos: 1 },
          (err) => (err ? reject(err) : resolve()),
        );
      });
      await closeClient(deviceClient);
      await new Promise((r) => setTimeout(r, 500));

      const { apiFetch } = await import("./setup");
      const res = await apiFetch(`/devices/${device.id}/messages`, { token });
      const { messages } = (await res.json()) as { messages: Array<{ message_type: string }> };
      expect(messages.some((m) => m.message_type === "telemetry")).toBe(true);
    });
  });
});

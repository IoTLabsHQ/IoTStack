import { test, expect } from "@playwright/test";
import mqtt from "mqtt";
import { AuthPage } from "./page-objects/AuthPage";
import { OtaPage } from "./page-objects/OtaPage";
import {
  loginAdminToken,
  createSeedDevice,
  deleteSeedDevice,
  setDeviceBoard,
  uploadSeedFirmware,
  deleteFirmwareVersionsForBoard,
  ensureDomainConfigured,
  publishRealStatus,
  publishRealEvent,
  MQTT_URL,
} from "./fixtures/env";

const BOARD_ID = "esp32-c3-supermini";
const VERSION = `1.0.0-ota-e2e-${Date.now()}`;

test.describe("OTA — create a job from the UI and watch a real device report progress", () => {
  test("job detail page reflects real MQTT progress/verification without a manual reload", async ({ page }) => {
    const token = await loginAdminToken();
    await ensureDomainConfigured(token);
    const deviceName = `ota-e2e-device-${Date.now()}`;
    const device = await createSeedDevice(token, deviceName);
    await setDeviceBoard(token, device.id, BOARD_ID);
    const firmware = await uploadSeedFirmware(token, { boardId: BOARD_ID, version: VERSION, content: "fake-firmware-e2e" });

    try {
      const auth = new AuthPage(page);
      await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

      // Subscribe as the real device BEFORE the job is created via the UI,
      // so it actually receives the ota.start publish (QoS1, no retain).
      const deviceClient = mqtt.connect(MQTT_URL, {
        username: device.clientId,
        password: device.password,
        clientId: device.clientId,
        reconnectPeriod: 0,
      });
      await new Promise<void>((resolve, reject) => {
        deviceClient.once("connect", () => resolve());
        deviceClient.once("error", reject);
      });
      await new Promise<void>((resolve, reject) => {
        deviceClient.subscribe(`devices/${device.clientId}/cmd`, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
      });
      const otaStartPromise = new Promise<{ request_id: string }>((resolve) => {
        deviceClient.once("message", (_topic, payload) => resolve(JSON.parse(payload.toString())));
      });

      const ota = new OtaPage(page);
      await ota.gotoNewJob();
      await ota.selectFirmwareById(firmware.id);
      await ota.selectTargetMode("single");
      await ota.checkDeviceByName(deviceName);
      await expect(page.getByTestId("ota-preview-summary")).toContainText("1");
      await ota.createJob();

      await page.waitForURL(/\/ota\/\d+/);

      const otaStart = await otaStartPromise;
      const requestId = otaStart.request_id;

      // Real device publishes real progress — the job-detail page polls
      // every 5s, so this proves live UI updates driven by real MQTT
      // traffic, not just the initial load.
      await publishRealStatus(device, { ota: { request_id: requestId, state: "downloading" } });
      const row = ota.targetRowByDevice(deviceName);
      await expect(row.getByTestId("ota-target-state")).toHaveText("downloading", { timeout: 10_000 });

      await publishRealEvent(device, {
        type: "firmware.updated",
        data: { from: "1.0.0", to: VERSION, request_id: requestId },
      });
      await expect(row.getByTestId("ota-target-state")).toHaveText("verified", { timeout: 10_000 });

      deviceClient.end();
    } finally {
      await deleteSeedDevice(token, device.id);
      await deleteFirmwareVersionsForBoard(token, BOARD_ID);
    }
  });
});

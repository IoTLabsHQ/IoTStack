/**
 * Real E2E: Control Panel toggle command lifecycle + device info line.
 * Persona: Admin. Journey: sign in -> device's Control page -> Edit -> add
 * a Toggle control -> Done -> click the switch -> a real status reply
 * arrives over MQTT -> loading clears and the switch reflects it. Also
 * covers firmware/RSSI showing under the device title once the device
 * reports them.
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "./page-objects/AuthPage";
import { ControlPage } from "./page-objects/ControlPage";
import {
  loginAdminToken,
  createSeedDevice,
  deleteSeedDevice,
  publishRealStatus,
  SeedDevice,
} from "./fixtures/env";

test.describe("Control Panel — toggle command loading + device info", () => {
  let apiToken: string;
  let device: SeedDevice;

  test.beforeAll(async () => {
    apiToken = await loginAdminToken();
    device = await createSeedDevice(apiToken, `e2e-toggle-control-${Date.now()}`);
  });

  test.afterAll(async () => {
    await deleteSeedDevice(apiToken, device.id);
  });

  test("shows loading after click, then the device's real reply — with no manual toggling", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const control = new ControlPage(page);
    await control.goto(device.id);
    await control.startEdit();
    await control.addToggleControl("Relay", "relay_1");
    await control.save();

    await control.toggleSwitch().click();

    // Loading must appear immediately on click, before any reply exists.
    await expect(control.toggleSpinner()).toBeVisible();
    await expect(control.toggleSwitch()).toBeDisabled();

    await publishRealStatus(device, { target: "relay_1", state: true });

    await expect(control.toggleSpinner()).not.toBeVisible({ timeout: 10_000 });
    await expect(control.toggleSwitch()).toBeEnabled();
    await expect(control.toggleSwitch()).toHaveAttribute("aria-checked", "true");
    await expect(control.toggleStatus()).toHaveText("On");
  });

  test("shows firmware version and WiFi RSSI under the device title once reported", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const control = new ControlPage(page);
    await control.goto(device.id);
    await expect(control.deviceInfoLine()).not.toBeVisible();

    await publishRealStatus(device, { firmware_version: "1.2.3", wifi_rssi: -62 });

    await expect(control.deviceInfoLine()).toContainText("Firmware 1.2.3", { timeout: 10_000 });
    await expect(control.deviceInfoLine()).toContainText("RSSI -62 dBm");
  });
});

/**
 * Real E2E: message-shape panel + click-to-fill field mapping, including
 * nested dot-paths. Persona: Admin. Journey: sign in -> device's Control
 * page -> Edit -> a real device message arrives over MQTT -> focus a
 * field input -> the right-side panel shows the device's real message
 * shape -> click a nested field -> the input fills -> Add -> Done -> the
 * widget shows the real live value (proves both the picker UI and the
 * dot-path runtime extraction work).
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "./page-objects/AuthPage";
import { ControlPage } from "./page-objects/ControlPage";
import {
  loginAdminToken,
  createSeedDevice,
  deleteSeedDevice,
  publishRealTelemetry,
  publishRealStatus,
  SeedDevice,
} from "./fixtures/env";

test.describe("Control Panel — message-shape field mapping", () => {
  let apiToken: string;
  let device: SeedDevice;

  test.beforeAll(async () => {
    apiToken = await loginAdminToken();
    device = await createSeedDevice(apiToken, `e2e-field-mapping-${Date.now()}`);
  });

  test.afterAll(async () => {
    await deleteSeedDevice(apiToken, device.id);
  });

  test("nested telemetry field pick fills the input and the widget shows the real value", async ({
    page,
  }) => {
    await publishRealTelemetry(device, {
      temperature_c: 21.5,
      gps: { lat: 10.7, long: 106.6 },
    });

    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const control = new ControlPage(page);
    await control.goto(device.id);
    await control.startEdit();
    await control.fillLabel("GPS Lat");
    await control.selectType("sensor-numeric");
    await control.telemetryFieldInput().click();

    const fieldButton = control.shapeFieldButton("telemetry", "gps.lat");
    await expect(fieldButton).toBeVisible({ timeout: 10_000 });
    await expect(fieldButton).toBeEnabled();
    await fieldButton.click();

    await expect(control.telemetryFieldInput()).toHaveValue("gps.lat");

    await control.clickAdd();
    await control.save();

    await expect(control.widgetValue()).toHaveText("10.7", { timeout: 10_000 });
  });

  test("nested status field pick fills the input and the toggle reflects the real value", async ({
    page,
  }) => {
    await publishRealStatus(device, { target: "relay_1", nested: { state: true } });

    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const control = new ControlPage(page);
    await control.goto(device.id);
    await control.startEdit();
    await control.fillLabel("Relay");
    await control.selectType("toggle");
    await control.fillStatusTarget("relay_1");
    await control.statusFieldInput().click();

    const fieldButton = control.shapeFieldButton("status", "nested.state");
    await expect(fieldButton).toBeVisible({ timeout: 10_000 });
    await expect(fieldButton).toBeEnabled();
    await fieldButton.click();

    await expect(control.statusFieldInput()).toHaveValue("nested.state");

    await control.clickAdd();
    await control.save();

    await expect(control.toggleStatus()).toHaveText("On", { timeout: 10_000 });
  });
});

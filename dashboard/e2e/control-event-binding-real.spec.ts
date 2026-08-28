/**
 * Real E2E: Control Panel "latest event" widget.
 * Persona: Admin. Journey: sign in -> device's Control page -> Edit ->
 * add an Event control -> Done -> a real event arrives over MQTT -> the
 * widget shows it, including after a reload.
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "./page-objects/AuthPage";
import { ControlPage } from "./page-objects/ControlPage";
import {
  loginAdminToken,
  createSeedDevice,
  deleteSeedDevice,
  publishRealEvent,
  SeedDevice,
} from "./fixtures/env";

test.describe("Control Panel — latest event widget", () => {
  let apiToken: string;
  let device: SeedDevice;

  test.beforeAll(async () => {
    apiToken = await loginAdminToken();
    device = await createSeedDevice(apiToken, `e2e-event-control-${Date.now()}`);
  });

  test.afterAll(async () => {
    await deleteSeedDevice(apiToken, device.id);
  });

  test("shows the latest event and survives a reload", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const control = new ControlPage(page);
    await control.goto(device.id);
    await control.startEdit();
    await control.addEventControl("Last event");
    await control.save();

    await publishRealEvent(device, { type: "door.opened" });

    await expect(control.eventWidgetType()).toHaveText("door.opened", { timeout: 10_000 });

    await page.reload();
    await expect(control.eventWidgetType()).toHaveText("door.opened", { timeout: 10_000 });
  });
});

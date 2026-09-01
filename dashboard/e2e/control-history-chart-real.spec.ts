/**
 * Real E2E: Control Panel "History chart" widget (v1.6.0).
 * Persona: Admin. Journey: sign in -> real device publishes real telemetry
 * over MQTT -> Control page -> Edit -> add a Sensor value control -> switch
 * its widget to History chart -> Done -> the Day view renders a real chart
 * from that message, no rollup wait needed (Day reads `messages` live).
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "./page-objects/AuthPage";
import { ControlPage } from "./page-objects/ControlPage";
import {
  loginAdminToken,
  createSeedDevice,
  deleteSeedDevice,
  publishRealTelemetry,
  SeedDevice,
} from "./fixtures/env";

test.describe("Control Panel — History chart widget", () => {
  let apiToken: string;
  let device: SeedDevice;

  test.beforeAll(async () => {
    apiToken = await loginAdminToken();
    device = await createSeedDevice(apiToken, `e2e-history-chart-${Date.now()}`);
  });

  test.afterAll(async () => {
    await deleteSeedDevice(apiToken, device.id);
  });

  test("Day view renders a real chart from the device's own telemetry", async ({ page }) => {
    await publishRealTelemetry(device, { temperature_c: 24.5 });
    await publishRealTelemetry(device, { temperature_c: 25.1 });

    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const control = new ControlPage(page);
    await control.goto(device.id);
    await control.startEdit();
    await control.addSensorNumericControl("Temperature", "temperature_c");
    await control.selectWidget(0, "history-chart");
    await control.save();

    await expect(control.historyChart()).toBeVisible();
    await expect(control.historyChart().getByText("No data yet for this range.")).not.toBeVisible();
    await expect(control.historyChart().locator(".recharts-line")).toBeVisible({ timeout: 10_000 });
  });
});

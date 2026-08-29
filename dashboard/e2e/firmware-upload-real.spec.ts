import { test, expect } from "@playwright/test";
import { AuthPage } from "./page-objects/AuthPage";
import { FirmwarePage } from "./page-objects/FirmwarePage";
import { loginAdminToken, deleteFirmwareVersionsForBoard } from "./fixtures/env";

const BOARD_ID = "esp32-c3-supermini";
const VERSION = `1.0.0-e2e-${Date.now()}`;

test.describe("Firmware — upload a version", () => {
  test.afterEach(async () => {
    const token = await loginAdminToken();
    await deleteFirmwareVersionsForBoard(token, BOARD_ID);
  });

  test("uploads a .bin and shows it in the version list", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.signIn(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

    const firmware = new FirmwarePage(page);
    await firmware.goto();
    await firmware.upload({ boardId: BOARD_ID, version: VERSION, fileContent: Buffer.from("fake-firmware-bytes") });

    const row = firmware.rows().filter({ hasText: VERSION });
    await expect(row).toBeVisible();

    await page.reload();
    await expect(firmware.rows().filter({ hasText: VERSION })).toBeVisible();
  });
});

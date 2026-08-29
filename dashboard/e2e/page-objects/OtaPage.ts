import type { Page } from "@playwright/test";

export class OtaPage {
  constructor(private page: Page) {}

  async gotoNewJob(): Promise<void> {
    await this.page.goto("/ota/new");
  }

  async selectFirmwareById(id: number): Promise<void> {
    await this.page.getByTestId("ota-firmware-select").selectOption(String(id));
  }

  async selectTargetMode(mode: string): Promise<void> {
    await this.page.getByTestId("ota-target-mode-select").selectOption(mode);
  }

  async checkDeviceByName(name: string): Promise<void> {
    await this.page.locator('label', { hasText: name }).getByTestId("ota-device-checkbox").check();
  }

  async createJob(): Promise<void> {
    await this.page.getByTestId("ota-create-job-button").click();
  }

  targetRowByDevice(name: string) {
    return this.page.getByTestId("ota-target-row").filter({ hasText: name });
  }
}

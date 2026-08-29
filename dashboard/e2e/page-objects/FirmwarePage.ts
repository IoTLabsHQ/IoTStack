import type { Page } from "@playwright/test";

export class FirmwarePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/firmware");
  }

  async upload(opts: { boardId: string; version: string; fileContent: Buffer }): Promise<void> {
    await this.page.getByTestId("firmware-board-select").selectOption(opts.boardId);
    await this.page.getByTestId("firmware-version-input").fill(opts.version);
    await this.page
      .getByTestId("firmware-file-input")
      .setInputFiles({ name: "test-firmware.bin", mimeType: "application/octet-stream", buffer: opts.fileContent });
    await this.page.getByTestId("firmware-upload-button").click();
  }

  rows() {
    return this.page.getByTestId("firmware-list-row");
  }
}

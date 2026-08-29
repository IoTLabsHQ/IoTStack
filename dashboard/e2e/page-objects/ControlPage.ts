import type { Page } from "@playwright/test";

export class ControlPage {
  constructor(private page: Page) {}

  async goto(deviceId: number): Promise<void> {
    await this.page.goto(`/control/${deviceId}`);
  }

  async startEdit(): Promise<void> {
    await this.page.getByTestId("control-edit-button").click();
  }

  async addEventControl(label: string, eventTypeFilter?: string): Promise<void> {
    await this.page.getByTestId("control-label-input").fill(label);
    await this.page.getByTestId("control-type-select").selectOption("event");
    if (eventTypeFilter) {
      await this.page.getByTestId("control-event-type-input").fill(eventTypeFilter);
    }
    await this.page.getByTestId("control-add-button").click();
  }

  async addToggleControl(label: string, target: string): Promise<void> {
    await this.page.getByTestId("control-label-input").fill(label);
    await this.page.getByTestId("control-type-select").selectOption("toggle");
    await this.page.getByTestId("control-target-input").fill(target);
    await this.page.getByTestId("control-add-button").click();
  }

  async save(): Promise<void> {
    await this.page.getByTestId("control-save-button").click();
  }

  eventWidgetType() {
    return this.page.getByTestId("control-widget-event-type");
  }

  toggleSwitch() {
    return this.page.getByTestId("control-toggle-switch");
  }

  toggleStatus() {
    return this.page.getByTestId("control-toggle-status");
  }

  toggleSpinner() {
    return this.page.getByTestId("control-toggle-spinner");
  }

  deviceInfoLine() {
    return this.page.getByTestId("device-info-line");
  }
}

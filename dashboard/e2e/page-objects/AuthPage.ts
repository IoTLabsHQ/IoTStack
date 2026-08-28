import type { Page } from "@playwright/test";

export class AuthPage {
  constructor(private page: Page) {}

  async signIn(email: string, password: string): Promise<void> {
    await this.page.goto("/login");
    await this.page.getByTestId("auth-email-input").fill(email);
    await this.page.getByTestId("auth-password-input").fill(password);
    await this.page.getByTestId("auth-submit-button").click();
    await this.page.waitForURL("/");
  }
}

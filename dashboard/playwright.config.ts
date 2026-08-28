import { defineConfig } from "@playwright/test";

/**
 * Runs against the real docker-compose stack (dashboard + api behind
 * Caddy), same convention as api/tests/setup.ts — no dev server started
 * here, no mocking. `docker compose up -d --build` first.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost",
    video: "on",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});

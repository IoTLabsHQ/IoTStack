import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { logger } from "./logger";
import { runMigrations, seedAdmin, seedSettings, getSettingsRow } from "./db";
import { connectDynsec } from "./dynsec-client";
import { startCollector, startRetentionSweep, getCollectorStatus } from "./collector";
import { assertNoDefaultSecretsInProduction } from "./startup-guard";
import { authRouter } from "./auth.routes";
import { devicesRouter } from "./devices.routes";
import { statsRouter } from "./stats.routes";
import { settingsRouter } from "./settings.routes";
import { writeDomainFile } from "./settings-sync";
import { pushCaddyConfig } from "./caddy-client";

async function main(): Promise<void> {
  assertNoDefaultSecretsInProduction();
  runMigrations();
  seedAdmin();
  seedSettings();
  await connectDynsec();
  startCollector();
  startRetentionSweep();

  // Self-heal: re-sync the shared domain file and Caddy's live config from
  // the DB (source of truth) on every boot, in case either volume was ever
  // recreated independently. Best-effort — Caddy may not be up yet on a
  // fresh stack's first boot, so a failure here is only logged.
  const { domain } = getSettingsRow();
  writeDomainFile(domain);
  pushCaddyConfig(domain).catch((err: unknown) => {
    logger.warn("initial caddy config push failed (will retry on next domain save):", err);
  });

  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.use("/auth", authRouter);
  app.use("/devices", devicesRouter);
  app.use("/stats", statsRouter);
  app.use("/settings", settingsRouter);

  app.get("/health", (_req, res) => {
    if (getCollectorStatus() === "disconnected") {
      res.status(503).json({ status: "collector_disconnected", ts: new Date().toISOString() });
      return;
    }
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  app.listen(config.port, () => {
    logger.info(`api listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch((err: unknown) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

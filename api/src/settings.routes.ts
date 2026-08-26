/**
 * Domain + SMTP configuration — both optional, both dashboard-managed.
 * SMTP is only ever considered "active" once a real connection verify has
 * succeeded; a failed PUT never touches the previously-saved config.
 */
import { Router } from "express";
import { getDb, getSettingsRow } from "./db";
import { requireAuth } from "./middleware";
import { requireString, requireInt, optionalString, validateDomain, respondIfValidationError } from "./validation";
import { pushCaddyConfig, checkDomainHttps } from "./caddy-client";
import { writeDomainFile } from "./settings-sync";
import { verifySmtp } from "./smtp";
import { logger } from "./logger";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", (_req, res) => {
  const row = getSettingsRow();
  res.json({
    domain: row.domain,
    smtp: {
      host: row.smtp_host,
      port: row.smtp_port,
      user: row.smtp_user,
      from: row.smtp_from,
      verifiedAt: row.smtp_verified_at,
      active: row.smtp_verified_at !== null,
    },
  });
});

settingsRouter.put("/domain", async (req, res) => {
  try {
    const domain = (optionalString(req.body?.domain, "domain") ?? "").trim().toLowerCase();
    validateDomain(domain);

    getDb()
      .prepare("UPDATE settings SET domain = ?, updated_at = datetime('now') WHERE id = 1")
      .run(domain);
    writeDomainFile(domain);

    let caddyWarning: string | undefined;
    try {
      await pushCaddyConfig(domain);
    } catch (err) {
      logger.error("caddy config push failed:", err);
      caddyWarning = "Saved, but reaching the proxy to apply it live failed — it will retry automatically.";
    }

    res.json({ domain, ...(caddyWarning ? { caddyWarning } : {}) });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("domain update error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

settingsRouter.get("/domain-status", async (_req, res) => {
  const { domain } = getSettingsRow();
  const active = await checkDomainHttps(domain);
  res.json({ domain, active });
});

settingsRouter.post("/smtp/test", async (req, res) => {
  try {
    const host = requireString(req.body?.host, "host");
    const port = requireInt(req.body?.port, "port", { min: 1, max: 65535 });
    const user = requireString(req.body?.user, "user");
    const password = requireString(req.body?.password, "password");
    const from = requireString(req.body?.from, "from");

    const result = await verifySmtp({ host, port, user, password, from });
    if (!result.ok) {
      res.status(422).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("smtp test error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

settingsRouter.put("/smtp", async (req, res) => {
  try {
    const host = requireString(req.body?.host, "host");
    const port = requireInt(req.body?.port, "port", { min: 1, max: 65535 });
    const user = requireString(req.body?.user, "user");
    const password = requireString(req.body?.password, "password");
    const from = requireString(req.body?.from, "from");

    const result = await verifySmtp({ host, port, user, password, from });
    if (!result.ok) {
      res.status(422).json({ ok: false, error: result.error });
      return;
    }

    getDb()
      .prepare(
        `UPDATE settings
         SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_password = ?, smtp_from = ?,
             smtp_verified_at = datetime('now'), updated_at = datetime('now')
         WHERE id = 1`,
      )
      .run(host, port, user, password, from);

    const { smtp_verified_at } = getSettingsRow();
    res.json({ ok: true, verifiedAt: smtp_verified_at });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("smtp save error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

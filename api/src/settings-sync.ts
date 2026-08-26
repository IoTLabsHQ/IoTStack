/**
 * Hands the current domain off to the mosquitto container, which has no
 * HTTP server of its own to query — it polls this file on a shared volume
 * instead of reading a container-start-time env var.
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "./config";
import { logger } from "./logger";

export function writeDomainFile(domain: string): void {
  try {
    mkdirSync(dirname(config.settingsShared.domainFile), { recursive: true });
    writeFileSync(config.settingsShared.domainFile, domain, "utf8");
  } catch (err) {
    logger.error("failed to write shared domain file:", err);
  }
}

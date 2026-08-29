/**
 * Refuses to start in production if any secret still matches the sample
 * value shipped in .env.example — catches "forgot to change the default
 * password" before it reaches a real deployment.
 */
import { config } from "./config";
import { logger } from "./logger";

const KNOWN_DEFAULTS = new Set([
  "changeme",
  "changeme_generate_a_real_secret",
]);

const CHECKED_SECRETS: Array<{ name: string; value: string }> = [
  { name: "ADMIN_PASSWORD", value: config.admin.password },
  { name: "SESSION_SECRET", value: config.sessionSecret },
  { name: "DYNSEC_CONTROLLER_PASSWORD", value: config.dynsec.controllerPassword },
  { name: "MQTT_COLLECTOR_PASSWORD", value: config.mqttCollector.password },
  { name: "MQTT_API_COMMAND_PASSWORD", value: config.mqttApiCommand.password },
  { name: "OTA_DOWNLOAD_SECRET", value: config.ota.downloadSecret },
];

/**
 * Call once at startup, before connecting to anything. Exits the process
 * (non-zero) if running with NODE_ENV=production and any checked secret
 * still equals its known sample/placeholder value.
 */
export function assertNoDefaultSecretsInProduction(): void {
  if (process.env.NODE_ENV !== "production") return;

  const offenders = CHECKED_SECRETS.filter(({ value }) => KNOWN_DEFAULTS.has(value));

  if (offenders.length > 0) {
    logger.error(
      `Refusing to start in production: ${offenders.map((o) => o.name).join(", ")} ` +
        `still set to a default/example value from .env.example. Set real secrets before deploying.`,
    );
    process.exit(1);
  }
}

/**
 * One-off ops script: re-applies the current per-topic device ACL (PRD
 * §16-18) to every device already in the database, replacing the legacy
 * combined `devices/{clientId}/#` wildcard grant devices provisioned under
 * older code still carry. Idempotent — safe to run more than once. Lives
 * under src/ (not a top-level scripts/ dir) so `npm run build` compiles it
 * into dist/ alongside main.ts — the production image has no devDeps/tsx.
 *
 * Run inside the api container against a live deployment:
 *   docker compose exec api node dist/scripts/migrate-device-acl.js
 */
import { getDb, runMigrations } from "../db";
import { connectDynsec, migrateDeviceAcl } from "../dynsec-client";
import { logger } from "../logger";

interface DeviceRow {
  client_id: string;
}

async function main(): Promise<void> {
  runMigrations();
  await connectDynsec();

  const devices = getDb().prepare("SELECT client_id FROM devices").all() as DeviceRow[];
  logger.info(`migrating ACL for ${devices.length} device(s)...`);

  for (const { client_id: clientId } of devices) {
    await migrateDeviceAcl(clientId);
    logger.info(`  ${clientId}: migrated`);
  }

  logger.info("done");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("migration failed:", err);
  process.exit(1);
});

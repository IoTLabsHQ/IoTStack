import { getDb, getSettingsRow } from "./db";
import { logger } from "./logger";
import { publishToDevice } from "./command-client";
import { createOtaDownloadToken } from "./ota-download-token";

/** Closes out a job once every one of its targets has reached a terminal
 * state — called after any target transition that might be the last one. */
export function checkJobCompletion(otaJobId: number): void {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN state IN ('verified','failed','timed_out','cancelled') THEN 1 ELSE 0 END) AS done
       FROM ota_job_targets WHERE ota_job_id = ?`,
    )
    .get(otaJobId) as { total: number; done: number };

  if (row.total > 0 && row.done === row.total) {
    getDb()
      .prepare(
        `UPDATE ota_jobs SET status = 'completed', completed_at = datetime('now')
         WHERE id = ? AND status = 'running'`,
      )
      .run(otaJobId);
    logger.info(`[ota] job ${otaJobId} completed (${row.total} target(s))`);
  }
}

interface TargetForSend {
  id: number;
  request_id: string;
  client_id: string;
  version: string;
  md5_hex: string;
  size_bytes: number;
}

/** Publishes ota.start for one target and marks it 'sent' — used both at
 * job-creation time (first batch) and by the timeout sweep (advancing the
 * staggered queue as earlier targets finish). */
export function sendOtaStartForTarget(targetId: number): void {
  const target = getDb()
    .prepare(
      `SELECT t.id, t.request_id, d.client_id, fv.version, fv.md5_hex, fv.size_bytes
       FROM ota_job_targets t
       JOIN ota_jobs j ON j.id = t.ota_job_id
       JOIN devices d ON d.id = t.device_id
       JOIN firmware_versions fv ON fv.id = j.firmware_version_id
       WHERE t.id = ?`,
    )
    .get(targetId) as TargetForSend | undefined;
  if (!target) return;

  const domain = getSettingsRow().domain;
  if (!domain) {
    // Same precondition ArduinoCodeSection.tsx already enforces for
    // generated firmware — MQTTS needs a real domain locally, and OTA's
    // HTTPS download is no different. ota.routes.ts blocks job creation
    // before this ever runs; this is a defensive backstop for the sweep
    // path (a domain removed mid-rollout).
    logger.error(`[ota] cannot send ota.start for target ${targetId}: no domain configured`);
    getDb()
      .prepare(
        `UPDATE ota_job_targets SET state = 'failed', error_message = 'no domain configured', last_update_at = datetime('now')
         WHERE id = ?`,
      )
      .run(targetId);
    return;
  }
  const token = createOtaDownloadToken(target.id);
  const downloadUrl = `https://${domain}/api/firmware/download/${token}`;

  getDb()
    .prepare(
      `UPDATE ota_job_targets SET download_token = ?, state = 'sent', sent_at = datetime('now'), last_update_at = datetime('now')
       WHERE id = ?`,
    )
    .run(token, target.id);

  publishToDevice(
    target.client_id,
    JSON.stringify({
      command: "ota.start",
      request_id: target.request_id,
      data: {
        version: target.version,
        download_url: downloadUrl,
        size_bytes: target.size_bytes,
        md5: target.md5_hex,
      },
    }),
  );
  logger.info(`[ota] sent ota.start to "${target.client_id}" (target ${target.id})`);
}

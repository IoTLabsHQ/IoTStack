/**
 * Recognizes OTA progress/outcome inside otherwise-generic status/event
 * messages and correlates them back to the ota_job_targets row that
 * triggered them, by request_id — called from collector.ts's handleMessage,
 * not a separate MQTT subscription.
 */
import { getDb } from "./db";
import { logger } from "./logger";
import { checkJobCompletion } from "./ota-jobs";

interface TargetRow {
  id: number;
  ota_job_id: number;
}

function findTarget(requestId: string, deviceId: number): TargetRow | undefined {
  return getDb()
    .prepare("SELECT id, ota_job_id FROM ota_job_targets WHERE request_id = ? AND device_id = ?")
    .get(requestId, deviceId) as TargetRow | undefined;
}

/** Progress ticks: `{"ota":{"request_id":"...","state":"downloading"}}` on
 * the device's normal `status` topic — namespaced under "ota" so it can
 * never collide with an application state field like "relay". */
export function handleOtaStatusMessage(deviceId: number, payloadStr: string): void {
  let parsed: { ota?: { request_id?: unknown; state?: unknown } };
  try {
    parsed = JSON.parse(payloadStr);
  } catch {
    return;
  }
  const requestId = parsed.ota?.request_id;
  const state = parsed.ota?.state;
  if (typeof requestId !== "string" || typeof state !== "string") return;

  const target = findTarget(requestId, deviceId);
  if (!target) return;

  getDb()
    .prepare(`UPDATE ota_job_targets SET state = ?, last_update_at = datetime('now') WHERE id = ?`)
    .run(state, target.id);
  logger.info(`[ota] target ${target.id} (device ${deviceId}) -> ${state}`);
}

/** Terminal outcome: the two PRD-reserved event types, each carrying the
 * request_id of the ota.start that triggered them. */
export function handleOtaEventMessage(deviceId: number, payloadStr: string): void {
  let parsed: { type?: unknown; data?: { request_id?: unknown; to?: unknown; reason?: unknown } };
  try {
    parsed = JSON.parse(payloadStr);
  } catch {
    return;
  }
  if (parsed.type !== "firmware.updated" && parsed.type !== "firmware.update_failed") return;

  const requestId = parsed.data?.request_id;
  if (typeof requestId !== "string") return;

  const target = findTarget(requestId, deviceId);
  if (!target) return;

  if (parsed.type === "firmware.updated") {
    getDb()
      .prepare(`UPDATE ota_job_targets SET state = 'verified', last_update_at = datetime('now') WHERE id = ?`)
      .run(target.id);
    const toVersion = parsed.data?.to;
    if (typeof toVersion === "string") {
      getDb().prepare(`UPDATE devices SET firmware_version = ? WHERE id = ?`).run(toVersion, deviceId);
    }
    logger.info(`[ota] target ${target.id} (device ${deviceId}) -> verified`);
  } else {
    const reason = typeof parsed.data?.reason === "string" ? parsed.data.reason : "unknown";
    getDb()
      .prepare(
        `UPDATE ota_job_targets SET state = 'failed', error_message = ?, last_update_at = datetime('now')
         WHERE id = ?`,
      )
      .run(reason, target.id);
    logger.info(`[ota] target ${target.id} (device ${deviceId}) -> failed (${reason})`);
  }

  checkJobCompletion(target.ota_job_id);
}

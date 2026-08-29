import { randomUUID } from "crypto";
import { Router } from "express";
import { getDb, getSettingsRow } from "./db";
import { requireAuth, AuthedRequest } from "./middleware";
import { requireInt, requireString, respondIfValidationError, ValidationError } from "./validation";
import { publishToDevice } from "./command-client";
import { config } from "./config";
import { logger } from "./logger";
import { checkJobCompletion, sendOtaStartForTarget } from "./ota-jobs";

export const otaRouter = Router();
otaRouter.use(requireAuth);

const TARGET_MODES = new Set(["single", "multi", "online_only", "all"]);

interface FirmwareVersionRow {
  id: number;
  board_id: string;
  version: string;
}

interface DeviceRow {
  id: number;
  client_id: string;
  board_id: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const seenMs = new Date(`${lastSeenAt}Z`).getTime();
  return Date.now() - seenMs <= config.onlineThresholdSeconds * 1000;
}

interface ResolvedTargets {
  matched: DeviceRow[];
  excludedBoardMismatch: number;
  excludedOffline: number;
}

/** Same resolution logic used by both job creation and the dry-run preview
 * endpoint, so "this will target N devices" can never drift from reality. */
function resolveTargetDevices(
  targetMode: string,
  deviceIds: number[] | undefined,
  boardId: string,
): ResolvedTargets {
  if (!TARGET_MODES.has(targetMode)) {
    throw new ValidationError(`targetMode must be one of: ${[...TARGET_MODES].join(", ")}`);
  }

  if (targetMode === "single" || targetMode === "multi") {
    if (!deviceIds || deviceIds.length === 0) {
      throw new ValidationError("deviceIds is required for targetMode 'single'/'multi'");
    }
    if (targetMode === "single" && deviceIds.length !== 1) {
      throw new ValidationError("targetMode 'single' requires exactly one deviceId");
    }
    const placeholders = deviceIds.map(() => "?").join(",");
    const rows = getDb()
      .prepare(
        `SELECT id, client_id, board_id, firmware_version, last_seen_at FROM devices WHERE id IN (${placeholders})`,
      )
      .all(...deviceIds) as DeviceRow[];
    if (rows.length !== deviceIds.length) {
      throw new ValidationError("one or more deviceIds not found");
    }
    const mismatched = rows.filter((d) => d.board_id !== boardId);
    if (mismatched.length > 0) {
      throw new ValidationError(
        `device(s) ${mismatched.map((d) => d.id).join(", ")} have a different/unset board than this firmware's board (${boardId}) — explicit targets are never silently excluded`,
      );
    }
    return { matched: rows, excludedBoardMismatch: 0, excludedOffline: 0 };
  }

  // online_only / all — bulk modes resolve from every device, silently
  // excluding whatever doesn't qualify (never a hard error, unlike above).
  const rows = getDb()
    .prepare(`SELECT id, client_id, board_id, firmware_version, last_seen_at FROM devices`)
    .all() as DeviceRow[];
  const matchedBoard = rows.filter((d) => d.board_id === boardId);
  const excludedBoardMismatch = rows.length - matchedBoard.length;
  const matched =
    targetMode === "online_only" ? matchedBoard.filter((d) => isOnline(d.last_seen_at)) : matchedBoard;
  const excludedOffline = matchedBoard.length - matched.length;
  return { matched, excludedBoardMismatch, excludedOffline };
}

function parseDeviceIds(input: unknown): number[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new ValidationError("deviceIds must be an array");
  return input.map((v) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new ValidationError("deviceIds must contain only integers");
    return n;
  });
}

otaRouter.get("/preview", (req, res) => {
  try {
    const firmwareVersionId = requireInt(Number(req.query.firmwareVersionId), "firmwareVersionId");
    const targetMode = requireString(req.query.targetMode as string | undefined, "targetMode");
    const deviceIds = req.query.deviceIds
      ? String(req.query.deviceIds)
          .split(",")
          .map((s) => Number(s.trim()))
      : undefined;

    const fw = getDb()
      .prepare("SELECT id, board_id, version FROM firmware_versions WHERE id = ?")
      .get(firmwareVersionId) as FirmwareVersionRow | undefined;
    if (!fw) throw new ValidationError("firmwareVersionId not found");

    const resolved = resolveTargetDevices(targetMode, deviceIds, fw.board_id);
    res.json({
      targetCount: resolved.matched.length,
      excludedBoardMismatch: resolved.excludedBoardMismatch,
      excludedOffline: resolved.excludedOffline,
      deviceIds: resolved.matched.map((d) => d.id),
    });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("ota preview error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

otaRouter.post("/jobs", (req, res) => {
  try {
    if (!getSettingsRow().domain) {
      throw new ValidationError(
        "No domain configured — OTA downloads need a real HTTPS domain, same as generated device firmware. Set one on the Settings page first.",
      );
    }
    const firmwareVersionId = requireInt(req.body?.firmwareVersionId, "firmwareVersionId");
    const targetMode = requireString(req.body?.targetMode, "targetMode");
    const deviceIds = parseDeviceIds(req.body?.deviceIds);
    const batchSize = req.body?.batchSize
      ? requireInt(req.body.batchSize, "batchSize", { min: 1 })
      : config.ota.defaultBatchSize;

    const fw = getDb()
      .prepare("SELECT id, board_id, version FROM firmware_versions WHERE id = ?")
      .get(firmwareVersionId) as FirmwareVersionRow | undefined;
    if (!fw) throw new ValidationError("firmwareVersionId not found");

    const resolved = resolveTargetDevices(targetMode, deviceIds, fw.board_id);
    if (resolved.matched.length === 0) {
      throw new ValidationError("no devices matched this target selection");
    }

    const adminId = (req as AuthedRequest).adminId ?? null;
    const jobResult = getDb()
      .prepare(
        `INSERT INTO ota_jobs (firmware_version_id, target_mode, batch_size, created_by) VALUES (?, ?, ?, ?)`,
      )
      .run(fw.id, targetMode, batchSize, adminId);
    const otaJobId = Number(jobResult.lastInsertRowid);

    const targetIds: number[] = [];
    for (const device of resolved.matched) {
      const requestId = randomUUID();
      const targetResult = getDb()
        .prepare(
          `INSERT INTO ota_job_targets (ota_job_id, device_id, request_id, from_version, to_version)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(otaJobId, device.id, requestId, device.firmware_version, fw.version);
      targetIds.push(Number(targetResult.lastInsertRowid));
    }

    const toSend = targetIds.slice(0, batchSize);
    for (const targetId of toSend) sendOtaStartForTarget(targetId);

    logger.info(
      `[ota] job ${otaJobId} created: ${resolved.matched.length} target(s), ${toSend.length} sent immediately`,
    );
    res.status(201).json({
      otaJobId,
      targetCount: resolved.matched.length,
      sentCount: toSend.length,
      excludedBoardMismatch: resolved.excludedBoardMismatch,
      excludedOffline: resolved.excludedOffline,
    });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("ota job create error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

otaRouter.get("/jobs", (_req, res) => {
  const jobs = getDb()
    .prepare(
      `SELECT j.id, j.target_mode, j.status, j.batch_size, j.created_at, j.completed_at,
              fv.board_id, fv.version,
              COUNT(t.id) AS target_count,
              SUM(CASE WHEN t.state = 'verified' THEN 1 ELSE 0 END) AS verified_count,
              SUM(CASE WHEN t.state = 'failed' THEN 1 ELSE 0 END) AS failed_count,
              SUM(CASE WHEN t.state = 'timed_out' THEN 1 ELSE 0 END) AS timed_out_count
       FROM ota_jobs j
       JOIN firmware_versions fv ON fv.id = j.firmware_version_id
       LEFT JOIN ota_job_targets t ON t.ota_job_id = j.id
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
    )
    .all();
  res.json({ jobs });
});

otaRouter.get("/jobs/:id", (req, res) => {
  const job = getDb()
    .prepare(
      `SELECT j.id, j.target_mode, j.status, j.batch_size, j.created_at, j.completed_at,
              fv.id AS firmware_version_id, fv.board_id, fv.version
       FROM ota_jobs j
       JOIN firmware_versions fv ON fv.id = j.firmware_version_id
       WHERE j.id = ?`,
    )
    .get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "OTA job not found" });
    return;
  }
  const targets = getDb()
    .prepare(
      `SELECT t.id, t.device_id, d.display_name AS device_display_name, t.request_id, t.state,
              t.error_message, t.from_version, t.to_version, t.sent_at, t.last_update_at
       FROM ota_job_targets t
       JOIN devices d ON d.id = t.device_id
       WHERE t.ota_job_id = ?
       ORDER BY t.id ASC`,
    )
    .all(req.params.id);
  res.json({ job, targets });
});

otaRouter.post("/jobs/:id/cancel", (req, res) => {
  const job = getDb().prepare("SELECT id, status FROM ota_jobs WHERE id = ?").get(req.params.id) as
    | { id: number; status: string }
    | undefined;
  if (!job) {
    res.status(404).json({ error: "OTA job not found" });
    return;
  }

  // Pending targets never got a real MQTT ota.start — cancel them outright,
  // freeing their slot so the sweep never picks them up.
  const cancelled = getDb()
    .prepare(
      `UPDATE ota_job_targets SET state = 'cancelled', last_update_at = datetime('now')
       WHERE ota_job_id = ? AND state = 'pending'`,
    )
    .run(job.id);

  // In-flight targets already have a device mid-download/flash — HTTPUpdate
  // is a blocking call, so the device can't actually act on this until it's
  // done with the current attempt (see docs/reference). Best-effort only.
  const inFlight = getDb()
    .prepare(
      `SELECT t.request_id, d.client_id FROM ota_job_targets t
       JOIN devices d ON d.id = t.device_id
       WHERE t.ota_job_id = ? AND t.state IN ('sent','downloading','flashing','flash_ok')`,
    )
    .all(job.id) as { request_id: string; client_id: string }[];
  for (const t of inFlight) {
    publishToDevice(t.client_id, JSON.stringify({ command: "ota.cancel", request_id: t.request_id, data: {} }));
  }

  checkJobCompletion(job.id);
  logger.info(`[ota] job ${job.id} cancel requested: ${cancelled.changes} pending target(s) cancelled`);
  res.json({ ok: true, cancelledPending: cancelled.changes, cancelSentToInFlight: inFlight.length });
});

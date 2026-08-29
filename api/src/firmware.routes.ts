import { createReadStream } from "fs";
import { Router } from "express";
import multer from "multer";
import { getDb } from "./db";
import { requireAuth, AuthedRequest } from "./middleware";
import { requireString, optionalString, respondIfValidationError, ValidationError } from "./validation";
import { saveFirmwareFile, deleteFirmwareFile, firmwareFilePath } from "./firmware-storage";
import { verifyOtaDownloadToken } from "./ota-download-token";
import { VALID_BOARD_IDS } from "./board-ids";
import { config } from "./config";
import { logger } from "./logger";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.firmware.maxUploadBytes },
});

interface FirmwareVersionRow {
  id: number;
  board_id: string;
  version: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  sha256: string;
  md5_hex: string;
  notes: string | null;
  uploaded_at: string;
  uploaded_by: number | null;
}

export const firmwareRouter = Router();

// No requireAuth — a device has no dashboard session, only the signed token
// embedded in the ota.start command it received. Registered before the
// requireAuth middleware below so route matching never reaches it.
firmwareRouter.get("/download/:token", (req, res) => {
  const targetId = verifyOtaDownloadToken(req.params.token);
  if (targetId === null) {
    res.status(403).json({ error: "Invalid or expired download token" });
    return;
  }

  const row = getDb()
    .prepare(
      `SELECT fv.storage_path, fv.size_bytes, fv.md5_hex, fv.filename
       FROM ota_job_targets t
       JOIN ota_jobs j ON j.id = t.ota_job_id
       JOIN firmware_versions fv ON fv.id = j.firmware_version_id
       WHERE t.id = ?`,
    )
    .get(targetId) as { storage_path: string; size_bytes: number; md5_hex: string; filename: string } | undefined;
  if (!row) {
    res.status(404).json({ error: "Firmware not found for this token" });
    return;
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", String(row.size_bytes));
  // HTTPUpdate.cpp reads this header automatically and calls Update.setMD5()
  // — on-device checksum verification with zero bespoke firmware code.
  res.setHeader("x-MD5", row.md5_hex);
  res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
  createReadStream(firmwareFilePath(row.storage_path)).pipe(res);
});

firmwareRouter.use(requireAuth);

firmwareRouter.get("/", (req, res) => {
  const boardId = typeof req.query.board_id === "string" ? req.query.board_id : undefined;
  const rows = boardId
    ? getDb()
        .prepare(
          `SELECT id, board_id, version, filename, size_bytes, sha256, notes, uploaded_at
           FROM firmware_versions WHERE board_id = ? ORDER BY uploaded_at DESC`,
        )
        .all(boardId)
    : getDb()
        .prepare(
          `SELECT id, board_id, version, filename, size_bytes, sha256, notes, uploaded_at
           FROM firmware_versions ORDER BY uploaded_at DESC`,
        )
        .all();
  res.json({ firmwareVersions: rows });
});

firmwareRouter.get("/:id", (req, res) => {
  const row = getDb()
    .prepare(
      `SELECT id, board_id, version, filename, size_bytes, sha256, notes, uploaded_at
       FROM firmware_versions WHERE id = ?`,
    )
    .get(req.params.id) as Omit<FirmwareVersionRow, "storage_path" | "md5_hex" | "uploaded_by"> | undefined;
  if (!row) {
    res.status(404).json({ error: "Firmware version not found" });
    return;
  }
  res.json({ firmwareVersion: row });
});

firmwareRouter.post("/", upload.single("firmware"), (req, res) => {
  let storagePath: string | null = null;
  try {
    if (!req.file) throw new ValidationError("firmware file is required (field name: firmware)");

    const boardId = requireString(req.body?.boardId, "boardId");
    if (!VALID_BOARD_IDS.has(boardId)) {
      throw new ValidationError(`boardId must be one of: ${[...VALID_BOARD_IDS].join(", ")}`);
    }
    const version = requireString(req.body?.version, "version");
    const notes = optionalString(req.body?.notes, "notes") ?? null;

    const stored = saveFirmwareFile(req.file.buffer);
    storagePath = stored.storagePath;

    const adminId = (req as AuthedRequest).adminId ?? null;
    const result = getDb()
      .prepare(
        `INSERT INTO firmware_versions
           (board_id, version, filename, storage_path, size_bytes, sha256, md5_hex, notes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        boardId,
        version,
        req.file.originalname,
        stored.storagePath,
        stored.sizeBytes,
        stored.sha256,
        stored.md5Hex,
        notes,
        adminId,
      );

    logger.info(`firmware version "${boardId}@${version}" uploaded (id=${result.lastInsertRowid})`);
    res.status(201).json({
      firmwareVersion: {
        id: result.lastInsertRowid,
        boardId,
        version,
        filename: req.file.originalname,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
      },
    });
  } catch (err) {
    if (storagePath) deleteFirmwareFile(storagePath);
    if (respondIfValidationError(err, res)) return;
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "This board already has a firmware version with that version string" });
      return;
    }
    logger.error("firmware upload error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

firmwareRouter.delete("/:id", (req, res) => {
  try {
    const row = getDb()
      .prepare("SELECT storage_path FROM firmware_versions WHERE id = ?")
      .get(req.params.id) as { storage_path: string } | undefined;
    if (!row) {
      res.status(404).json({ error: "Firmware version not found" });
      return;
    }

    // A version that was ever successfully installed anywhere is kept
    // forever — it's the only thing that makes a later manual rollback
    // possible (rollback = a normal new OTA job pointing at an older
    // version row).
    const everSucceeded = getDb()
      .prepare(
        `SELECT 1 FROM ota_job_targets t JOIN ota_jobs j ON j.id = t.ota_job_id
         WHERE j.firmware_version_id = ? AND t.state = 'verified' LIMIT 1`,
      )
      .get(req.params.id);
    if (everSucceeded) {
      res.status(409).json({
        error: "This firmware version was successfully installed on at least one device and can't be deleted (kept as a rollback target)",
      });
      return;
    }

    getDb().prepare("DELETE FROM firmware_versions WHERE id = ?").run(req.params.id);
    deleteFirmwareFile(row.storage_path);
    res.json({ ok: true });
  } catch (err) {
    // Backstop for the everSucceeded check above: ota_job_targets cascades
    // away when its device is deleted, which can leave an orphaned
    // ota_jobs row (firmware_version_id has no cascade) that the
    // ota_job_targets-based check above can no longer see. The DB's own FK
    // constraint is the authoritative guard either way.
    if (err instanceof Error && err.message.includes("FOREIGN KEY constraint failed")) {
      res.status(409).json({ error: "This firmware version has OTA job history and can't be deleted" });
      return;
    }
    logger.error("firmware delete error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

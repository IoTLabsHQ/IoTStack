import { Router } from "express";
import multer from "multer";
import { getDb } from "./db";
import { requireAuth, AuthedRequest } from "./middleware";
import { requireString, optionalString, respondIfValidationError, ValidationError } from "./validation";
import { saveFirmwareFile, deleteFirmwareFile } from "./firmware-storage";
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
  const row = getDb()
    .prepare("SELECT storage_path FROM firmware_versions WHERE id = ?")
    .get(req.params.id) as { storage_path: string } | undefined;
  if (!row) {
    res.status(404).json({ error: "Firmware version not found" });
    return;
  }
  getDb().prepare("DELETE FROM firmware_versions WHERE id = ?").run(req.params.id);
  deleteFirmwareFile(row.storage_path);
  res.json({ ok: true });
});

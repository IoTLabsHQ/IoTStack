import { createHash, randomUUID } from "crypto";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { config } from "./config";

export interface StoredFirmwareFile {
  storagePath: string;
  sizeBytes: number;
  sha256: string;
  md5Hex: string;
}

/** Absolute path on disk for a firmware_versions.storage_path value. */
export function firmwareFilePath(storagePath: string): string {
  return join(config.firmware.dir, storagePath);
}

/**
 * Writes an uploaded firmware buffer to disk under a server-generated name
 * (never the user's original filename — sidesteps collision/traversal
 * handling entirely, same reasoning as generateClientId() in
 * devices.routes.ts). Returns the checksums firmware.routes.ts persists.
 */
export function saveFirmwareFile(buffer: Buffer): StoredFirmwareFile {
  mkdirSync(config.firmware.dir, { recursive: true });

  const storagePath = `${randomUUID()}.bin`;
  writeFileSync(firmwareFilePath(storagePath), buffer);

  return {
    storagePath,
    sizeBytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    md5Hex: createHash("md5").update(buffer).digest("hex"),
  };
}

export function deleteFirmwareFile(storagePath: string): void {
  try {
    unlinkSync(firmwareFilePath(storagePath));
  } catch {
    // Already gone (or never written) — deleting the DB row should still
    // succeed, this is best-effort disk cleanup.
  }
}

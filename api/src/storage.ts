/**
 * Atomic storage-cap check-and-increment. A single UPDATE statement is
 * inherently race-free here — SQLite serializes all writers on the
 * database file, so there is no separate check-then-write window the way
 * there can be with a distributed database. The storage_usage row is
 * always seeded at device creation, so "row missing" never has to be
 * distinguished from "over cap".
 */
import { getDb } from "./db";

export function incrementStorageIfUnderCap(
  deviceId: number,
  payloadBytes: number,
  storageLimitBytes: number,
): boolean {
  const result = getDb()
    .prepare(
      `UPDATE storage_usage
       SET bytes = bytes + ?
       WHERE device_id = ? AND bytes + ? < ?`,
    )
    .run(payloadBytes, deviceId, payloadBytes, storageLimitBytes);
  return result.changes > 0;
}

export function getStorageUsedBytes(deviceId: number): number {
  const row = getDb()
    .prepare("SELECT bytes FROM storage_usage WHERE device_id = ?")
    .get(deviceId) as { bytes: number } | undefined;
  return row?.bytes ?? 0;
}

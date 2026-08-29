import { apiFetch } from "./client";

export interface FirmwareVersion {
  id: number;
  board_id: string;
  version: string;
  filename: string;
  size_bytes: number;
  sha256: string;
  notes: string | null;
  uploaded_at: string;
}

export function listFirmwareVersions(boardId?: string): Promise<{ firmwareVersions: FirmwareVersion[] }> {
  return apiFetch(`/firmware${boardId ? `?board_id=${encodeURIComponent(boardId)}` : ""}`);
}

export function getFirmwareVersion(id: number): Promise<{ firmwareVersion: FirmwareVersion }> {
  return apiFetch(`/firmware/${id}`);
}

export function uploadFirmwareVersion(input: {
  boardId: string;
  version: string;
  notes?: string;
  file: File;
}): Promise<{
  firmwareVersion: {
    id: number;
    boardId: string;
    version: string;
    filename: string;
    sizeBytes: number;
    sha256: string;
  };
}> {
  const form = new FormData();
  form.append("boardId", input.boardId);
  form.append("version", input.version);
  if (input.notes) form.append("notes", input.notes);
  form.append("firmware", input.file);
  return apiFetch("/firmware", { method: "POST", body: form });
}

export function deleteFirmwareVersion(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/firmware/${id}`, { method: "DELETE" });
}

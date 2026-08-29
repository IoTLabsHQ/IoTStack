import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "../components/Shell";
import { BOARDS } from "../lib/arduino/boards";
import {
  listFirmwareVersions,
  uploadFirmwareVersion,
  deleteFirmwareVersion,
} from "../lib/api/firmware";
import { ApiError } from "../lib/api/client";

function boardLabel(boardId: string): string {
  return BOARDS.find((b) => b.id === boardId)?.label ?? boardId;
}

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;
}

export function FirmwarePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["firmware-versions"],
    queryFn: () => listFirmwareVersions(),
  });

  const [boardId, setBoardId] = useState(BOARDS[0].id);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("no file selected");
      return uploadFirmwareVersion({ boardId, version: version.trim(), notes: notes.trim() || undefined, file });
    },
    onSuccess: () => {
      setVersion("");
      setNotes("");
      setFile(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["firmware-versions"] });
    },
    onError: (err) => {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFirmwareVersion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firmware-versions"] }),
  });

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Firmware</h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload a compiled <code className="font-mono">.bin</code> (Arduino IDE &gt; Sketch &gt;
        Export Compiled Binary) to make it available for OTA jobs.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (version.trim() && file) uploadMutation.mutate();
        }}
        className="mb-6 rounded-lg border border-slate-200 bg-white p-5"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Board</label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              data-testid="firmware-board-select"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {BOARDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Version</label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.1"
              data-testid="firmware-version-input"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs text-slate-500">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What changed in this version"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs text-slate-500">Compiled binary (.bin)</label>
          <input
            type="file"
            accept=".bin"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="firmware-file-input"
            className="block w-full text-sm"
          />
        </div>
        {uploadError && (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            {uploadError}
          </p>
        )}
        <button
          type="submit"
          disabled={uploadMutation.isPending || !version.trim() || !file}
          data-testid="firmware-upload-button"
          className="mt-4 rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Uploading…" : "Upload firmware"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.firmwareVersions.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Board</th>
                <th className="px-4 py-2">Version</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.firmwareVersions.map((fw) => (
                <tr key={fw.id} data-testid="firmware-list-row" className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{boardLabel(fw.board_id)}</td>
                  <td className="px-4 py-2 font-mono">{fw.version}</td>
                  <td className="px-4 py-2">{formatBytes(fw.size_bytes)}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(fw.uploaded_at + "Z").toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-500">{fw.notes ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete firmware ${fw.board_id}@${fw.version}?`)) deleteMutation.mutate(fw.id);
                      }}
                      data-testid="firmware-delete-button"
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No firmware versions uploaded yet.</p>
      )}
    </Shell>
  );
}

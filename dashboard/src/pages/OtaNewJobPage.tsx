import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { listFirmwareVersions } from "../lib/api/firmware";
import { listDevices } from "../lib/api/devices";
import { createOtaJob, previewOtaTargets, type OtaPreviewResult } from "../lib/api/ota";
import { BOARDS } from "../lib/arduino/boards";
import { ApiError } from "../lib/api/client";

function boardLabel(boardId: string): string {
  return BOARDS.find((b) => b.id === boardId)?.label ?? boardId;
}

const TARGET_MODES = [
  { value: "single", label: "Single device" },
  { value: "multi", label: "Multiple devices" },
  { value: "online_only", label: "Online devices only" },
  { value: "all", label: "All devices" },
];

export function OtaNewJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = useMemo(() => {
    const raw = searchParams.get("device_ids");
    return raw ? raw.split(",").map(Number).filter(Number.isInteger) : [];
  }, [searchParams]);

  const { data: firmwareData } = useQuery({ queryKey: ["firmware-versions"], queryFn: () => listFirmwareVersions() });
  const { data: devicesData } = useQuery({ queryKey: ["devices"], queryFn: listDevices });

  const [firmwareVersionId, setFirmwareVersionId] = useState<number | null>(null);
  const [targetMode, setTargetMode] = useState<string>(preselected.length > 0 ? "multi" : "single");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set(preselected));
  const [preview, setPreview] = useState<OtaPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!firmwareVersionId) {
      setFirmwareVersionId(firmwareData?.firmwareVersions[0]?.id ?? null);
    }
  }, [firmwareData, firmwareVersionId]);

  const selectedFirmware = firmwareData?.firmwareVersions.find((f) => f.id === firmwareVersionId);
  const matchingDevices = (devicesData?.devices ?? []).filter((d) => d.board_id === selectedFirmware?.board_id);

  async function runPreview() {
    if (!firmwareVersionId) return;
    setPreviewError(null);
    try {
      const deviceIds = targetMode === "single" || targetMode === "multi" ? [...selectedDeviceIds] : undefined;
      const result = await previewOtaTargets({ firmwareVersionId, targetMode, deviceIds });
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof ApiError ? err.message : "Preview failed");
    }
  }

  useEffect(() => {
    setPreview(null);
    if (firmwareVersionId) runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmwareVersionId, targetMode, selectedDeviceIds.size]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!firmwareVersionId) throw new Error("no firmware selected");
      const deviceIds = targetMode === "single" || targetMode === "multi" ? [...selectedDeviceIds] : undefined;
      return createOtaJob({ firmwareVersionId, targetMode, deviceIds });
    },
    onSuccess: (result) => navigate(`/ota/${result.otaJobId}`),
    onError: (err) => setCreateError(err instanceof ApiError ? err.message : "Failed to create OTA job"),
  });

  function toggleDevice(id: number) {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (targetMode === "single") {
        next.clear();
        next.add(id);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const needsDevicePicker = targetMode === "single" || targetMode === "multi";
  const canCreate =
    firmwareVersionId !== null && (!needsDevicePicker || selectedDeviceIds.size > 0) && (preview?.targetCount ?? 0) > 0;

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">New OTA job</h1>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <label className="mb-1 block text-xs text-slate-500">Firmware version</label>
        <select
          value={firmwareVersionId ?? ""}
          onChange={(e) => {
            setFirmwareVersionId(Number(e.target.value));
            setSelectedDeviceIds(new Set());
          }}
          data-testid="ota-firmware-select"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {(firmwareData?.firmwareVersions ?? []).map((fw) => (
            <option key={fw.id} value={fw.id}>
              {boardLabel(fw.board_id)} @ {fw.version}
            </option>
          ))}
        </select>

        <label className="mb-1 mt-4 block text-xs text-slate-500">Target</label>
        <select
          value={targetMode}
          onChange={(e) => {
            setTargetMode(e.target.value);
            setSelectedDeviceIds(new Set());
          }}
          data-testid="ota-target-mode-select"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {TARGET_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {needsDevicePicker && (
          <div className="mt-4">
            <p className="mb-1 text-xs text-slate-500">
              Devices running {selectedFirmware ? boardLabel(selectedFirmware.board_id) : "this board"}
            </p>
            {matchingDevices.length === 0 ? (
              <p className="text-sm text-slate-500">No devices with a matching board recorded yet.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
                {matchingDevices.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                  >
                    <input
                      type={targetMode === "single" ? "radio" : "checkbox"}
                      checked={selectedDeviceIds.has(d.id)}
                      onChange={() => toggleDevice(d.id)}
                      data-testid="ota-device-checkbox"
                    />
                    {d.display_name}
                    {d.online && <span className="text-xs text-emerald-600">online</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {previewError && (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            {previewError}
          </p>
        )}
        {preview && (
          <p className="mt-4 text-sm text-slate-600" data-testid="ota-preview-summary">
            Will target <b>{preview.targetCount}</b> device(s).
            {preview.excludedBoardMismatch > 0 && (
              <span className="ml-1 text-slate-400">
                ({preview.excludedBoardMismatch} excluded — different board)
              </span>
            )}
            {preview.excludedOffline > 0 && (
              <span className="ml-1 text-slate-400">({preview.excludedOffline} excluded — offline)</span>
            )}
          </p>
        )}

        {createError && (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            {createError}
          </p>
        )}

        <button
          onClick={() => createMutation.mutate()}
          disabled={!canCreate || createMutation.isPending}
          data-testid="ota-create-job-button"
          className="mt-4 rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {createMutation.isPending ? "Starting…" : "Start OTA job"}
        </button>
      </div>
    </Shell>
  );
}

import { apiFetch } from "./client";

export interface OtaJobSummary {
  id: number;
  target_mode: string;
  status: string;
  batch_size: number;
  created_at: string;
  completed_at: string | null;
  board_id: string;
  version: string;
  target_count: number;
  verified_count: number;
  failed_count: number;
  timed_out_count: number;
}

export interface OtaJobTarget {
  id: number;
  device_id: number;
  device_display_name: string;
  request_id: string;
  state: string;
  error_message: string | null;
  from_version: string | null;
  to_version: string | null;
  sent_at: string | null;
  last_update_at: string;
}

export interface OtaJobDetail {
  id: number;
  target_mode: string;
  status: string;
  batch_size: number;
  created_at: string;
  completed_at: string | null;
  firmware_version_id: number;
  board_id: string;
  version: string;
}

export function listOtaJobs(): Promise<{ jobs: OtaJobSummary[] }> {
  return apiFetch("/ota/jobs");
}

export function getOtaJob(id: number): Promise<{ job: OtaJobDetail; targets: OtaJobTarget[] }> {
  return apiFetch(`/ota/jobs/${id}`);
}

export interface OtaPreviewResult {
  targetCount: number;
  excludedBoardMismatch: number;
  excludedOffline: number;
  deviceIds: number[];
}

export function previewOtaTargets(input: {
  firmwareVersionId: number;
  targetMode: string;
  deviceIds?: number[];
}): Promise<OtaPreviewResult> {
  const params = new URLSearchParams({
    firmwareVersionId: String(input.firmwareVersionId),
    targetMode: input.targetMode,
  });
  if (input.deviceIds && input.deviceIds.length > 0) params.set("deviceIds", input.deviceIds.join(","));
  return apiFetch(`/ota/preview?${params.toString()}`);
}

export function createOtaJob(input: {
  firmwareVersionId: number;
  targetMode: string;
  deviceIds?: number[];
  batchSize?: number;
}): Promise<{
  otaJobId: number;
  targetCount: number;
  sentCount: number;
  excludedBoardMismatch: number;
  excludedOffline: number;
}> {
  return apiFetch("/ota/jobs", { method: "POST", body: JSON.stringify(input) });
}

export function cancelOtaJob(
  id: number,
): Promise<{ ok: boolean; cancelledPending: number; cancelSentToInFlight: number }> {
  return apiFetch(`/ota/jobs/${id}/cancel`, { method: "POST" });
}

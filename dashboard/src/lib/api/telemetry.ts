import { apiFetch } from "./client";
import type { Granularity } from "../../components/GranularityToggle";

export interface TelemetryHistoryPoint {
  bucket: string;
  value?: number;
  avg_value?: number;
  min_value?: number;
  max_value?: number;
}

export interface TelemetryHistory {
  granularity: Granularity;
  points: TelemetryHistoryPoint[];
}

export function getTelemetryHistory(
  deviceId: number,
  field: string,
  granularity: Granularity,
): Promise<TelemetryHistory> {
  return apiFetch(
    `/devices/${deviceId}/telemetry/history?field=${encodeURIComponent(field)}&granularity=${granularity}`,
  );
}

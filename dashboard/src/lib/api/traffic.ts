import { apiFetch } from "./client";
import type { Granularity } from "../../components/GranularityToggle";

export interface TrafficHistoryPoint {
  bucket: string;
  message_count: number;
  total_bytes: number;
}

export interface TrafficHistory {
  granularity: Granularity;
  points: TrafficHistoryPoint[];
}

export function getTrafficHistory(deviceId: number, granularity: Granularity): Promise<TrafficHistory> {
  return apiFetch(`/devices/${deviceId}/traffic/history?granularity=${granularity}`);
}

import { apiFetch } from "./client";

export interface Overview {
  deviceCount: number;
  messagesToday: number;
  totalStorageBytes: number;
  collectorStatus: "starting" | "connected" | "disconnected";
}

export function getOverview(): Promise<Overview> {
  return apiFetch("/stats/overview");
}

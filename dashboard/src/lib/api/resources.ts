import { apiFetch } from "./client";

export interface ResourceDisk {
  mount: string;
  usedBytes: number;
  totalBytes: number;
}

export interface ResourceHost {
  cpuPct: number;
  load1: number;
  memUsedBytes: number;
  memTotalBytes: number;
  disks: ResourceDisk[];
}

export interface ResourceContainer {
  name: string;
  cpuPct: number;
  memUsedBytes: number;
  memLimitBytes: number;
}

export interface LiveResources {
  ts: string;
  host: ResourceHost;
  containers: ResourceContainer[];
}

export function getLiveResources(): Promise<LiveResources> {
  return apiFetch("/resources/live");
}

export type ResourceGranularity = "day" | "week" | "month" | "year";

export interface ResourceHistoryPoint {
  target: string;
  bucket: string;
  cpu_pct?: number | null;
  avg_cpu_pct?: number | null;
  max_cpu_pct?: number | null;
  used_bytes?: number | null;
  avg_used_bytes?: number | null;
  max_used_bytes?: number | null;
  total_bytes: number | null;
}

export interface ResourceHistory {
  granularity: ResourceGranularity;
  points: ResourceHistoryPoint[];
}

export function getResourceHistory(granularity: ResourceGranularity): Promise<ResourceHistory> {
  return apiFetch(`/resources/history?granularity=${granularity}`);
}

export interface ResourceThresholds {
  id: number;
  host_ram_warn_pct: number;
  host_ram_critical_pct: number;
  host_cpu_warn_pct: number;
  host_cpu_critical_pct: number;
  host_disk_warn_pct: number;
  host_disk_critical_pct: number;
  container_mem_warn_pct: number;
  container_mem_critical_pct: number;
  updated_at: string;
}

export function getThresholds(): Promise<ResourceThresholds> {
  return apiFetch("/resources/thresholds");
}

export interface ThresholdsInput {
  hostRamWarnPct: number;
  hostRamCriticalPct: number;
  hostCpuWarnPct: number;
  hostCpuCriticalPct: number;
  hostDiskWarnPct: number;
  hostDiskCriticalPct: number;
  containerMemWarnPct: number;
  containerMemCriticalPct: number;
}

export function saveThresholds(input: ThresholdsInput): Promise<ResourceThresholds> {
  return apiFetch("/resources/thresholds", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

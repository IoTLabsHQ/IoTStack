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

export interface MqttStats {
  connected: boolean;
  messagesReceived: number | null;
  messagesSent: number | null;
  clientsConnected: number | null;
  clientsTotal: number | null;
  loadReceived1Min: number | null;
  loadSent1Min: number | null;
  uptimeSeconds: number | null;
}

export function getMqttStats(): Promise<MqttStats> {
  return apiFetch("/stats/mqtt");
}

export interface RecentMessage {
  id: number;
  device_id: number;
  device_name: string;
  topic: string;
  message_type: string;
  payload: string;
  payload_bytes: number;
  received_at: string;
}

export function getRecentMessages(limit?: number): Promise<{ messages: RecentMessage[] }> {
  return apiFetch(`/stats/recent-messages${limit ? `?limit=${limit}` : ""}`);
}

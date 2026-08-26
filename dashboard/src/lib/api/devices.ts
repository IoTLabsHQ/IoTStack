import { apiFetch } from "./client";

export interface Device {
  id: number;
  client_id: string;
  mqtt_username: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface Message {
  id: number;
  topic: string;
  message_type: string;
  payload: string;
  payload_bytes: number;
  received_at: string;
}

export interface CreatedDevice {
  device: { id: number; clientId: string; mqttUsername: string; displayName: string };
  password: string;
}

export function listDevices(): Promise<{ devices: Device[] }> {
  return apiFetch("/devices");
}

export function getDevice(id: number): Promise<{ device: Device }> {
  return apiFetch(`/devices/${id}`);
}

export function createDevice(displayName: string): Promise<CreatedDevice> {
  return apiFetch("/devices", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
}

export function regenerateDevice(id: number): Promise<{ clientId: string; password: string }> {
  return apiFetch(`/devices/${id}/regenerate`, { method: "POST" });
}

export function deleteDevice(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/devices/${id}`, { method: "DELETE" });
}

export function getDeviceMessages(id: number): Promise<{ messages: Message[] }> {
  return apiFetch(`/devices/${id}/messages`);
}

export function getDeviceStorage(id: number): Promise<{ bytes: number }> {
  return apiFetch(`/devices/${id}/storage`);
}

export function sendCommand(
  id: number,
  payload: { target: string; command: string; value?: unknown },
): Promise<{ ok: boolean }> {
  return apiFetch(`/devices/${id}/commands`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

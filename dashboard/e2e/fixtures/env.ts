/**
 * Real backend setup helpers for e2e specs — no mocking. Creates a real
 * device via the real API (a "controlled backend setup," per the e2e-tdd
 * skill's Real E2E boundaries — not the thing under test here, just
 * deterministic seed data), and can publish a real MQTT message to it.
 * Mirrors api/tests/setup.ts's conventions.
 */
import mqtt, { MqttClient } from "mqtt";

process.loadEnvFile(new URL("../../../.env", import.meta.url));

export const API_BASE_URL = "http://localhost/api";
export const MQTT_URL = "mqtt://localhost:1883";

export async function loginAdminToken(): Promise<string> {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`admin login failed: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

export interface SeedDevice {
  id: number;
  clientId: string;
  password: string;
}

export async function createSeedDevice(token: string, displayName: string): Promise<SeedDevice> {
  const res = await fetch(`${API_BASE_URL}/devices`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) throw new Error(`device create failed: ${res.status} ${await res.text()}`);
  const { device, password } = (await res.json()) as {
    device: { id: number; clientId: string };
    password: string;
  };
  return { id: device.id, clientId: device.clientId, password };
}

export async function deleteSeedDevice(token: string, id: number): Promise<void> {
  await fetch(`${API_BASE_URL}/devices/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}

/** OTA job creation requires a real domain configured (same precondition as
 * generated device firmware needing MQTTS) — ensures one is set so OTA e2e
 * specs work against a freshly-provisioned stack (e.g. in CI), not just a
 * dev instance a human already configured by hand. */
export async function ensureDomainConfigured(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/settings`, { headers: { authorization: `Bearer ${token}` } });
  const { domain } = (await res.json()) as { domain: string };
  if (domain) return;
  await fetch(`${API_BASE_URL}/settings/domain`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ domain: "e2e-test.local" }),
  });
}

export async function setDeviceBoard(token: string, deviceId: number, boardId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/board`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ boardId }),
  });
  if (!res.ok) throw new Error(`device board set failed: ${res.status} ${await res.text()}`);
}

export async function uploadSeedFirmware(
  token: string,
  input: { boardId: string; version: string; content: string },
): Promise<{ id: number }> {
  const form = new FormData();
  form.append("boardId", input.boardId);
  form.append("version", input.version);
  form.append("firmware", new Blob([input.content]), "test.bin");
  const res = await fetch(`${API_BASE_URL}/firmware`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`firmware upload failed: ${res.status} ${await res.text()}`);
  const { firmwareVersion } = (await res.json()) as { firmwareVersion: { id: number } };
  return { id: firmwareVersion.id };
}

export async function deleteFirmwareVersionsForBoard(token: string, boardId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/firmware?board_id=${boardId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { firmwareVersions } = (await res.json()) as { firmwareVersions: { id: number }[] };
  for (const fw of firmwareVersions) {
    await fetch(`${API_BASE_URL}/firmware/${fw.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
  }
}

async function publishRealDeviceMessage(
  device: SeedDevice,
  messageType: "event" | "status",
  payload: unknown,
): Promise<void> {
  const client: MqttClient = mqtt.connect(MQTT_URL, {
    username: device.clientId,
    password: device.password,
    clientId: device.clientId,
    reconnectPeriod: 0,
    connectTimeout: 5000,
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("error", reject);
  });
  await new Promise<void>((resolve, reject) => {
    client.publish(
      `devices/${device.clientId}/${messageType}`,
      JSON.stringify(payload),
      { qos: 1 },
      (err) => (err ? reject(err) : resolve()),
    );
  });
  await new Promise((r) => setTimeout(r, 500));
  client.end();
}

export async function publishRealEvent(device: SeedDevice, payload: unknown): Promise<void> {
  await publishRealDeviceMessage(device, "event", payload);
}

export async function publishRealStatus(device: SeedDevice, payload: unknown): Promise<void> {
  await publishRealDeviceMessage(device, "status", payload);
}

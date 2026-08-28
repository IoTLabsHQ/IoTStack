/**
 * Real e2e test helpers — no mocks. Tests run against the actual
 * docker-compose stack (real Mosquitto broker + real api behind Caddy).
 * Reads the same `.env` the stack was booted with, one directory above the
 * repo's `api/` folder.
 *
 *   docker compose up -d --build   (from repo root)
 *   npm test                        (from api/)
 */
import mqtt, { MqttClient } from "mqtt";

process.loadEnvFile(new URL("../../.env", import.meta.url));

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost/api";
export const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";

interface ApiFetchOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function loginAdmin(): Promise<string> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD not set — is .env loaded and the stack booted with it?");
  }
  const res = await apiFetch("/auth/login", { method: "POST", body: { email, password } });
  if (!res.ok) throw new Error(`admin login failed: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

export interface TestDevice {
  id: number;
  clientId: string;
  password: string;
}

export async function createTestDevice(token: string, displayName: string): Promise<TestDevice> {
  const res = await apiFetch("/devices", { method: "POST", token, body: { displayName } });
  if (!res.ok) throw new Error(`device create failed: ${res.status} ${await res.text()}`);
  const { device, password } = (await res.json()) as {
    device: { id: number; clientId: string };
    password: string;
  };
  return { id: device.id, clientId: device.clientId, password };
}

export async function deleteTestDevice(token: string, id: number): Promise<void> {
  await apiFetch(`/devices/${id}`, { method: "DELETE", token });
}

export interface MqttConnectOptions {
  username: string;
  password: string;
  /** Device credentials are locked server-side to connect with an MQTT
   * clientId equal to their username (dynsec-client.ts sets `clientid` on
   * createClient — a real Mosquitto anti-spoofing check, confirmed against
   * the real broker: a mismatched clientId gets CONNACK 5 "not authorised"
   * even with the right password). Defaults to `username` to match that.
   * Override only for unlocked (non-device) principals, and then use a
   * fresh id — never reuse a long-lived clientId the running api/collector
   * containers hold open (e.g. "iotstack-collector"), or the broker
   * session-conflicts them. */
  clientId?: string;
}

export function connectMqttClient(opts: MqttConnectOptions): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      username: opts.username,
      password: opts.password,
      clientId: opts.clientId ?? opts.username,
      reconnectPeriod: 0,
      connectTimeout: 5000,
    });
    const onError = (err: Error) => {
      client.end(true);
      reject(err);
    };
    client.once("connect", () => {
      client.removeListener("error", onError);
      resolve(client);
    });
    client.once("error", onError);
  });
}

export interface SubscribeResult {
  granted: boolean;
}

/** SUBACK carries a real per-topic grant/reject code in MQTT 3.1.1 (qos 128
 * = rejected) — reliable to assert on directly, unlike PUBLISH denial below. */
export function subscribeAndCheckGrant(client: MqttClient, topic: string): Promise<SubscribeResult> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, (err, granted) => {
      if (err) {
        // mqtt.js surfaces a fully-rejected SUBACK (reason code 128, "not
        // authorized") as an ErrorWithSubackPacket rather than populating
        // `granted` — confirmed against the real broker, not assumed. Any
        // other error (connection-level, etc.) is a real test failure.
        if (err.name === "ErrorWithSubackPacket") {
          resolve({ granted: false });
          return;
        }
        reject(err);
        return;
      }
      const grant = granted?.find((g) => g.topic === topic);
      resolve({ granted: !!grant && grant.qos !== 128 });
    });
  });
}

/**
 * MQTT 3.1.1 PUBACK carries no reason code — a denied publish is just
 * silently dropped by the broker, the publisher's own callback fires as if
 * it succeeded. The reliable way to prove a publish was denied is to have
 * an already-subscribed *observer* (holding real permission on the topic)
 * watch for the message and confirm it never arrives within a timeout.
 */
export function publishThenObserve(
  publisher: MqttClient,
  observer: MqttClient,
  topic: string,
  payload: string,
  timeoutMs = 1500,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onMessage = (msgTopic: string, msgPayload: Buffer) => {
      if (msgTopic === topic && msgPayload.toString("utf-8") === payload && !settled) {
        settled = true;
        observer.removeListener("message", onMessage);
        clearTimeout(timer);
        resolve(true);
      }
    };
    observer.on("message", onMessage);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      observer.removeListener("message", onMessage);
      resolve(false);
    }, timeoutMs);

    publisher.publish(topic, payload, { qos: 1 }, (err) => {
      if (err && !settled) {
        settled = true;
        observer.removeListener("message", onMessage);
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

export function closeClient(client: MqttClient): Promise<void> {
  return new Promise((resolve) => client.end(false, {}, () => resolve()));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

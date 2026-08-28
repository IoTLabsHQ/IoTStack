/**
 * Talks to Mosquitto's Dynamic Security plugin over its $CONTROL/dynamic-security/v1
 * MQTT topic API — no reload/SIGHUP needed, changes take effect immediately.
 *
 * Design note: the plugin's own docs describe %c/%u pattern substitution in
 * role ACLs (e.g. "devices/%c/#" expanding per-client), which would let one
 * shared role cover every device. Verified directly against a real broker
 * (mosquitto:2.0.22, the pinned image here) that %c/%u substitution does not
 * actually apply for subscribePattern — a client with a %c-based rule gets
 * its subscribe denied outright. A plain literal wildcard ACL computed here
 * in application code (e.g. "devices/dev_abc123/#", the real client id
 * substituted server-side, not the %c macro) works correctly and was
 * confirmed with a real pub/sub round-trip plus a cross-device isolation
 * check. So: one role PER DEVICE, not one shared parametrized role.
 */
import { randomBytes } from "crypto";
import mqtt, { MqttClient } from "mqtt";
import { config } from "./config";
import { logger } from "./logger";
import { MQTT_TOPIC, DEVICE_MESSAGE_TYPES } from "./mqtt-topics";

const CONTROL_TOPIC = "$CONTROL/dynamic-security/v1";
const RESPONSE_TOPIC = "$CONTROL/dynamic-security/v1/response";
const COMMAND_TIMEOUT_MS = 5000;

interface DynsecResponse {
  command: string;
  data?: unknown;
  error?: string;
  correlationData?: string;
}

interface PendingCommand {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

let client: MqttClient | null = null;
const pending = new Map<string, PendingCommand>();

function handleMessage(topic: string, payload: Buffer): void {
  if (topic !== RESPONSE_TOPIC) return;

  let parsed: { responses?: DynsecResponse[] };
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch {
    return;
  }

  for (const response of parsed.responses ?? []) {
    const id = response.correlationData;
    if (!id) continue;
    const waiter = pending.get(id);
    if (!waiter) continue;

    pending.delete(id);
    clearTimeout(waiter.timer);
    if (response.error) {
      waiter.reject(new Error(response.error));
    } else {
      waiter.resolve(response.data);
    }
  }
}

export function connectDynsec(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `mqtt://${config.mosquitto.host}:${config.mosquitto.port}`;
    const c = mqtt.connect(url, {
      username: config.dynsec.controllerUsername,
      password: config.dynsec.controllerPassword,
      clientId: config.dynsec.controllerUsername,
      reconnectPeriod: 2000,
    });

    c.once("connect", () => {
      c.subscribe(RESPONSE_TOPIC, (err) => {
        if (err) {
          reject(err);
          return;
        }
        client = c;
        logger.info("dynsec controller connected");
        resolve();
      });
    });

    c.on("message", handleMessage);
    c.on("error", (err) => logger.error("dynsec controller connection error:", err));
    c.once("error", reject);
  });
}

function sendCommand(command: Record<string, unknown>): Promise<unknown> {
  if (!client) {
    return Promise.reject(new Error("dynsec controller not connected"));
  }

  const correlationData = randomBytes(8).toString("hex");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(correlationData);
      reject(new Error(`dynsec command timed out: ${command.command}`));
    }, COMMAND_TIMEOUT_MS);

    pending.set(correlationData, { resolve, reject, timer });
    client!.publish(
      CONTROL_TOPIC,
      JSON.stringify({ commands: [{ ...command, correlationData }] }),
    );
  });
}

/** Ignores "already exists" style errors — the caller is being idempotent. */
async function sendIgnoringConflict(command: Record<string, unknown>): Promise<void> {
  try {
    await sendCommand(command);
  } catch (err) {
    if (err instanceof Error && /already exists/i.test(err.message)) return;
    throw err;
  }
}

/** Ignores "not found" style errors — the caller is removing something that
 * may already be gone (e.g. re-running the ACL migration script). */
async function sendIgnoringMissing(command: Record<string, unknown>): Promise<void> {
  try {
    await sendCommand(command);
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) return;
    throw err;
  }
}

function roleNameFor(clientId: string): string {
  return `role_${clientId}`;
}

/**
 * Grants a device role its narrow, per-topic ACL (PRD §16-18): publish
 * rights on exactly its own telemetry/status/event/ping topics, and
 * subscribe+receive rights on exactly its own cmd topic — never a single
 * `devices/{clientId}/#` wildcard covering both directions, which would let
 * a device publish fake server commands to itself or eavesdrop on its own
 * sensor/state topics it has no reason to read back.
 */
async function grantDeviceRoleAcl(rolename: string, clientId: string): Promise<void> {
  for (const type of DEVICE_MESSAGE_TYPES) {
    await sendIgnoringConflict({
      command: "addRoleACL",
      rolename,
      acltype: "publishClientSend",
      topic: MQTT_TOPIC[type](clientId),
      allow: true,
    });
  }
  const cmdTopic = MQTT_TOPIC.cmd(clientId);
  await sendIgnoringConflict({
    command: "addRoleACL",
    rolename,
    acltype: "subscribeLiteral",
    topic: cmdTopic,
    allow: true,
  });
  await sendIgnoringConflict({
    command: "addRoleACL",
    rolename,
    acltype: "publishClientReceive",
    topic: cmdTopic,
    allow: true,
  });
}

/**
 * Revokes the old-style combined wildcard ACL (publishClientSend +
 * subscribePattern on the whole `devices/{clientId}/#` subtree) a device
 * role got under pre-migration code — idempotent, safe to call on a role
 * that was already narrowed or never had the wildcard at all.
 */
async function revokeLegacyWildcardAcl(rolename: string, clientId: string): Promise<void> {
  const topicWildcard = `devices/${clientId}/#`;
  await sendIgnoringMissing({
    command: "removeRoleACL",
    rolename,
    acltype: "publishClientSend",
    topic: topicWildcard,
  });
  await sendIgnoringMissing({
    command: "removeRoleACL",
    rolename,
    acltype: "subscribePattern",
    topic: topicWildcard,
  });
}

/**
 * Re-applies the current (narrow, per-topic) ACL to an already-provisioned
 * device — revokes the legacy wildcard grant if present, then grants the
 * current one. Idempotent: safe to run repeatedly across every device in
 * the DB, e.g. after upgrading a deployment that provisioned devices under
 * older code. Does not touch the device's client/password — credential
 * unchanged, only the role's ACL entries.
 */
export async function migrateDeviceAcl(clientId: string): Promise<void> {
  const rolename = roleNameFor(clientId);
  await revokeLegacyWildcardAcl(rolename, clientId);
  await grantDeviceRoleAcl(rolename, clientId);
}

/** Creates a device's dedicated role + client with an isolated topic ACL,
 * live — no restart, no reload. */
export async function createDeviceCredential(clientId: string, password: string): Promise<void> {
  const rolename = roleNameFor(clientId);

  await sendIgnoringConflict({ command: "createRole", rolename });
  await grantDeviceRoleAcl(rolename, clientId);
  await sendCommand({
    command: "createClient",
    username: clientId,
    password,
    clientid: clientId,
    roles: [{ rolename }],
  });
}

export async function regenerateDeviceCredential(
  clientId: string,
  password: string,
): Promise<void> {
  await sendCommand({ command: "setClientPassword", username: clientId, password });
}

export async function deleteDeviceCredential(clientId: string): Promise<void> {
  await sendIgnoringConflict({ command: "deleteClient", username: clientId });
  await sendIgnoringConflict({ command: "deleteRole", rolename: roleNameFor(clientId) });
}

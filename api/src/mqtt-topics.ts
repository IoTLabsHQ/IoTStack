/**
 * Single source of truth for MQTT topic strings and the closed sets of
 * values that ride on them — per the MQTT Topic & ACL Specification.
 */

export const MQTT_TOPIC = {
  telemetry: (clientId: string) => `devices/${clientId}/telemetry`,
  status: (clientId: string) => `devices/${clientId}/status`,
  event: (clientId: string) => `devices/${clientId}/event`,
  ping: (clientId: string) => `devices/${clientId}/ping`,
  cmd: (clientId: string) => `devices/${clientId}/cmd`,
};

/** Device → server. Collector subscribes exactly these, never `devices/#`. */
export const COLLECTOR_TOPICS = [
  "devices/+/telemetry",
  "devices/+/status",
  "devices/+/event",
  "devices/+/ping",
];

/** `cmd` is deliberately excluded — it's server → device, not an inbound
 * message type the collector should ever persist or count as a heartbeat. */
export const DEVICE_MESSAGE_TYPES = ["telemetry", "status", "event", "ping"] as const;
export type DeviceMessageType = (typeof DEVICE_MESSAGE_TYPES)[number];

export const DEVICE_COMMANDS = [
  "set",
  "status.request",
  "config.update",
  "restart",
  "ping",
] as const;
export type DeviceCommand = (typeof DEVICE_COMMANDS)[number];

import type { Message } from "./api/devices";
import type { Control } from "./api/control";
import { getByPath } from "./message-shapes";

export interface ControlValue {
  current: number | boolean | string | null;
  min: number | null;
  max: number | null;
  /** `received_at` of the message `current` came from — event controls use
   * this for a relative-time display; unset for sensor-numeric/toggle. */
  asOf: string | null;
}

const EMPTY: ControlValue = { current: null, min: null, max: null, asOf: null };

/**
 * Reads a control's current/min/max from the device's recent message
 * feed. `binding.field` may be a dot-path (`gps.lat`) into a nested
 * payload — resolved via getByPath. Status payloads carry a `target`;
 * event payloads carry a `type`. Malformed payloads are skipped, not thrown.
 */
export function extractCurrentValue(control: Control, messages: Message[]): ControlValue {
  if (control.type === "sensor-numeric") {
    const values: number[] = [];
    for (const m of messages) {
      if (m.message_type !== "telemetry") continue;
      try {
        const payload = JSON.parse(m.payload);
        const value = getByPath(payload, control.binding.field);
        if (typeof value === "number") values.push(value);
      } catch {
        // skip malformed payload
      }
    }
    if (values.length === 0) return EMPTY;
    return {
      current: values[0],
      min: Math.min(...values),
      max: Math.max(...values),
      asOf: null,
    };
  }

  if (control.type === "event") {
    for (const m of messages) {
      if (m.message_type !== "event") continue;
      try {
        const payload = JSON.parse(m.payload);
        const type = payload.type;
        if (typeof type !== "string") continue;
        if (control.binding.eventType && type !== control.binding.eventType) continue;
        return { current: type, min: null, max: null, asOf: m.received_at };
      } catch {
        // skip malformed payload
      }
    }
    return EMPTY;
  }

  for (const m of messages) {
    if (m.message_type !== "status") continue;
    try {
      const payload = JSON.parse(m.payload);
      if (payload.target !== control.binding.target) continue;
      const value = getByPath(payload, control.binding.field);
      if (typeof value === "boolean") return { current: value, min: null, max: null, asOf: null };
    } catch {
      // skip malformed payload
    }
  }
  return EMPTY;
}

export interface DeviceInfo {
  firmwareVersion: string | null;
  wifiRssi: number | null;
  asOf: string | null;
}

/**
 * Reads firmware_version/wifi_rssi from the newest message that carries
 * them — the generated firmware merges both into every ping and status
 * payload, but older/hand-written firmware may send neither.
 */
export function extractDeviceInfo(messages: Message[]): DeviceInfo {
  for (const m of messages) {
    try {
      const payload = JSON.parse(m.payload);
      if (typeof payload !== "object" || payload === null) continue;
      const firmwareVersion = typeof payload.firmware_version === "string" ? payload.firmware_version : null;
      const wifiRssi = typeof payload.wifi_rssi === "number" ? payload.wifi_rssi : null;
      if (firmwareVersion !== null || wifiRssi !== null) {
        return { firmwareVersion, wifiRssi, asOf: m.received_at };
      }
    } catch {
      // skip malformed payload
    }
  }
  return { firmwareVersion: null, wifiRssi: null, asOf: null };
}

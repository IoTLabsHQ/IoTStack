import type { Message } from "./api/devices";
import type { Control } from "./api/control";

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
 * feed. Telemetry payloads are flat and keyed by field name; status
 * payloads carry a `target`; event payloads carry a `type`. Malformed
 * payloads are skipped, not thrown.
 */
export function extractCurrentValue(control: Control, messages: Message[]): ControlValue {
  if (control.type === "sensor-numeric") {
    const values: number[] = [];
    for (const m of messages) {
      if (m.message_type !== "telemetry") continue;
      try {
        const payload = JSON.parse(m.payload);
        const value = payload[control.binding.field];
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
      const value = payload[control.binding.field];
      if (typeof value === "boolean") return { current: value, min: null, max: null, asOf: null };
    } catch {
      // skip malformed payload
    }
  }
  return EMPTY;
}

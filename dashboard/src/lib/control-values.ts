import type { Message } from "./api/devices";
import type { Control } from "./api/control";

export interface ControlValue {
  current: number | boolean | null;
  min: number | null;
  max: number | null;
}

const EMPTY: ControlValue = { current: null, min: null, max: null };

/**
 * Reads a control's current/min/max from the device's recent message
 * feed. Telemetry payloads are flat and keyed by field name; status
 * payloads carry a `target`. Malformed payloads are skipped, not thrown.
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
    };
  }

  for (const m of messages) {
    if (m.message_type !== "status") continue;
    try {
      const payload = JSON.parse(m.payload);
      if (payload.target !== control.binding.target) continue;
      const value = payload[control.binding.field];
      if (typeof value === "boolean") return { current: value, min: null, max: null };
    } catch {
      // skip malformed payload
    }
  }
  return EMPTY;
}

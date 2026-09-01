/**
 * Per-device Control Panel config, stored as JSON in devices.dashboard.
 *
 * A control's binding shape depends on its type because the real sample
 * firmware (dashboard/src/lib/arduino/generate.ts) publishes two distinct
 * payload shapes: telemetry is flat and keyed by field name (no `target`),
 * status messages carry a `target`. matchingWidgets is deliberately not
 * persisted — see denormalizeControls below.
 */
import { randomUUID } from "crypto";
import { ValidationError, requireString, optionalString } from "./validation";

export type ControlType = "sensor-numeric" | "toggle" | "event";
export type WidgetType = "label-value" | "min-max-current" | "toggle-switch" | "latest-event" | "history-chart";

export interface BaseControl {
  id: string;
  label: string;
  type: ControlType;
  widget: WidgetType;
}
export interface SensorNumericControl extends BaseControl {
  type: "sensor-numeric";
  binding: { source: "telemetry"; field: string };
}
export interface ToggleControl extends BaseControl {
  type: "toggle";
  binding: { source: "status"; target: string; field: string };
}
export interface EventControl extends BaseControl {
  type: "event";
  /** Unset eventType shows the latest event of any type; set it to filter
   * to one (e.g. "door.opened"). */
  binding: { source: "event"; eventType?: string };
}
export type Control = SensorNumericControl | ToggleControl | EventControl;

export interface DashboardConfig {
  version: 1;
  controls: Control[];
}

export const CONTROL_TYPE_WIDGETS: Record<ControlType, WidgetType[]> = {
  "sensor-numeric": ["label-value", "min-max-current", "history-chart"],
  toggle: ["toggle-switch", "label-value"],
  event: ["latest-event"],
};

const EMPTY_CONFIG: DashboardConfig = { version: 1, controls: [] };

export function parseDashboardConfig(raw: string | null): DashboardConfig {
  if (!raw) return EMPTY_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.controls)) return EMPTY_CONFIG;
    return parsed as DashboardConfig;
  } catch {
    return EMPTY_CONFIG;
  }
}

function validateControl(input: unknown, index: number): Control {
  if (typeof input !== "object" || input === null) {
    throw new ValidationError(`controls[${index}] must be an object`);
  }
  const raw = input as Record<string, unknown>;

  const id = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : randomUUID();
  const label = requireString(raw.label, `controls[${index}].label`);

  if (raw.type !== "sensor-numeric" && raw.type !== "toggle" && raw.type !== "event") {
    throw new ValidationError(`controls[${index}].type must be "sensor-numeric", "toggle", or "event"`);
  }
  const type = raw.type;

  const widget = requireString(raw.widget, `controls[${index}].widget`) as WidgetType;
  if (!CONTROL_TYPE_WIDGETS[type].includes(widget)) {
    throw new ValidationError(
      `controls[${index}].widget "${widget}" is not valid for type "${type}" (must be one of: ${CONTROL_TYPE_WIDGETS[type].join(", ")})`,
    );
  }

  const binding = raw.binding as Record<string, unknown> | undefined;
  if (typeof binding !== "object" || binding === null) {
    throw new ValidationError(`controls[${index}].binding must be an object`);
  }

  if (type === "sensor-numeric") {
    const field = requireString(binding.field, `controls[${index}].binding.field`);
    return { id, label, type, widget, binding: { source: "telemetry", field } };
  }

  if (type === "event") {
    const eventType = optionalString(binding.eventType, `controls[${index}].binding.eventType`);
    return { id, label, type, widget, binding: { source: "event", eventType } };
  }

  const target = requireString(binding.target, `controls[${index}].binding.target`);
  const field = requireString(binding.field, `controls[${index}].binding.field`);
  return { id, label, type, widget, binding: { source: "status", target, field } };
}

export function validateAndNormalizeControls(input: unknown): Control[] {
  if (!Array.isArray(input)) {
    throw new ValidationError("controls must be an array");
  }
  return input.map((item, index) => validateControl(item, index));
}

export function denormalizeControls(
  controls: Control[],
): (Control & { matchingWidgets: WidgetType[] })[] {
  return controls.map((control) => ({
    ...control,
    matchingWidgets: CONTROL_TYPE_WIDGETS[control.type],
  }));
}

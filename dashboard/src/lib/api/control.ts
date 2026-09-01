import { apiFetch } from "./client";

export type ControlType = "sensor-numeric" | "toggle" | "event";
export type WidgetType = "label-value" | "min-max-current" | "toggle-switch" | "latest-event" | "history-chart";

interface BaseControl {
  id: string;
  label: string;
  type: ControlType;
  widget: WidgetType;
  matchingWidgets: WidgetType[];
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
  binding: { source: "event"; eventType?: string };
}
export type Control = SensorNumericControl | ToggleControl | EventControl;

export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  "sensor-numeric": "Sensor value",
  toggle: "Toggle (relay/switch)",
  event: "Latest event",
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  "label-value": "Label + value",
  "min-max-current": "Min / max / current",
  "toggle-switch": "Toggle switch",
  "latest-event": "Latest event",
  "history-chart": "History chart",
};

/** Non-binding default for pre-filling the add-control form; server re-validates on save. */
export const DEFAULT_WIDGET_FOR_TYPE: Record<ControlType, WidgetType> = {
  "sensor-numeric": "label-value",
  toggle: "toggle-switch",
  event: "latest-event",
};

export function saveDashboard(deviceId: number, controls: Control[]): Promise<{ dashboard: Control[] }> {
  return apiFetch(`/devices/${deviceId}/dashboard`, {
    method: "PUT",
    body: JSON.stringify({ controls }),
  });
}

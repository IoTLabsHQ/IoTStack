import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ControlWidget } from "../components/widgets/ControlWidget";
import { DeviceOnlineStatus } from "../components/DeviceOnlineStatus";
import { getDevice, getDeviceMessages, sendCommand } from "../lib/api/devices";
import {
  CONTROL_TYPE_LABELS,
  DEFAULT_WIDGET_FOR_TYPE,
  WIDGET_LABELS,
  saveDashboard,
  type Control,
  type ControlType,
  type WidgetType,
} from "../lib/api/control";
import { ApiError } from "../lib/api/client";

function randomId(): string {
  return crypto.randomUUID();
}

function blankControl(type: ControlType): Control {
  const widget = DEFAULT_WIDGET_FOR_TYPE[type];
  if (type === "sensor-numeric") {
    return {
      id: randomId(),
      label: "",
      type,
      widget,
      matchingWidgets: ["label-value", "min-max-current"],
      binding: { source: "telemetry", field: "" },
    };
  }
  if (type === "event") {
    return {
      id: randomId(),
      label: "",
      type,
      widget,
      matchingWidgets: ["latest-event"],
      binding: { source: "event", eventType: undefined },
    };
  }
  return {
    id: randomId(),
    label: "",
    type,
    widget,
    matchingWidgets: ["toggle-switch"],
    binding: { source: "status", target: "", field: "state" },
  };
}

export function ControlDetailPage() {
  const { id } = useParams();
  const deviceId = Number(id);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Control[]>([]);
  const [newType, setNewType] = useState<ControlType>("sensor-numeric");
  const [newLabel, setNewLabel] = useState("");
  const [newField, setNewField] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newEventType, setNewEventType] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const deviceQuery = useQuery({
    queryKey: ["device", deviceId],
    queryFn: () => getDevice(deviceId),
  });
  const messagesQuery = useQuery({
    queryKey: ["device-messages", deviceId],
    queryFn: () => getDeviceMessages(deviceId, 200),
    refetchInterval: 5_000,
  });

  const saveMutation = useMutation({
    mutationFn: (controls: Control[]) => saveDashboard(deviceId, controls),
    onSuccess: () => {
      setSaveError(null);
      setSaveSuccess(true);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["device", deviceId] });
    },
    onError: (err: unknown) => {
      setSaveSuccess(false);
      setSaveError(err instanceof ApiError ? err.message : "Failed to save controls");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { target: string; value: boolean }) =>
      sendCommand(deviceId, { target: input.target, command: "set", value: input.value }),
    onSettled: () => setTogglingId(null),
  });

  if (deviceQuery.isLoading || !deviceQuery.data) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Loading…</p>
      </Shell>
    );
  }

  const device = deviceQuery.data.device;
  const messages = messagesQuery.data?.messages ?? [];
  const controls = editing ? draft : device.dashboard;

  function startEdit() {
    setDraft(device.dashboard);
    setSaveError(null);
    setSaveSuccess(false);
    setEditing(true);
  }

  function moveControl(index: number, dir: -1 | 1) {
    const next = [...draft];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  }

  function removeControl(index: number) {
    setDraft(draft.filter((_, i) => i !== index));
  }

  function setWidget(index: number, widget: WidgetType) {
    setDraft(draft.map((c, i) => (i === index ? { ...c, widget } : c)));
  }

  function addControl() {
    if (!newLabel.trim()) return;
    const control = blankControl(newType);
    control.label = newLabel.trim();
    if (control.type === "sensor-numeric") {
      control.binding = { source: "telemetry", field: newField.trim() };
    } else if (control.type === "event") {
      control.binding = { source: "event", eventType: newEventType.trim() || undefined };
    } else {
      control.binding = { source: "status", target: newTarget.trim(), field: "state" };
    }
    setDraft([...draft, control]);
    setNewLabel("");
    setNewField("");
    setNewTarget("");
    setNewEventType("");
  }

  return (
    <Shell>
      <Link to="/control" className="mb-3 inline-block text-sm text-slate-500 hover:underline">
        &larr; Control
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{device.display_name}</h1>
          <div className="mt-1">
            <DeviceOnlineStatus lastSeenAt={device.last_seen_at} />
          </div>
        </div>
        {editing ? (
          <button
            data-testid="control-save-button"
            onClick={() => saveMutation.mutate(draft)}
            disabled={saveMutation.isPending}
            className="rounded-md bg-primary-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Done"}
          </button>
        ) : (
          <button
            data-testid="control-edit-button"
            onClick={startEdit}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
          >
            Edit
          </button>
        )}
      </div>

      {saveError && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}
      {saveSuccess && (
        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-800">Controls saved.</p>
        </div>
      )}

      {controls.length === 0 && !editing && (
        <p className="mb-6 text-sm text-slate-500">
          No controls yet — click Edit to add one.
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {controls.map((control, index) => (
          <div key={control.id} className="relative">
            {editing && (
              <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button
                  onClick={() => moveControl(index, -1)}
                  disabled={index === 0}
                  className="rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-500 disabled:opacity-30"
                >
                  &uarr;
                </button>
                <button
                  onClick={() => moveControl(index, 1)}
                  disabled={index === controls.length - 1}
                  className="rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-500 disabled:opacity-30"
                >
                  &darr;
                </button>
                <button
                  onClick={() => removeControl(index)}
                  className="rounded border border-red-200 bg-white px-1.5 text-[11px] text-red-600"
                >
                  Remove
                </button>
              </div>
            )}
            {editing ? (
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">{control.label || "(untitled)"}</p>
                <p className="mt-1 text-xs text-slate-400">{CONTROL_TYPE_LABELS[control.type]}</p>
                {control.matchingWidgets.length > 1 ? (
                  <select
                    value={control.widget}
                    onChange={(e) => setWidget(index, e.target.value as WidgetType)}
                    className="mt-3 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    {control.matchingWidgets.map((w) => (
                      <option key={w} value={w}>
                        {WIDGET_LABELS[w]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">{WIDGET_LABELS[control.widget]}</p>
                )}
              </div>
            ) : (
              <ControlWidget
                control={control}
                messages={messages}
                toggling={togglingId === control.id}
                onToggle={(c, next) => {
                  setTogglingId(c.id);
                  toggleMutation.mutate({ target: c.binding.target, value: next });
                }}
              />
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-900">+ Add control</p>
          <p className="mb-3 text-xs text-slate-500">
            IoTStack doesn't know what fields your device publishes — type the exact JSON key
            name, case-sensitive.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Label</label>
              <input
                data-testid="control-label-input"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Living room temp"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Type</label>
              <select
                data-testid="control-type-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as ControlType)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {(Object.keys(CONTROL_TYPE_LABELS) as ControlType[]).map((t) => (
                  <option key={t} value={t}>
                    {CONTROL_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            {newType === "sensor-numeric" ? (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Telemetry field name</label>
                <input
                  value={newField}
                  onChange={(e) => setNewField(e.target.value)}
                  placeholder="e.g. temperature_c"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            ) : newType === "event" ? (
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  Event type filter (optional)
                </label>
                <input
                  data-testid="control-event-type-input"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  placeholder="e.g. door.opened — blank shows any"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Status target</label>
                <input
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="e.g. relay_1"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
          <button
            data-testid="control-add-button"
            onClick={addControl}
            disabled={
              !newLabel.trim() ||
              (newType === "sensor-numeric"
                ? !newField.trim()
                : newType === "toggle"
                  ? !newTarget.trim()
                  : false)
            }
            className="mt-3 rounded-md bg-primary-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </Shell>
  );
}

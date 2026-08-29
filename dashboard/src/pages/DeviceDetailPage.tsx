import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import {
  deleteDevice,
  getDevice,
  getDeviceMessages,
  getDeviceStorage,
  regenerateDevice,
  sendCommand,
} from "../lib/api/devices";
import { CredentialActions } from "../components/CredentialActions";
import { ArduinoCodeSection } from "../components/ArduinoCodeSection";
import { DeviceInfoLine } from "../components/DeviceInfoLine";

const COMMANDS = ["ping", "set", "status.request", "config.update", "restart"] as const;

export function DeviceDetailPage() {
  const { id } = useParams();
  const deviceId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [regenerated, setRegenerated] = useState<string | null>(null);
  const [cmdTarget, setCmdTarget] = useState("");
  const [cmdCommand, setCmdCommand] = useState<(typeof COMMANDS)[number]>("ping");
  const [cmdValue, setCmdValue] = useState("");
  const [cmdResult, setCmdResult] = useState<string | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const deviceQuery = useQuery({
    queryKey: ["device", deviceId],
    queryFn: () => getDevice(deviceId),
  });
  const messagesQuery = useQuery({
    queryKey: ["device-messages", deviceId],
    queryFn: () => getDeviceMessages(deviceId),
    refetchInterval: 5_000,
  });
  const storageQuery = useQuery({
    queryKey: ["device-storage", deviceId],
    queryFn: () => getDeviceStorage(deviceId),
    refetchInterval: 5_000,
  });

  // Messages are sorted newest-first, so the latest arrival is always at
  // the top — keep it in view by scrolling back there whenever new ones
  // come in via the 5s poll above.
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = 0;
    }
  }, [messagesQuery.data?.messages]);

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateDevice(deviceId),
    onSuccess: (res) => setRegenerated(res.password),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      navigate("/devices", { replace: true });
    },
  });

  const commandMutation = useMutation({
    mutationFn: () =>
      sendCommand(deviceId, {
        target: cmdTarget,
        command: cmdCommand,
        value: cmdCommand === "set" ? parseValue(cmdValue) : undefined,
      }),
    onSuccess: () => setCmdResult("Command sent."),
    onError: () => setCmdResult("Failed to send command."),
  });

  if (deviceQuery.isLoading || !deviceQuery.data) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Loading…</p>
      </Shell>
    );
  }

  const device = deviceQuery.data.device;

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{device.display_name}</h1>
          <DeviceInfoLine messages={messagesQuery.data?.messages ?? []} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            Regenerate credential
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${device.display_name}"? This can't be undone.`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {regenerated && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-semibold text-amber-900">
            New password — save it now, it won't be shown again:
          </p>
          <p className="font-mono text-sm text-amber-950">{regenerated}</p>
          <div className="mt-3">
            <CredentialActions
              credential={{
                displayName: device.display_name,
                clientId: device.client_id,
                mqttUsername: device.mqtt_username,
                password: regenerated,
              }}
            />
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Connection</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Client ID</dt>
          <dd className="font-mono">{device.client_id}</dd>
          <dt className="text-slate-500">Username</dt>
          <dd className="font-mono">{device.mqtt_username}</dd>
          <dt className="text-slate-500">Publish topics</dt>
          <dd className="font-mono">devices/{device.client_id}/{"{telemetry,status,event,ping}"}</dd>
          <dt className="text-slate-500">Subscribe topic</dt>
          <dd className="font-mono">devices/{device.client_id}/cmd</dd>
          <dt className="text-slate-500">Storage used</dt>
          <dd>{storageQuery.data ? `${storageQuery.data.bytes} bytes` : "…"}</dd>
        </dl>
      </div>

      <ArduinoCodeSection
        deviceId={device.id}
        credential={{
          displayName: device.display_name,
          clientId: device.client_id,
          mqttUsername: device.mqtt_username,
          password: regenerated ?? "YOUR_DEVICE_PASSWORD",
        }}
        hasRealPassword={!!regenerated}
      />

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Send a command</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCmdResult(null);
            commandMutation.mutate();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-500">Target</label>
            <input
              value={cmdTarget}
              onChange={(e) => setCmdTarget(e.target.value)}
              placeholder="relay_1"
              required
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Command</label>
            <select
              value={cmdCommand}
              onChange={(e) => setCmdCommand(e.target.value as (typeof COMMANDS)[number])}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {COMMANDS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {cmdCommand === "set" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Value</label>
              <input
                value={cmdValue}
                onChange={(e) => setCmdValue(e.target.value)}
                placeholder="true / 42 / text"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={commandMutation.isPending}
            className="rounded-md bg-primary-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Send
          </button>
          {cmdResult && <span className="text-sm text-slate-600">{cmdResult}</span>}
        </form>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent messages</h2>
        <div ref={messagesScrollRef} className="h-80 overflow-y-auto">
          {messagesQuery.data && messagesQuery.data.messages.length > 0 ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {messagesQuery.data.messages.map((m) => (
                <li key={m.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-xs text-slate-400">
                      {new Date(m.received_at + "Z").toLocaleString()}
                    </span>
                    <span className="truncate font-mono text-xs text-slate-500">{m.topic}</span>
                  </div>
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs">
                    {m.payload}
                  </pre>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
        </div>
      </div>

    </Shell>
  );
}

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const num = Number(raw);
  if (raw.trim() !== "" && !Number.isNaN(num)) return num;
  return raw;
}

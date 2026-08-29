import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { createDevice, listDevices, type CreatedDevice } from "../lib/api/devices";
import { CredentialActions } from "../components/CredentialActions";
import { ArduinoCodeSection } from "../components/ArduinoCodeSection";

function CreatedCredentialBanner({
  created,
  onDismiss,
}: {
  created: CreatedDevice;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-900">
        Save this credential now — it won't be shown again.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-amber-800">Client ID</dt>
        <dd className="font-mono text-amber-950">{created.device.clientId}</dd>
        <dt className="text-amber-800">Username</dt>
        <dd className="font-mono text-amber-950">{created.device.mqttUsername}</dd>
        <dt className="text-amber-800">Password</dt>
        <dd className="font-mono text-amber-950">{created.password}</dd>
      </dl>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onDismiss}
          className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          I've saved it
        </button>
        <CredentialActions
          credential={{
            displayName: created.device.displayName,
            clientId: created.device.clientId,
            mqttUsername: created.device.mqttUsername,
            password: created.password,
          }}
        />
      </div>
    </div>
  );
}

export function DevicesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["devices"], queryFn: listDevices });
  const [displayName, setDisplayName] = useState("");
  const [created, setCreated] = useState<CreatedDevice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const createMutation = useMutation({
    mutationFn: (name: string) => createDevice(name),
    onSuccess: (result) => {
      setCreated(result);
      setDisplayName("");
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Devices</h1>

      {created && (
        <CreatedCredentialBanner created={created} onDismiss={() => setCreated(null)} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (displayName.trim()) createMutation.mutate(displayName.trim());
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Device name, e.g. living-room-sensor"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !displayName.trim()}
          className="rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating…" : "Create device"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.devices.length > 0 ? (
        <>
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 px-4 py-2">
              <span className="text-sm text-primary-900">{selectedIds.size} device(s) selected</span>
              <button
                onClick={() => navigate(`/ota/new?device_ids=${[...selectedIds].join(",")}`)}
                data-testid="devices-send-ota-button"
                className="rounded-md bg-primary-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                Send OTA to selected
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="w-8 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === data.devices.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? new Set(data.devices.map((d) => d.id)) : new Set())
                      }
                      data-testid="devices-select-all-checkbox"
                    />
                  </th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Client ID</th>
                  <th className="px-4 py-2 font-medium">Board</th>
                  <th className="px-4 py-2 font-medium">Online</th>
                  <th className="px-4 py-2 font-medium">Last seen</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleSelected(d.id)}
                        data-testid="devices-row-checkbox"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/devices/${d.id}`} className="font-medium text-slate-900 hover:underline">
                        {d.display_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.client_id}</td>
                    <td className="px-4 py-3 text-slate-500">{d.board_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      {d.online ? (
                        <span className="text-xs font-medium text-emerald-600">online</span>
                      ) : (
                        <span className="text-xs text-slate-400">offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {d.last_seen_at ? new Date(d.last_seen_at + "Z").toLocaleString() : "never"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/devices/${d.id}`}
                        className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">No devices yet — create one above.</p>
      )}

      {created && (
        <ArduinoCodeSection
          deviceId={created.device.id}
          credential={{
            displayName: created.device.displayName,
            clientId: created.device.clientId,
            mqttUsername: created.device.mqttUsername,
            password: created.password,
          }}
        />
      )}
    </Shell>
  );
}

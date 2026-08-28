import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { listDevices } from "../lib/api/devices";

export function ControlPage() {
  const { data, isLoading } = useQuery({ queryKey: ["devices"], queryFn: listDevices });

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Control</h1>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.devices.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Last seen</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {data.devices.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{d.display_name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {d.last_seen_at ? new Date(d.last_seen_at + "Z").toLocaleString() : "never"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/control/${d.id}`}
                      className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No devices yet.</p>
      )}
    </Shell>
  );
}

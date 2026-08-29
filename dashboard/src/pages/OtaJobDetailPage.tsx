import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { getOtaJob, cancelOtaJob } from "../lib/api/ota";
import { BOARDS } from "../lib/arduino/boards";

function boardLabel(boardId: string): string {
  return BOARDS.find((b) => b.id === boardId)?.label ?? boardId;
}

const STATE_STYLES: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-800 border-emerald-300",
  failed: "bg-red-50 text-red-800 border-red-300",
  timed_out: "bg-red-50 text-red-800 border-red-300",
  cancelled: "bg-slate-100 text-slate-600 border-slate-300",
};

export function OtaJobDetailPage() {
  const { id } = useParams();
  const jobId = Number(id);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ota-job", jobId],
    queryFn: () => getOtaJob(jobId),
    refetchInterval: 5_000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOtaJob(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ota-job", jobId] }),
  });

  if (isLoading || !data) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Loading…</p>
      </Shell>
    );
  }

  const { job, targets } = data;

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            OTA job #{job.id} — {boardLabel(job.board_id)} @ {job.version}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {job.target_mode} · status: {job.status} · created {new Date(`${job.created_at}Z`).toLocaleString()}
          </p>
        </div>
        {job.status === "running" && (
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            data-testid="ota-cancel-job-button"
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel job"}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Device</th>
              <th className="px-4 py-2">State</th>
              <th className="px-4 py-2">From → To</th>
              <th className="px-4 py-2">Error</th>
              <th className="px-4 py-2">Last update</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id} data-testid="ota-target-row" className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{t.device_display_name}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES[t.state] ?? "border-slate-300 text-slate-600"}`}
                    data-testid="ota-target-state"
                  >
                    {t.state}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">
                  {t.from_version ?? "?"} → {t.to_version}
                </td>
                <td className="px-4 py-2 text-red-600">{t.error_message ?? ""}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(`${t.last_update_at}Z`).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

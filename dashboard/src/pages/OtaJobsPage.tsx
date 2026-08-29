import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { listOtaJobs } from "../lib/api/ota";
import { BOARDS } from "../lib/arduino/boards";

function boardLabel(boardId: string): string {
  return BOARDS.find((b) => b.id === boardId)?.label ?? boardId;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-amber-50 text-amber-800 border-amber-300",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-300",
  timed_out: "bg-red-50 text-red-800 border-red-300",
  cancelled: "bg-slate-100 text-slate-600 border-slate-300",
};

export function OtaJobsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["ota-jobs"], queryFn: listOtaJobs, refetchInterval: 5_000 });

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">OTA jobs</h1>
        <Link
          to="/ota/new"
          data-testid="ota-new-job-link"
          className="rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          New OTA job
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.jobs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Firmware</th>
                <th className="px-4 py-2">Target mode</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr key={job.id} data-testid="ota-job-row" className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link to={`/ota/${job.id}`} className="font-mono text-primary-800 hover:underline">
                      {boardLabel(job.board_id)} @ {job.version}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{job.target_mode}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[job.status] ?? ""}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {job.verified_count}/{job.target_count} verified
                    {job.failed_count > 0 && <span className="ml-2 text-red-600">{job.failed_count} failed</span>}
                    {job.timed_out_count > 0 && (
                      <span className="ml-2 text-amber-600">{job.timed_out_count} timed out</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(`${job.created_at}Z`).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No OTA jobs yet.</p>
      )}
    </Shell>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Shell } from "../components/Shell";
import { getOverview } from "../lib/api/stats";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: getOverview,
    refetchInterval: 10_000,
  });

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Overview</h1>

      {isLoading || !data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Devices" value={String(data.deviceCount)} />
          <StatCard label="Messages today" value={String(data.messagesToday)} />
          <StatCard label="Storage used" value={formatBytes(data.totalStorageBytes)} />
          <StatCard
            label="Collector"
            value={data.collectorStatus === "connected" ? "Online" : "Offline"}
          />
        </div>
      )}
    </Shell>
  );
}

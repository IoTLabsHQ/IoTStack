import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { getOverview } from "../lib/api/stats";
import { getLiveResources, getThresholds } from "../lib/api/resources";

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

function pct(used: number, total: number): number {
  if (!total) return 0;
  return (used / total) * 100;
}

function ResourceWarningBanner() {
  const liveQuery = useQuery({
    queryKey: ["resources-live"],
    queryFn: getLiveResources,
    refetchInterval: 30_000,
  });
  const thresholdsQuery = useQuery({ queryKey: ["resource-thresholds"], queryFn: getThresholds });

  const host = liveQuery.data?.host;
  const thresholds = thresholdsQuery.data;
  if (!host || !thresholds) return null;

  const cpuPct = host.cpuPct;
  const memPct = pct(host.memUsedBytes, host.memTotalBytes);
  const diskPct = host.disks[0] ? pct(host.disks[0].usedBytes, host.disks[0].totalBytes) : 0;

  const worstIsCritical =
    cpuPct >= thresholds.host_cpu_critical_pct ||
    memPct >= thresholds.host_ram_critical_pct ||
    diskPct >= thresholds.host_disk_critical_pct;
  const worstIsWarn =
    cpuPct >= thresholds.host_cpu_warn_pct ||
    memPct >= thresholds.host_ram_warn_pct ||
    diskPct >= thresholds.host_disk_warn_pct;

  if (!worstIsWarn && !worstIsCritical) return null;

  const boxClass = worstIsCritical
    ? "border-red-300 bg-red-50 text-red-800"
    : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <div className={`mb-6 rounded-lg border p-4 ${boxClass}`}>
      <p className="text-sm">
        {worstIsCritical ? "Your VPS is close to its limits" : "Your VPS is getting busy"} — CPU{" "}
        {cpuPct.toFixed(0)}%, RAM {memPct.toFixed(0)}%, disk {diskPct.toFixed(0)}%. Check{" "}
        <Link to="/resources" className="underline font-medium">
          Resources
        </Link>{" "}
        for details, or consider upgrading your VPS.
      </p>
    </div>
  );
}

function TryTemplateBanner() {
  return (
    <Link
      to="/templates"
      className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300"
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">Try a sample project</p>
        <p className="text-sm text-slate-500">
          Go from zero to a working device you can view and control on the web, in a few clicks.
        </p>
      </div>
      <span className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Get started
      </span>
    </Link>
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

      <TryTemplateBanner />
      <ResourceWarningBanner />

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

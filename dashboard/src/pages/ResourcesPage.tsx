import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Shell } from "../components/Shell";
import { ApiError } from "../lib/api/client";
import {
  getLiveResources,
  getResourceHistory,
  getThresholds,
  saveThresholds,
  type ResourceGranularity,
  type ThresholdsInput,
} from "../lib/api/resources";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pct(used: number, total: number): number {
  if (!total) return 0;
  return (used / total) * 100;
}

function levelFor(value: number, warn: number, critical: number): "ok" | "warn" | "critical" {
  if (value >= critical) return "critical";
  if (value >= warn) return "warn";
  return "ok";
}

const LEVEL_CLASSES: Record<string, string> = {
  ok: "text-slate-900",
  warn: "text-amber-600",
  critical: "text-red-600",
};

function Gauge({
  label,
  valueLabel,
  pctValue,
  level,
}: {
  label: string;
  valueLabel: string;
  pctValue: number;
  level: "ok" | "warn" | "critical";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${LEVEL_CLASSES[level]}`}>{valueLabel}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${level === "critical" ? "bg-red-500" : level === "warn" ? "bg-amber-500" : "bg-primary-800"}`}
          style={{ width: `${Math.min(100, Math.max(0, pctValue))}%` }}
        />
      </div>
    </div>
  );
}

const GRANULARITIES: { key: ResourceGranularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function shortTime(bucket: string, granularity: ResourceGranularity): string {
  if (granularity === "day") {
    return new Date(bucket + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (granularity === "year") {
    return bucket.slice(5); // MM-DD
  }
  // hourly buckets look like "2026-08-27T10"
  return bucket.slice(5).replace("T", " ") + ":00";
}

function ResourceCharts({ granularity }: { granularity: ResourceGranularity }) {
  const { data, isLoading } = useQuery({
    queryKey: ["resource-history", granularity],
    queryFn: () => getResourceHistory(granularity),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const hostPoints = data.points
    .filter((p) => p.target === "host")
    .map((p) => ({
      time: shortTime(p.bucket, granularity),
      cpuPct: p.cpu_pct ?? p.avg_cpu_pct ?? 0,
      memPct: pct(p.used_bytes ?? p.avg_used_bytes ?? 0, p.total_bytes ?? 1),
    }));

  const diskTarget = data.points.find((p) => p.target.startsWith("disk:"))?.target;
  const diskPoints = diskTarget
    ? data.points
        .filter((p) => p.target === diskTarget)
        .map((p) => ({
          time: shortTime(p.bucket, granularity),
          diskPct: pct(p.used_bytes ?? p.avg_used_bytes ?? 0, p.total_bytes ?? 1),
        }))
    : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Host CPU %</h3>
        {hostPoints.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hostPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" fontSize={11} stroke="#94a3b8" />
              <YAxis fontSize={11} stroke="#94a3b8" domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Line type="monotone" dataKey="cpuPct" stroke="#0f172a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Host memory %</h3>
        {hostPoints.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hostPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" fontSize={11} stroke="#94a3b8" />
              <YAxis fontSize={11} stroke="#94a3b8" domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Area type="monotone" dataKey="memPct" stroke="#0f172a" fill="#cbd5e1" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Disk % {diskTarget ? `(${diskTarget.replace("disk:", "")})` : ""}
        </h3>
        {diskPoints.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={diskPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" fontSize={11} stroke="#94a3b8" />
              <YAxis fontSize={11} stroke="#94a3b8" domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Area type="monotone" dataKey="diskPct" stroke="#0f172a" fill="#cbd5e1" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function ResourcesPage() {
  const queryClient = useQueryClient();
  const [granularity, setGranularity] = useState<ResourceGranularity>("day");

  const liveQuery = useQuery({
    queryKey: ["resources-live"],
    queryFn: getLiveResources,
    refetchInterval: 10_000,
  });

  const thresholdsQuery = useQuery({ queryKey: ["resource-thresholds"], queryFn: getThresholds });

  const [form, setForm] = useState<ThresholdsInput | null>(null);
  const thresholds = form ?? {
    hostRamWarnPct: thresholdsQuery.data?.host_ram_warn_pct ?? 70,
    hostRamCriticalPct: thresholdsQuery.data?.host_ram_critical_pct ?? 85,
    hostCpuWarnPct: thresholdsQuery.data?.host_cpu_warn_pct ?? 70,
    hostCpuCriticalPct: thresholdsQuery.data?.host_cpu_critical_pct ?? 90,
    hostDiskWarnPct: thresholdsQuery.data?.host_disk_warn_pct ?? 80,
    hostDiskCriticalPct: thresholdsQuery.data?.host_disk_critical_pct ?? 90,
    containerMemWarnPct: thresholdsQuery.data?.container_mem_warn_pct ?? 80,
    containerMemCriticalPct: thresholdsQuery.data?.container_mem_critical_pct ?? 95,
  };

  const [thresholdsError, setThresholdsError] = useState<string | null>(null);
  const [thresholdsSuccess, setThresholdsSuccess] = useState(false);

  const thresholdsMutation = useMutation({
    mutationFn: (input: ThresholdsInput) => saveThresholds(input),
    onSuccess: () => {
      setThresholdsError(null);
      setThresholdsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["resource-thresholds"] });
    },
    onError: (err: unknown) => {
      setThresholdsSuccess(false);
      setThresholdsError(err instanceof ApiError ? err.message : "Failed to save thresholds");
    },
  });

  const host = liveQuery.data?.host;
  const cpuPct = host?.cpuPct ?? 0;
  const memPct = host ? pct(host.memUsedBytes, host.memTotalBytes) : 0;
  const disk = host?.disks[0];
  const diskPct = disk ? pct(disk.usedBytes, disk.totalBytes) : 0;

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Resources</h1>

      {liveQuery.isLoading || !host ? (
        <p className="mb-6 text-sm text-slate-500">
          {liveQuery.isError ? "Resource agent unreachable." : "Loading…"}
        </p>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Gauge
            label="Host CPU"
            valueLabel={`${cpuPct.toFixed(1)}%`}
            pctValue={cpuPct}
            level={levelFor(cpuPct, thresholds.hostCpuWarnPct, thresholds.hostCpuCriticalPct)}
          />
          <Gauge
            label="Host memory"
            valueLabel={`${formatBytes(host.memUsedBytes)} / ${formatBytes(host.memTotalBytes)}`}
            pctValue={memPct}
            level={levelFor(memPct, thresholds.hostRamWarnPct, thresholds.hostRamCriticalPct)}
          />
          {disk && (
            <Gauge
              label={`Disk (${disk.mount})`}
              valueLabel={`${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`}
              pctValue={diskPct}
              level={levelFor(diskPct, thresholds.hostDiskWarnPct, thresholds.hostDiskCriticalPct)}
            />
          )}
        </div>
      )}

      {liveQuery.data && liveQuery.data.containers.length > 0 && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">CPU</th>
                <th className="px-4 py-2 font-medium">Memory</th>
              </tr>
            </thead>
            <tbody>
              {liveQuery.data.containers.map((c) => {
                const cMemPct = pct(c.memUsedBytes, c.memLimitBytes);
                const level = levelFor(
                  cMemPct,
                  thresholds.containerMemWarnPct,
                  thresholds.containerMemCriticalPct,
                );
                return (
                  <tr key={c.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.cpuPct.toFixed(1)}%</td>
                    <td className={`px-4 py-3 ${LEVEL_CLASSES[level]}`}>
                      {formatBytes(c.memUsedBytes)} / {formatBytes(c.memLimitBytes)} (
                      {cMemPct.toFixed(0)}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-3 flex gap-1 rounded-md border border-slate-300 p-0.5 text-sm w-fit">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularity(g.key)}
              className={`rounded px-3 py-1 font-medium ${
                granularity === g.key
                  ? "bg-primary-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <ResourceCharts granularity={granularity} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-1 text-base font-semibold text-slate-900">Warning thresholds</h2>
        <p className="mb-4 text-sm text-slate-500">
          When usage crosses "warn", the Overview page shows a heads-up; past "critical" it turns
          red — a concrete signal for when it's time to consider a bigger VPS.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            thresholdsMutation.mutate(thresholds);
          }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {(
            [
              ["hostCpuWarnPct", "CPU warn %"],
              ["hostCpuCriticalPct", "CPU critical %"],
              ["hostRamWarnPct", "RAM warn %"],
              ["hostRamCriticalPct", "RAM critical %"],
              ["hostDiskWarnPct", "Disk warn %"],
              ["hostDiskCriticalPct", "Disk critical %"],
              ["containerMemWarnPct", "Service mem warn %"],
              ["containerMemCriticalPct", "Service mem critical %"],
            ] as [keyof ThresholdsInput, string][]
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={thresholds[key]}
                onChange={(e) =>
                  setForm({ ...thresholds, [key]: Number(e.target.value) })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4">
            <button
              type="submit"
              disabled={thresholdsMutation.isPending}
              className="rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {thresholdsMutation.isPending ? "Saving…" : "Save thresholds"}
            </button>
          </div>
        </form>

        {thresholdsError && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm text-red-700">{thresholdsError}</p>
          </div>
        )}
        {thresholdsSuccess && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">Thresholds saved.</p>
          </div>
        )}
      </section>
    </Shell>
  );
}

export type Granularity = "day" | "week" | "month" | "year";

/**
 * Formats a history-point bucket string for a chart's x-axis. Goes off the
 * bucket's own shape rather than trusting `granularity` alone — "day" means
 * a full timestamp for some history endpoints (one point per raw sample or
 * message) but an hourly bucket for others (e.g. traffic, which is always
 * grouped even at "day" resolution since a byte count needs an interval,
 * not an instant) — same 13-char "YYYY-MM-DDTHH" shape either way at the
 * hourly tier, so length alone disambiguates correctly regardless of which
 * endpoint produced it.
 */
export function formatBucketTime(bucket: string, granularity: Granularity): string {
  if (granularity === "year") {
    return bucket.slice(5); // MM-DD
  }
  if (bucket.length === 13) {
    return bucket.slice(5).replace("T", " ") + ":00"; // "2026-08-27T10" -> "08-27 10:00"
  }
  return new Date(bucket + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  return (
    <div className="mb-3 flex w-fit gap-1 rounded-md border border-slate-300 p-0.5 text-sm">
      {GRANULARITIES.map((g) => (
        <button
          key={g.key}
          onClick={() => onChange(g.key)}
          className={`rounded px-3 py-1 font-medium ${
            value === g.key ? "bg-primary-800 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

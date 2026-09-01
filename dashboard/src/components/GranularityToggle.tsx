export type Granularity = "day" | "week" | "month" | "year";

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

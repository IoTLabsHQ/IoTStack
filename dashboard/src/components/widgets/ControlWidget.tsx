import type { Control } from "../../lib/api/control";
import type { Message } from "../../lib/api/devices";
import { extractCurrentValue } from "../../lib/control-values";
import { formatRelativeTimeVi, formatExactTimeVi } from "../../lib/relativeTime";

export function ControlWidget({
  control,
  messages,
  onToggle,
  toggling,
}: {
  control: Control;
  messages: Message[];
  onToggle: (control: Control & { type: "toggle" }, next: boolean) => void;
  toggling: boolean;
}) {
  const value = extractCurrentValue(control, messages);

  if (control.type === "toggle") {
    const isOn = value.current === true;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">{control.label}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-semibold text-slate-900">
            {value.current === null ? "Unknown" : isOn ? "On" : "Off"}
          </span>
          <button
            role="switch"
            aria-checked={isOn}
            disabled={toggling}
            onClick={() => onToggle(control, !isOn)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              isOn ? "bg-primary-800" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isOn ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  if (control.type === "event") {
    const asOfText = value.asOf ? formatRelativeTimeVi(value.asOf).text : null;
    const asOfExact = value.asOf ? formatExactTimeVi(value.asOf) : undefined;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5" data-testid="control-widget-event">
        <p className="text-sm text-slate-500">{control.label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900" data-testid="control-widget-event-type">
          {value.current === null ? "—" : (value.current as string)}
        </p>
        {asOfText && (
          <p className="mt-1 text-[11px] text-slate-400" title={asOfExact}>
            {asOfText}
          </p>
        )}
      </div>
    );
  }

  if (control.widget === "min-max-current") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">{control.label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {value.current === null ? "—" : value.current}
        </p>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>
            min <b className="text-slate-700">{value.min ?? "—"}</b>
          </span>
          <span>
            max <b className="text-slate-700">{value.max ?? "—"}</b>
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">min/max over recent messages</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{control.label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {value.current === null ? "—" : value.current}
      </p>
    </div>
  );
}

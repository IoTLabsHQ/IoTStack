import type { Message } from "../lib/api/devices";
import { distinctShapes, isPlainObject, leafType, type DistinctShape } from "../lib/message-shapes";

export interface ActiveField {
  /** "new" = the Add-control form, a number = a draft control's index. */
  scope: "new" | number;
  kind: "telemetry" | "status";
  /** Current Status target value, for status field scoping. */
  target?: string;
}

interface Section {
  type: "telemetry" | "status" | "event" | "ping";
  label: string;
  /** Telemetry/status fields are bindable to a control; event/ping are
   * shown purely for reference. */
  interactive: boolean;
}

const SECTIONS: Section[] = [
  { type: "telemetry", label: "Telemetry", interactive: true },
  { type: "status", label: "Status", interactive: true },
  { type: "event", label: "Event", interactive: false },
  { type: "ping", label: "Ping", interactive: false },
];

function formatShapePreview(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const lines = entries.map(
      ([key, v]) => `${padInner}${key}: ${isPlainObject(v) ? formatShapePreview(v, indent + 1) : leafType(v)}`,
    );
    return `{\n${lines.join(",\n")}\n${pad}}`;
  }
  return leafType(value);
}

/**
 * Right-side reference panel: the device's real, deduplicated message
 * shapes. Telemetry/status field paths are click-to-fill — clicking one
 * calls onPick(path), which the page wires to whichever field input is
 * currently focused (tracked via `activeField`).
 */
export function MessageShapePanel({
  messages,
  activeField,
  onPick,
}: {
  messages: Message[];
  activeField: ActiveField | null;
  onPick: (path: string) => void;
}) {
  return (
    <div data-testid="message-shape-panel" className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-slate-900">Message formats</p>
      <p className="mb-4 text-xs text-slate-500">
        Real shapes the device has sent — click a field to fill the focused input.
      </p>
      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <ShapeSection
            key={section.type}
            section={section}
            shapes={distinctShapes(messages, section.type)}
            activeField={activeField}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function ShapeSection({
  section,
  shapes,
  activeField,
  onPick,
}: {
  section: Section;
  shapes: DistinctShape[];
  activeField: ActiveField | null;
  onPick: (path: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.label}</p>
      {shapes.length === 0 ? (
        <p className="text-xs text-slate-400">No {section.label.toLowerCase()} messages yet.</p>
      ) : (
        <div className="space-y-3">
          {shapes.map((shape, i) => (
            <ShapeCard
              key={`${shape.target ?? ""}-${i}`}
              messageType={section.type}
              shape={shape}
              interactive={section.interactive}
              enabled={
                section.interactive &&
                activeField !== null &&
                activeField.kind === section.type &&
                (section.type !== "status" || !activeField.target || activeField.target === shape.target)
              }
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShapeCard({
  messageType,
  shape,
  interactive,
  enabled,
  onPick,
}: {
  messageType: string;
  shape: DistinctShape;
  interactive: boolean;
  enabled: boolean;
  onPick: (path: string) => void;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      {shape.target && <p className="mb-1 font-mono text-[11px] text-slate-500">target: {shape.target}</p>}
      <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-700">
        {formatShapePreview(shape.sampleValue)}
      </pre>
      {shape.paths.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] text-slate-400">Fields:</p>
          <div className="flex flex-wrap gap-1">
            {shape.paths.map((f) => (
              <button
                key={f.path}
                type="button"
                disabled={!interactive || !enabled}
                title={
                  !interactive
                    ? "Not bindable to a control field"
                    : enabled
                      ? undefined
                      : "Focus a Telemetry/Status field input first"
                }
                onClick={() => onPick(f.path)}
                data-testid={`shape-field-button-${messageType}-${f.path}`}
                className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                  interactive && enabled
                    ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                    : "cursor-default border-slate-200 bg-white text-slate-500"
                }`}
              >
                {f.path} <span className="text-slate-400">({f.type})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-1 text-[10px] text-slate-400">
        {shape.count} message{shape.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

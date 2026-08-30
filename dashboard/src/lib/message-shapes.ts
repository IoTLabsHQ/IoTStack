import type { Message } from "./api/devices";

export type LeafType = "number" | "string" | "boolean" | "null" | "array" | "object";

export interface FieldPath {
  path: string;
  type: LeafType;
}

export function leafType(value: unknown): LeafType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return t;
  return "object";
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Flattens a JSON value into dot-path leaves (`gps.lat`) — objects recurse,
 * arrays are reported as a single "array" leaf at their own path rather
 * than expanded per-element. */
export function flattenPaths(value: unknown, prefix = ""): FieldPath[] {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, v]) =>
      flattenPaths(v, prefix ? `${prefix}.${key}` : key),
    );
  }
  return prefix ? [{ path: prefix, type: leafType(value) }] : [];
}

/** Canonical structural fingerprint — object keys sorted, every leaf
 * replaced by its type, so two payloads with the same keys/types but
 * different values (or key order) collapse to the same key. */
export function shapeKey(value: unknown): string {
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${k}:${shapeKey(value[k])}`).join(",")}}`;
  }
  return leafType(value);
}

export interface DistinctShape {
  /** Newest message with this shape — `messages` is expected newest-first. */
  sampleMessage: Message;
  /** The parsed sample value (status shapes have `target` stripped) — for
   * rendering a nested pretty-print, not just the flattened paths. */
  sampleValue: unknown;
  paths: FieldPath[];
  count: number;
  /** Status shapes only — the `target` this shape's payloads carry. */
  target?: string;
}

const MAX_SHAPES_PER_GROUP = 5;

function groupByShape(
  messages: Message[],
  parse: (payload: unknown) => unknown,
  target?: string,
): DistinctShape[] {
  const byKey = new Map<string, DistinctShape>();
  for (const m of messages) {
    let payload: unknown;
    try {
      payload = JSON.parse(m.payload);
    } catch {
      continue;
    }
    if (typeof payload !== "object" || payload === null) continue;
    const parsed = parse(payload);
    const key = shapeKey(parsed);
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { sampleMessage: m, sampleValue: parsed, paths: flattenPaths(parsed), count: 1, target });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SHAPES_PER_GROUP);
}

/**
 * Distinct payload shapes for one message_type, deduplicated structurally
 * (same keys/types = same shape, regardless of value). For "status",
 * additionally groups by `target` first (falling back to "(no target)")
 * since different targets legitimately send different shapes — `target`
 * itself is excluded from the returned paths, it isn't a bindable field.
 */
export function distinctShapes(messages: Message[], messageType: string): DistinctShape[] {
  const matching = messages.filter((m) => m.message_type === messageType);
  if (messageType !== "status") return groupByShape(matching, (p) => p);

  const byTarget = new Map<string, Message[]>();
  for (const m of matching) {
    let payload: unknown;
    try {
      payload = JSON.parse(m.payload);
    } catch {
      continue;
    }
    if (typeof payload !== "object" || payload === null) continue;
    const target =
      typeof (payload as Record<string, unknown>).target === "string"
        ? ((payload as Record<string, unknown>).target as string)
        : "(no target)";
    const list = byTarget.get(target) ?? [];
    list.push(m);
    byTarget.set(target, list);
  }

  return [...byTarget.entries()].flatMap(([target, targetMessages]) =>
    groupByShape(
      targetMessages,
      (p) => {
        const { target: _target, ...rest } = p as Record<string, unknown>;
        return rest;
      },
      target,
    ),
  );
}

/** Dot-path lookup, safe against non-object intermediates (returns
 * undefined rather than throwing) — used to read a control's bound field,
 * which may now be a nested path picked from the message-shape panel. */
export function getByPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (typeof acc !== "object" || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, payload);
}

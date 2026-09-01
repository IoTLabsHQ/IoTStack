/**
 * Server-side counterpart to dashboard/src/lib/message-shapes.ts's
 * flattenPaths — same dot-path convention (so a rolled-up field name lines
 * up exactly with what a Control's binding.field or the Message-formats
 * panel would show), but numeric-only since only numbers are chartable.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface NumericLeaf {
  path: string;
  value: number;
}

export function flattenNumericLeaves(value: unknown, prefix = ""): NumericLeaf[] {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, v]) =>
      flattenNumericLeaves(v, prefix ? `${prefix}.${key}` : key),
    );
  }
  if (prefix && typeof value === "number" && Number.isFinite(value)) {
    return [{ path: prefix, value }];
  }
  return [];
}

/** Dot-path lookup, safe against non-object intermediates — same
 * convention as dashboard/src/lib/message-shapes.ts's getByPath. */
export function getByPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (typeof acc !== "object" || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, payload);
}

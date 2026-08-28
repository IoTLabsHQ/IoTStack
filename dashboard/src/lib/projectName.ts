/**
 * Project (device) name formatting for the Create-from-Template wizard.
 * Pure logic — no React, no network — so the dedup/normalize rules are
 * easy to reason about independent of the wizard's async flow.
 */

/**
 * Cleans up whitespace/separator noise so two names that only differ by
 * spacing (`"A  -  B"` vs `"A - B"`) are treated as the same name for
 * duplicate checks, and so what actually gets saved is always tidy.
 */
export function normalizeProjectName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/-{2,}/g, "-");
  s = s.replace(/_{2,}/g, "_");
  s = s.replace(/(?:\s*-\s*){2,}/g, " - ");
  s = s.replace(/\s*-\s*/g, " - ");
  return s.trim();
}

/**
 * Given a normalized base name and the set of normalized names already in
 * use, returns a name guaranteed not to collide: the base name itself if
 * free, otherwise `${base} - 00N` using the smallest N not already taken
 * (fills gaps — e.g. base/001/003 taken picks 002, not 004).
 */
export function buildUniqueProjectName(base: string, existingNormalizedNames: Set<string>): string {
  if (!existingNormalizedNames.has(base)) return base;

  const prefix = `${base} - `;
  const used = new Set<number>();
  for (const name of existingNormalizedNames) {
    if (!name.startsWith(prefix)) continue;
    const suffix = name.slice(prefix.length);
    if (/^\d{3}$/.test(suffix)) used.add(Number(suffix));
  }

  let n = 1;
  while (used.has(n)) n++;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

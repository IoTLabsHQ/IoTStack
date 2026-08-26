const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(COMBINING_MARKS_RE, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "DEVICE";
}

/**
 * Vietnamese relative-time formatting for device "last seen" display.
 * `last_seen_at` from the API is a bare SQLite `datetime('now')` string
 * ("YYYY-MM-DD HH:MM:SS", UTC, no timezone marker) — the existing codebase
 * convention (DevicesPage.tsx) is to append "Z" before parsing; matched here.
 */

export interface RelativeTime {
  text: string;
  /** ms until this text is next due to change — schedule the next tick with this, not a fixed interval. */
  nextUpdateMs: number;
}

function parseSqliteUtc(raw: string): Date {
  return new Date(`${raw}Z`);
}

export function formatRelativeTimeVi(lastSeenAtRaw: string, now: Date = new Date()): RelativeTime {
  const from = parseSqliteUtc(lastSeenAtRaw);
  const diffSec = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));

  if (diffSec < 60) {
    return { text: `${diffSec}s trước`, nextUpdateMs: 1000 };
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return { text: `${diffMin} phút trước`, nextUpdateMs: (60 - (diffSec % 60)) * 1000 };
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    const remMin = diffMin % 60;
    const text = remMin > 0 ? `${diffHour}h ${remMin} phút trước` : `${diffHour}h trước`;
    return { text, nextUpdateMs: 60_000 };
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) {
    const remHour = diffHour % 24;
    const text = remHour > 0 ? `${diffDay} ngày ${remHour}h trước` : `${diffDay} ngày trước`;
    return { text, nextUpdateMs: 3_600_000 };
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    const remDay = diffDay % 30;
    const text = remDay > 0 ? `${diffMonth} tháng ${remDay} ngày trước` : `${diffMonth} tháng trước`;
    return { text, nextUpdateMs: 86_400_000 };
  }

  const diffYear = Math.floor(diffMonth / 12);
  const remMonth = diffMonth % 12;
  const text = remMonth > 0 ? `${diffYear} năm ${remMonth} tháng trước` : `${diffYear} năm trước`;
  return { text, nextUpdateMs: 86_400_000 };
}

export function formatExactTimeVi(lastSeenAtRaw: string): string {
  const d = parseSqliteUtc(lastSeenAtRaw);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

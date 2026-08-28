import { useEffect, useState } from "react";
import { formatExactTimeVi, formatRelativeTimeVi } from "../lib/relativeTime";

/**
 * Reuses devices.last_seen_at (the collector already bumps it on every
 * valid message — see api/src/collector.ts) as the single source of
 * truth for "online" — no separate heartbeat/connection-status mechanism.
 * Self-schedules its own re-render via formatRelativeTimeVi's
 * nextUpdateMs, so it never polls faster than the displayed text can
 * actually change (1s while under a minute old, widening from there).
 */
export function DeviceOnlineStatus({ lastSeenAt }: { lastSeenAt: string | null }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!lastSeenAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const { nextUpdateMs } = formatRelativeTimeVi(lastSeenAt);
      timer = setTimeout(() => {
        tick((n) => n + 1);
        schedule();
      }, nextUpdateMs);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [lastSeenAt]);

  if (!lastSeenAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        Chưa có dữ liệu
      </span>
    );
  }

  const { text } = formatRelativeTimeVi(lastSeenAt);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"
      title={formatExactTimeVi(lastSeenAt)}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Online · {text}
    </span>
  );
}

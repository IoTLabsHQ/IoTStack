/**
 * Per-device message rate limiter — fixed 1-minute-window counter, in
 * memory. This is a single-instance self-hosted service (no horizontal
 * scaling), so there's no need for shared/distributed state here.
 */
const WINDOW_SECONDS = 60;

interface Bucket {
  windowId: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

function currentWindowId(): number {
  return Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
}

/**
 * Checks whether `clientId` is within its rate limit, incrementing its
 * counter for the current window.
 */
export function checkRateLimit(clientId: string, limitPerMinute: number): boolean {
  const windowId = currentWindowId();
  const bucket = buckets.get(clientId);

  if (!bucket || bucket.windowId !== windowId) {
    buckets.set(clientId, { windowId, count: 1 });
    return 1 <= limitPerMinute;
  }

  bucket.count++;
  return bucket.count <= limitPerMinute;
}

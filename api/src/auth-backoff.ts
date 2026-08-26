/**
 * Failed-login backoff for the dashboard's own admin account. In the
 * original design this protected a custom HTTP auth callback that
 * Mosquitto called on every device connection; that callback doesn't exist
 * here — Mosquitto authenticates devices itself via the Dynamic Security
 * plugin. The equivalent brute-forceable surface in this project is the
 * dashboard's own POST /auth/login, so that's what this guards instead.
 * In-memory, single instance, same reasoning as rate-limiter.ts.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;
const LOCKOUT_MS = 5 * 60 * 1000;

interface FailureRecord {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

const records = new Map<string, FailureRecord>();

export function isLockedOut(email: string): boolean {
  const record = records.get(email);
  if (!record?.lockedUntil) return false;
  if (record.lockedUntil < Date.now()) {
    records.delete(email);
    return false;
  }
  return true;
}

export function recordFailure(email: string): void {
  const now = Date.now();
  const record = records.get(email);

  if (!record || now - record.windowStart > WINDOW_MS) {
    records.set(email, { count: 1, windowStart: now, lockedUntil: null });
    return;
  }

  record.count++;
  if (record.count >= MAX_FAILURES) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
}

export function recordSuccess(email: string): void {
  records.delete(email);
}

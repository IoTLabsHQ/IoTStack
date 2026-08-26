/**
 * Dashboard session tokens — in-memory only (single instance, no need for a
 * shared/persistent session store). A token issued at login lives until it
 * expires or the process restarts, matching how the dashboard already
 * treats its own session (bearer token in sessionStorage, cleared on tab
 * close).
 */
import { randomBytes } from "crypto";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface Session {
  adminId: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

export function createSession(adminId: number): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { adminId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function resolveSession(token: string): number | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.adminId;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

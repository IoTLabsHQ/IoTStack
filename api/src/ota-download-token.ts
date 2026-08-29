import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

interface TokenPayload {
  targetId: number;
  exp: number; // unix seconds
}

function sign(payloadB64: string): string {
  return createHmac("sha256", config.ota.downloadSecret).update(payloadB64).digest("base64url");
}

/**
 * Stateless HMAC token, not a DB row — a staggered "all devices" rollout
 * can take many minutes, and must survive an api container restart
 * mid-rollout without orphaning in-flight downloads (see ota-timeout-sweep.ts).
 */
export function createOtaDownloadToken(targetId: number): string {
  const exp = Math.floor(Date.now() / 1000) + config.ota.downloadTokenTtlSeconds;
  const payloadB64 = Buffer.from(JSON.stringify({ targetId, exp } satisfies TokenPayload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Returns the target id if the token is well-formed, correctly signed, and
 * not expired — null otherwise. Deliberately reusable within its TTL (not
 * single-use): a flaky-WiFi HTTPUpdate retry must not permanently strand a
 * device on a failed job. */
export function verifyOtaDownloadToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSig = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as TokenPayload;
    if (typeof payload.targetId !== "number" || typeof payload.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload.targetId;
  } catch {
    return null;
  }
}

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendCommand, type Message } from "../lib/api/devices";

const REPLY_TIMEOUT_MS = 15_000;
// `received_at` comes from SQLite's `datetime('now')` — whole seconds only.
// A reply landing in the same wall-clock second as `sentAt` (sub-second JS
// precision) can truncate to a timestamp just *before* it, so a strict `>`
// wrongly rejects genuine same-second replies. Tolerate up to 1s of that.
const CLOCK_TRUNCATION_TOLERANCE_MS = 1_000;

export interface UseControlCommandResult {
  /** True from the moment `send` is called until a matching status reply
   * arrives (or REPLY_TIMEOUT_MS elapses) — drive a control's loading UI off this. */
  pending: boolean;
  /** True if REPLY_TIMEOUT_MS elapsed with no matching status reply. */
  timedOut: boolean;
  send: (command: string, value?: unknown) => void;
}

/**
 * Reusable control-command lifecycle: call the API, show pending
 * immediately, and keep it pending until the device publishes a `status`
 * message for this `target` newer than the send — `messages` should be the
 * device's live-polled feed (this hook only reads it, never fetches).
 */
export function useControlCommand(
  deviceId: number,
  target: string,
  messages: Message[],
): UseControlCommandResult {
  const [pending, setPending] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const sentAtRef = useRef<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const mutation = useMutation({
    mutationFn: (payload: { command: string; value?: unknown }) =>
      sendCommand(deviceId, { target, command: payload.command, value: payload.value }),
    onError: () => {
      clearReplyTimeout();
      setPending(false);
    },
  });

  function clearReplyTimeout() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  useEffect(() => clearReplyTimeout, []);

  useEffect(() => {
    const sentAt = sentAtRef.current;
    if (!pending || !sentAt) return;
    const hasReply = messages.some((m) => {
      if (m.message_type !== "status") return false;
      if (new Date(`${m.received_at}Z`).getTime() < sentAt.getTime() - CLOCK_TRUNCATION_TOLERANCE_MS) {
        return false;
      }
      try {
        return JSON.parse(m.payload).target === target;
      } catch {
        return false;
      }
    });
    if (hasReply) {
      clearReplyTimeout();
      setPending(false);
      setTimedOut(false);
    }
  }, [messages, pending, target]);

  function send(command: string, value?: unknown) {
    clearReplyTimeout();
    sentAtRef.current = new Date();
    setPending(true);
    setTimedOut(false);
    timeoutRef.current = setTimeout(() => {
      setPending(false);
      setTimedOut(true);
    }, REPLY_TIMEOUT_MS);
    mutation.mutate({ command, value });
  }

  return { pending, timedOut, send };
}

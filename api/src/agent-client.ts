/**
 * Client for the host-side iotstack-agent daemon — reached over a unix
 * socket bind-mounted read-write into this container (see docker-compose.yml
 * and docs/reference/002_security.en.md for why a socket, not TCP or a
 * /proc bind-mount). No new npm dependency: Node's core `http` module
 * already supports connecting over a unix socket via `socketPath`.
 */
import http from "node:http";
import { config } from "./config";
import { logger } from "./logger";

export interface AgentDisk {
  mount: string;
  usedBytes: number;
  totalBytes: number;
}

export interface AgentHost {
  cpuPct: number;
  load1: number;
  memUsedBytes: number;
  memTotalBytes: number;
  disks: AgentDisk[];
}

export interface AgentContainer {
  name: string;
  cpuPct: number;
  memUsedBytes: number;
  memLimitBytes: number;
}

export interface AgentSnapshot {
  ts: string;
  host: AgentHost;
  containers: AgentContainer[];
}

/** Fetches the current snapshot from the agent. Rejects on any failure —
 * callers decide whether that's fatal (a live "/resources/live" request)
 * or just skip-this-poll (the background collector). */
export function getAgentSnapshot(): Promise<AgentSnapshot> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: config.resources.agentSocketPath,
        path: "/v1/stats",
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`agent returned status ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as AgentSnapshot);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error("agent request timed out")));
    req.on("error", (err) => {
      logger.warn("agent-client: request failed:", err.message);
      reject(err);
    });
    req.end();
  });
}

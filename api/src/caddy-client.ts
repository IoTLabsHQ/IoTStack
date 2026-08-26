/**
 * Talks to Caddy's admin API (reachable only from this container, over the
 * docker network — never published to the host) to push a domain live
 * without restarting the caddy container, and to check whether HTTPS for
 * that domain has actually come up yet.
 */
import { connect as tlsConnect } from "tls";
import { config } from "./config";
import { logger } from "./logger";

const IOTSTACK_HANDLERS = `(iotstack_handlers) {
	handle /api/* {
		uri strip_prefix /api
		reverse_proxy api:3000
	}

	handle {
		root * /srv/dashboard
		try_files {path} /index.html
		file_server
	}
}`;

export function buildCaddyfile(domain: string): string {
  const parts = [
    `{\n\tadmin 0.0.0.0:2019 {\n\t\torigins caddy:2019\n\t}\n}`,
    IOTSTACK_HANDLERS,
    `:80 {\n\timport iotstack_handlers\n}`,
  ];
  if (domain) {
    parts.push(`${domain} {\n\timport iotstack_handlers\n}`);
  }
  return parts.join("\n\n") + "\n";
}

/** Hot-swaps Caddy's entire live config — no restart, no manual route surgery. */
export async function pushCaddyConfig(domain: string): Promise<void> {
  const res = await fetch(`${config.caddy.adminUrl}/load`, {
    method: "POST",
    // Caddy's admin API checks the Origin header against its configured
    // `origins` list — Node's fetch sends no Origin header by default,
    // which Caddy treats as an unconditional reject, not a fallback to
    // the Host header. Confirmed by real testing, not documentation.
    headers: { "Content-Type": "text/caddyfile", Origin: `http://${config.caddy.host}:2019` },
    body: buildCaddyfile(domain),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`caddy /load failed: ${res.status} ${body}`);
  }
}

/**
 * True only once Caddy holds a real, trusted (non-self-signed) certificate
 * for this exact hostname — proof DNS + ACME + issuance already completed.
 */
export function checkDomainHttps(domain: string): Promise<boolean> {
  if (!domain) return Promise.resolve(false);

  return new Promise((resolve) => {
    const socket = tlsConnect(
      {
        host: config.caddy.host,
        port: config.caddy.httpsPort,
        servername: domain,
        rejectUnauthorized: true,
        timeout: 5000,
      },
      () => {
        resolve(socket.authorized);
        socket.end();
      },
    );
    socket.on("error", (err) => {
      logger.warn(`domain https check failed for "${domain}": ${err.message}`);
      resolve(false);
    });
    socket.on("timeout", () => {
      resolve(false);
      socket.destroy();
    });
  });
}

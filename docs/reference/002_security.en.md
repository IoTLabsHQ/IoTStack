# Security

## Threat model

This project assumes a single operator (one maker) running one instance
for their own devices, reachable from the public internet. The realistic
threats are:

- A device's MQTT credential leaking (e.g. extracted from firmware) and
  being used to impersonate or attack other devices on the same broker.
- Brute-forcing the dashboard admin login.
- A malicious or malfunctioning device flooding the broker/storage.
- Data at rest being read if the server itself is compromised.

It does **not** assume a multi-tenant deployment where mutually
distrusting operators share one instance — see [Known limitations](#known-limitations).

## Device authentication and authorization

Devices authenticate directly against Mosquitto's Dynamic Security plugin
— username/password, checked by the broker itself, not by a callback to
another service. Every device's role grants publish rights on exactly its
own `telemetry`/`status`/`event`/`ping` topics and subscribe+receive
rights on exactly its own `cmd` topic — never one combined
`devices/{client_id}/#` wildcard for both directions, which would let a
device publish a fake command to its own `cmd` topic (self-spoofing a
server instruction) as well as read back topics it has no reason to. The
client ID itself is bound to the username at creation time, so a leaked
password alone doesn't let an attacker reconnect under a different client
ID.

The three server-side jobs that talk to the broker are also separate,
narrowly-scoped MQTT principals, not one shared account: `dynsec-admin`
(only `$CONTROL/dynamic-security/*`, used to provision/revoke device
credentials), `collector` (subscribe-only, `devices/+/{telemetry,status,event,ping}`,
never `cmd`), and `api-command` (publish-only, `devices/+/cmd`). A
compromised credential for any one of these can't be used to do either of
the other two jobs, and none of them can touch `$CONTROL` except
`dynsec-admin`.

Credentials are never stored as recoverable plaintext or reversible
ciphertext anywhere in this project's own database. The `devices` table
holds only display metadata (name, client ID, timestamps); the actual
password lives inside Mosquitto's Dynamic Security store, which — like
any reasonable auth store — only ever accepts a new password, never
returns an existing one. The dashboard shows a freshly generated
credential exactly once, at creation or regeneration time. If it's lost,
the only correct recovery is to regenerate a new one; there is
deliberately no "show my old password again" path, because there is
nothing that could show it.

## Dashboard authentication

The dashboard has exactly one account, provisioned from `ADMIN_EMAIL`/
`ADMIN_PASSWORD` on first boot. The password is bcrypt-hashed at rest.
Login issues a bearer session token (random 32 bytes), kept in the
browser's `sessionStorage` (cleared when the tab closes) and sent as an
`Authorization: Bearer` header on every API call — the same pattern used
elsewhere for small internal admin dashboards, not a custom scheme
invented for this project.

Failed logins are tracked per email address: 10 failures within a 5-minute
window locks that account out for 5 minutes, independent of source IP.
(IP-based limiting isn't meaningful behind most reverse proxies without
extra configuration to preserve the real client address, so this tracks
the thing that actually identifies an attack — repeated attempts against
one account.)

## Input validation

Every field read from a request body is runtime-type-checked
(`requireString`/`optionalString` in `validation.ts`) before it reaches a
SQL query. All SQL uses parameterized queries via `better-sqlite3` — no
string concatenation into SQL text anywhere in this codebase.

## Rate limiting and storage caps

Enforced per device, with values configurable per deployment
(`RATE_LIMIT_MSG_PER_MIN`, `STORAGE_CAP_MB`) — there's no per-plan tiering,
just one flat set of limits for the whole instance, since a self-hosted
instance has one operator setting limits for their own devices. A separate,
per-message bound (`MAX_PAYLOAD_BYTES`, `MAX_PAYLOAD_KEYS`,
`MAX_PAYLOAD_DEPTH`) rejects an oversized or arbitrarily-nested single
message before it's even counted against the cumulative storage cap.

The storage-cap check is a single atomic SQL `UPDATE` (check-and-increment
in one statement), not a separate read-then-write — SQLite serializes all
writers on the database file, so there's no window for two concurrent
messages to both pass a check and jointly push usage over the limit. This
specific race condition is a real, previously-encountered class of bug in
distributed databases; SQLite's single-writer model rules it out
structurally rather than requiring careful application-level locking.

## Transport security

- **Dashboard/API is reachable over plain HTTP on the server's IP,
  unconditionally.** Caddy's `:80` site block has no domain/SNI matching
  involved at all, so this never depends on any configuration being
  correct — it's the guaranteed fallback.
- **A domain is optional and dashboard-managed**, not `.env`-managed.
  Setting or changing it (Settings page → `PUT /settings/domain`) writes
  it to SQLite, then `api` pushes Caddy's *entire* live config to it via
  `POST http://caddy:2019/load` (Caddy's admin API) — a full hot-swap of
  the running config, no restart. Caddy's admin API is bound to
  `0.0.0.0:2019` so `api` can reach it over the docker network, but it is
  **never published to the host** — nothing outside these three
  containers can reach it. Automatic HTTPS (Let's Encrypt) then applies
  to the new domain the normal way.
- **MQTT**: plain (1883) and WebSocket (9001) are always available; MQTTS
  (8883) activates once a certificate for the currently-configured domain
  exists. Mosquitto has no HTTP server of its own to query `api` for the
  current domain, so `api` writes it to a small file on a volume shared
  with mosquitto (`/settings-shared/domain.txt`) every time it changes (and
  again on every `api` boot, as a self-heal); mosquitto polls that file
  every 30 seconds. Mosquitto and Caddy share the same certificate
  (obtained by Caddy, synced into Mosquitto's volume) rather than running
  two separate ACME clients, and doesn't hot-reload it on its own, so
  that same 30-second poll also picks up certificate renewals — a
  well-configured instance sees a refresh land within half a minute, not
  instantly. Documented rather than promised as zero-downtime, because a
  broker reload is sub-second, not literally invisible.
- **The resource-monitoring agent** (`iotstack-agent`, a separate process
  on the VPS host — see [Architecture](001_architecture.en.md#resource-monitoring))
  is reached by `api` over a unix socket — the agent listens at
  `/run/iotstack-agent/agent.sock` on the host (a systemd
  `RuntimeDirectory`, since the host's own `/run` is root-owned and the
  agent runs as a dedicated non-root user), bind-mounted to
  `/run/iotstack-agent.sock` inside only the `api` container.
  The socket is world-connectable (`0666`) rather than restricted to a
  matching uid, because it only ever serves read-only, non-secret usage
  numbers — no credentials, no control operations — and is unreachable
  outside this host's own filesystem namespace to begin with. This was
  chosen over a TCP port specifically to avoid the network-exposure
  question a loopback/host-gateway approach would raise, and over
  bind-mounting `/proc`/`/sys` into `api` directly, which would have
  widened that one container's own access far more than a single socket
  file does.

## Email (SMTP)

Optional, off by default. The dashboard's Settings page accepts SMTP
credentials, but they are only ever saved once the server has opened a
real connection and verified them — a failed attempt never touches the
previously-saved (working) configuration, so the feature can't silently
end up "configured but broken." The SMTP password is stored in SQLite
in the same trust boundary as every other secret in this project
(`DYNSEC_CONTROLLER_PASSWORD` in `.env`, device credentials inside
Mosquitto's own store) — readable only by whoever can read the server's
filesystem, which is already "game over" for a single-operator instance.
It is never returned by any API response; re-saving SMTP settings always
requires re-entering the password.

## Startup safety

The `api` service refuses to start when `NODE_ENV=production` and any of
`ADMIN_PASSWORD`, `SESSION_SECRET`, `DYNSEC_CONTROLLER_PASSWORD`,
`MQTT_COLLECTOR_PASSWORD`, or `MQTT_API_COMMAND_PASSWORD` still match the
placeholder value shipped in `.env.example` — catching "forgot to change
the default secret before deploying" at boot instead of silently running
with a known password.

## Known limitations

Documented rather than hidden, in the spirit of not overclaiming:

- **No horizontal scaling.** Rate limiting and login backoff are in-process
  memory, correct only when `api` runs as a single instance (which is the
  only supported deployment shape today — see [Architecture](architecture)
  for why). Running more than one `api` replica would silently multiply
  every device's effective rate limit by the replica count.
- **No device-level auth backoff.** Because Mosquitto authenticates
  devices itself (not via a callback this project controls), there's no
  hook to count and lock out repeated failed device-login attempts the
  way the dashboard's own login is protected. Mosquitto has no built-in
  brute-force protection for this either. For a small number of trusted
  devices on a single maker's instance this is a reasonable tradeoff, but
  it is a real gap versus a dedicated multi-tenant platform.
- **No plan-change retention recompute.** A message's retention deadline
  is fixed at insert time from the `RAW_RETENTION_DAYS` value in effect
  then. Changing that setting later doesn't recompute the deadline for
  already-stored messages.
- **No RabbitMQ/Mosquitto clustering.** This targets one broker on one
  VPS. If message volume or device count outgrows a single small VPS, the
  right move is a bigger VPS or migrating to a dedicated multi-tenant IoT
  platform — not clustering this project's broker, which isn't designed
  for that.
- **Certificate/domain reload isn't instant.** See the transport security
  section above — a renewed or changed MQTTS certificate can take up to
  30 seconds to be picked up by Mosquitto.

## Reporting a vulnerability

Open an issue in this repository, or contact the maintainer directly if
the issue involves sensitive details you'd rather not post publicly.

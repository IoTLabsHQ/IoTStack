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
another service. Every device's role grants access to exactly one topic
prefix (`devices/{client_id}/#`), and the client ID itself is bound to the
username at creation time, so a leaked password alone doesn't let an
attacker reconnect under a different client ID.

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

Both are enforced per device, with values configurable per deployment
(`RATE_LIMIT_MSG_PER_MIN`, `STORAGE_CAP_MB`) — there's no per-plan tiering,
just one flat set of limits for the whole instance, since a self-hosted
instance has one operator setting limits for their own devices.

The storage-cap check is a single atomic SQL `UPDATE` (check-and-increment
in one statement), not a separate read-then-write — SQLite serializes all
writers on the database file, so there's no window for two concurrent
messages to both pass a check and jointly push usage over the limit. This
specific race condition is a real, previously-encountered class of bug in
distributed databases; SQLite's single-writer model rules it out
structurally rather than requiring careful application-level locking.

## Transport security

- **Dashboard/API**: HTTPS via Caddy, automatic (Let's Encrypt) once
  `DOMAIN` is set. HTTP requests are redirected to HTTPS.
- **MQTT**: plain (1883) and WebSocket (9001) are always available; MQTTS
  (8883) activates automatically once a certificate for `DOMAIN` exists.
  Mosquitto and Caddy share the same certificate (obtained by Caddy,
  synced into Mosquitto's volume) rather than running two separate ACME
  clients. Mosquitto doesn't hot-reload a renewed certificate on its own,
  so a background check every 6 hours picks up renewals and reloads the
  broker — a well-configured production instance sees a certificate
  refresh land within a few hours of Caddy renewing it, not instantly.
  This is documented rather than promised as zero-downtime, because it
  isn't quite that — a broker reload is sub-second, not literally
  invisible.

## Startup safety

The `api` service refuses to start when `NODE_ENV=production` and any of
`ADMIN_PASSWORD`, `SESSION_SECRET`, or `DYNSEC_CONTROLLER_PASSWORD` still
match the placeholder value shipped in `.env.example` — catching "forgot
to change the default secret before deploying" at boot instead of
silently running with a known password.

## Known limitations

Documented rather than hidden, in the spirit of not overclaiming:

- **No horizontal scaling.** Rate limiting and login backoff are in-process
  memory, correct only when `api` runs as a single instance (which is the
  only supported deployment shape today — see [`ARCHITECTURE.md`](ARCHITECTURE.md)
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
- **Certificate reload isn't instant.** See the transport security section
  above — a renewed MQTTS certificate can take up to 6 hours to be picked
  up by Mosquitto.

## Reporting a vulnerability

Open an issue in this repository, or contact the maintainer directly if
the issue involves sensitive details you'd rather not post publicly.

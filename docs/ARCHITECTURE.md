# Architecture

## Overview

```
Browser/ESP32 ──HTTPS/WSS──► Caddy (automatic HTTPS, reverse proxy)
                                 ├─► dashboard (static SPA, built in)
                                 └─► api:3000 (REST, /api/*)

ESP32 ──MQTT :1883, MQTTS :8883, WS :9001── Mosquitto (+ Dynamic Security plugin)
                                                │
                                                │  $CONTROL/dynamic-security/v1
                                                │  (credential/ACL management, live)
                                                │
                                                │  devices/# (message collection, QoS 1)
                                                ▼
                                              api ──► SQLite (single file)
```

Three containers:

- **mosquitto** — the actual MQTT broker (Eclipse Mosquitto), plus its
  built-in Dynamic Security plugin for authentication and per-device
  topic authorization. No custom auth backend, no HTTP callback on every
  connection — the broker owns identity and access control natively.
- **api** — a small Node.js/Express service with three jobs:
  1. REST API for the dashboard (login, device CRUD, message/stats queries).
  2. Pushes credential/ACL changes into Mosquitto's Dynamic Security plugin
     when a device is created, regenerated, or deleted.
  3. Subscribes to `devices/#` as a message collector, persisting messages
     to SQLite and enforcing the rate limit and storage cap.
- **caddy** — reverse proxy and static file server for the dashboard.
  Handles automatic HTTPS (Let's Encrypt) once a domain is configured.

Everything is single-instance by design — this targets one maker running
one broker for their own devices, not a multi-tenant deployment. That
choice simplifies several things noted below (no distributed rate-limiter
state, no session store beyond an in-memory map).

## Device identity and topic isolation

Each device gets a `client_id`, used both as its MQTT identity and as the
prefix of every topic it's allowed to use: `devices/{client_id}/...`.

When a device is created, `api` sends three commands to Mosquitto's
Dynamic Security plugin over its `$CONTROL/dynamic-security/v1` topic API:

1. `createRole` — a role scoped to exactly this device
   (`role_{client_id}`).
2. `addRoleACL` (`publishClientSend`, `subscribePattern`) — both granting
   only `devices/{client_id}/#`, a topic wildcard computed from the actual
   client ID string.
3. `createClient` — the device's username/password, with `clientid` bound
   to the same `client_id`. Binding the connection's client ID to the
   username means a stolen password alone isn't enough to connect under a
   different identity — the client ID has to match too.

> **Why not one shared role with a `%c` (client-id) placeholder pattern?**
> Mosquitto's Dynamic Security plugin documents `%c`/`%u` substitution in
> role ACL topic patterns (e.g. one role with `devices/%c/#` covering every
> device). Verified directly against a real broker that this does not
> apply for `subscribePattern` in the version this project pins — a
> client with a `%c`-based rule has its subscribe denied outright. A
> concrete, per-device role with the literal topic computed in application
> code works correctly and was confirmed with a real publish/subscribe
> round trip plus a cross-device isolation check (one device's messages
> are not visible to another). If a future Mosquitto release fixes the
> substitution behavior, collapsing to one shared parametrized role would
> reduce plugin state, but isn't required for correctness.

All of this happens live over MQTT messages — no config file reload, no
broker restart, no brief window where a just-created device can't connect
yet.

## Message ingestion pipeline

The `api` service's collector subscribes to `devices/#` at QoS 1 using the
same controller account that manages Dynamic Security (its `admin` role
already has broad subscribe rights). For each message:

1. **Message-type check** — the topic's last segment must be one of
   `ping`, `status`, `telemetry`, `cmd`. Anything else is dropped.
2. **Device lookup** — the topic's `client_id` segment must match a known
   device. Unknown client IDs are dropped (this can only happen for a
   device that existed and was since deleted, or a malformed topic — the
   broker-level ACL already prevents anyone from publishing under a
   `client_id` they don't own).
3. **Rate limit** — a fixed 1-minute-window counter per device, in memory
   (`RATE_LIMIT_MSG_PER_MIN`). Over the limit → dropped, silently.
4. **Storage cap** — a single atomic `UPDATE` against the device's
   `storage_usage` row, checked and incremented in one SQL statement
   (`STORAGE_CAP_MB`). SQLite's single-writer model makes this
   inherently race-free — see [`SECURITY.md`](SECURITY.md) for why that
   matters.
5. **Persist** — written to `messages` with an `expires_at` computed from
   `RAW_RETENTION_DAYS` at insert time.

A background sweep (hourly) deletes rows past their `expires_at` — SQLite
has no native TTL index the way some databases do, so this is an explicit
periodic job instead.

## Data model

Single SQLite file (`better-sqlite3`, WAL mode). Four tables:

- `admin_users` — the single dashboard account, seeded from `ADMIN_EMAIL`/
  `ADMIN_PASSWORD` on first boot if the table is empty. Password stored as
  a bcrypt hash.
- `devices` — `client_id`, `mqtt_username` (currently always equal to
  `client_id`), a display name, and timestamps. **Does not store the MQTT
  password or its hash** — that lives entirely inside Mosquitto's Dynamic
  Security plugin store, which never returns it once set. See
  [`SECURITY.md`](SECURITY.md) for what this means for the dashboard's
  "show once" credential UX.
- `messages` — one row per persisted message, with the topic, type,
  payload, byte size, and TTL deadline.
- `storage_usage` — one row per device, a running byte counter, seeded to
  zero at device creation so the atomic cap check always has a row to
  match against.

## Why these choices instead of the more common alternatives

This project's logic (validation, atomic storage accounting, rate
limiting, TTL retention, health checks that reflect real component state)
was carried over from a larger, previously-hardened MQTT service built for
a multi-tenant cloud deployment. Several infrastructure choices were
deliberately made differently here, because the target is different — one
maker, one small VPS, a few dozen devices — not a shared multi-tenant
platform:

- **Mosquitto instead of a heavier AMQP-based broker.** A general-purpose
  message broker with an MQTT adapter carries meaningfully more baseline
  memory than a broker built for MQTT specifically. On a 1-2 GB VPS, that
  difference is the gap between comfortable headroom and constantly
  running close to the ceiling.
- **SQLite instead of a client-server database.** No separate database
  container, no network hop for every query, and backup is "copy one
  file." A client-server database earns its keep at a scale — many
  concurrent writers across multiple app instances — this project isn't
  built for.
- **No Redis / shared cache.** Rate-limit and login-backoff counters live
  in the `api` process's memory. This is only correct because the service
  runs as a single instance — if this project ever needed to scale
  horizontally, that assumption would need to be revisited (see
  [`SECURITY.md`](SECURITY.md)'s limitations section).
- **Mosquitto's Dynamic Security plugin instead of a custom HTTP auth
  callback.** No extra network round trip per connection, no separate
  service that has to stay up for devices to authenticate at all — the
  broker owns identity natively.

## Resource footprint

Approximate idle RAM, measured against the images this project pins:

| Service | Idle RAM | Notes |
|---|---|---|
| mosquitto | ~15-30 MB | Grows slowly with connection count; a few dozen devices stays well under 50 MB |
| api | ~60-100 MB | Express + better-sqlite3 + mqtt.js |
| caddy | ~20-40 MB | Reverse proxy + static file serving |

`mem_limit` is set on all three services in `docker-compose.yml` as a
safety net — not because any of them is expected to approach it under
normal use, but so a misbehaving device (e.g. a retry-looping firmware
bug) degrades that one container instead of the whole VPS.

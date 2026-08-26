# IoTStack

A self-hosted MQTT broker with a built-in web dashboard, built for makers who
want to run their own IoT infrastructure instead of depending on a cloud
service. Deploy it on a small VPS, open the dashboard, create credentials
for a device, and start coding.

## What you get

- **MQTT broker** (Mosquitto) — plain MQTT, MQTTS (TLS), and MQTT over
  WebSocket, so both firmware and browser clients can connect.
- **A dashboard** — create and manage device credentials, watch messages
  arrive in real time, send commands, see storage usage per device.
- **Per-device isolation** — every device gets its own credential and can
  only publish/subscribe under its own topic prefix. One compromised device
  credential can't see or touch another device's data.
- **Sane defaults for a small deployment** — a flat rate limit and storage
  cap apply to every device (configurable), old messages expire
  automatically, and the whole stack is designed to run comfortably on a
  1-2 CPU / 2 GB RAM VPS.
- **Works over your server's IP out of the box** — plain HTTP, no domain
  or TLS setup required to get started.
- **Automatic HTTPS, whenever you want it** — add a domain anytime from
  the dashboard's Settings page (or change it again later, no limit) and
  it gets a real certificate live, with no restart.

## Quick start

```bash
git clone <this-repository> iotstack
cd iotstack
cp .env.example .env
# edit .env: set ADMIN_EMAIL, ADMIN_PASSWORD, and generate real secrets for
# SESSION_SECRET / DYNSEC_CONTROLLER_PASSWORD (see the comments in the file)
docker compose up -d --build
```

Open `http://<your-server-ip>`, log in with the admin account you
configured, and create your first device. Add a domain anytime from the
dashboard's Settings page to get `https://your-domain` with a real
certificate — no `.env` edit, no restart. The dashboard shows the exact
host/port and credential to put in your firmware.

## Connecting a device

Every device gets:

- A **client ID** — also the prefix of every topic it's allowed to use:
  `devices/{client_id}/...`
- A **username and password** — shown once when the device is created (or
  regenerated). If you lose it, regenerate a new one; the old credential
  stops working immediately.

Example (plain MQTT, port 1883):

```
Host:     your-server-or-domain
Port:     1883 (plain), 8883 (TLS, once a domain is set from Settings), 9001 (WebSocket)
Username: <shown in dashboard>
Password: <shown in dashboard>
Publish:  devices/<client_id>/telemetry
Subscribe: devices/<client_id>/cmd
```

Message types recognized by the collector: `ping`, `status`, `telemetry`,
`cmd` — a message published to any other topic suffix is dropped.

## Configuration

All configuration is environment variables in `.env` — see `.env.example`
for the full list with comments. The important ones:

| Variable | What it controls |
|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Dashboard login, seeded once on first boot |
| `DOMAIN` | Optional first-boot convenience only — sets the initial domain. Change it anytime after that from the dashboard's Settings page instead; `.env` is never re-read for this. |
| `RATE_LIMIT_MSG_PER_MIN` | Messages/minute allowed per device |
| `STORAGE_CAP_MB` | Stored message data allowed per device |
| `RAW_RETENTION_DAYS` | How long messages are kept before automatic deletion |

## Architecture and security

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit
together, and [`docs/SECURITY.md`](docs/SECURITY.md) for the security model
and its known limitations.

## Deployment

Have a fresh VPS and SSH access? One command deploys the whole stack:

```bash
deploy/bootstrap.sh root@your-server-ip
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for server requirements,
what that command does, flags, and the manual steps if you'd rather run
them by hand.

## Resource footprint

Three containers, roughly 150-300 MB combined RAM at idle: Mosquitto, a
small Node.js API/collector service, and Caddy as the HTTPS front door.
Comfortably fits a 1-2 CPU / 2 GB RAM VPS for a few dozen devices.

## License

MIT — see [`LICENSE`](LICENSE).

---

Maintained by IoTLabs.

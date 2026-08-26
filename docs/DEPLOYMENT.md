# Deployment

## Server requirements

| Resource | Minimum | Notes |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU gives comfortable headroom for a few dozen devices |
| RAM | 2 GB | See [`ARCHITECTURE.md`](ARCHITECTURE.md#resource-footprint) for the per-service breakdown (~150-300 MB idle) |
| Disk | 20-40 GB | Mostly OS + Docker images; message storage is capped by `STORAGE_CAP_MB` per device, so total disk use scales with device count × that cap, not with traffic volume |
| OS | Ubuntu 22.04/24.04 LTS | The admin-user setup script below assumes `apt`/`systemctl`/`sshd_config.d` |

A 2 vCPU / 2 GB RAM / 40 GB disk VPS (e.g. a small droplet/box from any
mainstream provider) runs this stack comfortably for a personal or small
team's device fleet.

## Prerequisites on the server

- **Docker Engine + the Docker Compose plugin** (`docker compose`, not the
  standalone `docker-compose` v1 binary). Install via the official
  convenience script or your distro's Docker repo — see
  [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).
- **A DNS A record** pointing your domain at the server's IP, if you want
  automatic HTTPS (`DOMAIN` in `.env` — see the main [`README.md`](../README.md#configuration)).
  Not required for a plain HTTP/local setup.
- **Open inbound ports**: `22` (SSH), `80`/`443` (dashboard, HTTP→HTTPS),
  `1883`/`8883`/`9001` (MQTT plain/TLS/WebSocket).

## Automated deploy (recommended)

From your own machine — not the server — with this repository checked
out and your SSH key already authorized on the target:

```bash
deploy/bootstrap.sh root@your-server-ip
```

That single command does everything: creates a non-root admin user
with SSH-key-only access (skipped if one already exists), installs
Docker Engine + the Compose plugin (skipped if already installed),
copies this checkout to the server, generates `.env` with real random
secrets on first deploy, and starts the stack — then waits for the
API to report healthy before it exits.

A VPS you already have an admin user on works the same way, just
target that user instead of `root`:

```bash
deploy/bootstrap.sh iotstack@your-server-ip
```

Optional flags: `--domain example.com` (for a real Let's Encrypt
certificate instead of the self-signed one for `localhost`) and
`--admin-email you@example.com` (skips the interactive prompt). If
`--admin-email` is given without a password, one is generated and
printed once at the end — save it immediately.

Re-running `bootstrap.sh` against an already-deployed server is safe:
it skips steps that are already done and updates the running code
without touching an existing `.env`.

## Manual deploy

The steps `bootstrap.sh` automates, for reference or if you'd rather
run them by hand.

### First-time server access

Don't operate the server as `root` day-to-day. Set up a dedicated
non-root admin user with SSH-key-only access and passwordless `sudo`:

- [`Hướng dẫn tạo user quản trị cho VPS.md`](Hướng%20dẫn%20tạo%20user%20quản%20trị%20cho%20VPS.md) —
  full walkthrough (Vietnamese), including generating a dedicated local SSH
  key for the server and an `~/.ssh/config` alias.
- [`setup-vps-user.sh`](setup-vps-user.sh) — the bootstrap script referenced
  by that guide.

### Deploying

Once the admin user is set up and Docker is installed, copy this
checkout to the server (`rsync`, `scp`, or your own means — the
repository doesn't have to be public), then on the server:

```bash
cd iotstack
cp .env.example .env
# edit .env — see README.md's Configuration section
docker compose up -d --build
```

See the main [`README.md`](../README.md) for the full quick-start and
post-deploy steps (creating your first device, connecting firmware).

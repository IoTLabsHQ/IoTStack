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

## First-time server access

Don't operate the server as `root` day-to-day. Set up a dedicated
non-root admin user with SSH-key-only access and passwordless `sudo`:

- [`Hướng dẫn tạo user quản trị cho VPS.md`](Hướng%20dẫn%20tạo%20user%20quản%20trị%20cho%20VPS.md) —
  full walkthrough (Vietnamese), including generating a dedicated local SSH
  key for the server and an `~/.ssh/config` alias.
- [`setup-vps-user.sh`](setup-vps-user.sh) — the bootstrap script referenced
  by that guide.

## Deploying

Once the admin user is set up and Docker is installed:

```bash
git clone <this-repository> iotstack
cd iotstack
cp .env.example .env
# edit .env — see README.md's Configuration section
docker compose up -d --build
```

See the main [`README.md`](../README.md) for the full quick-start and
post-deploy steps (creating your first device, connecting firmware).

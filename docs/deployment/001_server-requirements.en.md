# Server Requirements

## Minimum server specs

| Resource | Minimum | Notes |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU gives comfortable headroom for a few dozen devices |
| RAM | 2 GB | See [Architecture](../reference/001_architecture.en.md#resource-footprint) for the per-service breakdown (~150-300 MB idle) |
| Disk | 20-40 GB | Mostly OS + Docker images; message storage is capped by `STORAGE_CAP_MB` per device, so total disk use scales with device count × that cap, not with traffic volume |
| OS | Ubuntu 22.04/24.04 LTS | The admin-user setup guide assumes `apt`/`systemctl`/`sshd_config.d` |

A 2 vCPU / 2 GB RAM / 40 GB disk VPS (e.g. a small droplet/box from any
mainstream provider) runs this stack comfortably for a personal or small
team's device fleet.

## Prerequisites on the server

- **Docker Engine + the Docker Compose plugin** (`docker compose`, not the
  standalone `docker-compose` v1 binary). Install via the official
  convenience script or your distro's Docker repo — see
  [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).
  The [one-command installer](002_installer.en.md) does this for you
  automatically.
- **A DNS A record** pointing your domain at the server's IP, if you want
  automatic HTTPS. Not required for a plain HTTP/local setup — you can add
  a domain anytime later from the dashboard's Settings page.
- **Open inbound ports**: `22` (SSH), `80`/`443` (dashboard, HTTP→HTTPS),
  `1883`/`8883`/`9001` (MQTT plain/TLS/WebSocket).

#!/usr/bin/env bash

# Installs iotstack-agent as a systemd service on the VPS host — the piece
# that gives the `api` container real CPU/RAM/disk visibility without
# widening any of the three app containers' own access (see
# docs/reference/002_security.en.md). Safe to re-run: skips reinstalling
# (and restarting — no monitoring gap on redeploy) when the built binary is
# byte-identical to what's already installed.
#
# Must run BEFORE `docker compose up` — the socket this creates has to
# exist as a real file when Docker binds it into the api container, or
# Docker silently bind-mounts an empty directory there instead.

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEW_BIN="${APP_DIR}/agent/bin/iotstack-agent"
INSTALLED_BIN="/usr/local/bin/iotstack-agent"
UNIT_FILE="/etc/systemd/system/iotstack-agent.service"
SERVICE_USER="iotstack-agent"
SOCKET_PATH="/run/iotstack-agent/agent.sock"


# ============================================================
# Logging
# ============================================================

log() {
    echo "[install-agent] $*"
}


# ============================================================
# Idempotency: skip entirely if the binary is unchanged
# ============================================================

if [[ -f "${INSTALLED_BIN}" ]]; then
    NEW_SHA="$(sha256sum "${NEW_BIN}" | awk '{print $1}')"
    OLD_SHA="$(sha256sum "${INSTALLED_BIN}" | awk '{print $1}')"
    if [[ "${NEW_SHA}" == "${OLD_SHA}" ]] && systemctl is-active --quiet iotstack-agent; then
        log "iotstack-agent unchanged and already running — skipping reinstall."
        exit 0
    fi
fi


# ============================================================
# Dedicated system user — needs docker group membership to reach
# the Docker daemon's socket; /proc and /sys are readable by any
# user by default for the stats this agent needs.
# ============================================================

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
    log "Creating system user ${SERVICE_USER}..."
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

if ! groups "${SERVICE_USER}" | grep -qw docker; then
    log "Adding ${SERVICE_USER} to the docker group..."
    sudo usermod -aG docker "${SERVICE_USER}"
fi


# ============================================================
# Install the binary
# ============================================================

log "Installing binary to ${INSTALLED_BIN}..."
sudo cp "${NEW_BIN}" "${INSTALLED_BIN}"
sudo chmod 755 "${INSTALLED_BIN}"


# ============================================================
# systemd unit
# ============================================================

log "Writing systemd unit..."
sudo tee "${UNIT_FILE}" >/dev/null <<EOF
[Unit]
Description=IoTStack resource monitoring agent
After=network.target docker.service
Requires=docker.service

[Service]
ExecStart=${INSTALLED_BIN}
Restart=always
RestartSec=2
User=${SERVICE_USER}
Group=${SERVICE_USER}
NoNewPrivileges=true
ProtectSystem=strict
RuntimeDirectory=iotstack-agent
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now iotstack-agent


# ============================================================
# Wait for the socket to actually appear before returning —
# deploy-app.sh's `docker compose up` depends on it existing.
# ============================================================

for _ in $(seq 1 10); do
    if [[ -S "${SOCKET_PATH}" ]]; then
        log "Socket ready at ${SOCKET_PATH}."
        exit 0
    fi
    sleep 1
done

echo "[install-agent] ERROR: ${SOCKET_PATH} did not appear after starting iotstack-agent." >&2
sudo systemctl status iotstack-agent --no-pager || true
exit 1

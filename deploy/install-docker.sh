#!/usr/bin/env bash

set -Eeuo pipefail


# ============================================================
# Logging
# ============================================================

log() {
    echo "[install-docker] $*"
}


# ============================================================
# Skip if already installed
# ============================================================

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then

    log "Docker Engine and the Compose plugin are already installed."
    docker --version
    docker compose version

    exit 0

fi


# ============================================================
# Install via the official convenience script
# ============================================================

log "Installing Docker Engine + Compose plugin..."

curl -fsSL https://get.docker.com -o /tmp/get-docker.sh

sudo sh /tmp/get-docker.sh

rm -f /tmp/get-docker.sh


# ============================================================
# Let the current user run docker without sudo
# ============================================================

if ! groups "${USER}" | grep -qw docker; then

    log "Adding ${USER} to the docker group..."

    sudo usermod -aG docker "${USER}"

    log "Group membership updated. This only takes effect in a NEW SSH"
    log "session — the rest of this deploy still uses 'sudo docker' so it"
    log "doesn't need one."

fi


# ============================================================
# Finished
# ============================================================

log "================================================"
log "Docker installed."
docker --version
docker compose version
log "================================================"

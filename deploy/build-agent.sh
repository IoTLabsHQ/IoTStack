#!/usr/bin/env bash

# Builds the iotstack-agent static binary via a throwaway golang:alpine
# container — Docker is this project's one hard prerequisite (already
# installed by install-docker.sh before this runs), so this needs no Go
# toolchain on the host itself, matching how the app's own three services
# already build from source on the VPS via `docker compose up -d --build`.

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DIR="${APP_DIR}/agent"
BIN_PATH="${AGENT_DIR}/bin/iotstack-agent"


# ============================================================
# Logging
# ============================================================

log() {
    echo "[build-agent] $*"
}


# ============================================================
# Map uname -m to GOARCH
# ============================================================

case "$(uname -m)" in
    x86_64)
        GOARCH="amd64"
        ;;
    aarch64|arm64)
        GOARCH="arm64"
        ;;
    *)
        echo "[build-agent] Unsupported architecture: $(uname -m)" >&2
        exit 1
        ;;
esac


# ============================================================
# Build a static binary — CGO_ENABLED=0 means no libc dependency
# at all, so the resulting binary runs on the bare host directly,
# no runtime/interpreter required.
# ============================================================

log "Building iotstack-agent for linux/${GOARCH}..."

mkdir -p "${AGENT_DIR}/bin"

sudo docker run --rm \
    -v "${AGENT_DIR}:/src" \
    -w /src \
    -e CGO_ENABLED=0 \
    -e GOOS=linux \
    -e GOARCH="${GOARCH}" \
    -e GOCACHE=/tmp/gocache \
    golang:1.22-alpine \
    go build -ldflags="-s -w" -o /src/bin/iotstack-agent ./cmd/agent

log "Built ${BIN_PATH}"

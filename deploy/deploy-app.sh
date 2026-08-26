#!/usr/bin/env bash

set -Eeuo pipefail


# ============================================================
# Configuration (override via environment variables)
#
# This script runs from inside the app directory — the code is
# already there, synced by bootstrap.sh before this is invoked.
# ============================================================

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"


# ============================================================
# Logging
# ============================================================

log() {
    echo "[deploy-app] $*"
}

cd "${APP_DIR}"


# ============================================================
# Generate .env (only on first deploy — never overwrite an
# existing one, it may hold real device/admin data by now)
# ============================================================

if [[ -f .env ]]; then

    log ".env already exists, leaving it untouched."

else

    log "Generating .env..."

    if [[ -z "${ADMIN_EMAIL}" ]]; then
        read -r -p "Admin email for the dashboard: " ADMIN_EMAIL
    fi

    if [[ -z "${ADMIN_PASSWORD}" ]]; then
        ADMIN_PASSWORD="$(openssl rand -base64 18)"
        GENERATED_PASSWORD=true
    fi

    cp .env.example .env

    SESSION_SECRET="$(openssl rand -base64 32)"
    DYNSEC_CONTROLLER_PASSWORD="$(openssl rand -base64 24)"

    sed -i.bak \
        -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|" \
        -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" \
        -e "s|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" \
        -e "s|^DYNSEC_CONTROLLER_PASSWORD=.*|DYNSEC_CONTROLLER_PASSWORD=${DYNSEC_CONTROLLER_PASSWORD}|" \
        .env

    if [[ -n "${DOMAIN}" ]]; then
        echo "DOMAIN=${DOMAIN}" >> .env
    fi

    rm -f .env.bak

fi


# ============================================================
# Build and start
# ============================================================

log "Starting the stack (this can take a few minutes on first build)..."

sudo docker compose up -d --build


# ============================================================
# Healthcheck
# ============================================================

log "Waiting for the API to report healthy..."

HEALTH_URL="http://localhost/api/health"
ATTEMPTS=30
OK=false

for ((i = 1; i <= ATTEMPTS; i++)); do

    if curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" | grep -q "^200$"; then
        OK=true
        break
    fi

    sleep 2

done

if [[ "${OK}" != "true" ]]; then

    log "ERROR: stack did not become healthy within $((ATTEMPTS * 2))s."
    log "Check logs with: sudo docker compose -f ${APP_DIR}/docker-compose.yml logs"

    exit 1

fi


# ============================================================
# Finished
# ============================================================

log "================================================"
log "IoTStack is running."

if [[ -n "${DOMAIN}" ]]; then
    log "Dashboard: https://${DOMAIN}  (HTTPS activates automatically once DNS points here)"
else
    log "Dashboard: http://<this server's IP> — set a domain later from the dashboard's Settings page to enable HTTPS"
fi

if [[ "${GENERATED_PASSWORD:-false}" == "true" ]]; then
    log "Admin email:    ${ADMIN_EMAIL}"
    log "Admin password: ${ADMIN_PASSWORD}  (generated — save it now, shown only once)"
fi

log "================================================"

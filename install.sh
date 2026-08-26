#!/usr/bin/env bash

# Run this ON the target Linux server (Ubuntu/Debian), as the user that
# will own the deployment (root is fine for a brand new box — it does not
# create a separate admin user the way deploy/bootstrap.sh does).
#
#   curl -fsSL https://raw.githubusercontent.com/IoTLabsHQ/IoTStack/main/install.sh | sh
#
# Safe to re-run against an already-installed instance: it detects that
# and asks before touching anything.

set -Eeuo pipefail

export COMPOSE_PROJECT_NAME=iotstack

APP_DIR="${HOME}/iotstack"

# --- Source resolution ---------------------------------------------------
# DEV-ONLY override (never set this in the public one-liner instructions):
#   IOTSTACK_SOURCE_DIR=/path/to/local/checkout ./install.sh
# EVENTUAL PUBLIC DEFAULT (used once github.com/IoTLabsHQ/IoTStack is public):
#   curl -fsSL https://raw.githubusercontent.com/IoTLabsHQ/IoTStack/main/install.sh | sh
# ---------------------------------------------------------------------------
IOTSTACK_SOURCE_DIR="${IOTSTACK_SOURCE_DIR:-}"
IOTSTACK_SOURCE_URL="${IOTSTACK_SOURCE_URL:-https://github.com/IoTLabsHQ/IoTStack/archive/refs/heads/main.tar.gz}"

# Non-interactive overrides, for scripted/CI use — skip the matching prompt.
IOTSTACK_REINSTALL="${IOTSTACK_REINSTALL:-}"        # fresh | keep
IOTSTACK_DOMAIN_CHOICE="${IOTSTACK_DOMAIN_CHOICE:-}" # keep | new

DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"


# ============================================================
# Logging / prompting
# ============================================================

log() {
    echo "[install] $*"
}

# Works whether invoked directly (sh install.sh) or piped (curl | sh) —
# in the piped case stdin is the script itself, so prompts must read from
# the controlling terminal explicitly instead.
ask() {
    local prompt="$1" reply
    if [ -t 0 ]; then
        read -r -p "${prompt}" reply
    elif [ -e /dev/tty ]; then
        read -r -p "${prompt}" reply < /dev/tty
    else
        echo "[install] No TTY available to ask: ${prompt}" >&2
        exit 1
    fi
    echo "${reply}"
}


# ============================================================
# Step 1 — get the source onto this machine
# ============================================================

mkdir -p "${APP_DIR}"

if [[ -n "${IOTSTACK_SOURCE_DIR}" ]]; then

    log "Dev mode: syncing from ${IOTSTACK_SOURCE_DIR}..."

    command -v rsync >/dev/null || sudo apt-get -y -qq install rsync

    # Same incantation deploy/bootstrap.sh uses — --filter="P .env" is
    # required alongside the gitignore exclude, confirmed by a real
    # .env-deletion bug against a plain exclude alone.
    rsync -az --delete \
        --exclude=.git \
        --filter=":- .gitignore" \
        --filter="P .env" \
        "${IOTSTACK_SOURCE_DIR}/" "${APP_DIR}/"

else

    log "Downloading IoTStack from ${IOTSTACK_SOURCE_URL}..."

    curl -fsSL "${IOTSTACK_SOURCE_URL}" | tar -xz --strip-components=1 -C "${APP_DIR}"

fi


# ============================================================
# Step 2 — detect an existing install
# ============================================================

ALREADY_INSTALLED=false
if [[ -f "${APP_DIR}/docker-compose.yml" && -f "${APP_DIR}/.env" ]]; then
    ALREADY_INSTALLED=true
fi

HAS_DEVICE_DATA=false
if docker volume inspect iotstack_api_data >/dev/null 2>&1; then
    HAS_DEVICE_DATA=true
fi


# ============================================================
# Step 3 — reinstall confirmation (only if already installed)
# ============================================================

DO_REINSTALL=true

if [[ "${ALREADY_INSTALLED}" == "true" ]]; then

    if [[ -n "${IOTSTACK_REINSTALL}" ]]; then
        [[ "${IOTSTACK_REINSTALL}" == "fresh" ]] && DO_REINSTALL=true || DO_REINSTALL=false
    else
        log "IoTStack is already installed at ${APP_DIR}."
        if [[ "${HAS_DEVICE_DATA}" == "true" ]]; then
            log "Reinstalling fresh will DELETE all devices/messages/settings."
            log "Only .env is backed up — device/message data is never preserved on a fresh reinstall."
        fi
        reply="$(ask "Reinstall completely fresh? [y/N] ")"
        case "${reply}" in
            [yY]*) DO_REINSTALL=true ;;
            *) DO_REINSTALL=false ;;
        esac
    fi

    if [[ "${DO_REINSTALL}" != "true" ]]; then
        log "Leaving the existing install untouched. Nothing was changed."
        exit 0
    fi

else

    log "No existing install found — deploying fresh."

fi


# ============================================================
# Step 4 — detect an existing domain + SSL cert (before wiping
# anything — read straight out of the volumes, no live API needed
# so this works even against a stopped/broken instance)
# ============================================================

EXISTING_DOMAIN=""
HAS_CERT=false

if docker volume inspect iotstack_iotstack_settings >/dev/null 2>&1; then
    EXISTING_DOMAIN="$(docker run --rm -v iotstack_iotstack_settings:/v alpine cat /v/domain.txt 2>/dev/null || true)"
fi

if [[ -n "${EXISTING_DOMAIN}" ]] && docker volume inspect iotstack_caddy_data >/dev/null 2>&1; then
    if docker run --rm -v iotstack_caddy_data:/v alpine \
        test -f "/v/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${EXISTING_DOMAIN}/${EXISTING_DOMAIN}.crt" \
        2>/dev/null
    then
        HAS_CERT=true
    fi
fi

KEEP_DOMAIN=false

if [[ "${HAS_CERT}" == "true" ]]; then
    if [[ -n "${IOTSTACK_DOMAIN_CHOICE}" ]]; then
        [[ "${IOTSTACK_DOMAIN_CHOICE}" == "keep" ]] && KEEP_DOMAIN=true
    else
        log "Detected existing domain '${EXISTING_DOMAIN}' with a certificate already issued."
        reply="$(ask "Keep this domain and its SSL certificate? [Y/n] ")"
        case "${reply}" in
            [nN]*) KEEP_DOMAIN=false ;;
            *) KEEP_DOMAIN=true ;;
        esac
    fi
fi

if [[ "${KEEP_DOMAIN}" == "true" ]]; then
    DOMAIN="${EXISTING_DOMAIN}"
    log "Keeping domain ${DOMAIN} — its certificate will be preserved."
fi


# ============================================================
# Step 5 — backup (.env only — the only real "config" in this
# system; domain/SMTP live in the DB, which is never preserved
# on a reinstall by design) and clean
# ============================================================

if [[ "${ALREADY_INSTALLED}" == "true" ]]; then

    BACKUP_DIR="${HOME}/iotstack-backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${BACKUP_DIR}"
    cp "${APP_DIR}/.env" "${BACKUP_DIR}/.env" 2>/dev/null || true
    log ".env backed up to ${BACKUP_DIR} (device/message data is not included)."

    rm -f "${APP_DIR}/.env"

    ( cd "${APP_DIR}" && sudo docker compose down ) || true

    ALWAYS_WIPE_VOLUMES=(
        iotstack_api_data
        iotstack_mosquitto_data
        iotstack_mosquitto_log
        iotstack_mosquitto_conf.d
    )
    for v in "${ALWAYS_WIPE_VOLUMES[@]}"; do
        docker volume rm "${v}" >/dev/null 2>&1 || true
    done

    if [[ "${KEEP_DOMAIN}" != "true" ]]; then
        for v in iotstack_caddy_data iotstack_caddy_config iotstack_iotstack_settings; do
            docker volume rm "${v}" >/dev/null 2>&1 || true
        done
    fi

fi


# ============================================================
# Step 6 — install Docker (idempotent) and deploy
# ============================================================

chmod +x "${APP_DIR}/deploy/install-docker.sh" "${APP_DIR}/deploy/deploy-app.sh"

"${APP_DIR}/deploy/install-docker.sh"

DOMAIN="${DOMAIN}" ADMIN_EMAIL="${ADMIN_EMAIL}" "${APP_DIR}/deploy/deploy-app.sh"


# ============================================================
# Step 7 — on the keep-domain path, force a second Caddy-config
# push once the stack is confirmed healthy. api already re-pushes
# its live domain config on every boot as a self-heal, but caddy
# starts after api with no health-gate, so the very first push on
# a from-scratch multi-container boot can race caddy not being up
# yet and fail silently (only logged, not retried). caddy_config
# being preserved already covers most of this — this closes the
# race deterministically instead of relying on "usually fine."
# ============================================================

if [[ "${KEEP_DOMAIN}" == "true" ]]; then
    sleep 3
    ( cd "${APP_DIR}" && sudo docker compose restart api ) || true
fi


log "================================================"
log "Done."
log "================================================"

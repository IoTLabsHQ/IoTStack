#!/usr/bin/env bash

# Run this from your own machine, not on the server.
#
# Usage:
#   deploy/bootstrap.sh <ssh-target> [--domain example.com] [--admin-email you@example.com]
#
# <ssh-target> can be:
#   - root@1.2.3.4        a brand new VPS, only root SSH access exists yet
#   - iotstack@1.2.3.4     a server where the admin user is already set up
#   - an alias from your ~/.ssh/config that resolves to either of the above
#
# A brand new VPS only needs: the VPS itself, and your SSH key already
# authorized for the target user. Everything else — admin user creation,
# Docker, cloning the app, secrets, starting the stack — happens here.

set -Eeuo pipefail


# ============================================================
# Arguments
# ============================================================

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <ssh-target> [--domain DOMAIN] [--admin-email EMAIL]" >&2
    exit 1
fi

TARGET="$1"
shift

DOMAIN=""
ADMIN_EMAIL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --admin-email)
            ADMIN_EMAIL="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


# ============================================================
# Logging
# ============================================================

log() {
    echo "[bootstrap] $*"
}


# ============================================================
# Step 1 — admin user (only if we're still root)
# ============================================================

REMOTE_USER="$(ssh "${TARGET}" whoami)"
REMOTE_HOST="$(ssh -G "${TARGET}" | awk '/^hostname / { print $2 }')"

if [[ "${REMOTE_USER}" == "root" ]]; then

    log "Connected as root — creating the admin user first."

    scp "${SCRIPT_DIR}/../docs/setup-vps-user.sh" "${TARGET}:/root/setup-vps-user.sh"
    ssh "${TARGET}" "chmod 700 /root/setup-vps-user.sh && /root/setup-vps-user.sh"

    # setup-vps-user.sh always creates user "iotstack" and copies root's
    # authorized_keys to it, so the same local key works immediately.
    TARGET="iotstack@${REMOTE_HOST}"

    log "Admin user ready. Continuing as ${TARGET}."

else

    log "Connected as ${REMOTE_USER} — skipping admin user creation."

fi


# ============================================================
# Step 2 — Docker
# ============================================================

log "Installing Docker on ${TARGET}..."

scp "${SCRIPT_DIR}/install-docker.sh" "${TARGET}:~/install-docker.sh"
ssh "${TARGET}" "chmod +x ~/install-docker.sh && ~/install-docker.sh"


# ============================================================
# Step 3 — sync the app code
#
# Ships whatever is checked out locally, so it works whether or
# not the repo it came from is public — the server never needs
# to reach GitHub (or anywhere else) to get the code.
# ============================================================

REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE_HOME="$(ssh "${TARGET}" 'echo ${HOME}')"
APP_DIR="${REMOTE_HOME}/iotstack"

log "Syncing app code to ${TARGET}:${APP_DIR}..."

ssh "${TARGET}" "command -v rsync >/dev/null || sudo apt-get -y -qq install rsync"
ssh "${TARGET}" "mkdir -p '${APP_DIR}'"

rsync -az --delete \
    --exclude=.git \
    --filter=":- .gitignore" \
    "${REPO_ROOT}/" "${TARGET}:${APP_DIR}/"


# ============================================================
# Step 4 — deploy the app
# ============================================================

log "Deploying IoTStack on ${TARGET}..."

REMOTE_ENV="DOMAIN='${DOMAIN}' ADMIN_EMAIL='${ADMIN_EMAIL}'"

ssh -t "${TARGET}" "chmod +x '${APP_DIR}/deploy/deploy-app.sh' && ${REMOTE_ENV} '${APP_DIR}/deploy/deploy-app.sh'"


# ============================================================
# Finished
# ============================================================

log "================================================"
log "Done. IoTStack is deployed on ${TARGET}."
log "================================================"

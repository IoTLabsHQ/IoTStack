#!/usr/bin/env bash

set -Eeuo pipefail


# ============================================================
# Configuration
# ============================================================

# Administrative username.
#
# This is only a username used to identify the admin account
# and optionally make the VPS purpose easier to recognize.
#
# Change it to any username you want.
#
# Examples:
#   iotstack
#   deploy
#   admin
#   ops
#   devops
#   platform
#
USER_NAME="iotstack"

USER_HOME="/home/${USER_NAME}"

SUDOERS_FILE="/etc/sudoers.d/90-${USER_NAME}"

SSH_CONFIG_FILE="/etc/ssh/sshd_config.d/99-vps-security.conf"


# ============================================================
# Logging
# ============================================================

log() {
    echo "[vps-setup] $*"
}


# ============================================================
# Must run as root
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: This script must run as root."
    exit 1
fi


# ============================================================
# Create user
# ============================================================

if id "${USER_NAME}" >/dev/null 2>&1; then

    log "User ${USER_NAME} already exists."

else

    log "Creating user ${USER_NAME}..."

    useradd \
        --create-home \
        --shell /bin/bash \
        "${USER_NAME}"

fi


# ============================================================
# Add user to sudo group
# ============================================================

log "Adding ${USER_NAME} to sudo group..."

usermod -aG sudo "${USER_NAME}"


# ============================================================
# Configure passwordless sudo
# ============================================================

log "Configuring passwordless sudo..."

cat > "${SUDOERS_FILE}" <<EOF
${USER_NAME} ALL=(ALL:ALL) NOPASSWD: ALL
EOF

chmod 0440 "${SUDOERS_FILE}"


# ============================================================
# Validate sudoers
# ============================================================

if ! visudo -cf "${SUDOERS_FILE}"; then

    log "ERROR: Invalid sudoers configuration."

    rm -f "${SUDOERS_FILE}"

    exit 1

fi


# ============================================================
# Prepare SSH directory
# ============================================================

log "Preparing SSH directory..."

install \
    -d \
    -m 700 \
    -o "${USER_NAME}" \
    -g "${USER_NAME}" \
    "${USER_HOME}/.ssh"


# ============================================================
# Configure SSH key
# ============================================================

SSH_KEY_READY=false


if [[ -s /root/.ssh/authorized_keys ]]; then

    log "Copying root authorized_keys to ${USER_NAME}..."

    cp \
        /root/.ssh/authorized_keys \
        "${USER_HOME}/.ssh/authorized_keys"

    chown \
        "${USER_NAME}:${USER_NAME}" \
        "${USER_HOME}/.ssh/authorized_keys"

    chmod \
        600 \
        "${USER_HOME}/.ssh/authorized_keys"

    SSH_KEY_READY=true


elif [[ -s "${USER_HOME}/.ssh/authorized_keys" ]]; then

    log "${USER_NAME} already has authorized_keys."

    SSH_KEY_READY=true


else

    log "WARNING: No SSH public key found."

    log "Root SSH login will remain enabled to prevent lockout."

fi


# ============================================================
# Disable password for admin user
# ============================================================

passwd -l "${USER_NAME}" >/dev/null 2>&1 || true


# ============================================================
# SSH hardening
#
# Root SSH login is disabled only when the new user
# has a usable authorized_keys file.
# ============================================================

if [[ "${SSH_KEY_READY}" == "true" ]]; then

    log "Configuring SSH security..."

    cat > "${SSH_CONFIG_FILE}" <<EOF
# Managed by VPS setup script

PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF


    if sshd -t; then

        log "SSH configuration is valid."

        if systemctl is-active --quiet ssh; then
            systemctl reload ssh
        fi

    else

        log "ERROR: Invalid SSH configuration."

        rm -f "${SSH_CONFIG_FILE}"

        exit 1

    fi

fi


# ============================================================
# Finished
# ============================================================

log "================================================"
log "VPS user setup completed."
log ""
log "User: ${USER_NAME}"
log "Home: ${USER_HOME}"
log "Passwordless sudo: enabled"
log "SSH key available: ${SSH_KEY_READY}"
log ""
log "IMPORTANT:"
log "Keep the current root session open."
log "Open another terminal and test SSH using:"
log ""
log "ssh ${USER_NAME}@SERVER_IP"
log "================================================"

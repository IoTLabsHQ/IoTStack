# VPS Admin User Setup

This guide walks through creating a dedicated admin user for an Ubuntu VPS instead of using the `root` account directly for day-to-day operations.

Goals:

- Create a dedicated admin user.
- Add the user to the `sudo` group.
- Allow `sudo` without a password prompt.
- Copy the SSH public key from `root` to the new user, if one exists.
- Lock the new user's password.
- Only disable `root`'s SSH login once the new user already has an SSH key.
- The administrator runs the script once, deliberately, to set up the VPS.

> This guide uses the username `iotstack` as an example.

`iotstack` is just **a username chosen to make it easy to tell apart and identify which purpose or workload group the VPS is used for**. It is not a technically required name.

You can replace it with any username that fits your admin naming convention, for example:

```text
deploy
admin
ops
devops
platform
backend
webstack
appserver
```

In the script, simply change:

```bash
USER_NAME="iotstack"
```

to:

```bash
USER_NAME="deploy"
```

or whatever name you want.

The related paths are generated automatically based on `${USER_NAME}`.

For example:

```bash
USER_NAME="deploy"
```

will create:

```text
/home/deploy
/etc/sudoers.d/90-deploy
```

---

# 1. Why use a dedicated user instead of logging in as `root`

You should not delete the `root` account.

Linux still needs an account with:

```text
UID = 0
```

to perform system administration tasks.

What needs to change is **not using `root` as the SSH account and for day-to-day work**.

Instead:

```text
SSH
 │
 ▼
iotstack
 │
 ├── regular command
 │
 └── sudo <command>
        │
        ▼
      root
```

In the diagram above, `iotstack` can be replaced with any username.

## Comparison

| Criterion | Logging in directly as `root` | Dedicated user + `sudo` |
|---|---|---|
| Root exposed directly via SSH | 🔴 Yes | ✅ No |
| Default privileges after login | 🔴 Full root privileges | ✅ Regular user |
| When system privileges are needed | ⚠️ Always available | ✅ Deliberately invoked via `sudo` |
| Risk from a mistyped command | 🔴 High | ✅ Lower |
| SSH key | ⚠️ `/root/.ssh` | ✅ `/home/<user>/.ssh` |
| File ownership | ⚠️ Easy to create files owned by root | ✅ Clear ownership |
| Automation | ⚠️ Easy to end up depending on root | ✅ Has its own dedicated admin user |
| Audit | 🔴 Every action is attributed to root | ✅ Has its own identity |
| Multiple administrators | 🔴 Hard to manage | ✅ Easy to create multiple users |
| Disabling root SSH | 🔴 Not viable if still using root | ✅ Can be disabled |
| Recognizing the VPS's purpose | ⚠️ Every VPS is just `root` | ✅ Can name the username after its role |
| SSH key rotation | ⚠️ Keys centralized under root | ✅ Can be managed per user |
| Revoking admin access | 🔴 Hard if root is shared | ✅ Can lock the user/key |
| Restricting privileges later | 🔴 No | ✅ `sudo` can be restricted |
| Provisioning / CI/CD | ⚠️ Usable but not ideal | ✅ Better suited |
| Day-to-day server operation | 🔴 Not recommended | ✅ Recommended |

### Legend

- ✅ **Recommended** — the approach you should use.
- ⚠️ **Warning** — usable, but you need to understand the risk.
- 🔴 **Danger** — should be avoided in normal VPS operation.

Instead of:

```bash
ssh root@SERVER_IP
```

after setup, you should use:

```bash
ssh iotstack@SERVER_IP
```

When you need system privileges:

```bash
sudo <command>
```

For example:

```bash
sudo apt update
sudo systemctl restart ssh
sudo journalctl -xe
```

## Note on `NOPASSWD`

The script in this guide configures:

```text
iotstack ALL=(ALL:ALL) NOPASSWD: ALL
```

This means the `iotstack` user can run:

```bash
sudo -i
```

and become root without entering a password.

So:

```text
Dedicated user + NOPASSWD
        │
        ├── ✅ Does not expose root directly via SSH
        ├── ✅ Has its own admin identity
        ├── ✅ Has its own SSH key
        ├── ✅ Easy to manage and audit
        │
        └── ⚠️ If the user account is compromised,
             the attacker can sudo to root
```

This is not a strict least-privilege model, but it fits VPS instances that need simple administration and automation.

---

# 2. Architecture after setup

After running the script:

```text
Ubuntu VPS
│
├── root
│   ├── UID 0
│   ├── still exists
│   └── direct SSH login disabled
│
└── iotstack
    ├── /home/iotstack
    ├── SSH public key
    ├── member of the sudo group
    └── passwordless sudo
```

Access flow:

```text
Admin machine
     │
     │ SSH public key
     ▼
iotstack@SERVER_IP
     │
     ├── regular command
     │
     └── sudo
          │
          ▼
        root
```

If you change:

```bash
USER_NAME="deploy"
```

then use:

```bash
ssh deploy@SERVER_IP
```

---

# 3. First login to the VPS

For a fresh VPS, log in as root to perform the initial bootstrap:

```bash
ssh root@SERVER_IP
```

Keep this root session open throughout the setup process.

Do not close the root session until you've confirmed the new user can SSH in and use `sudo` successfully.

---

# 4. Create the setup script

Create the file:

```bash
nano /root/setup-vps-user.sh
```

Add the following content:

```bash
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
```

---

# 5. Choosing a username

Before running the script, edit:

```bash
USER_NAME="iotstack"
```

`iotstack` is just a sample username.

You can change it to:

```bash
USER_NAME="deploy"
```

or:

```bash
USER_NAME="ops"
```

or:

```bash
USER_NAME="platform"
```

No need to edit anything else.

The script uses:

```bash
USER_HOME="/home/${USER_NAME}"
```

and:

```bash
SUDOERS_FILE="/etc/sudoers.d/90-${USER_NAME}"
```

so every path updates automatically.

For example:

```bash
USER_NAME="deploy"
```

corresponds to:

```text
/home/deploy
/etc/sudoers.d/90-deploy
```

---

# 6. Grant execute permission

Run:

```bash
chmod 700 /root/setup-vps-user.sh
```

Check:

```bash
ls -l /root/setup-vps-user.sh
```

Expected output similar to:

```text
-rwx------ 1 root root ... /root/setup-vps-user.sh
```

---

# 7. Run the script

Run:

```bash
/root/setup-vps-user.sh
```

Or:

```bash
bash /root/setup-vps-user.sh
```

The script performs:

```text
Create user
    ↓
Add sudo group
    ↓
Configure NOPASSWD
    ↓
Validate sudoers
    ↓
Create ~/.ssh
    ↓
Copy authorized_keys
    ↓
Set ownership + permissions
    ↓
Lock password login
    ↓
Configure SSH security
    ↓
Validate sshd
    ↓
Disable root SSH if the SSH key is ready
```

A successful run looks like:

```text
[vps-setup] ================================================
[vps-setup] VPS user setup completed.

[vps-setup] User: iotstack
[vps-setup] Home: /home/iotstack
[vps-setup] Passwordless sudo: enabled
[vps-setup] SSH key available: true
```

---

# 8. Do not close the current root session

After the script finishes, keep the current root terminal open.

Open another terminal to test the new user:

```bash
ssh iotstack@SERVER_IP
```

If you changed the username:

```bash
ssh deploy@SERVER_IP
```

Only close the old root session after confirming that all the verification steps below succeed.

---

# 9. Verify the new user

After SSHing in as the new user:

```bash
whoami
```

Output:

```text
iotstack
```

Check the user and groups:

```bash
id
```

Expected output similar to:

```text
uid=1001(iotstack)
gid=1001(iotstack)
groups=1001(iotstack),27(sudo)
```

Or:

```bash
id iotstack
```

---

# 10. Verify the SSH key

Check:

```bash
ls -la ~/.ssh
```

Must contain:

```text
authorized_keys
```

Check the directory:

```bash
stat ~/.ssh
```

Permissions should be:

```text
0700
```

Check the file:

```bash
stat ~/.ssh/authorized_keys
```

Permissions should be:

```text
0600
```

Owner must match the new user.

For example:

```text
iotstack:iotstack
```

Quick check:

```bash
ls -ld ~/.ssh
ls -l ~/.ssh/authorized_keys
```

---

# 11. Verify passwordless sudo

Run:

```bash
sudo whoami
```

Output must be:

```text
root
```

with no password prompt.

Non-interactive check:

```bash
sudo -n true && echo "Passwordless sudo OK"
```

Output:

```text
Passwordless sudo OK
```

Check the permission list:

```bash
sudo -l
```

Should contain something like:

```text
(ALL : ALL) NOPASSWD: ALL
```

---

# 12. Verify SSH configuration

Check root SSH:

```bash
sudo sshd -T | grep permitrootlogin
```

Expected output:

```text
permitrootlogin no
```

Check password authentication:

```bash
sudo sshd -T | grep passwordauthentication
```

Output:

```text
passwordauthentication no
```

Check public key authentication:

```bash
sudo sshd -T | grep pubkeyauthentication
```

Output:

```text
pubkeyauthentication yes
```

---

# 13. Verify root SSH is disabled

Once the new user works normally, you can test from another terminal:

```bash
ssh root@SERVER_IP
```

The SSH server must reject root logins.

While:

```bash
ssh iotstack@SERVER_IP
```

must still work normally.

---

# 14. Mechanism to avoid locking yourself out of the VPS

The script does not disable root SSH unconditionally.

It checks whether an SSH key exists.

If this exists:

```text
/root/.ssh/authorized_keys
```

the script copies it to:

```text
/home/<USER_NAME>/.ssh/authorized_keys
```

only then does it configure:

```text
PermitRootLogin no
```

Processing flow:

```text
Is there an SSH public key?
       │
       ├── 🔴 No
       │      │
       │      └── keep root SSH enabled
       │
       └── ✅ Yes
              │
              ├── copy authorized_keys
              ├── set owner
              ├── set permissions
              ├── validate sshd
              └── disable root SSH
```

If no key is found:

```text
WARNING: No SSH public key found.
Root SSH login will remain enabled to prevent lockout.
```

This way the server won't disable root access on its own in cases where the new user isn't able to SSH in yet.

---

# 15. If the VPS currently uses a password instead of an SSH key

If the new VPS only allows:

```bash
ssh root@SERVER_IP
```

via password and doesn't yet have:

```text
/root/.ssh/authorized_keys
```

you should set up an SSH key first.

On your local machine, create **a key dedicated to this VPS** instead of reusing the default `id_ed25519` — this makes it easy to revoke/rotate later without affecting other servers:

```bash
ssh-keygen -t ed25519 -C "iotstack" -f ~/.ssh/iotstack_ed25519
```

This creates:

```text
~/.ssh/iotstack_ed25519       (private key)
~/.ssh/iotstack_ed25519.pub   (public key)
```

If you already have a dedicated key for this VPS, there's no need to create another one.

Copy the key (use `-i` to point at the key you just created):

```bash
ssh-copy-id -i ~/.ssh/iotstack_ed25519.pub iotstack@SERVER_IP
```

Then check on the VPS:

```bash
cat /home/iotstack/.ssh/authorized_keys
```

Since the key isn't at the default path, from this point on you need to specify `-i` when SSHing into the new user:

```bash
ssh -i ~/.ssh/iotstack_ed25519 iotstack@SERVER_IP
```

Or, more conveniently, declare an alias in `~/.ssh/config` on your local machine so you don't have to type `-i` every time:

```text
Host iotstack-vps
    HostName SERVER_IP
    User iotstack
    IdentityFile ~/.ssh/iotstack_ed25519
```

From then on, you only need:

```bash
ssh iotstack-vps
```

---

# 16. The script is safe to re-run

The script is designed to be re-runnable in most cases.

If the user already exists:

```text
User iotstack already exists.
```

the script will not create the user again.

The following parts are still checked or updated:

```text
sudo group
sudoers
SSH directory
authorized_keys
permissions
SSH configuration
```

However, for a VPS already running in production, read the script carefully before re-running it if you've made other custom SSH changes.

---

# 17. After a successful setup

Once you've confirmed:

```text
✅ New SSH user works
✅ SSH key works
✅ sudo works
✅ sudo requires no password
✅ root SSH is disabled
```

you can exit the old root session.

From this point on, use:

```bash
ssh iotstack@SERVER_IP
```

or:

```bash
ssh <USER_NAME>@SERVER_IP
```

When you need system privileges:

```bash
sudo <command>
```

For example:

```bash
sudo apt update
sudo apt upgrade
sudo systemctl status ssh
sudo journalctl -xe
```

---

# 18. Should you delete the script after setup?

The script only serves the initial bootstrap step, so keeping it isn't required.

Once setup is complete, you can delete it:

```bash
sudo rm /root/setup-vps-user.sh
```

Or keep it if you want to use it for checks or reconfiguration.

If you keep the script, permission:

```text
700
```

ensures only `root` can read and execute it.

---

# 19. Complete VPS setup process

```text
New VPS
   │
   ▼
Temporary root SSH
   │
   ▼
Check for an SSH public key
   │
   ▼
Create setup-vps-user.sh
   │
   ▼
Choose USER_NAME
   │
   ▼
chmod 700 script
   │
   ▼
Run the script manually
   │
   ├── ✅ Create user
   ├── ✅ Add sudo
   ├── ✅ Configure NOPASSWD
   ├── ✅ Validate sudoers
   ├── ✅ Copy SSH key
   ├── ✅ Set permissions
   ├── ✅ Validate sshd
   └── ✅ Disable root SSH
   │
   ▼
⚠️ Keep the current root terminal open
   │
   ▼
Open a new terminal
   │
   ▼
ssh <USER_NAME>@SERVER_IP
   │
   ▼
Test SSH
   │
   ▼
Test sudo
   │
   ▼
Test root SSH disabled
   │
   ▼
✅ Done
```

Final result:

```text
❌ Don't use:

ssh root@SERVER_IP


✅ Use:

ssh <USER_NAME>@SERVER_IP


✅ When you need system privileges:

sudo <command>
```

`iotstack` in this guide is just a sample username to make it easy to identify the admin user and the VPS's purpose. You can change it to any username that fits your own infrastructure conventions.

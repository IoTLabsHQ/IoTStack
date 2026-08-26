# One-Command Installer

Set up IoTStack on a fresh Linux server (Ubuntu/Debian) with a single
command, run directly on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/quan-vu/IoTStack/main/install.sh | sh
```

This installs Docker if it isn't already there, downloads IoTStack, and
starts the stack. Once it finishes, open `http://<your-server-ip>`.

## Re-running against an existing install

The installer is safe to run again on a server that already has IoTStack
on it — it detects the existing install and asks before touching
anything.

**Reinstall confirmation.** If it finds an existing install, it asks
whether to reinstall completely fresh. Declining leaves everything
untouched. Confirming:

- Backs up `.env` (the only thing that counts as "configuration" in this
  project) to a timestamped folder on the server.
- **Does not back up device/message data** — a fresh reinstall always
  wipes it. If real devices are on the instance, the installer warns you
  about this before asking for confirmation.

**Domain & SSL.** If it detects a domain with an already-issued
certificate, it asks whether to keep that domain (preserving the
certificate) or switch to a different one. Keeping the domain skips
waiting for a new certificate to be issued.

## What gets wiped vs. kept on a reinstall

| Data | Fresh reinstall | Reinstall, keep domain |
|---|---|---|
| Devices, messages, dashboard settings | Wiped | Wiped |
| Domain & SSL certificate | Wiped (new domain asked for) | Kept |

Device/message data is never preserved on a reinstall, on either path —
only the domain and its certificate can be.

## Non-interactive use

For scripted installs, skip the prompts with environment variables:

```bash
IOTSTACK_REINSTALL=fresh IOTSTACK_DOMAIN_CHOICE=keep \
  curl -fsSL https://raw.githubusercontent.com/quan-vu/IoTStack/main/install.sh | sh
```

- `IOTSTACK_REINSTALL=fresh` or `keep` — skips the reinstall prompt.
- `IOTSTACK_DOMAIN_CHOICE=keep` or `new` — skips the domain prompt.
- `DOMAIN=your-domain.com` / `ADMIN_EMAIL=you@example.com` — set these
  directly instead of being prompted for them.

## Alternative: deploy from your own machine

Prefer to deploy from your own computer over SSH instead of running a
command on the server itself? See
[Manual VPS setup](003_manual-vps-setup.en.md).

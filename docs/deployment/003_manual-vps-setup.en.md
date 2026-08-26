# Manual VPS Setup

The alternative to the [one-command installer](002_installer.en.md):
deploy from your own machine over SSH, using a checkout of this
repository.

## Automated deploy (recommended)

From your own machine — not the server — with this repository checked
out and your SSH key already authorized on the target:

```bash
deploy/bootstrap.sh root@your-server-ip
```

That single command does everything: creates a non-root admin user
with SSH-key-only access (skipped if one already exists), installs
Docker Engine + the Compose plugin (skipped if already installed),
copies this checkout to the server, generates `.env` with real random
secrets on first deploy, and starts the stack — then waits for the
API to report healthy before it exits.

A VPS you already have an admin user on works the same way, just
target that user instead of `root`:

```bash
deploy/bootstrap.sh iotstack@your-server-ip
```

Optional flags: `--domain example.com` (for a real Let's Encrypt
certificate instead of the self-signed one for `localhost`) and
`--admin-email you@example.com` (skips the interactive prompt). If
`--admin-email` is given without a password, one is generated and
printed once at the end — save it immediately.

Re-running `bootstrap.sh` against an already-deployed server is safe:
it skips steps that are already done and updates the running code
without touching an existing `.env`.

## Manual deploy

The steps `bootstrap.sh` automates, for reference or if you'd rather
run them by hand.

### First-time server access

Don't operate the server as `root` day-to-day. Set up a dedicated
non-root admin user with SSH-key-only access and passwordless `sudo`:

- [VPS admin user setup](004_vps-admin-user.en.md) — full walkthrough,
  including generating a dedicated local SSH key for the server and an
  `~/.ssh/config` alias.
- [`setup-vps-user.sh`](../setup-vps-user.sh) — the bootstrap script
  referenced by that guide.

### Deploying

Once the admin user is set up and Docker is installed, copy this
checkout to the server (`rsync`, `scp`, or your own means — the
repository doesn't have to be public), then on the server:

```bash
cd iotstack
cp .env.example .env
# edit .env — see the main README's Configuration section
docker compose up -d --build
```

See the main [README](../../README.md) for the full quick-start and
post-deploy steps (creating your first device, connecting firmware).

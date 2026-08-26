FROM node:20-alpine AS dashboard-builder

WORKDIR /app
COPY dashboard/package.json ./
RUN npm install

COPY dashboard/ ./
RUN npm run build

FROM caddy:2-alpine

COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=dashboard-builder /app/dist /srv/dashboard
COPY docs /srv/dashboard/docs-content

# --resume: load the last live config (autosaved after any admin-API
# push, e.g. a domain change) instead of the static Caddyfile above,
# so dashboard-driven changes survive a container restart. Falls back
# to the static file on a genuinely fresh volume (no autosave yet).
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile", "--resume"]

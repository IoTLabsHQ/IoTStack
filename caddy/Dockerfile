FROM node:20-alpine AS dashboard-builder

WORKDIR /app
COPY dashboard/package.json ./
RUN npm install

COPY dashboard/ ./
RUN npm run build

FROM caddy:2-alpine

COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=dashboard-builder /app/dist /srv/dashboard

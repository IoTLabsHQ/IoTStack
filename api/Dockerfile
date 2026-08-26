FROM node:20-alpine AS builder

WORKDIR /app

# better-sqlite3 compiles a native addon at install time on alpine (musl) —
# these build tools are only needed in this stage, not the final image.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN chown -R node:node /app && mkdir -p /data /settings-shared && chown -R node:node /data /settings-shared
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]

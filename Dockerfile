# syntax=docker/dockerfile:1.7
#
# basedb — one image: the API, the MCP server and the interface, behind one port (3000).
# PostgreSQL stays outside it: the `db` service of docker-compose.yml, or yours
# (DATABASE_URL).
#
#   docker build -t basedb .
#   docker run -d -p 3000:3000 -v basedb-files:/data \
#     -e DATABASE_URL=postgres://… -e BASEDB_ENCRYPTION_KEY=… basedb
#
# `docker compose up -d` starts it with PostgreSQL (docker-compose.yml); every variable
# is described in `.env.example`. Published as eodia/basedb on Docker Hub.

ARG NODE_VERSION=22

# ── Base: Node and the pnpm the lockfile was written with ──────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /repo

# ── Build: the whole workspace, compiled once ──────────────────────────────────────────
FROM base AS build
# The lockfile alone fetches every package: this layer stays cached until it changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
# The API and the MCP server, with the packages they reference (tsc -b follows them).
RUN pnpm exec tsc -b apps/api apps/mcp
# The interface, as a self-contained server (apps/web/next.config.ts).
RUN BASEDB_WEB_STANDALONE=1 pnpm --filter @basedb/web build

# ── Servers: the API and the MCP server, production dependencies only ─────────────────
FROM base AS server
COPY . .
# Only what the two servers and the packages they reference need at run time.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --prefer-offline \
      --filter "@basedb/api..." --filter "@basedb/mcp..."
COPY --from=build /repo/packages/naming/dist packages/naming/dist
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/packages/catalog-schema/dist packages/catalog-schema/dist
COPY --from=build /repo/packages/templates/dist packages/templates/dist
COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/mcp/dist apps/mcp/dist

# ── The image ──────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS basedb
ENV NODE_ENV=production
# The router in front of the three processes (docker/image/Caddyfile): a static binary.
COPY --from=caddy:2-alpine /usr/bin/caddy /usr/local/bin/caddy
# Files of `file` and `image` fields and exports before purge: one volume, /data.
RUN mkdir -p /data/files /data/exports && chown -R node:node /data
# The API and the MCP server, with the packages they reference.
COPY --from=server /repo /app/server
# The interface, as a self-contained server.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone /app/web
COPY --from=build --chown=node:node /repo/apps/web/.next/static /app/web/apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public /app/web/apps/web/public
COPY docker/image/Caddyfile docker/image/start.mjs /app/
WORKDIR /app
# On an empty database, the first start applies the catalog and creates the first
# administrator; both are no-ops on the next starts.
ENV PORT=3000 \
    BASEDB_MIGRATE=1 \
    BASEDB_BOOTSTRAP=1 \
    BASEDB_FILES_DIR=/data/files \
    BASEDB_EXPORT_DIR=/data/exports
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "/app/start.mjs"]

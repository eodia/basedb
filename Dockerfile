# syntax=docker/dockerfile:1.7
#
# basedb — one Dockerfile, three images, one per process:
#
#   docker build --target api -t basedb-api .   # REST API, auth, background work
#   docker build --target mcp -t basedb-mcp .   # MCP entry point for agents
#   docker build --target web -t basedb-web .   # the interface (Next.js)
#
# `docker compose up -d` builds and starts all three with PostgreSQL
# (docker-compose.yml); every variable is described in `.env.example`.

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
COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/mcp/dist apps/mcp/dist

# ── Runtime base ───────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# ── API ────────────────────────────────────────────────────────────────────────────────
FROM runtime AS api
# Files of `file` and `image` fields and exports before purge: one volume, /data.
RUN mkdir -p /data/files /data/exports && chown -R node:node /data
COPY --from=server /repo /app
WORKDIR /app/apps/api
ENV PORT=8787 \
    BASEDB_FILES_DIR=/data/files \
    BASEDB_EXPORT_DIR=/data/exports
USER node
EXPOSE 8787
VOLUME ["/data"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/server.js"]

# ── MCP ────────────────────────────────────────────────────────────────────────────────
FROM runtime AS mcp
COPY --from=server /repo /app
WORKDIR /app/apps/mcp
ENV BASEDB_MCP_PORT=8788
USER node
EXPOSE 8788
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.BASEDB_MCP_PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/server.js"]

# ── Interface ──────────────────────────────────────────────────────────────────────────
FROM runtime AS web
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
ENV PORT=3000 \
    HOSTNAME=0.0.0.0
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]

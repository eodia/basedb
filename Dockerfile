# syntax=docker/dockerfile:1.7
#
# basedb — one image, one process: basedb-server (rust-server) answers on one port (3000)
# for the API, the MCP server (/mcp) and the interface (apps/web exported as static files).
# No Node at run time. PostgreSQL stays outside it: the `db` service of docker-compose.yml,
# or yours (DATABASE_URL).
#
#   docker build -t basedb .
#   docker run -d -p 3000:3000 -v basedb-files:/data \
#     -e DATABASE_URL=postgres://… -e BASEDB_ENCRYPTION_KEY=… basedb
#
# `docker compose up -d` starts it with PostgreSQL (docker-compose.yml); every variable
# is described in `.env.example`. Published as eodia/basedb on Docker Hub.
#
# With insights beside it in the same container (its server, its jobs and its interface,
# under /insights on basedb's own port; Trino stays a service of its own) — the target
# `basedb-insights`, built on insights' published image, turned on by BASEDB_INSIGHTS=1:
#
#   docker build --target basedb-insights -t basedb:insights .
#
# It needs insights 0.7.0 or later (its Rust server, its base path given at run time):
# INSIGHTS_VERSION chooses the tag of eodia/insights, INSIGHTS_IMAGE another image.
#
# Without a target, the last stage: basedb alone, which pulls nothing of insights.
# Behind a registry of your own network: --build-arg NPM_REGISTRY=https://npm.example.com

ARG NODE_VERSION=22
ARG RUST_VERSION=1
ARG INSIGHTS_VERSION=0.7.0
ARG INSIGHTS_IMAGE=eodia/insights:${INSIGHTS_VERSION}

# ── The server: basedb-server, built for the target's architecture ─────────────────────
# Debian bookworm's glibc, as the image below. Built on the builder's own architecture and
# cross-compiled when the target differs (arm64 from amd64): no emulated compiler.
FROM --platform=$BUILDPLATFORM rust:${RUST_VERSION}-slim-bookworm AS server
ARG BUILDARCH
ARG TARGETARCH
RUN set -eu; \
    if [ "$TARGETARCH" != "$BUILDARCH" ]; then \
      case "$TARGETARCH" in \
        arm64) gcc=gcc-aarch64-linux-gnu; libc=libc6-dev-arm64-cross; triple=aarch64-unknown-linux-gnu ;; \
        amd64) gcc=gcc-x86-64-linux-gnu; libc=libc6-dev-amd64-cross; triple=x86_64-unknown-linux-gnu ;; \
        *) echo "architecture non prise en charge : $TARGETARCH" >&2; exit 1 ;; \
      esac; \
      apt-get update; \
      apt-get install -y --no-install-recommends "$gcc" "$libc"; \
      rm -rf /var/lib/apt/lists/*; \
      rustup target add "$triple"; \
    fi
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
    CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
    CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc \
    CC_x86_64_unknown_linux_gnu=x86_64-linux-gnu-gcc
WORKDIR /repo
# The catalog migrations are embedded in the binary (crates/base/build.rs): the image needs
# no migrations folder.
COPY packages/catalog-schema/migrations packages/catalog-schema/migrations
COPY rust-server rust-server
WORKDIR /repo/rust-server
RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=basedb-target-${TARGETARCH},target=/repo/rust-server/target \
    set -eu; \
    case "$TARGETARCH" in \
      arm64) triple=aarch64-unknown-linux-gnu ;; \
      *) triple=x86_64-unknown-linux-gnu ;; \
    esac; \
    if [ "$TARGETARCH" = "$BUILDARCH" ]; then \
      unset CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER CC_x86_64_unknown_linux_gnu \
            CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER CC_aarch64_unknown_linux_gnu; \
    fi; \
    cargo build --release --locked -p basedb-server --target "$triple"; \
    mkdir -p /out; \
    cp "target/$triple/release/basedb-server" /out/basedb-server

# ── The interface: apps/web exported as static files (Node builds it, nothing runs it) ─
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-bookworm-slim AS web
# The npm registry of the build, for pnpm and corepack — another one when the public one is
# out of reach (without a trailing slash). Not kept in the image.
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    npm_config_registry=${NPM_REGISTRY} \
    COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /repo
# The lockfile alone fetches every package: this layer stays cached until it changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter "@basedb/web..."
# The packages it imports, then the interface (apps/web/scripts/build-static.mjs).
RUN pnpm --filter "@basedb/web^..." run build \
 && pnpm --filter @basedb/web build:static

# ── The faces of PDF documents (chapter 21 §4) ─────────────────────────────────────────
# Noto Sans for Latin, Greek and Cyrillic, Noto Sans CJK for Chinese, Japanese and Korean:
# six files of Debian's packages, not the packages — about 40 MB rather than 130.
FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS fonts
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-core fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

# ── basedb and insights in one container (target basedb-insights only) ────────────────
# insights' own image — its server (4200), its interface (3100), Node for the latter —
# with basedb added: docker/image/start.mjs starts the three, basedb-server in front.
FROM ${INSIGHTS_IMAGE} AS basedb-insights
USER root
COPY --from=server /out/basedb-server /usr/local/bin/basedb-server
COPY --from=web --chown=1000:1000 /repo/apps/web/out-static /app/web
COPY packages/templates/catalog /app/templates/catalog
COPY packages/templates/i18n /app/templates/i18n
COPY --from=fonts \
  /usr/share/fonts/truetype/noto/NotoSans-Regular.ttf \
  /usr/share/fonts/truetype/noto/NotoSans-Bold.ttf \
  /usr/share/fonts/truetype/noto/NotoSans-Italic.ttf \
  /usr/share/fonts/truetype/noto/NotoSans-BoldItalic.ttf \
  /usr/share/fonts/truetype/noto/
COPY --from=fonts \
  /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc \
  /usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc \
  /usr/share/fonts/opentype/noto/
COPY docker/image/start.mjs /app/basedb-start.mjs
RUN mkdir -p /data/files /data/exports && chown -R 1000:1000 /data
ENV PORT=3000 \
    BASEDB_WEB_DIR=/app/web \
    BASEDB_TEMPLATES_DIR=/app/templates \
    BASEDB_MIGRATE=1 \
    BASEDB_BOOTSTRAP=1 \
    BASEDB_INSIGHTS=1 \
    BASEDB_FILES_DIR=/data/files \
    BASEDB_EXPORT_DIR=/data/exports
USER 1000
WORKDIR /app
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD ["basedb-server", "healthcheck"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/app/basedb-start.mjs"]

# ── basedb alone: the default target, published on Docker Hub ──────────────────────────
FROM debian:bookworm-slim AS basedb
# The trust store of the server's HTTPS calls (AI providers, webhooks, template catalog).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 1000 basedb \
 && useradd --uid 1000 --gid basedb --no-create-home --home-dir /app --shell /usr/sbin/nologin basedb \
 && mkdir -p /data/files /data/exports \
 && chown -R basedb:basedb /data
COPY --from=server /out/basedb-server /usr/local/bin/basedb-server
# The interface, served by basedb-server (BASEDB_WEB_DIR).
COPY --from=web /repo/apps/web/out-static /app/web
# The carried base templates (BASEDB_TEMPLATES_DIR).
COPY packages/templates/catalog /app/templates/catalog
COPY packages/templates/i18n /app/templates/i18n
# The faces of PDF documents, where the server looks first; BASEDB_PDF_FONTS may name
# another folder.
COPY --from=fonts \
  /usr/share/fonts/truetype/noto/NotoSans-Regular.ttf \
  /usr/share/fonts/truetype/noto/NotoSans-Bold.ttf \
  /usr/share/fonts/truetype/noto/NotoSans-Italic.ttf \
  /usr/share/fonts/truetype/noto/NotoSans-BoldItalic.ttf \
  /usr/share/fonts/truetype/noto/
COPY --from=fonts \
  /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc \
  /usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc \
  /usr/share/fonts/opentype/noto/
WORKDIR /app
# On an empty database, the first start applies the catalog and creates the first
# administrator; both are no-ops on the next starts.
ENV PORT=3000 \
    BASEDB_WEB_DIR=/app/web \
    BASEDB_TEMPLATES_DIR=/app/templates \
    BASEDB_MIGRATE=1 \
    BASEDB_BOOTSTRAP=1 \
    BASEDB_FILES_DIR=/data/files \
    BASEDB_EXPORT_DIR=/data/exports
USER basedb
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD ["basedb-server", "healthcheck"]
CMD ["basedb-server"]

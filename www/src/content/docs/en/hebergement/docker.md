---
title: Docker Compose
description: The image, the services, the volumes and day-to-day operations.
---

basedb is published as **a single image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
for amd64 and arm64. The repository’s `docker-compose.yml` puts it together with PostgreSQL. All
configuration goes through a `.env` file (see
[Environment variables](/basedb/en/hebergement/variables/)).

## The image

It contains basedb’s three processes and serves them on **a single port, 3000**:

| Path | Process |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | the REST API, sign-in, background work |
| `/mcp` | the MCP server, for agents |
| everything else — `/`, `/f/…`, `/v/…` | the interface |

At startup, the API goes first: on an empty database, it applies the catalog and creates the
first administrator; on later starts, both do nothing. The MCP server starts as soon as the API
responds. If one of the processes stops, the whole container stops, and the restart policy
restarts all of it.

The image runs as the `node` user, on Node 22, declares a health check (`/healthz`) and a
volume, `/data`, for the files of File and Image fields.

| Tag | Content |
|---|---|
| `latest` | the latest published version |
| `0.6` | the latest 0.6.x version |
| `0.6.1` | exactly this version |

## The services

| Service | Image | Port (on 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (optional) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Useful commands

```bash
docker compose up -d                # pull the image and start
docker compose logs -f basedb       # follow basedb (admin password on first start)
docker compose ps                   # state and health of the services
docker compose restart basedb       # restart basedb
docker compose down                 # stop (the volumes stay)
```

From a clone of the repository, `docker compose up -d --build` builds the image from the code
rather than pulling it.

## Behind a gateway, under a path

When basedb is published under a path — `https://passerelle.example.com/basedb/` rather than
at the root of a domain —, set this path:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# or, with no public address:
BASEDB_BASE_PATH=/basedb
```

Everything then goes under `/basedb`: the interface, `/basedb/api`, `/basedb/mcp`, sharing
links and the ones in emails. The gateway can **keep the path** by forwarding the request as
is, or **strip it**: basedb accepts either. `BASEDB_BASE_PATH=/` forces the root.

The image is the same for every address: the path is written into the interface when the
container starts, and changing the path only takes a restart.

## Changing the ports

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## An existing PostgreSQL database

Set `DATABASE_URL`: basedb connects to it instead of the `db` container (which starts anyway,
unused — remove it in a `docker-compose.override.yml` file if you prefer). You need
PostgreSQL 16 or later, a role that owns the database, and the `pg_trgm` and `unaccent`
extensions available. The image alone is then enough — see [Installation](/basedb/en/guides/installation/).

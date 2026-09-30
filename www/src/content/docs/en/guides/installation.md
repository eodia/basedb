---
title: Installation
description: Install basedb with Docker Compose, or run the development stack.
---

basedb fits in **a single Docker image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 and arm64): the **interface**, the **API** and the **MCP server**, served on a single
address. It needs a **PostgreSQL 16** database, which the `docker-compose.yml` provides.

## With Docker Compose (recommended)

Prerequisites: Docker with Compose v2. Two files are enough, no need for the code:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Open `.env` and fill in the only two required values:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# generated once and for all: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Then start:

```bash
docker compose up -d
```

On first start, basedb creates the catalog. Then open
[http://localhost:3000](http://localhost:3000): the first page asks you to **create the
administrator account**, with your name, your email address and the password of your choice,
and you are signed in right away.

:::caution[The first visit creates the administrator]
As long as no administrator exists, the first person who opens the interface creates one.
Create it **before** making the instance reachable by others — on a domain, or with a port
published on all interfaces.
:::

For an unattended installation, name the administrator in `.env` with `BASEDB_ADMIN_EMAIL`:
basedb creates it on first start and prints its password **only once** in its logs
(`docker compose logs basedb`), unless you set it with `BASEDB_ADMIN_PASSWORD`.

| Address | Role |
|---|---|
| http://localhost:3000 | the interface |
| http://localhost:3000/api | the REST API and its documentation |
| http://localhost:3000/mcp | the MCP server, for agents |
| localhost:5432 | PostgreSQL, for `psql` and your tools |

Ports are published on `127.0.0.1` only. To serve basedb on a domain, see
[Domain and HTTPS](/basedb/en/hebergement/https/).

## With your own PostgreSQL

The image alone is enough, with a PostgreSQL 16 or later database (a role that owns the
database, `pg_trgm` and `unaccent` extensions available):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Keep the generated key: see the box below.

:::caution[The instance key]
`BASEDB_ENCRYPTION_KEY` signs sessions and encrypts stored secrets (AI keys, webhook secrets,
automation secret headers, form links). Changing it signs everyone out and makes those secrets
unreadable. Generate it once, and back it up with the database.
:::

## For development

Prerequisites: Node 22 or later, Docker, and `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` picks free ports, starts a throwaway PostgreSQL 16, applies the catalog, seeds a
development administrator (`admin@basedb.local` / `developpement-basedb`, address prefilled
on the sign-in page), then launches the API, the MCP server and the interface in development
mode. `Ctrl+C` stops everything, container included.

## What next?

- [Getting started](/basedb/en/guides/premiers-pas/): a base, a table, a view, a form.
- [Environment variables](/basedb/en/hebergement/variables/): files, AI, addresses.

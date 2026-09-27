---
title: Environment variables
description: Every variable basedb reads, and its default value.
---

They all go in the `.env` file, next to `docker-compose.yml`, which `docker compose` reads (the
complete, commented template is `.env.example`). With `docker run`, pass them with `-e`. **An
empty value counts as “not set”.**

## Required

| Variable | Role |
|---|---|
| `POSTGRES_PASSWORD` | password of the PostgreSQL container |
| `BASEDB_ENCRYPTION_KEY` | instance key: signs sessions, encrypts secrets. `openssl rand -base64 32`, once and for all |

## Database

| Variable | Default | Role |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL role |
| `POSTGRES_DB` | `basedb` | PostgreSQL database |
| `POSTGRES_PORT` | `5432` | port published on 127.0.0.1 |
| `DATABASE_URL` | the `db` container | a PostgreSQL 16+ database of your own |

## First start

| Variable | Default | Role |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | applies the catalog on an empty database |
| `BASEDB_BOOTSTRAP` | `1` | prepares the first administrator |
| `BASEDB_TENANT` | `t4z56fq` | the workspace’s reference, in the API URLs |
| `BASEDB_ADMIN_EMAIL` | — | address of the first administrator, created at startup; if empty, the first person who opens the interface creates it |
| `BASEDB_ADMIN_PASSWORD` | generated, shown once | with `BASEDB_ADMIN_EMAIL`, its password; when set, it is applied to the administrator again on **every** start: remove it once signed in |

## Sign-in with Google, Microsoft… (OIDC)

| Variable | Default | Role |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | the providers offered, separated by commas: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | the application registered with the provider |
| `BASEDB_OIDC_<NOM>_ISSUER` | that of `google`, `gitlab` | the OpenID Connect issuer |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | depends on the provider | the button’s name, the requested scopes |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: a first sign-in does not create an account |

See [Accounts and sign-in](/basedb/en/hebergement/connexion/).

## Addresses

| Variable | Default | Role |
|---|---|---|
| `BASEDB_PORT` | `3000` | port published on 127.0.0.1: the interface, `/api` and `/mcp` |
| `BASEDB_VERSION` | `latest` | the tag of the `eodia/basedb` image |
| `BASEDB_PUBLIC_URL` | — | basedb’s public address, for the OIDC redirect |
| `BASEDB_DOMAIN` | — | the domain served over HTTPS by the Caddy proxy |
| `BASEDB_ORIGINS` | — | other sites whose pages call the API from the browser, separated by commas; not needed for basedb’s interface, served at the same address |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | the API and MCP as seen from the browser; only to be set for the development stack (`pnpm start`) |

## Files

| Variable | Default | Role |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maximum size of a file |
| `BASEDB_S3_BUCKET` | — | turns on S3 storage |
| `BASEDB_S3_ENDPOINT` | — | S3 endpoint |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | credentials |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` for virtual-hosted-style addressing |

## Base templates

| Variable | Default | Role |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | the public site’s catalog | where the instance reads its gallery’s templates from; `off` to read none (the built-in templates remain) — see [Templates](/basedb/en/fonctionnalites/modeles/) |

## Artificial intelligence

| Variable | Default | Role |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` or `mistral` |
| `BASEDB_AI_MODEL` | — | the model |
| `BASEDB_AI_API_KEY` | — | the key (otherwise `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interactive calls per hour and per workspace |
| `BASEDB_AI_FIELD_QUOTA` | `300` | AI field computations per hour and per workspace |
| `BASEDB_AI_WORKER` | `1` | `0`: no background computation in this process |

## Public demo

An instance open to everyone, like [demo.basedb.eodia.com](https://demo.basedb.eodia.com): the
sign-in screen prefills a shared account, the visitor reads everything and edits what exists,
but creates or deletes nothing — base, table, row, file, comment, account, token, link —, and
the AI replies that it is not part of the demo. The SQL console only reads there. Resetting the
base every night remains your responsibility.

| Variable | Default | Role |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: the instance becomes a public demo |
| `BASEDB_DEMO_ACCOUNTS` | — | one account per language, separated by commas: `fr=demo@demo.com,en=demo-en@demo.com`; the sign-in screen prefills the one for its language, otherwise English, otherwise the first, and offers the others. Create these accounts, each with its own project, before turning on the demo: it refuses creation to everyone, administrators included |
| `BASEDB_DEMO_PASSWORD` | — | with `BASEDB_DEMO_ACCOUNTS`, their password, the same for all, published with them |

Without `BASEDB_DEMO_ACCOUNTS`, the shared account is the administrator named by
`BASEDB_ADMIN_EMAIL` and `BASEDB_ADMIN_PASSWORD`. An address from the demo signs in with the
published password, whatever is typed: false attempts do not lock it for everyone.

## Development only

| Variable | Role |
|---|---|
| `BASEDB_DEV_MAIL=1` | prints emails in the logs instead of sending them |
| `BASEDB_WEBHOOK_DEV=1` | allows webhooks to HTTP and local addresses |

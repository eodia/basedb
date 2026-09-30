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
| `BASEDB_BASE_PATH` | the path of `BASEDB_PUBLIC_URL` | the path under which basedb is served behind a gateway, `/basedb` for `https://passerelle.example.com/basedb/`; see [Docker Compose](/basedb/en/hebergement/docker/#behind-a-gateway-under-a-path) |
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

## Emails

Without a mail server, basedb sends no email. With one, out go the notifications left unread
for ten minutes (everyone chooses which ones in **Settings › Notifications**), the emails of
automations’ **Send an email** step, and the link for a **forgotten password**. Links point to
`BASEDB_PUBLIC_URL`; without it, an email carries none.

| Variable | Default | Role |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | the SMTP server: your mail provider’s, or a sending service’s |
| `BASEDB_SMTP_PORT` | `587` | `465` for an encrypted connection from the start |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` on port 465) | `none` only for a relay on the same machine: otherwise the password would travel in the clear |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | the sending account’s credentials, if it requires any |
| `BASEDB_MAIL_FROM` | — | required with `BASEDB_SMTP_HOST`: the sender, `basedb <no-reply@exemple.fr>` |

At startup, the log states the situation: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` An email the server refuses is retried 1, 5, 30, 120 then
360 minutes later.

## Maps and addresses

The **Map** view places an address thanks to a geocoding service: OpenStreetMap’s (Nominatim)
by default, queried once per address, at most one request a second, every response kept. The
map background is made of **tiles** that each reader’s browser loads directly.

| Variable | Default | Role |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | another service that speaks the same protocol (a Nominatim of your own); `off`: none, addresses do not leave the instance and only the latitude and longitude place rows |
| `BASEDB_MAP_TILES` | OpenStreetMap’s tiles | another tile server, pattern `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | the credit this server requires, at the bottom right of the map |

At startup, the log states which service is used: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF documents

| Variable | Default | Role |
|---|---|---|
| `BASEDB_PDF_FONTS` | the image’s Noto fonts | a folder of your own, mounted in the container, that holds `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, and for Chinese, Japanese and Korean `NotoSansCJK-Regular.ttc` and `-Bold.ttc` |

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

## Webhooks to your internal network

| Variable | Default | Role |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | your internal servers, separated by commas: a hostname (`chat.intra.example.com`), a domain and its subdomains (`*.intra.example.com`), an address or a range (`10.12.0.0/16`) |

Webhooks, automations’ HTTP requests and synced tables only go to public HTTPS addresses. A
target from the list is accepted in addition, whatever its address, port and scheme — HTTP
included. An entry that cannot be read prevents startup. See
[Webhooks](/basedb/en/integrations/webhooks/#targets).

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

---
title: Miljøvariabler
description: Alle variablene basedb leser, og standardverdiene deres.
---

Alle legges i `.env`-filen, ved siden av `docker-compose.yml`, som `docker compose`
leser (den komplette malen med kommentarer er `.env.example`). Med `docker run` sender du dem med `-e`. **En tom verdi betyr «ikke satt».**

## Obligatoriske

| Variabel | Rolle |
|---|---|
| `POSTGRES_PASSWORD` | passordet til PostgreSQL-containeren |
| `BASEDB_ENCRYPTION_KEY` | instansnøkkel: signerer øktene, krypterer hemmelighetene. `openssl rand -base64 32`, én gang for alle |

## Database

| Variabel | Standard | Rolle |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-rolle |
| `POSTGRES_DB` | `basedb` | PostgreSQL-database |
| `POSTGRES_PORT` | `5432` | port publisert på 127.0.0.1 |
| `DATABASE_URL` | containeren `db` | din egen PostgreSQL 16+-database |

## Første oppstart

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | tar i bruk katalogen på en tom database |
| `BASEDB_BOOTSTRAP` | `1` | klargjør den første administratoren |
| `BASEDB_TENANT` | `t4z56fq` | tenantens referanse, i API-ets URL-er |
| `BASEDB_ADMIN_EMAIL` | – | adressen til den første administratoren, som opprettes ved oppstart; er den tom, oppretter den første personen som åpner grensesnittet, administratoren |
| `BASEDB_ADMIN_PASSWORD` | generert, vist én gang | sammen med `BASEDB_ADMIN_EMAIL`: passordet; er den satt, brukes den på nytt for administratoren ved **hver** oppstart: fjern den når du har logget inn |

## Innlogging med Google, Microsoft … (OIDC)

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | leverandørene som tilbys, kommaseparert: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | applikasjonen som er registrert hos leverandøren |
| `BASEDB_OIDC_<NOM>_ISSUER` | den til `google`, `gitlab` | OpenID Connect-utstederen |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | avhenger av leverandøren | navnet på knappen, omfangene (scopes) det bes om |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: en første innlogging oppretter ikke en konto |

Se [Kontoer og innlogging](/basedb/nb/hebergement/connexion/).

## Adresser

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_PORT` | `3000` | port publisert på 127.0.0.1: grensesnittet, `/api` og `/mcp` |
| `BASEDB_VERSION` | `latest` | taggen til imaget `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | – | den offentlige adressen til basedb, for OIDC-returen |
| `BASEDB_DOMAIN` | – | domenet som Caddy-proxyen serverer over HTTPS |
| `BASEDB_ORIGINS` | – | andre nettsteder der sidene kaller API-et fra nettleseren, kommaseparert; unødvendig for grensesnittet til basedb, som serveres på samme adresse |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API-et og MCP sett fra nettleseren; skal bare justeres for utviklingsmiljøet (`pnpm start`) |

## Filer

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maksimal størrelse på en fil |
| `BASEDB_S3_BUCKET` | – | aktiverer S3-lagring |
| `BASEDB_S3_ENDPOINT` | – | S3-endepunkt |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | påloggingsinformasjon |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` for vertsbasert adressering |

## Databasemaler

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | katalogen på det offentlige nettstedet | hvor instansen leser malene til galleriet sitt fra; `off` for ikke å lese noen (de innebygde malene blir værende) – se [Maler](/basedb/nb/fonctionnalites/modeles/) |

## Kunstig intelligens

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic` eller `mistral` |
| `BASEDB_AI_MODEL` | – | modellen |
| `BASEDB_AI_API_KEY` | – | nøkkelen (ellers `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interaktive kall per time og per tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | beregninger av KI-felt per time og per tenant |
| `BASEDB_AI_WORKER` | `1` | `0`: ingen bakgrunnsberegning i denne prosessen |

## Bare for utvikling

| Variabel | Rolle |
|---|---|
| `BASEDB_DEV_MAIL=1` | viser e-postene i loggene i stedet for å sende dem |
| `BASEDB_WEBHOOK_DEV=1` | tillater webhooks til HTTP og lokale adresser |

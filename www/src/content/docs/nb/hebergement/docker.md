---
title: Docker Compose
description: Imaget, tjenestene, volumene og den daglige driften.
---

basedb publiseres som **ett enkelt image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
for amd64 og arm64. `docker-compose.yml` i depotet setter det sammen med PostgreSQL. All
konfigurasjon går via en `.env`-fil (se
[Miljøvariabler](/basedb/nb/hebergement/variables/)).

## Imaget

Det inneholder de tre prosessene i basedb og serverer dem på **én enkelt port, 3000**:

| Sti | Prosess |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST-API-et, innloggingen, bakgrunnsjobbene |
| `/mcp` | MCP-serveren, for agentene |
| alt annet – `/`, `/f/…`, `/v/…` | grensesnittet |

Ved oppstart går API-et først: på en tom database tar det i bruk katalogen og oppretter den
første administratoren; ved senere oppstarter har begge deler ingen virkning. MCP-serveren starter
så snart API-et svarer. Hvis en av prosessene stopper, stopper hele containeren, og
omstartspolicyen starter hele den på nytt.

Imaget kjører som brukeren `node`, på Node 22, deklarerer en helsesjekk
(`/healthz`) og et volum, `/data`, for filene i Fil- og Bilde-feltene.

| Tagg | Innhold |
|---|---|
| `latest` | den siste publiserte versjonen |
| `0.7` | den siste 0.7.x-versjonen |
| `0.7.1` | nøyaktig denne versjonen |

## Tjenestene

| Tjeneste | Image | Port (på 127.0.0.1) | Volum |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (valgfri) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Nyttige kommandoer

```bash
docker compose up -d                # last ned imaget og start
docker compose logs -f basedb       # følg basedb (administratorpassord ved 1. oppstart)
docker compose ps                   # tjenestenes status og helse
docker compose restart basedb       # start basedb på nytt
docker compose down                 # stopp (volumene blir værende)
```

Fra en klone av depotet bygger `docker compose up -d --build` imaget fra koden
i stedet for å laste det ned.

## Bak en gateway, under en sti

Når basedb publiseres under en sti — `https://passerelle.example.com/basedb/` i stedet for ved
roten av et domene —, angi denne stien:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# eller, uten offentlig adresse:
BASEDB_BASE_PATH=/basedb
```

Alt går da under `/basedb`: grensesnittet, `/basedb/api`, `/basedb/mcp`, delingslenkene og
lenkene i e-postene. Gatewayen kan **beholde stien** ved å videresende forespørselen, eller
**fjerne den**: basedb godtar begge. `BASEDB_BASE_PATH=/` tvinger frem roten.

Imaget er det samme for alle adressene: stien skrives inn i grensesnittet når containeren
starter, og å endre stien krever bare en omstart.

## Endre portene

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## En eksisterende PostgreSQL-database

Angi `DATABASE_URL`: basedb kobler seg til den i stedet for `db`-containeren (som likevel starter,
ubrukt – fjern den med en `docker-compose.override.yml`-fil om du foretrekker det). Det kreves
PostgreSQL 16 eller nyere, en rolle som eier databasen, og at utvidelsene `pg_trgm` og `unaccent`
er tilgjengelige. Da holder imaget alene – se [Installasjon](/basedb/nb/guides/installation/).

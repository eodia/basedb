---
title: Docker Compose
description: Imaget, tjenesterne, volumenerne og den daglige drift.
---

basedb udgives som **ét enkelt image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
til amd64 og arm64. Repositoriets `docker-compose.yml` sætter det sammen med PostgreSQL. Hele
konfigurationen sker via en `.env`-fil (se
[Miljøvariabler](/basedb/da/hebergement/variables/)).

## Imaget

Det indeholder basedbs tre processer og serverer dem på **én enkelt port, 3000**:

| Sti | Proces |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST-API'et, login, baggrundsarbejdet |
| `/mcp` | MCP-serveren, til agenter |
| alt andet — `/`, `/f/…`, `/v/…` | brugerfladen |

Ved start går API'et først: på en tom database anvender det kataloget og opretter den første
administrator; ved de efterfølgende starter har begge dele ingen effekt. MCP-serveren starter,
så snart API'et svarer. Hvis en af processerne stopper, stopper hele containeren, og
genstartspolitikken starter hele containeren igen.

Imaget kører som brugeren `node` på Node 22 og erklærer et sundhedstjek (`/healthz`) og et
volumen, `/data`, til filerne i felterne Fil og Billede.

| Tag | Indhold |
|---|---|
| `latest` | den senest udgivne version |
| `0.6` | den seneste version 0.6.x |
| `0.6.0` | præcis denne version |

## Tjenesterne

| Tjeneste | Image | Port (på 127.0.0.1) | Volumen |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (valgfri) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Nyttige kommandoer

```bash
docker compose up -d                # hent imaget og start
docker compose logs -f basedb       # følg basedb (admin-adgangskode ved 1. start)
docker compose ps                   # tjenesternes status og sundhed
docker compose restart basedb       # genstart basedb
docker compose down                 # stop (volumenerne bevares)
```

Fra en klon af repositoriet bygger `docker compose up -d --build` imaget ud fra koden i stedet
for at hente det.

## Bag en gateway, under en sti

Når basedb udgives under en sti — `https://passerelle.example.com/basedb/` i stedet for i
roden af et domæne —, angiv denne sti:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# eller, uden offentlig adresse:
BASEDB_BASE_PATH=/basedb
```

Alt går derefter under `/basedb`: brugerfladen, `/basedb/api`, `/basedb/mcp`, delingslinkene
og dem i e-mails. Gatewayen kan **bevare stien** ved at videresende forespørgslen, eller
**fjerne den**: basedb accepterer begge dele. `BASEDB_BASE_PATH=/` fremtvinger roden.

Imaget er det samme for alle adresser: stien skrives i brugerfladen, når containeren starter,
og at ændre sti kun kræver en genstart.

## Skift portene

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## En eksisterende PostgreSQL-database

Sæt `DATABASE_URL`: basedb forbinder til den i stedet for containeren `db` (som alligevel
starter, men ikke bruges — fjern den i en `docker-compose.override.yml`-fil, hvis du foretrækker
det). Det kræver PostgreSQL 16 eller nyere, en rolle, der ejer databasen, og udvidelserne
`pg_trgm` og `unaccent` til rådighed. Imaget alene er så nok — se
[Installation](/basedb/da/guides/installation/).

---
title: Docker Compose
description: De image, de services, de volumes en het dagelijkse beheer.
---

basedb wordt gepubliceerd als **één enkele image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
voor amd64 en arm64. Het `docker-compose.yml` van de repository combineert die met PostgreSQL. De hele
configuratie gaat via een bestand `.env` (zie
[Omgevingsvariabelen](/basedb/nl/hebergement/variables/)).

## De image

Ze bevat de drie processen van basedb en serveert ze op **één enkele poort, 3000**:

| Pad | Proces |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | de REST-API, het inloggen, de achtergrondtaken |
| `/mcp` | de MCP-server, voor agents |
| al de rest — `/`, `/f/…`, `/v/…` | de interface |

Bij het opstarten gaat de API eerst: op een lege database past ze de catalogus toe en maakt ze de
eerste beheerder aan; bij volgende starts hebben die twee stappen geen effect. De MCP-server start
zodra de API antwoordt. Stopt een van de processen, dan stopt de hele container, en het
herstartbeleid start hem in zijn geheel opnieuw.

De image draait onder de gebruiker `node`, op Node 22, declareert een healthcheck
(`/healthz`) en een volume, `/data`, voor de bestanden van de velden Bestand en Afbeelding.

| Tag | Inhoud |
|---|---|
| `latest` | de laatst gepubliceerde versie |
| `0.4` | de laatste versie 0.4.x |
| `0.4.0` | precies deze versie |

## De services

| Service | Image | Poort (op 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (optioneel) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Handige commando’s

```bash
docker compose up -d                # de image downloaden en starten
docker compose logs -f basedb       # basedb volgen (beheerderswachtwoord bij de 1e start)
docker compose ps                   # status en gezondheid van de services
docker compose restart basedb       # basedb herstarten
docker compose down                 # stoppen (de volumes blijven)
```

Vanuit een kloon van de repository bouwt `docker compose up -d --build` de image vanaf de code
in plaats van hem te downloaden.

## De poorten wijzigen

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Een bestaande PostgreSQL-database

Stel `DATABASE_URL` in: basedb maakt daarmee verbinding in plaats van met de container `db` (die toch start,
ongebruikt — haal hem weg met een bestand `docker-compose.override.yml` als je dat liever hebt). Je hebt
PostgreSQL 16 of hoger nodig, een rol die eigenaar is van de database, en de extensies `pg_trgm` en `unaccent`
beschikbaar. De image alleen volstaat dan — zie [Installatie](/basedb/nl/guides/installation/).

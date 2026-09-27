---
title: Docker Compose
description: Avbildningen, tjänsterna, volymerna och den löpande driften.
---

basedb publiceras som **en enda avbildning**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
för amd64 och arm64. Repots `docker-compose.yml` sätter ihop den med PostgreSQL. All
konfiguration görs i en `.env`-fil (se
[Miljövariabler](/basedb/sv/hebergement/variables/)).

## Avbildningen

Den innehåller basedbs tre processer och serverar dem på **en enda port, 3000**:

| Sökväg | Process |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST-API:et, inloggningen, bakgrundsarbetet |
| `/mcp` | MCP-servern, för agenter |
| allt annat – `/`, `/f/…`, `/v/…` | gränssnittet |

Vid start går API:et först: på en tom databas tillämpar det katalogen och skapar den första
administratören; vid följande starter har båda stegen ingen effekt. MCP-servern startar så snart
API:et svarar. Om en av processerna stoppas stoppas hela containern, och omstartspolicyn startar
om hela containern.

Avbildningen körs som användaren `node`, på Node 22, och deklarerar en hälsokontroll
(`/healthz`) och en volym, `/data`, för filerna i fälten Fil och Bild.

| Tagg | Innehåll |
|---|---|
| `latest` | den senaste publicerade versionen |
| `0.3` | den senaste versionen 0.3.x |
| `0.3.0` | exakt den versionen |

## Tjänsterna

| Tjänst | Avbildning | Port (på 127.0.0.1) | Volym |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (valfri) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Användbara kommandon

```bash
docker compose up -d                # ladda ned avbildningen och starta
docker compose logs -f basedb       # följ basedb (adminlösenordet vid första starten)
docker compose ps                   # tjänsternas status och hälsa
docker compose restart basedb       # starta om basedb
docker compose down                 # stoppa (volymerna finns kvar)
```

Från en klon av repot bygger `docker compose up -d --build` avbildningen från koden i stället
för att ladda ned den.

## Ändra portarna

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## En befintlig PostgreSQL-databas

Sätt `DATABASE_URL`: basedb ansluter då till den i stället för till containern `db` (som ändå
startar, oanvänd – ta bort den i en fil `docker-compose.override.yml` om du föredrar det). Det
krävs PostgreSQL 16 eller senare, en roll som äger databasen och att tilläggen `pg_trgm` och
`unaccent` finns tillgängliga. Då räcker avbildningen på egen hand – se
[Installation](/basedb/sv/guides/installation/).

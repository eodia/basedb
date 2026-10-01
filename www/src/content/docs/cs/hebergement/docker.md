---
title: Docker Compose
description: Obraz, služby, svazky a běžný provoz.
---

basedb se vydává jako **jediný obraz**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
pro amd64 a arm64. `docker-compose.yml` z repozitáře ho kombinuje s PostgreSQL. Veškerá
konfigurace prochází souborem `.env` (viz
[Proměnné prostředí](/basedb/cs/hebergement/variables/)).

## Obraz

Obsahuje tři procesy basedb a obsluhuje je na **jediném portu, 3000**:

| Cesta | Proces |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST API, přihlašování, práce na pozadí |
| `/mcp` | server MCP pro agenty |
| vše ostatní – `/`, `/f/…`, `/v/…` | rozhraní |

Při spuštění jde první na řadu API: na prázdné databázi použije katalog a vytvoří prvního
správce; při dalších spuštěních nemají tyto dva kroky žádný účinek. Server MCP se spustí,
jakmile API odpovídá. Pokud se některý z procesů zastaví, zastaví se celý kontejner a politika
restartu ho celý znovu spustí.

Obraz běží pod uživatelem `node` na Node 22 a deklaruje kontrolu stavu (`/healthz`) a svazek
`/data` pro soubory polí Soubor a Obrázek.

| Tag | Obsah |
|---|---|
| `latest` | poslední vydaná verze |
| `0.5` | poslední verze 0.5.x |
| `0.5.1` | přesně tato verze |

## Služby

| Služba | Obraz | Port (na 127.0.0.1) | Svazek |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (volitelně) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Užitečné příkazy

```bash
docker compose up -d                # stáhnout obraz a spustit
docker compose logs -f basedb       # sledovat basedb (heslo správce při 1. spuštění)
docker compose ps                   # stav a zdraví služeb
docker compose restart basedb       # restartovat basedb
docker compose down                 # zastavit (svazky zůstanou)
```

Z klonu repozitáře `docker compose up -d --build` sestaví obraz ze zdrojového kódu, místo aby
ho stáhl.

## Za branou, pod cestou

Když je basedb publikováno pod cestou — `https://passerelle.example.com/basedb/` a ne v kořeni
domény —, uveďte tuto cestu:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# nebo bez veřejné adresy:
BASEDB_BASE_PATH=/basedb
```

Vše pak jde pod `/basedb`: rozhraní, `/basedb/api`, `/basedb/mcp`, odkazy ke sdílení
i odkazy z e-mailů. Brána může cestu **zachovat** a požadavek předat dál, nebo ji
**odstranit** – basedb zvládá obojí. `BASEDB_BASE_PATH=/` vynutí kořen.

Obraz je stejný pro všechny adresy: cesta se zapisuje do rozhraní při startu kontejneru
a změna cesty vyžaduje jen restart.

## Změna portů

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Existující databáze PostgreSQL

Nastavte `DATABASE_URL`: basedb se k ní připojí místo kontejneru `db` (který se přesto spustí,
nevyužitý – pokud chcete, odeberte ho v souboru `docker-compose.override.yml`). Je potřeba
PostgreSQL 16 nebo novější, role vlastníka databáze a dostupná rozšíření `pg_trgm`
a `unaccent`. Pak stačí samotný obraz – viz [Instalace](/basedb/cs/guides/installation/).

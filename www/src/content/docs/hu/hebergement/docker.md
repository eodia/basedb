---
title: Docker Compose
description: A lemezkép, a szolgáltatások, a kötetek és a mindennapi üzemeltetés.
---

A basedb **egyetlen lemezképként** jelenik meg, ez az [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
amd64 és arm64 architektúrára. A tároló `docker-compose.yml` fájlja a PostgreSQL-lel együtt
állítja össze. A teljes konfiguráció egy `.env` fájlon keresztül történik (lásd:
[Környezeti változók](/basedb/hu/hebergement/variables/)).

## A lemezkép

A basedb három folyamatát tartalmazza, és **egyetlen porton, a 3000-esen** szolgálja ki őket:

| Útvonal | Folyamat |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | a REST API, a bejelentkezés, a háttérfeladatok |
| `/mcp` | az MCP-szerver, az ügynökök számára |
| minden más – `/`, `/f/…`, `/v/…` | a felület |

Indításkor az API indul el elsőként: üres adatbázison alkalmazza a katalógust, és létrehozza az
első adminisztrátort; a további indításoknál mindkettőnek nincs hatása. Az MCP-szerver akkor
indul el, amikor az API már válaszol. Ha valamelyik folyamat leáll, az egész konténer leáll, és
az újraindítási szabályzat az egészet újraindítja.

A lemezkép a `node` felhasználóval fut, Node 22-n, deklarál egy állapot-ellenőrzést
(`/healthz`) és egy kötetet, a `/data`-t, a Fájl és Kép mezők fájljai számára.

| Címke | Tartalom |
|---|---|
| `latest` | a legutóbb kiadott verzió |
| `0.7` | a legutóbbi 0.7.x verzió |
| `0.7.0` | pontosan ez a verzió |

## A szolgáltatások

| Szolgáltatás | Lemezkép | Port (a 127.0.0.1 címen) | Kötet |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (opcionális) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Hasznos parancsok

```bash
docker compose up -d                # a lemezkép letöltése és indítás
docker compose logs -f basedb       # a basedb követése (adminjelszó az 1. indításkor)
docker compose ps                   # a szolgáltatások állapota
docker compose restart basedb       # a basedb újraindítása
docker compose down                 # leállítás (a kötetek megmaradnak)
```

A tároló egy klónjából a `docker compose up -d --build` a forráskódból építi fel a lemezképet
ahelyett, hogy letöltené.

## Egy átjáró mögött, egy elérési út alatt

Amikor a basedb egy elérési út alatt jelenik meg — `https://passerelle.example.com/basedb/`,
nem pedig egy domain gyökerén —, adja meg ezt az elérési utat:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# vagy, nyilvános cím nélkül:
BASEDB_BASE_PATH=/basedb
```

Ettől kezdve minden a `/basedb` alatt megy: a felület, a `/basedb/api`, a `/basedb/mcp`, a
megosztási hivatkozások és az e-mailekben szereplők. Az átjáró **megtarthatja az elérési
utat**, továbbítva a kérést, vagy **eltávolíthatja**: a basedb mindkettőt elfogadja. A
`BASEDB_BASE_PATH=/` a gyökeret kényszeríti ki.

A lemezkép ugyanaz minden cím esetén: az elérési út a konténer indításakor íródik be a
felületbe, és az elérési út módosítása csak egy újraindítást igényel.

## A portok módosítása

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Meglévő PostgreSQL-adatbázis

Adja meg a `DATABASE_URL` változót: a basedb ehhez csatlakozik a `db` konténer helyett (amely
ettől még elindul, használatlanul – ha szeretné, távolítsa el egy `docker-compose.override.yml`
fájllal). PostgreSQL 16 vagy újabb, az adatbázis tulajdonosi szerepköre, valamint elérhető
`pg_trgm` és `unaccent` bővítmény szükséges. Ekkor maga a lemezkép is elég – lásd:
[Telepítés](/basedb/hu/guides/installation/).

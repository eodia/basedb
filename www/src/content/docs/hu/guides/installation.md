---
title: Telepítés
description: A basedb telepítése Docker Compose-zal, vagy a fejlesztéshez szükséges szolgáltatások elindítása.
---

A basedb **egyetlen Docker-lemezképben** elfér, ez az [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 és arm64): a **felület**, az **API** és az **MCP-szerver**, egyetlen címen
kiszolgálva. Egy **PostgreSQL 16** adatbázisra van szüksége, ezt a `docker-compose.yml` biztosítja.

## Docker Compose-zal (ajánlott)

Előfeltétel: Docker a Compose v2-vel. Két fájl elég, a forráskódra nincs szükség:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Nyissa meg a `.env` fájlt, és adja meg azt a két értéket, amely kötelező:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# egyszer kell létrehozni, végleg: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Ezután indítsa el:

```bash
docker compose up -d
```

Az első indításkor a basedb létrehozza a katalógust. Ezután nyissa meg a
[http://localhost:3000](http://localhost:3000) címet: az első oldal arra kéri, hogy **hozza
létre az adminisztrátori fiókot** a nevével, az e-mail-címével és egy tetszőleges jelszóval,
és ezután rögtön be is jelentkezik.

:::caution[Az első látogatás hozza létre az adminisztrátort]
Amíg nincs adminisztrátor, az első személy, aki megnyitja a felületet, létrehozza. Hozza
létre **azelőtt**, hogy a példányt mások számára elérhetővé tenné – egy domainen, vagy minden
interfészen közzétett porttal.
:::

Beavatkozás nélküli telepítéshez adja meg az adminisztrátort a `.env` fájlban a
`BASEDB_ADMIN_EMAIL` változóval: a basedb az első indításkor létrehozza, és a jelszavát
**egyetlenegyszer** kiírja a naplójába (`docker compose logs basedb`), hacsak nem adja meg
Ön a `BASEDB_ADMIN_PASSWORD` változóval.

| Cím | Szerep |
|---|---|
| http://localhost:3000 | a felület |
| http://localhost:3000/api | a REST API és a dokumentációja |
| http://localhost:3000/mcp | az MCP-szerver, az ügynökök számára |
| localhost:5432 | a PostgreSQL, a `psql` és az Ön eszközei számára |

A portok csak a `127.0.0.1` címen vannak közzétéve. Ha a basedb-t egy domainen szeretné
kiszolgálni, lásd: [Domain és HTTPS](/basedb/hu/hebergement/https/).

## Saját PostgreSQL-lel

Maga a lemezkép is elég, egy PostgreSQL 16-os vagy újabb adatbázissal (az adatbázis
tulajdonosi szerepköre, elérhető `pg_trgm` és `unaccent` bővítmény):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Őrizze meg a létrehozott kulcsot: lásd az alábbi keretes részt.

:::caution[A példány kulcsa]
A `BASEDB_ENCRYPTION_KEY` aláírja a munkameneteket, és titkosítja a tárolt titkokat
(MI-kulcsok, webhooktitkok, az automatizálások titkos fejlécei, űrlaphivatkozások). Ha
megváltoztatja, mindenki kijelentkezik, és ezek a titkok olvashatatlanná válnak. Egyszer hozza
létre, és az adatbázissal együtt mentse.
:::

## Fejlesztéshez

Előfeltételek: Node 22 vagy újabb, Docker és `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

A `pnpm start` szabad portokat választ, elindít egy eldobható PostgreSQL 16-ot, alkalmazza a
katalógust, létrehoz egy fejlesztői adminisztrátort (`admin@basedb.local` /
`developpement-basedb`, a cím a bejelentkezéskor előre ki van töltve), majd fejlesztői módban
elindítja az API-t, az MCP-szervert és a felületet. A `Ctrl+C` mindent leállít, a konténert is.

## És utána?

- [Első lépések](/basedb/hu/guides/premiers-pas/): egy adatbázis, egy tábla, egy nézet, egy űrlap.
- [Környezeti változók](/basedb/hu/hebergement/variables/): fájlok, MI, címek.

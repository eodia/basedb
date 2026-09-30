---
title: Installation
description: Installera basedb med Docker Compose, eller starta utvecklingsmiljön.
---

basedb ryms i **en enda Docker-avbildning**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 och arm64): **gränssnittet**, **API:et** och **MCP-servern**, som serveras på en och samma
adress. Den behöver en **PostgreSQL 16**-databas, som `docker-compose.yml` tillhandahåller.

## Med Docker Compose (rekommenderas)

Förutsättningar: Docker med Compose v2. Två filer räcker, du behöver inte koden:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Öppna `.env` och fyll i de enda två obligatoriska värdena:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# genereras en gång för alla: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Starta sedan:

```bash
docker compose up -d
```

Vid första starten skapar basedb katalogen. Öppna sedan
[http://localhost:3000](http://localhost:3000): den första sidan ber dig att **skapa
administratörskontot**, med ditt namn, din adress och ett lösenord du väljer, och du loggas in
direkt.

:::caution[Det första besöket skapar administratören]
Så länge ingen administratör finns skapar den första person som öppnar gränssnittet den.
Skapa den **innan** du gör instansen nåbar för andra – på en domän, eller med en port som är
publicerad på alla gränssnitt.
:::

För en installation utan manuella steg anger du administratören i `.env` med
`BASEDB_ADMIN_EMAIL`: basedb skapar den vid första starten och visar dess lösenord **en enda
gång** i sina loggar (`docker compose logs basedb`), om du inte bestämmer det själv med
`BASEDB_ADMIN_PASSWORD`.

| Adress | Roll |
|---|---|
| http://localhost:3000 | gränssnittet |
| http://localhost:3000/api | REST-API:et och dess dokumentation |
| http://localhost:3000/mcp | MCP-servern, för agenter |
| localhost:5432 | PostgreSQL, för `psql` och dina verktyg |

Portarna publiceras bara på `127.0.0.1`. För att servera basedb på en domän, se
[Domän och HTTPS](/basedb/sv/hebergement/https/).

## Med din egen PostgreSQL

Avbildningen räcker på egen hand, med en PostgreSQL-databas version 16 eller senare (en roll som
äger databasen, tilläggen `pg_trgm` och `unaccent` tillgängliga):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Spara den genererade nyckeln: se rutan nedan.

:::caution[Instansnyckeln]
`BASEDB_ENCRYPTION_KEY` signerar sessionerna och krypterar sparade hemligheter (AI-nycklar,
webhook-hemligheter, automatiseringarnas hemliga huvuden, formulärlänkar). Ändrar du den loggas alla ut och de hemligheterna blir
oläsliga. Generera den en gång och säkerhetskopiera den tillsammans med databasen.
:::

## För utveckling

Förutsättningar: Node 22 eller senare, Docker och `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` väljer lediga portar, startar en tillfällig PostgreSQL 16, tillämpar katalogen,
skapar en utvecklingsadministratör (`admin@basedb.local` / `developpement-basedb`, med adressen
förifylld vid inloggning) och startar sedan API:et, MCP-servern och gränssnittet i
utvecklingsläge. `Ctrl+C` stoppar allt, containern inräknad.

## Och sedan?

- [Kom igång](/basedb/sv/guides/premiers-pas/): en databas, en tabell, en vy, ett formulär.
- [Miljövariabler](/basedb/sv/hebergement/variables/): filer, AI, adresser.

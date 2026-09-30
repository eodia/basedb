---
title: Installation
description: Installer basedb med Docker Compose, eller start udviklingsmiljøet.
---

basedb fylder **ét enkelt Docker-image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 og arm64): **brugerfladen**, **API'et** og **MCP-serveren**, serveret på én og samme
adresse. Det kræver en **PostgreSQL 16**-database, som `docker-compose.yml` leverer.

## Med Docker Compose (anbefalet)

Forudsætninger: Docker med Compose v2. To filer er nok, du behøver ikke koden:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Åbn `.env`, og udfyld de eneste to påkrævede værdier:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# genereres én gang for alle: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Start derefter:

```bash
docker compose up -d
```

Ved første start opretter basedb kataloget. Åbn derefter
[http://localhost:3000](http://localhost:3000): den første side beder dig om at **oprette
administratorkontoen** med dit navn, din adresse og en adgangskode efter eget valg, og du er
logget ind med det samme.

:::caution[Det første besøg opretter administratoren]
Så længe der ikke findes nogen administrator, opretter den første person, der åbner
brugerfladen, administratoren. Opret den, **før** du gør instansen tilgængelig for andre — på et
domæne eller med en port, der er udgivet på alle netværksgrænseflader.
:::

Til en installation uden indgriben navngiver du administratoren i `.env` med
`BASEDB_ADMIN_EMAIL`: basedb opretter den ved første start og viser dens adgangskode **én
eneste gang** i sine logs (`docker compose logs basedb`), medmindre du selv fastsætter den med
`BASEDB_ADMIN_PASSWORD`.

| Adresse | Rolle |
|---|---|
| http://localhost:3000 | brugerfladen |
| http://localhost:3000/api | REST-API'et og dets dokumentation |
| http://localhost:3000/mcp | MCP-serveren, til agenter |
| localhost:5432 | PostgreSQL, til `psql` og dine værktøjer |

Portene udgives kun på `127.0.0.1`. Se [Domæne og HTTPS](/basedb/da/hebergement/https/) for at
servere basedb på et domæne.

## Med din egen PostgreSQL

Imaget alene er nok, med en PostgreSQL 16-database eller nyere (en rolle, der ejer databasen,
og udvidelserne `pg_trgm` og `unaccent` til rådighed):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Gem den genererede nøgle: se boksen nedenfor.

:::caution[Instansnøglen]
`BASEDB_ENCRYPTION_KEY` signerer sessioner og krypterer gemte hemmeligheder (AI-nøgler,
webhook-hemmeligheder, automatiseringernes hemmelige headere, formularlinks). Hvis du ændrer den, logges alle ud, og disse
hemmeligheder bliver ulæselige. Generér den én gang, og tag backup af den sammen med databasen.
:::

## Til udvikling

Forudsætninger: Node 22 eller nyere, Docker og `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` vælger ledige porte, starter en midlertidig PostgreSQL 16, anvender kataloget,
opretter en udviklingsadministrator (`admin@basedb.local` / `developpement-basedb`, med
adressen udfyldt på forhånd ved login) og starter derefter API'et, MCP-serveren og brugerfladen
i udviklingstilstand. `Ctrl+C` stopper det hele, containeren inklusive.

## Og hvad nu?

- [Kom i gang](/basedb/da/guides/premiers-pas/): en database, en tabel, en visning, en formular.
- [Miljøvariabler](/basedb/da/hebergement/variables/): filer, AI, adresser.

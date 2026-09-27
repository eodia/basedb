---
title: Installatie
description: basedb installeren met Docker Compose, of de ontwikkelomgeving starten.
---

basedb past in **één enkele Docker-image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 en arm64): de **interface**, de **API** en de **MCP-server**, geserveerd op één
adres. De image heeft een **PostgreSQL 16**-database nodig, die het `docker-compose.yml` levert.

## Met Docker Compose (aanbevolen)

Vereisten: Docker met Compose v2. Twee bestanden volstaan, de code heb je niet nodig:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Open `.env` en vul de enige twee verplichte waarden in:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# eenmalig gegenereerd: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Start daarna:

```bash
docker compose up -d
```

Bij de eerste start maakt basedb de catalogus aan. Open vervolgens
[http://localhost:3000](http://localhost:3000): de eerste pagina vraagt je om **het
beheerdersaccount aan te maken**, met je naam, je e-mailadres en een wachtwoord naar keuze, en
je bent meteen ingelogd.

:::caution[Het eerste bezoek maakt de beheerder aan]
Zolang er geen beheerder bestaat, maakt de eerste persoon die de interface opent die aan.
Maak hem aan **voordat** je de instantie voor anderen bereikbaar maakt — op een domein, of met een
poort die op alle interfaces is gepubliceerd.
:::

Voor een installatie zonder tussenkomst geef je de beheerder op in `.env` met
`BASEDB_ADMIN_EMAIL`: basedb maakt hem bij de eerste start aan en toont zijn wachtwoord **één
keer** in de logs (`docker compose logs basedb`), tenzij je het zelf vastlegt
met `BASEDB_ADMIN_PASSWORD`.

| Adres | Rol |
|---|---|
| http://localhost:3000 | de interface |
| http://localhost:3000/api | de REST-API en de documentatie ervan |
| http://localhost:3000/mcp | de MCP-server, voor agents |
| localhost:5432 | PostgreSQL, voor `psql` en je tools |

De poorten worden alleen op `127.0.0.1` gepubliceerd. Om basedb op een domein te serveren, zie
[Domein en HTTPS](/basedb/nl/hebergement/https/).

## Met je eigen PostgreSQL

De image alleen volstaat, met een PostgreSQL-database 16 of hoger (rol die eigenaar is van de
database, extensies `pg_trgm` en `unaccent` beschikbaar):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Bewaar de gegenereerde sleutel: zie het kader hieronder.

:::caution[De instantiesleutel]
`BASEDB_ENCRYPTION_KEY` ondertekent de sessies en versleutelt de opgeslagen geheimen (AI-sleutels,
webhookgeheimen, formulierlinks). Wijzig je hem, dan wordt iedereen uitgelogd en worden die
geheimen onleesbaar. Genereer hem één keer en maak er samen met de database een back-up van.
:::

## Om te ontwikkelen

Vereisten: Node 22 of hoger, Docker, en `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` kiest vrije poorten, start een wegwerp-PostgreSQL 16, past de catalogus toe,
maakt een ontwikkelbeheerder aan (`admin@basedb.local` / `developpement-basedb`,
adres vooraf ingevuld bij het inloggen) en start daarna de API, de MCP-server en de interface in
ontwikkelmodus. `Ctrl+C` stopt alles, de container inbegrepen.

## En nu?

- [Eerste stappen](/basedb/nl/guides/premiers-pas/): een database, een tabel, een weergave, een formulier.
- [Omgevingsvariabelen](/basedb/nl/hebergement/variables/): bestanden, AI, adressen.

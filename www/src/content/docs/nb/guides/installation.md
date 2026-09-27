---
title: Installasjon
description: Installer basedb med Docker Compose, eller start utviklingsmiljøet.
---

basedb får plass i **ett enkelt Docker-image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 og arm64): **grensesnittet**, **API-et** og **MCP-serveren**, servert på én
adresse. Det trenger en **PostgreSQL 16**-database, som `docker-compose.yml` sørger for.

## Med Docker Compose (anbefalt)

Forutsetninger: Docker med Compose v2. To filer holder, du trenger ikke koden:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Åpne `.env` og fyll inn de to eneste obligatoriske verdiene:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# genereres én gang for alle: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Start deretter:

```bash
docker compose up -d
```

Ved første oppstart oppretter basedb katalogen. Åpne så
[http://localhost:3000](http://localhost:3000): den første siden ber deg **opprette
administratorkontoen**, med navnet ditt, e-postadressen din og et passord du velger selv, og
du blir logget inn med en gang.

:::caution[Det første besøket oppretter administratoren]
Så lenge ingen administrator finnes, er det den første personen som åpner grensesnittet, som oppretter den.
Opprett den **før** du gjør instansen tilgjengelig for andre – på et domene, eller med en
port publisert på alle grensesnitt.
:::

For en installasjon uten manuelle steg angir du administratoren i `.env` med
`BASEDB_ADMIN_EMAIL`: basedb oppretter den ved første oppstart og viser passordet **bare
én gang** i loggene sine (`docker compose logs basedb`), med mindre du fastsetter det
med `BASEDB_ADMIN_PASSWORD`.

| Adresse | Rolle |
|---|---|
| http://localhost:3000 | grensesnittet |
| http://localhost:3000/api | REST-API-et og dokumentasjonen |
| http://localhost:3000/mcp | MCP-serveren, for agentene |
| localhost:5432 | PostgreSQL, for `psql` og verktøyene dine |

Portene publiseres bare på `127.0.0.1`. For å servere basedb på et domene, se
[Domene og HTTPS](/basedb/nb/hebergement/https/).

## Med din egen PostgreSQL

Imaget alene holder, med en PostgreSQL 16-database eller nyere (rollen som eier databasen,
utvidelsene `pg_trgm` og `unaccent` tilgjengelige):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Ta vare på den genererte nøkkelen: se boksen nedenfor.

:::caution[Instansnøkkelen]
`BASEDB_ENCRYPTION_KEY` signerer øktene og krypterer de lagrede hemmelighetene (KI-nøkler,
webhook-hemmeligheter, skjemalenker). Hvis du endrer den, logges alle ut, og disse
hemmelighetene blir uleselige. Generer den én gang, og ta sikkerhetskopi av den sammen med databasen.
:::

## For utvikling

Forutsetninger: Node 22 eller nyere, Docker og `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` velger ledige porter, starter en midlertidig PostgreSQL 16, tar i bruk katalogen,
oppretter en utviklingsadministrator (`admin@basedb.local` / `developpement-basedb`,
adressen er forhåndsutfylt ved innlogging), og starter så API-et, MCP-serveren og grensesnittet i
utviklingsmodus. `Ctrl+C` stopper alt, containeren inkludert.

## Og så?

- [Kom i gang](/basedb/nb/guides/premiers-pas/): en database, en tabell, en visning, et skjema.
- [Miljøvariabler](/basedb/nb/hebergement/variables/): filer, KI, adresser.

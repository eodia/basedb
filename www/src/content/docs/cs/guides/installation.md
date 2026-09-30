---
title: Instalace
description: Instalace basedb pomocí Docker Compose nebo spuštění vývojového prostředí.
---

basedb se vejde do **jediného obrazu Dockeru**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 a arm64): **rozhraní**, **API** a **server MCP**, obsluhované na jediné adrese.
Potřebuje databázi **PostgreSQL 16**, kterou dodává `docker-compose.yml`.

## S Docker Compose (doporučeno)

Předpoklady: Docker s Compose v2. Stačí dva soubory, zdrojový kód nepotřebujete:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Otevřete `.env` a vyplňte jediné dvě povinné hodnoty:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# vygenerujte jednou provždy: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Pak spusťte:

```bash
docker compose up -d
```

Při prvním spuštění basedb vytvoří katalog. Poté otevřete
[http://localhost:3000](http://localhost:3000): první stránka vás požádá o **vytvoření účtu
správce** s vaším jménem, e-mailovou adresou a heslem podle vlastní volby a hned nato jste
přihlášeni.

:::caution[První návštěva vytvoří správce]
Dokud neexistuje žádný správce, vytvoří ho první osoba, která otevře rozhraní. Vytvořte ho
**dříve**, než instanci zpřístupníte ostatním – na doméně nebo s portem publikovaným na všech
rozhraních.
:::

Pro instalaci bez zásahu uveďte správce v `.env` pomocí `BASEDB_ADMIN_EMAIL`: basedb ho
vytvoří při prvním spuštění a jeho heslo vypíše **jen jednou** do svých protokolů
(`docker compose logs basedb`), pokud ho nenastavíte pomocí `BASEDB_ADMIN_PASSWORD`.

| Adresa | Role |
|---|---|
| http://localhost:3000 | rozhraní |
| http://localhost:3000/api | REST API a jeho dokumentace |
| http://localhost:3000/mcp | server MCP pro agenty |
| localhost:5432 | PostgreSQL pro `psql` a vaše nástroje |

Porty jsou publikovány pouze na `127.0.0.1`. Chcete-li basedb provozovat na doméně, viz
[Doména a HTTPS](/basedb/cs/hebergement/https/).

## S vlastním PostgreSQL

Stačí samotný obraz a databáze PostgreSQL 16 nebo novější (role vlastníka databáze,
dostupná rozšíření `pg_trgm` a `unaccent`):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Vygenerovaný klíč si uschovejte: viz rámeček níže.

:::caution[Klíč instance]
`BASEDB_ENCRYPTION_KEY` podepisuje relace a šifruje uložená tajemství (klíče AI, tajemství
webhooků, tajné hlavičky automatizací, odkazy formulářů). Jeho změna všechny odhlásí a tato
tajemství se stanou nečitelnými. Vygenerujte ho jednou a zálohujte ho spolu s databází.
:::

## Pro vývoj

Předpoklady: Node 22 nebo novější, Docker a `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` zvolí volné porty, spustí jednorázový PostgreSQL 16, použije katalog, založí
vývojového správce (`admin@basedb.local` / `developpement-basedb`, adresa předvyplněná při
přihlášení) a poté spustí API, server MCP a rozhraní ve vývojovém režimu. `Ctrl+C` zastaví
vše včetně kontejneru.

## A dál?

- [První kroky](/basedb/cs/guides/premiers-pas/): databáze, tabulka, zobrazení, formulář.
- [Proměnné prostředí](/basedb/cs/hebergement/variables/): soubory, AI, adresy.

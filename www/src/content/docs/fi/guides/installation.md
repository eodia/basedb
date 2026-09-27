---
title: Asennus
description: Asenna basedb Docker Composella tai käynnistä kehitysympäristö.
---

basedb mahtuu **yhteen Docker-kuvaan**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 ja arm64): **käyttöliittymä**, **API** ja **MCP-palvelin** tarjoillaan yhdestä
osoitteesta. Se tarvitsee **PostgreSQL 16** -tietokannan, jonka `docker-compose.yml` tarjoaa.

## Docker Composella (suositeltu)

Edellytykset: Docker ja Compose v2. Kaksi tiedostoa riittää, lähdekoodia ei tarvita:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Avaa `.env` ja täytä sen ainoat kaksi pakollista arvoa:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# luodaan kerran ja lopullisesti: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Käynnistä sitten:

```bash
docker compose up -d
```

Ensimmäisellä käynnistyskerralla basedb luo katalogin. Avaa sitten
[http://localhost:3000](http://localhost:3000): ensimmäinen sivu pyytää **luomaan
ylläpitäjän tilin** nimelläsi, osoitteellasi ja valitsemallasi salasanalla, ja olet
heti kirjautuneena sisään.

:::caution[Ensimmäinen käynti luo ylläpitäjän]
Niin kauan kuin ylläpitäjää ei ole, ensimmäinen käyttöliittymän avaaja luo sen. Luo se
**ennen** kuin instanssi on muiden saavutettavissa – verkkotunnuksessa tai kaikkiin
verkkoliitäntöihin julkaistun portin kautta.
:::

Jos haluat asennuksen ilman käsityötä, nimeä ylläpitäjä `.env`-tiedostossa muuttujalla
`BASEDB_ADMIN_EMAIL`: basedb luo sen ensimmäisellä käynnistyskerralla ja näyttää sen salasanan
**vain kerran** lokeissaan (`docker compose logs basedb`), ellet määritä sitä muuttujalla
`BASEDB_ADMIN_PASSWORD`.

| Osoite | Tehtävä |
|---|---|
| http://localhost:3000 | käyttöliittymä |
| http://localhost:3000/api | REST API ja sen dokumentaatio |
| http://localhost:3000/mcp | MCP-palvelin agenteille |
| localhost:5432 | PostgreSQL `psql`:lle ja työkaluillesi |

Portit julkaistaan vain osoitteeseen `127.0.0.1`. Jos haluat tarjota basedb:n verkkotunnuksessa,
katso [Verkkotunnus ja HTTPS](/basedb/fi/hebergement/https/).

## Omalla PostgreSQL:lläsi

Pelkkä kuva riittää, kun käytössä on PostgreSQL 16 -tietokanta tai uudempi (tietokannan
omistajarooli, laajennukset `pg_trgm` ja `unaccent` saatavilla):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Säilytä luotu avain: katso alla oleva laatikko.

:::caution[Instanssin avain]
`BASEDB_ENCRYPTION_KEY` allekirjoittaa istunnot ja salaa tallennetut salaisuudet (tekoälyavaimet,
webhookien salaisuudet, lomakelinkit). Sen vaihtaminen kirjaa kaikki ulos ja tekee näistä
salaisuuksista lukukelvottomia. Luo se kerran ja varmuuskopioi se tietokannan kanssa.
:::

## Kehitystä varten

Edellytykset: Node 22 tai uudempi, Docker ja `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` valitsee vapaat portit, käynnistää kertakäyttöisen PostgreSQL 16:n, soveltaa
katalogin, luo kehityskäyttöön ylläpitäjän (`admin@basedb.local` / `developpement-basedb`,
osoite valmiiksi täytettynä kirjautumisessa) ja käynnistää sitten API:n, MCP-palvelimen ja
käyttöliittymän kehitystilassa. `Ctrl+C` pysäyttää kaiken, kontti mukaan lukien.

## Entä sitten?

- [Ensimmäiset askeleet](/basedb/fi/guides/premiers-pas/): tietokanta, taulukko, näkymä, lomake.
- [Ympäristömuuttujat](/basedb/fi/hebergement/variables/): tiedostot, tekoäly, osoitteet.

---
title: Docker Compose
description: Kuva, palvelut, taltiot ja päivittäinen ylläpito.
---

basedb julkaistaan **yhtenä kuvana**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
amd64- ja arm64-arkkitehtuureille. Tietovaraston `docker-compose.yml` kokoaa sen yhteen
PostgreSQL:n kanssa. Kaikki määritykset tehdään `.env`-tiedostossa (katso
[Ympäristömuuttujat](/basedb/fi/hebergement/variables/)).

## Kuva

Se sisältää basedb:n kolme prosessia ja tarjoilee ne **yhdestä portista, 3000**:

| Polku | Prosessi |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST API, kirjautuminen, taustatyöt |
| `/mcp` | MCP-palvelin agenteille |
| kaikki muu – `/`, `/f/…`, `/v/…` | käyttöliittymä |

Käynnistyksessä API käynnistyy ensimmäisenä: tyhjässä tietokannassa se soveltaa katalogin ja luo
ensimmäisen ylläpitäjän; seuraavilla käynnistyskerroilla kummallakaan ei ole vaikutusta.
MCP-palvelin käynnistyy heti, kun API vastaa. Jos jokin prosesseista pysähtyy, koko kontti
pysähtyy, ja uudelleenkäynnistyskäytäntö käynnistää koko kontin uudelleen.

Kuva ajetaan `node`-käyttäjänä Node 22:lla, ja se määrittää kuntotarkistuksen (`/healthz`) sekä
taltion `/data` Tiedosto- ja Kuva-kenttien tiedostoille.

| Tunniste | Sisältö |
|---|---|
| `latest` | viimeisin julkaistu versio |
| `0.3` | viimeisin 0.3.x-versio |
| `0.3.0` | täsmälleen tämä versio |

## Palvelut

| Palvelu | Kuva | Portti (osoitteessa 127.0.0.1) | Taltio |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (valinnainen) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Hyödyllisiä komentoja

```bash
docker compose up -d                # lataa kuva ja käynnistä
docker compose logs -f basedb       # seuraa basedb:tä (ylläpitäjän salasana 1. käynnistyksessä)
docker compose ps                   # palveluiden tila ja kunto
docker compose restart basedb       # käynnistä basedb uudelleen
docker compose down                 # pysäytä (taltiot säilyvät)
```

Tietovaraston kloonista `docker compose up -d --build` rakentaa kuvan lähdekoodista sen sijaan,
että lataisi sen.

## Porttien vaihtaminen

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Olemassa oleva PostgreSQL-tietokanta

Määritä `DATABASE_URL`: basedb yhdistää siihen `db`-kontin sijaan (joka käynnistyy silti
käyttämättömänä – poista se `docker-compose.override.yml`-tiedostolla, jos haluat). Tarvitaan
PostgreSQL 16 tai uudempi, tietokannan omistajarooli sekä saatavilla olevat laajennukset
`pg_trgm` ja `unaccent`. Pelkkä kuva riittää silloin – katso [Asennus](/basedb/fi/guides/installation/).

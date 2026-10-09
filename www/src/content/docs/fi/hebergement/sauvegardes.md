---
title: Varmuuskopiot ja päivitykset
description: Varmuuskopioi, palauta ja päivitä basedb-instanssi.
---

basedb:n koko tila koostuu kolmesta asiasta: **PostgreSQL-tietokannasta**, Tiedosto- ja
Kuva-kenttien **tiedostoista** ja **instanssin avaimesta**. Varmuuskopioi kaikki kolme.

## Tietokanta

basedb-instanssi on tavallinen PostgreSQL-tietokanta: `pg_dump` riittää.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Palauttaminen tyhjään tietokantaan:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Tiedostot

Levytallennusta käytettäessä ne ovat `basedb`-palvelun `files`-taltiossa:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

S3-tallennusta käytettäessä noudata palveluntarjoajasi varmuuskopiointikäytäntöä
(versiointi, replikointi).

## Instanssin avain

`BASEDB_ENCRYPTION_KEY` salaa tietokantaan tallennetut salaisuudet (tekoälyavaimet, webhookien
salaisuudet, automaatioiden salaiset otsakkeet, lomakelinkit). **Tietokannan varmuuskopio ilman
sen avainta ei palauta näitä salaisuuksia.** Säilytä avain salaisuuksien hallintatyökalussasi varmuuskopioiden rinnalla.

## Päivittäminen

Varmuuskopioi ensin tietokanta ja sitten:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` kiinnittää tietyn version (`0.7.1`) viimeisimmän (`latest`) sijaan.

Käynnistyksessä basedb **päivittää katalogiaan itse**: se soveltaa järjestyksessä ja kunkin
omassa transaktiossaan migraatiot, joita versiossasi ei vielä ole, ja kirjaa ne tauluun
`_basedb.catalog_migration`. Tietosi pysyvät paikallaan. Loki kertoo sen:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Versioita voi ohittaa: kaikki puuttuvat migraatiot ajetaan kerralla järjestyksessä.
Epäonnistuva migraatio jättää katalogin edelliseen versioon koskemattomana, eikä basedb
käynnisty: loki nimeää migraation ja virheen.

**Paluuta vanhaan ei ole.** Vanhempi versio kieltäytyy käynnistymästä katalogissa, jonka uudempi
versio on päivittänyt, sen sijaan että kirjoittaisi muotoon, jota se ei tunne. Jos haluat palata
vanhaan, palauta ennen päivitystä tehty varmuuskopio.

Kun samassa tietokannassa on useita basedb-instansseja, vain yksi päivittää katalogin ja muut
odottavat sitä. `BASEDB_MIGRATE=0` estää instanssia tekemästä migraatioita: se tarkistaa vain,
että katalogi on oikeassa versiossa, ja muussa tapauksessa kieltäytyy käynnistymästä.

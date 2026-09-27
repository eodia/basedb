---
title: Backup og opdateringer
description: Tag backup af, gendan og opdatér en basedb-instans.
---

Hele basedbs tilstand består af tre ting: **PostgreSQL-databasen**, **filerne** i felterne Fil
og Billede og **instansnøglen**. Tag backup af alle tre.

## Databasen

En basedb-instans er en almindelig PostgreSQL-database: `pg_dump` er nok.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

For at gendanne, i en tom database:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Filerne

Med lagring på disk ligger de i volumenet `files` for tjenesten `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Med S3-lagring følger du din udbyders backuppolitik (versionering, replikering).

## Instansnøglen

`BASEDB_ENCRYPTION_KEY` krypterer de hemmeligheder, der er gemt i databasen (AI-nøgler,
webhook-hemmeligheder, formularlinks). **En backup af databasen uden dens nøgle gendanner ikke
disse hemmeligheder.** Opbevar den i din hemmelighedsmanager ved siden af dine backups.

## Opdatering

Tag først backup af databasen, og derefter:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fastlåser en bestemt version (`0.3.1`) i stedet for den seneste (`latest`).

Ved start **opdaterer basedb selv sit katalog**: det anvender i rækkefølge, hver i sin egen
transaktion, de migreringer, som din version endnu ikke har, og registrerer dem i
`_basedb.catalog_migration`. Dine data bliver, hvor de er. Loggen fortæller det:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Du kan springe versioner over: alle manglende migreringer køres på én gang, i rækkefølge. En
migrering, der mislykkes, efterlader kataloget uberørt i den forrige version, og basedb starter
ikke: loggen nævner migreringen og fejlen.

**Ingen tilbagerulning.** En ældre version nægter at starte på et katalog, som en nyere har
opdateret, i stedet for at skrive i en form, den ikke kender. For at gå tilbage skal du gendanne
den backup, der blev taget før opdateringen.

Med flere basedb-instanser på den samme database opdaterer kun én kataloget, og de andre venter
på den. `BASEDB_MIGRATE=0` forhindrer en instans i at migrere: den kontrollerer kun, at kataloget
har den rigtige version, og nægter ellers at starte.

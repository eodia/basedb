---
title: Sikkerhetskopier og oppdateringer
description: Ta sikkerhetskopi av, gjenopprett og oppdater en basedb-instans.
---

Hele tilstanden til basedb består av tre ting: **PostgreSQL-databasen**, **filene** i Fil-
og Bilde-feltene, og **instansnøkkelen**. Ta sikkerhetskopi av alle tre.

## Databasen

En basedb-instans er en vanlig PostgreSQL-database: `pg_dump` holder.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

For å gjenopprette, i en tom database:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Filene

Med lagring på disk ligger de i volumet `files` til tjenesten `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Med S3-lagring følger du sikkerhetskopieringspolicyen til leverandøren din (versjonering,
replikering).

## Instansnøkkelen

`BASEDB_ENCRYPTION_KEY` krypterer hemmelighetene som er lagret i databasen (KI-nøkler,
webhook-hemmeligheter, automatiseringenes hemmelige headere, skjemalenker). **En sikkerhetskopi av databasen uten nøkkelen gjenoppretter ikke disse
hemmelighetene.** Oppbevar den i hemmelighetsbehandleren din, ved siden av sikkerhetskopiene.

## Oppdater

Ta først sikkerhetskopi av databasen, og deretter:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` låser en bestemt versjon (`0.6.1`) i stedet for den nyeste (`latest`).

Ved oppstart **oppdaterer basedb katalogen sin selv**: den tar i bruk, i rekkefølge og
hver i sin egen transaksjon, migreringene som versjonen din ikke har ennå, og registrerer dem
i `_basedb.catalog_migration`. Dataene dine blir liggende. Loggen viser det:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Du kan hoppe over versjoner: alle manglende migreringer kjøres på én gang, i
rekkefølge. En migrering som mislykkes, lar katalogen stå urørt på forrige versjon, og
basedb starter ikke: loggen navngir migreringen og feilen.

**Ingen vei tilbake.** En eldre versjon nekter å starte på en katalog
som en nyere har oppdatert, i stedet for å skrive i en form den ikke kjenner. For å
gå tilbake gjenoppretter du sikkerhetskopien som ble tatt før oppdateringen.

Med flere basedb-instanser på samme database oppdaterer bare én av dem katalogen, og de
andre venter på den. `BASEDB_MIGRATE=0` hindrer en instans i å migrere: den kontrollerer bare
at katalogen har riktig versjon, og nekter ellers å starte.

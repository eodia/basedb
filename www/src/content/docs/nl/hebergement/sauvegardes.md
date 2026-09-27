---
title: Back-ups en updates
description: Een basedb-instantie back-uppen, herstellen en bijwerken.
---

De hele toestand van basedb bestaat uit drie dingen: **de PostgreSQL-database**, **de bestanden** van de velden
Bestand en Afbeelding, en **de instantiesleutel**. Maak van alle drie een back-up.

## De database

Een basedb-instantie is een gewone PostgreSQL-database: `pg_dump` volstaat.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Om te herstellen, in een lege database:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## De bestanden

Met opslag op schijf staan ze in het volume `files` van de service `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Met S3-opslag volg je het back-upbeleid van je provider (versiebeheer,
replicatie).

## De instantiesleutel

`BASEDB_ENCRYPTION_KEY` versleutelt de geheimen die in de database zijn opgeslagen (AI-sleutels,
webhookgeheimen, formulierlinks). **Een back-up van de database zonder de sleutel herstelt die
geheimen niet.** Bewaar de sleutel in je geheimenbeheer, naast de back-ups.

## Bijwerken

Maak eerst een back-up van de database, en daarna:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` legt een precieze versie vast (`0.3.0`) in plaats van de nieuwste (`latest`).

Bij het opstarten **werkt basedb zijn catalogus zelf bij**: het past, in volgorde en
elk in een eigen transactie, de migraties toe die jouw versie nog niet heeft, en registreert ze
in `_basedb.catalog_migration`. Je gegevens blijven staan. Het log meldt het:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Je kunt versies overslaan: alle ontbrekende migraties worden in één keer uitgevoerd, in
volgorde. Een migratie die mislukt, laat de catalogus intact op de vorige versie, en
basedb start niet: het log noemt de migratie en de fout.

**Geen weg terug.** Een oudere versie weigert te starten op een catalogus
die een nieuwere heeft bijgewerkt, in plaats van te schrijven in een vorm die ze niet kent. Om
terug te gaan, herstel je de back-up die vóór de update is gemaakt.

Met meerdere basedb-instanties op dezelfde database werkt er maar één de catalogus bij, de
andere wachten daarop. `BASEDB_MIGRATE=0` verhindert dat een instantie migreert: ze controleert alleen
of de catalogus de juiste versie heeft, en weigert anders te starten.

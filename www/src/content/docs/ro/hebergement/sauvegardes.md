---
title: Copii de rezervă și actualizări
description: Faceți copii de rezervă, restaurați și actualizați o instanță basedb.
---

Întreaga stare a basedb se reduce la trei lucruri: **baza de date PostgreSQL**, **fișierele**
câmpurilor Fișier și Imagine și **cheia instanței**. Faceți copii de rezervă pentru toate
trei.

## Baza de date

O instanță basedb este o bază de date PostgreSQL obișnuită: `pg_dump` este suficient.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Pentru restaurare, într-o bază de date goală:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Fișierele

Cu stocarea pe disc, ele se află în volumul `files` al serviciului `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Cu o stocare S3, urmați politica de copii de rezervă a furnizorului dumneavoastră
(versionare, replicare).

## Cheia instanței

`BASEDB_ENCRYPTION_KEY` criptează secretele salvate în baza de date (chei AI, secrete de
webhook-uri, linkuri de formulare). **O copie de rezervă a bazei de date fără cheia ei nu
restaurează aceste secrete.** Păstrați-o în managerul dumneavoastră de secrete, alături de
copiile de rezervă.

## Actualizarea

Faceți mai întâi o copie de rezervă a bazei de date, apoi:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fixează o versiune precisă (`0.4.0`) în locul celei mai recente (`latest`).

La pornire, basedb **își actualizează singur catalogul**: aplică, în ordine și fiecare în
tranzacția ei, migrările pe care versiunea dumneavoastră nu le are încă și le înscrie în
`_basedb.catalog_migration`. Datele dumneavoastră rămân pe loc. Jurnalul arată acest lucru:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Puteți sări peste versiuni: toate migrările lipsă trec dintr-odată, în ordine. O migrare care
eșuează lasă catalogul la versiunea anterioară, intact, iar basedb nu pornește: jurnalul
numește migrarea și eroarea.

**Fără revenire.** O versiune mai veche refuză să pornească pe un catalog pe care o versiune
mai nouă l-a actualizat, în loc să scrie într-o formă pe care nu o cunoaște. Pentru a reveni,
restaurați copia de rezervă făcută înainte de actualizare.

Cu mai multe instanțe basedb pe aceeași bază de date, doar una actualizează catalogul, celelalte
o așteaptă. `BASEDB_MIGRATE=0` împiedică o instanță să migreze: verifică doar că catalogul este
la versiunea corectă și, altfel, refuză să pornească.

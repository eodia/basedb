---
title: Backup e aggiornamenti
description: Eseguire il backup, ripristinare e aggiornare un’istanza di basedb.
---

Tutto lo stato di basedb sta in tre cose: **il database PostgreSQL**, **i file** dei campi
File e Immagine, e **la chiave dell’istanza**. Esegui il backup di tutte e tre.

## Il database

Un’istanza di basedb è un normale database PostgreSQL: basta `pg_dump`.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Per ripristinare, in un database vuoto:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## I file

Con l’archiviazione su disco, si trovano nel volume `files` del servizio `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Con un’archiviazione S3, segui la politica di backup del tuo fornitore (versionamento,
replica).

## La chiave dell’istanza

`BASEDB_ENCRYPTION_KEY` cifra i segreti salvati nel database (chiavi IA, segreti dei
webhook, link dei moduli). **Un backup del database senza la sua chiave non ripristina questi
segreti.** Conservala nel tuo gestore di segreti, accanto ai backup.

## Aggiornare

Esegui prima il backup del database, poi:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fissa una versione precisa (`0.3.0`) anziché l’ultima (`latest`).

All’avvio, basedb **aggiorna da solo il suo catalogo**: applica, in ordine e
ciascuna nella propria transazione, le migrazioni che la tua versione non ha ancora, e le registra
in `_basedb.catalog_migration`. I tuoi dati restano al loro posto. Il log lo indica:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Si possono saltare versioni: tutte le migrazioni mancanti vengono applicate in una volta, in
ordine. Una migrazione che fallisce lascia il catalogo alla versione precedente, intatto, e
basedb non si avvia: il log indica la migrazione e l’errore.

**Nessun ritorno indietro.** Una versione più vecchia si rifiuta di avviarsi su un catalogo
che una più recente ha aggiornato, anziché scrivere in una forma che non conosce. Per
tornare indietro, ripristina il backup fatto prima dell’aggiornamento.

Con più istanze di basedb sullo stesso database, una sola aggiorna il catalogo, le
altre la aspettano. `BASEDB_MIGRATE=0` impedisce a un’istanza di migrare: verifica soltanto
che il catalogo sia alla versione giusta, e in caso contrario si rifiuta di avviarsi.

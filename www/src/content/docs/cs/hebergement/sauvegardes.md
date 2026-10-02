---
title: Zálohy a aktualizace
description: Zálohování, obnovení a aktualizace instance basedb.
---

Celý stav basedb se skládá ze tří věcí: **databáze PostgreSQL**, **souborů** polí Soubor
a Obrázek a **klíče instance**. Zálohujte všechny tři.

## Databáze

Instance basedb je běžná databáze PostgreSQL: stačí `pg_dump`.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Obnovení do prázdné databáze:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Soubory

S úložištěm na disku jsou ve svazku `files` služby `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

S úložištěm S3 se řiďte zásadami zálohování svého poskytovatele (verzování, replikace).

## Klíč instance

`BASEDB_ENCRYPTION_KEY` šifruje tajemství uložená v databázi (klíče AI, tajemství webhooků,
tajné hlavičky automatizací, odkazy formulářů). **Záloha databáze bez jejího klíče tato
tajemství neobnoví.** Uchovávejte ho ve svém správci tajemství vedle záloh.

## Aktualizace

Nejprve zazálohujte databázi, pak:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` nastaví konkrétní verzi (`0.6.1`) místo nejnovější (`latest`).

Při spuštění basedb **sám aktualizuje svůj katalog**: postupně, každou ve vlastní transakci,
použije migrace, které vaše verze ještě nemá, a zapíše je do `_basedb.catalog_migration`.
Vaše data zůstávají na místě. Protokol to uvádí:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Verze lze přeskakovat: všechny chybějící migrace proběhnou najednou, v pořadí. Migrace, která
selže, ponechá katalog v předchozí verzi, nedotčený, a basedb se nespustí: protokol uvede
migraci a chybu.

**Žádný návrat zpět.** Starší verze se odmítne spustit nad katalogem, který aktualizovala
novější verze, místo aby zapisovala do podoby, kterou nezná. Chcete-li se vrátit, obnovte
zálohu pořízenou před aktualizací.

S více instancemi basedb nad stejnou databází aktualizuje katalog jen jedna, ostatní na ni
čekají. `BASEDB_MIGRATE=0` instanci migraci zakáže: jen ověří, že katalog má správnou verzi,
a jinak se odmítne spustit.

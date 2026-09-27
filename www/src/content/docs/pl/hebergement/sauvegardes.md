---
title: Kopie zapasowe i aktualizacje
description: Twórz kopie zapasowe, przywracaj i aktualizuj instancję basedb.
---

Cały stan basedb mieści się w trzech rzeczach: **bazie PostgreSQL**, **plikach** z pól Plik i
Obraz oraz **kluczu instancji**. Twórz kopie zapasowe wszystkich trzech.

## Baza

Instancja basedb to zwykła baza PostgreSQL: wystarczy `pg_dump`.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Aby przywrócić, do pustej bazy:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Pliki

Przy przechowywaniu na dysku znajdują się w wolumenie `files` usługi `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Przy magazynie S3 stosuj politykę kopii zapasowych swojego dostawcy (wersjonowanie,
replikacja).

## Klucz instancji

`BASEDB_ENCRYPTION_KEY` szyfruje sekrety zapisane w bazie (klucze AI, sekrety webhooków,
linki formularzy). **Kopia zapasowa bazy bez jej klucza nie przywraca tych sekretów.**
Przechowuj go w menedżerze sekretów, obok kopii zapasowych.

## Aktualizacja

Najpierw utwórz kopię zapasową bazy, a potem:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` ustala konkretną wersję (`0.3.0`) zamiast najnowszej (`latest`).

Przy starcie basedb **sam aktualizuje swój katalog**: stosuje, po kolei i każdą w osobnej
transakcji, migracje, których twoja wersja jeszcze nie ma, i zapisuje je w
`_basedb.catalog_migration`. Twoje dane pozostają na miejscu. Log to potwierdza:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Można przeskakiwać wersje: wszystkie brakujące migracje są stosowane za jednym razem, po kolei.
Migracja, która się nie powiedzie, pozostawia katalog w poprzedniej wersji, nienaruszony, a
basedb się nie uruchamia: log podaje nazwę migracji i błąd.

**Nie ma powrotu do starszej wersji.** Starsza wersja odmawia startu na katalogu
zaktualizowanym przez nowszą, zamiast zapisywać w formie, której nie zna. Aby wrócić, przywróć
kopię zapasową wykonaną przed aktualizacją.

Przy kilku instancjach basedb na tej samej bazie tylko jedna aktualizuje katalog, pozostałe na
nią czekają. `BASEDB_MIGRATE=0` uniemożliwia instancji migrację: sprawdza ona tylko, czy
katalog jest we właściwej wersji, a jeśli nie, odmawia startu.

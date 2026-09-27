---
title: Biztonsági mentések és frissítések
description: Egy basedb-példány mentése, visszaállítása és frissítése.
---

A basedb teljes állapota három dologból áll: **a PostgreSQL-adatbázisból**, a Fájl és Kép
mezők **fájljaiból** és **a példány kulcsából**. Mentse mindhármat.

## Az adatbázis

Egy basedb-példány közönséges PostgreSQL-adatbázis: a `pg_dump` elegendő.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

A visszaállításhoz, egy üres adatbázisba:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## A fájlok

Lemezes tárolás esetén a `basedb` szolgáltatás `files` kötetében találhatók:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

S3-tároló esetén kövesse a szolgáltatója mentési szabályzatát (verziókezelés, replikáció).

## A példány kulcsa

A `BASEDB_ENCRYPTION_KEY` titkosítja az adatbázisban tárolt titkokat (MI-kulcsok,
webhooktitkok, űrlaphivatkozások). **Az adatbázis kulcs nélküli mentése nem állítja vissza
ezeket a titkokat.** Őrizze a titokkezelőjében, a mentések mellett.

## Frissítés

Először mentse az adatbázist, majd:

```bash
docker compose pull
docker compose up -d
```

A `BASEDB_VERSION` egy adott verziót (`0.3.0`) rögzít a legutóbbi (`latest`) helyett.

Indításkor a basedb **magától frissíti a katalógusát**: sorrendben, mindegyiket a saját
tranzakciójában alkalmazza azokat a migrációkat, amelyekkel az Ön verziója még nem
rendelkezik, és bejegyzi őket a `_basedb.catalog_migration` táblába. Az adatai a helyükön
maradnak. A napló ezt jelzi:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Verziók átugorhatók: az összes hiányzó migráció egyszerre, sorrendben lefut. A sikertelen
migráció az előző verzión, érintetlenül hagyja a katalógust, és a basedb nem indul el: a napló
megnevezi a migrációt és a hibát.

**Visszalépés nincs.** Egy régebbi verzió nem hajlandó elindulni egy olyan katalóguson, amelyet
egy újabb verzió frissített, ahelyett hogy egy számára ismeretlen formába írna. A
visszalépéshez állítsa vissza a frissítés előtt készült mentést.

Ha ugyanazon az adatbázison több basedb-példány fut, csak az egyik frissíti a katalógust, a
többi megvárja. A `BASEDB_MIGRATE=0` megakadályozza, hogy egy példány migráljon: csak azt
ellenőrzi, hogy a katalógus a megfelelő verzión van-e, ellenkező esetben nem hajlandó elindulni.

---
title: Backups and updates
description: Back up, restore and update a basedb instance.
---

All of basedb’s state comes down to three things: **the PostgreSQL database**, **the files** of
File and Image fields, and **the instance key**. Back up all three.

## The database

A basedb instance is an ordinary PostgreSQL database: `pg_dump` is enough.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

To restore, into an empty database:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## The files

With disk storage, they are in the `files` volume of the `basedb` service:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

With S3 storage, follow your provider’s backup policy (versioning, replication).

## The instance key

`BASEDB_ENCRYPTION_KEY` encrypts the secrets stored in the database (AI keys, webhook secrets,
automation secret headers, form links). **A database backup without its key does not restore
those secrets.** Keep it in your secrets manager, next to the backups.

## Updating

Back up the database first, then:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` pins a specific version (`0.5.0`) rather than the latest (`latest`).

At startup, basedb **updates its catalog by itself**: it applies, in order and each in its own
transaction, the migrations your version does not have yet, and records them in
`_basedb.catalog_migration`. Your data stays in place. The log says so:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

You can skip versions: all the missing migrations run at once, in order. A migration that fails
leaves the catalog at the previous version, intact, and basedb does not start: the log names
the migration and the error.

**No going back.** An older version refuses to start on a catalog that a newer one has updated,
rather than writing in a shape it does not know. To go back, restore the backup made before the
update.

With several basedb instances on the same database, only one updates the catalog, the others
wait for it. `BASEDB_MIGRATE=0` prevents an instance from migrating: it only checks that the
catalog is at the right version, and refuses to start otherwise.

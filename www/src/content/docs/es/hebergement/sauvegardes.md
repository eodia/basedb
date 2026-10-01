---
title: Copias de seguridad y actualizaciones
description: Hacer copias de seguridad, restaurar y actualizar una instancia de basedb.
---

Todo el estado de basedb se reduce a tres cosas: **la base de datos PostgreSQL**, **los archivos** de los campos
Archivo e Imagen, y **la clave de instancia**. Haz copia de seguridad de las tres.

## La base de datos

Una instancia de basedb es una base de datos PostgreSQL normal: basta con `pg_dump`.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Para restaurar, en una base de datos vacía:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Los archivos

Con el almacenamiento en disco, están en el volumen `files` del servicio `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Con un almacenamiento S3, sigue la política de copias de seguridad de tu proveedor (versionado,
replicación).

## La clave de instancia

`BASEDB_ENCRYPTION_KEY` cifra los secretos guardados en la base de datos (claves de IA, secretos de
webhooks, encabezados secretos de las automatizaciones, enlaces de formularios). **Una copia de seguridad de la base de datos sin su clave no restaura esos
secretos.** Guárdala en tu gestor de secretos, junto a las copias de seguridad.

## Actualizar

Haz primero una copia de seguridad de la base de datos y después:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fija una versión concreta (`0.5.1`) en lugar de la última (`latest`).

Al arrancar, basedb **actualiza su catálogo por sí mismo**: aplica, en orden y
cada una en su propia transacción, las migraciones que tu versión aún no tiene, y las registra
en `_basedb.catalog_migration`. Tus datos se quedan donde están. El registro lo indica:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Se pueden saltar versiones: todas las migraciones que faltan se aplican de una vez, en
orden. Una migración que falla deja el catálogo en la versión anterior, intacto, y
basedb no arranca: el registro nombra la migración y el error.

**Sin vuelta atrás.** Una versión más antigua se niega a arrancar sobre un catálogo
que una más reciente ha actualizado, en lugar de escribir en una forma que desconoce. Para
volver atrás, restaura la copia de seguridad hecha antes de la actualización.

Con varias instancias de basedb sobre la misma base de datos, solo una actualiza el catálogo; las
demás la esperan. `BASEDB_MIGRATE=0` impide que una instancia migre: solo comprueba
que el catálogo está en la versión correcta, y si no, se niega a arrancar.

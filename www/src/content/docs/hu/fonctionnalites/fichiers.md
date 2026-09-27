---
title: Fájlok
description: A Fájl és a Kép mezők, lemezen vagy S3-kompatibilis tárolóban.
---

A **Fájl** és a **Kép** mezők fájlokat fogadnak. A bájtok **nem kerülnek a PostgreSQL-be**: az
oszlop azt tárolja, ami a felsorolásukhoz kell (azonosító, név, típus, méret), maguk a fájlok
pedig egy külön tárolóban élnek, és aláírt hivatkozásokon keresztül érhetők el.

## Lemezen

Alapértelmezés szerint az API egy könyvtárba írja a fájlokat – a Docker-lemezképben ez a
`/data/files` helyre csatolt `files` kötet. Egyetlen gazdagéphez ez elegendő; az API
indításkor kiírja, hová kerülnek a fájlok.

## S3-kompatibilis tárolóban

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   a gazdanév alapú címzéshez
```

Ha a `BASEDB_S3_BUCKET` a többi érték nélkül van megadva, az API nem hajlandó elindulni, és
megmondja, melyek hiányoznak.

## Méret

A `BASEDB_FILES_MAX_MB` korlátozza egy fájl méretét (alapértelmezés szerint 25 MB).

:::note
A hivatkozással megosztott űrlapok nem teszik fel a Fájl és Kép típusú kérdéseket: nem nyitják
meg a fájlfeltöltést ismeretlenek előtt.
:::

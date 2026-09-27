---
title: Filer
description: Fälten Fil och Bild, på disk eller i en S3-kompatibel lagring.
---

Fälten **Fil** och **Bild** tar emot filer. Filinnehållet **hamnar inte i PostgreSQL**:
kolumnen sparar det som behövs för att lista dem (identifierare, namn, typ, storlek), och själva
filerna finns i en särskild lagring och serveras via signerade länkar.

## På disk

Som standard skriver API:et filerna till en katalog – i Docker-avbildningen volymen `files`,
monterad på `/data/files`. Det räcker för en enda värd; API:et talar om vid start vart filerna
hamnar.

## I en S3-kompatibel lagring

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO …:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   för värdbaserad adressering
```

Om `BASEDB_S3_BUCKET` är satt utan de andra värdena vägrar API:et att starta och talar om vilka
som saknas.

## Storlek

`BASEDB_FILES_MAX_MB` begränsar storleken på en fil (25 MB som standard).

:::note
Formulär som delas via en länk ställer inte frågorna av typen Fil och Bild: de öppnar inte
filuppladdningen för okända.
:::

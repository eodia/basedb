---
title: Filer
description: Felterne Fil og Billede, på disk eller i et S3-kompatibelt lager.
---

Felterne **Fil** og **Billede** tager imod filer. Selve bytene **lægges ikke i
PostgreSQL**: kolonnen gemmer det, der skal til for at liste dem (id, navn, type, størrelse),
og selve filerne lever i et dedikeret lager og serveres via signerede links.

## På disk

Som standard skriver API'et filerne til en mappe — i Docker-imaget volumen `files`, der er
monteret på `/data/files`. Det er nok til en enkelt vært; API'et fortæller ved opstart, hvor
filerne lægges.

## I et S3-kompatibelt lager

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO …:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   til host-baseret adressering
```

Hvis `BASEDB_S3_BUCKET` er sat uden de andre værdier, nægter API'et at starte og fortæller,
hvilke der mangler.

## Størrelse

`BASEDB_FILES_MAX_MB` begrænser størrelsen på en fil (25 MB som standard).

:::note
Formularer, der deles via et link, stiller ikke spørgsmålene Fil og Billede: de åbner ikke for
filupload fra ukendte.
:::

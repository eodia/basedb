---
title: Filer
description: Fil- og Bilde-feltene, på disk eller i en S3-kompatibel lagring.
---

Feltene **Fil** og **Bilde** tar imot filer. Bytene **havner ikke i
PostgreSQL**: kolonnen tar vare på det som trengs for å liste dem (identifikator, navn, type, størrelse),
og selve filene bor i en egen lagring og serveres via signerte lenker.

## På disk

Som standard skriver API-et filene til en katalog – i Docker-imaget volumet
`files` montert på `/data/files`. Det holder for én enkelt vert; API-et sier ved oppstart hvor
filene havner.

## I en S3-kompatibel lagring

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO …:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   for vertsbasert adressering
```

Hvis `BASEDB_S3_BUCKET` er satt uten de andre verdiene, nekter API-et å starte og sier
hvilke som mangler.

## Størrelse

`BASEDB_FILES_MAX_MB` begrenser størrelsen på en fil (25 MB som standard).

:::note
Skjemaer som deles med en lenke, stiller ikke Fil- og Bilde-spørsmålene: de
åpner ikke filopplastingen for ukjente.
:::

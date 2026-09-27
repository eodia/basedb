---
title: Bestanden
description: De velden Bestand en Afbeelding, op schijf of in een S3-compatibele opslag.
---

De velden **Bestand** en **Afbeelding** accepteren bestanden. De bytes **gaan niet naar
PostgreSQL**: de kolom bewaart wat nodig is om ze op te sommen (id, naam, type, grootte),
en de bestanden zelf leven in een eigen opslag, geserveerd via ondertekende links.

## Op schijf

Standaard schrijft de API de bestanden naar een map — in de Docker-image het volume
`files`, gekoppeld op `/data/files`. Dat volstaat voor één host; de API meldt bij het opstarten waar
de bestanden naartoe gaan.

## In een S3-compatibele opslag

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   voor adressering per host
```

Als `BASEDB_S3_BUCKET` is ingesteld zonder de andere waarden, weigert de API te starten en meldt
welke ontbreken.

## Grootte

`BASEDB_FILES_MAX_MB` begrenst de grootte van een bestand (standaard 25 MB).

:::note
Formulieren die via een link worden gedeeld, stellen de vragen Bestand en Afbeelding niet: ze
stellen het uploaden van bestanden niet open voor onbekenden.
:::

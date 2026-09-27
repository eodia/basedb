---
title: Dosyalar
description: Diskte ya da S3 uyumlu bir depolamada Dosya ve Görsel alanları.
---

**Dosya** ve **Görsel** alanları dosya kabul eder. Baytlar **PostgreSQL'e gitmez**: sütun,
dosyaları listelemek için gerekenleri (kimlik, ad, tür, boyut) saklar; dosyaların kendisi ise
imzalı bağlantılarla sunulan ayrı bir depolamada yaşar.

## Diskte

Varsayılan olarak API dosyaları bir dizine yazar — Docker imajında bu, `/data/files` üzerine
bağlanan `files` birimidir. Tek bir sunucu için bu yeterlidir; API başlangıçta dosyaların
nereye gittiğini söyler.

## S3 uyumlu bir depolamada

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   ana makine tabanlı adresleme için
```

`BASEDB_S3_BUCKET` diğer değerler olmadan tanımlanırsa API başlamayı reddeder ve hangilerinin
eksik olduğunu söyler.

## Boyut

`BASEDB_FILES_MAX_MB` bir dosyanın boyutunu sınırlar (varsayılan 25 MB).

:::note
Bir bağlantıyla paylaşılan formlar Dosya ve Görsel sorularını sormaz: dosya yüklemeyi
yabancılara açmazlar.
:::

---
title: Pliki
description: Pola Plik i Obraz, na dysku lub w magazynie zgodnym z S3.
---

Pola **Plik** i **Obraz** przyjmują pliki. Bajty **nie trafiają do PostgreSQL**: kolumna
przechowuje to, co potrzebne do ich wylistowania (identyfikator, nazwę, typ, rozmiar), a same
pliki żyją w osobnym magazynie i są serwowane przez podpisane linki.

## Na dysku

Domyślnie API zapisuje pliki w katalogu – w obrazie Dockera jest to wolumen `files`
zamontowany w `/data/files`. To wystarcza dla jednego hosta; przy starcie API podaje, dokąd
trafiają pliki.

## W magazynie zgodnym z S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   dla adresowania przez host
```

Jeśli `BASEDB_S3_BUCKET` jest ustawione bez pozostałych wartości, API odmawia startu i podaje,
których brakuje.

## Rozmiar

`BASEDB_FILES_MAX_MB` ogranicza rozmiar pliku (domyślnie 25 MB).

:::note
Formularze udostępnione przez link nie zadają pytań typu Plik i Obraz: nie otwierają
przesyłania plików dla nieznajomych.
:::

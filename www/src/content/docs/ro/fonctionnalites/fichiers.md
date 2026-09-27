---
title: Fișiere
description: Câmpurile Fișier și Imagine, pe disc sau într-o stocare compatibilă S3.
---

Câmpurile **Fișier** și **Imagine** acceptă fișiere. Octeții **nu ajung în PostgreSQL**:
coloana păstrează ce este necesar pentru a le lista (identificator, nume, tip, dimensiune),
iar fișierele propriu-zise se află într-o stocare dedicată, servite prin linkuri semnate.

## Pe disc

În mod implicit, API-ul scrie fișierele într-un director — în imaginea Docker, volumul `files`
montat pe `/data/files`. Este suficient pentru o singură gazdă; la pornire, API-ul spune unde
ajung fișierele.

## Într-o stocare compatibilă S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   pentru adresarea după gazdă
```

Dacă `BASEDB_S3_BUCKET` este definit fără celelalte valori, API-ul refuză să pornească și
spune care dintre ele lipsesc.

## Dimensiune

`BASEDB_FILES_MAX_MB` limitează dimensiunea unui fișier (25 MB în mod implicit).

:::note
Formularele partajate printr-un link nu pun întrebările de tip Fișier și Imagine: nu deschid
încărcarea de fișiere unor necunoscuți.
:::

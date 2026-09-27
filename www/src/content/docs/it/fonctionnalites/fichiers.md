---
title: File
description: I campi File e Immagine, su disco o in un’archiviazione compatibile con S3.
---

I campi **File** e **Immagine** accettano file. I byte **non vanno in
PostgreSQL**: la colonna conserva ciò che serve per elencarli (identificativo, nome, tipo, dimensione),
e i file veri e propri vivono in un’archiviazione dedicata, serviti tramite link firmati.

## Su disco

Per impostazione predefinita, l’API scrive i file in una directory — nell’immagine Docker, il volume
`files` montato su `/data/files`. Basta per un singolo host; all’avvio l’API indica dove vanno
i file.

## In un’archiviazione compatibile con S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   per l’indirizzamento basato sull’host
```

Se `BASEDB_S3_BUCKET` è definito senza gli altri valori, l’API si rifiuta di avviarsi e indica
quali mancano.

## Dimensione

`BASEDB_FILES_MAX_MB` limita la dimensione di un file (25 MB per impostazione predefinita).

:::note
I moduli condivisi tramite link non pongono le domande File e Immagine: non
aprono il caricamento di file a sconosciuti.
:::

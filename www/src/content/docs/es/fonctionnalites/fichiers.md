---
title: Archivos
description: Los campos Archivo e Imagen, en disco o en un almacenamiento compatible con S3.
---

Los campos **Archivo** e **Imagen** aceptan archivos. Los bytes **no van a
PostgreSQL**: la columna guarda lo necesario para listarlos (identificador, nombre, tipo, tamaño),
y los propios archivos viven en un almacenamiento dedicado y se sirven mediante enlaces firmados.

## En disco

De forma predeterminada, la API escribe los archivos en un directorio: en la imagen Docker, el volumen
`files` montado en `/data/files`. Basta para un solo host; al arrancar, la API indica adónde van
los archivos.

## En un almacenamiento compatible con S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   para el direccionamiento por host
```

Si `BASEDB_S3_BUCKET` está definido sin los demás valores, la API se niega a arrancar e indica
cuáles faltan.

## Tamaño

`BASEDB_FILES_MAX_MB` limita el tamaño de un archivo (25 MB de forma predeterminada).

:::note
Los formularios compartidos mediante un enlace no plantean las preguntas Archivo e Imagen: no
abren la subida de archivos a desconocidos.
:::

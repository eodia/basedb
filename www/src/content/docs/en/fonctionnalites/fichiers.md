---
title: Files
description: File and Image fields, on disk or in S3-compatible storage.
---

**File** and **Image** fields accept files. The bytes **do not go into PostgreSQL**: the
column keeps what is needed to list them (identifier, name, type, size), and the files
themselves live in dedicated storage, served through signed links.

## On disk

By default, the API writes files to a directory — in the Docker image, the `files` volume
mounted on `/data/files`. This is enough for a single host; the API says at startup where the
files go.

## In S3-compatible storage

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   for virtual-hosted-style addressing
```

If `BASEDB_S3_BUCKET` is set without the other values, the API refuses to start and says which
ones are missing.

## Size

`BASEDB_FILES_MAX_MB` caps the size of a file (25 MB by default).

:::note
Forms shared through a link do not ask File and Image questions: they do not open file
uploads to strangers.
:::

---
title: Dateien
description: Die Felder Datei und Bild, auf der Festplatte oder in einem S3-kompatiblen Speicher.
---

Die Felder **Datei** und **Bild** nehmen Dateien auf. Die Bytes **landen nicht in PostgreSQL**:
Die Spalte speichert, was nötig ist, um sie aufzulisten (Kennung, Name, Typ, Größe), und die
Dateien selbst liegen in einem eigenen Speicher und werden über signierte Links ausgeliefert.

## Auf der Festplatte

Standardmäßig schreibt die API die Dateien in ein Verzeichnis – im Docker-Image in das Volume
`files`, eingehängt unter `/data/files`. Das genügt für einen einzelnen Host; die API meldet beim
Start, wohin die Dateien gehen.

## In einem S3-kompatiblen Speicher

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO …:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   für die Adressierung über den Hostnamen
```

Ist `BASEDB_S3_BUCKET` ohne die anderen Werte gesetzt, verweigert die API den Start und nennt die
fehlenden.

## Größe

`BASEDB_FILES_MAX_MB` begrenzt die Größe einer Datei (standardmäßig 25 MB).

:::note
Per Link freigegebene Formulare stellen die Fragen Datei und Bild nicht: Sie öffnen den
Dateispeicher nicht für Unbekannte.
:::

---
title: Fichiers
description: Les champs Document et Image, sur disque ou dans un stockage compatible S3.
---

Les champs **Document** et **Image** acceptent des fichiers. Les octets **ne vont pas dans
PostgreSQL** : la colonne garde ce qu’il faut pour les lister (identifiant, nom, type, taille),
et les fichiers eux-mêmes vivent dans un stockage dédié, servis par des liens signés.

## Sur disque

Par défaut, l’API écrit les fichiers dans un répertoire — dans l’image Docker, le volume
`files` monté sur `/data/files`. Cela suffit pour un seul hôte ; l’API dit au démarrage où vont
les fichiers.

## Dans un stockage compatible S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO… :

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   pour l’adressage par hôte
```

Si `BASEDB_S3_BUCKET` est défini sans les autres valeurs, l’API refuse de démarrer et dit
lesquelles manquent.

## Taille

`BASEDB_FILES_MAX_MB` borne la taille d’un fichier (25 Mo par défaut).

:::note
Les formulaires partagés par un lien ne posent pas les questions Document et Image : ils
n’ouvrent pas le dépôt de fichiers à des inconnus.
:::

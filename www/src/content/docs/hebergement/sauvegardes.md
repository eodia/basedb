---
title: Sauvegardes et mises à jour
description: Sauvegarder, restaurer et mettre à jour une instance basedb.
---

Tout l’état de basedb tient en trois choses : **la base PostgreSQL**, **les fichiers** des champs
Document et Image, et **la clé d’instance**. Sauvegardez les trois.

## La base

Une instance basedb est une base PostgreSQL ordinaire : `pg_dump` suffit.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Pour restaurer, dans une base vide :

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Les fichiers

Avec le stockage sur disque, ils sont dans le volume `files` du service `api` :

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Avec un stockage S3, suivez la politique de sauvegarde de votre fournisseur (versionnement,
réplication).

## La clé d’instance

`BASEDB_ENCRYPTION_KEY` chiffre les secrets enregistrés dans la base (clés d’IA, secrets de
webhooks, liens de formulaires). **Une sauvegarde de la base sans sa clé ne restaure pas ces
secrets.** Conservez-la dans votre gestionnaire de secrets, à côté des sauvegardes.

## Mettre à jour

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fixe une version précise (`0.1.1`) plutôt que la dernière (`latest`).

:::caution[En développement actif]
Avant la première version stable, le catalogue n’a qu’une migration, régénérée au fil du
développement : une mise à jour qui le modifie peut demander de repartir d’une base neuve.
Sauvegardez avant chaque mise à jour, et lisez les [nouveautés](/basedb/nouveautes/).
:::

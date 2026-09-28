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

Avec le stockage sur disque, ils sont dans le volume `files` du service `basedb` :

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

Sauvegardez d’abord la base, puis :

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` fixe une version précise (`0.3.2`) plutôt que la dernière (`latest`).

Au démarrage, basedb **met son catalogue à jour de lui-même** : il applique, dans l’ordre et
chacune dans sa transaction, les migrations que votre version n’a pas encore, et les inscrit
dans `_basedb.catalog_migration`. Vos données restent en place. Le journal le dit :

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

On peut sauter des versions : toutes les migrations manquantes passent d’un coup, dans
l’ordre. Une migration qui échoue laisse le catalogue à la version précédente, intact, et
basedb ne démarre pas : le journal nomme la migration et l’erreur.

**Pas de retour arrière.** Une version plus ancienne refuse de démarrer sur un catalogue
qu’une plus récente a mis à jour, plutôt que d’écrire dans une forme qu’elle ignore. Pour
revenir en arrière, restaurez la sauvegarde faite avant la mise à jour.

Avec plusieurs instances de basedb sur la même base, une seule met le catalogue à jour, les
autres l’attendent. `BASEDB_MIGRATE=0` empêche une instance de migrer : elle vérifie seulement
que le catalogue est à la bonne version, et refuse de démarrer sinon.

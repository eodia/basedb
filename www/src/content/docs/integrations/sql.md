---
title: SQL direct
description: Lire et écrire les tables de basedb avec psql, un outil de BI ou un script.
---

C’est la raison d’être de basedb : **vos tables sont de vraies tables**. Tout client PostgreSQL
les lit sous leur nom.

## Les noms

| Objet | Nom physique | Exemple |
|---|---|---|
| Base | un schéma `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Environnement de recette | le schéma suffixé | `b_t4z56fq_ventes_recette` |
| Table | son nom slugifié | `opportunites` |
| Champ | son nom slugifié | `echeance` |
| Relation | `<table cible>_id` | `clients_id` |

La page **Documentation API et MCP** de chaque base les donne tous, et `\d` dans `psql` montre
les descriptions (`COMMENT ON`).

## Dans l’interface

Le **+** de la barre d’onglets, ou menu **⋯** de la base → **Nouvelle requête SQL** : une
console avec coloration et complétion,
dont le résultat s’affiche dans la même grille que vos tables.

![Une requête dans la console SQL](../../../assets/screens/requete-sql.png)

## Depuis psql

Avec le `docker-compose.yml` fourni, PostgreSQL est publié sur `127.0.0.1:5432` :

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## Écrire en SQL

C’est permis. Les contraintes (listes de choix, relations, liens URL, obligatoire) sont tenues
par PostgreSQL et refusent une valeur invalide, comme dans l’interface. Et l’écriture est
**historisée** : l’historique l’affiche comme « Session SQL directe », avec la session qui l’a
faite, et elle s’annule comme les autres.

:::caution
Changer la **structure** en SQL (`ALTER TABLE`) contourne le catalogue de basedb, qui ne la
connaîtrait pas. Passez par l’interface, l’API ou une proposition d’agent : le moteur de
migrations planifie, verrouille court et garde le catalogue exact.
:::

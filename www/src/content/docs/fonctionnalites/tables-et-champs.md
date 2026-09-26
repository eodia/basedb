---
title: Tables et champs
description: Les types de champs de basedb et leur projection en PostgreSQL.
---

Chaque table de basedb est une table PostgreSQL ; chaque champ, une colonne typée. Le libellé
que vous saisissez (« Échéance ») devient un nom physique lisible (`echeance`) par une
**slugification** stable : sans accent, en minuscules, sans mot réservé.

## Les types

| Type | Colonne PostgreSQL | Remarques |
|---|---|---|
| Texte | `text` | une ligne |
| Texte long | `text` | Markdown : un extrait dans la grille, le rendu au survol, un éditeur dédié |
| Nombre | `numeric` | jamais de flottant : un montant ne dérive pas |
| Booléen | `boolean` | |
| Date | `date` | |
| Date et heure | `timestamptz` | un instant absolu, affiché dans le fuseau du lecteur |
| Liste de choix | `text` + `CHECK` | couleur, pictogramme ou image par option |
| Choix multiple | `text[]` + `CHECK` | filtrable avec les opérateurs de tableau |
| Relation | `uuid` + `FOREIGN KEY` | une vraie clé étrangère vers la table cible |
| Lien URL | `text` + `CHECK` | complété à la saisie (`exemple.fr` → `https://exemple.fr`) |
| Formule | colonne générée `STORED` | calculée par PostgreSQL |
| Document, Image | `jsonb` (métadonnées) | les octets vont dans le [stockage de fichiers](/basedb/fonctionnalites/fichiers/) |

Chaque table porte aussi ses **colonnes système** : `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` — tenues par un déclencheur, jamais inscriptibles
par l’API.

## Des contraintes tenues par la base

Ce que l’interface promet, PostgreSQL le garantit. Une liste de choix est une contrainte
`CHECK` ; une relation, une `FOREIGN KEY` ; un lien URL, une expression régulière. Une écriture
en SQL direct qui les viole est refusée, comme dans l’interface :

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Les relations

Une relation relie une ligne à une ligne d’une autre table de la même base. La grille affiche
la **valeur d’affichage** de la ligne cible — la colonne que vous désignez comme telle pour sa
table — et les filtres traversent la relation (`clients_id.ville eq "Lyon"`). Les lignes qui pointent vers
une ligne s’affichent dans sa vue détail.

## Descriptions

Une base, une table et un champ portent une **description**, modifiable sans migration. Elle est
recopiée dans le `COMMENT ON` que lit `psql`, dans la documentation générée, et dans ce qu’un
agent lit par `describe_table`.

## Modifier la structure

Ajouter, renommer, changer le type d’un champ passe par le **moteur de migrations** : un plan en
étapes, des verrous courts, et un refus nommé quand une donnée ne se convertit pas. Renommer le
nom physique d’une table ou d’une base garde l’ancien nom servi par un **alias de
compatibilité** — une vue — le temps de mettre à jour vos requêtes.

Supprimer n’efface rien tout de suite : la table ou la base est reléguée
(`zz_supprime_…`) et reste lisible en SQL. Une base supprimée se restaure ; ramener une table
seule depuis l’interface est [à venir](/basedb/feuille-de-route/). La **purge** définitive est
réservée à l’administration, trente jours après, et commence par un export CSV vérifié.

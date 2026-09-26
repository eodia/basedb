---
title: Environnements
description: Production, recette, développement — comparer, migrer, synchroniser.
---

Une base peut avoir des **environnements** : production, recette, développement… Chacun est une
base à part entière — son schéma, ses tables, ses lignes, ses droits — et tous partagent la
**lignée** de la base, de ses tables et de ses champs.

## Dans l’interface

La barre latérale montre **une ligne par base**, avec un badge qui dit l’environnement ouvert et
permet d’en changer. Le badge n’apparaît pas tant qu’il n’y a que la production.

Les environnements s’ajoutent, se renomment et se suppriment dans **Modifier la base…** : un
nouvel environnement naît d’une **copie de la structure** d’un autre, sans ses lignes.

## Comparer les environnements

Depuis le menu de la base, **Comparer les environnements…** ouvre un dialogue :

- **Structure** : les environnements en colonnes, tables et champs en lignes ; ce qui diffère de
  la production est surligné.
- **Appliquer les migrations…** prépare le plan pour passer d’un environnement à un autre, étape
  par étape. Il ne coche jamais d’office ce qui annulerait une modification plus récente de la
  cible.
- **Synchronisation des lignes** : table par table, reporter des lignes d’un environnement vers
  un autre, par identifiant.

![Comparer la production et la recette](../../../assets/screens/environnements.png)

## Comment basedb sait qui a changé quoi

La comparaison s’appuie sur l’**historique des structures** : chaque création, modification ou
suppression de table ou de champ est capturée par déclencheur sur le catalogue, et se lit dans
l’onglet « Structure » de l’historique. Les identifiants de lignée relient un champ de recette
à son homologue de production, même renommé.

## En SQL

Chaque environnement est un schéma : `b_t4z56fq_ventes` pour la production,
`b_t4z56fq_ventes_recette` pour la recette. Vos requêtes changent d’environnement en changeant
de schéma — ou de `search_path`.

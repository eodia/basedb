---
title: Droits et groupes
description: Comptes, groupes, niveaux d’accès par projet, base et table, et restrictions par champ.
---

Les droits s’accordent à des **groupes**, jamais à des personnes une par une — sur le modèle de
Metabase. Un niveau posé sur un projet, une base ou une table descend sur tout ce qui est
dessous, y compris ce qui sera créé plus tard.

## Les quatre niveaux

| Niveau | Permet |
|---|---|
| **Aucun accès** | rien : la ressource est invisible |
| **Lecture** | voir les lignes |
| **Édition** | créer, modifier, supprimer des lignes |
| **Gestion** | et changer la structure, créer des vues et des jetons |

Les droits **s’additionnent** : une personne reçoit le niveau le plus élevé que lui donne l’un de
ses groupes. Donner moins à une table qu’à sa base la rend « granulaire ».

Deux groupes existent toujours : **Administrateurs**, qui gèrent tout, et **Tous les
utilisateurs**, dont chaque compte fait partie — ce qu’on lui accorde, tout le monde l’a.

## Jusqu’au champ

Sous la grille des niveaux, **Champs** masque une colonne à un groupe, ou la rend non modifiable
pour lui. L’écran montre aussi ce qu’une personne donnée voit réellement, et par quel groupe.

Un champ masqué est absent partout : de la grille, des vues, de l’API, du MCP, de l’historique.
Filtrer ou trier sur lui répond comme pour un champ qui n’existe pas.

## Comptes et connexion

- Un compte se crée avec un **mot de passe temporaire**, montré une fois et à changer à la
  première connexion.
- La connexion se fait par mot de passe ou par un fournisseur **OpenID Connect** déclaré par
  l’exploitant.
- Les actions d’administration demandent une **session élevée** : un mot de passe retapé dans les
  cinq dernières minutes.
- Les sessions se révoquent ; révoquer une session invalide aussitôt ses jetons d’accès.

## Le point d’application unique

Toutes les surfaces — interface, API, MCP, formulaires partagés — passent par le même point de
décision des droits, dans le noyau. Il n’existe pas de route privée de l’interface : ce que
l’écran n’affiche pas, c’est que l’API ne l’a pas renvoyé.

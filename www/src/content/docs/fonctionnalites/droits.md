---
title: Droits et groupes
description: Comptes, groupes, niveaux d’accès par projet, base et table, restrictions par champ, et vos paramètres.
---

Les droits s’accordent à des **groupes**, jamais à des personnes une par une. Un niveau
posé sur un projet, une base ou une table descend sur tout ce qui est
dessous, y compris ce qui sera créé plus tard.

## Les quatre niveaux

| Niveau | Permet |
|---|---|
| **Aucun accès** | rien : la ressource est invisible |
| **Lecture** | voir les lignes, les commenter, se faire des vues personnelles, consulter la structure et les tableaux de bord, poser ses propres questions, écrire du SQL en lecture seule et enregistrer ses requêtes personnelles |
| **Édition** | et créer, modifier, supprimer des lignes |
| **Gestion** | et changer la structure, créer les vues partagées, les tableaux de bord et les questions enregistrées, partager un tableau de bord par un lien, partager des requêtes, créer des vues SQL, les automatisations, les intégrations et les jetons ; son SQL a toute la base, écritures comprises |

Les droits **s’additionnent** : une personne reçoit le niveau le plus élevé que lui donne l’un de
ses groupes. Donner moins à une table qu’à sa base la rend « granulaire ».

Deux groupes existent toujours : **Administrateurs**, qui gèrent tout, et **Tous les
utilisateurs**, dont chaque compte fait partie — ce qu’on lui accorde, tout le monde l’a.

## Jusqu’au champ

Sous la grille des niveaux, **Champs** masque une colonne à un groupe, ou la rend non modifiable
pour lui. L’écran montre aussi ce qu’une personne donnée voit réellement, et par quel groupe.

Un champ masqué est absent partout : de la grille, des vues, de l’API, du MCP, de l’historique,
du SQL écrit dans l’interface et des vues SQL. Filtrer ou trier sur lui répond comme pour un champ
qui n’existe pas.

## Et le SQL ?

Dans l’interface, le SQL suit les mêmes droits, appliqués par PostgreSQL lui-même : sans le niveau
Gestion, une requête s’exécute en lecture seule, sur un rôle propre à la personne, où une table
fermée n’existe pas et un champ masqué est refusé. Une [vue SQL](/basedb/fonctionnalites/requetes-et-vues-sql/)
se lit avec les droits de qui la lit, et partager une requête ne partage que son texte.

Un accès **`psql` direct** à la base, lui, n’est pas gouverné par basedb : il lit tout, champs
masqués compris. Les restrictions protègent les surfaces du produit — interface, API, MCP —, jamais
contre quelqu’un qui détient un accès SQL à la base ; ces accès se règlent par des `GRANT`
PostgreSQL, posés par l’exploitant.

## Comptes et connexion

- Un compte se crée avec un **mot de passe temporaire**, montré une fois et à changer à la
  première connexion.
- La connexion se fait par mot de passe ou par un fournisseur **OpenID Connect** déclaré par
  l’exploitant.
- Les actions d’administration demandent une **session élevée** : un mot de passe retapé dans les
  cinq dernières minutes.
- Les sessions se révoquent ; révoquer une session invalide aussitôt ses jetons d’accès.

## Vos paramètres

**Paramètres**, dans le menu du profil en bas à gauche, ne concerne que vous :

| Onglet | Ce qu’on y fait |
|---|---|
| **Profil** | le nom affiché ; l’adresse de connexion ; les fournisseurs d’identité liés au compte, à lier ou délier |
| **Sécurité** | changer le mot de passe ; les sessions ouvertes, à fermer une à une ou toutes |
| **Apparence** | la langue de l’interface ; le thème ; l’ordre des dates — `25/09/2026` ou `2026-09-25` — et le premier jour de la semaine des calendriers |
| **Notifications** | les natures de notification dont vous ne voulez plus |
| **Jetons** | les jetons d’intégration que vous avez créés, sur toutes vos bases, leur dernier usage, et leur révocation |

basedb parle **vingt langues** : français, anglais, allemand, espagnol, italien, portugais
(Brésil), néerlandais, polonais, tchèque, suédois, danois, norvégien, finnois, roumain, hongrois,
turc, ukrainien, japonais, chinois simplifié et coréen. Par défaut, l’interface prend la langue
de votre navigateur ; **Langue**, dans **Apparence**, en fixe une autre. Les nombres et les dates
suivent la langue choisie.

Le thème reste propre au navigateur ; la langue, l’ordre des dates et le premier jour de la
semaine vous suivent d’un poste à l’autre. Changer d’adresse ou lier un fournisseur demande une session
élevée ; un compte sans mot de passe, qui se connecte par un fournisseur, garde l’adresse de ce
fournisseur.

## Le point d’application unique

Toutes les surfaces — interface, API, MCP, formulaires et vues partagés, automatisations —
passent par le même point de décision des droits, dans le noyau. Il n’existe pas de route
privée de l’interface : ce que l’écran n’affiche pas, c’est que l’API ne l’a pas renvoyé.

L’inverse vaut aussi : l’écran **ne propose pas ce qui serait refusé**. Sans le niveau
Gestion, l’écran Structure se consulte sans bouton ni crayon, et l’import ne propose pas de
créer une table ; sans le droit de créer ou de supprimer des lignes, la grille n’offre ni ligne
d’ajout ni « Supprimer ».

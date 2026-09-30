---
title: Historique
description: Chaque écriture, d’où qu’elle vienne, avec les valeurs d’avant.
---

basedb historise **chaque écriture**, d’où qu’elle vienne : l’interface, l’API, un agent MCP,
un formulaire public — et même une requête SQL écrite à la main dans `psql`.

![L’historique d’une base](../../../assets/screens/fr/historique.webp)

## Comment c’est capturé

Pas par l’application, mais par des **déclencheurs PostgreSQL**, dans la transaction même de
l’écriture. Une écriture qui échoue ne laisse aucune trace ; une écriture qui réussit ne peut
pas en manquer. Les révisions sont ensuite versées dans des journaux immuables, partitionnés par
mois.

L’identité voyage par des variables de session posées au début de chaque transaction. Une
écriture qui n’en porte pas — du SQL direct — est enregistrée comme telle, avec la session qui
l’a faite (`psql`, adresse, processus) : elle n’est jamais refusée pour autant.

| Acteur | Affiché comme |
|---|---|
| une personne | son nom |
| un programme (API) ou un agent (MCP) | la personne qui a créé le jeton, « par le jeton … » |
| un formulaire public | « Formulaire « … » · réponse publique » |
| une automatisation | « Automatisation « … » · au nom de » la personne qui en répond |
| du SQL direct | « Session SQL directe » |

## Ce qu’on peut en faire

- **Lire** l’historique d’une ligne (onglet « Historique » de sa fiche), d’une table ou d’une
  base (**Historique**, dans le menu **⋯** de la base), filtré par table.
- **Annuler** une modification : les valeurs d’avant sont réappliquées champ par champ.
- **Restaurer** une ligne supprimée depuis son entrée « a supprimé ».
- Suivre l’**historique des structures** (onglet « Structure ») : tables et champs créés,
  modifiés, supprimés.

## Annuler (Ctrl+Z)

Dans la grille, **Ctrl+Z** (⌘Z sur Mac) annule votre dernière écriture ; **Ctrl+Maj+Z** ou
**Ctrl+Y** la rétablit. Un message confirme ce qui a été annulé — « Annulé : modification de
« Montant » » — avec un bouton pour revenir sur l’annulation.

S’annulent ainsi une cellule, une carte ou une barre déplacée, une ligne créée ou supprimée, un
collage — et un import entier, compté comme un seul geste. Jusqu’à cinquante gestes, onglet par
onglet.

Ce n’est pas un retour en arrière de l’écran : c’est une **nouvelle écriture**, faite par le
serveur à partir de l’historique, et historisée elle aussi. Elle est refusée si quelqu’un a
modifié la ligne depuis — « Annulation impossible : « Statut » a été modifié depuis » — plutôt
que d’écraser son travail. On n’annule ainsi que ses propres écritures, des dernières
vingt-quatre heures, et jamais la structure. Dans une cellule en cours de saisie, Ctrl+Z reste
celui du texte.

## Droits

L’historique suit les droits de lecture : un champ masqué pour vous n’apparaît pas dans les
révisions que vous lisez.

---
title: Collaboration
description: Commentaires et mentions, notifications, mises à jour en temps réel et présence.
---

Plusieurs personnes travaillent sur la même base en même temps : chacune voit les écritures des
autres arriver, sait qui regarde quoi, et discute d’une ligne là où elle se trouve.

## Commentaires

La fiche d’une ligne a un onglet **Commentaires**, entre « Détails » et « Historique ». Tapez
`@` pour **mentionner** un membre, Ctrl+Entrée pour envoyer. Chacun modifie ou supprime ses
propres commentaires.

![Une conversation sur un projet](../../../assets/screens/commentaires.png)

Pouvoir lire la ligne suffit pour la commenter. Une personne mentionnée qui ne peut pas la lire
n’est pas prévenue — et l’auteur en est averti plutôt que de croire le message parti.

## Notifications

La cloche, en haut à droite, compte ce qui n’est pas lu. Quatre choses y arrivent :

- quelqu’un vous **mentionne** dans un commentaire ;
- quelqu’un **répond** dans une conversation où vous avez écrit ;
- quelqu’un vous **désigne** dans un champ Personne — depuis l’interface, l’API, un formulaire
  ou une automatisation ;
- une [automatisation](/basedb/fonctionnalites/automatisations/) vous **prévient**.

Ouvrir une notification ouvre la ligne. **Tout marquer comme lu** vide le compteur ; les
notifications sont gardées 90 jours.

![Une mention reçue](../../../assets/screens/notifications.png)

## Temps réel

Les écritures des autres s’affichent **sans recharger** : une cellule modifiée, une carte
déplacée, une ligne ajoutée — qu’elles viennent de l’interface, de l’API, d’un agent ou du SQL
direct. Le serveur n’envoie qu’un **signal**, jamais une donnée : c’est l’écran qui relit, avec
vos droits. Une cellule que vous êtes en train de modifier n’est jamais remplacée sous vos
doigts.

## Présence

Les visages des personnes qui regardent **la même table** s’affichent en haut de l’écran ; ceux
qui ont ouvert **la même ligne**, dans l’en-tête de sa fiche. Dans la grille, le pointeur des
autres apparaît sur la cellule qu’ils survolent.

## Annuler

Ctrl+Z annule votre dernière écriture — voir [l’historique](/basedb/fonctionnalites/historique/#annuler-ctrlz).

## Limites

- Les notifications restent dans basedb : aucune n’est envoyée par courriel pour l’instant.
- Au-delà de cent lignes changées d’un coup, l’écran recharge la page entière plutôt que
  ligne par ligne.

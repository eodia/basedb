---
title: Formulaires partagés
description: Partager un formulaire par un lien, public ou réservé aux membres connectés.
---

Un formulaire, un questionnaire ou un quiz se **partage par un lien** `/f/<jeton>`. La personne qui
répond n’a besoin d’**aucun droit sur la table** : chaque réponse ajoute une ligne, et rien
d’autre de la table ne lui est montré. Pour montrer des lignes plutôt qu’en recevoir, une vue
se partage [en lecture seule](/basedb/fonctionnalites/vues-partagees/).

![Le dialogue de partage](../../../assets/screens/fr/partage-formulaire.webp)

## Qui peut répondre

| Accès | Qui répond | Ce qui s’affiche |
|---|---|---|
| **Public** | quiconque a le lien, sans compte | le formulaire, seul |
| **Membres connectés** | un membre du tenant — au besoin de certains groupes | la connexion, puis le formulaire et « Vous répondez en tant que … » |

La page du lien est hors de l’application : ni barre latérale, ni nom de base, ni autres lignes.
Elle porte l’apparence du formulaire — son thème, sa couleur, sa police —, et ne demande que
les questions que les réponses précédentes appellent.

![Un formulaire public](../../../assets/screens/fr/formulaire-public.webp)

## Au nom de qui la réponse est écrite

La ligne s’écrit sur l’**autorité de la personne qui a publié le partage** — la dernière à
l’avoir enregistré. Son droit de créer des lignes est vérifié **à chaque réponse**, restreint aux
questions du formulaire : si elle le perd, le formulaire est suspendu jusqu’à ce que quelqu’un
qui l’a l’enregistre à nouveau.

L’historique dit qui a répondu, pas qui a publié :

- une réponse de **membre** est attribuée à la personne ;
- une réponse **publique** est attribuée au formulaire lui-même : « Formulaire « Demande de
  devis » · réponse publique · publié par Camille ».

## Ouvrir et fermer

Le dialogue règle :

- l’interrupteur **Lien actif** ;
- une **date de fermeture** ;
- un **nombre maximal de réponses** — exact, même sous des réponses simultanées ;
- **Régénérer le lien** : l’ancien cesse aussitôt de fonctionner ;
- **Arrêter le partage** : le lien disparaît, les réponses restent dans la table.

Un formulaire fermé le dit en une phrase, avant même de demander une connexion.

## Un quiz partagé

La page d’un quiz ne reçoit **aucune bonne réponse** : seulement ce que vaut chaque question.
C’est le serveur qui corrige.

- Corrigé **après chaque question**, la page lui envoie chaque réponse notée au moment où elle
  est donnée, et apprend alors si elle est juste — et laquelle l’était.
- À l’envoi, le serveur compte le score **à partir des réponses reçues** et l’écrit dans le champ
  choisi pour lui, s’il y en a un et que la personne qui a publié le partage peut l’écrire. La
  page affiche le score qu’il renvoie, et le corrigé sauf si le quiz dit « jamais ».

Un score se lit donc dans la table tel que le serveur l’a compté, pas tel qu’une page l’aurait
annoncé.

## Limites

- Les questions de type **relation**, **document** et **image** ne sont pas posées par un lien
  partagé ; le dialogue les signale.
- L’envoi est limité à 20 réponses par minute, par adresse et par lien. Derrière le proxy fourni
  (Caddy), l’adresse est celle du visiteur.

Le détail est dans le [chapitre 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
du document d’architecture.

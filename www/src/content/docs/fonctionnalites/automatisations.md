---
title: Automatisations
description: Quand une ligne change, à heure fixe ou d’un clic — modifier, créer, prévenir, appeler un webhook, écrire sur Slack.
---

Une automatisation dit **quand**, **si** et **alors** : quand une tâche passe à « Fait », noter
l’heure ; quand un avis négatif arrive, prévenir la responsable et écrire sur Slack ; chaque
lundi à 9 h, créer la ligne du point d’équipe.

Elles s’ouvrent depuis **Automatisations**, dans le bloc de la base ouverte en bas de la barre
latérale, et demandent le niveau **Gestion**.

![Une automatisation et ses exécutions](../../../assets/screens/automatisations.png)

## Quand

| Déclencheur | Réglages |
|---|---|
| **Une ligne est créée** | la table |
| **Une ligne est modifiée** | la table, et au besoin les seuls champs à surveiller |
| **À heure fixe** | toutes les heures, chaque jour ou chaque semaine, à l’heure et dans le fuseau choisis |
| **On clique sur un bouton** | un [champ Bouton](/basedb/fonctionnalites/tables-et-champs/#bouton) de la table |

Un déclencheur sur les lignes voit **toutes** les écritures : l’interface, l’API, un agent, un
formulaire partagé, et même le SQL direct — les automatisations partent de l’historique, qui les
capture toutes.

## Si

Une condition facultative, dans le [langage des filtres](/basedb/integrations/api-rest/#lire) —
`statut eq "fait"`, `montant gte 10000 and payee eq false` — évaluée sur la ligne **au moment
d’agir**. Une exécution dont la condition n’est pas remplie est « écartée », et le dit.

## Alors

Jusqu’à dix actions, dans l’ordre ; la première qui échoue arrête les suivantes.

| Action | Ce qu’elle fait |
|---|---|
| **Modifier la ligne** | écrit des valeurs dans la ligne qui a déclenché |
| **Créer une ligne** | dans cette table ou une autre de la base |
| **Prévenir quelqu’un** | une [notification](/basedb/fonctionnalites/collaboration/#notifications) à des personnes choisies, ou à celle d’un champ Personne |
| **Appeler un webhook** | un `POST` en HTTPS vers l’adresse de votre choix |
| **Envoyer sur Slack** | un message dans un canal [connecté](/basedb/integrations/synchronisation/#slack) |

Les valeurs et les messages citent la ligne : `{{Titre}}`, `{{_id}}`, et `{{_maintenant}}` pour
l’instant de l’exécution.

## Tester, suivre

**Tester sur une ligne** exécute l’automatisation sur une ligne choisie, pour de vrai. Sous
chaque automatisation, ses **exécutions** — les 50 dernières, gardées 30 jours — détaillées
action par action : en attente, en cours, réussie, écartée avec sa raison, échouée avec son code.

## Au nom de qui elle agit

Une automatisation agit avec les **droits de la personne qui l’a enregistrée en dernier**,
redécidés à chaque exécution : si cette personne perd un droit, l’action qui en avait besoin
échoue au lieu de passer outre. L’historique l’affiche « Automatisation « Tâche terminée » · au
nom de … », et ses écritures s’annulent comme les autres.

## Limites

- Pas de chaîne : ce qu’écrit une automatisation n’en déclenche aucune autre.
- Pas de courriel, pas de script.
- 100 exécutions par heure et par automatisation ; une échéance horaire manquée n’est rattrapée
  qu’une fois.
- Le délai entre l’écriture et l’action est de l’ordre de la seconde.

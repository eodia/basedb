---
title: Vues
description: Grille, kanban, calendrier, chronologie, formulaire et questionnaire.
---

Une table se montre de six façons. Chaque vue est **enregistrée et partagée** à l’échelle de la
table : elle ne copie aucune donnée, et ne donne aucun droit de plus que la table elle-même.

| Vue | Ce qu’elle montre | Ce qu’il lui faut |
|---|---|---|
| **Grille** | des lignes, filtrées, triées, colonnes choisies | — |
| **Kanban** | des cartes en colonnes | une liste de choix |
| **Calendrier** | des lignes à leur date, par mois ou par semaine | un champ date |
| **Chronologie** | des barres entre deux dates | une date de début |
| **Formulaire** | une page de questions pour créer une ligne | — |
| **Questionnaire** | les mêmes questions, une par écran | — |

## Le sélecteur de vues

Il est à gauche de « Filtrer ». « Toutes les lignes » est la grille de la table, que personne
n’a enregistrée ni ne peut supprimer ; viennent ensuite les vues, dans l’ordre choisi par qui
construit la base. Créer, configurer, renommer, réordonner ou supprimer une vue demande le
niveau **Gestion** ; les autres choisissent parmi elles, et le filtre qu’ils essaient reste le
leur.

![Un calendrier par échéance](../../../assets/screens/calendrier.png)

## Kanban, calendrier, chronologie

- Le **kanban** range les cartes selon une liste de choix ; glisser une carte modifie la ligne,
  un « + » en tête de colonne crée une ligne déjà dotée de ce choix.
- Le **calendrier** place chaque ligne à sa date, avec une date de fin éventuelle ; glisser une
  ligne d’un jour à l’autre la décale.
- La **chronologie** trace des barres entre une date de début et une date de fin, regroupées par
  une liste de choix ou une relation.

## Formulaire et questionnaire

On coche les questions et on les ordonne ; chacune a un intitulé, une aide, et peut être rendue
obligatoire. Le formulaire a son titre, sa présentation, le libellé de son bouton et son message
de remerciement. Il se remplit dans basedb, ou se [partage par un lien](/basedb/fonctionnalites/formulaires-partages/).

## Ce que le lecteur ne voit pas

Une vue est **reprojetée pour son lecteur** : un champ qui lui est masqué disparaît des
colonnes, des cartes et des questions. Une vue dont le filtre cite un champ masqué n’est pas
montrée du tout : montrée sans son filtre, elle montrerait plus qu’elle n’a été faite pour
montrer.

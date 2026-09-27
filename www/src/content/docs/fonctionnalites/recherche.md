---
title: Recherche
description: Un seul champ pour tout trouver — tables, vues, tableaux de bord, lignes, commandes — et pour poser une question au Copilot. Ctrl+K.
---

Le champ **Rechercher tables, lignes, commandes…**, au centre de la barre du haut, ouvre la
recherche : un seul champ pour tout ce que vous pouvez atteindre dans basedb. **Ctrl+K**
(**⌘K** sur Mac) l’ouvre ou la ferme depuis n’importe quel écran — sauf dans un éditeur de texte,
où il ajoute un lien.

## Ce qu’elle trouve

| | |
|---|---|
| **Tables et objets** | les projets et les bases que vous voyez ; les tables, vues SQL et requêtes enregistrées ; les vues des tables de la base ouverte, personnelles comprises ; les questions, tableaux de bord et automatisations des bases du projet ; les colonnes des tables ; les onglets ouverts |
| **Lignes** | les données elles-mêmes, dans les tables de la base ouverte : le texte des colonnes, les choix des listes, un nombre exact — à partir de deux caractères. Un identifiant de ligne collé trouve sa ligne |
| **Commandes** | ce que l’application sait faire : aller à la structure, à l’historique, aux tableaux de bord de la base ; créer une table, une question, une requête SQL, une base, un projet, partir d’un modèle ; importer dans une table ; annuler ou rétablir la dernière écriture ; fermer ou changer d’onglet ; changer de thème ; ouvrir le Copilot ; **Copier le lien de cette page** ; ouvrir un onglet des paramètres ou de l’administration ; se déconnecter |
| **Copilot** | une question en langage naturel, confiée au Copilot |

**Entrée** ouvre le résultat choisi : une ligne s’ouvre dans sa table, sur sa fiche. Sur un grand
écran, un panneau à droite en montre l’aperçu — les valeurs d’une ligne, les colonnes et la
description d’une table, la description d’un tableau de bord ou d’une automatisation. Collez une
adresse de basedb : **Ouvrir ce lien** vous y mène (voir
[un lien vers chaque écran](/basedb/fonctionnalites/collaboration/#un-lien-vers-chaque-écran)).

Le champ vide propose vos **récents**, les onglets ouverts, les tables de la base et quelques
suggestions.

## Tapez comme vous pensez

- **Ni accents ni majuscules** : `eleve` trouve « Élève ».
- **Des débuts de mots et des initiales** : `nc` pour « Nouveau client », `nouvtab` pour
  « Nouvelle table ».
- **Une faute de frappe pardonnée** — une lettre oubliée, doublée, remplacée ou inversée, deux
  dans un mot de plus de sept lettres —, jamais sur la première lettre.
- **Chaque mot tapé doit se trouver quelque part**, dans le nom ou dans ce qui le contient :
  `ventes clients` trouve la table « Clients » de la base « Ventes ». Le genre se tape aussi :
  `vue`, `auto`, `tableau de bord`.
- **Une table, puis ce qu’on y cherche** : `clients lyon` cherche « lyon » dans les lignes de la
  table « Clients ».

En tête, le **meilleur résultat** ; ce que vous ouvrez souvent et récemment remonte. Cette
mémoire reste dans votre navigateur.

## Restreindre la recherche

Les puces sous le champ — **Tout**, **Tables et objets**, **Lignes**, **Commandes**, **Copilot** —
restreignent ce qui est cherché. Un premier caractère fait de même :

| Tapez d’abord | Pour chercher |
|---|---|
| `#` | seulement les tables et objets |
| `/` | seulement les lignes |
| `>` | seulement les commandes |
| `?` | une question au Copilot |

**Tab**, sur une table ou une base, cherche **dedans** : son nom s’affiche dans le champ, et la
recherche ne porte plus que sur ses lignes, ses vues, ses colonnes et ses commandes. Le champ
vide montre alors les vingt lignes modifiées le plus récemment. **⌫**, le champ vide, en ressort ;
**Échap** revient d’un cran, puis ferme.

## Demander au Copilot

Chaque recherche finit par **Demander au Copilot : « … »**, placé en tête quand le texte se lit
comme une question — il finit par « ? », commence par « combien », « quel », « montre »…, ou
compte cinq mots et plus. Le Copilot s’ouvre sur la base et reçoit la question comme si vous
l’aviez tapée. Il lit la structure, pas les lignes, sauf si vous cochez **Autoriser la lecture des
données**, et il propose : rien ne change avant que vous appliquiez. Il faut que l’IA soit
configurée sur l’instance — voir [Intelligence artificielle](/basedb/fonctionnalites/ia/).

## Droits et limites

La recherche passe par les mêmes routes que le reste de l’écran, **avec vos droits** : une table
ou une colonne qui vous est fermée n’apparaît pas, ni parmi les objets ni dans les lignes. Les
automatisations ne sont proposées qu’à qui a le niveau **Gestion** sur leur base.

- Les lignes sont cherchées dans la base ouverte, ou dans la base ou la table où vous êtes entré
  par Tab : trois lignes par table, sur vingt-quatre tables au plus ; vingt lignes dans une table.
- Les questions, tableaux de bord et automatisations sont ceux du projet ouvert (huit bases au
  plus), relus toutes les deux minutes au plus.
- Chaque groupe montre quelques résultats, puis **N autres résultats**, qui l’ouvre en entier.

## Raccourcis clavier

**Raccourcis**, en bas de la recherche, ou la commande **Raccourcis clavier**, les montre tous.
**Ctrl** se lit **⌘** sur Mac.

| Touches | Effet |
|---|---|
| **Ctrl+K** | ouvrir ou fermer la recherche |
| **↑** **↓**, **Entrée** | parcourir les résultats, ouvrir le résultat |
| **Alt+W** | fermer l’onglet |
| **Ctrl+Tab**, **Ctrl+Maj+Tab** | onglet suivant, onglet précédent |
| clic molette | fermer un onglet |
| **Ctrl+A**, **Ctrl+C** | dans la grille, tout sélectionner, copier les cellules choisies |
| **Ctrl+clic** | suivre une relation |
| **Ctrl+Z**, **Ctrl+Y** | annuler la dernière écriture, la rétablir |
| **Ctrl+Entrée** | envoyer un commentaire, enregistrer une description |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | dans un texte : gras, italique, lien |

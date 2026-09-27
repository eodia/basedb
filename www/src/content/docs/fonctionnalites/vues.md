---
title: Vues
description: Grille, kanban, calendrier, chronologie, galerie, liste, formulaire et questionnaire — collaboratives ou personnelles.
---

Une table se montre de **huit façons**. Une vue ne copie aucune donnée, et ne donne aucun droit
de plus que la table elle-même.

:::note
Ces vues sont des façons de montrer **une** table. Une [vue SQL](/basedb/fonctionnalites/requetes-et-vues-sql/)
est autre chose : une vraie vue PostgreSQL, écrite en SQL sur les tables de la base, rangée parmi
elles dans la barre latérale.
:::

| Vue | Ce qu’elle montre | Ce qu’il lui faut |
|---|---|---|
| **Grille** | des lignes, filtrées, triées, groupées, colonnes choisies | — |
| **Kanban** | des cartes en colonnes | une liste de choix |
| **Calendrier** | des lignes à leur date, par mois ou par semaine | un champ date |
| **Chronologie** | des barres entre deux dates, et leurs dépendances | une date de début |
| **Galerie** | des cartes, avec une image de couverture | — |
| **Liste** | une ligne par enregistrement, en groupes repliables | — |
| **Formulaire** | une page de questions pour créer une ligne | — |
| **Questionnaire** | les mêmes questions, une par écran | — |

## Le sélecteur de vues

Il est à gauche de « Filtrer ». « Toutes les lignes » est la grille de la table, que personne
n’a enregistrée ni ne peut supprimer ; viennent ensuite les **vues collaboratives**, dans
l’ordre choisi par qui construit la base, puis **Mes vues**.

- Une **vue collaborative** est vue de tous. La créer, la configurer, la renommer, la
  réordonner ou la supprimer demande le niveau **Gestion**. Elle peut être **verrouillée** : un
  cadenas le dit, et plus personne ne la modifie avant de l’avoir déverrouillée.
- Une **vue personnelle** n’est vue que de vous, et ne demande que de pouvoir lire la table.
  **Créer une vue personnelle**, ou **Enregistrer comme vue** après avoir filtré et trié :
  chacun range ses propres façons de lire, sans rien changer pour les autres. **Dupliquer** une
  vue collaborative en fait une copie personnelle.

![Une galerie de clients](../../../assets/screens/galerie.png)

## La barre d’outils

Au-dessus de la grille, dans cet ordre :

- **Filtrer** combine des conditions par champ ;
- **Colonnes** choisit ce qui s’affiche — les colonnes système sont à part, sous
  « Informations système » ;
- **Grouper** range les lignes selon un champ à valeur unique — liste de choix, relation,
  personne, date, nombre, texte, case à cocher… — en groupes repliables, chacun avec son
  décompte sur tout le filtre ;
- **Couleurs** colore les lignes selon une liste de choix, ou selon des **règles** — un filtre et
  une couleur, vingt au plus — en trait, en fond, ou les deux ;
- **Hauteur des lignes** : courte, moyenne, haute, très haute ;
- **Rechercher…**, à droite, cherche dans toutes les colonnes pendant que vous tapez ; Échap
  vide la recherche. Elle vaut aussi pour le kanban, le calendrier, la chronologie, la galerie
  et la liste, et n’est jamais enregistrée dans la vue.

Sous chaque colonne, un **Résumé** calculé sur toutes les lignes du filtre, pas seulement sur
la page : remplies, vides, valeurs uniques, somme, moyenne, minimum, maximum, cases cochées.

## Kanban, calendrier, chronologie

- Le **kanban** range les cartes selon une liste de choix ; glisser une carte modifie la ligne,
  un « + » en tête de colonne crée une ligne déjà dotée de ce choix. Chaque carte montre un
  titre, une image de couverture, les champs choisis, et une **description** qui cite les
  valeurs de la ligne — « Livraison prévue le `{{Date}}` pour `{{Client}}` » —, écrite dans le
  réglage de la vue avec le bouton **Insérer un champ**.
- Le **calendrier** place chaque ligne à sa date, avec une date de fin éventuelle ; glisser une
  ligne d’un jour à l’autre la décale.
- La **chronologie** trace des barres entre une date de début et une date de fin, regroupées par
  une liste de choix ou une relation. Avec le réglage **Dépend de** — une relation de la table
  vers elle-même — une flèche relie chaque tâche à celles dont elle dépend, rouge quand elle
  remonte le temps.

![Une chronologie avec ses dépendances](../../../assets/screens/chronologie.png)

![Un calendrier par échéance](../../../assets/screens/calendrier.png)

## Galerie et liste

- La **galerie** montre des cartes : une **image de couverture** (recadrée ou entière), une
  taille (petites, moyennes, grandes cartes), une couleur selon une liste de choix.
- La **liste** montre une ligne par enregistrement, **regroupée** par une liste de choix, une
  relation ou une personne.

![Une liste de clients, regroupée par secteur](../../../assets/screens/liste.png)

Dans le kanban, la galerie et la liste, les cartes et les lignes se **rangent à la main** en les
glissant — jusqu’à 5 000 ; un tri choisi l’emporte sur cet ordre.

## Formulaire et questionnaire

On coche les questions et on les ordonne ; chacune a un intitulé, une aide, et peut être rendue
obligatoire. Le formulaire a son titre, sa présentation, le libellé de son bouton et son message
de remerciement. Il se remplit dans basedb, ou se [partage par un lien](/basedb/fonctionnalites/formulaires-partages/).

## Partager une vue

Une vue de données — grille, kanban, calendrier, chronologie, galerie, liste — se **partage en
lecture seule** par un lien, s’intègre à un autre site, et un calendrier devient un flux
d’agenda. Voir [Vues partagées](/basedb/fonctionnalites/vues-partagees/).

## Ce que le lecteur ne voit pas

Une vue est **reprojetée pour son lecteur** : un champ qui lui est masqué disparaît des
colonnes, des cartes et des questions. Une vue dont le filtre cite un champ masqué n’est pas
montrée du tout : montrée sans son filtre, elle montrerait plus qu’elle n’a été faite pour
montrer.

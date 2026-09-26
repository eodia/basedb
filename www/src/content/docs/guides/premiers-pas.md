---
title: Premiers pas
description: Créer une base, une table, des champs, une vue et un formulaire.
---

Ce parcours prend dix minutes et couvre l’essentiel : à la fin, vous aurez une table, une vue
kanban et un formulaire public qui écrit dedans.

## 1. Créer une base

Tout s’organise par **projet** : le sélecteur en haut de la barre latérale change de projet ou
en crée un. Dans la barre, le **+** à côté de « Bases » crée une base. Donnez-lui un libellé
— « Ventes » — et, si vous voulez, une description, une couleur, un pictogramme.

La base devient un **schéma PostgreSQL** : son nom physique (`b_t4z56fq_ventes`) apparaît dans
le formulaire et dans la documentation générée.

## 2. Créer une table et ses champs

Depuis le menu **⋯** de la base : **Nouvelle table**. Ajoutez ensuite des champs depuis l’en-tête
de la grille (le **+** au bout des colonnes) :

| Champ | Type |
|---|---|
| Nom | Texte |
| Statut | Liste de choix — Nouveau, Qualifié, Gagné, Perdu |
| Montant | Nombre |
| Échéance | Date |
| Client | Relation → Clients |
| Notes | Texte long (Markdown) |

Vous pouvez aussi **importer un fichier** CSV ou JSON : l’import devine les types, vous laisse
les corriger, crée la table ou complète une table existante, et dit ligne par ligne ce qu’il
refuse.

![Menu d’une base](../../../assets/screens/menu-base.png)

## 3. Saisir et filtrer

La grille s’édite comme un tableur : double-clic ou Entrée pour modifier une cellule, Échap pour
annuler. **Filtrer** combine des conditions par champ ; le tri se fait depuis l’en-tête de
colonne. Chaque modification est enregistrée aussitôt — et [historisée](/basedb/fonctionnalites/historique/).

## 4. Ajouter une vue

Le sélecteur de vues, à gauche de « Filtrer », propose « Toutes les lignes » puis vos vues.
Créez un **kanban** groupé par « Statut » : glisser une carte d’une colonne à l’autre modifie la
ligne.

![Un kanban par statut](../../../assets/screens/kanban.png)

## 5. Partager un formulaire

Créez une vue **Formulaire**, cochez les questions, puis **Partager** : choisissez « Public »,
copiez le lien. Chaque réponse ajoute une ligne à la table, sans donner aucun droit à celui qui
répond. Détails dans [Formulaires partagés](/basedb/fonctionnalites/formulaires-partages/).

## 6. Lire en SQL

Menu **⋯** de la base → **Nouvelle requête SQL** : vos tables sont là, sous leur vrai nom.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

C’est la même chose depuis `psql` ou votre outil de BI. Voir [SQL direct](/basedb/integrations/sql/).

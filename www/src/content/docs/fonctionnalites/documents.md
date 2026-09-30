---
title: Documents PDF
description: Une ligne en facture, devis ou fiche imprimable, avec ses lignes liées et ses totaux.
---

Une ligne devient un **PDF** : une facture avec ses lignes et son total, un devis, un bon de
livraison, une fiche. Dans la fiche d’une ligne, le bouton **Document PDF** l’ouvre dans un
nouvel onglet, d’où le navigateur l’imprime ou l’enregistre.

## La fiche, sans rien régler

Sans modèle, une ligne s’imprime en **fiche** : son nom en titre, puis tous les champs que vous
pouvez lire, dans votre langue.

## Les modèles

Qui construit la table — le niveau Gestion — les écrit, depuis la fiche d’une ligne :
**Document PDF › Modèles de document…**. Un modèle, c’est une page (A4 ou Letter, portrait ou
paysage), une langue pour les valeurs, un pied de page et une suite de blocs :

| Bloc | Ce qu’il montre |
|---|---|
| **Texte** | du texte riche — titres, gras, listes, liens — qui cite les colonnes de la ligne avec le menu **Colonne** : « Facture `{{numero}}` du `{{date}}` » |
| **Champs de la ligne** | les champs choisis, ou tous : libellé à gauche, valeur à droite |
| **Tableau des lignes liées** | les lignes qui désignent celle-ci — les lignes d’une facture — ou celles qu’un lien multiple désigne, avec les colonnes choisies et leurs **totaux** |
| **Saut de page** | la suite sur une nouvelle page |

L’éditeur montre à côté le PDF que le modèle fait de la ligne ouverte, modifications comprises.

Les valeurs s’écrivent **dans la langue du modèle** : un montant avec sa devise (« 1 234,50 € »),
une date en toutes lettres (« 30 septembre 2026 »), oui et non, le libellé d’un choix, le nom
d’une personne. Le texte est composé dans des polices embarquées qui couvrent les vingt langues
de basedb, idéogrammes compris.

## Chacun avec ses droits

Un document est lu **avec les droits de qui l’imprime** : un champ masqué pour lui n’y figure
pas, une ligne liée qu’il ne voit pas n’est pas dans le tableau — ni dans le total. Deux
personnes peuvent donc obtenir deux documents différents de la même ligne : chacun a le sien.

## Par l’API

```bash
# Le PDF d’une ligne avec un modèle, ou « fiche »
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` liste les modèles de la table.

## Limites

- Pas d’image (logo) ni de couleur choisie dans un document, pas d’en-tête distinct du pied.
- Un document par ligne : pas encore de PDF de plusieurs lignes, ni de génération par une
  automatisation.

---
title: Documents PDF
description: Une ligne en facture, devis, fiche ou attestation à vos couleurs, avec logo, lignes liées et totaux.
---

Une ligne devient un **PDF** : une facture avec ses lignes et son total, un devis, un bon de
livraison, une fiche produit, une attestation. Dans la fiche d’une ligne, le bouton
**Document PDF** l’ouvre dans un nouvel onglet, d’où le navigateur l’imprime ou l’enregistre.

## La fiche, sans rien régler

Sans modèle, une ligne s’imprime en **fiche** : son nom en titre, puis tous les champs que vous
pouvez lire, dans votre langue.

## Créer un modèle

Qui construit la table — le niveau Gestion — crée les modèles depuis la fiche d’une ligne :
**Document PDF › Modèles de document…**. Un nouveau modèle part d’un **point de départ** :

| Point de départ | Ce qu’il pose |
|---|---|
| **Facture** | en-tête avec logo et coordonnées, « FACTURE », numéro et date ; client ; lignes facturées et leur total ; récapitulatif HT / TTC ; conditions de paiement ; mentions légales en pied |
| **Devis** | titre sur un bandeau de couleur, informations en grille, prestations, validité, zone « Bon pour accord » |
| **Fiche** | grand titre pleine largeur, photo du champ image, champs en grille, textes longs |
| **Attestation** | page paysage encadrée, texte centré, signature |
| **Page vierge** | un titre et les champs de la ligne |

Il est construit avec **les colonnes de votre table** — son numéro, sa date, ses montants, sa
photo, les lignes qui lui sont liées — et ce que la table n’a pas est simplement laissé de
côté. Tout s’y change ensuite ; l’aperçu, à droite, montre le PDF de la ligne ouverte et se
met à jour à chaque modification.

## Le contenu : des blocs

Les blocs se suivent de haut en bas ; on les **glisse** par leur poignée pour les réordonner,
on les ouvre pour les régler.

| Bloc | Ce qu’il montre |
|---|---|
| **Titre** | un grand titre et un sous-titre, sobre, en couleur, souligné, ou sur un bandeau — jusqu’aux bords de la page |
| **Texte** | du texte riche — titres, gras, listes, liens — qui cite les colonnes de la ligne avec le menu **Colonne** : « Facture `{{numero}}` du `{{date}}` » ; aligné ou justifié, sur fond teinté, encadré ou marqué d’une barre de couleur |
| **Image** | un logo, un tampon, ou la photo d’un champ image de la ligne |
| **Champs de la ligne** | les champs choisis, ou tous : libellé à gauche, libellé au-dessus en grille de 2 ou 3, ou **récapitulatif** — valeurs à droite, la dernière (le total dû) en gras ; les champs vides peuvent être masqués |
| **Tableau des lignes liées** | les lignes qui désignent celle-ci — les lignes d’une facture — ou celles qu’un lien multiple désigne, avec leurs **totaux** ; en-tête coloré, une ligne sur deux teintée, en-têtes, largeurs et alignements de colonne à votre main (« Qté » pour « Quantité ») |
| **Colonnes** | deux ou trois colonnes côte à côte, chacune avec ses blocs : « Facturé à » d’un côté, les références de l’autre |
| **Séparateur**, **Espace** | un trait — court pour une signature — ou un blanc |
| **Saut de page** | la suite sur une nouvelle page |

## Le style et la page

- **Couleur d’accent** — celle de votre marque : titres, bandeaux, en-têtes de tableau, liens.
  Le texte posé dessus est blanc ou foncé, selon ce qui se lit le mieux.
- **Couleur du texte**, **police** du texte et des titres (sans ou avec empattement),
  **taille** du texte, style des intertitres.
- **Format** (A4 ou Letter), **orientation**, **marges**, **cadre** simple ou double autour de
  la page, contenu **centré verticalement** — pour une attestation.
- **Langue des valeurs** : les montants s’écrivent avec leur devise (« 1 234,50 € »), les dates
  en toutes lettres (« 30 septembre 2026 »), oui et non, le libellé d’un choix, le nom d’une
  personne. Le texte est composé dans des polices embarquées qui couvrent les vingt langues de
  basedb, idéogrammes compris.

## En-tête et pied de page

L’**en-tête** porte votre **logo** — une image envoyée (PNG, JPEG ou SVG ; une image trop lourde
est réduite) ou le champ image de la ligne —, un texte à gauche (vos coordonnées) et un texte
à droite (ce qu’est le document, son numéro, sa date), sur la première page ou sur chacune. Le
**pied de page** porte vos mentions légales et les numéros de page. Tous deux citent les
colonnes de la ligne, comme un texte.

## Chacun avec ses droits

Un document est lu **avec les droits de qui l’imprime** : un champ masqué pour lui n’y figure
pas — ni dans un texte, ni en image —, une ligne liée qu’il ne voit pas n’est pas dans le
tableau — ni dans le total. Deux personnes peuvent donc obtenir deux documents différents de la
même ligne : chacun a le sien.

## Par l’API

```bash
# Le PDF d’une ligne avec un modèle, ou « fiche »
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` liste les modèles de la table.

## Limites

- Une image envoyée pèse 300 Ko au plus, huit par modèle ; une image d’un champ est reprise si
  c’est un PNG ou un JPEG.
- Une valeur d’une ligne liée se cite hors du tableau par une **recherche** sur la table du
  document ; un total TTC est un champ de la table.
- Un document par ligne : pas encore de PDF de plusieurs lignes. Une
  [automatisation](/basedb/fonctionnalites/automatisations/#un-pdf-et-un-courriel) peut le faire
  pour vous — **Générer un PDF** — et l’envoyer en pièce jointe.

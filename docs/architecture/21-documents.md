# 21 — Documents PDF

Une ligne devient un document : une facture, un devis, un bon de livraison, une fiche. Ce
chapitre fixe ce qu'est un **modèle de document**, comment une ligne est lue pour le remplir,
et comment la page est composée.

> **Ce qui fait autorité.** La lecture passe par le point d'application unique (chapitre 05) :
> un document ne donne rien à lire qui ne le soit déjà. Il ne fait que mettre en page.

---

## 1. Le modèle

Un modèle appartient à une table : `_basedb.document_template` (migration 0017) — la table,
un libellé, une position, et une définition `spec` en JSON :

| Clé | Ce qu'elle dit |
|---|---|
| `page` | `size` (`A4`, `LETTER`) et `orientation` (`portrait`, `landscape`) |
| `locale` | la langue dans laquelle les valeurs s'écrivent : montants, dates, oui et non |
| `footer` | une ligne au pied de chaque page, qui peut citer des colonnes ; le numéro de page (« 2 / 3 ») se place à côté |
| `blocks` | la suite des blocs, 50 au plus |

Quatre sortes de blocs :

| `kind` | Réglages | Ce qu'il montre |
|---|---|---|
| `text` | `html` : texte riche, sous la forme canonique de l'assainisseur (chapitre 04 §2.2) | titres, paragraphes, gras, italique, listes, citations, liens, séparateurs ; les citations `{{colonne}}` y prennent la valeur de la ligne |
| `fields` | `fields` : des noms de colonnes ; aucun : toutes | les champs de la ligne, libellé à gauche, valeur à droite |
| `rows` | `title` ; `source` ; `columns` (12 au plus) ; `totals` | un tableau des lignes liées, avec ses totaux |
| `break` | — | un saut de page |

La `source` d'un tableau est soit **entrante** — `{ kind: 'incoming', table, field }` : les
lignes d'une autre table de la base dont le lien `field` (simple ou multiple) désigne cette
ligne, comme les lignes d'une facture —, soit **sortante** — `{ kind: 'outgoing', field }` : les
lignes qu'un lien multiple de cette ligne désigne. 500 lignes au plus ; au-delà, le tableau le
dit. `totals` somme les colonnes numériques qu'il nomme ; une colonne qui n'en est pas une ne
somme rien.

La définition est **vérifiée à l'écriture** contre le catalogue du jour (`REQUEST_INVALID`
avec `details.reason` : `champ_inconnu`, `lien_vers_la_table_attendu`, `langue_inconnue`,
`aucun_bloc`…), et **relue au rendu** contre le catalogue du jour du rendu : ce qui a disparu
depuis est laissé de côté plutôt que de faire échouer le document.

**Qui les voit.** Qui lit la table voit les noms de ses modèles, pour s'en servir ; qui la
construit (`manage_schema`) les écrit et lit leur définition — qui nomme des colonnes qu'un
lecteur ne voit peut-être pas.

## 2. Lire la ligne

Le rendu est fait **avec les droits de qui le demande**, par les chemins de lecture ordinaires :

- la ligne est lue comme la liste la lirait, filtrée sur `_id` : une ligne qu'il ne voit pas
  — table fermée, règle de lignes (chapitre 05 §16) — n'est pas trouvée (`RESOURCE_NOT_FOUND`) ;
- ses champs passent par son masque : un champ masqué n'apparaît ni dans un bloc `fields`, ni
  dans une citation, qui ne donne rien ;
- les lignes d'un tableau sont lues de même, dans leur table : une ligne liée qu'il ne voit pas
  n'y figure pas, et les totaux ne la comptent pas.

Deux personnes qui impriment la même ligne avec le même modèle peuvent donc obtenir deux
documents différents. C'est voulu : le document dit ce que le lecteur a le droit de lire.

**Les valeurs s'écrivent dans la langue du modèle** : un montant avec sa devise (`Intl`), un
pourcentage, une durée, une date en toutes lettres (« 30 septembre 2026 »), une date et heure
dans le fuseau du lecteur, oui et non dans la langue, un choix par son libellé, une personne par
son nom, un lien par la valeur d'affichage de sa cible. Une recherche ou un cumul prend le
format de ce qu'il atteint : le cumul de montants en euros s'écrit en euros.

**Sans modèle**, une ligne s'imprime en **fiche** : son nom en titre, puis tous les champs que
le lecteur lit, dans la langue du lecteur.

## 3. Composer la page

Le PDF est écrit par `pdfkit` (MIT, pur JavaScript) : texte vectoriel, polices embarquées et
réduites aux glyphes employés, liens actifs, métadonnées (titre, langue). Un navigateur sans
tête aurait composé du HTML, mais pèse des centaines de mégaoctets dans l'image et un processus
de plus à surveiller ; le rendu ici est un appel de fonction.

**Les polices** : Noto Sans (latin, grec, cyrillique : dix-sept des vingt langues) et Noto Sans
CJK (chinois, japonais, coréen), copiés dans l'image depuis les paquets Debian — six fichiers,
une quarantaine de mégaoctets. Chaque morceau de texte est composé dans la première police qui
en a tous les caractères ; les formes des idéogrammes suivent la langue du modèle (japonaise,
coréenne ou chinoise). `BASEDB_PDF_FONTS` nomme un dossier à soi, qui tient les mêmes fichiers ; hors de l'image, les polices
du système servent ; sans aucune, l'Helvetica intégrée au PDF écrit ce qu'elle peut et remplace
le reste par « ? ».

**La mise en page** : marges de 2 cm, texte en 10 points ; un tableau répète son en-tête sur
chaque page, aligne les nombres à droite, donne l'espace restant aux colonnes de texte ; un
titre n'est jamais laissé seul en bas de page ; le pied de page est posé une fois le nombre de
pages connu.

## 4. Aperçu

L'éditeur de modèles montre, à côté de la définition en cours, le PDF qu'elle ferait de la ligne
ouverte — modifications non enregistrées comprises : `POST …/documents/preview` compose une
définition non enregistrée, vérifiée comme celle d'un modèle, et réservée à qui construit la
table.

## 5. Routes

| Route | Effet | Droit |
|---|---|---|
| `GET /api/v1/{tenant}/data/{base}/{table}/documents` | les modèles de la table ; leur `spec` à qui la construit | `read` |
| `GET /api/v1/{tenant}/data/{base}/{table}/{id}/documents/{modèle}` | le PDF de la ligne ; `fiche` pour la fiche ; `?download=1` en pièce jointe | `read` |
| `POST /api/v1/{tenant}/data/{base}/{table}/{id}/documents/preview` | le PDF d'une définition non enregistrée | `manage_schema` |
| `POST /api/v1/{tenant}/admin/bases/{base}/tables/{table}/documents` | crée un modèle `{label, spec}` | `manage_schema` |
| `PATCH …/documents/{modèle}` | modifie son libellé ou sa définition | `manage_schema` |
| `DELETE …/documents/{modèle}` | le supprime | `manage_schema` |

## Décisions retenues

| Décision | Pourquoi | Écarté |
|---|---|---|
| Rendu avec les droits du demandeur | Un modèle ne doit pas devenir un canal de lecture | Rendu avec les droits de l'auteur du modèle |
| `pdfkit` et des polices embarquées | Un appel de fonction, une quarantaine de mégaoctets de polices, vingt langues | Chromium sans tête (centaines de mégaoctets, un processus de plus) ; impression par le navigateur (pas de fichier côté serveur, rien pour l'API ni les automatisations) |
| Blocs typés plutôt qu'un HTML libre | L'éditeur reste celui du texte riche ; un tableau de lignes liées se règle par listes, pas par balises | Un gabarit HTML avec boucles |
| Définition relue au rendu | Un champ supprimé ne casse pas les factures | Invalider le modèle à chaque changement de structure |

## Ce que la v1 ne fait pas

- Pas d'image dans un document (logo, image d'un champ), pas de couleur choisie, pas d'en-tête
  différent du pied.
- Pas de génération par automatisation ni de rangement du PDF dans un champ Document ; pas de
  pièce jointe à un courriel.
- Pas de document pour plusieurs lignes à la fois.

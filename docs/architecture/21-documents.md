# 21 — Documents PDF

Une ligne devient un document : une facture, un devis, un bon de livraison, une fiche, une
attestation. Ce chapitre fixe ce qu'est un **modèle de document**, comment une ligne est lue
pour le remplir, et comment la page est composée.

> **Ce qui fait autorité.** La lecture passe par le point d'application unique (chapitre 05) :
> un document ne donne rien à lire qui ne le soit déjà. Il ne fait que mettre en page.

---

## 1. Le modèle

Un modèle appartient à une table : `_basedb.document_template` (migration 0017) — la table,
un libellé, une position, et une définition `spec` en JSON. La définition est un document
`jsonb` : la faire évoluer ne demande pas de migration.

| Clé | Ce qu'elle dit |
|---|---|
| `page` | `size` (`A4`, `LETTER`), `orientation` (`portrait`, `landscape`), `valign` (`top` ; `center` : un document qui tient sur une page est centré dans sa hauteur — une attestation) |
| `locale` | la langue dans laquelle les valeurs s'écrivent : montants, dates, oui et non |
| `theme` | couleurs, polices, tailles, marges, cadre (§1.1) |
| `header` | l'en-tête : logo et deux textes riches, sur la première page ou sur chacune (§1.2) |
| `footer` | le pied de page : un texte riche, les numéros de page (§1.2) |
| `blocks` | la suite des blocs (§1.3) ; 50 au plus, ceux des colonnes compris |

### 1.1 Le thème

| Clé | Valeurs | Défaut |
|---|---|---|
| `accent` | `#rrggbb` — titres, bandeaux, en-têtes de tableau, liens | `#1d4ed8` |
| `text` | `#rrggbb` — le texte ; le gris des libellés s'en déduit | `#111827` |
| `font`, `title_font` | `sans`, `serif` — le texte et les titres | `sans` |
| `size` | corps du texte, 8 à 14 points ; titres, libellés et tableaux s'en déduisent | `10` |
| `margin` | marges, 8 à 40 mm | `20` |
| `titles` | intertitres des blocs de texte : `plain` (couleur du texte), `accent`, `rule` (soulignés d'un trait d'accent) | `plain` |
| `border` | cadre autour de chaque page : `none`, `line`, `double` | `none` |

Les défauts sont l'allure qu'avaient les modèles avant les thèmes : un modèle écrit alors
s'imprime comme il s'imprimait. Le texte posé sur un bandeau d'accent est blanc ou encre,
celui des deux qui contraste le plus (rapport de luminance WCAG).

### 1.2 En-tête et pied de page

`header` : `show` (`none`, `first`, `every`), `logo` (une image, §1.4, ou `null`),
`logo_width` (10 à 120 mm), `left` et `right` (texte riche — à gauche sous le logo, qui
envoie le document ; à droite, aligné à droite, ce qu'il est, son numéro, sa date), `rule`
(un trait d'accent dessous). Le corps commence sous l'en-tête, sur les pages qui le portent.

`footer` : `html` (texte riche), `align` (`left`, `center`), `page_numbers` (« 2 / 3 » à
droite), `rule` (un filet au-dessus). Un pied d'une ligne tient dans la marge du bas ; plus
haut, il remonte le bas du corps. L'ancien `footer`, une ligne de texte brut, se lit comme un
paragraphe de ce texte.

En-tête, pied, titres et textes citent les colonnes de la ligne : `{{colonne}}`.

### 1.3 Les blocs

| `kind` | Réglages | Ce qu'il montre |
|---|---|---|
| `text` | `html` (texte riche, forme canonique de l'assainisseur, chapitre 04 §2.2) ; `align` (`left`, `center`, `right`, `justify`) ; `size` (`small`, `normal`, `large`) ; `style` (`plain`, `tint` fond teinté, `border` encadré, `bar` barre d'accent à gauche) | titres, paragraphes, gras, italique, listes, citations, liens, séparateurs ; les citations `{{colonne}}` y prennent la valeur de la ligne |
| `title` | `text`, `subtitle` (texte brut citant des colonnes, 200 et 300 caractères) ; `style` (`plain`, `accent`, `underline`, `band` bandeau d'accent, `bleed` bandeau d'un bord à l'autre de la page) ; `align` ; `size` (`medium`, `large`, `huge`) | un grand titre ; il reste sur la page de ce qui le suit |
| `fields` | `fields` (des noms de colonnes ; aucun : toutes) ; `columns` (1 à 3 par ligne) ; `labels` (`beside` libellé à gauche, `above` libellé au-dessus en petites capitales, `summary` récapitulatif) ; `hide_empty` | les champs de la ligne ; en récapitulatif, les valeurs à droite et la dernière — le total dû — en gras sur un trait d'accent |
| `rows` | `title` ; `source` ; `columns` (12 au plus) ; `totals` ; `style` (`light`, `accent`, `lines`) ; `zebra` ; `headers` (en-têtes de colonne : « Qté » pour « Quantité ») ; `widths` (largeurs en %, 3 à 95) ; `align` | un tableau des lignes liées, avec ses totaux |
| `image` | `source` (§1.4) ; `width` (5 à 100 % de la largeur où il est posé) ; `align` | une image : un logo, un tampon, la photo d'un champ |
| `columns` | `columns` (2 ou 3 listes de blocs `text`, `title`, `fields`, `image`, `divider`, `spacer`) ; `widths` (poids relatifs, 1 à 12 : `[2, 1]` fait deux tiers et un tiers) | des colonnes côte à côte |
| `divider` | `color` (`accent`, `light`, `text`) ; `thickness` (0,25 à 6 points) ; `width` (5 à 100 %, centré) | un trait horizontal — un trait de signature est un trait court |
| `spacer` | `height` (1 à 150 mm) | un blanc vertical |
| `break` | — | un saut de page |

La `source` d'un tableau est soit **entrante** — `{ kind: 'incoming', table, field }` : les
lignes d'une autre table de la base dont le lien `field` (simple ou multiple) désigne cette
ligne, comme les lignes d'une facture —, soit **sortante** — `{ kind: 'outgoing', field }` : les
lignes qu'un lien multiple de cette ligne désigne. 500 lignes au plus ; au-delà, le tableau le
dit. `totals` somme les colonnes numériques qu'il nomme ; une colonne qui n'en est pas une ne
somme rien. Les clés de `headers`, `widths` et `align` qui ne sont pas des colonnes listées
sont écartées.

### 1.4 Les images

Une image (`logo` de l'en-tête, `source` d'un bloc `image`) est :

- **envoyée avec le modèle** — `{ kind: 'upload', data }` : une adresse `data:` d'un PNG ou
  d'un JPEG de **300 Kio au plus**, **8 images** au plus par modèle. Le type est lu dans les
  octets, pas dans l'adresse : un « PNG » qui n'en est pas un, un SVG (qui porte des scripts)
  sont refusés (`image_invalide`), une image trop lourde aussi (`image_trop_lourde`). Le
  noyau stocke l'adresse sous sa forme canonique. L'éditeur réduit l'image avant de
  l'envoyer, et fait d'un SVG un PNG ;
- **lue dans un champ image de la ligne** — `{ kind: 'field', field }` : la première image
  PNG ou JPEG du champ (8 Mio au plus), lue dans le stockage des fichiers une fois la ligne
  lue avec les droits du lecteur. Le fichier est cherché avec le champ pour lequel il a été
  déposé : une valeur ne peut désigner que les images de ce champ. Une image GIF, WebP ou
  AVIF n'est pas reprise.

### 1.5 Vérifier, relire

La définition est **vérifiée à l'écriture** (`normalizeSpec`) : sa forme, ses bornes, ses
textes assainis, ses couleurs (`#rgb` devient `#rrggbb`), ses images, puis contre le catalogue
du jour (`REQUEST_INVALID` avec `details.reason` : `champ_inconnu`, `champ_image_attendu`,
`lien_vers_la_table_attendu`, `langue_inconnue`, `couleur_invalide`, `valeur_hors_bornes`,
`valeur_inconnue`, `bloc_interdit_en_colonne`, `deux_ou_trois_colonnes`, `trop_de_blocs`,
`trop_d_images`, `aucun_bloc`…).

Elle est **relue avec tolérance** à chaque lecture (`readSpec`) : un réglage absent prend son
défaut, un réglage illisible aussi, un bloc illisible est laissé de côté — un modèle accepté
à l'écriture n'est jamais refusé ensuite. Au rendu, elle est confrontée au catalogue du jour :
ce qui a disparu depuis est laissé de côté plutôt que de faire échouer le document.

**Qui les voit.** Qui lit la table voit les noms de ses modèles, pour s'en servir ; qui la
construit (`manage_schema`) les écrit et lit leur définition — qui nomme des colonnes qu'un
lecteur ne voit peut-être pas.

## 2. Lire la ligne

Le rendu est fait **avec les droits de qui le demande**, par les chemins de lecture ordinaires :

- la ligne est lue comme la liste la lirait, filtrée sur `_id` : une ligne qu'il ne voit pas
  — table fermée, règle de lignes (chapitre 05 §16) — n'est pas trouvée (`RESOURCE_NOT_FOUND`) ;
- ses champs passent par son masque : un champ masqué n'apparaît ni dans un bloc `fields`, ni
  dans une citation — de l'en-tête, du pied, d'un titre ou d'un texte —, qui ne donne rien, ni
  comme image : un champ image masqué ne donne pas d'image ;
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

La fonction du noyau est `renderDocument(pools, ctx, { tableId, recordId, templateId })`, qui
rend `{ bytes, filename, title }` : l'API et les automatisations l'appellent de même. Le
stockage des fichiers, dont elle lit les images des champs, est attaché par le noyau à ses
`pools` quand il démarre (`useDocumentStorage`) : qui rend avec les pools du noyau l'atteint
sans le porter.

## 3. Composer la page

Le PDF est écrit par `pdfkit` (MIT, pur JavaScript) : texte vectoriel, polices embarquées et
réduites aux glyphes employés, liens actifs, images PNG et JPEG embarquées une fois même
répétées sur chaque page, métadonnées (titre, langue). Un navigateur sans tête aurait composé
du HTML, mais pèse des centaines de mégaoctets dans l'image et un processus de plus à
surveiller ; le rendu ici est un appel de fonction.

**Les polices** : Noto Sans (latin, grec, cyrillique : dix-sept des vingt langues) et Noto Sans
CJK (chinois, japonais, coréen), copiés dans l'image depuis les paquets Debian — six fichiers,
une quarantaine de mégaoctets. Chaque morceau de texte est composé dans la première police qui
en a tous les caractères ; les formes des idéogrammes suivent la langue du modèle (japonaise,
coréenne ou chinoise). `BASEDB_PDF_FONTS` nomme un dossier à soi, qui tient les mêmes
fichiers ; hors de l'image, les polices du système servent ; sans aucune, l'Helvetica intégrée
au PDF écrit ce qu'elle peut et remplace le reste par « ? ».

**La police avec empattement** n'ajoute aucun fichier à l'image : c'est Noto Serif quand le
dossier de `BASEDB_PDF_FONTS` (ou le système) l'a, sinon le Times que porte tout lecteur de
PDF. Le Times n'écrit que l'Europe de l'Ouest (Windows-1252) : un morceau de texte qu'il ne
sait pas écrire en entier — « Łódź », un nom japonais — est composé dans la police sans
empattement, d'un seul tenant, plutôt qu'un mot en deux polices.

**La composition** (`layout.ts`). `pdfkit` dessine ; les lignes sont coupées par le noyau. Chaque
texte est coupé en lignes avant d'être posé — ses mots mesurés dans la police de chacun, une
coupure possible après une espace, un trait d'union ou un idéogramme, un mot plus long que la
ligne coupé où il ne tient plus —, de sorte que la hauteur de toute chose est connue avant
d'être placée. Ce qui en découle :

- le texte s'aligne à gauche, au centre, à droite, ou se justifie (sauf la dernière ligne d'un
  paragraphe) ; les morceaux de polices différentes d'une ligne partagent sa ligne de base ;
- un bloc encadré ou teinté dessine son fond sous son texte ; plus haut qu'une page, il coule
  sans son cadre ;
- des colonnes se posent côte à côte ; plus hautes qu'une page, elles se suivent ;
- un titre — de bloc, d'intertitre, de tableau — reste sur la page de ce qui le suit ;
- un tableau répète son en-tête sur chaque page, aligne les nombres à droite, donne à une
  colonne courte la largeur de ce qu'elle contient et partage le reste entre les longues ;
  une rangée plus haute que la moitié d'une page se poursuit par bandes de lignes ;
- un blanc (`spacer`) reste où on l'a mis ; les espaces automatiques tombent en haut de page ;
- en-tête, pied, numéros (« 2 / 3 ») et cadre sont posés une fois le nombre de pages connu.

Les tailles se déduisent du corps du thème : intertitres à 1,8, 1,4 et 1,2 fois, libellés à
0,9, cellules à 0,95, pied à 0,8.

## 4. L'éditeur

Le menu **Document PDF › Modèles de document…** de la fiche d'une ligne ouvre l'éditeur, pour
qui construit la table : la liste des modèles à gauche, le modèle au milieu, à droite le PDF
qu'il fait de la ligne ouverte.

- **Un nouveau modèle part d'un point de départ** — page vierge, facture, devis, fiche,
  attestation — construit avec les colonnes de la table : sa colonne d'affichage pour le
  numéro, sa première date, ses montants (champs numériques au format devise) pour le
  récapitulatif, son image pour la photo, la relation dont les lignes ont un montant pour le
  tableau. Ce que la table n'a pas est laissé de côté, jamais montré vide. Les textes du point
  de départ sont dans la langue de l'écran.
- **Contenu** : les blocs en cartes — une poignée pour les glisser (ou le clavier), deux flèches,
  un menu (insérer après, dupliquer, supprimer) ; fermée, une carte résume ce que le bloc
  montre ; ouverte, ses réglages. Les blocs s'ajoutent depuis une fenêtre qui les montre tous,
  par groupes (contenu, données de la ligne, mise en page). Une colonne a ses propres cartes.
- **Style et page** : couleurs (nuancier ou `#rrggbb`), polices, taille, intertitres, format,
  orientation, marges, cadre, centrage vertical, langue des valeurs.
- **En-tête et pied de page** : le logo (une image envoyée, ou un champ image de la ligne), les
  deux textes de l'en-tête, le texte du pied, ses réglages.
- **L'aperçu** est recomposé par le serveur un instant après la dernière modification.
  Fermer avec des modifications non enregistrées demande confirmation.

## 5. Aperçu

`POST …/documents/preview` compose une définition non enregistrée, vérifiée comme celle d'un
modèle, et réservée à qui construit la table.

## 6. Routes

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
| Définition relue au rendu, avec tolérance | Un champ supprimé ne casse pas les factures ; un réglage ajouté ne casse pas les anciens modèles | Invalider le modèle à chaque changement de structure ; migrer les définitions |
| Les lignes coupées par le noyau | La hauteur de tout est connue avant d'être posée : fonds, colonnes, titres gardés avec leur suite, alignements mêlant des polices | Le retour à la ligne de `pdfkit`, qui dessine en mesurant et ne sait pas aligner à droite une ligne de plusieurs polices |
| Images du modèle dans la définition, en `data:` plafonnée | Un logo est petit ; la définition se copie, s'exporte et se relit d'un tenant, sans fichier orphelin à nettoyer | Un champ de fichiers propre aux modèles ; une adresse distante (requête sortante au rendu) |
| Le Times du PDF pour l'empattement | Aucun fichier de plus dans l'image ; Noto Serif quand l'exploitant le fournit | Embarquer Noto Serif (quelques mégaoctets de plus pour tous) |

## Ce que la v1 ne fait pas

- Pas de citation des lignes liées hors du tableau (l'adresse du client d'une facture se cite
  par une recherche sur la table de la facture), ni de calcul dans un modèle : un total TTC
  est un champ de la table.
- Deux familles de polices, sans choix d'une police à soi ; pas de code-barres ni de QR code.
- Une automatisation fait le PDF d'une ligne (étape `document`, chapitre 17 §1.3), le range
  dans un champ fichier et le joint à un courriel ; rien d'autre ne le fait sans clic.
- Pas de document pour plusieurs lignes à la fois.

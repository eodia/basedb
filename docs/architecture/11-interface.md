# 11. Interface

## Rôle de cette section

Ce chapitre fixe les **comportements observables** de l'interface : ce qui est chargé,
affiché, envoyé, et ce qui se passe quand cela échoue. Il ne décrit aucun composant.

La frontière avec « Architecture logicielle : monorepo, noyau, pools, tests » n'est pas
rediscutée ici : ce chapitre-là possède la pile, l'arborescence de `apps/web`, la règle
« Zustand ne détient jamais de données serveur », le point d'accès réseau unique et les
trois contrôles qui rendent exécutable l'interdiction des données simulées. Ce
chapitre-ci possède ce que l'utilisateur voit : grille, vue détail, éditeur de schéma.
Des écrans d'administration des chapitres 05 et 08, seule la part commune est traitée
ici (§7, §8).

Un invariant commande le reste : **l'interface est un consommateur de `/api/v1` comme
un autre**. Pas de route privée, pas de jeton de service, pas de raccourci vers le
noyau. Tout ce qu'elle affiche est la projection d'une réponse ; ce qu'elle n'affiche
pas, elle ne l'affiche pas parce que la réponse ne le contient pas. Ses paramètres par
défaut : `links=display`, `limit=100` en grille, `If-Match` sur toute écriture, jamais
`count`.

---

## 1. La grille

### 1.1 Ce qui est chargé, et ce qui ne l'est pas

Une page de grille est **un appel** : `GET /data/{base}/{table}`, `fields` restreint aux
colonnes affichées, `links=display`, `limit=100`, curseur de la page précédente. Aucun
`expand` : la grille affiche des valeurs d'affichage, pas des champs de la table cible.

Ne sont **jamais** projetés en liste les champs masqués, absents de la réponse. Le texte
long, lui, l'est : une colonne qu'on ne peut pas lire depuis la grille est une colonne que
personne ne lit. Sa cellule montre **une ligne de ce que dit le texte**, sans son balisage
Markdown — titres, éléments de liste et paragraphes joints par « · », coupée à 280
caractères —, le texte entier rendu au survol, et s'édite sur place (§3.2). Le prix est
celui de TOAST (« Types de champs et projection vers PostgreSQL », § 2.2) : la valeur est
décompressée à chaque lecture de la page, cent lignes au plus ; `fields` reste le moyen de
ne pas la lire, pour un consommateur qui n'en a pas l'usage.

`count` est absent par défaut ; un bouton « Compter » émet `count=exact`, et
`count_is_capped` s'affiche « 100 000+ », jamais un nombre rond inventé.

### 1.2 Virtualisation et chargement par curseur

Seules les lignes visibles et une marge fixe sont rendues. Une page suivante est
demandée à l'approche du bas de la fenêtre chargée, par le `next_cursor` reçu.

**Il n'existe pas de saut à la page N**, `offset` n'existant pas. La barre de défilement
représente la position dans les lignes **déjà chargées**, jamais une fraction d'un total
inconnu ; un compteur « 1 240 lignes chargées » remplace l'indicateur de pagination
classique. L'écart avec un tableur est la contrepartie d'un coût de page constant.

Tout changement de tri, de filtre ou de projection **jette le curseur**, celui-ci étant
lié à l'empreinte de sa requête. `CURSOR_STALE` est traité de même, sous un bandeau
« la structure a changé, la liste a été rechargée ».

### 1.3 Tri et filtre

Les opérateurs proposés par champ sont **exactement** ceux du récapitulatif normatif de
« Types de champs », lus dans `GET /meta/bases/{base}`. L'interface n'en propose jamais
un autre et n'en cache aucun. Pas de filtre relatif de date : les bornes sont absolues.

- Tri : au plus trois champs ; le départage par `_id` est ajouté par le serveur et n'est
  pas affiché. Un champ non triable au catalogue n'a pas d'entrée dans le menu.
- Tri sur un champ lien : par défaut sur la colonne elle-même. L'option « trier par
  valeur d'affichage » est offerte explicitement, avec la mention qu'aucun index ne la
  sert. `SORT_UNAVAILABLE` retire l'option ; `QUERY_TOO_EXPENSIVE` fait échouer le
  tri, et l'écran propose le repli sur la colonne de lien ainsi que la suggestion d'index
  renvoyée par la réponse.
- Un filtre posé sur un champ devenu invisible produit `FILTER_FIELD_UNKNOWN` : il est retiré de
  la barre avec la mention « champ inconnu », identique à une faute de frappe.

### 1.4 Colonnes

Une disposition de grille nommée et partagée est une vue enregistrée `_basedb.view_def`
(`kind = 'grid'`, §1.6), dont `spec` porte filtres, tri, largeurs et ordre des colonnes ; la
créer ou la modifier suppose `manage_schema` @ base (chapitre 05 §9), elle est partagée à
l'échelle de la table et il n'existe pas de vue personnelle. Seule la surcharge locale non
enregistrée — largeur tirée à la souris, colonne masquée à la volée — est persistée par
navigateur et n'est jamais envoyée au serveur. `field.position` donne l'ordre initial et
n'est pas modifié par un réarrangement local.

L'en-tête d'une colonne affiche le libellé du champ ; sa **description**, quand il y en
a une, s'ouvre en infobulle au survol et au focus clavier, jamais en permanence : une
grille dont chaque titre traîne une phrase n'est plus une grille. Une colonne sans
description ne montre rien de plus : jamais une infobulle vide.

### 1.5 Au-delà de 100 000 lignes

Le coût d'une page ne change pas, la reprise par curseur étant un parcours d'index à
partir d'une position. Ce qui change est ce que l'interface cesse d'offrir :

| Au-delà du seuil | Comportement |
|---|---|
| Total exact | `count_is_capped` ; affichage « 100 000+ » |
| Tri ou filtre non indexé | Refusé par le garde-fou de coût ; l'écran affiche le refus, la suggestion d'index et le tri indexé de repli |
| Saut de page | N'existe pas, quel que soit le volume |
| « Tout charger » | N'existe pas : pas de mode dégradé, pas de route d'export (A21) |

### 1.6 Les vues enregistrées

Une table se montre de huit façons, chacune une vue `_basedb.view_def` (chapitre 02) :
**grille**, **kanban**, **calendrier**, **chronologie**, **galerie**, **liste** — qui
montrent des lignes — et **formulaire**, **questionnaire** — qui en demandent une. Le sélecteur de vues est le
premier élément de la barre d'outils, **à gauche de « Filtrer »**. Il ouvre la liste :
« Toutes les lignes » d'abord — la grille de la table, que personne n'a enregistrée ni ne
peut supprimer, où tout lecteur retrouve toutes les lignes avec sa surcharge locale —,
puis les vues **collaboratives** dans l'ordre que leur a donné quiconque construit la base,
par glisser-déposer ou au clavier — cet ordre est celui de tous —, et enfin, sous « Mes
vues », les vues **personnelles** du lecteur. Un onglet retient la vue qu'il montre ; une
vue supprimée entre-temps le ramène sur la grille de la table.

Créer, configurer, renommer, dupliquer, réordonner et supprimer une vue collaborative
supposent `manage_schema` (chapitre 05 §9). **Une vue personnelle** ne demande que de
pouvoir lire la table : sa propriétaire seule la voit, la configure et la supprime, sans
rien changer pour les autres — le dialogue de création la propose à tous, et la seule
qu'il propose à qui ne construit pas. **Une vue collaborative se verrouille** : « Verrouiller
la vue » dans son menu, un cadenas dans le sélecteur ; tant qu'elle l'est, le serveur
refuse toute modification (`VIEW_LOCKED`) et l'écran n'offre plus « Enregistrer » — le
filtre ou le tri qu'on essaie par-dessus reste la surcharge locale, comme pour qui ne
construit pas.

**Le dialogue de création** demande, selon la nature :

| Nature | Champs pivots (obligatoires en gras) | Champs affichés |
|---|---|---|
| Grille | — | colonnes cochées et ordonnées ; les autres sont masquées |
| Kanban | **colonnes selon** une liste de choix, leur ordre se réglant ensuite en glissant leurs en-têtes ; titre, image de couverture ; masquer les colonnes vides | champs sous le titre de la carte |
| Calendrier | **date** ; date de fin, titre, couleur selon une liste de choix ; mois ou semaine | champs sous le titre, en semaine |
| Chronologie | **début** ; fin, regroupement par liste de choix ou lien, titre, couleur ; échelle jour, semaine ou mois ; **dépendances** : une relation de la table vers elle-même (« Dépend de ») | champs dans la barre |
| Galerie | titre, **image de couverture** (un champ image ou document), recadrée ou entière ; taille des cartes | champs sous le titre |
| Liste | titre ; regroupement par liste de choix, relation ou personne | champs sur la ligne, après le titre |
| Formulaire, questionnaire | — | questions cochées et ordonnées ; pour chacune un intitulé, une aide, « réponse obligatoire » ; titre, présentation, libellé du bouton, message après l'envoi, « proposer une nouvelle réponse » |

Chaque pivot est prérempli sur le premier champ qui peut le tenir, si bien qu'une table
qui admet la nature obtient sa vue en un clic ; une nature qu'elle n'admet pas — pas de
liste de choix pour un kanban, pas de date pour un calendrier — dit pourquoi et renvoie à
l'écran « Structure ». Un champ obligatoire de la table est toujours demandé par un
formulaire, verrouillé : la ligne serait refusée sans lui. Une vue qui montre des lignes
peut reprendre le filtre et le tri affichés au moment de la créer.

**Ce que chaque vue fait des lignes.** Le kanban lit **chaque colonne par sa propre
requête** — le filtre de la vue et « `statut eq "x"` », page après page, avec son
décompte — plutôt que de trier une page en colonnes, qui ferait paraître vide une colonne
dont les lignes viennent après ; glisser une carte écrit le choix, un `PATCH` d'un champ,
affiché aussitôt et remis en place si la base le refuse. Glisser l'en-tête d'une colonne la
déplace : l'ordre est celui de la **vue** (`spec.group_order`, des valeurs de choix), écrit
par qui détient `manage_schema`, jamais celui de la liste de choix, qui reste le même
partout ailleurs ; un choix ajouté depuis va en dernier, « Sans valeur » reste en tête. Le
calendrier et la chronologie
ne demandent que les lignes de leur **fenêtre**, par une clause de dates jointe au filtre
de la vue — le début dans la fenêtre, ou, avec une fin, toute ligne qui la chevauche —,
jusqu'à mille lignes, au-delà desquelles l'écran dit de resserrer le filtre plutôt que de
prétendre tout montrer. Glisser une ligne d'un jour à l'autre, ou une barre, la décale
d'autant de jours, sa fin avec elle et son heure conservée ; le bord droit d'une barre
change la fin seule. Les lignes sans date sont comptées, et listées dans le calendrier,
pour qu'on les date. Le formulaire écrit **une** ligne par **un** `POST` à l'envoi, comme
le panneau de création (§2.5) ; le questionnaire pose les mêmes questions une par écran,
Entrée pour continuer. Un « + » dans une colonne de kanban ou un jour de calendrier ouvre
une ligne déjà dotée de ce choix ou de cette date.

**Galerie et liste.** La galerie montre une carte par ligne, sa couverture en tête — la
première image du champ choisi —, le titre et les champs choisis dessous ; un clic ouvre
la fiche. La liste montre une ligne par enregistrement, le titre puis les champs, sous
des en-têtes de groupe repliables. Les deux lisent leurs lignes page après page, avec le
filtre et le tri de la vue.

**L'ordre à la main.** Sans tri, un kanban, une galerie ou une liste montrent les lignes
dans l'ordre que la vue retient (`spec.manual_order`, des `_id`, 5 000 au plus) : on
glisse une carte, une ligne, et l'ordre est enregistré dans la vue — par qui peut la
modifier, c'est-à-dire sa propriétaire pour une vue personnelle. Une ligne que l'ordre ne
nomme pas — créée depuis — va après les autres, dans l'ordre de la table ; un tri, s'il y
en a un, l'emporte. La grille garde l'ordre de son tri : ses pages se lisent par curseur,
et un ordre à la main n'y aurait pas de sens au-delà de la première.

**Dépendances.** Une chronologie dont la vue désigne une relation de la table vers
elle-même dessine une flèche de la fin de chaque ligne dont une autre dépend vers le
début de celle-ci ; une flèche qui remonte le temps — la suivante commence avant la fin de
celle dont elle dépend — est rouge.

**Partager une vue.** À qui détient `manage_schema`, un formulaire ou un
questionnaire offre « Partager » — en haut de la vue et dans le menu de la vue du
sélecteur. Le dialogue choisit **qui peut répondre** (« Public » ou « Membres
connectés », restreints au besoin à des groupes), montre le lien à copier, à ouvrir ou à
régénérer, un interrupteur « Lien actif », une date limite, un
nombre maximal de réponses, le compte des réponses reçues, les questions que le lien ne
posera pas et pourquoi, et au nom de qui les réponses s'écrivent. La page du lien,
`/f/<jeton>`, est hors de l'application : le formulaire seul. Une **vue de données** —
grille, kanban, calendrier, chronologie, galerie, liste — se partage de même **en lecture
seule** : la page `/v/<jeton>` montre ses lignes, ses champs visibles, son filtre et son
tri, sans rien permettre de modifier ; « Autoriser l'intégration » y ajoute le code d'une
`<iframe>` à coller dans une autre page. Le chapitre 15 fixe le reste.

**La grille, au-delà des colonnes.**

- **Recherche rapide** : un champ de la barre d'outils cherche un texte dans toutes les
  colonnes qui peuvent le tenir — `contains` sur un texte, comparé sans casse ni accents ;
  les choix dont le **libellé** le contient, sur une liste ; l'égalité sur un nombre quand le
  texte en est un. La clause est jointe au filtre sans en faire partie : rien ne
  l'enregistre, « Vue modifiée » l'ignore, et un texte qu'aucune colonne ne peut tenir ne
  trouve rien plutôt que tout. Elle vaut pour la grille, le kanban, le calendrier et la
  chronologie.
- **Groupement** : les lignes se groupent selon un champ à valeur unique et comparable
  (texte court, liste de choix, booléen, lien, date, nombre, URL, formule, e-mail,
  personne). La grille lit alors ses lignes **triées d'abord par ce champ** : chaque groupe est une seule suite de
  lignes, sur autant de pages qu'il en faut, et son en-tête porte le décompte du groupe sur
  **tout** le filtre, lu par `GET …/aggregate?group=`. Un groupe se replie d'un clic ; ce
  repli est local.
- **Barre de résumé** : sous la grille, chaque colonne peut porter un agrégat — remplies,
  vides, valeurs uniques, somme, moyenne, minimum, maximum, cochées, selon le type —
  calculé sur toutes les lignes que garde le filtre, jamais sur la page, avec leur nombre
  total dans la gouttière. Rien n'est demandé tant qu'aucun résumé ni groupement n'est
  affiché : l'agrégat est un balayage, et `count` reste hors des chargements ordinaires
  (§1.1).
- **Couleurs** : une ligne prend la couleur de son choix dans une liste, ou celle de la
  première **règle** — un filtre et une couleur — qu'elle satisfait. Les règles sont évaluées
  à l'écran, sur les lignes chargées, avec la sémantique du filtre du noyau (une valeur
  vide ne satisfait que `is_null`) ; un chemin à travers un lien, dont la page ne tient pas la
  ligne cible, ne satisfait rien. Une règle citant un champ que le lecteur ne voit pas lui
  est retirée à la lecture. **Chaque règle choisit comment sa couleur s'affiche** — en
  **trait et fond** (par défaut), en **trait à gauche** seul, ou en **fond** seul, teinte
  légère qui couvre aussi la gouttière et les colonnes figées —, et la liste de choix a le
  sien (`color_style`) ; une ligne prend la couleur et l'affichage de ce qui la colore.
- **Hauteur des lignes** : courte, moyenne, haute ou très haute — une, deux, quatre ou six
  lignes de texte par cellule.
- **Colonnes système** : « Créé le », « Modifié le », « Créé par », « Modifié par » —
  `_created_at`, `_updated_at`, `_created_by`, `_updated_by` — s'affichent comme des
  colonnes en lecture seule, une date et heure ou une personne (chapitre 04 §2.10). Elles
  sont **masquées tant qu'on ne les demande pas**, à l'inverse d'un champ, affiché tant
  qu'on ne le masque pas : présentes sur chaque table, elles ne sont voulues que sur
  quelques-unes. Le menu des colonnes les propose à part, sous « Informations système ».
  Une vue peut trier, filtrer, grouper (par auteur) et résumer sur elles, que tout lecteur
  de la table lit (A18) ; un formulaire ne les demande jamais. `_id` n'en est pas : un
  identifiant est pour les programmes, et la fiche le donne.

Tous ces réglages, sauf la recherche, font partie du `spec` d'une grille enregistrée
(`group_by`, `summaries`, `color_field`, `color_rules`, `color_style`, `row_height`,
`system_columns`).

**Modifiée, non enregistrée.** Changer le filtre, le tri ou les colonnes d'une vue
enregistrée ne l'écrit pas : la barre dit « Vue modifiée » et offre « Enregistrer » —
pour tous, à qui détient `manage_schema` — et « Rétablir ». Sur la grille de la table, un
filtre, un tri ou des colonnes arrangées offrent « Enregistrer comme vue ».

**Ce que le lecteur ne voit pas.** Le `spec` d'une vue lui parvient reprojeté (chapitre
02) : un champ masqué pour lui disparaît des colonnes, des cartes et des questions, et un
pivot masqué — ou supprimé, ce qui doit se lire de même — fait dire à la vue qu'elle ne
peut pas être dessinée. Une vue dont le **filtre** cite un tel champ n'est pas montrée du
tout : montrée sans filtre, elle montrerait plus qu'elle n'a été faite pour montrer.

### 1.7 Le SQL de chacun, et les requêtes enregistrées

Un onglet SQL s'ouvre sur toute base qu'on voit — « Requête SQL », au « + » de la barre
d'onglets ou dans le menu de la base. **Ce qu'il lit dépend de qui le lance**,
et le résultat le dit :

- qui gère la structure de la base (`manage_schema`) a la **console** : tout le schéma,
  écritures comprises, sur le rôle `basedb_console` (chapitre 09 §1, exception assumée) ;
- tout autre lecteur écrit du SQL **en lecture seule, avec ses propres droits** : sur un
  rôle PostgreSQL qui lui est propre (`basedb_reader_<id>`), dont les `GRANT` sont, colonne
  par colonne, le verdict du décideur au moment de l'appel. Une table qu'il ne lit pas
  n'existe pas pour sa requête ; un champ masqué est une colonne absente de `SELECT *` et
  refusée si on la nomme. Le résultat porte alors la pastille « Vos droits ».

**Une requête s'enregistre** — « Enregistrer » dans la barre de l'onglet, ou « Enregistrer
sous… » — et se range dans la navigation, sous les tables de sa base, rubrique
« Requêtes » (`_basedb.saved_query`, chapitre 02). Trois portées, qu'une icône rappelle :

| Portée | Qui la voit | Qui la crée ou la modifie |
|---|---|---|
| Personnelle (cadenas) | son auteur | quiconque voit la base, pour soi |
| Toute la base | quiconque voit la base | qui gère la structure de la base |
| Des groupes | les membres des groupes choisis, et qui gère la base | qui gère la structure de la base |

**Partager une requête partage son texte, jamais ce que son auteur lit** : chacun l'exécute
avec ses propres droits, comme ci-dessus. Ouverte depuis la navigation, elle s'exécute
aussitôt **en lecture seule** — personne n'a encore décidé d'en lancer le texte pour de
bon, et une requête partagée peut contenir une écriture que son lecteur n'a pas lue ;
« Exécuter » la lance ensuite telle qu'elle est. L'onglet retient la requête qu'il montre :
un point signale un texte modifié depuis l'enregistrement, et « Enregistrer » l'y range si
l'on peut la modifier, sinon propose d'en faire une nouvelle.

### 1.8 Les vues SQL

Une **vue SQL** est une vraie vue PostgreSQL du schéma de la base (`_basedb.sql_view`,
chapitre 02) : un `SELECT` sur ses tables et ses autres vues, qu'on lit sous son nom depuis
`psql` comme depuis l'interface. Elle **prend place parmi les tables** dans la navigation,
habillée comme elles — couleur, pictogramme ou image —, un petit œil à droite disant que
c'est une vue ; un onglet de vue montre ses lignes dans la grille, en lecture, avec
« Actualiser ».

Elle se crée par « Nouvelle vue SQL… » dans le menu de la base, ou « Créer une vue SQL… »
depuis un onglet SQL, dont le texte devient sa définition ; construire une vue est
construire la base : `manage_schema`. Le dialogue donne son libellé, son apparence, son nom
technique — tiré du libellé, alloué comme celui d'une table (chapitre 01) — et sa requête ;
PostgreSQL refuse ce qu'il refuse, et l'éditeur pointe l'endroit.

**Une vue ne montre jamais un champ qu'on ne voit pas.** Elle est créée
`WITH (security_invoker = true)` : la lire, c'est lire ses tables avec les droits de qui la
lit, colonne par colonne. La navigation n'en liste donc, à qui ne gère pas la base, que les
vues dont il lit chaque table et chaque colonne — ce que dit `pg_depend`, exact à travers
les renommages. Une vue ne lit que **sa** base : ses tables vivantes, ses vues et le
catalogue de PostgreSQL ; une autre base, `_basedb` ou une fonction hors `pg_catalog` sont
refusées, sur ce que PostgreSQL a enregistré plutôt que sur le texte.

**La structure passe par-dessus les vues.** Une formule stockée recréée (`DROP COLUMN` puis
`ADD COLUMN`) retire un instant les vues qui la lisent et les remet sur la nouvelle colonne ;
celle qui ne tient plus reste hors de PostgreSQL, « à corriger », sa définition gardée
(`SQL_VIEW_BROKEN` à la lecture). Une table n'est pas purgée sous une vue qui la lit
(`DEPENDENT_OBJECT`) ; la purge d'une base emporte ses vues avant ses tables. Les vues ne
suivent pas encore une base d'un environnement à l'autre, ni dans un modèle.

---

## 2. L'édition en ligne

### 2.1 Modèle optimiste, borné à la cellule

**Décision : optimiste, à granularité d'une cellule, avec `If-Match` systématique.**
Jamais plus d'une écriture en vol par ligne, pas de file d'écritures différées.

1. La saisie est validée localement contre le contrat du champ — type, longueur maximale,
   options autorisées, format décimal. Un refus local ne part pas au serveur.
2. La cellule passe « en cours » et affiche la valeur saisie.
3. `PATCH /data/{base}/{table}/{id}` est émis avec l'`ETag` détenu en `If-Match` et un
   corps réduit au seul champ modifié.
4. Sur succès, **la ligne entière est remplacée par la réponse** et l'`ETag` renouvelé.
5. Sur échec, la cellule reprend sa valeur d'avant et le message s'ancre sur elle.

L'étape 4 n'est pas une précaution : normalisation des valeurs texte à l'écriture,
formules stockées recalculées par PostgreSQL, valeur d'affichage d'un lien et
`_updated_at` font de la réponse la seule vérité. *Alternative écartée* : le verrou de
cellule pessimiste, qui exige un état serveur par cellule et un canal temps réel pour
libérer les verrous abandonnés — hors phase 2.

### 2.2 Conflit de version

`412 VERSION_CONFLICT` signifie que la projection visible de la ligne a changé. La cellule
**ne réécrit pas**. L'interface relit la ligne et ouvre un panneau de rapprochement à
trois colonnes — valeur d'origine, valeur du serveur, valeur saisie — limité aux champs
divergents, avec deux actions : *écraser*, qui rejoue le `PATCH` avec le nouvel `ETag`,
et *abandonner*. **Aucune fusion automatique.**

L'`ETag` étant l'empreinte de la projection **visible par l'appelant**, une écriture
concurrente portant uniquement sur des champs masqués ne produit pas de `412` : le
panneau ne s'ouvre jamais sur une liste de divergences vide.

### 2.3 Erreurs de contrainte remontées par la base

L'interface **ne fabrique aucun message à partir d'un code**. Elle affiche
`error.message`, français et destiné à l'humain, et n'utilise `error.code` que pour
décider **où** l'afficher et **quelles actions** proposer.

| Code | Ancrage | Action proposée |
|---|---|---|
| `VALIDATION_FAILED` | Cellule, par entrée de `details.violations[]` | Aucune |
| `REQUIRED_FIELD_MISSING` | Cellule | Aucune |
| `DUPLICATE_VALUE` | Cellule, via `details.field` | Aucune. Ni la valeur en conflit, ni la ligne existante ne sont affichées : la réponse ne les porte pas |
| `LINK_TARGET_NOT_FOUND` | Cellule de lien | Rouvrir le sélecteur |
| `FIELD_NOT_WRITABLE` | Cellule | Aucune. Ce code ne devrait pas survenir (§7) |
| `TABLE_MIGRATING` (503) | Bandeau de table | Réessai après `Retry-After` ; table en lecture seule tant que le bandeau est là |
| `CATALOG_DRIFT_DETECTED` (503) | Bandeau de table | Rechargement du schéma, puis un seul réessai |
| `TIMEOUT_EXCEEDED` (504) | Bandeau de ligne | Réessai manuel |

Aucun nom physique, aucun nom de contrainte, aucun `SQLSTATE` n'atteint l'écran : la
frontière d'erreur du chapitre 08 garantit qu'ils ne sortent pas de l'API.

### 2.4 Annulation

Échap avant envoi jette le brouillon. Après envoi, **Ctrl+Z** (⌘Z) annule la dernière
écriture de l'onglet et **Ctrl+Maj+Z** (ou Ctrl+Y) la rétablit (chapitre 16 §4) : une
cellule, un déplacement de carte ou de barre, une ligne créée ou supprimée, un collage,
un import. Ce n'est pas une seconde écriture déguisée : le serveur revient sur la
transaction par l'historique, et refuse si quelqu'un a écrit depuis — l'écran le dit, au
lieu d'écraser. Ctrl+Z dans un champ en cours de saisie reste celui du champ.

### 2.5 Créer et supprimer une ligne

La ligne vierge en bas de grille déclenche un `POST` à la première validation. Si un
champ obligatoire n'est pas inscriptible pour l'acteur, la réponse est
`CREATE_IMPOSSIBLE` et l'interface **n'ouvre pas** la ligne vierge : le bouton est
absent, avec la liste des champs visibles en cause.

`ROW_REFERENCED` ouvre le panneau des référents construit sur `details.referenced_by` —
table, champ, libellé, décompte, lien vers la liste filtrée. Si `has_hidden_references`
est présent, une phrase unique l'énonce : « d'autres références existent dans des tables
que vous ne pouvez pas consulter ». Rien de plus, la réponse ne disant rien de plus.

Suppression qui cascade : conformément à A14, la suppression en chaîne est celle de
PostgreSQL. L'interface **affiche le décompte serveur par table**, exige une confirmation
saisie et transmet le total annoncé dans `X-Basedb-Confirm-Cascade`.
`CASCADE_CONFIRMATION_REQUIRED` remplit le panneau ; `CASCADE_TOO_LARGE` le refuse et
renvoie vers une opération d'administration. L'écran énonce que l'effet est récursif et
qu'il se produit aussi lors d'une suppression faite directement en SQL.

---

## 3. Rendu et édition des neuf types

| Type | Rendu en grille | Édition |
|---|---|---|
| Texte court | Une ligne, troncature visuelle | Saisie sur place |
| Nombre | Chaîne décimale alignée à droite, formatée selon `field_number_config`, sans aucun facteur | Saisie sur place, envoyée en chaîne |
| Booléen | Case cochée, décochée, ou vide si le champ est nullable | Bascule directe, tri-état si nullable |
| Date | Date locale, valeur ISO envoyée | Sélecteur de date |
| Date-heure | Mode `utc` : fuseau du lecteur. Mode `fixe` : fuseau du champ, affiché à côté | Décalage complété avant envoi ; une saisie sans décalage n'est jamais envoyée en mode `utc` |
| Formule | Valeur du type de résultat, en lecture seule | **Aucune.** Une infobulle affiche l'expression réémise depuis son arbre, avec les libellés courants |
| Texte long | Extrait d'une ligne sans balisage, texte rendu au survol (§1.1) | Éditeur Markdown ouvert sur la cellule par un double clic ; rendu, et éditeur au clic, en vue détail (§3.2) |
| Lien URL | L'adresse sans son schéma, lien ouvert dans un nouvel onglet | Saisie sur place (double clic) ; normalisée par le serveur |
| Liste de choix | §3.1 | §3.1 |
| Relation | §4 | §4 |
| Relation multiple | Une pastille par ligne liée, dans l'ordre de la colonne ; deux au plus, tronquées, le reste compté (« +2 »). Un élément masqué se lit « masqué », une fois (chapitre 04 §4 bis) | Sélecteur de la cible, chaque ligne une bascule, recherche côté serveur ; une ligne choisie va à la fin, une ligne retirée laisse les autres en place. En vue détail, les pastilles ouvrent la ligne liée et « Modifier » ouvre le sélecteur |
| E-mail, téléphone | Lien `mailto:` ou `tel:` | Saisie sur place, vérifiée par le serveur |
| Personne | Nom et initiales du membre | Sélecteur des membres de l'espace ; un compte désactivé reste affiché mais n'est plus proposé |
| Numéro automatique | Nombre aligné à droite | **Aucune** : donné par la base |
| Formule, recherche, cumul, décompte | Comme le champ que leur valeur est : un cumul de montants se lit en monnaie, une recherche de choix en pastilles, une recherche qui atteint plusieurs lignes en une pastille par valeur (chapitre 04 §7 ter) | **Aucune.** Le dialogue « Nouveau champ » écrit une formule — les champs s'insèrent d'un clic, les fonctions sont rappelées, un refus nomme le champ ou la position fautive — ou choisit la relation suivie (de la table, ou d'une autre qui la désigne), le champ lu et le calcul |
| Note | Étoiles | Un clic sur une étoile ; un clic sur l'étoile déjà choisie efface la note |

### 3.1 Liste de choix

La cellule affiche le **libellé** de l'option ; la valeur envoyée est le slug stocké.
Une option qui a une apparence — une couleur, un pictogramme ou une image — s'affiche
comme une **pastille** dans la cellule, la vue détail et le menu ; une option qui n'en
a pas garde le texte simple, de sorte qu'une liste que personne n'a habillée ne change
pas. La pastille est la couleur à 14 % sur la surface, et son texte est cette couleur
mêlée au texte courant : quelle que soit la teinte choisie, y compris un jaune pâle,
le texte reste lisible en clair comme en sombre, sans calcul de contraste.
L'ordre du menu est celui de `position`, jamais l'ordre alphabétique — c'est aussi
l'ordre de tri émis par le serveur. Une option archivée n'est plus proposée à la saisie
mais reste affichée, marquée comme archivée, sur les lignes qui la portent : la
contrainte l'autorise toujours. Le choix multiple n'est pas exposé.

### 3.2 Texte long, et la variante HTML riche

**Le texte long simple s'écrit en Markdown**, et la colonne garde la source telle qu'elle a
été tapée : psql lit le texte qu'une personne a écrit, le rendu est l'affaire de l'écran.
L'éditeur — barre d'outils (titre, gras, italique, barré, listes, cases à cocher, citation,
code, lien), source colorée, onglet « Aperçu » — s'ouvre par-dessus la cellule sur un double
clic ; Ctrl+Entrée, le bouton ou un clic ailleurs enregistrent, Échap laisse la valeur
telle qu'elle était. En vue détail, le texte est rendu, et un clic ouvre le même éditeur,
enregistré à la perte du focus comme les autres champs. Le rendu **n'interprète jamais de
HTML** — il construit des éléments, un `<script>` tapé dans une note s'affiche en texte —,
ses liens partent dans un nouvel onglet, sans `opener`, et une image n'est qu'un lien : une
image distante est une requête que le lecteur n'a pas choisi de faire.

La variante riche — « Texte riche (HTML) » dans la liste des types, choisie à la création
du champ — stocke du HTML déjà assaini à l'écriture, côté serveur. Elle s'écrit dans un
éditeur visuel (Tiptap) : titres, gras, italique, souligné, barré, listes, citation, code,
lien, séparateur. Son schéma **est** le profil du chapitre 04 §2.2 : ni image, ni tableau,
ni couleur, rien de ce que le serveur retirerait sans le dire. Il s'ouvre sur la cellule
comme l'éditeur Markdown, et en vue détail au clic ; Ctrl+Entrée enregistre, Échap
annule. La règle de rendu est celle que le chapitre 08 pose comme contrat du consommateur :

1. **Le HTML est réassaini au rendu**, sans exception : le stock peut avoir été écrit
   directement en SQL, donc sans passer par l'assainisseur. Le champ porte
   `unsafe_html` dans la description, `x-basedb-unsafe-html` dans la spécification.
2. Le vocabulaire retenu au rendu est **au plus** celui du profil ; l'éditeur ne produit
   pas autre chose. Le fragment est analysé puis **reconstruit élément par élément** —
   les balises du profil, les liens aux seuls schémas `http`, `https` et `mailto` —,
   jamais inséré comme HTML brut ; les images ne sont pas rendues. La grille et les
   cartes n'en montrent que les mots.

**Variables.** Un texte long, simple ou riche, peut citer une colonne de sa ligne
(chapitre 04 §2.2). Le menu « Colonne » de la barre d'outils insère la citation au
curseur : une pastille au libellé de la colonne dans l'éditeur riche, `{{Libellé}}` dans
le Markdown — un libellé se lit mieux qu'un nom physique, et l'écran le traduit en nom à
l'enregistrement, comme la description d'une carte de kanban (§1.6). Partout ailleurs,
le texte se lit avec les valeurs de la ligne ; l'éditeur, lui, relit le texte tel qu'écrit
(`variables=raw`) à son ouverture, pour ne pas enregistrer les valeurs à la place des
citations.
3. Les **libellés et les descriptions** du catalogue sont du texte, jamais du Markdown ni
   du HTML : ils sont échappés partout, titres et infobulles de colonnes compris.

---

## 4. La cellule de relation

### 4.1 Ce qui est affiché

La valeur lue est `{"id": …, "display": …}`. **La cellule affiche `display`.**
L'identifiant n'est jamais le texte principal.

| Cas | Affichage |
|---|---|
| `display` renseigné | Le libellé, seul |
| `id` renseigné, `display` nul | « (sans titre) » suivi des huit premiers caractères de `_id` |
| `id` nul, `display` nul | Cellule vide |
| `masked: true` (A16) | Une pastille neutre « enregistrement lié », non cliquable |
| Champ lien lui-même masqué | La colonne n'existe pas |

**Deux lignes qui affichent la même chose.** La colonne d'affichage n'est pas unique.
Règle : dans les sélecteurs et les listes de lignes référençantes, le désambiguïsateur —
les huit premiers caractères de `_id` — est **toujours** présent ; dans une cellule de
grille, il n'apparaît que si la page chargée contient au moins deux `display` identiques
pointant des identifiants distincts.

**Cible illisible.** `masked: true` n'est pas un cas d'erreur, c'est la forme unique de
réponse fixée par A16. La cellule n'est pas modifiable — le champ est hors de
`champs_inscriptibles` (chapitre 05 §5.1) — mais elle reste **effaçable** si le champ
n'est pas obligatoire ; le sélecteur ne s'ouvre pas, faute de pouvoir lister la cible. Le
tri et le filtre sur un tel champ se réduisent à « renseigné » et « non renseigné », et le
menu ne propose rien d'autre.

### 4.2 Le clic

Un clic sur la valeur ouvre la **vue détail de la ligne cible**, en panneau superposé. La
pile est bornée à trois niveaux ; au-delà, la navigation bascule en pleine page. La
fermeture restitue la position de défilement de la grille.

Le clic n'est pas offert quand `masked` est vrai. Il l'est dans tous les autres cas, y
compris lorsque `display` est nul : l'interface ne peut pas distinguer « ligne cible
invisible » de « colonne d'affichage masquée ». Si l'ouverture rend
`404 RESOURCE_NOT_FOUND`, le panneau affiche « cet enregistrement ne vous est pas
accessible » — le même écran que pour une ligne inexistante, conformément au principe
d'absence.

### 4.3 Le sélecteur de ligne cible

Une liste paginée par curseur sur la table cible : `fields` réduit à la colonne
d'affichage, `links=id`, `limit=50`, tri sur la colonne d'affichage si elle est triable,
sinon sur `_id`.

- **La recherche est serveur**, jamais un filtrage de la page déjà chargée. Elle emploie
  `contains` si la colonne d'affichage est recherchable — donc servie par l'index
  trigramme —, `starts_with` sinon.
- Si la colonne d'affichage n'est pas d'un type texte, il n'y a **pas** de champ de
  recherche : une liste paginée seule, plutôt qu'un champ qui ne trouve rien.
- Si la table cible n'a pas de colonne d'affichage, les lignes sont listées par `_id`
  abrégé et `_updated_at`.

### 4.4 Créer une ligne cible depuis le sélecteur

**Décision : autorisée, sous forme réduite.** L'entrée « Créer « *texte saisi* » »
apparaît si et seulement si l'acteur détient `create` sur la table cible, que cette table
a une colonne d'affichage, et que tous ses champs obligatoires sont soit la colonne
d'affichage, soit pourvus d'une valeur par défaut. Sinon l'entrée est **absente** — pas
grisée, pas expliquée — et remplacée par un lien « ouvrir la table », conformément au
principe « absence plutôt qu'erreur ».

La création émet un `POST` ordinaire sur la table cible, puis l'écriture du lien. **Les
deux ne sont pas atomiques**, et ne peuvent pas l'être : le lot atomique porte sur une
seule table. Si la seconde écriture échoue, la ligne créée subsiste ; l'interface le dit
et propose de réessayer l'affectation, jamais de supprimer en silence ce qu'elle vient de
créer. *Alternative écartée* : un formulaire de création complet superposé, qui rouvrirait
une vue détail entière dans un sélecteur ouvert dans une cellule en cours d'édition.

---

## 5. La vue détail

### 5.1 Les champs

Un appel : `GET /data/{base}/{table}/{id}?links=display`. Pas d'`expand` — la vue détail
affiche les champs de **sa** ligne, pas ceux des cibles.

Les champs suivent l'ordre de `position`. Les colonnes système sont regroupées en pied de
fiche et toujours affichées dès que la table est lisible (A18) ; `_created_by` et
`_updated_by` nuls s'affichent « écriture hors application », qui est leur sens exact.
L'édition suit les règles du §2, champ par champ, avec l'`ETag` de la ligne. Un onglet
« Historique » consomme `GET …/{id}/history`, dont la forme appartient à « Historique des
données et des structures » ; une entrée dont tous les champs modifiés sont masqués
n'étant pas renvoyée, l'interface n'affiche aucun compteur de révisions masquées.

Sous la ligne d'un champ, sur toute la largeur de la fiche, sa **description** s'affiche
en texte d'aide discret, limité à trois lignes, le texte entier restant dans l'infobulle.
Elle est rendue comme du texte (§3.2), jamais interprétée. Un champ sans description n'a
pas de ligne d'aide vide : sa ligne garde la hauteur qu'elle a toujours eue. Les colonnes
système, dont la description est fixe, s'expliquent de la même façon : c'est là qu'on
apprend que `_id` est la valeur à fournir dans un lien.

### 5.2 Les lignes référençantes

Un appel : `GET …/{id}/referenced_by`, qui rend le résumé groupé. L'interface ne
reconstruit rien et ne configure rien.

- Chaque groupe est titré par le `label` renvoyé, jamais recomposé localement : c'est ce
  qui distingue deux champs lien d'une même table source vers la même cible.
- Le résumé sert au plus 20 blocs, un compteur plafonné à 500 — `count_is_capped: true`
  s'affiche « 500+ » — et un aperçu de 3 lignes (chapitre 08 §5.6) ; le groupe est replié
  par défaut au-delà, et la liste paginée d'un bloc suit la limite ordinaire de 50.
- Déplier un groupe charge `GET …/{id}/referenced_by/{source_table}.{field}`, liste paginée
  par curseur, rendue comme une grille en lecture seule. **Aucune action destructive n'est
  proposée depuis ce bloc.**
- `meta.warning = "REFERENCED_BY_TRUNCATED"` affiche « d'autres blocs existent » et un
  bouton de chargement.
- Un groupe absent l'est pour deux raisons indistinguables — aucune référence, ou table
  source invisible. L'interface **n'en dit rien** : pas de compteur à zéro, pas de mention
  « groupes masqués ».

### 5.3 Commentaires et présence

Un onglet « Commentaires » suit « Détails » et « Historique » (chapitre 16 §1) : le fil
de la ligne, du plus ancien au plus récent, et une zone de saisie où `@` propose les
membres du tenant. Les personnes qui regardent la même ligne s'affichent en pastilles
dans l'en-tête du panneau ; celles qui regardent la table, dans la barre d'outils. Une
cloche, dans la barre latérale, compte les notifications non lues et les liste ; en
ouvrir une ouvre la ligne.

Les écritures des autres arrivent sans rechargement (chapitre 16 §3) : la page affichée
est relue au signal, une cellule en cours d'édition n'est jamais remplacée sous le
curseur.

### 5.4 Automatisations et boutons

Une entrée « Automatisations » de la barre latérale ouvre celles de la base (chapitre
17) : la liste, avec leur interrupteur et leur dernière exécution, et l'éditeur. Le flux
s'y dessine de haut en bas — le déclencheur, puis chaque étape en carte, une condition
ouvrant ses chemins côte à côte et les rejoignant ensuite ; un « + » sur un trait ajoute
une étape à cet endroit, une carte ouvre ses réglages dans le panneau de droite. Chaque
réglage n'offre que ce que ce point du flux peut nommer : les lignes sur lesquelles agir,
et, dans un menu près de chaque texte, les valeurs à citer (`{{champ}}`, `{{e2.champ}}`),
insérées là où est le curseur. Une carte incomplète, ou qui cite une étape qui n'a pas
forcément eu lieu avant elle, le dit avant l'enregistrement ; un refus de l'API ouvre
l'étape qu'il concerne. Une automatisation simple — un déclencheur et une action — tient
en deux cartes. L'onglet « Exécutions » liste les dernières ; en choisir une la pose sur
le flux : le chemin pris tracé, chaque étape passée avec son résultat et sa durée, le
reste estompé. « Tester » exécute l'automatisation enregistrée sur une ligne choisie.
**Copilot**, tout à droite de l'en-tête comme sur les tables et les tableaux de bord, ouvre
sous l'en-tête la conversation du chapitre 17 §6 — la liste des
automatisations se replie pour laisser la place au flux ; une proposition se pose sur le flux
d'un clic, sans être enregistrée, et s'annule depuis sa carte. Un champ bouton se dessine comme un bouton dans
la cellule, la carte et la fiche ; un clic dit ce qui a été lancé, ou pourquoi rien ne
l'a été.

### 5.5 Tableaux de bord et modèles

« Tableaux de bord », dans le bloc de la base ouverte en bas de la barre latérale, ouvre
les tableaux de bord de la base (chapitre 18) : à gauche, ses tableaux de bord, les questions
enregistrées qu'on peut ouvrir et « Explorer les données » ; au centre, le tableau choisi, ses onglets, ses
filtres et ses cartes sur une grille de vingt-quatre colonnes. Qui construit la base passe en
mode édition — placer une question, un titre, un texte, une page intégrée, déplacer et
redimensionner les cartes, ajouter un onglet ou un filtre et le relier aux cartes. Chaque carte
lit avec les droits de qui regarde ; celle dont la donnée n'est pas lisible dit « Donnée
inaccessible », et une ligne d'un tableau ouvre sa fiche. « Partager », pour qui construit la
base, invite à la base ou donne un lien vers ce seul tableau (chapitre 18 §2.5), lu en lecture
seule avec les droits de qui l'a publié. Une question n'est pas une requête enregistrée (§1.7) :
elle vit dans les tableaux de bord, avec sa visualisation.

Chacun enregistre ses questions, que lui seul voit ; qui construit la base les partage avec
toute la base ou avec des groupes — les trois portées des requêtes enregistrées (§1.7), et le
même dialogue « Nom et partage ». Un tableau de bord ne cite qu'une question de toute la base :
une autre y entre recopiée dans la carte. Le menu d'une question de la liste — clic droit, ou
« ⋯ » au survol — l'ouvre, l'ouvre dans un onglet de l'espace de travail, change son nom et sa
portée, ou la supprime ; « Nouvelle question » et « Nouvelle question SQL », au « + » de la
barre d'onglets et dans le menu de la base, en ouvrent une dans un onglet. Un onglet de question
garde ce qu'on y a laissé, modifications comprises.

**La galerie de modèles** (chapitre 20) s'ouvre du dialogue « Nouvelle base » et d'un
projet vide. En tête, une phrase à l'IA — « Décrivez ce que vous voulez gérer » — ; à
gauche, les catégories ; au centre, les modèles, chacun avec son icône, son résumé, ses
comptes et un badge « IA » s'il a des champs calculés par l'IA. Un modèle choisi se lit en
entier — tables et champs, relations, vues, tableaux de bord, automatisations, lignes
d'exemple, consignes IA — avant « Créer la base », qui demande le libellé et, s'il y a des
champs IA, le consentement ; l'avancement de la construction s'affiche étape par étape. La
proposition de l'IA se lit de la même façon, avec ce qui a été retiré, et s'affine par une
nouvelle phrase. Un administrateur y importe un modèle JSON et retire ceux de l'instance ;
chaque modèle se copie ou se télécharge en JSON. Le menu d'une base propose « Enregistrer
comme modèle ».

### 5.6 Intégrations et tables synchronisées

L'entrée « Intégrations » de la barre latérale — montrée à qui construit la base
(`manage_schema`), absente sinon — ouvre celles de la base courante (chapitre 19) : les
connexions Slack — ajouter, tester, supprimer —, les tables synchronisées avec leur
source, leur rythme, leur dernière synchronisation et ce qu'elle a changé, et comment voir
une vue dans Google Agenda. Le dialogue de partage public d'une vue en lecture donne
l'adresse de son API (la source d'une table synchronisée d'une autre base), et, pour une
vue calendrier ou chronologie, celle de son flux iCalendar. Une table synchronisée porte
un badge « Synchronisée » dans son en-tête ; la grille n'y propose ni nouvelle ligne, ni
suppression, ni édition de cellule — le méta ne lui donne que `read`.

---

## 6. L'éditeur de schéma

### 6.1 Ce qu'il montre

L'éditeur lit `GET /meta/bases/{base}` et ne voit donc que ce que l'acteur voit. Les états
du catalogue sont rendus en trois affichages : **en préparation** (`pending`, `building`,
`not_valid`, `validating`), **actif** (`active`), **en retrait** (`relegated`, `retired`,
`dropping`, `dropped`). Seul un objet actif est éditable ; un objet en préparation
n'apparaît ni dans la grille ni dans la vue détail.

### 6.2 Créer et modifier une table, un champ

La création d'une table demande un **libellé**. Le nom physique dérivé est **affiché avant
validation** et figé ensuite : c'est ce nom que l'utilisateur écrira en SQL.
`SLUG_FALLBACK_APPLIED` s'affiche comme une information, jamais comme une erreur ;
`NAME_COLLISION_UNRESOLVED` et `PHYSICAL_NAME_TAKEN` demandent un autre libellé.

Un champ demande un type, puis seulement les drapeaux que ce type accepte : l'écran
n'affiche pas d'option inapplicable. Un texte court de plus de 500 caractères de longueur
maximale n'a ni « triable » ni « unique », avec la raison affichée ; la précision et
l'échelle d'un nombre sont annoncées, à la création, comme non modifiables ensuite.

La **colonne d'affichage** se choisit parmi les types éligibles. Conformément à A15,
supprimer logiquement le champ désigné est refusé par `DISPLAY_FIELD_IN_USE` : l'écran
propose d'en désigner un autre, ou aucun, et **ne bascule jamais tout seul**. L'absence de
colonne d'affichage est un état valide, présenté comme tel.

La **description** est proposée à côté du libellé à la création d'une base, d'une table,
d'un champ et d'un lien, et **jamais exigée**. C'est une zone de texte simple qui dit à
quoi sert l'objet, non comment il s'appelle, et dont l'aide dit qui la lira : la
documentation et les agents. Elle est du **texte brut** : ni mise en forme ni aperçu, et
un saut de ligne reste un saut de ligne. Un compteur n'apparaît qu'à l'approche des
1 000 caractères — sur une zone presque toujours à moitié vide, il ne serait que du
bruit — et le formulaire refuse d'envoyer un texte qu'il sait trop long ; c'est pourtant
le serveur qui tranche : `TEXT_TOO_LONG` s'affiche à côté de la zone concernée, avec la
borne, jamais en « trop long » sans dire quoi, et le texte saisi est conservé.
*Alternative écartée* : la rendre obligatoire — on obtiendrait des descriptions qui
répètent le libellé, pire qu'un vide, qui dit honnêtement que personne n'a rien écrit.

Elle se modifie ensuite **en place**, là où elle se lit : au-dessus des champs pour une
table, sur la ligne du champ pour un champ, dans la fenêtre de modification pour une
base. Un clic ouvre la zone ; `Ctrl+Entrée` ou un clic ailleurs enregistre, `Échap`
renonce, et un texte inchangé ne fait aucun aller-retour. L'enregistrement est un
`PATCH` d'une seule ligne de catalogue, sans récapitulatif ni migration (§6.4) ; vider la
zone efface la description. Un refus laisse la zone ouverte, la raison du serveur à côté :
le texte tapé n'est jamais jeté. Les colonnes système ont une description fixe, montrée
et jamais modifiable. Le changement gagne la documentation générée, la spécification
OpenAPI et le commentaire de la colonne en SQL sans qu'on republie rien (chapitre 06
§1.1).

**Modifier un champ.** Chaque champ non système porte un bouton « Modifier » qui ouvre une
fenêtre : le **libellé**, le type (affiché, jamais proposé : le changer est une copie de
toute la colonne, chapitre 03, et non un réglage), et pour une liste de choix, ses **choix**.
Renommer ne touche que le catalogue : le nom de la colonne reste celui que voit `psql`, et
la fenêtre le dit. Les descriptions continuent de se modifier en place, sur la ligne.

**L'éditeur de choix** sert à la création comme à la modification. Une ligne par choix :
un **libellé**, un bouton d'**apparence**, la **valeur stockée** en légende, et deux
flèches pour l'ordre — pas de glisser-déposer, qui n'aurait pas d'équivalent au clavier.
La valeur d'un choix nouveau est **dérivée du libellé** (slug ASCII, `_2`, `_3` si un autre
l'a prise) et montrée avant l'envoi ; celle d'un choix existant est affichée **verrouillée**,
parce que la renommer réécrirait les données de la table (chapitre 04 §3). Entrée dans un
libellé ajoute une ligne. L'apparence s'ouvre dans une fenêtre flottante : une **couleur**
quelconque (treize teintes proposées, le sélecteur du navigateur pour toute autre, donc
n'importe quel hexadécimal), puis un **pictogramme** de la bibliothèque d'icônes de
l'interface — un jeu restreint, cherchable par des mots français (« urgent » trouve la
flamme) — **ou** une **image**, jamais les deux. Une image choisie dans un fichier est
réduite à 64 pixels puis ré-encodée avant l'envoi (32 si elle ne tient pas encore) : elle est
gardée dans le catalogue et voyage avec chaque lecture de la base, elle doit rester petite ;
une image vectorielle ressort en pixels, ce qui la prive de tout script. Une adresse `https`
est acceptée à la place d'un fichier.

**La même liste, en JSON.** Sous les lignes, une zone de texte porte la liste entière. Le
bouton **Copier** la place dans le presse-papiers et devient, deux secondes, une coche
« Copié » : c'est la confirmation qu'un clic silencieux ne donnerait pas. Coller une liste
dans la zone **remplace** les lignes aussitôt ; le format accepté est celui que produit
l'éditeur, une simple liste de textes (`["Actif", "Inactif"]`) ou la réponse de l'API
(`{"options": […]}`). Un JSON invalide affiche sa raison sous la zone et **laisse les
lignes telles quelles**. Une valeur collée qui existe déjà au catalogue reste verrouillée.

**Ce que le serveur refuse, l'écran le dit.** L'envoi est un `PUT` de la liste entière
(chapitre 08) ; retirer un choix que des lignes portent encore revient en `OPTION_IN_USE`
avec le décompte par valeur, et la fenêtre reste ouverte sur la liste telle qu'elle était
saisie. Le renommage et les choix sont deux appels : un libellé accepté reste affiché même si
les choix qui suivent sont refusés.

### 6.3 Créer un lien

| Réglage | Écran |
|---|---|
| Table cible | Tables vivantes de la **même base**. Une cible hors base n'est pas listée ; une tentative par une autre voie rend `LINK_CROSS_DATABASE` |
| Obligatoire | Cocher désactive `set_null`, avec la raison affichée |
| À la suppression | `restrict` par défaut, `set_null`, `cascade` |
| `cascade` | N'apparaît que pour un porteur du droit de gestion du schéma, avec confirmation saisie. L'écran énonce que la suppression d'une ligne cible supprimera les lignes qui la référencent, **y compris lors d'une suppression faite directement en SQL** (A14), et que l'effet est récursif |
| Description | Facultative, comme celle d'un champ (§6.2). C'est là qu'on dit ce que le lien signifie — « le client facturé » — et non ce que le nom de la colonne dit déjà : « un lien vers Clients » |
| Nom de la colonne | **Restitué avant validation** (A7) |

Le dernier point est un comportement d'interface à part entière. L'écran affiche le nom
retenu — `<table_cible>_id`, ou le slug du libellé du champ suffixé `_id` si le premier est
pris, ou en dernier recours un suffixe numérique — et le montre dans une requête d'exemple :

```sql
SELECT f."numero", c."raison_sociale"
FROM "b_t4z56fq_crm"."factures" f
JOIN "b_t4z56fq_crm"."clients" c ON c."_id" = f."clients_id";
```

Ce nom est figé à la création, réaffiché dans la fiche du champ, dans la documentation
générée et dans les réponses de l'API.

### 6.4 Ce qui déclenche une migration

| Sans migration (catalogue seul) | Avec migration |
|---|---|
| Libellé et description d'une base, d'une table ou d'un champ ; position d'une table ou d'un champ | Création, suppression ou conversion d'une table ou d'un champ |
| Désignation de la colonne d'affichage | Obligatoire, unique, triable, recherchable |
| Ordre et libellé des options d'une liste | Valeur d'une option, longueur maximale, bornes, valeur par défaut |
| `expose_to_agents`, permissions et rôles | Cible ou comportement de suppression d'un lien ; création ou modification d'une formule |

Tout réglage de la colonne de droite ouvre un **récapitulatif avant validation** : objets
touchés, pré-contrôles qui seront exécutés, et l'avertissement de verrou quand le moteur
l'annonce pour une table volumineuse. Aucune migration ne part d'un simple basculement
d'interrupteur.

Modifier une description réécrit aussi le `COMMENT ON` de la table ou de la colonne, dans
la même transaction (chapitre 06 §1.1) : c'est un énoncé et non un plan, donc un réglage
de la colonne de gauche, sans récapitulatif.

### 6.5 Une opération longue

Une opération de structure est un plan à plusieurs étapes (A11), dont l'état vit au
catalogue et non dans la page. L'écran affiche le statut de la migration — `proposed`,
`approved`, `applying`, `applied`, `failed`, `interrupted` — et l'étape en cours sur le
nombre d'étapes : « étape 4 sur 6 — validation de la contrainte, en cours depuis 2 min ».
**Aucune barre de progression en pourcentage** : une validation de contrainte ou une
création d'index concurrente n'a pas d'avancement observable, et une barre qui avance au
hasard est un mensonge d'interface.

Pendant ce temps, l'écran reste utilisable et la table concernée passe en lecture seule
dans la grille, sous le bandeau `TABLE_MIGRATING`. Fermer l'onglet n'annule rien. Un
statut `failed` affiche l'étape et le refus nommé — jamais le message PostgreSQL brut, que
l'API ne renvoie pas. Un statut `interrupted` propose la reprise.

### 6.6 Afficher un refus nommé

Un refus nommé n'est jamais un bandeau rouge seul. Il porte l'échantillon quand le moteur
en fournit un, et **exactement** les résolutions que le moteur propose — aucune inventée
par l'interface.

| Code | Écran |
|---|---|
| `TABLE_REFERENCED` | Tableau des champs lien entrants : table source, champ, comportement à la suppression ; chaque ligne ouvre le champ concerné. L'action est « supprimer ces champs d'abord », jamais « forcer » |
| `DISPLAY_FIELD_IN_USE` | « Ce champ est la colonne d'affichage de la table. » Deux actions : en désigner un autre, ou n'en désigner aucun |
| `LINK_ORPHAN_VALUES` | Décompte total et jusqu'à 50 lignes fautives : valeur d'affichage de la ligne source, valeur orpheline. Deux actions : annuler, ou mettre à `NULL` — écriture de masse reconfirmée par le décompte. Un bouton ouvre ces lignes dans la grille, filtrées par `_id` |
| `OPTION_IN_USE` | Décompte des lignes portant l'option. Deux actions : archiver, ou remplacer en masse |
| `LENGTH_VALUES_EXCEEDED` | Échantillon des valeurs trop longues. Deux actions : annuler, ou tronquer |
| `MIGRATION_TOO_LARGE` | « Cette opération touche plus de dix tables. » Invitation à la découper |

---

### 6.7 Importer un fichier, et le menu d'une table

**Le menu d'une table.** Dans la barre latérale, un clic droit sur une table ouvre son menu
— *Ouvrir*, *Importer…*, *Supprimer la table* — et un « ⋯ » au survol ouvre les mêmes trois
entrées : le clic gauche reste ce qu'il était, ouvrir la table, et un écran tactile n'a pas de
clic droit. *Supprimer* mène à la confirmation de §6.4 — la table est renommée, non détruite —
et non à un raccourci qui la contournerait. *Importer* mène à l'assistant ci-dessous, et le
« ⋯ » au survol le rend visible sans clic droit : **une fonction qu'un menu contextuel est seul
à offrir est une fonction que personne ne trouve.**

**L'assistant, en trois étapes** — aucune ne se saute, aucune n'envoie quoi que ce soit avant la
dernière.

1. **Le fichier.** Déposé ou choisi : CSV, TSV, TXT ou JSON, 20 Mio et 50 000 lignes au plus. Le
   séparateur d'un texte est **deviné** — le candidat qui découpe les premières lignes en un même
   nombre de cellules, plus d'une, le plus souvent, les guillemets respectés : compter les virgules
   choisirait `,` pour un export français en `;` dont les décimales s'écrivent `12,5` — et se
   change à la main. Le fichier est lu en UTF-8, puis en Windows-1252 s'il n'en est pas : c'est ce
   qu'un tableur français exporte quand personne n'a rien demandé. Un JSON est une liste
   d'objets (les clés sont les colonnes), une liste de listes, ou l'un des deux sous une clé
   `data`, `rows`, `records`, `items` ou `results`, ou encore une valeur par ligne. Les cinq
   premières lignes sont montrées, avec « la première ligne est l'en-tête » à cocher.
2. **La destination.** *Une table existante* — proposée : celle dont le menu ou la barre d'outils
   a été utilisé — ou *une nouvelle table*.
   - Pour une table existante, chaque colonne du fichier est rapprochée d'un champ, par libellé
     puis par nom, sans casse ni accents, **un champ recevant au plus une colonne** ; l'écran
     montre trois valeurs de chaque colonne, parce que « Colonne 3 » ne dit rien. Ce qui n'est pas
     rapproché n'est pas importé. Seuls les champs qu'on saisit sont proposés : **les liens et les
     formules ne s'importent pas encore.** Un champ obligatoire sans colonne est signalé, la base
     refusera les lignes où il est vide.
   - Pour une nouvelle table, le libellé est celui du fichier (`clients_2026.csv` donne
     « Clients 2026 »), et chaque colonne devient un champ dont le **type est deviné d'après toutes
     ses valeurs** — une seule valeur étrangère dans mille nombres fait un texte, ce qui est la
     réponse honnête ; `0` et `1` seuls sont des nombres et non une case à cocher ; `007` reste un
     texte — et se corrige avant l'envoi. Les champs sont créés facultatifs (chapitre 04 §1.3).
3. **L'import.** Par lots de 500, avec une progression et un bouton pour interrompre entre deux
   lots. Une nouvelle table est créée d'abord ; ses champs prennent le nom physique que le
   serveur leur a donné, dans l'ordre.

**La conversion se fait dans le navigateur, et se décide par le champ, jamais par le texte.**
`007` reste `007` dans un champ texte et devient `7` dans un champ nombre. Un nombre s'écrit
`12,5`, `1 234,56`, `1.234,56` ou `1,234.56` — le dernier séparateur est la virgule décimale
—, une date `2026-03-05` ou `05/03/2026` (**le jour d'abord** : `03/05` est le 3 mai), avec ou
sans heure, un booléen `oui/non`, `vrai/faux` ou `1/0`. Une valeur de liste de choix est
retrouvée par sa valeur stockée **ou** par son libellé, sans casse ni accents. Un jour que le
calendrier n'a pas (`30/02`) est refusé, non reporté en mars ; une heure sans fuseau est lue en
UTC, ce que dit le contrat de connexion. Une cellule vide est *rien*, quel que soit le type.

**Ce qui ne passe pas est dit avant l'envoi**, pas après : « Ligne 41, « Montant » : nombre
invalide (« douze ») », avec le compte et cinq exemples. L'import reste bloqué tant qu'on n'a pas
coché *importer quand même, en laissant ces cellules vides* — un choix qu'il faut faire, pas un
défaut qui s'applique. Les lignes sans aucune valeur dans les colonnes retenues sont comptées et
ignorées, l'API refusant une ligne vide.

**L'atomicité est celle d'un lot, et l'écran ne prétend pas mieux.** Chaque lot est tout ou rien
(chapitre 08 §3.5), mais un import est une *suite* de lots : si le troisième est refusé, les deux
premiers sont dans la table. Le refus dit alors la ligne du fichier qui l'a causé (`details.index`
du lot, retraduit en numéro de ligne, en-tête compris) et **combien de lignes sont déjà entrées**.
Faire croire à un import atomique laisserait chacun deviner l'état de sa table. *Alternative
écartée* : un seul lot de 50 000 lignes — le chapitre 08 §3.5 borne un lot à 1 000, et la
transaction tiendrait un verrou sur chacune pendant tout le temps de l'envoi.

**Ensuite.** L'import d'une table nouvelle rafraîchit la base, ouvre la table, et l'import dans
une table ouverte la recharge sans qu'on le demande : une grille qui montre ce qu'elle contenait
avant l'import est une grille dont on ne se fie plus à rien.

## 7. Les permissions vues de l'interface

La règle « absence plutôt qu'erreur » se traduit en écrans, littéralement :

| Situation | Écran |
|---|---|
| Champ invisible | La colonne n'existe pas dans la grille, le champ n'existe ni en vue détail, ni dans le menu de tri, ni dans celui de filtre, ni dans l'éditeur de schéma. **Aucune case grisée, aucune mention « champ masqué »** |
| Champ visible, non inscriptible | Affiché, non ouvrable à l'édition, indicateur discret « lecture seule ». Aucune tentative n'est envoyée |
| Table invisible | Absente de la liste. Une URL directe rend « cette page n'existe pas », identique à une faute d'URL |
| Ressource visible, action refusée | `403 ACTION_FORBIDDEN`, affiché tel quel. **Seul** cas où l'interface montre un refus d'accès |
| Base sans aucune table visible | Écran vide, indiscernable d'une base sans table |

Conséquence énoncée sans la maquiller : quand tout est masqué, l'utilisateur voit un
produit vide et n'apprend rien. C'est ce que le modèle de permissions demande. L'éditeur de
permissions porte par ailleurs les avertissements que le chapitre 05 exige — clôture des
formules, contraintes multi-colonnes, visibilité persistante de `_updated_at`.

---

## 8. États vides, de chargement et d'erreur

**Aucune donnée mockée ni en dur, et cela inclut les états vides.** Le chapitre 10 rend la
règle exécutable ; sa conséquence observable est énoncée ici : un état vide est rendu à
partir d'une réponse de l'API, jamais d'une constante du composant. Corollaire vérifiable :
**une table sans lignes et une table dont le chargement a échoué n'affichent jamais le même
écran.**

| Surface | Vide | Erreur |
|---|---|---|
| Liste des bases | « Aucune base » + création si le droit existe | Bandeau, `request_id`, réessai |
| Grille sans filtre | « Aucun enregistrement » + création si `create` | Bandeau de table |
| Grille avec filtre | « Aucun résultat pour ce filtre » + réinitialisation — **écran distinct du précédent** | Bandeau de table |
| Vue détail | Ligne sans valeur : champs vides, jamais un écran vide | Bandeau de fiche |
| Lignes référençantes | « Aucun enregistrement ne référence cette ligne » | Bandeau du bloc, le reste de la fiche restant utilisable |
| Éditeur de schéma | « Cette base ne contient aucune table » + création si le droit existe | Bandeau |

Le squelette de chargement n'apparaît qu'au-delà d'environ 500 ms et ne contient jamais de
fausses valeurs : il a la forme des colonnes connues du catalogue, pas leur contenu.

Tout bandeau d'erreur porte `error.message` tel que renvoyé, le `request_id` et un bouton
« Réessayer ». Trois automatismes, et pas d'autres : `503` avec `Retry-After` déclenche un
réessai unique à l'échéance annoncée ; `429 RATE_LIMIT_EXCEEDED` affiche l'attente jusqu'à
`X-RateLimit-Reset`, sans boucle ; `CATALOG_DRIFT_DETECTED` recharge la description de
schéma puis réessaie une fois. Un `meta.warning` n'est jamais silencieux.

---

## 9. Première tranche verticale, fin de phase 3

1. Authentification par session, choix de la base, navigation entre les tables visibles.
2. Grille en lecture : projection des champs lisibles, chargement par curseur,
   virtualisation, tri sur un champ indexé, filtres du récapitulatif normatif des types.
3. Édition en ligne des six types simples — texte court, texte long, nombre, booléen, date,
   date-heure — avec `If-Match`, le panneau de conflit et les refus nommés du §2.3.
4. Cellule de lien en lecture : valeur d'affichage, cas `masked`, désambiguïsation, clic
   vers le détail de la ligne cible ; vue détail avec ses lignes référençantes.
5. Éditeur de schéma : créer une table, créer un champ des six types simples, créer un lien
   avec sa table cible et son comportement à la suppression, restitution du nom de colonne,
   écran de migration en cours.
6. Les états vides, de chargement et d'erreur des points 2 à 5, tous obtenus de l'API sur
   une base réellement vide.

Hors tranche : sélecteur de lien avec création de la cible, liste de choix et formule dans
l'éditeur de schéma, conversion de type, écrans de permissions, historique, administration
des jetons et des webhooks, renommage physique et alias, vues de grille partagées.

## 10. Les paramètres de la personne

« Paramètres », dans le menu du profil en bas à gauche, ouvre une page à la place des
données, ouverte à tous : tout ce qui y figure porte sur la personne connectée, rien sur
les données, et rien de ce qu'un administrateur seul règle. Cinq onglets ; une adresse
les nomme (`/parametres/profil`, `securite`, `apparence`, `notifications`, `jetons` ;
l'ancienne forme `/?parametres=profil`, celle du retour d'un fournisseur, y mène encore).

| Onglet | Ce qu'on y fait | Garde |
|---|---|---|
| Profil | le nom affiché ; l'adresse de connexion (chapitre 13 §2.6) ; les fournisseurs d'identité de l'instance, liés ou non, à lier ou délier (chapitre 13 §3.5) | le nom, aucune ; l'adresse et les liaisons, une session élevée |
| Sécurité | changer le mot de passe (chapitre 13 §2.3) ; les sessions ouvertes, à fermer une à une ou toutes | le mot de passe actuel |
| Apparence | la langue (§10.1) ; le thème ; l'ordre d'une date — `25/09/2026` ou `2026-09-25` — pour les valeurs des champs date, à l'affichage et dans la saisie ; le premier jour de la semaine des calendriers, du sélecteur de date et de la frise | aucune |
| Notifications | les natures refusées (chapitre 16 §2.3), une à une | aucune |
| Jetons | les jetons d'intégration qu'on a créés, sur toutes les bases, leur dernière utilisation, et leur révocation — même sa base supprimée, même sans plus détenir `manage_tokens` | une session élevée pour révoquer |

**Le thème reste au navigateur, le reste suit le compte.** « Suivre le système » est une
propriété de l'appareil ; l'ordre des dates et le premier jour de la semaine
(`app_user.date_format`, `week_start`) suivent la personne d'un poste à l'autre. Ils sont
lus par les formateurs au moment où ils s'exécutent, et un écran de données est remonté
en revenant des paramètres : il les relit alors. La saisie accepte toujours les deux
ordres, quel que soit le choix.

Un compte sans mot de passe — il se connecte par un fournisseur — ne peut ni changer son
adresse, qui est celle du fournisseur, ni obtenir l'élévation que demandent les liaisons :
l'écran le dit au lieu d'offrir un geste qui serait refusé. Créer un jeton reste dans le
menu de la base, où sa base se choisit.

### 10.1 La langue

L'interface parle **vingt langues** (`LOCALES` de `@basedb/contracts`) : français, anglais,
allemand, espagnol, italien, portugais du Brésil, néerlandais, polonais, tchèque, suédois,
danois, norvégien bokmål, finnois, roumain, hongrois, turc, ukrainien, japonais, chinois
simplifié, coréen. Aucune ne s'écrit de droite à gauche : la mise en page ne change pas.

**Le français est la source, et la phrase française est la clé.** Chaque texte s'écrit en
place, en français, dans `$t('Enregistrer')` — avec ses valeurs, `$t('Nouveau champ dans
{table}', { table })` — ou, quand il dépend d'un nombre, `$tp(n, '{count} ligne', '{count}
lignes')`. Chaque langue a son catalogue, `apps/web/src/locales/<code>.json`, qui associe à
chaque phrase sa traduction, et à un pluriel ses formes selon les catégories CLDR de la
langue (une en japonais, quatre en polonais). Une phrase que personne n'a encore traduite
s'affiche en français, jamais vide. *Alternative écartée* : des clés abstraites
(`settings.appearance.title`) — un code illisible, et une clé à inventer à chaque phrase ;
la phrase française se lit dans le code et se retrouve dans le catalogue.

**Quelle langue.** Le choix du compte (`app_user.locale`, migration 0009 ; `null` : aucun) ;
sans choix, la première langue du navigateur que basedb parle ; sinon l'anglais. La page
est servie dans sa langue : la mise en page racine lit le cookie `basedb-locale` — le choix
du compte, retenu par le navigateur, puisque l'écran de connexion et les pages partagées se
dessinent avant que quiconque soit connu — et, à défaut, `Accept-Language`, puis place le
catalogue de cette langue dans la page, avant tout script de l'application. Un lien peut
demander une langue — `?lang=de`, comme le site public vers la démo — : le middleware
(`apps/web/src/middleware.ts`) la retient dans ce cookie comme si elle avait été choisie,
puis renvoie à la même adresse sans le paramètre, pour qu'un rechargement n'écrase pas,
plus tard, la langue du compte connecté. Changer de langue recharge la page : une table de
libellés appelle `$t` une fois, au chargement de son module. L'application ne se dessine que dans le navigateur (`I18nRoot`) : le serveur ne
connaît pas les messages du lecteur, et ce qu'il dessinerait ne correspondrait pas.

Les nombres, les dates, les noms des mois et des jours suivent la langue (`Intl`, et les
calendriers de `react-day-picker`) ; la saisie d'un nombre accepte les deux séparateurs
décimaux. L'ordre d'une date reste le choix de la personne (`dmy` ou `iso`). Les copilotes
répondent dans la langue de l'écran, que chaque appel porte (`x-basedb-locale`), et
l'ébauche de base par l'IA propose des libellés dans cette langue ; les courriels partent
dans la langue du compte, sinon dans celle de la requête. Restent en français, parce que
ce ne sont pas des textes d'interface : les noms physiques, le langage des formules (`SI`,
`ARRONDI`…), les commentaires `COMMENT ON` lus par `psql`. Les modèles de base officiels
sont servis dans la langue de l'écran, par leurs dictionnaires (chapitre 20 §3.4).

L'outillage est dans `tooling/i18n/` : `codemod.mjs` enveloppe les textes français d'un
fichier dans `$t`, `extract.mjs` dresse le catalogue source, `check.mjs` vérifie chaque
catalogue (phrases manquantes, `{valeurs}` perdues, pluriels incomplets), et
`glossary.json` fixe les termes du produit dans chaque langue.

## 11. Les adresses

L'application est une seule page, mais **l'adresse suit l'écran** : on met en favori une
table, une vue, une fiche, un tableau de bord, on colle le lien dans un message, et les
boutons précédent et suivant du navigateur ramènent où l'on était. Une adresse nomme un
**endroit**, jamais l'état où on l'a laissé : filtres, tris et largeurs restent la surcharge
du navigateur (§1.4).

| Adresse | Endroit |
|---|---|
| `/bases/<base>` | la base : l'onglet ouvert sur elle, sinon sa première table |
| `/bases/<base>/tables/<table>` | une table ; `?vue=<id>` une vue enregistrée, `?ligne=<id>` la fiche ouverte |
| `/bases/<base>/vues-sql/<id>`, `/requetes/<id>`, `/questions/<id>` | une vue SQL, une requête, une question dans un onglet |
| `/bases/<base>/tableaux-de-bord[/<id>]`, `…/questions/<id>` | les tableaux de bord, l'un d'eux, une question à côté |
| `/bases/<base>/automatisations[/<id>]` | les automatisations, l'une d'elles |
| `/bases/<base>/structure`, `historique`, `integrations`, `documentation` | une section de la base |
| `/projets/<id>` | un projet sans base |
| `/parametres/<onglet>`, `/administration/<onglet>` | les paramètres (§10), l'administration |

**Des noms plutôt que des identifiants**, là où l'objet en a un : une base s'écrit sans le
préfixe `b_<tenant>_` que partagent toutes celles de l'instance (chapitre 01 §5), une table
par son nom physique. Renommées, leurs onglets se ferment et se rouvrent sous le nouveau nom
(chapitre 06 §2), et l'ancienne adresse ne mène plus à rien. Tout est rangé sous un mot
(`/bases/…`) : une base peut s'appeler `v`, `api` ou `mcp`, qui mènent déjà ailleurs.

**Une entrée d'historique par geste.** Un clic ou une touche ouvre une entrée ; ce que
l'écran choisit ensuite de lui-même — le tableau de bord qu'il ouvre, la première table
d'une base, la fiche qu'un lien ouvre une fois sa table là — la remplace, sans quoi il
faudrait presser deux fois « précédent » pour quitter une section. L'adresse d'arrivée est
remplacée, pas empilée.

**Une adresse qui ne mène à rien** — faute de frappe, objet renommé, supprimé, ou que la
personne ne voit pas — affiche « Cette page n'existe pas » à la place des données, la
navigation restant à gauche : les deux cas se lisent à l'identique (§7). Ce qui vit à
l'intérieur d'une section — une vue, une fiche, un tableau de bord disparus — laisse
l'écran sur ce qu'il peut montrer, et l'adresse le dit.

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| L'interface est un consommateur ordinaire de `/api/v1` | Tout privilège d'interface contournerait le point d'application unique des droits | Des routes internes réservées au front |
| Six natures de vue sur une seule table `view_def`, `spec` validé par nature et reprojeté pour le lecteur | Une vue est une présentation : ni droit propre ni donnée ; ses champs suivent le masque du lecteur comme la grille | Une table par nature de vue ; des vues personnelles |
| Le kanban lit chaque colonne par sa propre requête ; calendrier et chronologie, leur fenêtre seule | Le coût reste celui d'une page par colonne ou par fenêtre, et aucune colonne ne paraît vide faute d'avoir été atteinte | Charger la table et la répartir à l'écran |
| Une vue dont le filtre cite un champ invisible pour le lecteur n'est pas montrée | Un filtre ignoré élargit le résultat (chapitre 06 §4) | Montrer la vue sans son filtre |
| Édition **optimiste**, à granularité de cellule, `If-Match` systématique | Latence perçue nulle sans état serveur ; conflit détecté par l'`ETag` | Verrou de cellule pessimiste |
| La ligne entière est remplacée par la réponse | Normalisation, formules stockées, `display` et `_updated_at` ne sont connus que du serveur | Conserver la valeur saisie : la cellule ment jusqu'au rechargement |
| `412` ouvre un panneau de rapprochement, jamais une fusion | Une fusion automatique écrase une écriture qu'on n'a pas vue | Dernier-écrivain-gagne silencieux |
| Pas de saut de page, pas de total par défaut | `offset` n'existe pas ; un `count(*)` exact est la cause banale d'une grille lente | Pagination numérotée classique |
| Texte long projeté en grille : un extrait sans balisage, le rendu au survol, l'éditeur Markdown sur place | Une colonne illisible depuis la grille n'est pas lue ; la décompression TOAST est bornée à une page | Indicateur « renseigné / vide », édition en vue détail seulement — la première décision, revue à l'usage |
| HTML riche **réassaini au rendu** | Le stock peut avoir été écrit en SQL direct, sans passer par l'assainisseur | Faire confiance au seul assainissement d'écriture |
| Création de la cible depuis le sélecteur, **réduite et conditionnelle** | Le besoin est réel ; un formulaire complet imbriqué dans une cellule en édition ne l'est pas | Formulaire complet superposé ; interdiction totale |
| Désambiguïsateur `_id` systématique dans les sélecteurs, conditionnel en cellule | Deux `display` identiques sont fréquents, la colonne d'affichage n'étant pas unique | Rendre la colonne d'affichage unique |
| Aucune barre de progression en pourcentage | Une validation de contrainte n'a pas d'avancement observable | Une barre estimée, donc fausse |
| Description facultative, en texte brut, modifiable en place sans migration ; infobulle d'en-tête et aide de la fiche | Elle documente pour qui n'a pas conçu l'objet, humains et agents ; l'exiger produirait des descriptions qui répètent le libellé | Description obligatoire ; éditeur riche |
| Un champ invisible n'a **aucune** trace à l'écran | Une case grisée est un oracle d'existence | Afficher les champs masqués en lecture seule |
| Les états vides proviennent de l'API ; largeur et ordre des colonnes non enregistrés restent locaux | Exigence du cadrage, vérifiée sur base vide ; une vue enregistrée est `view_def`, seule la surcharge locale non enregistrée reste dans le navigateur | États vides codés dans les composants ; tout état de colonne persisté au catalogue, y compris non nommé |

---

## Risques et limites connues

1. **Le temps réel est un signal, relu.** Les écritures des autres apparaissent après un
   drain, en relisant la page affichée ; deux personnes qui écrivent la même cellule dans
   la même seconde ne se voient pas avant d'écrire, et la dernière écriture l'emporte.
2. **Le désambiguïsateur en cellule dépend de la page chargée** : deux lignes homonymes
   situées dans deux pages différentes ne l'obtiennent pas.
3. **La création depuis le sélecteur n'est pas atomique** avec l'affectation du lien : une
   ligne cible peut subsister sans être référencée. C'est dit, ce n'est pas rattrapé.
4. **Une surcharge locale de colonnes ne se partage pas** et disparaît si le stockage local
   du navigateur est vidé — seule une vue enregistrée est partagée ; un brouillon de cellule
   est perdu au rechargement.
5. **Le tri par valeur d'affichage d'un lien est instable** : si la valeur change entre deux
   pages, une ligne peut être vue deux fois ou manquée. Aucun curseur ne corrige cela.
6. **Un écran vide est ambigu par construction** : rien à voir, ou rien de visible. C'est le
   prix du principe d'absence.

---

## Questions ouvertes

1. **Groupement et totaux de colonne** en grille : aucun contrat d'agrégat n'existe dans
   l'API, et un agrégat sur champ masqué est refusé.
2. **Import de fichier** : traité au §6.7 pour le CSV, le TSV, le TXT et le JSON. Restent ouverts
   les fichiers Excel et XML, l'import des champs lien (par la colonne d'affichage de leur cible),
   les lots partiels (`atomic: false`) et un import asynchrone au-delà de 50 000 lignes.

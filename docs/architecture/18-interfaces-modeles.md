# 18 — Tableaux de bord, questions, extensions et modèles

## Rôle de ce chapitre

Une base se lit aussi autrement qu'en table. Une **question** est une lecture nommée de la
base — combien de tâches en retard, le chiffre d'affaires par mois, qui porte quoi — construite
à la souris ou écrite en SQL, avec la façon de la montrer ; elle s'ouvre dans les tableaux de
bord ou dans un onglet de l'espace de travail (chapitre 11 §5.5). Un **tableau de bord**
(anciennement « interface ») range des questions sur une grille, en onglets, sous des filtres
communs. Une **extension** y ajoute une page venue d'ailleurs. Un **modèle** évite de partir d'une base vide.

Trois principes :

- **ni une question ni un tableau de bord n'élargit un droit** : chaque carte lit avec les
  droits de la personne qui regarde (chapitre 05). Une question construite passe par les plans
  de lecture des routes de données ; une question SQL s'exécute en lecture seule sur le rôle
  de la personne (chapitre 11 §1.8). Une carte qui cite une table ou un champ qu'elle ne peut
  pas lire le dit, et ne montre rien — à la différence d'une vue partagée (chapitre 15 §10)
  ou d'un tableau de bord partagé par un lien (§2.5), qui lisent sur l'autorité de qui les a
  publiés ;
- **une question construite ne contient pas de SQL** : des tables par identifiant, des champs
  par nom physique, des filtres traduits dans la grammaire du chapitre 08 §4 — dont les règles
  (valeurs liées, masque du lecteur, budgets) s'appliquent donc telles quelles ;
- **pas de code tiers dans basedb** : une extension est une page affichée dans un cadre
  isolé, sans accès à la session ni aux données.

Le vocabulaire — requête, visualisation, carte, filtre, résultat — est celui de
`@basedb/contracts` (`analytics.ts`) : le noyau le vérifie et l'exécute, l'interface le
construit, et les deux calculent les mêmes dates relatives.

---

## 1. Questions

### 1.1 Ce qu'est une question

Elle appartient à une base (`_basedb.question`, chapitre 02) : un nom, une description, une
requête (`query`, jsonb), une visualisation (`visualization`, jsonb), un auteur (`created_by`)
et une portée (`audience`) — personnelle, toute la base, ou des groupes (`question_role`),
comme au chapitre 11 §1.7. Elle est de deux sortes :

| Sorte | Requête | Exécution |
|---|---|---|
| `builder` | une table source, des jointures, des filtres, des agrégats par groupes, un tri, une limite | le noyau compose une requête sur les plans de lecture du lecteur (§1.3) |
| `sql` | un `SELECT` et ses variables | le lecteur SQL de la personne, en lecture seule (§1.4) |

Une question peut aussi n'exister que dans une carte (`cards[].query`) : c'est le cas des
blocs des premiers tableaux de bord (§2.4), et de ce qu'on ajoute à un tableau sans
l'enregistrer.

### 1.2 La requête construite

```ts
{ kind: 'builder', source: '<table>',
  joins?:        [{ alias, table, kind: 'left'|'inner'|'right'|'full', left: {join?, field}, right: '<champ>' }],
  filters?:      [{ column: {join?, field}, op, values } | { expression: '<grammaire 08 §4>', join? }],
  aggregations?: [{ fn: 'count'|'distinct'|'sum'|'avg'|'median'|'min'|'max'|'stddev'|'cum_count'|'cum_sum', column? }],
  breakouts?:    [{ join?, field, unit?: 'day'|'week'|'month'|'quarter'|'year'|'hour'|'minute'|'day_of_week'|…, bin?: number|'auto' }],
  fields?:       [{ join?, field }],      // sans agrégat ni groupe : les colonnes montrées
  sort?:         [{ target: {kind:'aggregation'|'breakout', index} | {kind:'column', column}, desc? }],
  limit? }
```

Bornes (`QUERY_LIMITS`) : 4 jointures, 24 filtres, 12 agrégats, 3 groupes, 80 colonnes,
6 termes de tri, 2 000 lignes rendues. Une jointure cite une colonne de la source ou d'une
jointure déclarée avant elle ; ses deux colonnes doivent être de même famille (identifiants,
textes, nombres, dates…), et une relation multiple se joint élément par élément (`= ANY`).

Les opérateurs du constructeur (`est`, `n'est pas`, `contient`, `entre`, `période`, `avant`,
`après`, `vide`…) sont **traduits en expressions de la grammaire** puis confiés à son
constructeur : un `n'est pas` garde les lignes sans valeur (`(not f in […] or f is_null)`), une
date relative (§1.5) devient des bornes de jours, et pour une date et heure les instants où ces
jours commencent dans le fuseau du lecteur.

### 1.3 L'exécution d'une question construite

Chaque table que la requête nomme est lue **par le plan de son lecteur** (`buildPlan`, celui
d'une page de cette table), comme une sous-requête à elle :

```sql
SELECT … FROM (SELECT t."_id", t."montant", v."total"
                 FROM "b_…"."factures" AS "t" CROSS JOIN LATERAL (…) AS "v"
                WHERE ( /*predicat_lignes:factures*/ TRUE )) AS "s"
  LEFT JOIN (SELECT … FROM "b_…"."clients" AS "t"
              WHERE ( /*predicat_lignes:clients*/ TRUE )) AS "j1" ON "j1"."_id" = "s"."client"
 WHERE ( <filtres, un par un, par la grammaire> )
 GROUP BY …
```

- une sous-requête ne projette que les **colonnes lisibles** de sa table, champs calculés à la
  lecture compris ; un nom cité est résolu contre le plan avant d'être quoté : un champ masqué
  est un champ inconnu (`FILTER_FIELD_UNKNOWN`), comme dans un filtre ;
- une table d'une autre base, supprimée ou illisible répond `RESOURCE_NOT_FOUND` ;
- chaque sous-requête porte son prédicat de lignes et son marqueur (A20) ;
- une date se coupe dans le fuseau du lecteur (`AT TIME ZONE`, fuseau passé par l'écran et
  vérifié), la semaine au jour de ses préférences ; une liste de choix groupée compte une
  ligne dans chacun de ses choix (`LEFT JOIN LATERAL unnest`) ; des tranches automatiques
  lisent d'abord les bornes de la colonne, sur les mêmes filtres ;
- un cumul court le long du premier groupe, dans chaque valeur des autres (fenêtre SQL) ;
- les identifiants d'une relation reviennent avec leur **libellé** — la colonne d'affichage de
  la cible, lue avec le prédicat de la cible et seulement si le lecteur la lit.

Le résultat (`QueryResult`) donne ses colonnes — un nom stable (`statut`, `sum:montant`,
`clients.ville`), un libellé, un rôle (`dimension`, `metric`, `field`), un type, la période, la
source — et ses lignes. Sans agrégat, chaque ligne emporte l'identifiant de sa ligne source,
pour ouvrir sa fiche.

### 1.4 Les questions SQL

Une question SQL passe **toujours par le lecteur** (`sql/reader.ts`), jamais par la console :
lecture seule, rôle de la personne, ses tables et ses champs — gestionnaire compris. Une
question se pose sur un tableau que d'autres ouvrent : si elle s'exécutait avec la portée de la
console pour qui gère la base, un `DELETE` enregistré comme question s'exécuterait le jour où
un gestionnaire regarderait le tableau.

Variables : `{{nom}}` ; une partie à retirer quand une variable n'a pas de valeur, entre `[[`
et `]]`. Une variable est `text` (un littéral quoté ; plusieurs valeurs deviennent une liste,
`IN ({{x}})`), `number` (un nombre vérifié), `date` (le premier jour de la période donnée) ou
`filter` : toute une condition sur l'expression `column` que l'auteur désigne — `TRUE` sans
valeur —, pour qu'un filtre de tableau de bord réduise une question SQL comme les autres. Une
variable obligatoire sans valeur est refusée (`variable_requise`). Les valeurs sont écrites en
littéraux quotés : le texte est celui de l'auteur, exécuté avec les droits du lecteur — ce
qu'une valeur pourrait y ajouter, l'auteur aurait pu l'écrire.

### 1.5 Les dates relatives

Une expression de date (`resolveDateExpression`, partagée) couvre des jours, vus depuis le
« aujourd'hui » du lecteur : `today`, `yesterday`, `thisweek|month|quarter|year`,
`pastNunits` (les N périodes finissant par la courante), `lastNunits` (les N périodes
complètes d'avant), `nextNunits` ; un jour, un mois `2026-03`, un trimestre `2026-Q1`, une
année ; une période `début~fin`, ouverte d'un côté. C'est aussi ce qu'un clic sur un point
filtre (`periodExpression`) : un mois groupé redevient `2026-03`.

### 1.6 Visualisations

`table`, `scalar`, `trend` (la dernière période face à la précédente et à la même l'an
dernier), `progress` (vers un objectif), `gauge`, `bar`, `row`, `line`, `area`, `combo`, `pie`,
`scatter`, `funnel`, `pivot` (lignes, colonnes, valeurs, totaux) et `map` (régions de France,
départements, pays du monde ; ou points par latitude et longitude). Les réglages citent les
colonnes par leur nom stable : un réglage survit à un changement de période ou de filtre. Les
graphiques sont dessinés par echarts ; les fonds de carte sont servis par l'interface
(`apps/web/public/geo`, IGN Admin Express sous Licence ouverte, Natural Earth), jamais par
l'API.

Les réglages (`VisualizationSettings`) se rangent par famille, et chaque visualisation n'offre
que les siens :

| Famille | Réglages |
|---|---|
| Axes (`bar`, `row`, `line`, `area`, `combo`) | colonnes de l'axe et des séries, mesures ; par série une couleur, un nom, un tracé et un second axe (`combo`) ; empilement, total au-dessus des piles, valeurs, largeur des barres, tracé lissé ou en escalier, points ; ordre des catégories ; périodes vides à zéro ; titres, graduations, inclinaison, quadrillage, bornes, échelle logarithmique ; objectif |
| Secteurs (`pie`) | anneau et son épaisseur, demi-cercle, rose, total au centre ; nombre de parts avant « Autres », la plus grande d'abord ; par part une couleur et un nom ; étiquettes (pourcentage, valeur, nom, ou les deux) dessus ou à côté ; légende, sa place, ses pourcentages |
| Entonnoir (`funnel`) | ordre des étapes, étiquettes à côté, par étape une couleur et un nom |
| Chiffres (`scalar`, `trend`, `progress`, `gauge`) | mesure, comparaison, baisse favorable, objectif, bornes, légende sous le chiffre ; une couleur, et des couleurs selon la valeur |
| Tableaux (`table`, `pivot`) | colonnes montrées, leur ordre et leur nom ; barres dans les cellules ; couleurs selon la valeur, d'une cellule ou de toute la ligne ; carte de chaleur ; densité, lignes par page, numéros de ligne |
| Carte (`map`) | fond, colonne des régions ou coordonnées, teinte, noms des régions |
| Nombres (toutes) | préfixe, suffixe, décimales, abréviation (1,2 k) |

Une couleur selon la valeur est une règle (`ColorRule` : une colonne, une comparaison, une ou
deux bornes, une couleur) ; la première qui tient l'emporte (`ruleColor`). Une série, une part
ou une étape se désigne par le texte de sa valeur, comme l'écran l'affiche : son réglage la
suit d'une exécution à l'autre, quel que soit son rang.

### 1.7 Explorer

Un clic sur un point d'une question construite propose : les lignes qu'il représente, une
période plus fine, une autre répartition du même point, la valeur seule ou exclue — et, sur un
tableau de bord, le filtre relié à cette colonne réglé sur cette valeur. Chaque pas est une
question non enregistrée, calculée par l'écran à partir de la requête (`drillRows`,
`drillFiner`, `drillBy`, `drillKeep`) et exécutée comme toute autre, avec les droits du lecteur.

Quand aucun filtre du tableau n'est relié à la colonne du point, le clic propose de **filtrer
tout le tableau** par sa valeur, dès qu'au moins une autre carte lit la même colonne : un
filtre posé d'un clic (`PointFilter` — la table, le champ, la valeur ; une période pour une
date regroupée), montré dans la barre des filtres en pointillés, et appliqué à chaque carte
dont la question construite lit ce champ — par sa table source ou par une jointure — comme
une contrainte ordinaire (§2.2). Il n'est pas enregistré : il disparaît quand on le retire ou
qu'on quitte le tableau ; un autre clic sur la même colonne le remplace. Une question SQL,
qui ne dit pas d'où viennent ses colonnes, n'est pas filtrée ainsi.

---

## 2. Tableaux de bord

### 2.1 Ce qu'est un tableau de bord

Il appartient à une base (`_basedb.dashboard`) : un nom, une description, une place dans la
liste de la base, des **onglets** (`tabs`, 12 au plus), des **filtres** (`parameters`, 16 au
plus) et des **cartes** (`cards`, 60 au plus) sur une grille de **24 colonnes**, chacune à sa
place (`x`, `y`, `w`, `h` ; une rangée fait 40 px).

| Carte | Ce qu'elle montre |
|---|---|
| `question` | une question enregistrée (`question`) ou gardée dans la carte (`query`), sa visualisation propre si elle en a une, et ce que chaque filtre du tableau y filtre (`mappings`) |
| `heading` | un titre de section |
| `text` | un texte riche (`rich`) — le HTML des textes longs (chapitre 04 §2.2), 20 000 caractères —, qui peut citer des valeurs (`variables`) ; ou un texte en Markdown (5 000 caractères) |
| `embed` | une page extérieure dans un cadre isolé (§3) |

Une carte sans onglet, ou d'un onglet disparu, va dans le premier. Les cartes sont vérifiées à
l'enregistrement — leur place tient dans la grille, la question existe dans la base, la requête
cite des tables et des champs de la base, un filtre relié existe — et relues, droits compris, à
chaque affichage.

**Les valeurs qu'un texte cite.** Un texte s'écrit dans l'éditeur des textes riches et cite une
valeur par un nom entre doubles accolades, `{{chiffre_d_affaires}}` : une pastille dans
l'éditeur, la valeur à la lecture. Chaque nom (`[a-z0-9_]`, 20 au plus) est déclaré dans
`variables` :

| Variable | Ce que le texte montre à sa place |
|---|---|
| `{ name, card }` | ce que montre une carte question du tableau, sous ses propres filtres |
| `{ name, question, mappings? }` | ce que donne une question enregistrée de toute la base ; les filtres du tableau s'y relient comme à une carte (`mappings`) |
| `{ name, query, label?, visualization?, mappings? }` | ce que donne une question gardée dans le texte, comme une carte garde la sienne — ainsi se cite une question personnelle : quiconque lit le tableau lit ce que le texte exécute |
| `{ name, parameter }` | la valeur choisie d'un filtre du tableau, comme sa commande la dit |

La valeur d'une question est celle que montrerait son « Nombre » : sa première mesure, sur sa
dernière ligne ; sans mesure, la première valeur de la première ligne. Elle s'exécute avec les
droits du lecteur.

Le HTML est assaini à l'enregistrement, par le même profil que celui d'un texte long ; une
variable que le texte ne cite plus disparaît ; une question gardée est vérifiée comme celle d'une
carte ; une question inconnue ou qui n'est pas à toute la base, une carte qui n'est pas une carte
question du tableau, un filtre inconnu, un nom mal formé sont refusés (`question_inconnue`,
`carte_inconnue`, `filtre_inconnu`, `nom_invalide`). Une carte retirée — à l'écran ou par le
copilote — quitte les textes qui la citaient. Une question citée par un texte, comme une question placée, ne peut plus être
retirée à la base (`dans_un_tableau_de_bord`). La valeur lue est insérée comme du texte, jamais
comme du balisage. Un filtre ajouté se relie aux questions citées comme aux cartes ; un filtre
retiré s'en délie, et sa valeur quitte les textes qui la citaient. Un texte en Markdown — écrit
avant l'éditeur, ou par le copilote — se lit comme avant, variables comprises, et devient riche
dès qu'il est réécrit dans l'éditeur.

### 2.2 Les filtres

| Type | Valeur | Ce qu'il fait sur une colonne reliée |
|---|---|---|
| `date` | une expression de date (§1.5) | garde les lignes de la période |
| `category` | des valeurs | `est l'une de` ; `contient l'un de` sur une liste |
| `text` | un texte | `contient` (`est` sur une liste de choix) |
| `number` | des bornes, selon `operator` (`eq`, `between`, `gte`, `lte`) | compare |
| `temporal_unit` | une période (`month`…) | change la période du groupe relié |

Chaque carte relie un filtre à **une de ses colonnes** — ou à une variable, pour une question
SQL. L'écran envoie à l'exécution, par carte, les filtres qui ont une valeur (`constraints`) ;
le noyau les vérifie et les ajoute comme des filtres de la question (ou remplace la période
d'un groupe), jamais comme du texte. Une carte peut donc être filtrée par un, plusieurs ou tous
les filtres ; un filtre, piloter une, plusieurs ou toutes les cartes.

### 2.3 Qui peut quoi

| Geste | Condition |
|---|---|
| Voir les tableaux de bord d'une base | voir la base : pouvoir lire au moins une de ses tables |
| Voir une question | voir la base, et selon sa portée : son auteur, toute la base, ou les membres de ses groupes et qui gère la base |
| Exécuter une question, explorer | la voir ; la question lit avec ses droits |
| Voir une carte | pouvoir lire ce qu'elle cite ; sinon « Donnée inaccessible » |
| Enregistrer une question personnelle, la modifier, la supprimer | voir la base, en session ; son auteur |
| Partager une question (toute la base, des groupes), modifier ou supprimer une question partagée | `manage_schema` sur la base, en session |
| Construire, modifier, supprimer un tableau de bord | `manage_schema` sur la base, en session |

La liste des tableaux de bord est la même pour tous les lecteurs de la base : ce sont les cartes
qui se taisent, pas le tableau qui disparaît. **Une carte ne cite par son identifiant qu'une
question de toute la base** — quiconque voit le tableau voit ce que la carte exécute ; une
question personnelle ou de groupes y entre par son contenu (`cards[].query`). Tant qu'une carte
la cite, une question de toute la base ne peut pas redevenir personnelle ou de groupes (refus
`dans_un_tableau_de_bord`, avec les tableaux en cause). Une question SQL est réservée aux
personnes : un jeton exécute les questions construites de toute la base, pas le SQL.

### 2.4 Les blocs des premiers tableaux de bord

Les premiers tableaux de bord avaient des blocs (`number`, `chart`, `list`, `text`, `embed`) sur
trois colonnes, dans `blocks`. La migration 0005 ajoute `tabs`, `cards` et `parameters` sans
toucher aux données : tant que `cards` est nul, le noyau lit les blocs comme des cartes
(`cardsFromBlocks`) — même ordre, mêmes largeurs, même lecture, chaque bloc devenant une
question gardée dans sa carte — et les remplace au premier enregistrement. Une création peut
encore apporter des blocs : les modèles de base le font (chapitre 20). L'export d'une base en
modèle fait l'inverse pour les cartes qui s'y prêtent, et nomme les autres.

### 2.5 Partager un tableau de bord

Deux façons, proposées côte à côte par le bouton « Partager » :

- **inviter à la base** (chapitre 13) : les personnes invitées ouvrent le tableau de bord dans
  l'application, et chaque carte lit avec leurs propres droits (§2.3) ;
- **donner un lien** vers ce seul tableau de bord, comme on partage une vue (chapitre 15 §10) :
  public — quiconque a le lien, sans compte — ou réservé aux membres connectés du tenant,
  éventuellement à certains groupes. La page `/d/<jeton>` montre les onglets, les filtres et
  les cartes à leur place ; sur un écran étroit, les cartes s'empilent dans leur ordre.

Le lien ne demande **aucun droit sur la base** : ses cartes lisent sur l'**autorité de la
personne qui a publié le partage** — la dernière à l'avoir enregistré —, revérifiée à chaque
lecture. Si elle ne voit plus la base, ou si son compte est désactivé, le lien est suspendu
(`VIEW_SHARE_CLOSED`, raison `authority`) ; désactivé, il répond `VIEW_SHARE_CLOSED`
(`inactive`) ; réservé à des groupes dont le lecteur n'est pas, `VIEW_SHARE_RESTRICTED` ; pour
les membres sans connexion, `AUTHENTICATION_REQUIRED`.

Le visiteur lit **ce que le tableau montre, et rien d'autre** :

- la page reçoit la place, le titre et la visualisation des cartes, jamais leur requête ; des
  tables de la base, seulement les champs que citent les questions construites — de quoi
  mettre en forme les valeurs (`_basedb` n'en dit pas plus) ;
- une carte s'exécute **par son identifiant** ; le visiteur donne les valeurs des filtres du
  tableau, et le noyau les relie lui-même à chaque carte telles que le tableau les relie
  (`cardConstraints`). Un filtre inconnu est refusé ; une requête fournie est ignorée ;
- un texte reçoit ses mots et, des questions qu'il cite, le nom, la visualisation et les filtres
  reliés — jamais la requête ; chacune s'exécute par son nom
  (`POST /api/v1/dashboards/<jeton>/cards/<carte>/variables/<nom>`), reliée par le noyau comme
  une carte ;
- la liste d'un filtre de catégorie vient de la première colonne à laquelle il est relié, lue
  elle aussi sur l'autorité de qui publie ;
- ni exploration d'un clic, ni ligne ouverte : le résultat perd la colonne cachée qui permet
  d'ouvrir une ligne ; les personnes y sont nommées par leur nom seul.

Le secret du lien suit la règle des vues partagées : son empreinte pour le retrouver, le secret
scellé par la clé d'instance (`dashboard-share`) pour le remontrer à qui partage, jamais en
clair. Le régénérer éteint l'ancien aussitôt. L'intégration à un autre site
(`/d/<jeton>?embed=1`) n'est permise que si le partage l'autorise ; ailleurs sous `/d/`, la page
refuse tout cadre (`frame-ancestors 'none'`). Les lectures sont limitées à 600 par minute, par
adresse et par lien : une page exécute chacune de ses cartes, et de nouveau à chaque filtre.

### 2.6 Le Copilot des tableaux de bord

Le copilote du chapitre 12 §1.6, à côté des tableaux de bord : la personne demande dans ses
mots — « le chiffre d'affaires par mois », « ajoute un filtre par client », « montre-moi le
mois dernier », « qu'est-ce qui ressort de ce tableau ? » — et il répond en quelques phrases
et **propose** ; chaque proposition est une carte qui ne change rien avant son bouton.

| Action | Ce que la carte montre | Ce que le clic fait |
|---|---|---|
| `question` | La question, exécutée et dessinée dans la conversation | L'ouvre dans l'éditeur, ou l'ajoute sous les cartes de l'onglet affiché |
| `dashboard` | Les modifications, une par ligne : cartes ajoutées, modifiées, retirées, textes, filtres, onglets, nom — ou un tableau neuf | Un seul enregistrement du tableau (ou sa création) ; la carte propose ensuite de l'annuler |
| `set_filters` | Les valeurs proposées pour les filtres affichés | Les règle à l'écran ; rien n'est enregistré |

Le noyau fait de chaque proposition ce qu'un enregistrement accepterait : une question est
vérifiée contre le catalogue et **exécutée une fois avec les droits de la personne** avant
d'être montrée — son résultat reste dans l'instance ; les opérations sur un tableau
(`add_card`, `add_text`, `update_card`, `remove_card`, `add_filter`, `add_tab`, `rename`)
sont appliquées au tableau tel qu'il est, puis passées aux vérifications d'un
enregistrement. Chacune tient ou tombe seule, et ce qui tombe est dit — le modèle reçoit
une fois les raisons, la liste des colonnes réelles comprise, et corrige. Les cartes ajoutées
se rangent après celles de leur onglet, côte à côte tant que la rangée a la place ; un
filtre ajouté se relie à chaque carte dont la question a sa colonne, et les filtres déjà là
suivent une carte ajoutée par la colonne à laquelle les autres cartes les relient. Une
proposition faite sur une version du tableau ne s'applique pas à une autre : elle est à
redemander. Modifier un tableau demande `manage_schema` ; poser une question, régler les
filtres, voir la base suffit.

**Ce qu'il voit** : les tables et colonnes que la personne lit — sans celles soustraites aux
modèles tiers —, le tableau à l'écran (ses onglets, ses filtres, ses cartes et leurs
questions, l'onglet affiché), les autres tableaux et les questions enregistrées. **Ce qu'il
lit**, sur le consentement de la conversation seulement : les résultats d'une carte sous les
filtres affichés, une question de son choix, des lignes, du SQL pour qui la console est
ouverte — chaque lecture avec les droits de la personne, 50 lignes au plus, trois tours au
plus, listée sous la réponse. Sans consentement, les valeurs choisies dans les filtres ne
partent pas non plus : elles peuvent être celles d'une ligne. Une colonne soustraite aux
modèles tiers est retirée des résultats lus, une carte en SQL n'est pas lue sur une base qui
en a une, et une carte dont la question en cite une est décrite sans sa question.

---

## 3. Extensions

Une extension v1 est une carte `embed` : une page à une adresse `https`, affichée dans un
cadre `sandbox` (scripts permis, pas de navigation du cadre parent, pas d'accès à l'origine de
basedb). Aucune information de session ni aucune donnée ne lui est passée : une page qui a
besoin des données les lit par l'API avec un jeton d'intégration qui lui est propre
(chapitre 08 §11), sous la responsabilité de qui l'a construite. Une adresse `http`,
`javascript:` ou sans hôte est refusée (`REQUEST_INVALID`, raison `adresse_invalide`).

Il n'y a pas de place de marché ni de code exécuté par basedb pour le compte d'une extension :
c'est le même refus que pour les scripts d'automatisation (chapitre 17).

---

## 4. Modèles

*Décision révisée* (A30) : les modèles de base ont leur chapitre, le **20**. Ils y sont des
documents JSON publiés par le site public, importés par l'instance ou proposés par l'IA ; ils
restent appliqués par l'interface, par les routes publiques, avec les droits de qui les
applique. Leurs tableaux de bord y gardent le format des blocs (§2.4).

---

## 5. Routes

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` | `/meta/bases/{base}/dashboards` | les tableaux de bord de la base, dans leur ordre : onglets, cartes, filtres | voir la base | session, jeton |
| `POST` | `/admin/bases/{base}/dashboards` | en créer un : `{label, description?, tabs?, cards?, parameters?}` — ou `{label, blocks}` | `manage_schema` | session seule |
| `PATCH` `DELETE` | `/admin/bases/{base}/dashboards/{id}` | le modifier (`tabs`, `cards`, `parameters` remplacés en entier, `position`) ; le supprimer | `manage_schema` | session seule |
| `GET` | `/meta/bases/{base}/questions` `/{id}` | les questions que l'appelant voit, avec `audience`, `groups`, `owner`, `mine`, `editable` ; une question | voir la base | session, jeton |
| `POST` | `/admin/bases/{base}/questions` | en enregistrer une : `{label, description?, query, visualization?, audience?, group_ids?}` — personnelle par défaut | voir la base ; `manage_schema` pour la partager | session seule |
| `PATCH` `DELETE` | `/admin/bases/{base}/questions/{id}` | la modifier (sa portée comprise) ; la supprimer | son auteur si personnelle ; `manage_schema` sinon | session seule |
| `GET` | `/admin/bases/{base}/query-groups` | les groupes avec qui la partager | `manage_schema` | session seule |
| `POST` | `/query/{base}` | exécuter une question : `{question}` (telle qu'enregistrée) ou `{query}`, avec `constraints`, `timezone`, `week_start` | voir la base, et lire ce qu'elle cite | session, jeton (question construite) |
| `GET` `PUT` `DELETE` | `/admin/bases/{base}/dashboards/{id}/share` | le partage par lien : le lire ; le créer ou le changer (`{access, active, groups, can_embed}`, qui enregistre devient la personne qui publie) ; l'arrêter | `manage_schema` | session seule |
| `POST` | `/admin/bases/{base}/dashboards/{id}/share/regenerate` | un nouveau lien, l'ancien éteint | `manage_schema` | session seule |
| `GET` | `/api/v1/dashboards/{jeton}` | le tableau partagé : titre, onglets, filtres, cartes, champs montrés | le lien ; une connexion s'il est réservé aux membres | tous |
| `POST` | `/api/v1/dashboards/{jeton}/cards/{carte}` | exécuter une carte : `{values, timezone, week_start}` | idem | tous |
| `GET` | `/api/v1/dashboards/{jeton}/parameters/{filtre}/values` | les valeurs d'un filtre de catégorie | idem | tous |
| `POST` | `/ai/bases/{base}/dashboard-copilot` | un tour du Copilot des tableaux de bord : `{messages, dashboard?, tab?, values?, read_data}` ; propose, n'applique rien (§2.6) | voir la base | session seule |

`/query/{base}` est à côté de `/sql/{base}` plutôt que sous `/data/{base}/…`, où `query` serait
le nom d'une table. Une question citée par `question` s'exécute telle que son auteur l'a
enregistrée : une carte ne peut pas lui faire dire autre chose.

---

## Décisions retenues

- **Les droits du lecteur, pas ceux du constructeur** : une question est une manière de lire,
  pas une porte ; celui qui veut montrer des données à qui ne peut pas les lire partage une
  vue (chapitre 15 §10) ou le tableau de bord par un lien (§2.5), explicitement.
- **Un tableau partagé montre ses cartes, pas ses requêtes** : le visiteur choisit des valeurs
  de filtres, jamais ce qu'ils filtrent ; le noyau relie, et lit sur l'autorité de qui publie.
- **Une question construite n'est pas du SQL** : le noyau la compose sur les plans des routes
  de données, et ses filtres sont ceux de la grammaire ; aucun texte fourni n'atteint le SQL
  sans passer par un résolveur de noms ou une valeur liée.
- **Le SQL d'une question, toujours en lecture** : même pour qui gère la base.
- **Les filtres d'un tableau sont des contraintes, pas du texte** : l'écran dit « cette carte,
  cette colonne, cette valeur » ; le noyau en fait un filtre vérifié.
- **Pas de cache de résultats** : une carte coûte la requête qu'elle fait, lue à chaque
  affichage avec les droits du moment.
- **Les anciens blocs lus, pas migrés** : la migration ne réécrit aucune donnée ; le noyau
  traduit, et l'enregistrement suivant remplace.

## Risques et limites connues

- Un tableau de bord chargé fait une requête par carte, et une de plus pour les valeurs d'un
  filtre de catégorie relié à une colonne libre.
- Une question rend 2 000 lignes au plus ; le délai des requêtes de données la borne aussi.
- Pas de colonnes calculées propres à une question ni de métriques partagées entre questions.
- Une question SQL n'est pas explorable d'un clic : son résultat ne dit pas d'où viennent ses
  colonnes.
- Un tableau partagé par lien ne s'explore pas, et ses cartes ne s'exportent pas en CSV.
- Le Copilot ne modifie pas une question enregistrée : une carte dont il change la question
  la garde désormais pour elle seule. Il ne déplace pas les cartes existantes.
- Les fonds de carte couvrent la France métropolitaine et les pays du monde.
- Les modèles : voir le chapitre 20.

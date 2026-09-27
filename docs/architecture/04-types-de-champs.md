# 04 — Types de champs et projection vers PostgreSQL

## Rôle de ce chapitre

Ce chapitre est normatif sur un point unique : **comment un champ du catalogue devient une colonne PostgreSQL**. Il fixe, pour chacun des neuf types de la v1 et des trois qui s’y sont ajoutés (choix multiple, document, image), le type SQL émis, les contraintes et index générés, les paramètres exposés, la validation à l'écriture, la représentation JSON, les opérateurs de filtre, l'indexation, les plans d'évolution et les conversions. Il fixe aussi ce que devient chacun de ces objets à la suppression logique du champ.

Il réutilise sans les redéfinir : les deux alphabets, les budgets d'octets, la procédure d'allocation, les motifs de noms dérivés et le contrat SQL et de connexion du chapitre 01 ; le registre `_basedb.physical_name`, les tables d'objets, les satellites de configuration, le vocabulaire de `_basedb.physical_state` et le registre des codes d'erreur du chapitre 02. **Tout nom de table, de colonne, de contrainte ou d'état employé ici est celui du chapitre 02**, en anglais conformément à A2 ; les libellés restent côté produit.

Il ne décrit ni l'ordonnancement, le bail et la reprise des plans de migration (chapitre 03), ni la forme des réponses et des paramètres de requête (chapitre 08), ni la résolution des permissions (chapitre 05), ni la mécanique de la relégation et de la purge (chapitre 06), dont il ne fixe que la part touchant aux objets qu'un champ fabrique en base.

Le plancher est **PostgreSQL 16** (A1) : `pg_input_is_valid` rend les conversions totales (§8), `SET NOT NULL` s'adosse à une contrainte validée depuis 12, `normalize(text, NFKD)` depuis 13. Deux fonctionnalités plus récentes ne sont **pas** supposées : `ALTER COLUMN … SET EXPRESSION` (17) et `uuidv7()` natif (18). `pg_trgm`, `unaccent` et les collations ICU sont des prérequis d'installation acquis (A3) : aucun chemin de repli conditionnel n'existe dans ce chapitre.

---

## 1. Règles communes à tous les types

### 1.1 Un champ, une colonne, rien d'autre

Un champ se projette sur **exactement une colonne** de la table de sa base. Aucun type ne produit de colonne annexe, de table de débordement ou de colonne miroir. La valeur d'affichage d'un lien, le libellé d'une option de liste de choix, le format d'affichage d'un nombre sont des données de catalogue, jamais des colonnes de la table utilisateur. *Alternative rejetée* : dénormaliser la valeur d'affichage dans la table source — exigerait un déclencheur de synchronisation par table cible et créerait une seconde vérité.

Chaque colonne générée reçoit un `COMMENT ON COLUMN` dont le texte est `field.description` ou, quand il n'y en a pas, `field.label` ; la table reçoit de même un `COMMENT ON TABLE`, tiré de `table_def`. C'est la seule passerelle entre le catalogue et la base pour l'humain qui explore le schéma en SQL direct : `\d+` ne doit jamais montrer un commentaire vide là où le catalogue sait quelque chose. Le commentaire est réécrit dans la transaction de toute modification de la description (chapitre 06 §1.1), et la dérive `CAT-CMT` du chapitre 02 en vérifie la conformité. Une colonne de lien sans description porte le texte généré du §4.1 (« Lien vers Clients… ») plutôt que son libellé.

**L'ordre des champs est celui du catalogue** (`field.position`), pas celui de la relation. On le règle dans l'écran de structure, en faisant glisser les champs, ou par `PUT …/tables/{table}/fields/order` avec la liste complète des noms physiques ; un champ que la liste ne nomme pas — ajouté entre-temps — garde son rang relatif après les autres. La grille, l'API, la documentation et les agents suivent cet ordre ; les cinq colonnes système restent en tête. L'ordre des colonnes dans PostgreSQL, fixé à l'`ADD COLUMN`, ne bouge pas : le changer réécrirait la table sous verrou exclusif pour un effet purement visuel, et `SELECT *` en SQL direct garde l'ordre de création.

**Règle d'émission des littéraux, valable pour tout le DDL de ce chapitre.** Le chapitre 01 §10.2 pose l'invariant sur les *identifiants* : aucune chaîne utilisateur n'est concaténée, seuls des noms issus du registre le sont, les valeurs passent par des paramètres liés. Le DDL n'accepte cependant aucun paramètre lié. **Trois** littéraux de ce chapitre proviennent de données utilisateur : le texte d'un `COMMENT ON` (table ou colonne), les valeurs d'options dans `ck_…__enum` (§3), les constantes d'une expression de formule (§7.6). Pour ces trois, et pour eux seuls :

1. le littéral est produit par `quote_literal()` côté serveur ou par l'équivalent exact de `format('%L', …)` côté application — jamais par concaténation de guillemets simples ;
2. le caractère nul `U+0000` est refusé avant émission (`VALUE_INVALID`) : PostgreSQL ne peut pas le stocker en `text` et sa présence dans un littéral tronque la commande ;
3. le texte de commentaire est borné à **1 000 caractères** — la borne de `field.description` (chapitre 02), la même que celle du chapitre 03 §6.2 — et l'est déjà à la saisie : une description plus longue est **refusée** (`TEXT_TOO_LONG`), jamais tronquée, si bien que le générateur n'a rien à couper. Le libellé, qui sert de repli, est borné à 255 caractères (`LABEL_TOO_LONG`) ; les valeurs d'option des `ck_…__enum` (§3, chapitre 03 §6.2) et les constantes de formule (§7.6) ont leurs propres bornes ;
4. toute autre valeur est **réémise depuis sa valeur typée**, jamais recopiée depuis la saisie.

Aucun octet brut de l'utilisateur ne traverse le générateur de DDL.

### 1.2 L'empreinte physique d'un champ

Un champ fabrique en base un ensemble fini d'objets, entièrement déterminé par son `kind` et ses drapeaux. Cette liste est normative : c'est elle que la suppression logique défait (§1.11), que la réconciliation vérifie (§11) et que l'écran de schéma affiche. Chaque objet dérivé a une ligne de catalogue, un nom au registre et un état physique.

| Objet physique | Ligne de catalogue | Quand |
|---|---|---|
| Colonne | `field`, nom par `field.name_id` | toujours |
| `NOT NULL` | `field.required_state` | `field.is_required` |
| `COMMENT ON COLUMN` | `field.description`, à défaut `field.label` | toujours |
| `ck_<table>__<colonne>__not_empty` | `table_constraint`, `rule = 'not_empty'` | `short_text`, `long_text`, `select` |
| `ck_<table>__<colonne>__length` | `rule = 'length'` | `short_text`, `long_text` |
| `ck_<table>__<colonne>__range` | `rule = 'range'` | `number`, `date`, `datetime` |
| `ck_<table>__<colonne>__enum` | `rule = 'enum'`, référencée par `field_select_config.enum_constraint_id` | `select` |
| `ck_<table>__<colonne>__format` | `rule = 'format'` | `long_text` en variante riche |
| `ck_<table>__<colonne>__not_null` | `rule = 'not_null'`, **échafaudage temporaire** | passage à `is_required` (§1.3) |
| `ck_<table>__<colonne>__files` | `rule = 'files'` | `file`, `image` (§3 bis) |
| `ck_<table>__<colonne>__url` | `rule = 'url'` | `url` (§2.7) |
| `fk_<table>__<colonne>` | `table_constraint` de `kind = 'foreign_key'`, pointée par `field_link_config.fk_constraint_id` | `link` |
| `uq_<table>__<colonne>` | `table_constraint` de `kind = 'unique'` + `table_constraint_member` | unicité demandée (§1.6) |
| `ix_<table>__<colonne>` | `table_index`, `method = 'btree'` ; pour un lien, pointé par `field_link_config.fk_index_id` | `field.is_sortable`, ou champ lien (d'office) |
| `ix_<table>__<colonne>_2` | `table_index`, `method = 'gin'`, `expression_kind = 'trigram'` | `field.is_searchable` sur un champ texte |
| index partiel booléen | `table_index`, `predicate_kind = 'true'` ou `'false'` | `field_boolean_config.indexed_side <> 'none'` |

Le suffixe `<regle>` des contraintes de vérification est le **vocabulaire fermé** que le chapitre 01 §9.1 délègue ici et que porte `table_constraint.rule`. Il est arrêté à huit valeurs : `enum`, `range`, `not_empty`, `format`, `length`, `not_null`, et, venues avec leurs types, `files` (§3 bis) et `url` (§2.7). Aucune autre n'existe. La finitude du §1.7 est portée par `range`, et non par une septième règle : borner et exclure l'infini sont la même idée.

**Tous ces noms sont alloués par le registre `_basedb.physical_name`**, avec l'échappement, la répartition du budget par composant et la boucle de suffixe du chapitre 01 §9.6. Aucun nom n'est assemblé puis émis tel quel en comptant sur la troncature silencieuse de PostgreSQL à 63 octets : deux noms partageant leurs 63 premiers octets désigneraient le même objet, et le `DROP CONSTRAINT` ultérieur échouerait en `42704` au milieu d'un plan. Le cas n'est pas théorique : `ix_<table>__<colonne>` sur une colonne système d'horodatage atteint 64 octets avec un nom de table de 48 octets.

**Deux index générés sur la même colonne.** La règle de déduplication du chapitre 01 §9.2 — « une colonne ne porte au plus qu'un index généré » — s'entend *par méthode d'accès et par colonne de tête*. Un btree de tri et un GIN trigramme de recherche sont deux objets distincts qui ne se remplacent pas ; le second reçoit le nom suivant de la boucle de suffixe et `table_index.expression_kind` enregistre le rôle de chacun. En revanche, un champ à la fois unique et triable ne reçoit **que** `uq_<table>__<colonne>` : l'index adossé à la contrainte d'unicité a la même colonne de tête et sert le tri.

### 1.3 Nullabilité, obligation, chaîne vide

`NULL` signifie « non renseigné », partout, pour tous les types. `field.is_required` se projette sur `NOT NULL`, sans exception. **`is_null` se lit `"c" IS NULL`, et rien d'autre.**

**Décision : la chaîne vide n'existe pas en base.** Elle est normalisée en `NULL` à l'écriture pour tous les champs texte et liste de choix, et cette normalisation est **doublée d'une contrainte déclarative sur toute colonne texte ou liste de choix, obligatoire ou non** :

```sql
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "ck_factures__reference__not_empty" CHECK ("reference" <> '') NOT VALID;
ALTER TABLE "b_t4z56fq_crm"."factures" VALIDATE CONSTRAINT "ck_factures__reference__not_empty";
```

La poser sur les seuls champs obligatoires laisserait l'invariant faux là où il sert le plus : sur un champ facultatif, une écriture SQL directe — la promesse centrale du produit — insérerait `''`, le filtre `is_null` raterait la ligne, le tri la placerait avant toutes les autres, et `''` cohabiterait avec `NULL` pour dire la même chose. *Alternative rejetée* : distinguer la chaîne vide de l'absence, sémantiquement plus riche mais indéfendable dans une grille où l'utilisateur efface une cellule.

**Tout champ est créé nullable.** L'obligation est toujours une étape distincte, y compris à la création d'un champ sur une table peuplée : `ADD COLUMN … NOT NULL` sans valeur par défaut échouerait, et la v1 n'a pas de valeur par défaut (§1.5). La recette est celle du chapitre 02, en quatre étapes suivies par `field.required_state` :

1. pré-contrôle `SELECT "_id" FROM … WHERE "c" IS NULL LIMIT 50` ; si non vide, refus `REQUIRED_NULL_VALUES` avec l'échantillon et la proposition d'une valeur de remplissage — aucun verrou lourd n'a encore été pris ;
2. remplissage éventuel par `UPDATE … SET "c" = <littéral> WHERE "c" IS NULL`, soumis aux règles de volume du §1.10 ;
3. `ADD CONSTRAINT "ck_<table>__<colonne>__not_null" CHECK ("c" IS NOT NULL) NOT VALID`, puis `VALIDATE CONSTRAINT` dans une étape séparée ;
4. `ALTER COLUMN "c" SET NOT NULL`, qui **ne balaie pas** la table, l'échafaudage validé le prouvant, puis `DROP CONSTRAINT` de l'échafaudage.

Une ligne nulle insérée avant l'étape 3 fait échouer la validation en `23514` : l'erreur est rattrapée, le pré-contrôle rejoué pour produire l'échantillon, et le même refus nommé renvoyé. **Règle générale de ce chapitre : le pré-contrôle produit le message, la contrainte produit la garantie.** Aucune erreur PostgreSQL brute ne traverse l'API.

### 1.4 Normalisation des valeurs texte à l'écriture

Règle commune à `short_text`, `long_text` et `select`, appliquée sur tous les chemins d'écriture — API REST, MCP, UI, import — dans cet ordre exact :

1. **refus** si la chaîne contient `U+0000` (`VALUE_INVALID`) : c'est le seul octet que PostgreSQL ne peut pas stocker en `text`, et il doit produire un refus explicite, pas une suppression silencieuse ;
2. normalisation **NFC** ;
3. traitement des sauts de ligne, **paramétré par la nature du champ** : si `field_text_config.is_multiline`, `CRLF` et `CR` sont normalisés en `LF` et les `LF` conservés ; sinon, `CR` et `LF` sont remplacés par une espace ;
4. suppression de tous les autres caractères de contrôle C0, **la tabulation exceptée** ;
5. suppression des espaces de tête et de fin ;
6. chaîne vide → `NULL`.

L'étape 3 est la raison pour laquelle cette règle vit ici et non dans la sous-section « texte court » : appliquée sans distinction, elle supprimerait tous les sauts de ligne d'un champ « Notes » à la première écriture, et la mise en forme du HTML riche avec eux.

La longueur se mesure ensuite en **caractères** (`length`), l'utilisateur ne raisonnant pas en octets. Un dépassement est refusé par `TEXT_TOO_LONG`, avec la longueur reçue et la longueur maximale.

### 1.5 Valeur par défaut : hors périmètre v1

Aucune colonne du catalogue ne stocke de valeur par défaut, et aucune clause `DEFAULT` n'est émise sur une colonne de champ : le chapitre 02 écarte explicitement toute colonne d'expression par défaut de la v1. Un `DEFAULT` ne se paramètre pas dans le protocole PostgreSQL, sa valeur est concaténée dans le DDL ; l'introduire exigerait un littéral typé par satellite de type, et une automatisation — un défaut « date du jour » — pour qu'il soit utile. Les valeurs de confort proposées à la saisie sont une **pré-remplissage d'interface** (chapitre 11), pas une propriété de la colonne.

Les seules clauses `DEFAULT` du produit sont celles des colonnes système, fixées par le chapitre 02 dans « Le schéma colocalisé `_basedb_local` », qui donne l'en-tête systématique de toute table de données générée.

### 1.6 Unicité

L'unicité d'un champ est une ligne de `_basedb.table_constraint` de `kind = 'unique'` à un seul membre, nommée `uq_<table>__<colonne>` ; `field` ne porte ni `is_unique` ni état d'unicité, une contrainte pouvant être composite. L'API la restitue sous la forme booléenne attendue par les utilisateurs.

**Le plan est en deux étapes, conformément à A11 :**

```sql
-- etape 1, hors bloc transactionnel : table_constraint.state = 'building'
CREATE UNIQUE INDEX CONCURRENTLY "uq_factures__numero"
  ON "b_t4z56fq_crm"."factures" ("numero" COLLATE "und-x-icu");

-- etape 2 : l'index est adosse a la contrainte, state = 'active'
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "uq_factures__numero" UNIQUE USING INDEX "uq_factures__numero";
```

`CREATE INDEX CONCURRENTLY` ne bloque pas les écritures : c'est ce que le cadrage exige au-delà de 100 000 lignes. En contrepartie, l'index peut finir `indisvalid = false` — un doublon inséré pendant le second balayage suffit. Le constat de l'étape 2 est donc explicite : index valide → `active` ; index invalide → `table_constraint.state = 'invalid'`, `DROP INDEX CONCURRENTLY` du résidu, refus `DUPLICATE_VALUE` avec l'échantillon. Un index `invalid` continue d'être mis à jour à chaque écriture tant que personne ne le supprime : son nettoyage n'est pas optionnel, et la dérive `CAT-STATE` du chapitre 02 le signale.

Le pré-contrôle précède l'étape 1 : `SELECT "c", count(*) … GROUP BY "c" HAVING count(*) > 1 LIMIT 50`. Il produit le message, l'index produit la garantie.

L'index est **`NULLS DISTINCT`**, comportement par défaut (`table_constraint.nulls_not_distinct = false`) : plusieurs lignes sans valeur restent permises. `NULLS NOT DISTINCT` transformerait un champ facultatif unique en champ obligatoire de fait.

Sur un champ texte, l'index porte la clause de collation du §1.8 pour servir aussi le tri. La collation étant déterministe, elle ne change pas la sémantique de l'unicité : « Dupont » et « dupont » restent deux valeurs distinctes ; c'est voulu, un champ texte unique n'est pas une clé de recherche insensible à la casse. L'unicité n'est proposée sur un champ texte que si `max_length` le permet (§2.1) : un index btree refuse toute entrée dépassant environ 2 704 octets.

### 1.7 Finitude : `NaN` et les infinis n'entrent pas en base

`numeric` accepte `NaN`, `Infinity` et `-Infinity` ; `date` et `timestamptz` acceptent `infinity` et `-infinity`. Les refuser à l'entrée de l'API ne suffit pas : une écriture SQL directe les insère sans obstacle. Or `NaN` est trié au-dessus de toute autre valeur et égal à lui-même, il n'a pas de représentation JSON, il contamine tout agrégat ; `infinity` casse l'affichage et toute comparaison de bornes.

**Toute colonne `number`, `date` ou `datetime` porte donc une contrainte de finitude :**

```sql
CHECK ("montant"  > '-Infinity'::numeric     AND "montant"  < 'Infinity'::numeric)
CHECK ("echeance" > '-infinity'::date        AND "echeance" < 'infinity'::date)
CHECK ("vu_le"    > '-infinity'::timestamptz AND "vu_le"    < 'infinity'::timestamptz)
```

La forme numérique exclut aussi `NaN`, que PostgreSQL classe au-dessus de l'infini positif. La contrainte est nommée `ck_<table>__<colonne>__range` et **fusionne** la finitude et les bornes métier du type quand elles existent (§2.3) : une seule contrainte par colonne, régénérée quand les bornes changent. Le refus à l'entrée de l'API porte le code `VALUE_NOT_FINITE`.

### 1.8 Texte : collation, pliage, recherche

Trois décisions valables pour `short_text`, `long_text` et `select`.

**Collation de tri.** Tout `ORDER BY` sur un champ texte émet `COLLATE "und-x-icu"`. Un ordre qui dépend de la locale de l'instance n'est pas reproductible entre développement, test et production, et la pagination par curseur compare des bornes qui doivent être classées exactement comme l'index. Conséquence : **la collation apparaît aux trois endroits — l'index, l'`ORDER BY` et le prédicat de curseur — ou nulle part** (§1.9). La disponibilité des collations ICU est un prérequis d'installation vérifié au démarrage (A3, chapitre 10). Une divergence entre `collversion` et la version réelle lève `COLLATION_VERSION_MISMATCH` (chapitre 01 §11.2), avec la procédure à exécuter — `ALTER COLLATION "und-x-icu" REFRESH VERSION` puis `REINDEX` de tous les index portant `COLLATE "und-x-icu"` ou bâtis sur `_basedb_local.fold_v1`. Tant que la procédure n'est pas passée, ces index sont **silencieusement faux** : le symptôme est une ligne introuvable par égalité, jamais une erreur. « Immuable » veut dire « le serveur me croit », pas « stable dans le temps » ; la version d'ICU doit être épinglée dans l'image serveur, et c'est une exigence d'exploitation.

**Pliage casse et accents.** La fonction de normalisation des index d'expression vit dans `_basedb_local` (A9), avec les autres objets partagés dont les schémas de données dépendent ; aucun objet d'un schéma `b_*` ne référence `_basedb`. Le chapitre 02 en réserve l'emplacement, le corps est fixé ici :

```sql
CREATE FUNCTION _basedb_local.fold_v1(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog AS $$
  SELECT lower(
    regexp_replace(
      normalize(t, NFKD),
      U&'[\0300-\036F\1AB0-\1AFF\1DC0-\1DFF\20D0-\20FF\FE20-\FE2F]',
      '', 'g'
    ) COLLATE "und-x-icu"
  );
$$;
```

Trois points d'exécution. La classe de caractères combinants est écrite en littéral `U&`, des caractères combinants littéraux dans le source se composant visuellement avec le crochet qui les précède. `lower()` reçoit un argument **explicitement collationné** : sans cette clause, la fonction prendrait la collation par défaut de la base d'accueil, que basedb ne choisit pas, et le pliage du turc, du grec ou du lituanien différerait d'une installation à l'autre. Enfin `normalize()` n'est défini qu'en encodage UTF-8 et lève `22023` ailleurs : le contrôle d'amorçage `DB_ENCODING_NOT_UTF8` couvre ce cas.

**La fonction n'est jamais remplacée.** Un `CREATE OR REPLACE` ultérieur rendrait faux, sans aucune erreur, tous les index d'expression bâtis sur elle. Une évolution du pliage crée `_basedb_local.fold_v2`, et la migration des champs concernés reconstruit leurs index. *Alternative rejetée* : une colonne `citext` ou une collation ICU non déterministe — la collation non déterministe interdit `LIKE` et les index trigramme sur la colonne, ce qui supprimerait le filtre `contains`.

**Filtres.** `eq` et `ne` sont sensibles à la casse et aux accents ; `eq_ci`, `contains`, `starts_with` et `ends_with` passent par `_basedb_local.fold_v1`. Les métacaractères `%`, `_` et `\` du paramètre sont échappés avant liaison, et le motif est toujours un paramètre lié :

```sql
WHERE _basedb_local.fold_v1("raison_sociale")
      LIKE '%' || _basedb_local.fold_v1($1) || '%' ESCAPE '\'
```

**Recherche indexée.** Un champ dont `field.is_searchable` est vrai reçoit un index GIN trigramme sur `_basedb_local.fold_v1("c")`. `pg_trgm` est installée dans `_basedb_local`, qui suit les données (A9), et **l'opérateur de classe est qualifié**, le contrat SQL interdisant toute dépendance au `search_path` :

```sql
CREATE INDEX CONCURRENTLY "ix_factures__objet_2"
  ON "b_t4z56fq_crm"."factures"
  USING gin (_basedb_local.fold_v1("objet") _basedb_local.gin_trgm_ops);
```

### 1.9 Tri, pagination par curseur, et ce qui n'est pas indexable

**Tout tri est total** : `ORDER BY <champ> <sens>, "_id" <sens>`. Le départage systématique par `_id` est ce qui rend la pagination par curseur correcte quand la clé de tri comporte des ex æquo — sans lui, une ligne peut être vue deux fois ou jamais.

**L'ordre des `NULL` est celui de PostgreSQL** (`NULLS LAST` en ascendant, `NULLS FIRST` en descendant), et non « toujours en bas » : c'est la seule convention qu'un index `(col, "_id")` sert dans les deux sens, par parcours avant et arrière. Forcer `NULLS LAST` en descendant rendrait l'index inutilisable dans ce sens.

**Le curseur porte donc trois informations** : la valeur de la clé de tri, un drapeau de nullité de cette valeur, et l'`_id` de la dernière ligne rendue. Le prédicat s'écrit **en deux branches, jamais en comparaison de ligne** : un constructeur `ROW(...)` ne permet pas de placer une clause `COLLATE` de manière fiable, et il ne sait pas franchir la frontière des valeurs nulles. Sens ascendant :

```sql
-- borne non nulle : reste de la zone renseignee, puis toute la zone nulle
WHERE ("c" COLLATE "und-x-icu" > $1
    OR ("c" COLLATE "und-x-icu" = $1 AND "_id" > $2)
    OR "c" IS NULL)
-- borne nulle : on est deja dans la zone nulle
WHERE ("c" IS NULL AND "_id" > $2)
```

Sens descendant, symétriquement : `"c" < $1 OR ("c" = $1 AND "_id" < $2)` tant que la borne n'est pas nulle, et `("c" IS NULL AND "_id" < $2) OR "c" IS NOT NULL` une fois dans la zone nulle, qui vient en tête. L'index `("c" COLLATE "und-x-icu", "_id")` sert les deux branches dans les deux sens : c'est l'argument même du choix de l'ordre par défaut des nuls. Le format du curseur, son chiffrement et son invalidation appartiennent au chapitre 08 ; le prédicat et la collation sont fixés ici.

**Sans la clause de collation dans le prédicat, la pagination est fausse.** La comparaison utiliserait la collation de la colonne, c'est-à-dire celle de la base d'accueil — souvent une locale glibc, parfois `C` —, qui classe casse, accents, espaces et ponctuation autrement que l'`ORDER BY`. Le prédicat et le tri divergent, la pagination saute des lignes ou en répète. Un test d'intégration obligatoire compare une pagination complète page à page à un tri global sur un jeu contenant accents, majuscules, espaces et ponctuation.

**Tris non indexables.** Deux tris de ce chapitre ne peuvent être servis par aucun index : le tri par ordre métier d'une liste de choix (§3) et le tri par valeur d'affichage d'une cible de lien (§4.7). Ils imposent un `Sort` complet à chaque page, et « le jeu déjà filtré » est la table entière dans le cas nominal d'une grille ouverte sans filtre. Ils sont donc **bornés** :

1. avant d'accepter un tri non indexable, le moteur estime la cardinalité du jeu filtré — `pg_class.reltuples` quand aucun filtre n'est posé, `reltuples = -1` désignant une table jamais analysée ; estimation d'`EXPLAIN (GENERIC_PLAN)` sinon ;
2. au-delà de `sort_scan_threshold` (50 000 lignes par défaut, configurable par instance dans `_basedb.setting`), le tri est refusé avec `SORT_NOT_INDEXABLE_VOLUME`, la réponse portant l'estimation et le repli indexable proposé ;
3. le repli est, pour la liste de choix, le tri alphabétique sur la valeur stockée ; pour un lien, le tri sur la colonne de lien elle-même. L'interface bascule d'elle-même sur le repli et l'annonce.

La même borne s'applique au filtre `contains` servi par balayage sur un champ non marqué `is_searchable` : au-delà du seuil, `FILTER_NOT_INDEXABLE_VOLUME`, avec la proposition de marquer le champ recherchable.

### 1.10 Émettre du DDL sur des données existantes

**Une opération de structure est un plan à plusieurs étapes (A11), exécuté sur le pool `ddl`** (chapitre 01 §10.3). Chaque étape est une transaction ; celles qui ne peuvent pas s'exécuter dans un bloc transactionnel — `CREATE INDEX CONCURRENTLY` — empruntent le même pool hors transaction. L'ordonnancement, le bail, la reprise et la politique de réessai appartiennent au chapitre 03 ; la ligne de plan est une `_basedb.migration`, dont `step` dit où reprendre.

**Aucune étape ne laisse le catalogue et la structure physique désaccordés.** L'état intermédiaire est explicitement représenté au catalogue par `_basedb.physical_state` : `pending`, `building`, `not_valid`, `validating`, `active`, `invalid`, `dropping`, `dropped`. Une définition créée en cours de plan reste `definition_state = 'pending'` — invisible de l'API, du MCP et de la documentation générée — jusqu'à l'étape qui la bascule en `active`. C'est ce qui rend l'opération atomique **du point de vue du consommateur** alors qu'elle ne l'est pas du point de vue de PostgreSQL.

**Trois patrons, et rien d'autre.**

| Objet | Étape 1 | Étape 2 | Étape 3 |
|---|---|---|---|
| Contrainte `CHECK` ou `FOREIGN KEY` | `ADD CONSTRAINT … NOT VALID` → `not_valid` | `VALIDATE CONSTRAINT` → `validating` puis `active` | — |
| Index (btree, GIN, unique) | `CREATE INDEX CONCURRENTLY` → `building` | constat de `pg_index.indisvalid` → `active`, ou `invalid` + `DROP INDEX CONCURRENTLY` | unicité : `ADD CONSTRAINT … UNIQUE USING INDEX` |
| `NOT NULL` | échafaudage `ck_…__not_null` `NOT VALID` | `VALIDATE CONSTRAINT` | `SET NOT NULL` puis `DROP CONSTRAINT` |

`NOT VALID` n'est pas un affaiblissement : la contrainte **s'applique immédiatement à toute écriture nouvelle** (`physical_state.is_enforced`), seules les lignes antérieures restent à vérifier. C'est précisément ce qui permet de poser une clé étrangère ou une unicité sur une table volumineuse sans indisponibilité, ce que le cadrage exige au-delà de 100 000 lignes. `validate_attempts` et `next_attempt_at` de `table_constraint` portent la reprise d'une validation qui a échoué sur un verrou.

**Verrous pris, à énoncer parce qu'ils décident du moment où l'on opère :**

| Commande | Verrou | Portée | Durée |
|---|---|---|---|
| `ADD COLUMN` sans expression | `ACCESS EXCLUSIVE` | table | instantanée |
| `ADD COLUMN … GENERATED … STORED` | `ACCESS EXCLUSIVE` | table | **réécriture complète** |
| `ADD CONSTRAINT … CHECK … NOT VALID` | `ACCESS EXCLUSIVE` | table | instantanée |
| `ADD CONSTRAINT … FOREIGN KEY … NOT VALID` | `SHARE ROW EXCLUSIVE` | table source **et table cible** | instantanée |
| `VALIDATE CONSTRAINT` | `SHARE UPDATE EXCLUSIVE` (+ `ROW SHARE` sur la cible d'une FK) | table | balayage complet, **écritures permises** |
| `CREATE [UNIQUE] INDEX CONCURRENTLY` | `SHARE UPDATE EXCLUSIVE` | table | deux balayages, **écritures permises** |
| `ALTER COLUMN … SET NOT NULL` adossé à un échafaudage validé | `ACCESS EXCLUSIVE` | table | instantanée |
| `DROP CONSTRAINT`, `DROP INDEX`, `DROP COLUMN` | `ACCESS EXCLUSIVE` | table | instantanée |

Le point le plus souvent ignoré est celui de la clé étrangère : `ADD CONSTRAINT … FOREIGN KEY` prend son verrou **sur les deux tables**, y compris en `NOT VALID`. Ajouter un champ lien interrompt donc brièvement les écritures sur la table cible, souvent la plus sollicitée de la base — brièvement seulement, puisque le balayage est reporté à l'étape de validation, qui ne bloque plus.

**L'effet de file d'attente est le mode de panne numéro un des migrations DDL.** Un `ALTER TABLE` qui attend derrière une transaction longue — un rapport, une session oubliée, un curseur ouvert — se place en tête de la file des verrous et bloque à son tour **toutes** les requêtes suivantes sur la table, y compris les simples `SELECT`. La protection est le `lock_timeout` du pool `ddl`, qui fait échouer l'acquisition au bout de quelques secondes plutôt que de laisser grossir la file ; le refus `LOCK_UNAVAILABLE` du chapitre 01 porte l'identité des sessions bloquantes, lues dans `pg_locks` et `pg_stat_activity`. `lock_timeout`, court, borne l'**attente** ; `statement_timeout`, long, borne l'**exécution** — un balayage de validation a légitimement le droit de durer des minutes.

**Écritures de masse.** Trois opérations réécrivent des lignes en nombre : le renommage d'une valeur d'option (§3), la recopie d'une conversion (§8), le remplissage d'un champ rendu obligatoire (§1.3). En MVCC, réécrire chaque ligne double temporairement la taille de la table et de ses index, produit un volume de journal équivalent et empêche le `VACUUM` de récupérer quoi que ce soit avant la fin. Règle :

- en dessous de `bulk_rewrite_threshold` (1 000 000 lignes estimées), l'écriture est faite en une transaction, atomique ;
- au-delà, l'opération bascule sur un **traitement par lots avec reprise** — curseur sur `"_id"`, lots de taille fixe, progression dans `migration.step` — et n'est donc **plus atomique** ; l'utilisateur le voit avant de confirmer, avec le nombre de lignes estimé et l'espace disque temporaire requis ;
- au-delà de `rewrite_warning_threshold` (100 000 lignes), toute opération réécrivant la table entière — colonne générée créée ou modifiée (§7), changement de précision (§2.3) — est annoncée comme une opération de maintenance, une seconde copie complète de la table existant sur disque avant libération de l'ancienne ;
- **toute opération touchant les données se termine par un `ANALYZE` de la table.** Une colonne ajoutée, générée ou recopiée n'a aucune statistique : les premiers plans reposent sur des estimations par défaut, et ce sont précisément les tris et jointures non indexables du §1.9 qui en souffrent le plus.

Ces seuils bornent le **DDL et la réécriture de table**. Le volume d'historique produit par la même écriture est borné séparément par le chapitre 07, qui bascule en écriture groupée bien plus tôt ; les deux bornes se cumulent et ne se remplacent pas.

### 1.11 Ce que devient une colonne à la suppression logique du champ

Supprimer un champ est logique : il sort du catalogue et la colonne est reléguée sous le nom `zz_supprime_<AAAAMMJJ>_<nom>`, la purge faisant le `DROP` réel plus tard. Un simple renommage de colonne conserverait **tous** les objets du §1.2, avec trois conséquences inacceptables : un champ obligatoire supprimé laisserait une colonne `NOT NULL` que l'API n'écrit plus, rendant toute insertion ultérieure impossible ; un champ lien supprimé laisserait une clé étrangère fantôme continuant d'interdire la suppression de la table cible alors que le catalogue ne voit plus aucune référence (A17) ; un index unique survivant continuerait de refuser des doublons sur un champ que plus personne ne voit.

**Règle normative — refus préalables, puis démontage dans cet ordre :**

1. refus si le champ est désigné comme colonne d'affichage de sa table : `DISPLAY_FIELD_IN_USE`, sans exception et sans bascule (A15, §5) ;
2. refus si un champ formule vivant dépend de ce champ (`FIELD_USED_BY_FORMULA`, avec la liste lue dans `field_formula_dependency`) ;
3. refus si la colonne est projetée par une vue SQL d'alias de compatibilité (`COLUMN_HAS_VIEW_DEPENDENCIES`, §7.7) ;
4. `DROP CONSTRAINT` de la clé étrangère `fk_<table>__<colonne>` s'il y en a une, et `field_link_config.fk_dropped_at` renseigné ;
5. `DROP CONSTRAINT` de **toutes** les contraintes `ck_…` du champ — `not_empty`, `length`, `range`, `enum`, `format` comprises — et de `uq_<table>__<colonne>` ;
6. `DROP INDEX` de `ix_<table>__<colonne>` et de l'index trigramme éventuel ; un index resté `invalid` est nettoyé par `DROP INDEX CONCURRENTLY` ;
7. `ALTER COLUMN … DROP NOT NULL` ;
8. `ALTER TABLE … RENAME COLUMN` vers le nom de relégation, alloué par le registre ; l'ancienne ligne de registre passe à `retired`, la nouvelle est créée en `relegated` et chaînée par `previous_name_id`.

Les lignes de `table_constraint` et de `table_index` correspondantes passent à `dropping` puis `dropped` ; elles ne sont pas détruites, la réconciliation en ayant besoin. Les étapes 4 à 8 tiennent dans une seule étape de structure : ce sont toutes des commandes instantanées.

Une colonne générée de formule est reléguée **telle quelle** : son expression est conservée, ce qui est sans risque puisque ses dépendances ne peuvent pas disparaître sans passer par le refus 2. La relégation d'une table entière ne défait rien : les objets dérivés d'une table reléguée survivent sous leur nom d'origine (chapitre 01 §9.5), et la table entière disparaîtra d'un coup à la purge.

Après ces opérations, la colonne reléguée ne porte plus que son type et son nom. Elle reste lisible en SQL direct, ce qui est le but d'une suppression réversible, et n'impose plus rien à personne. L'ordonnancement, la journalisation et la purge appartiennent au chapitre 06 ; la liste des objets à défaire est fixée ici, parce que c'est ici qu'ils sont créés.

### 1.12 Écarts entre écriture par l'API et écriture SQL directe

La promesse centrale du produit étant que les données vivent dans de vraies tables exploitables en SQL, il faut dire exactement où une écriture SQL directe ne produit pas le même résultat qu'une écriture par l'API. Ce tableau, et non une phrase rassurante, est ce qui part dans la documentation générée.

| Règle | Tenue par une contrainte ? | Si écrite en SQL direct |
|---|---|---|
| Chaîne vide interdite | **oui** — `ck__not_empty` | impossible |
| Valeur non finie interdite | **oui** — `ck__range` | impossible |
| Longueur maximale | **oui** — `ck__length` | impossible |
| Valeur hors liste d'options | **oui** — `ck__enum` | impossible |
| Bornes numériques | **oui** — `ck__range` | impossible |
| Cible de lien inexistante | **oui** — `fk_…` | impossible |
| Unicité | **oui** — `uq_…` | impossible |
| Résultat d'une formule | **oui** — colonne générée | impossible d'écrire autre chose |
| Normalisation NFC, espaces de bordure, contrôles C0, sauts de ligne | non | **non détecté** : la valeur est stockée telle quelle |
| Assainissement du HTML riche | partiellement — `ck__format` bloque les formes les plus dangereuses | **détecté** par la réconciliation, qui repasse l'assainisseur sur un échantillon |
| `_created_by` / `_updated_by` | non | restent nuls, ce qui **signifie** « écriture hors application » |
| `_updated_at` | oui — déclencheur de colonnes système | mis à jour |
| Historique et événements sortants | **oui** — capture par déclencheur (A10) | produits comme pour une écriture par l'API |

Trois écarts seulement subsistent, tous sur des normalisations de confort, aucun sur une règle d'intégrité. C'est cette liste que la documentation générée publie, avec la phrase qui va avec : une écriture SQL directe est sûre ; elle n'est simplement pas normalisée.

### 1.13 Budget d'attributs d'une table

Une table PostgreSQL est limitée à 1 600 colonnes **y compris les colonnes supprimées** : `pg_attribute` conserve les entrées `attisdropped` et aucun `VACUUM`, même `FULL`, ne les récupère. Or ce chapitre consomme un numéro d'attribut à chaque modification de formule (§7.7) et à chaque conversion (§8), et le cycle de vie relègue au lieu de supprimer. Une table éditée régulièrement atteint la limite, et l'évolution suivante échoue en `54011`, message incompréhensible.

Le catalogue compte donc, pour chaque table, les attributs consommés — vivants, relégués et supprimés, lus dans `pg_attribute` lors de la réconciliation. L'écran de schéma alerte à **1 200**, et le moteur refuse toute opération consommant un attribut à **1 500**, avec `TABLE_ATTRIBUTES_EXHAUSTED` et l'explication. **Ce couple de seuils et ce code sont les seuls du document.** La sortie est une opération d'administration de compactage — recréation de la table par copie, échange de nom, recréation des contraintes et des index — rattachée à la purge par le chapitre 06.

### 1.14 Ce qui n'est jamais fait

**Aucun type ne produit de déclencheur.** Toute règle vérifiable l'est par contrainte déclarative, ou pas du tout. La liste des déclencheurs posés sur une table utilisateur est fixée par le chapitre 07, qui est normatif (A10) ; ils appellent les fonctions partagées de `_basedb_local`, jamais une fonction par table, et le vocabulaire du suffixe `<role>` du motif `tg_<table>__<role>` est celui de cette liste.

Aucun type ne produit de vue SQL : le chapitre 01 réserve les vues SQL aux alias de compatibilité. Aucun type ne lit une autre ligne que la sienne à l'écriture.

---

## 2. Les types simples

### 2.1 `short_text` — `text`

| Élément | Valeur |
|---|---|
| Type PostgreSQL | `text` |
| Contraintes | `ck__not_empty` (toujours) ; `ck__length` : `length("c") <= max_length` |
| Configuration | `field_text_config.max_length` (défaut 255, plage 1–10 000), `is_rich = false`, `is_multiline = false`, `sanitizer_profile = 'none'` |
| JSON entrée | chaîne ; `null` ou `""` effacent ; tout autre type JSON → `VALUE_INVALID` |
| JSON sortie | chaîne ou `null` |
| Filtres | voir §9, qui fait foi |
| Index | aucun par défaut ; btree `("c" COLLATE "und-x-icu", "_id")` si `is_sortable` ; GIN trigramme si `is_searchable` |

**`text` et jamais `varchar(n)`.** Les deux ont des performances identiques dans PostgreSQL ; `varchar(n)` impose une réécriture complète de la table pour réduire `n`, alors qu'un `CHECK` de longueur se supprime instantanément et se repose en une étape. La longueur maximale est une règle métier, pas une propriété du stockage.

La longueur se mesure en caractères. Aucun plafond d'octets ne s'y ajoute : en UTF-8 un point de code occupe au plus 4 octets, donc `length("c") <= max_length` implique déjà `octet_length("c") <= 4 × max_length`. Une seconde contrainte ne pourrait jamais se déclencher, et donnerait l'impression fausse qu'une protection existe.

**Indexabilité bornée par la longueur.** Un index btree refuse toute entrée dépassant environ 2 704 octets, et l'échec survient à l'écriture d'une ligne par un utilisateur — en `54000`, erreur serveur brute, ce que ce chapitre s'interdit partout ailleurs. `is_sortable` et l'unicité ne sont donc **proposés que si `max_length <= 500`** (2 000 octets au pire) ; `is_searchable` n'est pas concerné, le GIN trigramme étant insensible à cette limite. Au-delà, refus `INDEX_LENGTH_EXCEEDED` à la création du champ, à l'activation du drapeau, et à toute augmentation de `max_length` sur un champ déjà indexé. Si le tri doit rester possible au-delà, l'index porte `left("c", 500) COLLATE "und-x-icu"` et le tri se complète par `"c"` puis `"_id"` : l'index n'est alors qu'un préfiltre, et la réponse le signale.

**Réduire `max_length` sur un champ existant** est l'avantage décisif du `CHECK` sur `varchar(n)`. Séquence : pré-contrôle `SELECT "_id", length("c") FROM … WHERE length("c") > <nouveau> LIMIT 50` ; si non vide, refus `LENGTH_VALUES_EXCEEDED` avec l'échantillon et deux résolutions proposées — annuler, ou tronquer les valeurs fautives par une écriture de masse soumise au §1.10. Puis `DROP CONSTRAINT` de l'ancien `ck__length` et pose du nouveau selon le patron du §1.10, son nom étant une nouvelle allocation du registre. Augmenter la longueur ne demande aucun pré-contrôle, mais emprunte le même couple `NOT VALID` / `VALIDATE`.

**Aucune contrainte de format en v1.** Ni courriel, ni téléphone, ni code postal : `field_text_config` ne porte pas de motif de validation. Lacune assumée, renvoyée à la v2 avec le reste du vocabulaire de validation.

### 2.2 `long_text` et variante HTML riche — `text`

Même type SQL, `is_multiline = true`, `max_length` nul par défaut avec un plafond dur `ck__length` : `octet_length("c") <= 1048576`. Le plafond est ici en octets, parce que c'est le stockage qu'il protège, et non une règle métier. **Ni tri, ni unicité, ni index btree** : trier sur un champ multiligne n'a aucun sens métier et une entrée dépasserait vite la limite du btree.

La recherche, elle, est possible : un champ long marqué `is_searchable` reçoit l'index GIN trigramme du §1.8, dont il faut connaître le prix — l'index d'un corpus de notes est fréquemment plus volumineux que les données, et chaque écriture le met à jour. Sans lui, `contains` est servi par balayage et tombe sous la borne du §1.9.

**TOAST.** Une valeur dépassant environ 2 kilooctets par ligne part en stockage externe et est décompressée à chaque lecture de la colonne. *Décision révisée* : ce paragraphe excluait le texte long de toute lecture de liste. La grille le lit désormais, pour en montrer un extrait et l'éditer sur place (chapitre 11 §1.1 et §3.2) : la décompression est bornée à une page de cent lignes, et un consommateur qui n'a pas l'usage de la colonne la retire par `fields` (chapitre 08).

**Markdown, par convention d'écran.** Le texte long simple est **stocké tel qu'il a été tapé** : l'interface l'écrit et le rend en Markdown, mais la colonne ne porte ni HTML ni forme canonique, et aucune contrainte n'en vérifie la syntaxe — un texte sans balisage est un Markdown valide. Le rendu n'interprète jamais de HTML (chapitre 11 §3.2) ; c'est ce qui le distingue de la variante riche, dont le stock est du HTML assaini.

**Variante riche (`is_rich = true`, `sanitizer_profile = 'rich'`).** Le champ stocke du HTML, et l'assainissement est **à l'écriture, côté serveur, sur tous les chemins** — API REST, MCP, UI, import. *Alternative rejetée* : stocker le HTML brut et assainir à la lecture — refait le travail à chaque lecture et laisse une donnée dangereuse en base, exportable par n'importe quel consommateur SQL. Le profil `rich` est le seul défini en v1 ; `basic`, prévu par le catalogue, n'est pas exposé.

| | Autorisé |
|---|---|
| Balises | `p br strong em u s ul ol li blockquote code pre h1 h2 h3 a hr` |
| Attributs | `a[href, title, rel, target]` uniquement |
| Schémas d'URL | `http`, `https`, `mailto` — tout le reste est retiré, `javascript:` et `data:` en premier lieu |
| Forcé | `rel="noopener noreferrer nofollow"` sur tout `a[href]` |
| Interdit | `style`, `class`, `id`, tout `on*`, `img`, `video`, `iframe`, `table`, `svg`, commentaires, instructions de traitement |

`img` est exclu parce que la v1 n'a pas de gestion de fichiers : une image ne pourrait être qu'une URL externe, donc un pisteur.

L'assainisseur **réémet** le document : il l'analyse et le sérialise au lieu d'éditer la chaîne reçue. La sortie est canonique — balises fermées, attributs réduits à ceux du profil, entités minimales — et l'opération est idempotente, ce qui se teste. C'est cette forme canonique qui est stockée, et elle seule. Un document dont il ne reste rien à lire — `<p></p>`, ce que rend un éditeur vidé — est stocké `NULL`, comme tout texte vide (§1.3).

**Garde-fou contre l'écriture SQL directe.** Un humain qui écrit `UPDATE … SET description = '<script>…'` contourne l'assainisseur. La contrainte `ck_<table>__<colonne>__format` refuse les formes les plus dangereuses :

```sql
CHECK (
     "description" !~* '<\s*/?\s*(script|iframe|object|embed|style|link|meta|svg|form|img|base|frame|frameset|applet|math)\y'
 AND "description" !~* '\son[a-z]+\s*='
 AND "description" !~* 'javascript\s*:'
)
```

`\y` et non `\b` : dans une expression rationnelle de PostgreSQL, `\b` désigne le caractère retour arrière, et la limite de mot s'écrit `\y`. Écrite avec `\b`, la première branche ne refusait rien.

L'alternance couvre `img`, premier vecteur réel (`<img src=x onerror=…>`), et les deux motifs supplémentaires attrapent un attribut événementiel posé sur une balise pourtant autorisée ainsi qu'une URL `javascript:` dans un `href`. La forme canonique produite par l'assainisseur ne contient jamais aucun de ces motifs, la contrainte ne peut donc refuser qu'une écriture directe : une balise interdite est retirée (avec son contenu pour `script` et `style`), un `<` du texte devient `&lt;`, et comme la contrainte lit le texte **entier**, une phrase ordinaire qui en reproduirait un motif — « javascript: », « online = oui » — voit son deux-points ou son signe égal écrit en entité (`&#58;`, `&#61;`), identique une fois rendu. **Ce n'est pas une politique de sécurité, c'est un garde-fou** : une contrainte `CHECK` ne remplacera jamais un analyseur HTML. Deux mesures la complètent : la réconciliation repasse l'assainisseur sur un échantillon des valeurs riches et signale les divergences comme une dérive ; et l'API marque le champ `"format": "html"` dans OpenAPI comme dans la description MCP, l'interface reconstruisant ces valeurs élément par élément sur la liste du profil, sans jamais les insérer comme HTML (chapitre 11 §3.2).

**Mise en œuvre.** La variante se choisit **à la création** du champ — `"rich": true` sur `POST …/fields`, refusé hors `long_text` (`REQUEST_INVALID`, `reason: "texte_long_seul"`) — et ne se change pas ensuite : passer un texte Markdown en HTML ou l'inverse réinterpréterait chaque valeur stockée. La description de la table la signale par `"unsafe_html": true`. L'assainisseur est `sanitize-html`, seule dépendance que la variante ajoute au noyau (chapitre 10 §10) ; l'éditeur de l'interface est Tiptap (licence MIT), dont le schéma **est** le profil : ce qui ne peut pas être stocké n'est pas proposé (chapitre 11 §3.2). Un champ riche ne peut pas être calculé par l'IA (`REQUEST_INVALID`, `reason: "type_sans_ia"`) : un modèle écrit du texte, pas du HTML assaini.

#### Variables

Un texte long — simple ou riche — peut **citer une colonne de sa propre ligne** : `{{nom_physique}}`. « Livraison prévue le {{date_livraison}} à {{ville}}. »

- **La colonne garde la citation telle qu'écrite.** Le SQL direct lit `{{ville}}` : c'est le texte qu'une personne a écrit, et la valeur citée n'est dupliquée nulle part (§1.1).
- **Toute lecture du produit sert le texte avec la valeur à sa place** : API REST, MCP, vues partagées, automatisations, copilote — tous passent par la lecture de liste du noyau, qui résout les citations de la page lue. La lecture brute se demande par `variables=raw` (chapitre 08 §3.1) : c'est ce qu'ouvre un éditeur, et ce que lit la synchronisation entre environnements.
- **La valeur est celle que voit le lecteur.** Une colonne qu'il ne peut pas lire ne donne **rien** — ni sa valeur, ni son nom : la citation disparaît, exactement comme un champ masqué (chapitre 08 I3). Une citation qui ne nomme aucune colonne vivante reste telle quelle : ce n'est que du texte.
- **La valeur se lit comme à l'écran** : un lien par sa valeur d'affichage, un choix par son libellé, une personne par son nom, un booléen par « oui » / « non », une date dans l'ordre et un horodatage dans le fuseau du lecteur (réglages de son compte), un document par son nom, un texte riche cité par ses seuls mots.
- **Une seule passe, sans enchaînement** : un texte long cité dans un autre y entre privé de ses propres citations, si bien qu'aucun cycle ne peut se former.
- **Dans un texte riche, ce qui est inséré est échappé** : une valeur n'est jamais du balisage, et la valeur `<b>gras</b>` se lit en toutes lettres.

*Alternative rejetée* : remplacer les citations **à l'écriture** — le texte stocké serait lisible en SQL, mais figé à la valeur du jour de l'écriture : changer la ville n'aurait rien changé au texte, ce qui est l'inverse de ce qu'on attend d'une variable. *Alternative rejetée* : les résoudre dans l'interface seule — l'API, les agents et les vues partagées auraient servi `{{ville}}` à qui ne sait pas le lire.

Limites connues : une réponse d'écriture (`POST`, `PATCH`) rend la ligne telle que stockée, citations comprises ; un webhook porte la valeur stockée, comme toute capture par déclencheur ; et le renommage physique d'une colonne ne réécrit pas les citations qui la nomment — elles restent alors du texte, comme une citation inconnue.

### 2.3 `number` — `numeric(precision, scale)`

`numeric` et jamais `double precision` : l'arithmétique binaire fait que `0.1 + 0.2 <> 0.3`, inacceptable sur des montants. `field_number_config.precision` et `scale` (défauts 18 et 2) sont portées par le type lui-même, donc visibles dans OpenAPI et dans un `\d` en SQL direct.

Contraintes : `ck_<table>__<colonne>__range`, qui porte toujours la finitude du §1.7 et, quand `min_value` ou `max_value` est renseignée, les bornes correspondantes dans la même expression. Un dépassement de précision remonte en `22003` côté serveur, traduit en `NUMBER_OUT_OF_RANGE` avec la précision attendue.

**Précision et échelle sont figées à la création.** Les modifier est un `ALTER COLUMN … TYPE numeric(p,s)` qui réécrit la table sous `ACCESS EXCLUSIVE`, échoue en `22003` si une valeur existante ne tient plus, et **arrondit silencieusement** si seule l'échelle diminue. Le moteur ne l'expose donc pas comme un réglage : changer la précision ou l'échelle emprunte la procédure de conversion du §8, avec ses pré-contrôles — `WHERE abs("c") >= 10^(p-s)` pour la capacité, `WHERE "c" <> round("c", <nouvelle échelle>)` pour la perte de décimales — et son échantillon. L'écran de paramétrage l'énonce à la création : c'est le seul paramètre du type qui ne se change pas après coup.

`display_format` (`decimal`, `integer`, `percent`, `currency`) et `currency_code` sont **de la présentation pure** : aucun effet sur le stockage, aucun arrondi, **aucun facteur 100** pour le pourcentage. Un taux de TVA à 20 % est stocké `20.00` ou `0.20` selon la saisie ; le format n'ajoute qu'un signe. Toute autre convention serait invisible en SQL direct, donc fausse pour les consommateurs.

**JSON : les nombres sont sérialisés en chaîne, sans exception et sur toutes les surfaces.** `{"montant": "1234.50"}`. Motif : `JSON.parse` d'un consommateur JavaScript — l'UI, n8n, un script — convertit en IEEE 754 double et détruit silencieusement toute valeur au-delà de 2⁵³ ou toute échelle dépassant quinze chiffres significatifs. Une chaîne traverse intacte. En **entrée**, un nombre JSON et une chaîne sont tous deux acceptés ; la chaîne doit satisfaire `^-?\d+(\.\d+)?$`, sans séparateur de milliers ni virgule décimale. OpenAPI déclare `type: string, format: decimal`. *Alternatives rejetées* : le nombre JSON natif, plus naturel et silencieusement faux ; une règle conditionnelle selon la précision, qui donnerait deux représentations d'une même donnée selon la surface.

Index btree `("c", "_id")` si `is_sortable`. Piège énoncé par l'interface : `NULL` n'est ni supérieur ni inférieur à quoi que ce soit, un filtre `lt 100` exclut donc les lignes vides.

### 2.4 `boolean` — `boolean`

Trois états possibles en base : `true`, `false`, `NULL`. Le moteur **propose** l'obligation à la création d'un champ booléen, ce qui donne une case à cocher sans ambiguïté ; l'utilisateur peut la refuser pour obtenir un tri-état « oui / non / non renseigné ». L'obligation étant une étape distincte (§1.3) et la v1 n'ayant pas de valeur par défaut (§1.5), une insertion SQL directe omettant la colonne d'un champ booléen obligatoire échoue en `23502` — comportement attendu d'une colonne obligatoire.

JSON : `true`, `false`, `null`. **Aucune coercition** : `"true"`, `1`, `0`, `"oui"` sont refusés avec `VALUE_INVALID`. Un rappel de type à un intégrateur vaut mieux qu'une donnée fausse.

Tri : `false < true`. **Pas d'index btree** : deux valeurs, sélectivité nulle. Si l'utilisateur demande l'indexation, le moteur crée un index **partiel dont le prédicat porte l'information et dont la clé sert le curseur** :

```sql
CREATE INDEX CONCURRENTLY "ix_factures__soldee"
  ON "b_t4z56fq_crm"."factures" ("_id") WHERE "soldee";
```

Indexer `("c")` sous le prédicat `WHERE "c" = true` serait mal formé : la clé serait constante et l'index ne servirait ni tri, ni pagination, ni filtre inverse. **Le côté indexé est un paramètre du champ**, `field_boolean_config.indexed_side` (`none`, `true`, `false` ; `none` par défaut), choisi par l'utilisateur et enregistré au catalogue avec `table_index.predicate_kind` — jamais déduit de la « valeur minoritaire observée ». Une migration rejouable doit produire le même objet quel que soit l'état des données au moment où elle est jouée, et un index dont le sens change avec la distribution serait invisible à l'utilisateur comme à la réconciliation. Basculer le côté est une opération explicite.

### 2.5 `date` — `date`

`date`, pas `timestamptz`. Une date d'échéance stockée comme instant change de jour selon le fuseau du lecteur : c'est le bug classique de ce genre d'outil, et il est structurellement éliminé en n'ayant pas d'heure du tout. La présence de l'heure n'est portée que par `field.kind` (`date` ou `datetime`), jamais par un drapeau séparé ; `field_datetime_config.timezone_mode` vaut obligatoirement `utc` pour un `date`.

JSON : `"2026-09-18"` strictement, en entrée comme en sortie. Sont refusés `"18/09/2026"` (ambigu avec l'usage américain) et `"2026-09-18T00:00:00Z"` (un instant n'est pas une date). `infinity` et `-infinity` sont refusés à l'entrée par `VALUE_NOT_FINITE`, et en base par `ck__range`.

**Pas de filtres relatifs en v1.** « Aujourd'hui », « derniers N jours », « mois en cours » ne sont pas exposés : ils se calculent trivialement en dates absolues par le consommateur qui appelle l'API, ils introduiraient une dépendance à un fuseau d'utilisateur et de tenant que le cadrage ne réclame nulle part, et ils modifieraient la forme de la réponse — le serveur devant renvoyer les bornes effectivement appliquées — qui appartient au chapitre 08. **Le serveur n'a pas de notion d'« aujourd'hui ».** Les bornes de filtre sont donc toujours absolues et ISO 8601.

Index btree `("c", "_id")` si `is_sortable`.

### 2.6 `datetime` — `timestamptz`

`timestamptz` stocke un instant absolu en UTC ; il ne stocke **pas** de fuseau. `timestamp` sans fuseau serait une heure murale sans référence, incomparable entre deux lignes saisies à deux endroits. Le contrat de connexion du chapitre 01 fixe `TimeZone = UTC` sur tous les pools, ce qui rend la restitution identique dans l'API, dans les charges utiles de webhooks et dans les curseurs.

`field_datetime_config.timezone_mode` décrit **l'interprétation et l'affichage**, jamais le stockage :

| Mode | Sens | Entrée sans décalage | Affichage |
|---|---|---|---|
| `utc` | instant absolu | **refusée** (`VALUE_INVALID`) | fuseau du lecteur |
| `fixed` | heure locale d'un lieu fixe (`fixed_timezone`) | interprétée dans `fixed_timezone` | `fixed_timezone`, pour tous |

Refuser une entrée sans décalage en mode `utc` est délibéré : `"2026-09-18T14:30:00"` n'a pas de sens unique, et l'interpréter dans le fuseau du serveur produit des décalages saisonniers indétectables.

**`fixed_timezone` est validé contre `pg_timezone_names`** à l'enregistrement du champ **et** avant chaque usage, la base tzdata évoluant et un fuseau pouvant être abandonné entre les deux. Un fuseau inconnu est refusé par `TIMEZONE_UNKNOWN`, jamais laissé remonter en `22023`. La valeur n'entre jamais dans du DDL : elle n'intervient qu'à l'interprétation d'une entrée et à l'affichage, où elle est un **paramètre lié** (`… AT TIME ZONE $1`).

**Sortie : ISO 8601 UTC, suffixe `Z`, six décimales** — `"2026-09-18T12:30:00.000000Z"`. Six décimales parce que `timestamptz` a une précision microseconde : tronquer à la milliseconde rendrait le cycle lecture → écriture non idempotent, une intégration qui relit puis réécrit modifierait la donnée. *Alternative rejetée* : déclarer `timestamptz(3)`, qui aurait aligné le stockage sur JavaScript au prix d'une perte silencieuse.

Filtres et tri comme pour la date, bornes absolues comprises. Index btree `("c", "_id")` si `is_sortable`.

Piège à documenter : `extract(year from …)` sur un `timestamptz` dépend du fuseau de session. C'est la raison pour laquelle les fonctions de date des formules ne s'appliquent qu'aux champs de `kind = 'date'` (§7.3).

### 2.7 `url` — lien URL, `text`

*Ajout.* Une adresse web ou de courriel, que l'écran rend cliquable. À ne pas confondre avec la **relation** (`link`, §4), qui pointe vers une ligne d'une autre table.

| Élément | Valeur |
|---|---|
| Type PostgreSQL | `text` |
| Contraintes | `ck_<table>__<colonne>__url` : `"c" IS NULL OR (char_length("c") <= 2048 AND "c" ~* '^(https?://[^[:space:]]+|mailto:[^[:space:]@]+@[^[:space:]]+)$')` |
| Configuration | aucune : pas de satellite (`field_kind.has_config = false`) |
| JSON entrée | chaîne ; `null` ou `""` effacent ; tout autre type JSON → `VALUE_INVALID` (`adresse_url`) |
| JSON sortie | chaîne ou `null` ; `"format": "uri"`, `maxLength: 2048` dans OpenAPI |
| Filtres | ceux du texte court (§9) |
| Index | aucun par défaut ; btree si `is_sortable` |

**Deux schémas pour les liens web, un pour le courriel, et rien d'autre** : `javascript:`, `data:` ou `file:` ne franchissent ni le noyau ni la contrainte, et l'écran n'ouvre un lien que si son schéma est l'un de ces trois. **Le noyau complète une saisie évidente** avant de la vérifier : `exemple.fr/tarifs` devient `https://exemple.fr/tarifs`, `marie@exemple.fr` devient `mailto:marie@exemple.fr`. Le complément est écrit tel quel : la valeur stockée est celle qu'on lit, sans deuxième interprétation à la lecture. Une adresse de plus de 2 048 caractères, ou contenant une espace, est refusée — une URL plus longue ne passe plus dans la barre d'adresse de certains navigateurs, et une espace est la marque d'une phrase collée par erreur.

La contrainte suit le patron des autres `ck_…` : allouée au registre (règle `url`), posée à la création du champ, et juste après le `CREATE TABLE`, dans la même transaction, pour un champ créé avec sa table. Une ligne écrite en SQL direct avec une adresse sans schéma est refusée par la contrainte, là où l'API l'aurait complétée (§1.12).

### 2.8 `email` — adresse électronique, `text`

*Ajout.* Une adresse, et une seule : l'écran l'ouvre en `mailto:`.

| Élément | Valeur |
|---|---|
| Type PostgreSQL | `text` |
| Contraintes | `ck_<table>__<colonne>__email` : `"c" IS NULL OR (char_length("c") <= 254 AND "c" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')` |
| Configuration | aucune (`has_config = false`) |
| JSON entrée | chaîne, rognée, un `mailto:` collé avec elle retiré ; `null` ou `""` effacent ; sinon `VALUE_INVALID` (`adresse_email`) |
| JSON sortie | chaîne ou `null` ; `"format": "email"`, `maxLength: 254` dans OpenAPI |
| Filtres | ceux du texte court (§9) |

La règle est volontairement large — la seule preuve qu'une adresse marche est un message qui arrive — mais refuse ce qui n'en est manifestement pas une. Même patron de contrainte que `url` (règle `email`).

### 2.9 `autonumber` — numéro automatique, `bigint` identité

*Ajout.* Un numéro que la base donne à chaque ligne, dans l'ordre, et que personne n'écrit.

| Élément | Valeur |
|---|---|
| Type PostgreSQL | `bigint GENERATED BY DEFAULT AS IDENTITY` — donc `NOT NULL` d'office |
| Écriture | aucune : le type est calculé (`COMPUTED_KINDS`), hors de tout masque d'écriture ; `setFieldRequired` le refuse (`numero_automatique`) |
| JSON sortie | chaîne décimale, comme tout `bigint` ; `"format": "int64"`, `readOnly` dans OpenAPI |
| Filtres, tri | ceux du nombre (§9) |

**Ajouter un numéro automatique à une table peuplée numérote les lignes existantes**, dans l'ordre où la table les stocke, et réécrit donc la table sous `ACCESS EXCLUSIVE` — comme une formule (§7.1). `BY DEFAULT` plutôt que `ALWAYS` : un chargement en SQL direct peut reprendre des numéros existants.

### 2.10 `user` — personne, `uuid`

*Ajout.* Une personne du tenant — « assigné à ».

| Élément | Valeur |
|---|---|
| Type PostgreSQL | `uuid`, **sans clé étrangère** : aucune contrainte ne franchit la frontière de `_basedb` (A9), comme pour `_created_by` |
| JSON entrée | l'identifiant d'un utilisateur **du même tenant que la table**, non supprimé (un compte désactivé reste assignable : il nomme quelqu'un qui était là) ; sinon `VALUE_INVALID` (`personne_inconnue`) — la vérification du noyau tient lieu de clé étrangère |
| JSON sortie | l'identifiant ; `GET /meta/users` donne pour chaque membre son nom, son adresse et s'il est désactivé |
| Filtres | `eq`, `ne`, `in`, `is_null` sur l'identifiant, comme une relation |

### 2.11 Formats d'affichage

Un **format** change la lecture d'une valeur, jamais sa colonne (chapitre 02, « Un type, ou un format ? ») ; il se change par `PATCH …/fields/{champ}` avec `format`, sans migration, et `/meta` le publie dès qu'il n'est pas le format par défaut : `format: {display, currency, rating_max}`.

| Type | `display` | Lecture |
|---|---|---|
| `number` | `decimal` (défaut), `integer` | le nombre, arrondi à l'entier pour `integer` |
| `number` | `currency` | avec le symbole de `currency` (ISO 4217, `EUR` par défaut) |
| `number` | `percent` | la valeur suivie de « % » : `12.5` se lit « 12,5 % » |
| `number` | `duration` | un nombre de **secondes**, lu et saisi `h:mm` ou `h:mm:ss` |
| `number` | `rating` | des étoiles, de 1 à `rating_max` (5 par défaut, 10 au plus) |
| `short_text` | `plain` (défaut) | le texte |
| `short_text` | `phone` | un numéro, ouvert en `tel:` |
| `short_text` | `barcode` | un code, en chasse fixe, copiable |

Un format ne contraint pas la valeur : une note de 7 sur 5 reste écrite telle quelle, et l'écran la plafonne à l'affichage. Qui veut une borne la pose sur la colonne (`min_value`, `max_value`).

### 2.12 `button` — bouton, sans colonne

*Ajout.* Un bouton dans chaque ligne, qui ouvre une adresse composée avec la ligne ou lance une automatisation (chapitre 17 §4).

| Élément | Valeur |
|---|---|
| Type PostgreSQL | **aucun** : le champ n'a pas de colonne ; `field_button_config` porte son libellé, sa couleur et son action |
| Création | `POST …/fields` avec `kind: "button"` et `button: {label, color?, action, url?, automation?}` ; `action` vaut `url` (une adresse `http(s)` ou `mailto:`, qui peut citer `{{champ}}`) ou `automation` (une automatisation de la base dont le déclencheur est `button`, sur la même table) |
| JSON entrée | aucune : un bouton ne s'écrit pas (`FIELD_NOT_WRITABLE`) |
| JSON sortie | aucune : il n'apparaît pas dans les lignes ; `/meta` le décrit avec `button` |
| Filtres, tri | aucun |

---

## 3. `select` — liste de choix

**Décision : colonne `text`, valeurs contraintes par un `CHECK` régénéré**, dont la ligne de `table_constraint` est désignée par `field_select_config.enum_constraint_id`. Options rejetées :

- **Type énuméré PostgreSQL** : on ne peut pas retirer une valeur d'un `ENUM`, le renommage impose un `ALTER TYPE` global, c'est un objet partagé dont l'évolution est transverse à des tables que l'utilisateur n'a pas touchées, et chaque base utilisateur peuplerait `pg_type` de types jetables.
- **Table de référence et clé étrangère** : ajoute une table technique dans le schéma de l'utilisateur, une jointure à toute lecture, et rend `SELECT statut FROM factures` illisible. Si le besoin dépasse une liste plate — responsable, attributs métier par option — l'utilisateur crée une vraie table et un champ lien : c'est déjà l'outil, il n'a pas à être dupliqué. *Décision révisée* : cette phrase rangeait aussi les **couleurs** parmi ce qu'il fallait aller chercher dans une table. L'apparence d'une option n'est pas un attribut métier — la colonne ne la porte pas, aucune requête ne la lit — et exiger une table pour cela contraignait à déshabiller `SELECT statut FROM factures` pour habiller un écran. Elle vit donc au catalogue, voir « Apparence des options » plus bas.

La valeur stockée dans `select_option.value` est un **slug ASCII** produit par les règles du chapitre 01, `select_option.label` restant libre. `WHERE "statut" = 'en_retard'` se lit et s'écrit à la main, ce qui est la promesse du produit. Contrainte générée, dont les littéraux sont émis selon la règle du §1.1 :

```sql
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "ck_factures__statut__enum"
  CHECK ("statut" IN ('brouillon','envoye','paye')) NOT VALID;
```

S'y ajoute `ck_factures__statut__not_empty`, comme pour tout champ texte (§1.3).

### Cycle de vie des options

| Opération | Base | Lignes existantes |
|---|---|---|
| **Ajouter** une option | `DROP CONSTRAINT` puis `ADD … NOT VALID` dans une étape, `VALIDATE` dans la suivante | aucun effet ; la nouvelle contrainte est plus permissive et ne peut invalider aucune ligne |
| **Renommer le libellé** | aucune écriture | aucun effet |
| **Changer l'apparence** (couleur, pictogramme, image) | aucune écriture | aucun effet |
| **Renommer la valeur** | `UPDATE` de masse puis régénération du `CHECK` | migration de données, réservée au droit de gestion du schéma, nombre de lignes affiché avant confirmation, règles de volume du §1.10 |
| **Réordonner** | aucune écriture | change l'ordre de tri (voir ci-dessous) |
| **Supprimer une option inutilisée** | régénération du `CHECK` ; la validation remonte l'échantillon des lignes fautives s'il en reste | aucun |
| **Supprimer une option utilisée** | refus `OPTION_IN_USE` avec le décompte | aucune |

**Une seule opération, la liste entière.** L'interface édite une liste, et un JSON collé en porte une : l'API expose donc `PUT …/fields/{field}/options` (chapitre 08) qui reçoit la liste **dans l'ordre voulu** et compare aux valeurs existantes. Celles qui restent sont **mises à jour** (libellé, apparence, place) ; les nouvelles sont **ajoutées** ; les absentes sont **retirées**, ce qui est refusé (`OPTION_IN_USE`, avec le décompte par valeur) tant que des lignes les portent. La valeur d'une option n'est **jamais renommée** par cette opération : renommer, c'est retirer une valeur et en ajouter une, donc refusé tant que la première est utilisée — la migration de données du tableau ci-dessus reste un acte distinct. Quand l'ensemble des valeurs bouge, le `CHECK` est régénéré en trois temps (chapitre 03) : l'ancienne contrainte et la nouvelle `NOT VALID` dans un même énoncé, de sorte que la colonne n'est jamais sans liste ; puis `VALIDATE` hors transaction. Le retrait comptabilise les lignes **sous un verrou qui écarte les écrivains** (`SHARE ROW EXCLUSIVE`) : sans lui, une ligne écrite entre le décompte et la nouvelle contrainte porterait une valeur que la liste n'autorise plus, et `VALIDATE` la trouverait alors que l'ancienne contrainte a disparu. Ce verrou ne pèse que sur un retrait, et pour la durée d'un parcours. Quand seule l'apparence bouge, **rien** n'est émis contre le schéma de l'utilisateur.

Chaque régénération **consomme un nouveau nom de contrainte** (`ck_…__enum`, puis `_2`, `_3`…), le registre ne libérant jamais un nom. C'est visible dans les messages d'erreur PostgreSQL et c'est normal ; `field_select_config.enum_constraint_id` désigne la ligne courante, et c'est elle qui sert aux `DROP` ultérieurs.

**Supprimer une option portée par des lignes est refusé**, avec le décompte. Deux résolutions sont **proposées**, aucune n'est appliquée d'office : l'**archivage** (`select_option.deleted_at` renseigné), qui retire l'option des listes de saisie tout en la laissant autorisée par le `CHECK` tant que des lignes la portent ; ou le **remplacement de masse** par une autre option, qui est une migration de données au même titre qu'un renommage de valeur. L'archivage est la résolution recommandée, pas un effet de bord silencieux : une API qui répond « supprimé » en ayant archivé et une API qui répond `OPTION_IN_USE` sont deux contrats différents, et c'est le second qui est retenu. Retirer la valeur du `CHECK` tant que des lignes la portent invaliderait des lignes déjà écrites. Une opération d'administration retire la valeur une fois le décompte tombé à zéro.

**Tri.** L'ordre métier (`brouillon` avant `envoye` avant `paye`) est presque toujours ce que veut l'utilisateur, jamais l'ordre alphabétique. Le moteur émet :

```sql
ORDER BY array_position($1::text[], "statut") NULLS LAST, "_id"
```

`$1` est un **paramètre lié** contenant **toutes les valeurs autorisées par le `CHECK`, archivées comprises**, dans l'ordre de `select_option.position`, les archivées en fin de tableau. Une option archivée garde ainsi une place définie ; `array_position` ne peut valoir `NULL` que sur une valeur écrite en SQL direct avant la pose de la contrainte, cas où la ligne est classée en dernier. En sens descendant, la même expression est triée `DESC`, `NULLS LAST` conservé. **La règle d'ordre des nuls du §1.9 ne s'applique pas à ce tri** : elle existe pour qu'un index serve les deux sens, or ce tri n'est servi par aucun index. Il tombe donc sous la borne de volume du §1.9, le repli étant le tri alphabétique sur la valeur stockée. Figer la position dans la valeur stockée pour rendre le tri indexable n'est pas envisageable : le réordonnancement deviendrait une migration de données destructrice.

Le paramètre d'un filtre est validé contre la liste des options connues avant émission ; une valeur inconnue renvoie zéro ligne, pas une erreur.

### 3.1 `multi_select` — choix multiple

*Décision révisée* : ce paragraphe renvoyait le choix multiple en v2. Il est un **type à part entière**, pas un drapeau `is_multiple` sur `select` : le type d'un champ est immuable (chapitre 02), et un drapeau qui changerait le type physique de la colonne serait un second `kind` déguisé.

**Colonne `text[]`**, les options étant celles d'un `select` — mêmes tables (`field_select_config`, `select_option`), même apparence, même opération `PUT …/options`, même refus `OPTION_IN_USE`, le décompte se faisant **par valeur** (`unnest`). *Alternative rejetée* : une chaîne à séparateurs, qui casse le filtrage et l'intégrité. Contrainte générée :

```sql
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "ck_factures__etiquettes__enum"
  CHECK (cardinality("etiquettes") > 0 AND array_ndims("etiquettes") = 1
         AND "etiquettes" <@ ARRAY['urgent','client']::text[]) NOT VALID;
```

`<@` tient chaque élément à la liste — un élément `NULL` n'est contenu dans rien et est donc refusé. Les deux autres termes ferment ce que `<@` laisse passer : le tableau **vide**, que `NOT NULL` compterait comme « renseigné », et le tableau **imbriqué**, que `<@` aplatit. Vide s'écrit donc `NULL`, et « obligatoire » veut dire « au moins une valeur ».

**À l'écriture**, le noyau reçoit une liste JSON de chaînes (une chaîne seule vaut une liste d'une valeur), retire les doublons en gardant le premier rang, et écrit `NULL` pour une liste vide. Que chaque valeur soit dans la liste, c'est le `CHECK` qui le dit — la seule règle, celle à laquelle le SQL direct est aussi tenu.

**Filtres** : `has_any` (au moins une des valeurs, `&&`) et `has_all` (toutes, `@>`), qui prennent une valeur ou une liste, plus `is_null`. « N'en contient aucune » s'écrit `not … has_any`. Aucun des treize opérateurs de §9 n'a de sens sur une liste : `eq` comparerait le tableau entier, ordre compris. **Pas de tri** (`SORT_UNAVAILABLE`) : l'ordre de deux listes n'est pas un ordre qu'un lecteur reconnaît. Pas d'index par défaut ; un GIN sur la colonne sert `&&` et `@>` si le volume l'exige.

**Lisibilité en SQL direct** : `WHERE 'urgent' = ANY("etiquettes")` ou `WHERE "etiquettes" && ARRAY['urgent']`.

### Apparence des options

Une option porte, en plus de sa valeur et de son libellé, une **couleur**, et **un pictogramme ou une image** — jamais les deux, ce que le catalogue tient lui-même (`ck_option_glyph`) :

| Colonne de `select_option` | Contenu | Borne |
|---|---|---|
| `color` | Une couleur quelconque, `#rrggbb` en minuscules (`#abc` est complétée à l'écriture) | `ck_option_color` |
| `icon` | Le nom d'un pictogramme de la bibliothèque d'icônes de l'interface, en `kebab-case` | `ck_option_icon`, 64 caractères |
| `image` | Une adresse `https` ou une URL `data:image/{png,jpeg,webp,gif};base64,…` — jamais du SVG, qui porte des scripts | `ck_option_image`, 16 384 caractères |

Les trois sont **nulles par défaut** et publiées par la projection avec une forme stable : une clé toujours présente, `null` quand elle n'est pas posée. **Le plafond de l'image n'est pas une politesse** : la liste entière voyage avec chaque lecture du catalogue, et deux cents options portant chacune une image sans borne feraient de `/meta/bases` une réponse de mégaoctets. L'interface réduit donc un fichier choisi à 64 pixels avant l'envoi (chapitre 11 §6.2). Un nom de pictogramme que l'interface ne connaît pas s'affiche sans pictogramme au lieu de faire échouer l'écran : le nom reste au catalogue, et une liste collée d'ailleurs n'est pas cassée pour autant.

---

## 3 bis. `file` et `image` — documents et images

*Décision révisée* : le §2.2 excluait `img` du HTML riche parce que « la v1 n'a pas de gestion de fichiers ». Elle en a désormais une, limitée à ces deux types ; l'exclusion d'`img` dans le HTML riche demeure, pour la raison du pisteur.

**Les octets ne sont pas dans la table.** Un champ `file` ou `image` est une colonne **`jsonb`** qui porte la **liste** des fichiers de la cellule, de une à vingt entrées :

```json
[{"id": "0192…", "name": "devis été.pdf", "type": "application/pdf", "size": 48213}]
```

Les octets vont au **stockage de fichiers** de l'instance, et le catalogue garde une ligne par fichier dans `_basedb.stored_file` (chapitre 02, « Fichiers déposés »). *Alternatives rejetées* : `bytea` dans la table, qui ferait porter chaque sauvegarde, chaque `VACUUM` et chaque réplique par des mégaoctets de PDF ; `uuid[]` vers le catalogue, illisible en SQL direct et qui imposerait une jointure à travers la frontière `_basedb` à chaque lecture.

**Deux pilotes de stockage, un contrat** : un **répertoire local** (`BASEDB_FILES_DIR`, par défaut `.basedb/files`), qui suffit à un hôte unique ; et **S3** (`BASEDB_S3_BUCKET`, `BASEDB_S3_ENDPOINT`, `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY`, `BASEDB_S3_REGION`, `BASEDB_S3_FORCE_PATH_STYLE=0` pour l'adressage par sous-domaine), le protocole que parlent AWS, Scaleway, OVH, Cloudflare R2, Garage ou SeaweedFS. Le pilote S3 signe lui-même ses requêtes (Signature Version 4) : trois verbes sur un compartiment ne justifient pas un SDK. *Alternative écartée* : imposer MinIO — son édition communautaire est archivée depuis 2026 et ses images ne sont plus publiées ; une instance existante reste utilisable par le pilote S3.

**Le cycle d'un fichier, en trois temps.**

1. **Dépôt** : `POST /api/v1/{tenant}/files/{base}/{table}/{champ}?name=…`, le corps étant le fichier lui-même. Il faut pouvoir **écrire** le champ (en création ou en mise à jour) ; un champ masqué est un champ inconnu. Taille bornée (`BASEDB_FILES_MAX_MB`, 25 Mo par défaut, `BODY_TOO_LARGE`). Pour `image`, le type est lu **dans les octets** — PNG, JPEG, GIF, WebP, AVIF — et rien d'autre n'est accepté (`CONTENT_TYPE_INVALID`) : SVG est refusé, il porte des scripts. Le dépôt rend un identifiant et ne modifie aucune ligne.
2. **Écriture** : la ligne cite les identifiants (seuls, ou dans des objets `{id, …}` — ce qu'une lecture a rendu, renvoyé tel quel). Le noyau n'accepte que des fichiers déposés **pour ce champ** (`VALUE_INVALID`, `fichier_inconnu` sinon) et **recopie depuis le catalogue** nom, type et taille : ce que la cellule dit d'un fichier ne vient jamais du client. Liste vide = `NULL`.
3. **Lecture** : chaque fichier d'une ligne lue porte un `url` **signé et temporaire** vers `GET /api/v1/{tenant}/files/{id}/{nom}?exp=…&sig=…`. Cette route ne prend **aucun jeton** — une balise `<img>` ne sait pas en envoyer — : le lien est la preuve. Il n'est émis que par une lecture passée par le point d'application des droits (table, masque de champs, prédicat de lignes), il est lié au tenant, et il expire entre six et douze heures après son émission, l'échéance étant arrondie à la fenêtre de six heures pour que toutes les lectures d'une même fenêtre émettent le **même** lien et que le navigateur garde les vignettes en cache.

**Servir un fichier sans rien exécuter.** Les images acceptées et le PDF sont servis `inline`, tout le reste en pièce jointe ; toujours `X-Content-Type-Options: nosniff`, et, sauf pour le PDF dont la visionneuse refuserait de démarrer, `Content-Security-Policy: default-src 'none'; sandbox`. Un fichier HTML déposé comme document ne s'exécute donc jamais sur l'origine de l'API, à côté du cookie de session.

**Contrainte générée** — la forme, pas le contenu, que le noyau garantit à l'écriture :

```sql
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "ck_factures__pieces_jointes__files"
  CHECK ("pieces_jointes" IS NULL OR CASE WHEN jsonb_typeof("pieces_jointes") = 'array'
         THEN jsonb_array_length("pieces_jointes") BETWEEN 1 AND 20 ELSE false END);
```

Un `CASE` et non un `AND` : PostgreSQL ne promet pas l'ordre d'évaluation d'un `AND`, et `jsonb_array_length` lève une erreur sur un scalaire au lieu de répondre faux. `IS NULL` en tête, explicitement : le `CASE` répond faux pour `NULL`, et la colonne naît `NULL` sur toutes les lignes d'une table qui en a déjà. La règle `files` rejoint le vocabulaire fermé des suffixes `<regle>`.

**Filtres** : `is_null` seul. **Pas de tri.** Pas d'index. Les **agents** (MCP) lisent les fichiers mais n'en écrivent pas : ils n'ont pas d'octets à déposer.

**Ce qui n'est pas encore fait.** Un fichier retiré d'une cellule, ou déposé et jamais cité, reste au catalogue et dans le stockage : aucune clé étrangère ne va de la table vers `stored_file` (A9), et le rattachement des fichiers à leurs lignes pour purger les orphelins relève d'une épuration à écrire. Le lien n'est pas révoqué quand un droit est retiré : il s'éteint à son échéance.

---

## 4. `link` — relation vers une autre table

*Libellé produit :* le type s'affiche **« Relation »** partout où une personne le lit — écran, documentation générée, descriptions MCP. Le code et le catalogue gardent `link`, et la prose de ce document dit encore « lien » ou « champ lien » pour la relation ; le type `url` (§2.7), affiché « Lien URL », est tout autre chose : une adresse, pas une ligne.

Un champ lien matérialise une vraie contrainte `FOREIGN KEY` PostgreSQL, en « plusieurs vers un » ; le « plusieurs vers plusieurs » est un type à part, `multi_link` (§4 bis). Ce chapitre spécifie la projection, le type, les contraintes et les pré-contrôles ; l'ordre des étapes, les verrous et la reprise appartiennent au chapitre 03.

### 4.1 Projection

La colonne porte le nom dérivé fixé par A7 et le chapitre 01 §9.3 : **`<nom physique de la table cible>_id`**, sans inflexion, ni singularisation, ni traduction ; s'il est déjà pris, le slug du libellé du champ suivi de `_id` ; en dernier recours seulement, un suffixe numérique. Une table cible `clients` donne donc la colonne `clients_id`, la contrainte `fk_factures__clients_id` et l'index `ix_factures__clients_id`. Le nom est **figé à la création** et n'est jamais recalculé. Le type est **toujours `uuid`**, celui de `_id` (§10) : l'utilisateur ne choisit pas le type de la colonne source, ce qui rend impossible le cas « type source incompatible » au lieu de le rattraper.

**Chemin (a) — champ lien neuf, le cas nominal.** La colonne est créée vide, donc aucune valeur ne peut être orpheline :

```sql
-- etape 1
ALTER TABLE "b_t4z56fq_crm"."factures" ADD COLUMN "clients_id" uuid NULL;

COMMENT ON COLUMN "b_t4z56fq_crm"."factures"."clients_id"
  IS 'Lien vers Clients (affichage : Raison sociale)';

ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "fk_factures__clients_id"
  FOREIGN KEY ("clients_id") REFERENCES "b_t4z56fq_crm"."clients" ("_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID;

-- etape 2, hors bloc transactionnel
CREATE INDEX CONCURRENTLY "ix_factures__clients_id"
  ON "b_t4z56fq_crm"."factures" ("clients_id", "_id");

-- etape 3
ALTER TABLE "b_t4z56fq_crm"."factures" VALIDATE CONSTRAINT "fk_factures__clients_id";
```

**Aucun pré-contrôle d'orphelins n'est exécuté sur ce chemin** : il porterait sur une colonne qui vient d'être créée et ne contient que des nuls. L'étape 3 balaie tout de même la table, sous un verrou qui laisse passer les écritures.

**Chemin (b) — colonne existante** : conversion d'un champ texte en lien (§8), ou repose d'une contrainte après un incident. La colonne porte alors des valeurs, et le pré-contrôle précède l'émission de la contrainte :

```sql
SELECT s."_id", s."clients_id"
FROM "b_t4z56fq_crm"."factures" s
WHERE s."clients_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "b_t4z56fq_crm"."clients" c WHERE c."_id" = s."clients_id")
LIMIT 50;
```

Non vide → refus `LINK_ORPHAN_VALUES`, échantillon stocké dans `migration.error_sample` et restitué à l'utilisateur, avec les deux résolutions habituelles : annuler, ou mettre à `NULL` les valeurs fautives. Une ligne fautive insérée entre le pré-contrôle et la pose de la contrainte est refusée à l'écriture, la contrainte `NOT VALID` s'appliquant déjà aux écritures nouvelles ; une ligne fautive antérieure fait échouer l'étape de validation en `23514`, rattrapée, le pré-contrôle rejoué, le même refus nommé renvoyé.

**Trois points d'exécution.**

- **Les clauses émises sont `ON DELETE NO ACTION` pour `restrict` et `ON UPDATE NO ACTION` toujours** (A13). `_id` étant immuable, `ON UPDATE` n'a pas d'autre valeur défendable. `NO ACTION` refuse exactement les mêmes suppressions que `RESTRICT` ; la seule différence est le moment de la vérification — en fin d'instruction plutôt qu'immédiatement — ce qui permet à une suppression en lot de réussir quand elle supprime dans la même instruction une ligne et celles qui la référencent, cas fréquent sur une table hiérarchique qui se référence elle-même. La réconciliation attend donc `confdeltype = 'a'` quand `field_link_config.on_delete` vaut `restrict` (`CAT-FK2`, chapitre 02).
- **L'index porte `("clients_id", "_id")`**, et non la seule colonne. Le second terme sert le listage des liens inverses trié par `_id` décroissant (§6) sans tri supplémentaire, dans les deux sens de parcours. PostgreSQL ne crée aucun index pour une clé étrangère : sans celui-ci, chaque suppression d'une ligne cible imposerait un parcours complet de la table source. Sa ligne est désignée par `field_link_config.fk_index_id`. Si le champ est aussi unique, `uq_factures__clients_id` remplace cet index, selon la règle de déduplication du §1.2.
- **Ordre de création.** Quand une même migration crée plusieurs tables et leurs liens — import, opération MCP —, le moteur émet **tous les `CREATE TABLE` d'abord, puis tous les `ADD CONSTRAINT`**. La table cible existe donc toujours avant la contrainte qui la référence, y compris pour un cycle de références entre deux tables neuves.

### 4.2 Configuration exposée à la création

| Paramètre | Valeurs | Défaut |
|---|---|---|
| Table cible (`field_link_config.target_table_id`) | tables vivantes de la **même base**, table courante comprise | — |
| Obligatoire (`field.is_required`) | oui / non | non |
| À la suppression de la ligne cible (`field_link_config.on_delete`) | `restrict` / `set_null` / `cascade` | `restrict` |
| Unique | ligne de `table_constraint` de `kind = 'unique'` (§1.6), pas une cardinalité déclarée | non |

`cascade` n'apparaît dans la liste que pour un porteur du droit de gestion du schéma ; il exige une élévation et une confirmation saisie, et alimente une ligne `_basedb.cascade_grant` désignée par `field_link_config.cascade_grant_id`, sans quoi la contrainte `ck_link_cascade_granted` refuse l'écriture. Une tentative sans droit ni confirmation est refusée par `LINK_CASCADE_NOT_GRANTED`. La véracité de l'autorisation relève du chapitre 05 ; son existence, son auteur et son horodatage relèvent de la base.

**La cascade est exécutée par PostgreSQL** (A14) : la clause `ON DELETE CASCADE` est réellement émise, et une suppression faite directement en SQL cascade donc comme une suppression faite par l'API. L'application n'implémente aucune cascade applicative ; avant d'exécuter une suppression qui cascade, elle effectue un décompte des lignes atteintes, l'affiche et exige une confirmation. Les lignes supprimées en chaîne sont historisées et produisent des événements sortants, la capture étant faite par déclencheur (A10). L'écran de confirmation affiche que l'effet est **récursif** si la table source est elle-même référencée en cascade.

**Il n'existe pas de cardinalité « un vers un ».** Le cadrage ne retient que le plusieurs-vers-un. L'unicité d'un champ lien est celle de tout champ : une contrainte `uq_<table>__<colonne>` avec le pré-contrôle et le refus `DUPLICATE_VALUE` du §1.6, sans drapeau supplémentaire, sans second écran et sans second code d'erreur. Lors du passage d'unique à non unique, `ix_` est créé **avant** que `uq_` ne soit supprimé, pour que la colonne ne se retrouve jamais sans index.

### 4.3 Nullabilité et comportement à la suppression

Un champ lien obligatoire ne peut pas être en `set_null` : la clause écrirait une valeur que `NOT NULL` refuse, et la suppression de la ligne cible échouerait en erreur serveur au lieu d'un refus lisible. Le catalogue le rend impossible (`ck_link_set_null_nullable`, adossé au miroir `field_link_config.is_required`). Comportement produit :

- à la création, cocher « obligatoire » **désactive** l'option `set_null` dans l'écran, avec la raison affichée ;
- rendre obligatoire un champ déjà en `set_null` est **refusé** par `LINK_SET_NULL_ON_REQUIRED`, l'écran proposant de basculer d'abord en `restrict` ;
- si les deux changements sont demandés ensemble, le moteur ordonne le plan : bascule en `restrict` d'abord, obligation ensuite (§1.3).

Changer le comportement de suppression est toujours un `DROP CONSTRAINT` suivi d'un `ADD CONSTRAINT … NOT VALID` puis d'un `VALIDATE`. Le nouveau nom est une nouvelle allocation du registre (`fk_factures__clients_id_2`) ; la ligne de `table_constraint` de l'ancienne passe à `dropped`.

### 4.4 Deux liens vers la même cible, lien réflexif

**Deux champs lien d'une même table vers la même cible** sont autorisés et fréquents (« Client facturé », « Client livré »). Le premier obtient `clients_id` ; le second, le nom étant pris, bascule sur le slug du libellé de son champ suffixé `_id` — `client_livre_id` — selon A7. Le nom du second dépend donc de l'ordre de création des champs, ce que l'interface signale à la création, et il est figé ensuite. Les deux apparaissent comme deux blocs distincts dans les liens inverses, titrés par le libellé du champ.

**Le lien réflexif est autorisé** — une hiérarchie « Élément parent » est un besoin normal. La colonne suit la même règle : dans une table `taches`, le premier lien réflexif donne `taches_id` ; un second, portant le libellé « Élément parent », donnerait `element_parent_id`. Un seul garde-fou : **un lien réflexif ne peut pas être obligatoire** (`LINK_SELF_REQUIRED`), une hiérarchie ayant une racine et une colonne réflexive `NOT NULL` rendant la première insertion impossible.

**Les cycles ne sont pas contrôlés, et c'est une décision.** Aucune fonctionnalité de la v1 ne traverse un lien : une formule ne peut pas référencer un champ lien (§7.5), les liens inverses s'arrêtent à un niveau (§6), la colonne d'affichage exclut les liens (§5), un filtre sur la valeur d'affichage est borné à un niveau (§4.7). Un cycle est donc une donnée incohérente pour l'utilisateur, pas un risque technique : rien ne boucle. Le contrôle aurait coûté une requête récursive avant chaque écriture, un verrou de sérialisation pour qu'il soit juste sous concurrence — deux transactions fermant un cycle à deux mains ne se voient pas en `READ COMMITTED` — et un faux positif certain au-delà de la borne de récursion. **Il deviendra nécessaire le jour où une fonctionnalité parcourra la hiérarchie**, et sera spécifié avec elle. C'est écrit dans la documentation générée, à côté du champ.

`cascade` sur un lien réflexif suit la règle générale du §4.2 : réservé, confirmé, exécuté par PostgreSQL. L'écran de confirmation dit ce qu'il en est : la suppression d'un nœud supprime toute sa descendance, sans borne et sans prévisualisation.

### 4.5 Liens vers une autre base : refusés

**Un champ lien pointe toujours vers une table de la même base**, donc du même schéma ; la clé étrangère composite `fk_link_target` du catalogue le rend structurel et le refus porte le code `LINK_CROSS_DATABASE` du chapitre 01, qui en tire déjà deux conséquences de nommage. Deux raisons s'y ajoutent, du ressort de ce chapitre : supprimer ou purger une base deviendrait conditionné par l'état d'une autre, et les alias de compatibilité, qui opèrent sur un schéma entier, cesseraient d'avoir un périmètre ; et le cloisonnement multi-tenant à venir doit pouvoir déplacer le schéma d'une base vers une autre instance PostgreSQL. Une clé étrangère entre deux schémas d'une même base est **techniquement possible aujourd'hui**, mais elle rendrait ce déplacement impossible sans casser la référence : c'est pour préserver cette porte de sortie qu'elle est refusée, pas parce que PostgreSQL l'interdirait. Substitut proposé dans le message : regrouper les tables dans une même base, ou dupliquer la table de référence.

### 4.6 Supprimer une table référencée

Une table référencée ne peut pas être supprimée tant que la référence existe, et le refus est explicite et nommé : **`TABLE_REFERENCED`**. La garantie est déclarative et vient du catalogue — le miroir `target_is_live` et `ck_link_target_live` du chapitre 02 —, la liste nommée des champs fautifs vient de la requête des liens inverses du même chapitre, son filtrage par les permissions du lecteur du chapitre 05, et la charge utile et le message du chapitre 03. Ce chapitre n'y ajoute qu'une conséquence :

le refus n'est fiable **que parce que** la suppression logique d'un champ lien supprime réellement sa clé étrangère (§1.11, A17). Sans cette règle, une clé étrangère fantôme ferait échouer le `DROP` en `23503` alors que le catalogue ne voit plus aucune référence, et le refus serait inexplicable. La suppression logique d'une table, elle, ne supprime pas la table physique : les clés étrangères entrantes doivent donc avoir disparu du catalogue **et** de la base pour que la relégation puis la purge se déroulent sans surprise.

### 4.7 Représentation JSON, tri et filtres

**Sortie : un objet à deux clés.**

```json
{ "clients_id": { "id": "018f2c3a-…", "display": "ACME SARL" } }
```

L'identifiant seul imposerait un aller-retour par ligne à tout consommateur qui affiche un libellé — ce que le cadrage veut éviter — et la ligne cible complète serait volumineuse. L'objet à deux clés est le compromis ; l'expansion du lien et ses bornes appartiennent au chapitre 08.

`display` vaut `null` si la cible n'a pas de colonne d'affichage désignée, si la valeur y est vide, ou si le champ d'affichage est masqué pour le lecteur. **Si la table cible est illisible pour le lecteur, la forme de réponse est unique et reprise mot pour mot (A16) :**

```json
{ "clients_id": { "id": null, "display": null, "masked": true } }
```

L'identifiant est masqué et non renvoyé en clair : un UUIDv7 porte un horodatage, qui révélerait la date de création d'une ligne d'une table que le lecteur n'a pas le droit de voir. Le filtre et le tri sur ce champ se réduisent alors à `is_null` et à sa négation. Il n'existe aucun espace d'identifiants opaques calculés par HMAC : ni au catalogue, ni dans OpenAPI, ni dans le MCP.

**Coût de la résolution de `display`.** Chaque champ lien projeté impose une jointure externe vers sa cible : sur une table à huit liens, une page de grille exécute un plan à huit jointures. C'est ce coût, et lui seul, qui justifie que le nombre de liens résolus par lecture de liste soit borné ; **la borne et le paramètre qui demande les identifiants nus appartiennent au chapitre 08**. La vue détail d'une ligne, qui ne lit qu'une ligne, les résout tous.

**Entrée : l'identifiant nu ou l'objet.**

```json
{ "clients_id": "018f2c3a-…" }
{ "clients_id": { "id": "018f2c3a-…" } }
{ "clients_id": null }
```

L'objet est accepté parce qu'une intégration doit pouvoir relire une ligne et la réécrire telle quelle ; `display` y est ignoré, étant dérivé, et `masked` refusé. `null` efface, `""` est refusé. Une cible inexistante est détectée **avant** l'écriture par un `SELECT` explicite et renvoie `LINK_TARGET_NOT_FOUND` avec l'identifiant fautif ; si la ligne cible disparaît entre-temps, le `23503` est rattrapé et retraduit en ce même code. **Écrire par valeur d'affichage est refusé en v1** : la colonne d'affichage n'est pas unique, la correspondance serait ambiguë et silencieusement fausse.

**Tri.** Le tri **par défaut** sur un champ lien porte sur la colonne elle-même, `("clients_id", "_id")`, servi par `ix_factures__clients_id`. Trier sur un UUIDv7 revient à trier par date de création de la ligne cible : ce n'est pas ce que l'utilisateur veut voir, mais c'est le seul tri qu'un index sert, et il reste correct au-delà de 100 000 lignes.

**Le tri par valeur d'affichage est une option explicite**, offerte par l'interface parce que c'est ce que l'utilisateur veut réellement, et bornée parce qu'aucun index ne la sert :

```sql
SELECT f."_id", f."numero", f."clients_id"
FROM "b_t4z56fq_crm"."factures" f
LEFT JOIN "b_t4z56fq_crm"."clients" c ON c."_id" = f."clients_id"
WHERE (c."raison_sociale" COLLATE "und-x-icu" > $1
    OR (c."raison_sociale" COLLATE "und-x-icu" = $1 AND f."_id" > $2)
    OR c."raison_sociale" IS NULL)
ORDER BY c."raison_sociale" COLLATE "und-x-icu", f."_id"
LIMIT $3;
```

Le curseur contient la valeur d'affichage, son drapeau de nullité et l'`_id` de la source, et la jointure est rejouée à chaque page ; les deux branches et la clause de collation sont celles du §1.9, sans exception. Le tri est soumis à la borne `SORT_NOT_INDEXABLE_VOLUME`, avec repli sur la colonne de lien. Si la cible n'a pas de colonne d'affichage désignée, ou si elle est illisible pour le lecteur, le tri se rabat sur la colonne de lien et la réponse le signale.

**Filtres.** `eq`, `ne`, `in`, `is_null` portent sur l'identifiant, sans jointure. Un filtre sur la valeur d'affichage de la cible est autorisé avec la même jointure, **borné à un niveau de profondeur** — un filtre traversant deux liens est refusé, la profondeur arbitraire transformant un filtre en plan de jointure imprévisible — et soumis à la même borne de volume que le tri.

### 4.8 Ce que le catalogue expose d'une relation

La documentation générée, la spécification OpenAPI et les outils MCP de description de schéma décrivent une relation avec **exactement** ces informations, toutes lues dans le catalogue, aucune calculée deux fois :

| Information | Source |
|---|---|
| Libellé et nom physique du champ lien | `field`, `field.name_id` |
| Table cible : clé de catalogue, libellé, nom physique, schéma | `field_link_config.target_table_id`, `v_physical_name_qualified` |
| Colonne d'affichage retenue sur la cible : libellé, nom physique, type | `table_def.display_field_id` |
| Cardinalité | « plusieurs vers un » pour `link`, « plusieurs vers plusieurs » pour `multi_link` (§4 bis) — lue dans `field.kind` |
| Comportement à la suppression | `field_link_config.on_delete` |
| Caractère obligatoire, caractère unique | `field.is_required` ; ligne `table_constraint` de `kind = 'unique'` |
| Nom de la contrainte et nom de l'index | `table_constraint.name_id`, `table_index.name_id` |
| Liens inverses : table source, champ, libellé du bloc | requête des liens inverses du chapitre 02 |

C'est cette liste que les chapitres 08 et 09 consomment ; ils n'en inventent aucune autre et n'interrogent jamais `pg_constraint` pour la produire.

### 4.9 Lisibilité en SQL direct

La colonne contient un UUID : illisible seule, jointe en une ligne. C'est le prix de l'intégrité référentielle réelle, et il est payé une fois par requête :

```sql
SELECT f."numero", c."raison_sociale"
FROM "b_t4z56fq_crm"."factures" f
JOIN "b_t4z56fq_crm"."clients" c ON c."_id" = f."clients_id";
```

Le `COMMENT ON COLUMN` de `clients_id` porte « Lien vers Clients (affichage : Raison sociale) » tant que le champ n'a pas de description, et cette description dès qu'il en a une (§1.1). **Aucune vue SQL de confort n'est générée** : elle doublerait chaque table, se désynchroniserait au premier ajout de champ, et le chapitre 01 réserve les vues SQL aux alias de compatibilité.

---

## 4 bis. `multi_link` — relation multiple

*Décision révisée* : le « plusieurs vers plusieurs » était renvoyé en v2, avec une table de jonction. Il est un **type à part entière**, affiché **« Relation multiple »** : une tâche a plusieurs personnes assignées, un article plusieurs étiquettes tenues dans une table, un projet plusieurs clients. Comme pour le choix multiple (§3.1), ce n'est pas un drapeau sur `link` : la colonne n'a pas le même type physique, et le type d'un champ est immuable.

### 4 bis.1 Une colonne, pas une table de jonction

**Colonne `uuid[]`** sur la table source, portant les `_id` des lignes cibles **dans l'ordre choisi** par qui les a liées. *Alternative rejetée : la table de jonction* `(source_id, target_id)`, qui aurait deux clés étrangères réelles. Elle romprait trois règles de ce produit pour en servir une :

- **« Un champ, une colonne, rien d'autre »** (§1.1) : la jonction serait une table physique hors du catalogue des tables, à créer, reléguer, purger, copier d'un environnement à l'autre et réconcilier à part ;
- **l'historique par ligne** (chapitre 07) : la capture lit une ligne entière avant et après ; lier une ligne de plus changerait une autre table, et la révision de la ligne source n'en dirait rien. Avec la colonne, « ajouter Léa aux personnes assignées » est une révision de la tâche, delta champ par champ compris, et la charge utile d'un webhook est complète ;
- **l'écriture d'une valeur** : relire une ligne et la réécrire telle quelle (§4.7) serait deux tables à écrire.

Ce que la jonction offrait — une intégrité tenue par PostgreSQL, même en SQL direct — est obtenu autrement, **toujours dans PostgreSQL** (A14) : par deux fonctions de déclencheur partagées de `_basedb_local` (A9), jamais une par table.

| Déclencheur | Table | Moment | Effet |
|---|---|---|---|
| `tg_<table>__ml_<colonne>` | source | `BEFORE INSERT OR UPDATE OF "<colonne>" FOR EACH ROW` | `_basedb_local.multi_link_check_v1()` : la liste est non vide, à une dimension, sans élément nul ni doublon, et chaque identifiant désigne une ligne de la cible, **verrouillée `FOR KEY SHARE`** comme une clé étrangère le ferait — une suppression concurrente attend, puis la vérification la voit |
| `tg_<cible>__mlt_<table>_<colonne>` | cible | `AFTER DELETE FOR EACH STATEMENT REFERENCING OLD TABLE AS old_rows` | `_basedb_local.multi_link_deleted_v1()` : selon `on_delete`, refuse la suppression d'une ligne encore liée, ou la retire des listes qui la citent |

Les deux lèvent les codes SQLSTATE d'une contrainte : `23514` pour une liste mal formée, `23503` pour une cible absente ou encore liée. Le noyau les retraduit comme pour `link` — `VALUE_OUT_OF_CONSTRAINT`, `LINK_TARGET_NOT_FOUND`, `ROW_REFERENCED` —, avec l'identifiant fautif dans `details.id`. Leurs arguments sont les noms physiques de la colonne et de l'autre table, figés à la création comme tout nom physique (chapitre 01) ; la suppression d'une table ou d'une base supprime ces déclencheurs, comme elle supprime les clés étrangères de ses liens (A17).

La vérification ne s'exécute que si la colonne est écrite (`UPDATE OF`) : modifier un autre champ d'une ligne ne relit pas ses liens.

### 4 bis.2 Configuration, nullabilité, suppression

Même table satellite que `link`, `field_link_config`, de `kind = 'multi_link'` : cible dans la **même base** (`LINK_CROSS_DATABASE`), réflexive permise, caractère obligatoire. Pas de contrainte de clé étrangère (`fk_constraint_id` nul), un index : **GIN** `ix_<table>__<colonne>` sur la colonne, désigné par `fk_index_id`. Il sert `@>` et `&&` — les liens inverses, la suppression d'une cible, les filtres —, ce que PostgreSQL ferait sans lui par parcours complet de la source.

| À la suppression de la ligne cible | Effet | Défaut |
|---|---|---|
| `set_null` — « retirer de la liste » | l'identifiant est retiré de chaque liste qui le porte, l'ordre des autres est gardé ; une liste vidée devient `NULL` | **oui** |
| `restrict` | la suppression est refusée tant qu'une liste la cite, vérifié **en fin d'instruction** comme `NO ACTION` (§4.1) | non |
| `cascade` | refusé : supprimer une tâche parce qu'une des personnes qui y étaient assignées est supprimée n'a pas de sens | — |

Le défaut n'est pas celui de `link` : retirer une étiquette supprimée des articles qui la portaient est ce qu'attend qui la supprime, alors que supprimer le client d'une facture laisserait une facture sans client. **Vide s'écrit `NULL`**, comme pour le choix multiple : « obligatoire » veut dire « au moins une ligne liée », et un champ obligatoire ne peut pas être en `set_null` (`ck_link_set_null_nullable`, `LINK_SET_NULL_ON_REQUIRED`) — retirer le dernier lien écrirait `NULL` dans une colonne `NOT NULL`.

La colonne est nommée `<nom physique de la table cible>_ids`, à défaut le slug du libellé suivi de `_ids`, selon la règle d'allocation de §4.1.

### 4 bis.3 Représentation JSON, filtres, tri

**Sortie : une liste d'objets**, ceux de `link`, dans l'ordre de la colonne :

```json
{ "personnes_ids": [ { "id": "018f…", "display": "Léa" }, { "id": "018f…", "display": "Hugo" } ] }
```

`NULL` se lit `null`. Une cible illisible pour le lecteur donne **un seul** élément masqué, `[{ "id": null, "display": null, "masked": true }]`, quel que soit le nombre de lignes liées : la forme de A16, qui ne dit pas combien de lignes d'une table interdite la ligne désigne.

**Entrée** : une liste d'identifiants ou d'objets `{ "id" }` — la sortie se réécrit telle quelle —, un identifiant seul valant une liste d'un élément, `null` ou `[]` pour vider. Les doublons sont retirés en gardant le premier rang ; une cible absente est refusée par `LINK_TARGET_NOT_FOUND`, avec l'identifiant fautif.

**Filtres** : `has_any` et `has_all` sur les identifiants (`&&`, `@>` sur `uuid[]`), `is_null`. Un chemin vers la cible, `personnes_ids.nom contains "lé"`, est un `EXISTS` sur `t."_id" = ANY(s."personnes_ids")` — au moins une des lignes liées satisfait —, un niveau, avec le prédicat de lignes de la cible, comme pour `link` (§4.7). **Pas de tri** (`SORT_UNAVAILABLE`) ; la relation multiple n'est pas une colonne d'affichage (§5) et n'est pas groupable.

**Liens inverses** (§6) : un bloc par champ `multi_link` entrant, lu par `"c" @> ARRAY[$1]`, servi par l'index GIN, avec les bornes normatives de §6. **L'expansion** (`expand`, chapitre 08) ne porte que sur `link` en v1.

**Lisibilité en SQL direct** :

```sql
SELECT t."nom", p."nom" AS personne
FROM "b_t4z56fq_crm"."taches" t
JOIN "b_t4z56fq_crm"."personnes" p ON p."_id" = ANY(t."personnes_ids");
```

---

## 5. La colonne d'affichage

Le catalogue porte la désignation (`table_def.display_field_id`), la contrainte qui la garantit et la règle de désignation par défaut : chapitre 02. Ce chapitre fixe les types éligibles et les cas limites.

| Type | Éligible | Raison |
|---|---|---|
| `short_text`, `number`, `date`, `datetime`, `select`, `formula` | **oui** | valeur courte, comparable, affichable en une cellule |
| `long_text` | non | volume non borné, HTML, déclenchement de TOAST à chaque lecture |
| `boolean` | non | deux valeurs pour désigner N lignes |
| `link` | non | l'affichage d'un lien exigerait l'affichage de sa cible, en chaîne non bornée |

Cette liste est exactement `field_kind.can_be_display`, seul endroit où la règle d'affichabilité est écrite ; un type non éligible désigné est refusé par `fk_display_kind`. L'exclusion du lien est la plus importante : elle empêche une récursion d'affichage dont le coût et la profondeur seraient imprévisibles. Une formule n'est éligible que parce qu'elle est **stockée** (§7) : la jointure d'affichage lit une colonne, jamais une expression.

**Cas limites :**

- **Valeur vide ou nulle sur une ligne** → `"display": null`, l'interface affiche « (sans titre) » suivi des huit premiers caractères de `_id`. Jamais d'erreur, jamais de repli sur un autre champ.
- **Aucune désignation** → `table_def.display_field_id` est nul, ce qui est **un état valide** (A15) : `"display": null` pour toutes les lignes et repli d'affichage sur l'`_id` abrégé. Une table sans champ affichable reste une cible de lien valide.
- **Suppression ou conversion du champ désigné** → **refusée**, `DISPLAY_FIELD_IN_USE`, avec invitation à désigner un autre champ d'abord. **Aucune bascule automatique n'existe, sous aucune forme** : ni vers le champ suivant, ni vers `_id`. Elle changerait sans prévenir ce que voient tous les consommateurs de tous les liens pointant vers cette table, et le cadrage pose sur les relations la règle générale — mieux vaut un refus explicite qu'un effet silencieux.
- **Valeurs non uniques** — deux clients « Dupont » → autorisé et non contraint. L'interface ajoute les huit premiers caractères de `_id` comme désambiguïsateur dans les sélecteurs, et l'écriture renvoie toujours un identifiant, donc aucune ambiguïté fonctionnelle. Une suggestion non bloquante propose de rendre le champ unique.
- **Champ d'affichage masqué pour le lecteur** → `"display": null`, sans erreur. Ne jamais substituer un autre champ : le substitut serait un canal de fuite choisi au hasard.
- **Table cible illisible pour le lecteur** → la forme de A16, §4.7.

---

## 6. Les liens inverses

La vue détail d'une ligne liste les lignes qui la référencent. Aucune configuration : la liste des champs lien entrants est celle que produit la requête de référence du chapitre 02 sur `field_link_config`, servie par `idx_link_target`, et le libellé d'un bloc est `<label de la table source> · <label du champ>`, calculé à la lecture.

**Ce que cela exige** : un index sur chaque colonne référençante. `ix_<table>__<colonne>` est créé d'office avec `_id` en second terme (§4.1), ce qui rend le listage trié sans tri ; sur un champ lien unique, c'est `uq_<table>__<colonne>` qui joue ce rôle, avec au plus une ligne à rendre.

**Bornage sémantique, en trois niveaux. Ces valeurs sont normatives et le contrat HTTP du chapitre 08 les reprend telles quelles, sans en poser d'autres :**

1. Au plus **20 blocs** de liens inverses sont chargés ; au-delà, les suivants sont repliés et chargés à la demande. Une table référencée par 60 champs existe, et ouvrir une ligne ne doit pas déclencher 60 requêtes.
2. Par bloc, **50 lignes** au plus, triées `"_id" DESC` — l'UUIDv7 étant ordonné dans le temps, c'est « les plus récentes d'abord » sans colonne supplémentaire. Au-delà, un lien ouvre la table source préfiltrée, paginée par curseur (§1.9).
3. Le décompte est **plafonné** : `SELECT count(*) FROM (SELECT 1 FROM … WHERE "clients_id" = $1 LIMIT 501) t`, affiché « 500+ » à la borne. Un `count(*)` exact sur une table source volumineuse coûterait plus cher que tout le reste de la page.

Les requêtes sont exécutées dans une seule transaction en lecture seule, une par bloc — pas d'`UNION ALL`, les colonnes projetées différant d'une table source à l'autre. De chaque ligne référençante sont affichés la valeur d'affichage de sa table, son `_id` abrégé et `_updated_at`.

**Permissions** : un bloc dont la table source n'est pas lisible n'apparaît pas — ni bloc, ni compteur, ni mention. Un compteur visible sur une table masquée serait une fuite. Aucune action destructive n'est proposée depuis un lien inverse.

---

## 7. `formula` — formule simple

### 7.1 Décision de mise en œuvre

**Une formule est projetée en colonne générée stockée :**

```sql
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD COLUMN "montant_ttc" numeric
  GENERATED ALWAYS AS (("prix_ht" * (1 + "taux_tva"))) STORED;
```

`field_formula_config.is_stored` vaut donc **toujours `true` en v1** ; la colonne existe pour la v2. La grammaire est conçue pour que toute expression valide soit projetable : si PostgreSQL refuse l'expression, c'est un défaut du moteur, pas un cas d'usage à rattraper.

Conséquences, deux bénéfiques et deux contraignantes :

- la valeur est visible en SQL direct, filtrable, indexable, exportable ; elle peut servir de colonne d'affichage (§5), et le calcul est payé à l'écriture, pas à chaque lecture ;
- **aucune fonction dépendant du temps ou de la session n'est utilisable** : `now()`, `current_date`, `concat()` et toute conversion date → texte sont `STABLE`, et PostgreSQL refuse une colonne générée non immuable. Il n'existe donc pas de fonction « AUJOURDHUI » dans le langage. C'est le piège numéro un d'une formule « façon tableur » et il est énoncé dans l'interface, à la saisie ;
- **créer un champ formule réécrit intégralement la table sous `ACCESS EXCLUSIVE`**, exactement comme le modifier (§7.7). L'optimisation qui rend `ADD COLUMN` instantané ne s'applique qu'à une valeur par défaut constante, jamais à une expression. Sur une table de plusieurs millions de lignes, créer un champ formule est une opération de maintenance : elle passe par le parcours de confirmation du §1.10, avec le nombre de lignes et l'espace disque temporaire affichés avant exécution.

*Alternatives rejetées* : le calcul à la lecture (invisible en SQL direct, non indexable, recalculé à chaque appel) ; une vue SQL par table (double les objets, se désynchronise, et le chapitre 01 réserve les vues SQL aux alias).

*Décision révisée — deux exceptions calculées à la lecture.* Une formule reste stockée **tant qu'elle le peut**. Elle devient calculée à la lecture (`is_stored = false`, aucune colonne) dans deux cas seulement, que l'analyse décide et que l'interface annonce à la saisie :

- elle emploie `AUJOURDHUI()` ou `MAINTENANT()` — la valeur change sans que la ligne change, aucune colonne ne peut la tenir ;
- elle cite un champ calculé à la lecture — recherche, cumul, décompte (§7 ter) —, qui n'a pas de colonne à citer.

Le prix est celui de l'alternative rejetée ci-dessus, et il est dit : une telle formule n'existe pas en SQL direct, ne s'indexe pas, n'est pas une colonne d'affichage, et se recalcule à chaque lecture. Elle se filtre et se trie comme toute colonne (§7 ter.3). `AUJOURDHUI()` se lit dans le fuseau du champ (`field_formula_config.timezone`, `Europe/Paris` par défaut) : « aujourd'hui » à minuit et demi à Paris n'est pas la veille.

### 7.2 Grammaire

Notation EBNF, littéraux entre guillemets. Espaces libres entre lexèmes.

```
expression  = ou ;
ou          = et , { ( "OU" | "OR" ) , et } ;
et          = non , { ( "ET" | "AND" ) , non } ;
non         = [ "NON" | "NOT" ] , comparaison ;
comparaison = somme , [ ( "=" | "<>" | "<" | "<=" | ">" | ">=" ) , somme ] ;
somme       = produit , { ( "+" | "-" | "&" ) , produit } ;
produit     = unaire , { ( "*" | "/" ) , unaire } ;
unaire      = [ "-" ] , primaire ;
primaire    = nombre | texte | booleen | "NULL" | champ | appel
            | "(" , expression , ")" ;
champ       = "[" , libelle , "]" ;
appel       = nom_fonction , "(" , [ expression , { separateur , expression } ] , ")" ;
separateur  = ";" | "," ;
nombre      = chiffre , { chiffre } , [ "." , chiffre , { chiffre } ] ;
texte       = '"' , { caractere | '""' } , '"' ;
booleen     = "VRAI" | "FAUX" | "TRUE" | "FALSE" ;
```

Un champ se cite **par son libellé, entre crochets** : `[Prix HT] * (1 + [Taux TVA])`. Le séparateur d'arguments est `;` ou `,`, et le séparateur décimal est le point : le point-virgule évite l'ambiguïté avec la virgule décimale que les utilisateurs francophones taperont, la virgule est celle qu'un anglophone attend, et le point décimal, imposé pour rester cohérent avec le JSON de l'API, est ce qui laisse la virgule libre. Profondeur d'imbrication limitée à 16, longueur de l'expression à 4 000 caractères. Le langage de saisie est en français ou en anglais : c'est une surface produit, pas un identifiant système.

**La citation par libellé est déterministe** parce que le chapitre 01 impose déjà l'unicité du libellé parmi les objets vivants d'un même parent (index unique partiel sur `field.label_key`). La résolution d'un `[…]` emploie **la clé de comparaison de libellé** de ce même chapitre, si bien que `[prix ht]` et `[Prix HT]` désignent le même champ. Un libellé introuvable est refusé par `FORMULA_FIELD_NOT_FOUND`, avec la position du lexème.

**Le crochet fermant se double** dans un libellé cité, sur le même principe que le guillemet dans un littéral texte. Seul `]` se double ; `[` n'a pas à l'être, l'analyseur ne cherchant que la fin de la citation. Un champ « Prix [HT] » se cite donc `[Prix [HT]]]`. Sans cette règle, un libellé parfaitement légal — le chapitre 01 n'interdit qu'un jeu restreint de caractères dans un *nom physique*, jamais un crochet dans un libellé — refermerait la citation par surprise.

**Deux langues, un seul arbre.** Chaque mot du langage s'écrit en français ou en anglais, au besoin dans la même formule : `SI` ou `IF`, `ET` ou `AND`, `VRAI` ou `TRUE` (correspondance au §7.3). L'arbre enregistré (`field_formula_config.ast`) épelle toujours le mot français : les formules existantes ne changent pas, et l'émission SQL ne connaît qu'un nom par fonction. La formule se relit dans la langue de l'écran : en français sur un écran français, en anglais sur tous les autres (`formulaDialect`). C'est ainsi que la description d'une base (`GET /meta/bases/{base}`) la rend, et son validateur tient compte de cette langue. Le texte relu vient de l'arbre, jamais d'une substitution sur le texte saisi, comme pour un libellé renommé. *Alternative rejetée* : une langue fixée par formule ou par base, qui montrerait `SI` à un lecteur anglophone et `IF` à un lecteur francophone.

### 7.3 Fonctions autorisées — liste close v1

| Formule | En anglais | Projection SQL | Note |
|---|---|---|---|
| `SI(c;a;b)` | `IF(c,a,b)` | `CASE WHEN <c> THEN <a> ELSE <b> END` | `a` et `b` de même type |
| `SIVIDE(a;b)` | `IFBLANK(a,b)` | `coalesce(<a>,<b>)` | |
| `ESTVIDE(a)` | `ISBLANK(a)` | `(<a> IS NULL)` | seul moyen de tester `NULL` |
| `ARRONDI(x;n)` | `ROUND(x,n)` | `round(<x>, least(greatest(<n>,-1000),1000)::int)` | `round(numeric, numeric)` n'existe pas : le second argument est **toujours** converti, et borné |
| `ABS` `PLAFOND` `PLANCHER` | `ABS` `CEILING` `FLOOR` | `abs` `ceil` `floor` | nombre uniquement |
| `MIN(a;b)` `MAX(a;b)` | `MIN(a,b)` `MAX(a,b)` | `least` `greatest` | **nombre et date uniquement** |
| `MAJUSCULE` `MINUSCULE` | `UPPER` `LOWER` | `upper(<x> COLLATE "und-x-icu")` `lower(…)` | collation explicite, même motif que `_basedb_local.fold_v1` |
| `SANSESPACES(x)` | `TRIM(x)` | `btrim(<x>)` | |
| `LONGUEUR(x)` | `LEN(x)` | `length(<x>)::numeric` | |
| `GAUCHE(x;n)` `DROITE(x;n)` | `LEFT(x,n)` `RIGHT(x,n)` | `left(<x>, least(greatest(<n>,0),1000000)::int)` | garde contre `n` négatif **et** contre le dépassement d'entier |
| `TEXTE(x)` | `TEXT(x)` | `<x>::text` | **nombres et booléens seulement** |
| `NOMBRE(x)` | `VALUE(x)` | `CASE WHEN <x> ~ '^-?\d+(\.\d+)?$' THEN <x>::numeric ELSE NULL END` | jamais un cast nu ; le motif exclut aussi `NaN` et les infinis |
| `ANNEE` `MOIS` `JOUR` | `YEAR` `MONTH` `DAY` | `extract(<part> from <d>)::numeric` | **champ de `kind = 'date'` uniquement** |
| `a & b` | `a & b` | `(coalesce(<a>::text,'') \|\| coalesce(<b>::text,''))` | pas `concat()`, qui est `STABLE` |
| `JOURS(a;b)` | `DAYS(a,b)` | `(<a> - <b>)::numeric` | nombre de jours de `b` à `a` ; **dates uniquement** |
| `AJOUTER_JOURS(d;n)` | `ADD_DAYS(d,n)` | `(<d> + least(greatest(<n>,-100000),100000)::int)` | date ; `n` borné |
| `DATE(a;m;j)` | `DATE(y,m,d)` | `make_date(…)` sur des arguments bornés, `NULL` si la date n'existe pas | par une fonction immuable de `_basedb_local`, jamais une erreur à l'écriture |
| `JOURSEMAINE(d)` | `WEEKDAY(d)` | `extract(isodow from <d>)::numeric` | 1 lundi … 7 dimanche |
| `AUJOURDHUI()` | `TODAY()` | `(pg_catalog.now() AT TIME ZONE '<fuseau>')::date` | **rend la formule calculée à la lecture** (§7.1) |
| `MAINTENANT()` | `NOW()` | `pg_catalog.now()` | idem ; résultat `datetime` |

`ET` `OU` `NON` s'écrivent aussi `AND` `OR` `NOT`, `VRAI` `FAUX` aussi `TRUE` `FALSE` (§7.2).

Quatre précisions qui décident de points non évidents.

- **Règle générale : tout cast vers `int` dans une projection est encadré par `least(…, <borne>)`.** Sans cela, `greatest(0,n)::int` lève `22003 integer out of range` dès que l'argument dépasse 2 147 483 647 ; le calcul ayant lieu à l'écriture, la ligne deviendrait inécrivable pour toujours.
- **`TEXTE()` et `&` refusent les dates et les dates-heures.** Toutes les conversions date → texte de PostgreSQL (`to_char`, cast d'entrée-sortie) dépendent de `DateStyle` ou de `lc_time` et sont `STABLE`, donc inutilisables en colonne générée. Refus nommé `FORMULA_FUNCTION_NOT_IMMUTABLE`. Pour composer un texte à partir d'une date, on passe par `ANNEE`, `MOIS`, `JOUR`.
- **Les fonctions de date ne s'appliquent qu'aux champs de `kind = 'date'`.** Sur un `datetime`, l'extraction dépend du fuseau de session : il faudrait projeter `("col" AT TIME ZONE '<fuseau>')` dans l'expression générée, donc y concaténer une valeur de configuration, et surtout accepter qu'une mise à jour de tzdata change le résultat pour les lignes réécrites après elle, et pour elles seules — deux vérités dans la même colonne, invisibles. Même code de refus, et le message propose de dériver un champ `date`. **Aucune expression générée par ce chapitre ne dépend d'un fuseau horaire.**
- **Toute division est protégée** : `a / b` projette `CASE WHEN <b> = 0 OR <b> IS NULL THEN NULL ELSE <a> / <b> END`. Le calcul ayant lieu à l'écriture, une seule division par zéro rendrait la ligne inécrivable et bloquerait toute réécriture ultérieure de cette ligne. Diviser par zéro donne « vide », pas une erreur.

**Renvoyées en v2, explicitement :** les fonctions de sous-chaîne autres que `GAUCHE`/`DROITE`, le remplacement de texte, la troncature vers zéro. L'agrégation sur des lignes liées n'est pas une fonction du langage : c'est un champ, le cumul (§7 ter), qu'une formule cite comme un autre. Chaque fonction est une projection, une règle de typage, un test, une entrée de documentation et une entrée MCP ; la liste ci-dessus est le noyau qui couvre les usages réels d'une grille, et rien de plus.

### 7.4 Typage, valeurs nulles, sérialisation, écriture

Le type de résultat est **déduit**, jamais saisi, et écrit dans `field_formula_config.result_kind`, qui référence `field_kind` et ne peut valoir ni `formula` ni `link` : arithmétique et fonctions numériques → `number`, projeté en `numeric` **sans précision ni échelle** (un plafond ferait échouer des écritures pour un motif que l'utilisateur n'a pas choisi) ; comparaisons et opérateurs logiques → `boolean` ; `&` et fonctions texte → `short_text` ; `ANNEE`/`MOIS`/`JOUR` → `number`. Un mélange de types incompatibles est refusé à l'enregistrement (`FORMULA_TYPE_MISMATCH`), avec la position du lexème fautif.

**Sérialisation JSON : celle du type de résultat**, sans exception. Un résultat numérique sort donc en **chaîne**, comme tout nombre (§2.3) ; un résultat booléen en `true`/`false`/`null` ; un résultat texte tel quel. Les normalisations d'écriture du §1.4 ne s'y appliquent pas : la valeur est calculée par PostgreSQL, elle n'a jamais transité par le chemin d'écriture. Une formule texte peut donc contenir des espaces de bordure si l'expression en produit ; c'est la responsabilité de l'expression, et `SANSESPACES` existe pour cela.

**Un champ formule est en lecture seule sur tous les chemins.** Toute tentative d'écriture — API, MCP, import, y compris avec la valeur exacte déjà calculée — est refusée par `COMPUTED_FIELD_READ_ONLY` **avant** l'émission du SQL ; sans ce contrôle, PostgreSQL répondrait `428C9`, message incompréhensible pour un intégrateur. Le champ est marqué `readOnly` dans OpenAPI et dans la description MCP, au même titre que les colonnes système.

`NULL` se propage comme en SQL, à deux exceptions documentées : `&` traite l'absence comme une chaîne vide, `SIVIDE` la remplace. Conséquence à énoncer dans l'interface : `SI([a] = [b]; "identiques"; "différents")` renvoie « différents » quand l'un des deux est vide, une comparaison avec `NULL` valant `NULL`.

Une formule **ne peut pas être obligatoire** : son résultat peut légitimement être nul, et `NOT NULL` sur une colonne générée ferait échouer l'écriture de la ligne pour une raison que l'utilisateur ne contrôle pas. Elle peut en revanche être triable et unique, comme toute colonne stockée, avec les contrôles du §1.6.

### 7.5 Dépendances, renommage, cycles

Les dépendances sont matérialisées dans `field_formula_dependency`, une ligne par couple (formule, champ référencé), ce qui rend déclaratifs deux refus : supprimer logiquement ou convertir un champ dont une formule vivante dépend (`FIELD_USED_BY_FORMULA`, §1.11 et §8), et purger ce même champ (`ck_dep_purge_order`, chapitre 02). C'est cette ligne typée, et non le `jsonb` de l'arbre, qui porte la garantie référentielle.

**Un champ lien n'est pas référençable** dans une formule (`FORMULA_LINK_FORBIDDEN`) : une formule ne traverse pas un lien elle-même. Elle cite une recherche ou un cumul (§7 ter), qui le font pour elle et dont le catalogue porte le chemin ; la dépendance reste dans la même table — `table_id` partagé entre les deux bouts.

**Renommage.** L'expression est stockée **sous forme d'arbre syntaxique** dans `field_formula_config.ast`, dont les nœuds de champ portent la clé de catalogue du champ, jamais son libellé ; `input_expression` conserve à côté la forme saisie, pour réafficher exactement ce que l'utilisateur a tapé. Renommer le libellé d'un champ ne touche donc ni l'arbre, ni la base : la chaîne réaffichée est **réémise depuis l'arbre** avec les libellés courants, jamais obtenue par substitution textuelle. Une substitution casserait sur un libellé contenant un crochet, sur un libellé sous-chaîne d'un autre, et ferait retraverser au texte de l'utilisateur un chemin dont le §7.6 garantit qu'il n'existe pas. La colonne générée, elle, est bâtie sur des **noms physiques**, qui ne changent jamais.

**Cycles.** PostgreSQL interdit qu'une colonne générée en référence une autre. Le graphe de dépendances a donc une profondeur de 1 et **un cycle est structurellement impossible**. Le contrôle est néanmoins écrit côté moteur, avec le refus nommé `FORMULA_DEPENDS_ON_FORMULA`, parce que le message serveur brut est obscur et que la limitation doit être expliquée avant d'être subie. Contrepartie franche : on ne peut pas chaîner deux formules, il faut réécrire l'expression complète.

### 7.6 Surface d'injection

Un `GENERATED ALWAYS AS` n'accepte pas de paramètre lié : l'expression est nécessairement concaténée dans le DDL. Le générateur ne produit donc du SQL **qu'à partir de l'arbre syntaxique**, jamais du texte saisi :

1. les références de champ deviennent des **noms physiques du registre**, quotés, revalidés contre l'alphabet B du chapitre 01 juste avant émission ;
2. les opérateurs et les noms de fonctions viennent d'une **table close** compilée avec le produit — celle du §7.3, et rien d'autre ;
3. les littéraux sont **réémis depuis leur valeur typée** selon la règle du §1.1.

Aucun octet de l'utilisateur ne traverse tel quel. Filet de sécurité final : PostgreSQL lui-même refuse toute expression non immuable (`42P17`), traduite en `FORMULA_NOT_IMMUTABLE` — ce refus ne doit jamais se produire, il signale un défaut du moteur et non une erreur de l'utilisateur.

### 7.7 Modifier ou supprimer une formule

PostgreSQL 16 ne connaît pas `ALTER TABLE … ALTER COLUMN … SET EXPRESSION`. Modifier une formule est donc `DROP COLUMN` puis `ADD COLUMN` dans la même étape, avec le **même nom physique** : il ne s'agit pas d'une réattribution de nom, l'objet de catalogue est le même. Quatre conséquences à annoncer avant exécution :

1. la table est **intégralement réécrite** sous `ACCESS EXCLUSIVE`, au même titre qu'à la création (§7.1) ;
2. la colonne se retrouve en dernière position en SQL direct ; l'ordre exposé par l'API suit `field.position` et ne bouge pas ;
3. **tout index posé sur la colonne est détruit avec elle** — un index qui contient une colonne supprimée disparaît sans avertissement — et doit être recréé, à partir du catalogue, selon le patron du §1.10 ;
4. l'opération consomme un numéro d'attribut, définitivement (§1.13).

**Dépendances de vues.** `DROP COLUMN` échoue en `2BP01` si un objet dépend de la colonne. Or le cycle de vie du produit crée des alias de compatibilité sous forme de schémas de vues SQL : toute vue projetant la colonne bloque le `DROP`, et un `CASCADE` détruirait l'alias, donc le contrat de compatibilité annoncé aux consommateurs. **Avant tout `DROP COLUMN`** — ici comme dans la conversion du §8 et dans la purge —, le moteur interroge `pg_depend` et `pg_rewrite` pour lister les vues dépendantes. S'il en existe, deux issues : reconstruire les vues d'alias concernées dans la même étape, ce que le chapitre 06 spécifie et que le moteur propose par défaut ; ou refuser par `COLUMN_HAS_VIEW_DEPENDENCIES`, en nommant les vues et les schémas d'alias. Jamais de `CASCADE`.

`SET EXPRESSION`, apporté par une version ultérieure, éviterait le couple `DROP`/`ADD` et ne consommerait pas de numéro d'attribut — mais **réécrirait la table exactement comme aujourd'hui**. Le gain porte sur la simplicité, jamais sur le coût.

---

## 7 ter. Recherche, cumul, décompte — lire à travers une relation

Trois types qui ne stockent rien et **lisent les lignes liées** : la **recherche** (`lookup`) ramène un champ de chaque ligne liée — la ville du client d'une facture, les rôles des personnes assignées à une tâche ; le **cumul** (`rollup`) les agrège — le total des factures d'un client, la date la plus tardive des tâches d'un projet ; le **décompte** (`count`) les compte. Ce sont les usages qu'une grille demande le plus souvent à une relation, et ceux qu'une formule stockée ne peut pas servir : PostgreSQL refuse qu'une colonne générée lise une autre ligne.

### 7 ter.1 Le chemin

Chacun suit **un seul** champ relation, dans un sens ou dans l'autre :

| Sens | Ce qui est suivi | Lignes atteintes |
|---|---|---|
| **sortant** | un `link` ou un `multi_link` de la table | la ligne désignée, ou celles de la liste dans leur ordre |
| **entrant** | un `link` ou un `multi_link` d'une autre table de la base qui désigne celle-ci — les liens inverses du §6 | les lignes qui désignent la ligne lue, par `_id` croissant |

Le sens entrant fait d'un lien inverse une colonne : « Nombre de tâches » sur une personne, « Montant facturé » sur un client, sans qu'un champ n'ait à être créé des deux côtés. Un niveau, jamais deux : une recherche ne suit pas une recherche, et ne cite ni une relation, ni un fichier, ni un choix multiple, ni un champ lui-même calculé à la lecture — sa valeur serait une liste de listes.

| Type | Configuration | Résultat |
|---|---|---|
| `lookup` | le chemin, un champ de la cible | la valeur du champ pour un `link` sortant ; une **liste** de valeurs sinon, dans l'ordre des lignes atteintes. Le type est celui du champ cité, dont l'écran reprend le format et les options |
| `rollup` | le chemin, un champ de la cible, une agrégation : `count` (valeurs renseignées), `sum`, `avg`, `min`, `max` | un nombre pour `count`, `sum`, `avg` ; le type du champ pour `min` et `max`, qui ne portent que sur nombres, dates et dates-heures |
| `count` | le chemin | le nombre de lignes atteintes |

La configuration est `field_rollup_config`, satellite commun aux trois : `via_field_id` (le champ relation suivi), `direction`, `target_field_id`, `aggregate`, `result_kind`. Les références sont des clés de catalogue : renommer un champ n'y change rien. Supprimer ou convertir un champ cité est refusé tant qu'un champ calculé le cite.

### 7 ter.2 Les droits

Lire à travers une relation, c'est lire la cible : **le lecteur doit pouvoir lire la table atteinte et le champ cité**, et ne voit que les lignes que son prédicat de lignes lui laisse. Sinon, le champ calculé est **masqué** pour lui, comme un champ qu'il n'a pas le droit de voir : absent de la réponse, du filtre, du tri. Un total qui compterait les factures qu'il ne peut pas voir en dirait le montant ; un décompte, le nombre. Le prédicat de la cible est donc écrit **dans** chaque sous-requête, comme dans un chemin de filtre (§4.7).

### 7 ter.3 Projection, filtre, tri

Les champs calculés à la lecture d'une table — ces trois types et les formules du §7.1 qui ne sont pas stockées — sont projetés par **une seule jointure latérale** par lecture :

```sql
SELECT t."_id", t."nom", v."total_factures", v."nombre_de_taches"
  FROM "b_t4z56fq_crm"."clients" AS t
  CROSS JOIN LATERAL (SELECT
    (SELECT sum(x."montant") FROM "b_t4z56fq_crm"."factures" AS x
      WHERE x."clients_id" = t."_id" AND ( /*predicat_lignes:factures*/ TRUE )) AS "total_factures",
    (SELECT count(*) FROM "b_t4z56fq_crm"."taches" AS x
      WHERE x."clients_ids" @> ARRAY[t."_id"] AND ( TRUE )) AS "nombre_de_taches"
  ) AS v
 WHERE …
```

Filtre, tri, curseur et agrégats nomment `v."…"` comme ils nomment `t."…"` : l'opérateur d'un champ calculé est celui de son type de résultat, une liste se filtre par `has_any` et `has_all`. Aucun index ne sert ces colonnes ; la borne de coût du §1.9 s'applique à leur tri comme à tout tri non indexé.

Une écriture ne les accepte jamais (`COMPUTED_FIELD_READ_ONLY`) ; un import, un formulaire ne les proposent pas ; l'historique ne les porte pas — ce qui change, c'est la ligne liée, et c'est elle que l'historique retient.

---

## 7 bis. L'option IA — un champ calculé par l'IA

*Décision du propriétaire*, qui rouvre INV-IA1 et INV-IA2 pour cette seule option : le chapitre 12 (§ 1.5) dit dans quelles bornes. Ce paragraphe dit ce que devient la colonne.

*Décision révisée* : l'IA était d'abord un **type**, `ai`, une colonne `text`. Elle est désormais une **option** que porte un champ de l'un de ces sept types : `short_text`, `long_text`, `url`, `number`, `select`, `boolean`, `date`. La colonne garde son type, ses contraintes, ses filtres et son rendu ; le satellite `_basedb.field_ai_config` dit seulement qu'elle est calculée, et comment. Un nombre extrait d'un texte se trie comme un nombre, une catégorie proposée par le modèle se filtre comme une liste de choix — ce qu'une colonne `text` n'aurait jamais permis. Les autres types n'en veulent pas (`REQUEST_INVALID`, `type_sans_ia`) : une date-heure demanderait un fuseau que le modèle ne connaît pas, un fichier des octets, une relation un identifiant qu'il ne peut pas inventer, une formule est déjà calculée. Le satellite porte le type du champ, sous une clé étrangère composite `(field_id, kind)` vers `field`, et son `CHECK` liste les sept : un type qui n'y figure pas ne peut pas recevoir l'option, même par une écriture directe du catalogue.

**Activer, désactiver.** L'écran de champ porte un interrupteur « IA ». L'activer sur un champ existant pose le satellite — consigne, régime, consentement, comme à la création — et retire la colonne des masques d'écriture ; le désactiver supprime le satellite, et le champ redevient un champ ordinaire, ses valeurs calculées gardées telles quelles. Dans les deux cas le champ est touché (`updated_at`), ce qui fait avancer la version du catalogue : lecteurs et agents voient le changement à leur lecture suivante.

**Une colonne que seul le noyau écrit.** Son auteur écrit une **consigne** qui cite d'autres colonnes de la ligne — `Résume {{Notes}} pour {{Client}} en une phrase` — et choisit **quand** elle s'exécute. Le noyau lit les valeurs citées, les met à la place des citations, pose la question au fournisseur du tenant et écrit la réponse dans la cellule. Aucune personne, aucun jeton, aucun agent n'écrit la colonne tant que l'option est active : le décideur la retire de tout masque d'écriture (`FIELD_NOT_WRITABLE`), comme une formule. Elle ne peut pas être rendue obligatoire (`REQUEST_INVALID`, `champ_ia`) : une ligne naît sans valeur, puisque personne ne peut lui en donner une.

**La réponse est lue dans le type du champ.** Le modèle répond toujours une chaîne ; le noyau lui dit laquelle est attendue (`expected_format`), et la relit :

| Type | Ce qui est demandé | Ce qui est lu |
|---|---|---|
| `short_text` | un texte court, sur une ligne | la réponse, ses retours à la ligne remplacés par des espaces |
| `long_text` | texte libre | la réponse telle quelle |
| `url` | une adresse complète, `https://` ou `mailto:` | la première adresse de la réponse, normalisée comme une saisie (§2.7) |
| `number` | un nombre seul, point décimal | le premier nombre, espaces de milliers et virgule décimale compris |
| `select` | exactement une des options, par son libellé | l'option dont la valeur ou le libellé égale la réponse (casse, accents et guillemets ignorés), à défaut **la seule** option nommée dans la réponse |
| `boolean` | « oui » ou « non » | le premier mot : oui, yes, vrai, true, 1 — ou leurs contraires |
| `date` | `AAAA-MM-JJ` | la première date ISO, ou `JJ/MM/AAAA`, **qui existe** (`2026-02-30` n'en est pas une) |

Une réponse où rien ne se lit n'est **pas forcée** dans le type : elle est refusée (`AI_RESPONSE_UNUSABLE`, `type_attendu`), la cellule reste vide, et la ligne est reprise plus tard, de moins en moins souvent (chapitre 12 § 1.5). Écrire ce que le modèle n'a pas dit — un zéro pour un nombre illisible, la première option pour une catégorie ambiguë — serait pire qu'une cellule vide.

**La consigne cite par libellé, le catalogue garde le nom physique.** `{{Notes}}`, `{{ notes }}` et `{{notes}}` désignent la même colonne (libellé plié comme au §1.8, ou nom physique) ; `_basedb.field_ai_config.prompt` la garde sous `{{notes}}`, qui survit au renommage du libellé. Une citation qui ne désigne aucune colonne **lisible par l'auteur** est refusée en la nommant (`variable_inconnue`) : une consigne qui lirait du vide là où une colonne était voulue remplirait mille cellules de non-sens avant qu'on s'en aperçoive. Un champ ne se cite pas lui-même (`variable_circulaire`). Consigne : 1 à 8 000 caractères (`ck_ai_prompt`).

**Chaque valeur est lue comme une personne la lit** : un choix par son libellé, un choix multiple par ses libellés séparés de virgules, un lien par la valeur d'affichage de la cible, un fichier par son nom, un nombre sans ses zéros de fin, un booléen par « oui »/« non », une cellule vide par `(vide)`. Une valeur est coupée à 4 000 caractères ; la réponse, validée contre le schéma `{ "value": string }`, est coupée à 10 000.

**Deux régimes de rafraîchissement** (`refresh_mode`) :

| Régime | Ce qui est calculé |
|---|---|
| `if_empty` | Toute cellule vide, au prochain passage : une ligne créée est remplie dans les secondes qui suivent, et une ligne dont une colonne citée change est recalculée de même |
| `schedule` | Les cellules vides, **et** toutes les lignes à chaque échéance d'une expression cron |

**Une colonne citée qui change rejoue le calcul**, dans les deux régimes. La réponse vaut pour les valeurs qu'elle a lues : si l'une d'elles change, elle ne vaut plus pour la ligne. `updateRecord` vide donc la cellule dans la même instruction — `"resume" = CASE WHEN "notes" IS DISTINCT FROM $1 THEN NULL ELSE "resume" END` —, et le prochain passage la remplit comme une cellule neuve. `IS DISTINCT FROM` et non la seule présence de la colonne dans l'écriture : réécrire une valeur telle qu'elle était ne coûte pas d'appel. Seule l'écriture d'une personne, d'un jeton ou d'un agent vide la cellule ; celle du noyau non : un champ calculé par l'IA et cité par un autre n'invalide pas ce dernier quand il est recalculé, sans quoi deux champs qui se citent l'un l'autre se recalculeraient sans fin, un appel à chaque fois.

**Une cellule vide n'est pas une cellule sans réponse** — pour les deux types texte, les seuls qui ont une valeur vide à écrire. `NULL` veut dire *à calculer* ; `''` veut dire *calculé, et la réponse est vide*. (Les autres types n'ont pas de `''` : quand les colonnes citées sont vides, ou que la réponse est vide, la cellule reste `NULL` et la ligne est reprise selon le recul du chapitre 12 § 1.5, `AI_RESPONSE_UNUSABLE`, `rien_a_lire` ou `type_attendu`.) Quand toutes les colonnes citées d'une ligne sont vides, le modèle n'a rien à lire : la ligne ne lui est pas envoyée, et la cellule reçoit `''` sans appel. Quand le modèle répond vide — sa consigne le lui demande « faute de données » —, c'est une réponse, écrite telle quelle. Dans les deux cas la cellule est réglée : laissée à `NULL`, elle serait reprise à chaque passage, un appel à chaque fois, sans jamais rien donner. Remplir une colonne citée la vide, et elle est calculée alors. Une consigne qui ne cite aucune colonne ne demande pas de données et s'exécute toujours. L'écran montre `''` comme un tiret, et un `NULL` comme un calcul en cours.

L'expression cron a cinq champs (minute, heure, jour du mois, mois, jour de semaine), avec `*`, listes, intervalles et pas ; un jour satisfaisant **l'une ou l'autre** des deux restrictions de jour convient, comme dans tout cron. Elle est lue dans le **fuseau de l'auteur** (`refresh_timezone`, IANA) : « tous les jours à 8 h » reste 8 h de part et d'autre du changement d'heure. Sont refusées une expression invalide (`cron_invalide`, avec le champ fautif), un fuseau inconnu (`fuseau_inconnu`), une expression qu'aucune date ne satisfait (`cron_sans_date`, `0 0 31 2 *`) et **deux exécutions à moins de 15 minutes** (`frequence_trop_haute`) : chaque exécution est un appel par ligne. L'écran construit l'expression à partir de fréquences nommées — toutes les N minutes ou heures, tous les jours, chaque semaine, chaque mois — et montre les cinq prochains passages, calculés par le serveur.

**« Recalculer »** une ligne est un acte de personne, qui demande `update` sur la table et écrase la valeur, quelle qu'elle soit. **« Tout recalculer »** (`manage_schema`) repasse sur toutes les lignes, en arrière-plan ; changer la consigne le propose.

**Filtres, tri, rendu** : ceux du type du champ (§9) — l'option n'en retire ni n'en ajoute aucun.

**Écarts avec l'écriture SQL directe (§1.12).** Rien n'empêche un `UPDATE` en psql d'écrire la colonne : aucune contrainte ne sait qui écrit. La valeur sera réécrite au prochain recalcul planifié, ou jamais en régime `if_empty`. De même, un `UPDATE` en psql d'une colonne citée ne vide pas la cellule : c'est le noyau qui le fait en écrivant, pas une contrainte ni un déclencheur. L'historique nomme l'auteur — `system` pour le noyau, la personne pour « Recalculer », `sql_direct` sinon.

---

## 8. Conversions entre types

Le `kind` d'un champ est immuable (chapitre 02). Une « conversion » est une procédure qui produit un plan de migration ordinaire, en six étapes **dans cet ordre**. **Cette matrice et cette procédure sont les seules du document** ; les autres chapitres y renvoient.

1. **contrôles d'engagement du champ source** : s'il est désigné comme colonne d'affichage de sa table, refus `DISPLAY_FIELD_IN_USE` (A15) — la conversion crée un champ neuf, la désignation ne bascule pas toute seule ; si une formule vivante en dépend, refus `FIELD_USED_BY_FORMULA` avec la liste, la conversion ne pouvant pas garantir que l'expression reste typée ; si des vues d'alias le projettent, application de la règle du §7.7 ; vérification du budget d'attributs (§1.13) ;
2. **pré-contrôle des valeurs non convertibles**, avec échantillon de 50 lignes, et arbitrage de l'utilisateur : annuler, ou mettre à `NULL` les valeurs non convertibles. Refus nommé : `CONVERSION_VALUES_INCOMPATIBLE` ;
3. création d'un champ du type cible, avec un **nom physique neuf** alloué par le registre, en `definition_state = 'pending'` ;
4. `UPDATE` de recopie avec l'expression de conversion, soumis aux règles de volume du §1.10 ;
5. pose des contraintes et index du type cible selon les patrons du §1.10, puis suppression logique de l'ancien champ selon le §1.11 ;
6. attribution du libellé de l'ancien champ au nouveau, `field.superseded_by_field_id` de l'ancien renseigné, bascule du nouveau en `active`, et `ANALYZE` de la table. **Le nom physique reste le nouveau** : le registre ne réattribue jamais un nom (chapitre 01 §6.3), et l'ancien passe à `retired` puis `relegated`. Une conversion change donc le nom de colonne exposé en SQL direct ; c'est annoncé avant exécution, et c'est la contrepartie assumée de la règle de non-réattribution.

Le pré-contrôle **précède** la recopie : l'ordre inverse ferait échouer l'étape sur la première valeur invalide, en erreur serveur brute.

**Toute expression de recopie est totale**, c'est-à-dire qu'elle ne peut pas lever. Un cast nu (`"a"::numeric`, `::date`, `::uuid`) s'arrête à la première valeur invalide et annule tout. Le moteur s'appuie sur `pg_input_is_valid`, qui est la raison principale du plancher PostgreSQL 16 :

```sql
-- recopie
UPDATE "b_t4z56fq_crm"."factures"
   SET "echeance_2" = CASE
         WHEN "echeance" ~ '^\d{4}-\d{2}-\d{2}$'
          AND pg_input_is_valid("echeance", 'date') THEN "echeance"::date
         ELSE NULL END;

-- echantillon des valeurs non convertibles, etape 2
SELECT "_id", "echeance" FROM "b_t4z56fq_crm"."factures"
 WHERE "echeance" IS NOT NULL
   AND (NOT "echeance" ~ '^\d{4}-\d{2}-\d{2}$'
        OR NOT pg_input_is_valid("echeance", 'date'))
 LIMIT 50;
```

Le filtre de forme est indispensable **avant** le test de validité : `pg_input_is_valid('01/02/2026','date')` répond vrai, la valeur étant interprétée selon `DateStyle`. Le contrat de connexion du chapitre 01 fixe `DateStyle = 'ISO, YMD'`, ce qui rend le résultat déterministe, mais déterministe n'est pas non ambigu : seule la forme ISO stricte est acceptée. La même construction s'applique à `numeric`, `uuid` et `timestamptz`, avec pour chacun son filtre de forme ; pour `numeric`, le filtre exclut en outre `NaN` et les infinis, que `pg_input_is_valid` accepte (§1.7).

| Depuis \ Vers | `short_text` | `number` | `boolean` | `date` | `datetime` | `select` | `link` | `formula` |
|---|---|---|---|---|---|---|---|---|
| `short_text` | ✔ | contrôlée | contrôlée | ISO strict | ISO strict | ✔ crée les options | par `_id` seul | ✘ |
| `number` | ✔ | ✔ (précision) | `<> 0` | ✘ | ✘ | ✘ | ✘ | ✘ |
| `boolean` | ✔ | 0/1 | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| `date` | ✔ | ✘ | ✘ | ✔ | minuit, fuseau demandé | ✘ | ✘ | ✘ |
| `datetime` | ✔ | ✘ | ✘ | perte de l'heure | ✔ (mode de fuseau) | ✘ | ✘ | ✘ |
| `select` | ✔ | contrôlée | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ |
| `link` | ✔ (l'UUID) | ✘ | ✘ | ✘ | ✘ | ✘ | autre cible : ✘ | ✘ |
| `formula` | ✔ matérialise | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | ✔ |

`long_text` suit `short_text`, à ceci près qu'il n'est ni triable ni unique à l'arrivée (§2.2).

Règles derrière le tableau. **Aucune heuristique de format** : `"01/02/2026"` est ambigu et n'est jamais interprété. **`number` → `number`** n'est pas un cas vide : c'est le chemin de changement de précision ou d'échelle (§2.3), avec ses deux pré-contrôles. **Texte → `select`** crée les options à partir des valeurs distinctes, plafonnées à 200, chacune slugifiée puis présentée à l'utilisateur avant validation. **Texte → `link`** ne rapproche que sur `_id`, jamais sur la valeur d'affichage, qui n'est pas unique ; la clé étrangère est posée par le chemin (b) du §4.1, pré-contrôle d'orphelins compris. C'est une conversion de structure et non un import : elle ne résout aucun identifiant, elle vérifie que ceux déjà présents désignent des lignes existantes. **`link` → autre cible** est refusé : c'est une autre relation, donc un autre champ. **`datetime` → `datetime`** couvre le changement de `timezone_mode`, qui ne touche pas le stockage et ne demande donc ni recopie ni réécriture — c'est la seule « conversion » qui se réduit à une écriture de catalogue, et la seule qui conserve le nom physique. **`formula` → type simple** matérialise le résultat et fige le champ : c'est la sortie de secours quand une formule devient trop contrainte, et elle s'écrit `ALTER COLUMN … DROP EXPRESSION` suivi de la pose des contraintes du type cible, sans recopie ni réécriture — donc sans nom physique neuf non plus.

---

## 9. Récapitulatif normatif

Ce tableau est la **liste de référence** des opérateurs, des contraintes et des index par type. Toute divergence entre le corps du chapitre et ce tableau se tranche en faveur du tableau ; c'est lui que la spécification OpenAPI et la description MCP dérivent, sans en ajouter ni en renommer aucun.

**Vocabulaire unique des opérateurs de filtre**, exposé tel quel par l'API REST et par le MCP (A2) :

| Opérateur | Sens | SQL émis |
|---|---|---|
| `eq` / `ne` | égal / différent, sensible à la casse et aux accents | `=` / `<>` |
| `eq_ci` | égal, insensible à la casse et aux accents | `_basedb_local.fold_v1("c") = _basedb_local.fold_v1($1)` |
| `contains` / `starts_with` / `ends_with` | sous-chaîne, préfixe, suffixe, insensibles | `LIKE` sur `fold_v1`, métacaractères échappés |
| `in` | appartenance à une liste bornée | `= ANY($1)` |
| `is_null` | non renseigné | `"c" IS NULL` |
| `gt` / `gte` / `lt` / `lte` | comparaisons ordonnées, **dates comprises** | `>` `>=` `<` `<=` |
| `between` | encadrement, bornes incluses | `BETWEEN $1 AND $2` |
| `has_any` | la liste contient au moins une des valeurs (choix multiple) | `"c" && $1::text[]` |
| `has_all` | la liste contient toutes les valeurs (choix multiple) | `"c" @> $1::text[]` |

Quinze opérateurs, et aucun autre : les treize de la v1, et les deux du choix multiple (§3.1), qui n'ont de sens sur aucun autre type. La négation d'`is_null` est exprimée par la négation du filtre, pas par un opérateur de plus ; « ne contient aucune » s'écrit `not … has_any`.

| Type | Type PostgreSQL | Contraintes générées | Opérateurs | Index |
|---|---|---|---|---|
| `short_text` | `text` | `ck__not_empty`, `ck__length` | `eq`, `eq_ci`, `ne`, `contains`, `starts_with`, `ends_with`, `in`, `is_null` | aucun par défaut ; btree `("c" COLLATE "und-x-icu", "_id")` si `is_sortable` (max. 500 caractères) ; GIN trigramme si `is_searchable` |
| `long_text` | `text` | `ck__not_empty`, `ck__length` (1 Mio, en octets), `ck__format` si riche | `contains`, `is_null` | aucun ; GIN trigramme si `is_searchable`. Ni tri, ni unicité |
| `number` | `numeric(p,s)` | `ck__range` (finitude, plus bornes si définies) | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `is_null` | btree `("c","_id")` si `is_sortable` |
| `boolean` | `boolean` | — | `eq`, `is_null` | aucun ; partiel `("_id") WHERE "c"` selon `indexed_side` |
| `date` | `date` | `ck__range` (finitude) | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `between`, `is_null` | btree `("c","_id")` si `is_sortable` |
| `datetime` | `timestamptz` | `ck__range` (finitude) | idem `date` | btree `("c","_id")` si `is_sortable` |
| `select` | `text` | `ck__not_empty`, `ck__enum` | `eq`, `ne`, `in`, `is_null` | aucun ; btree si `is_sortable` |
| `multi_select` | `text[]` | `ck__enum` (`<@`, non vide, à une dimension) | `has_any`, `has_all`, `is_null` | aucun ; GIN si le volume l'exige. Pas de tri |
| `file` / `image` | `jsonb` (liste de fichiers) | `ck__files` (tableau de 1 à 20 entrées) | `is_null` | aucun. Pas de tri |
| `url` | `text` | `ck__url` (`http(s)://` ou `mailto:`, 2 048 caractères) | idem `short_text` | aucun ; btree si `is_sortable` |
| `link` (« Relation ») | `uuid` | `fk_<table>__<colonne>` (`NO ACTION` pour `restrict`, `SET NULL` en option, `CASCADE` réservé) | `eq`, `ne`, `in`, `is_null` ; sur la valeur d'affichage de la cible : `contains`, `starts_with`, `eq_ci`, avec jointure, un seul niveau | **`ix_<table>__<colonne>` systématique**, sur `("c","_id")` — remplacé par `uq_<table>__<colonne>` si le champ est unique |
| `multi_link` (« Relation multiple ») | `uuid[]` | aucune ; `tg_<table>__ml_<colonne>` et `tg_<cible>__mlt_<table>_<colonne>` (§4 bis.1) | `has_any`, `has_all`, `is_null` ; sur la cible : un `EXISTS`, un seul niveau | **GIN `ix_<table>__<colonne>` systématique**. Pas de tri |
| `email` | `text` | `ck__email` (forme `x@y.z`, 254 caractères) | idem `short_text` | aucun |
| `autonumber` | `bigint GENERATED BY DEFAULT AS IDENTITY` | — (jamais `NOT NULL` déclaré : l'identité le garantit) | `eq`, `ne`, `in`, `gt`, `gte`, `lt`, `lte`, `between`, `is_null` | aucun |
| `user` (« Personne ») | `uuid` | — (la personne est vérifiée à l'écriture par le noyau, §2.10) | `eq`, `ne`, `in`, `is_null` | aucun |
| `formula` | type du résultat, généré `STORED` | celles du type de résultat | ceux du type de résultat | selon `is_sortable` et l'unicité |

`NOT NULL` s'ajoute à toute colonne dont `field.is_required` est vrai — sauf `formula` et un champ calculé par l'IA (§7 bis), qui ne peuvent pas l'être. L'option IA ne change rien d'autre à cette ligne du tableau : un `number` calculé par l'IA a les contraintes, les opérateurs et les index d'un `number`. `uq_<table>__<colonne>` s'ajoute à toute colonne portant une contrainte d'unicité — sauf `long_text`, qui ne peut pas en porter. `is_null` se lit partout `"c" IS NULL`, la chaîne vide n'existant pas en base (§1.3).

---

## 10. Colonnes système : projection et sérialisation

Le chapitre 01 fixe les cinq colonnes système et leur réserve leurs noms ; le chapitre 02 donne l'en-tête de table et le corps des fonctions partagées. Ce chapitre fixe les **types** et la **sérialisation**.

| Colonne | Type PostgreSQL | Sérialisation JSON |
|---|---|---|
| `_id` | `uuid` | chaîne UUID canonique |
| `_created_at` | `timestamptz` | ISO 8601 UTC, six décimales |
| `_updated_at` | `timestamptz` | ISO 8601 UTC, six décimales |
| `_created_by` | `uuid` | chaîne UUID ou `null` |
| `_updated_by` | `uuid` | chaîne UUID ou `null` |

**`_id` est un `uuid` v7**, généré par l'application avant l'insertion, avec un `DEFAULT _basedb_local.uuid_generate_v7()` qui sert les écritures SQL directes (A9). Trois raisons : un identifiant opaque et non devinable, générable côté client sans aller-retour ; un ordre temporel intrinsèque, dont les liens inverses (§6) et la pagination des colonnes système tirent parti sans colonne supplémentaire ; et l'absence de séquence, donc de nom à allouer et d'objet à renommer (chapitre 01 §9.4). *Alternative rejetée* : `bigint` de séquence — plus compact et plus lisible, mais il expose le volume de la base, se devine, et impose un aller-retour avant toute écriture composite.

**`_created_by` et `_updated_by` nuls ont un sens** : « écriture hors application ». L'interface l'affiche ainsi. Ils ne portent aucune clé étrangère vers le catalogue (chapitre 02), ce qui préserve la frontière posée par A9.

Conformément à A18, les cinq colonnes sont **lisibles dès que le droit de lecture est accordé sur la table**, ne sont jamais inscriptibles, et ne peuvent pas porter de permission de champ. `_id` n'est pas fournissable à la création. Elles sont filtrables et triables avec les opérateurs de leur type, et leur sérialisation à six décimales suit la règle du §2.6.

**Deux exigences adressées au moteur DDL**, qui possède le gabarit :

1. l'index d'horodatage porte **`("_updated_at", "_id")`**, et non `_updated_at` seul : c'est la forme que réclame un curseur de synchronisation stable, et le nom `ix_<table>___updated_at` — trois soulignés, le motif rencontrant une colonne système préfixée — atteint 64 octets avec un nom de table de 48, il passe donc par la répartition du budget par composant ;
2. `_updated_at` est tenu par déclencheur et non par l'application — seul moyen qu'une écriture SQL directe mette l'horodatage à jour — au moyen de `_basedb_local.set_updated_at()`, dont le corps emploie `clock_timestamp()` et jamais `now()`. `now()` renvoie l'heure de début de transaction : un `UPDATE` de masse des §3 ou §8, qui dure plusieurs minutes, estamperait des millions de lignes à l'heure où il a commencé, et le filigrane de reprise incrémentale cesserait d'être correct.

**Limite à publier telle quelle.** Un horodatage écrit avant le `COMMIT` ne devient visible qu'après lui : une transaction qui débute à T et valide à T+30 s écrit `_updated_at` sur des lignes qu'aucun lecteur ne voit avant T+30 s. Un consommateur qui interroge « modifié depuis » et a déjà lu jusqu'à T+10 s ne verra jamais ces lignes. Le défaut est structurel et subsiste avec `clock_timestamp()`. **La synchronisation incrémentale exige donc un recouvrement** : le consommateur relit les N dernières secondes, N étant supérieur à la durée maximale de transaction autorisée — `idle_in_transaction_session_timeout` plus `statement_timeout` — et déduplique par `_id`. La valeur de N est publiée dans la documentation générée, à côté du paramètre de synchronisation. Une synchronisation strictement sans perte demanderait une colonne monotone à la visibilité, donc une sixième colonne système, que le cadrage ne prévoit pas ; le sujet est renvoyé au chapitre 07 avec le journal d'événements.

---

## 11. Ce que ce chapitre attend des autres

### 11.1 Du catalogue et du moteur DDL

- Les tables du catalogue et les objets partagés de `_basedb_local` employés ici sont ceux du chapitre 02, sans exception, et n'y sont pas redéfinis ; aucun objet d'un schéma `b_*` ne référence `_basedb` (A9).
- La reprise d'une étape interrompue, la traduction des erreurs serveur résiduelles et la reprise d'un traitement par lots (§1.10).
- **Trois contrôles de réconciliation**, en plus des classes `CAT-*` du chapitre 02 : `TYPE-FP` compare à la base, pour chaque champ vivant, l'**empreinte physique du §1.2** — contrainte ou index manquant, ou présent alors que le drapeau est retombé ; `TYPE-HTML` repasse dans l'assainisseur les valeurs HTML riches d'un échantillon et tient toute divergence avec la forme canonique pour une dérive ; `TYPE-ATTR` recalcule depuis `pg_attribute` le compteur d'attributs consommés du §1.13. Un état physique non terminal depuis plus de 24 heures et un index `indisvalid = false` sont déjà couverts par `CAT-STATE`.

### 11.2 De l'API, du MCP, du cycle de vie et de l'interface

- Le tableau du §9 est la source unique des opérateurs de filtre, des contraintes et des index par type ; les chapitres 08 et 09 y renvoient au lieu d'en redéfinir un jeu.
- La forme de réponse d'un lien (§4.7), y compris la forme masquée de A16, et la description d'une relation (§4.8) sont reprises sans ajout ni recalcul.
- Les bornes sémantiques des liens inverses (§6) et le prédicat de curseur avec sa collation (§1.9) sont repris tels quels ; le contrat HTTP, le format du curseur et son chiffrement appartiennent au chapitre 08.
- Les champs formule et les colonnes système sont marqués `readOnly` ; leur écriture est refusée par `COMPUTED_FIELD_READ_ONLY` avant toute émission de SQL.
- La documentation générée publie le tableau des écarts entre écriture par l'API et écriture SQL directe (§1.12) et la valeur de recouvrement de synchronisation (§10).
- La suppression logique d'un champ défait les objets listés au §1.11 ; la purge et le compactage d'attributs (§1.13) sont des opérations d'administration du chapitre 06.
- L'interface consomme les cas limites du §5 et les bornes du §6 ; ce qu'affiche une cellule de lien, ce que fait un clic et la forme du sélecteur de ligne cible appartiennent au chapitre 11.

---

## 12. Codes d'erreur définis par ce chapitre

Conformément à A23, ces codes sont versés au registre unique `_basedb.error_code` et publiés en annexe du chapitre 00. Ils sont en anglais et en majuscules ASCII (A2), peuvent être ajoutés, jamais renommés ni resémantisés sans changement de version d'API, et ne sont jamais remplacés par une erreur serveur PostgreSQL brute. Chaque charge utile porte le champ concerné, et l'échantillon de 50 lignes quand la règle en prévoit un.

| Code | Déclencheur |
|---|---|
| `VALUE_INVALID` | Type JSON ou format incompatible avec le type de champ ; caractère nul dans une chaîne |
| `TEXT_TOO_LONG` | Valeur dépassant `max_length` |
| `VALUE_NOT_FINITE` | `NaN`, `Infinity` ou `-Infinity` soumis à un champ `number`, `date` ou `datetime` |
| `NUMBER_OUT_OF_RANGE` | Dépassement de `precision` / `scale` (`22003`) |
| `REQUIRED_NULL_VALUES` | Passage à obligatoire d'une colonne contenant des nuls, avec échantillon |
| `INDEX_LENGTH_EXCEEDED` | Tri ou unicité demandés sur un texte de plus de 500 caractères |
| `LENGTH_VALUES_EXCEEDED` | Réduction de `max_length` en deçà de valeurs existantes, avec échantillon |
| `OPTION_IN_USE` | Suppression d'une option de liste portée par des lignes, avec le décompte |
| `LINK_SELF_REQUIRED` | Champ lien réflexif marqué obligatoire |
| `LINK_CASCADE_NOT_GRANTED` | `cascade` sans le droit de gestion du schéma ou sans confirmation saisie |
| `FORMULA_SYNTAX` | Expression non conforme à la grammaire, avec position |
| `FORMULA_FIELD_NOT_FOUND` | Citation d'un libellé de champ inconnu dans la table |
| `FORMULA_TYPE_MISMATCH` | Opérandes de types inconciliables, avec position |
| `FORMULA_FUNCTION_NOT_IMMUTABLE` | Fonction ou conversion dépendant de la session : texte d'une date, extraction sur un `datetime` |
| `FORMULA_NOT_IMMUTABLE` | Refus serveur `42P17` — filet de sécurité, signale un défaut du moteur |
| `FORMULA_DEPENDS_ON_FORMULA` | Formule référençant une autre formule |
| `FORMULA_LINK_FORBIDDEN` | Formule référençant un champ lien |
| `COMPUTED_FIELD_READ_ONLY` | Écriture sur un champ formule, sur n'importe quel chemin |
| `COLUMN_HAS_VIEW_DEPENDENCIES` | `DROP COLUMN` bloqué par des vues SQL d'alias, avec leur liste |
| `CONVERSION_VALUES_INCOMPATIBLE` | Valeurs non convertibles au pré-contrôle d'une conversion, avec échantillon |
| `TABLE_ATTRIBUTES_EXHAUSTED` | Plus de 1 500 numéros d'attribut consommés sur la table |
| `SORT_NOT_INDEXABLE_VOLUME` | Tri non indexable demandé au-delà du seuil de cardinalité |
| `FILTER_NOT_INDEXABLE_VOLUME` | Filtre `contains` non indexé demandé au-delà du seuil de cardinalité |

Codes d'autres chapitres réutilisés tels quels, sans redéfinition : `TABLE_REFERENCED`, `DISPLAY_FIELD_IN_USE`, `DUPLICATE_VALUE`, `LINK_ORPHAN_VALUES`, `LINK_TARGET_NOT_FOUND`, `ROW_REFERENCED`, `LINK_CROSS_DATABASE`, `LOCK_UNAVAILABLE`, `COLLATION_VERSION_MISMATCH`, `DB_ENCODING_NOT_UTF8`, `IDENTIFIER_INVALID`, `NAME_TOO_LONG` ; `LINK_SET_NULL_ON_REQUIRED` et `TIMEZONE_UNKNOWN` (chapitre 03) ; `FIELD_USED_BY_FORMULA` (chapitre 06).

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Un champ = une colonne, jamais d'objet annexe | Une seconde vérité exigerait un déclencheur de synchronisation par table cible | Dénormaliser la valeur d'affichage dans la table source |
| `text` partout, longueur par `CHECK` | La longueur est une règle métier ; `varchar(n)` impose une réécriture pour se resserrer | `varchar(n)` |
| `numeric`, jamais `double precision` | `0.1 + 0.2 <> 0.3` est inacceptable sur des montants | Flottant binaire |
| Nombres sérialisés en **chaîne** JSON, sur toutes les surfaces | `JSON.parse` détruit silencieusement au-delà de 2⁵³ ou de quinze chiffres significatifs | Nombre JSON natif, ou règle conditionnelle selon la précision |
| `date` pour une date, `timestamptz` pour un instant ; l'heure portée par `kind` seul | Une date d'échéance stockée en instant change de jour selon le fuseau du lecteur | `timestamptz` partout, ou un drapeau `avec_heure` redondant |
| Chaîne vide interdite **en base**, `ck__not_empty` sur toute colonne texte et liste de choix | L'invariant doit tenir aussi pour une écriture SQL directe, et surtout sur les champs facultatifs | Contrainte sur les seuls champs obligatoires |
| Contrainte de finitude systématique, portée par `ck__range` | `NaN` et les infinis entrent par SQL direct, cassent tri, agrégats et JSON | Refus à l'entrée de l'API seulement |
| Plans à plusieurs étapes : `NOT VALID` puis `VALIDATE`, `CREATE INDEX CONCURRENTLY` (A11) | Seule façon de poser une contrainte ou un index sur une table volumineuse sans indisponibilité ; l'état intermédiaire est représenté au catalogue | Transaction unique, qui rend l'ajout d'une FK bloquant au-delà de 100 000 lignes |
| `NOT NULL` par échafaudage `ck_…__not_null` validé | `SET NOT NULL` cesse alors de balayer la table sous verrou fort | `SET NOT NULL` nu |
| `ON DELETE NO ACTION` pour `restrict`, `ON UPDATE NO ACTION` toujours (A13) | Même refus que `RESTRICT`, mais vérifié en fin d'instruction : une suppression en lot hiérarchique cesse d'échouer sans raison métier | `ON DELETE RESTRICT ON UPDATE RESTRICT` |
| Cascade exécutée par PostgreSQL, confirmée et journalisée (A14) | Une suppression SQL directe cascade comme une suppression API ; la capture par déclencheur historise les lignes cascadées | Cascade applicative niveau par niveau |
| Le pré-contrôle produit le message, la contrainte produit la garantie | Une course entre les deux est rattrapée et retraduite ; aucune erreur brute ne sort | Se fier au seul pré-contrôle |
| Tri total `(<champ>, "_id")`, ordre des nuls de PostgreSQL, collation aux trois endroits | Un index `(c, _id)` sert alors les deux sens ; sans collation dans le prédicat, la pagination saute ou répète des lignes | Forcer `NULLS LAST`, ou comparer par constructeur de ligne |
| Tris et filtres non indexables bornés par un seuil de cardinalité | Le cadrage exige un comportement correct au-delà de 100 000 lignes | « Le jeu est déjà filtré », qui est faux sur une grille sans filtre |
| Colonne de lien `<table_cible>_id` puis slug du libellé (A7), type `uuid`, `ix_` d'office sur `("c","_id")` | Nom figé, lisible et non ambigu ; sans index, l'évaluation de `NO ACTION` balaie la table source | Suffixe numérique dès le second lien |
| Pas de cardinalité « un vers un » : l'unicité est une ligne de `table_constraint` | Le cadrage ne retient que le plusieurs-vers-un, et l'objet en base est exactement le même | Drapeau, écran, procédure et code d'erreur dédiés |
| Aucune bascule de la colonne d'affichage : refus `DISPLAY_FIELD_IN_USE` (A15) | Une bascule changerait sans prévenir ce que voient tous les consommateurs de tous les liens pointant vers la table | Rebasculer vers le champ suivant, ou vers `_id` |
| Un seul vocabulaire d'opérateurs de filtre (§9), treize entrées, en anglais | Trois vocabulaires concurrents produiraient trois OpenAPI et trois descriptions MCP pour une seule couche de filtrage | Un jeu d'identifiants par surface |
| Forme unique `{"id": null, "display": null, "masked": true}` pour une cible illisible (A16) | Un UUIDv7 porte un horodatage, qui révélerait la date de création d'une ligne interdite au lecteur | Identifiant en clair, ou identifiant opaque calculé par HMAC |
| Liens inter-bases refusés | Préserve le déplacement futur d'un schéma vers une autre instance | Autoriser la clé étrangère inter-schémas |
| Liste de choix en `text` + `CHECK` régénéré, valeurs slugifiées ; multiple hors v1 | `SELECT … WHERE statut = 'paye'` reste lisible et écrivable à la main | `ENUM`, table de référence, ou chaîne à séparateurs |
| Choix multiple en `text[]` + `CHECK` par `<@` ; fichiers en `jsonb` décrivant des octets tenus hors de la base, servis par lien signé | `WHERE 'urgent' = ANY(etiquettes)` reste lisible ; les sauvegardes ne portent pas les PDF | chaîne à séparateurs, `bytea`, `uuid[]` vers le catalogue |
| Suppression d'une option utilisée refusée ; archivage et remplacement proposés | Deux contrats d'API différents ; le refus explicite est celui qui informe | Convertir silencieusement en archivage |
| Formule en colonne générée **stockée**, fonctions de date restreintes aux champs `date` | Visible en SQL direct, indexable, calculée une fois ; aucune expression ne dépend d'un fuseau ni de tzdata | Calcul à la lecture, ou `AT TIME ZONE` concaténé |
| Expression de formule stockée en arbre (`ast`), réémise pour l'affichage | Le renommage n'est plus une substitution textuelle ; le texte utilisateur ne retraverse jamais le générateur | Stocker la chaîne saisie et la réécrire par substitution |
| Tout littéral DDL par `quote_literal` / `%L`, `U+0000` refusé, commentaire borné | `COMMENT ON`, `ck__enum` et les constantes de formule sont trois entrées de texte libre dans du DDL | Concaténer en doublant les quotes à la main |
| Aucune valeur par défaut en v1 | Le catalogue ne stocke aucune expression ni littéral par défaut ; l'introduire demanderait un littéral typé par satellite | Une colonne d'expression par défaut injectée dans du DDL |
| Suppression logique d'un champ : contraintes, index et `NOT NULL` défaits, FK comprise (A17) | Sinon un champ obligatoire supprimé rend toute insertion impossible et une FK fantôme bloque une table que le catalogue croit libre | Renommer la colonne et laisser ses objets en place |
| Budget d'attributs surveillé, alerte à 1 200, refus à 1 500 | Les 1 600 numéros incluent les colonnes supprimées et ne se récupèrent jamais | Découvrir la limite en `54011`, ou trois couples de seuils concurrents |
| Écritures de masse par lots au-delà d'un seuil, `ANALYZE` en fin d'opération | « Une seule transaction » est intenable au-delà de quelques millions de lignes ; sans statistiques, les plans sont faux là où ça coûte le plus | Promettre l'atomicité à toute échelle |
| `_id` en `uuid` v7, `DEFAULT _basedb_local.uuid_generate_v7()` (A9) | Générable avant l'écriture, ordonné dans le temps, pas de séquence à nommer, et colocalisé avec les données | `bigint` de séquence, ou fonction dans `_basedb` ou `public` |
| `_basedb_local.fold_v1` versionnée dans son nom, jamais remplacée, opclass qualifiée | Un `CREATE OR REPLACE` rendrait faux, sans erreur, tous les index d'expression bâtis dessus ; le contrat SQL interdit toute dépendance au `search_path` | Remplacer la fonction en place, opclass non qualifiée |
| Filtres relatifs de date retirés de la v1 | Ils introduiraient un fuseau d'utilisateur et modifieraient le contrat de réponse | « Aujourd'hui », « derniers N jours », « mois en cours » |

## Risques et limites connues

- **Coût de la pose d'une clé étrangère sur la table cible.** `ADD CONSTRAINT … FOREIGN KEY`, même `NOT VALID`, prend un verrou sur les deux tables. L'interruption est brève, le balayage étant reporté à la validation, mais elle existe sur la table la plus référencée de la base.
- **Un index construit `CONCURRENTLY` peut finir invalide** et continue alors d'être mis à jour à chaque écriture. Son nettoyage est une étape à part entière, et `CAT-STATE` le signale s'il est oublié.
- **Effet de file d'attente des verrous.** Une transaction longue ouverte sur une table transforme n'importe quel `ALTER TABLE` en indisponibilité totale de cette table. `lock_timeout` borne le dégât, il ne le supprime pas.
- **Réécriture complète à la création et à la modification d'un champ formule.** Sur plusieurs millions de lignes, c'est une opération de maintenance avec une seconde copie de la table sur disque.
- **Une conversion change le nom physique de la colonne**, le registre ne réattribuant jamais un nom. Un consommateur SQL direct qui lisait l'ancienne colonne doit être prévenu.
- **Épuisement des numéros d'attribut.** Chaque modification de formule et chaque conversion en consomme un, définitivement. Le compactage est une opération d'administration lourde.
- **Dépendance à la version d'ICU.** Les index `COLLATE "und-x-icu"` et ceux bâtis sur `_basedb_local.fold_v1` deviennent silencieusement faux après une mise à jour d'ICU, avec pour symptôme des lignes introuvables par égalité. La version doit être épinglée dans l'image serveur.
- **Synchronisation incrémentale imparfaite.** L'écart entre l'horodatage et la visibilité rend « modifié depuis » incomplet sans recouvrement côté consommateur. La borne publiée est une convention, pas une garantie du serveur.
- **Trois normalisations non tenues en SQL direct** : NFC, espaces de bordure et caractères de contrôle. Documentées comme telles, elles ne mettent en cause aucune règle d'intégrité.
- **Cycles réflexifs possibles.** Assumé pour la v1 ; la donnée est incohérente pour l'utilisateur, sans conséquence technique tant qu'aucune fonctionnalité ne parcourt la hiérarchie.
- **Tri par valeur d'affichage plafonné.** Au-delà du seuil, l'utilisateur d'une grande table trie sur l'identifiant de la cible, c'est-à-dire sur rien de lisible, ou filtre d'abord.
- **Aucune contrainte de format ni valeur par défaut en v1** — courriel, téléphone, code postal, défaut de saisie. Lacunes assumées, renvoyées à la v2.

## Amendement proposé à A6

**Proposition d'amendement à A6 — composant de méthode dans le motif d'index.** A6 fige les motifs de noms dérivés ; `ix_<table>__<colonne>` est donc le motif en vigueur, et ce point n'est pas une question ouverte mais un amendement à instruire. *Constat* : un champ texte à la fois triable et recherchable porte un btree et un GIN trigramme ; le second reçoit `ix_<table>__<colonne>_2` par la boucle de suffixe, ce qui ne dit pas lequel est lequel à la lecture d'un `\d` — `table_index.expression_kind` le dit, le nom non. *Amendement proposé* : étendre le motif d'un composant de méthode, `ix_<table>__<colonne>__<methode>` (`__btree`, `__trgm`), au prix de six à sept octets pris sur le budget de 63 et d'une reprise de la répartition du chapitre 01 §9.6. **Tant que A6 n'est pas amendée, le motif d'A6 et la boucle de suffixe s'appliquent**, et ce chapitre ne suppose nulle part le contraire.

## Questions ouvertes

1. **Seuils de volume.** `sort_scan_threshold` (50 000), `rewrite_warning_threshold` (100 000) et `bulk_rewrite_threshold` (1 000 000) sont proposés ici et configurables par instance dans `_basedb.setting`. Leur valeur par défaut doit être confirmée à l'issue des premiers essais de charge, avec le chapitre 10.
2. **Recouvrement de synchronisation.** La valeur de N publiée aux consommateurs doit-elle être dérivée automatiquement des délais d'expiration des connexions, ou fixée par configuration et vérifiée au démarrage ?

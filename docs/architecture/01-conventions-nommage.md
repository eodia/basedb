# 01 — Conventions de nommage, slugification, identifiants

## Rôle de ce chapitre

Ce chapitre est normatif. Tout nom écrit dans PostgreSQL par basedb — schéma de base, schéma d'alias, table, vue SQL, colonne, contrainte, index, séquence, déclencheur — est produit par les règles décrites ici, et par elles seules. Les autres chapitres réutilisent littéralement les motifs, les budgets d'octets, les états du registre et les codes d'erreur définis ci-dessous.

Deux principes traversent le chapitre.

1. **Le nom physique est calculé une fois, à la création, puis figé.** Rien dans le fonctionnement courant du produit ne recalcule un nom. Le catalogue est le registre de ces noms ; PostgreSQL n'en est que le reflet.
2. **Un nom attribué n'est jamais réattribué.** Quel que soit l'état ultérieur de l'objet — supprimé, purgé, renommé — la chaîne reste occupée à vie dans le registre.

Le registre `_basedb.physical_name` est le seul détenteur des noms physiques (A5). Le présent chapitre définit les **règles de calcul** des noms, les états du registre et leurs transitions ; le stockage — DDL, contraintes, index d'unicité, vue de confort — appartient au chapitre 02 — Schéma du catalogue `_basedb`.

---

## 1. Vocabulaire du projet

Définitions courtes, stables, réutilisées par tous les chapitres. Quand un mot de cette liste apparaît ailleurs dans le document, il a exactement ce sens.

| Terme | Définition |
|---|---|
| **Tenant** | Unité de cloisonnement de plus haut niveau. Porte un `tenantId` opaque et immuable. Un tenant possède des bases, des utilisateurs, des rôles et une configuration. |
| **Base** | Regroupement de tables, projeté sur **un schéma PostgreSQL** nommé `b_<tenantId>_<base>`. Ce n'est jamais une base PostgreSQL au sens `CREATE DATABASE` : l'instance n'en contient qu'une, dite **base d'accueil**. |
| **Schéma** | Objet de catalogue à part entière, projeté sur un `CREATE SCHEMA`. Une base possède exactement un **schéma courant** et zéro ou plusieurs **schémas d'alias** (chapitre 06). C'est le schéma, et non la base, qui porte l'espace de noms des relations. |
| **Table** | Objet métier de basedb, projeté sur **une vraie table PostgreSQL** dans le schéma courant de sa base. |
| **Champ** | Attribut d'une table, projeté sur **une colonne** PostgreSQL typée. Un champ porte un type basedb (chapitre 04), pas un type SQL. |
| **Enregistrement** | Une ligne d'une table, identifiée par la colonne système `_id`. |
| **Lien** | Champ de type lien : une colonne portant une contrainte `FOREIGN KEY` vers le `_id` d'une table cible (chapitre 04). Relation « plusieurs vers un » en v1. |
| **Colonne d'affichage** | Champ d'une table désigné dans le catalogue comme la valeur montrée à la place de `_id` partout où un enregistrement de cette table est référencé. Au plus une par table ; l'absence de désignation est un état valide (A15). |
| **Vue** | Présentation enregistrée d'une table dans l'interface : filtres, tri, colonnes visibles, largeurs. **Objet de catalogue, sans existence physique.** L'objet SQL `CREATE VIEW` est toujours appelé **vue SQL** dans ce document, et n'apparaît que dans les alias de compatibilité (chapitre 06). |
| **Application** | Regroupement nommé de tables et de vues d'une même base, unité de portée des permissions (chapitre 05). Objet de catalogue, sans existence physique. |
| **Libellé** | Chaîne saisie et affichée à l'utilisateur. Libre : accents, majuscules, ponctuation, points, espaces, emoji. Modifiable à tout moment sans effet sur la base. |
| **Nom physique** | Identifiant réellement écrit dans PostgreSQL. Dérivé du libellé à la création, puis indépendant de lui. Conforme aux alphabets normatifs du §2.3. |
| **Clé de catalogue** | Identifiant technique d'un objet de catalogue : `uuid` v7, immuable, jamais dérivé d'un nom. C'est ce que manipulent l'API, le MCP et l'historique. Seul le `tenantId` fait exception : il est opaque mais visible. |
| **Slug** | Résultat de l'algorithme du §3 appliqué à un libellé. Un slug est une *proposition* de nom physique ; il devient nom physique après échappement des préfixes réservés et résolution des collisions (§6.1). |
| **Nom dérivé** | Nom d'un objet que l'utilisateur ne nomme pas : contrainte, index, séquence, déclencheur, colonne de lien, nom de relégation. Assemblé par le moteur à partir des motifs du §9. |

---

## 2. Séparation libellé / nom physique

### 2.1 Trois conséquences à retenir avant toute chose

1. **Renommer un libellé n'émet aucun DDL.** C'est un `UPDATE` d'une ligne de catalogue. L'API, la documentation générée et les outils MCP exposent les deux (`label` et `name`), jamais l'un à la place de l'autre.
2. **Le nom physique n'est jamais recalculé.** Ni à l'ouverture de l'écran de paramétrage, ni lors d'une migration, ni après un changement de version de l'algorithme de slugification. Une évolution de l'algorithme n'affecte que les objets créés après elle — garantie vérifiable parce que chaque ligne de registre porte la version de l'algorithme qui a produit le nom (§3.8, §6.3).
3. **Renommer physiquement est une opération d'administration**, décrite au chapitre 06 (consommateurs listés, alias de compatibilité). Elle consomme un nouveau nom via les mêmes règles et laisse l'ancien occupé à vie.

### 2.2 Contraintes sur le libellé

Ce sont les seules ; aucun libellé n'est refusé pour cause de mot réservé SQL ou de préfixe.

- non vide après suppression des espaces de tête et de fin → sinon `LABEL_EMPTY` ;
- au plus 255 caractères Unicode après normalisation NFC → sinon `LABEL_TOO_LONG` ;
- stocké en **NFC** dans le catalogue, systématiquement, quelle que soit la forme reçue ;
- unique **parmi les objets actifs** de son parent, comparé sur une **clé de comparaison de libellé**.

**Clé de comparaison de libellé.** Elle vaut : NFC → repli de casse Unicode complet en locale racine (« und ») → réduction des suites d'espaces à un espace unique → suppression des espaces de tête et de fin. Deux champs « Résumé » et « résumé » dans la même table sont refusés (`LABEL_DUPLICATE`) ; « Résumé » et « Resume » sont acceptés, car la clé conserve les diacritiques — ils produiront deux noms physiques distincts (§6.1).

Cette clé est **calculée par l'application et stockée** dans la colonne de catalogue `label_key`, qui porte l'index d'unicité, déclaré `COLLATE "C"` et **partiel sur les objets actifs** ; le DDL est au chapitre 02. Toute unicité de libellé fondée sur `lower()` côté serveur est **interdite** : `lower()` n'implémente pas le repli de casse Unicode complet (`ß` n'y devient pas `ss`) et son résultat dépend de la collation de la colonne ; `casefold()` n'est pas supposée disponible. Une règle réalisée à deux endroits par deux algorithmes différents finit toujours par diverger, ici sur `Straße` / `STRASSE`. La version de l'algorithme de repli est versionnée avec celle de la slugification.

**Asymétrie voulue entre libellé et nom physique.** Un objet supprimé logiquement **libère immédiatement son libellé** et **ne libère jamais son nom physique**. Recréer un champ « Remise » après en avoir supprimé un est normal et n'exige rien de l'utilisateur ; le nouveau champ recevra le nom physique `remise_2`. Le libellé appartient à l'utilisateur, le nom physique appartient à l'historique.

Le point, interdit dans les noms physiques parce qu'il est le séparateur de qualification SQL, est **libre dans les libellés** : « Mon.Site.com » est un libellé valide.

### 2.3 Les deux alphabets normatifs

| Alphabet | Expression | Portée | Contrôlé par |
|---|---|---|---|
| **A** — noms alloués | `^[a-z][a-z0-9_]{0,62}$` et `octet_length(nom) <= 63` | Tout nom produit par la slugification, saisi comme nom technique (§2.4) ou assemblé comme nom dérivé (§9) | La procédure d'allocation (§6.1) et la validation d'entrée de l'API |
| **B** — noms émis | `^_?[a-z][a-z0-9_]{0,62}$` et `octet_length(nom) <= 63` | Tout identifiant écrit dans du SQL par le moteur, **alphabet A compris** | La contrainte `CHECK` du registre (chapitre 02) et le constructeur SQL (§10.2) |

L'alphabet B est un sur-ensemble strict de A : il autorise en plus un `_` de tête. Ce souligné initial est **réservé à une liste close, versionnée dans le dépôt**, que la slugification ne peut pas produire (l'étape 7 du §3.2 retire les `_` de tête) :

```
_basedb   _basedb_local
_id   _created_at   _updated_at   _created_by   _updated_by
```

S'y ajoutent les objets fixes du catalogue, qui vivent dans `_basedb` (chapitre 02), et les objets partagés colocalisés avec les données, qui vivent dans `_basedb_local` (A9) : tous portent des noms écrits en dur dans le dépôt et ne passent donc pas par l'allocation. Les deux noms de schéma sont figés et non configurables.

La contrainte d'octets est **écrite explicitement, séparément de l'expression régulière** : `octet_length()` côté SQL, longueur en octets UTF-8 côté application — jamais une longueur en unités UTF-16. Sur l'alphabet retenu un caractère vaut un octet et les deux mesures coïncident ; la contrainte explicite protège d'une régression future de l'alphabet, pas du cas courant.

C'est aussi ce qui permet aux deux alphabets de porter la **même borne de quantificateur**, `{0,62}`, alors que B admet un caractère de plus en tête. La tentation d'écrire `{0,61}` pour B, afin que l'expression borne à elle seule la longueur totale, casserait l'inclusion A ⊆ B : un nom de 63 octets sans `_` de tête — cas parfaitement courant, un nom de schéma `b_<tenantId>_<slug de 53 octets>` en fait exactement 63 — satisferait A mais violerait B, et le moteur ne pourrait pas émettre le SQL d'un objet qu'il vient lui-même d'allouer. C'est `octet_length(nom) <= 63` qui borne la longueur, dans les deux alphabets ; l'expression ne borne que la forme.

### 2.4 Nom technique saisi à la création

À la création d'une base, d'une table ou d'un champ, l'appelant peut fournir un **nom technique** en plus du libellé. Dans ce cas la slugification n'est pas appliquée : la chaîne fournie doit satisfaire l'alphabet A telle quelle, sinon `IDENTIFIER_INVALID` en erreur de validation. Elle passe ensuite par les mêmes contrôles que tout autre candidat : préfixes réservés (§4), mots réservés (§4), disponibilité au registre (§6.1).

Cette possibilité existe pour une raison précise, exposée au §3.7 : un tenant travaillant en écriture non latine n'obtiendrait de la slugification que des noms de repli. Elle lui rend le contrôle sans passer par une opération d'administration.

### 2.5 Restitution du nom attribué

Toute création d'objet **retourne le nom physique effectivement attribué**, après troncature, échappement, suffixe ou repli, dans la réponse de l'API (chapitre 08) comme dans celle du MCP (chapitre 09). Pour une table, la réponse porte aussi le nom du schéma. L'interface l'affiche à la confirmation de création, et l'écran de paramétrage l'affiche en lecture seule à côté du libellé. Un utilisateur qui crée « Liste des contrats de prévoyance collective… » doit voir `liste_des_contrats_de_prevoyance_collective_sous` sans avoir à le deviner : c'est ce nom-là qu'il écrira dans ses requêtes SQL.

---

## 3. Algorithme de slugification

### 3.1 Contrat

Entrée : un libellé Unicode **déjà validé par le §2.2** (non vide, au plus 255 caractères, stocké en NFC) et un budget d'octets `MAX`. L'appelant garantit cette validation ; la slugification ne reborne pas son entrée et ne la revalide pas. Sortie : soit un slug conforme à `^[a-z][a-z0-9_]{0,MAX-1}$`, soit le déclenchement de la règle de repli (§3.5).

L'algorithme est **pur et déterministe**, à la seule exception de la règle de repli, qui tire de l'aléa. Il ne consulte ni le catalogue ni la base : c'est la procédure d'allocation du §6.1 qui transforme sa sortie en nom physique.

### 3.2 Étapes, dans cet ordre exact

1. **Normalisation NFKD.** Une seule forme, la décomposition de compatibilité. Elle traite d'un coup : les diacritiques (`é` → `e` + U+0301), les ligatures (`ﬁ` → `f` + `i`), les formes pleine largeur (`Ａ` → `A`), les indices et exposants (`²` → `2`), les fractions (`½` → `1` + U+2044 + `2`), le `İ` turc (U+0130 → `I` + U+0307), les symboles composés (`№` → `N` + `o`).
2. **Suppression pure** (et non remplacement) de tous les caractères des catégories Unicode **Mn** (marque non espaçante), **Me** (marque englobante), **Cc** (contrôle), **Cf** (format, ce qui couvre le trait d'union conditionnel U+00AD, l'espace sans chasse U+200B, les liants ZWJ/ZWNJ et les marques de direction), ainsi que des sélecteurs de variante U+FE00–U+FE0F. Ces caractères sont invisibles : les remplacer par `_` ferait apparaître des séparateurs fantômes dans le nom physique, ce qui est le pire résultat possible parce qu'il est indétectable à la lecture.
3. **Passage en minuscules** avec la table de correspondance Unicode *complète*, en **locale racine (« und »)**, jamais la locale du système ni celle de l'utilisateur. Le repliement de casse est dépendant de la locale pour au moins trois langues (turc, azéri, lituanien) : le même libellé produirait alors des noms physiques différents selon la machine qui exécute le moteur. C'est inacceptable pour une valeur écrite dans du DDL, rejouée en migration et comparée entre environnements. La locale est donc figée dans le code, jamais héritée de l'environnement.
4. **Seconde suppression** des catégories **Mn**, **Me** et **Cf**. Elle n'est pas redondante : le repliement de casse complet *crée* des marques combinantes — U+0130 se replie en `i` + U+0307, les repliements conditionnels lituaniens ajoutent U+0307 sur `i` et `j`. Une marque produite à l'étape 3 et non filtrée ici deviendrait un `_` à l'étape 6, c'est-à-dire un séparateur fantôme.
5. **Translittération** par table explicite (§3.3), appliquée caractère par caractère. Les caractères absents de la table ne sont pas translittérés : ils tombent dans l'étape 6.
6. **Filtrage.** Tout caractère hors de `[a-z0-9]` est remplacé par `_`. Cela couvre les espaces, la ponctuation, les symboles monétaires, les emoji restants, et **toutes les écritures non latines** (cyrillique, grec, arabe, hébreu, CJK, devanagari) — voir le domaine de validité au §3.7.
7. **Réduction** de toute suite d'au moins deux `_` à un seul, puis **suppression** des `_` de tête et de fin.
8. **Slug vide ?** → règle de repli (§3.5).
9. **Commence par un chiffre ?** → préfixer par `n_` (§3.6).
10. **Troncature** à `MAX` octets (§3.4), puis nouvelle suppression du `_` de fin que la troncature a pu faire apparaître.

À partir de l'étape 6, la chaîne est de l'ASCII pur : un caractère vaut un octet, et la distinction caractères/octets disparaît. C'est volontaire, et c'est la raison principale de la translittération : tous les budgets de ce chapitre sont exprimés en octets parce que `NAMEDATALEN` l'est, et raisonner sur des octets qui ne sont pas des caractères est une source d'erreurs permanente.

### 3.3 Table de translittération

Appliquée après le passage en minuscules ; les clés sont donc en minuscules (`ẞ` est déjà devenu `ß` à l'étape 3, `İ` a été décomposé à l'étape 1).

| Caractère | Rendu | | Caractère | Rendu |
|---|---|---|---|---|
| `ß` | `ss` | | `ı` | `i` |
| `æ` | `ae` | | `ł` | `l` |
| `œ` | `oe` | | `đ` | `d` |
| `ø` | `o` | | `ð` | `d` |
| `þ` | `th` | | `ħ` | `h` |
| `ŋ` | `ng` | | `ə` | `e` |
| `ƀ` | `b` | | `ĸ` | `k` |

Cette table est close pour la v1 : elle couvre les lettres latines dont la décomposition NFKD ne produit pas de base ASCII. Toute entrée ajoutée ultérieurement modifie les noms produits — elle est donc versionnée avec l'algorithme (§3.8) et n'a aucun effet rétroactif. L'entrée `ı` → `i` sert en particulier de filet sous l'étape 3 : si une implémentation appliquait par erreur le repliement turc, `I` deviendrait `ı` et serait ramené ici sur `i` plutôt que transformé en `_`.

### 3.4 Troncature et budgets d'octets

La troncature d'un slug est **dure** : coupe à `MAX` octets, puis suppression d'un éventuel `_` final. Alternative rejetée : reculer jusqu'au dernier `_` pour ne pas couper un mot — plus élégante à lire, mais elle introduit une heuristique (jusqu'où reculer ?) que deux implémentations indépendantes n'appliqueraient pas identiquement, et elle produit des longueurs imprévisibles. Le libellé reste lisible de toute façon : c'est lui qu'on affiche.

Budgets `MAX` par nature d'objet, conformément à A6 :

| Objet | `MAX` (octets) | Origine du chiffre |
|---|---|---|
| Slug de base | **53** | 63 − longueur du préfixe `b_<tenantId>_` (§5) |
| Nom de table | **48** | réserve, justifiée ci-dessous |
| Nom de champ | **48** | idem |
| Nom dérivé assemblé | **63** | limite PostgreSQL brute ; répartition au §9.6 |

**Ce que la réserve de 15 octets garantit.** Elle garantit que les noms dérivés **à un seul composant variable** tiennent dans 63 octets sans aucun rabotage : clé primaire `pk_<table>`, 3 + 48 = 51 ✔ ; colonne de lien `<table_cible>_id`, 48 + 3 = 51 ✔.

**Ce qu'elle ne garantit pas.** Les noms à deux composants ou plus — `fk_`, `ix_`, `uq_`, `ck_`, `tg_` — ne tiennent pas dans le pire cas : `fk_<table>__<colonne de lien>` atteint 3 + 48 + 2 + 51 = **104 octets**, `ck_<table>__<colonne>__<regle>` atteint **113 octets**, et une contrainte d'unicité multi-colonnes n'aurait aucune borne supérieure sans la règle de bornage du §9.6. Ces noms passent par la **répartition du budget par composant** (§9.6), et c'est leur fonctionnement *normal*, pas une exception.

La réserve est néanmoins conservée : elle protège les noms simples ci-dessus, et chaque octet qu'elle retire au nom de table est un octet rendu aux composants d'un nom composite, donc à sa lisibilité après répartition. 48 caractères est déjà un nom très long pour un public qui écrit du SQL tous les jours. Alternative rejetée : autoriser 63 octets partout pour les tables et les champs — on gagne sur le nom qu'on écrit à la main et on perd sur tous les noms dérivés qui le contiennent, c'est-à-dire précisément ceux qu'on lit dans les messages d'erreur PostgreSQL.

**Le moteur refuse tout nom dépassant 63 octets plutôt que de laisser PostgreSQL le tronquer.** PostgreSQL tronque à 63 octets sur une frontière de caractère (`pg_truncate_identifier` s'appuie sur `pg_mbcliplen` : il ne coupe jamais une séquence UTF-8 en deux) et n'émet qu'un `NOTICE: identifier "…" will be truncated to "…"`, que les pilotes ignorent par défaut. Deux noms distincts partageant leurs 63 premiers octets désignent alors le même objet sans erreur exploitable. C'est ce cas-là que le refus ferme.

### 3.5 Slug vide : règle de repli

Si le slug est vide après l'étape 7 (libellé entièrement composé de ponctuation, d'emoji ou d'une écriture non latine), le moteur génère `<nature>_<6 caractères>` où `<nature>` vaut `base`, `table` ou `champ`, et où les 6 caractères sont tirés de l'alphabet du `tenantId` (§7.1) par le même générateur cryptographique. Exemples : `table_k3f9x2`, `champ_m7d2qs`.

C'est le **seul point non déterministe** de la slugification, et c'est assumé : la fonction retourne une proposition, c'est le registre qui arrête le nom définitif. Alternative rejetée : dériver les 6 caractères d'une empreinte du libellé — déterministe, mais deux libellés cyrilliques différents produiraient des noms tout aussi illisibles, pour un bénéfice nul.

Le déclenchement du repli n'est **pas silencieux** : la réponse de création porte l'avertissement `SLUG_FALLBACK_APPLIED` en plus du nom attribué, et l'interface propose alors de saisir un nom technique (§2.4).

### 3.6 Slug commençant par un chiffre : préfixe `n_`

PostgreSQL accepte `"2024_ventes"` s'il est quoté, et basedb quote toujours. Mais les noms de bases et de tables sont ce que les consommateurs SQL écrivent tous les jours : imposer le quoting à la main pour la seule raison qu'un nom commence par un chiffre est un coût permanent. D'où le préfixe `n_` (comme « numérique ») : « 2024 ventes » → `n_2024_ventes`. Alternative rejetée : conserver le nom tel quel en comptant sur le quoting — casse l'écriture SQL non quotée, qui est la promesse du produit.

Conséquence : **tout nom alloué commence par une lettre minuscule**, ce qui est exactement l'alphabet A du §2.3.

### 3.7 Domaine de validité v1

La slugification ne tente **aucune romanisation** des écritures non latines : les systèmes de translittération sont multiples, dépendants de la langue, et un choix arbitraire produirait des noms physiques que personne ne reconnaît. Pour un libellé cyrillique, grec, arabe, hébreu ou CJK, l'étape 6 ne retient aucun caractère et le repli du §3.5 s'applique.

Il faut le dire sans détour : **le domaine de validité de la slugification automatique en v1 est celui des libellés à dominante latine.** Pour un tenant travaillant intégralement dans une autre écriture, le repli n'est pas un cas limite mais le cas général — toutes ses tables s'appelleraient `table_k3f9x2` — et la promesse centrale du produit, des tables PostgreSQL directement exploitables en SQL par un humain, tomberait.

La réponse v1 est le **nom technique saisi à la création** (§2.4) : l'utilisateur fournit lui-même le nom physique en ASCII, une fois, à la création, et le libellé reste dans son écriture. L'interface le propose d'office dès que le repli se déclenche. Alternative rejetée pour la v1 : embarquer des tables de romanisation par écriture — travail sans fin, résultat contesté par les locuteurs, et de toute façon insuffisant pour le CJK.

### 3.8 Version de l'algorithme

L'algorithme du §3, la table du §3.3 et la clé de comparaison de libellé du §2.2 forment un ensemble versionné par un entier unique, porté par la colonne `slug_version` du registre, qui vaut `1` en v1. **Chaque ligne du registre porte la valeur en vigueur au moment de l'allocation.** C'est ce qui rend vérifiable la garantie de non-rétroactivité du §2.1 : on peut, à tout moment, dire quel algorithme a produit quel nom — et on ne recalcule jamais.

---

## 4. Noms interdits, préfixes réservés et échappement

L'interdiction porte **exclusivement sur le nom physique**. Aucun libellé n'est interdit pour cause de mot réservé : un champ peut s'appeler « Select », « _id » ou « pg_stat ». Seule sa projection est contrainte.

Deux familles d'indisponibilité, et deux traitements **distincts**. C'est le point à ne pas confondre : un suffixe ajouté en fin de nom ne corrige évidemment pas un préfixe interdit.

| Interdiction | Portée | Traitement |
|---|---|---|
| Mot-clé réservé SQL : liste `pg_get_keywords()` filtrée sur `catcode IN ('R','T','C')` | tables, champs | boucle de suffixe (§6.1) |
| Préfixe `pg_` | tables, champs | échappement `x_` |
| Préfixe `zz_` | bases, tables, champs | échappement `x_` |
| Préfixe `_` | tables, champs (inatteignable par slugification ; contrôlé pour les noms dérivés) | échappement `x_` |
| Nom déjà enregistré au registre, quel que soit son état (§6.3) | selon portée | boucle de suffixe |
| Nom de schéma occupé dans la base d'accueil sans être connu du registre | schémas | refus `NAME_TAKEN_OUTSIDE_REGISTRY` (§11.3) |

**Échappement d'un préfixe réservé.** Le candidat est préfixé par `x_`, **une seule fois**, avant tout test de disponibilité : `zz_archive` → `x_zz_archive`, `pg_monitoring` → `x_pg_monitoring`. Si le résultat dépasse `MAX`, il est retronqué. La transformation est sûre par construction : `x_` n'est aucun des trois préfixes réservés, sa sortie ne peut donc pas redéclencher l'échappement. Alternative rejetée : ajouter `x_` à la liste des préfixes réservés « pour rendre la transformation idempotente » — cela produirait l'inverse, l'échappement interdisant sa propre sortie et bouclant sur `x_x_…`. Autre alternative rejetée : refuser la saisie avec un code dédié — c'est refuser le libellé « ZZ archive » pour une raison purement interne, ce que le §2.2 exclut.

**Pourquoi la catégorie `C` dans le filtre des mots-clés.** `catcode = 'C'` (*col_name_keyword*) est la liste des noms de types et de fonctions de la grammaire SQL : `time`, `timestamp`, `interval`, `numeric`, `decimal`, `char`, `character`, `int`, `integer`, `smallint`, `float`, `real`, `precision`, `boolean`, `row`, `between`, `exists`, `position`, `substring`, `trim`, `coalesce`, `nullif`, `greatest`, `least`. PostgreSQL les accepte comme noms de table ou de colonne, mais `SELECT timestamp FROM t` ou `SELECT interval FROM t` sont au mieux déroutants, au pire des erreurs de syntaxe selon la position. Le coût de leur interdiction est un `_2` sur des libellés comme « Time » ou « Interval » ; le coût inverse est un identifiant qui oblige à quoter, à vie.

Le filtre s'applique au **candidat final**, c'est-à-dire après slugification et échappement. La liste est extraite pour PostgreSQL 16 (A1) et versionnée dans le dépôt **avec le `catcode` d'origine de chaque mot**, pour être rejouable lors d'un changement de version majeure. Elle ne filtre que l'attribution de *nouveaux* noms : un mot devenu réservé plus tard ne casse aucun nom existant, puisque basedb quote systématiquement.

**Ce qui ne s'applique pas aux schémas.** Aucun contrôle de mot réservé, de préfixe `pg_` ni de nom de schéma réservé (`public`, `information_schema`, `pg_catalog`, `pg_toast`, `pg_temp*`, `_basedb`, `_basedb_local`) ne s'applique au slug de base : le préfixe `b_<tenantId>_` rend le nom de schéma assemblé **structurellement disjoint** de ces familles. Une base « Public », « Select », « PG stats » ou « basedb » donne `b_t4z56fq_public`, `b_t4z56fq_select`, `b_t4z56fq_pg_stats`, `b_t4z56fq_basedb`, qui ne posent de problème ni à PostgreSQL ni au lecteur. Seul `zz_` est échappé pour les bases, afin que le marqueur de relégation du §9.5 reste non ambigu à la lecture d'une liste de schémas.

**Il n'existe pas d'interdiction de préfixe `b_` sur les slugs de base.** La lecture positionnelle du §5 rend `b_t4z56fq_b_ventes` parfaitement analysable ; interdire le cas coûterait un libellé légitime pour un motif esthétique, et obligerait de surcroît à passer par l'échappement, donc à produire `x_b_ventes` — moins lisible que ce qu'on voulait éviter.

**Les colonnes système ne sont pas une interdiction mais une occupation.** À la création d'une table, le moteur enregistre `_id`, `_created_at`, `_updated_at`, `_created_by`, `_updated_by` au registre, à la portée de cette table, avec la nature d'objet `system_field`. Toute collision ultérieure est donc traitée par le mécanisme ordinaire de disponibilité, sans règle particulière. Le cas est de toute façon structurellement impossible par le haut : le libellé « _id » produit le slug `id`, l'étape 7 ayant retiré le `_` de tête.

---

## 5. Composition des noms de schéma

```
b_<tenantId>_<base>
│ │ │        │└─ slug de base, 1 à 53 octets
│ │ │        └── séparateur littéral
│ │ └─────────── tenantId, exactement 7 caractères, toujours 't' + 6
│ └───────────── séparateur littéral
└─────────────── marqueur littéral 'b'
```

**Non-ambiguïté.** Le `tenantId` a une longueur fixe de 7 caractères et commence toujours par la lettre `t`. L'analyse d'un nom de schéma se fait donc **par position, jamais par découpage sur `_`** : les caractères 1–2 valent `b_`, les caractères 3–9 sont le `tenantId`, le caractère 10 est `_`, le reste est le nom de base. Un nom de base contenant des `_` — le cas normal — ne crée aucune ambiguïté. `b_t4z56fq_factures_2024` se lit sans hésitation : tenant `t4z56fq`, base `factures_2024`.

**Budget.** 2 + 7 + 1 = 10 octets de préfixe, il reste **53 octets** pour le slug de base.

Tout exemple de `tenantId` figurant dans le document compte exactement 7 caractères ; ceux employés sont `t4z56fq` et `t9k2mnp`.

---

## 6. Collisions, registre des noms et unicité

### 6.1 Procédure d'allocation d'un nom

Elle est unique pour toutes les natures d'objets, et c'est le seul chemin par lequel un nom physique peut naître.

1. Obtenir un **candidat** : slug du libellé (§3), nom technique saisi (§2.4) ou nom dérivé assemblé (§9.6).
2. Si le candidat commence par un préfixe réservé pour sa nature (§4), appliquer l'**échappement `x_`**, puis retronquer à `MAX` si nécessaire.
3. Si le candidat est un mot réservé SQL pour sa nature (§4), le marquer indisponible.
4. Tester la **disponibilité** : absence de ligne `(scope_id, name)` au registre, **quel que soit l'état de cette ligne** ; pour un nom de schéma, absence également dans `pg_namespace` (§11.3).
5. Si indisponible, essayer `<candidat>_2`, `<candidat>_3`, …, jusqu'à `<candidat>_99`. Pour ajouter un suffixe de `k` octets, le candidat est d'abord tronqué à `MAX − k` octets, puis débarrassé d'un `_` final, puis suffixé. Passer de `_9` à `_10` retronque donc d'un octet : `nom_tres_long_9` devient `nom_tres_lon_10` si `MAX` est atteint. Le résultat reste dans le budget, ce qui est la seule propriété qui compte ; la lisibilité est déjà perdue à ce stade.
6. Au-delà de `_99` : échec `NAME_COLLISION_UNRESOLVED`.
7. Insérer la ligne de registre (§6.3) dans la transaction de l'étape de structure en cours.

La numérotation commence à 2 parce que le rang 1 est le candidat nu. Oui, cela signifie qu'un champ « Select » produit `select_2` sans qu'aucun `select_1` n'existe. C'est délibéré : une règle unique pour toutes les causes d'indisponibilité vaut mieux que trois règles particulières, et le nom n'a pas vocation à être beau — le libellé, lui, reste « Select ».

**La troncature est une cause de collision à part entière.** Deux libellés distincts partageant leurs 48 premiers octets après slugification produisent le même candidat ; le second reçoit `_2`. La boucle traite ce cas comme les autres.

**Cas des schémas.** Pour une base, la boucle de suffixe opère sur le **slug de base** (budget 53 octets), mais le test de disponibilité et la ligne de registre portent sur le **nom assemblé** `b_<tenantId>_<base>`. C'est ce qui rend le multi-tenant possible : deux tenants ont chacun leur base « CRM », `b_t4z56fq_crm` et `b_t9k2mnp_crm`, sans collision et sans suffixe parasite.

### 6.2 Espaces de noms

| Nature du nom | Portée d'unicité | `scope_id` | `scope_kind` |
|---|---|---|---|
| Schéma (courant ou d'alias) | la base PostgreSQL d'accueil | constante `SCOPE_INSTANCE` = `00000000-0000-0000-0000-000000000001` | `instance` |
| Table, vue SQL, index, séquence, contrainte générée | **le schéma** | clé de catalogue du schéma | `schema` |
| Champ, déclencheur | la table | clé de catalogue de la table | `table` |

**Le schéma, et non la base.** C'est ce qui rend les alias de compatibilité réalisables : un schéma d'alias contient des vues SQL qui portent **exactement les noms des tables du schéma courant** — c'est toute leur raison d'être. Ces vues vivent sous un autre `scope_id`, elles ne collisionnent donc pas. Une clé de portée valant la base rendrait la fonctionnalité impossible à construire.

Deux simplifications assumées, toutes deux plus strictes que PostgreSQL :

- Les **contraintes** sont enregistrées à la portée du schéma, alors que PostgreSQL ne les exige uniques que par table. Cela unifie leur traitement avec les index et les séquences, qui sont de vraies relations, et évite d'avoir à raisonner sur deux portées en lisant un message d'erreur serveur.
- Les **déclencheurs** sont enregistrés à la portée de la table, avec les champs, alors que PostgreSQL les place dans un espace de noms distinct des colonnes. Le risque de collision entre un nom de déclencheur (`tg_…__…`) et un nom de champ est nul en pratique, la slugification ne produisant jamais de `__`.

### 6.3 Le registre des noms physiques

Toute attribution passe par `_basedb.physical_name`, seul détenteur du nom physique (A5). Les tables d'objets du catalogue référencent leur nom **par clé étrangère** vers ce registre et **ne dupliquent jamais la chaîne** : sans cette règle, la même information vivrait à deux endroits, et une ligne modifiée sans l'autre suffirait à faire diverger le catalogue de lui-même. Le DDL du registre, ses contraintes `CHECK` d'alphabet et d'octets, son index `UNIQUE (scope_id, name)` et la vue de confort `_basedb.v_physical_name_qualified` sont donnés au chapitre 02.

Vocabulaire fermé des natures d'objet : `schema`, `table`, `sql_view`, `field`, `system_field`, `index`, `constraint`, `sequence`, `trigger`.

**Exigence de collation.** La colonne de nom et l'index d'unicité du registre, la colonne du `tenantId` et `label_key` sont en `COLLATE "C"`. L'index unique du registre est la seule autorité d'unicité du produit ; laissé à la collation par défaut de la base d'accueil — que basedb ne choisit pas, faute de `CREATE DATABASE` —, il dépend d'une bibliothèque système, et un changement de version de collation (la rupture glibc 2.28 est le cas d'école, ICU se met à jour aussi) réordonne les clés et laisserait passer exactement les doublons que tout ce chapitre construit pour les empêcher. En collation `C` la comparaison est binaire et immunisée ; l'alphabet étant de l'ASCII pur, aucun ordre linguistique n'est perdu. Le contrôle d'amorçage correspondant est au §11.2.

**États et transitions.** Un objet peut détenir plusieurs lignes ; une ligne n'est jamais supprimée. Les cinq états sont ceux de A5.

| État | Un objet physique porte-t-il ce nom ? | Sens |
|---|---|---|
| `active` | oui | nom en service |
| `relegated` | oui | nom de relégation `zz_supprime_…` porté par un objet supprimé logiquement mais physiquement présent |
| `retired` | non | nom libéré côté PostgreSQL, jamais réattribué : ancien nom après relégation ou après renommage physique |
| `alias` | oui | ancien nom repris par un objet d'alias de compatibilité |
| `purged` | non | l'objet portant ce nom a été détruit par la purge |

Transitions autorisées, et elles seules :

```
(allocation) ──► active
active     ──► retired     renommage physique, ou relégation de l'objet
active     ──► purged      objet dérivé détruit avec son parent lors de la purge
retired    ──► alias       création d'un alias de compatibilité
alias      ──► retired     suppression de l'alias
relegated  ──► purged      DROP réel de l'objet relégué
```

Une suppression logique produit donc **deux** mouvements pour le même objet : la ligne du nom d'origine passe à `retired`, et une nouvelle ligne est créée en `relegated` pour le nom `zz_supprime_…`. C'est ce qui permet à l'historique des structures et à la purge de retrouver l'objet concerné à partir de l'un ou l'autre nom.

La transition `retired → alias` est **la seule exception** à la règle « un nom enregistré n'est plus jamais porté par un objet physique ». Elle est encadrée : elle ne concerne que les noms de schéma et les noms de table — un schéma d'alias reprend l'ancien nom de schéma, une vue SQL d'alias reprend l'ancien nom de table —, elle n'intervient que dans la création d'un alias de compatibilité, dont le chapitre 06 est normatif, et l'objet créé n'est pas celui qui portait le nom à l'origine. Le nom reste inattribuable à tout autre objet, avant comme après.

**Aucun état ne libère jamais un nom, et aucune ligne de registre n'est détruite**, y compris en état `purged` : l'épuration de second niveau prévue par A22 et A24 porte sur les pierres tombales des tables d'objets du catalogue, jamais sur le registre des noms. Conséquence assumée : supprimer la table « Clients » puis la recréer donne `clients_2`. Les migrations rejouables, l'historique des structures et les alias de compatibilité référencent ces noms ; les réémettre créerait des homonymes à travers le temps. L'échappatoire est le renommage physique d'administration (chapitre 06), pas la réutilisation automatique.

### 6.4 Unicité garantie par contrainte, jamais par un `SELECT`

Vérifier la disponibilité d'un nom par un `SELECT` puis l'insérer est un *check-then-act* : en `READ COMMITTED`, deux transactions concurrentes créant « Clients » dans le même schéma voient toutes deux le nom libre et tentent toutes deux `clients`. La contrainte `UNIQUE (scope_id, name)` transforme une corruption silencieuse — deux lignes de catalogue pour un même objet physique — en une reprise banale : l'une des deux reçoit `23505` et rejoue la boucle de suffixe. Le `SELECT` préalable reste utile pour trouver le point de départ de la boucle sans faire échouer de transaction inutilement ; **il ne garantit rien et n'est pas contractuel**.

**Pourquoi la garantie ne peut pas être laissée à PostgreSQL seul.** Sans ligne de registre, le conflit ne remonterait qu'au moment du DDL. Or deux `CREATE TABLE` concurrents de même nom ne produisent pas le message qu'on attend : les deux transactions passent le contrôle d'existence, puis la seconde **bloque sur l'index unique `pg_class_relname_nsp_index`** jusqu'au `COMMIT` de la première et échoue en `23505` sur un index système — message illisible, et non le `42P07 relation "clients" already exists` qu'on croit voir. Attraper le conflit côté catalogue, avant l'émission du DDL, évite à la fois ce message inexploitable et l'annulation d'une transaction qui détient déjà des verrous lourds.

**Propriété exigée par ce chapitre : l'allocation d'un nom est sérialisée à l'intérieur d'une portée.** La suite des suffixes est alors dense et prévisible, et les annulations de transactions de structure disparaissent sous concurrence. Le mécanisme retenu est un **verrou consultatif de transaction**, pris sur la classe de verrous dédiée à l'allocation de noms. Conformément à A8, sa clé est un **entier attribué et stocké au catalogue** — celui de la portée concernée —, jamais un `hashtext()`, dont les collisions provoqueraient des blocages mutuels entre bases sans rapport. Le registre des classes de verrous, la constante de chaque classe et la dérivation de la seconde clé sont définis au chapitre 02 ; le moment de l'acquisition, la durée de détention et la politique de reprise après expiration de `lock_timeout` sont arrêtés par le chapitre 03. Le verrou est **toujours acquis avant tout verrou de table**, faute de quoi deux opérations de structure concurrentes s'interbloquent.

**Chaque étape d'une opération de structure s'exécute sur une seule connexion, donc dans une seule transaction.** Le DDL de l'étape et l'écriture de catalogue qui la décrit réussissent ou échouent ensemble : c'est impossible sur deux connexions sans validation en deux phases, laquelle exige `max_prepared_transactions > 0`, un paramètre d'instance que le rôle propriétaire ne peut pas poser. Une opération de structure est un **plan à plusieurs étapes** (A11), dont la machine à états appartient au chapitre 03 ; aucune étape ne laisse le catalogue et la structure physique désaccordés. La séparation des pools porte donc sur les accès de service, pas sur les étapes de structure, qui empruntent un pool dédié (§10.3). Le verrou consultatif est pris sur cette connexion-là, avant toute émission de DDL, et tombe au `COMMIT` de l'étape.

---

## 7. Génération du `tenantId`

### 7.1 Alphabet

Base 36 (`0-9a-z`) privée de `0`, `o`, `1`, `l`, soit **32 caractères exactement** :

```
2 3 4 5 6 7 8 9 a b c d e f g h i j k m n p q r s t u v w x y z
```

8 chiffres + 24 lettres = 32. La taille exacte de 32 est précieuse : elle vaut 2⁵, ce qui permet un tirage sans biais de modulo (§7.2).

### 7.2 Tirage

Le `tenantId` est `t` suivi de 6 caractères tirés dans cet alphabet, soit **32⁶ = 1 073 741 824** valeurs possibles (2³⁰).

1. Lire 6 octets d'un générateur **cryptographique** fourni par le système d'exploitation. Jamais un générateur pseudo-aléatoire non cryptographique : un `tenantId` prévisible est un nom de schéma prévisible, donc une aide à l'énumération.
2. Pour chaque octet, prendre ses 5 bits de poids faible (valeur 0–31) et indexer l'alphabet. 256 étant un multiple de 32, la distribution est uniforme sans rejet ni biais de modulo.
3. Si la valeur obtenue figure dans la **liste d'exclusion statique** versionnée dans le dépôt, retirer.
4. Tenter l'insertion dans la table des tenants, dont la colonne porte une contrainte `UNIQUE` en `COLLATE "C"`. En cas de `23505`, retirer.
5. Au bout de **10 tentatives**, abandonner avec `TENANT_ID_EXHAUSTED` et alerter l'exploitation : à ce stade, soit la source d'aléa est défaillante, soit l'espace de noms est saturé. Les deux méritent un humain.

**Forme des entrées de la liste d'exclusion.** Chaque entrée est un identifiant **complet de 7 caractères** : `t` suivi de 6 caractères pris dans l'alphabet du §7.1. Un test de construction rejette toute entrée non conforme — mauvaise longueur, caractère hors alphabet —, faute de quoi la liste donne une fausse impression de couverture en contenant des valeurs que le générateur ne peut pas produire. Exemples valides : `tsystem`, `ttenant`, `tadmins`, `tmaster`, plus une liste de chaînes grossières atteignables.

### 7.3 Probabilité de collision

Par le paradoxe des anniversaires, la probabilité d'au moins une collision sur `N` tenants vaut `1 − exp(−N² / 2³¹)` :

| Tenants | Probabilité de collision |
|---|---|
| 100 | 0,000 5 % |
| 1 000 | 0,047 % |
| 10 000 | 4,6 % |
| 32 768 | ≈ 39 % |
| 38 600 | ≈ 50 % (seuil exact : 1,177 · √(2³⁰)) |

L'approximation `N² / 2³¹` n'est valable que pour `N ≲ 10 000` ; au-delà, seule la formule exponentielle donne le bon chiffre. Une collision n'est donc pas un incident mais un **événement attendu** à l'échelle de quelques dizaines de milliers de tenants : d'où l'insertion sous contrainte et le rejeu, jamais une hypothèse d'unicité.

### 7.4 Immuabilité

Le `tenantId` apparaît dans le nom de chaque schéma de production, dans chaque migration déjà appliquée et rejouable, dans les portées des jetons d'intégration (chapitre 08), dans les charges utiles de webhooks, dans le SQL que les consommateurs ont écrit à la main et dans leurs outils de restitution. Il n'est **jamais** dérivé du nom du tenant, précisément pour rester indépendant de ses changements de dénomination. Renommer un tenant modifie son libellé et rien d'autre. Il n'existe aucune opération produit permettant de changer un `tenantId` ; migrer un tenant vers un nouvel identifiant serait un déménagement complet de schémas, hors périmètre.

---

## 8. Colonnes système

Cinq colonnes, présentes sur **toute** table utilisateur, créées par le moteur, invisibles dans l'éditeur de schéma, et enregistrées au registre à la création de la table (§4). Conformément à A18, elles sont lisibles dès que le droit de lecture est accordé sur la table, ne sont jamais inscriptibles et ne peuvent pas porter de permission de champ.

| Colonne | Rôle |
|---|---|
| `_id` | Clé primaire, `uuid` v7, `DEFAULT _basedb_local.uuid_generate_v7()` (A9). Immuable. |
| `_created_at` | Horodatage de création, `timestamptz`. |
| `_updated_at` | Horodatage de dernière modification, `timestamptz`, tenu par `_basedb_local.set_updated_at()` (A9). |
| `_created_by` | Auteur de la création (clé de catalogue de l'utilisateur ou du jeton). |
| `_updated_by` | Auteur de la dernière modification. |

`timestamptz` ne stocke pas de fuseau : il stocke un instant absolu, restitué dans le fuseau de la session. La restitution en UTC n'est donc pas une propriété du type mais du **contrat de connexion** : toutes les connexions de basedb fixent `TimeZone = 'UTC'` (§10.3), ce qui rend la valeur rendue identique dans l'API, dans les charges utiles de webhooks et dans les curseurs de pagination, quelle que soit la configuration de l'instance d'accueil.

Leur préfixe `_` relève de l'alphabet B (§2.3) et les rend inatteignables par un nom d'utilisateur : l'étape 7 de la slugification retire les `_` de tête, le libellé « _id » produit `id`, jamais `_id`.

---

## 9. Noms des objets dérivés

Les objets suivants sont nommés par le moteur, sans que l'utilisateur intervienne. Ces noms apparaissent tels quels dans les messages d'erreur PostgreSQL remontés à l'utilisateur (chapitre 03 pour leur traduction) : ils doivent être lisibles.

### 9.1 Motifs

Motifs normatifs, conformément à A6 :

| Objet | Motif | Exemple |
|---|---|---|
| Clé primaire | `pk_<table>` | `pk_factures` |
| Clé étrangère (contrainte) | `fk_<table>__<colonne>` | `fk_factures__clients_id` |
| Index sur colonne(s) | `ix_<table>__<colonne>[__<colonne>…]` | `ix_factures__clients_id` |
| Contrainte d'unicité | `uq_<table>__<col1>[__<col2>__<col3>][__etc]` | `uq_factures__numero__annee` |
| Contrainte de vérification | `ck_<table>__<colonne>__<regle>` | `ck_factures__montant__range` |
| Séquence explicite | `<table>__<colonne>_seq` | `factures__numero_seq` |
| Colonne de lien | `<table_cible>_id` | `clients_id` |
| Déclencheur | `tg_<table>__<role>` | `tg_factures__<role>` |
| Table ou champ relégué | `zz_supprime_<AAAAMMJJ>_<nom>` | `zz_supprime_20260918_remise` |
| Schéma relégué | `b_<tenantId>_zz_supprime_<AAAAMMJJ>_<slug de base>` | `b_t4z56fq_zz_supprime_20260918_crm` |
| Schéma d'alias | l'ancien nom de schéma, inchangé | `b_t4z56fq_crm` |
| Vue SQL d'alias | le nom de la table aliasée, inchangé | `factures` |

Le **double souligné** sépare les composants (table / colonne / règle). Il reste ambigu si un nom contient lui-même `__` — ce n'est pas un problème : ces noms ne sont jamais analysés par programme, l'association contrainte ↔ objet est portée par le registre. Le `__` sert à l'œil humain qui lit un message d'erreur.

Le suffixe `<regle>` des contraintes de vérification est pris dans un vocabulaire fermé défini au chapitre 04. Le suffixe `<role>` d'un déclencheur est pris dans la liste des déclencheurs posés sur une table utilisateur, dont le chapitre 07 est normatif (A10) ; le présent chapitre n'en fixe que le motif et le budget. Les fonctions appelées par ces déclencheurs sont uniques et partagées, et vivent dans `_basedb_local` (A9) : il n'y a jamais une fonction par table, donc aucun nom de fonction à allouer.

### 9.2 Index sur les colonnes de lien, et règle de déduplication

PostgreSQL crée automatiquement un index pour une clé primaire et pour une contrainte d'unicité, **mais pas pour une clé étrangère**. Le moteur crée donc systématiquement `ix_<table>__<colonne>` sur la colonne portant la clé étrangère. Sans lui, chaque suppression d'une ligne cible impose un parcours complet de la table source pour évaluer la clause `ON DELETE NO ACTION` émise pour la valeur `restrict` (A13), et l'expansion `?expand=<champ>` de l'API (chapitre 08) dégénère.

**Une colonne ne porte au plus qu'un index généré.** Index d'office et index demandé partagent le même motif, ce qui est voulu : c'est le même objet.

- Une demande d'index sur une colonne déjà indexée d'office est **satisfaite par l'index existant** : le catalogue enregistre la demande, aucun DDL n'est émis, aucun nom n'est alloué.
- Réciproquement, l'index d'office n'est pas créé si un index existant a déjà cette colonne **en tête de clé**.
- Le test de déduplication porte sur la colonne de tête ; il est effectué sur le catalogue, qui connaît les deux origines.

Sans cette règle, le premier index utilisateur sur une colonne de lien — cas fréquent, c'est la colonne sur laquelle on filtre — tomberait sur la boucle de suffixe et produirait `ix_factures__clients_id_2` : deux index identiques dans PostgreSQL, doublant le coût d'écriture et l'occupation disque, et deux noms que rien ne distingue à la lecture d'un `\d` ou d'un `EXPLAIN`.

### 9.3 Colonne d'un champ lien

Le nom par défaut est `<table_cible>_id`, où `<table_cible>` désigne le **nom physique de la table cible tel qu'il figure au registre**, sans transformation : ni singularisation, ni pluralisation, ni traduction. L'inflexion morphologique dépend de la langue et n'est jamais fiable ; une table `clients` donne `clients_id`.

Règle de repli, dans cet ordre, conformément à A7 :

1. `<table_cible>_id` ;
2. si ce nom est déjà pris — typiquement un second lien vers la même table cible, ou une colonne utilisateur homonyme préexistante —, le slug du libellé du champ suivi de `_id` : un champ « Client livré » pointant vers `clients` donne `client_livre_id`, bien plus parlant que `clients_id_2` ;
3. en dernier recours seulement, la boucle de suffixe numérique du §6.1.

Le nom retenu est **figé à la création**, restitué à l'appelant (§2.5), affiché dans l'interface et renvoyé par l'API et le MCP. Il n'est jamais recalculé : le renommage physique de la table cible ne renomme pas la colonne de lien, qui a été calculée une fois et dont le registre conserve le lien logique. C'est le meilleur test de compréhension du §2.1.

Si le nom dépasse 63 octets — impossible avec le budget de 48 octets des tables (48 + 3 = 51), mais le contrôle est écrit quand même —, la répartition du §9.6 s'applique.

**Un lien ne traverse jamais deux bases.** En v1, un champ lien référence obligatoirement une table de la **même base**, donc du même schéma : la contrainte `FOREIGN KEY` ne franchit jamais une frontière de schéma. Le refus à la création du champ porte le code `LINK_CROSS_DATABASE`. Cette décision n'est pas cosmétique : elle rend `<table_cible>_id` non ambigu (sans elle, deux liens vers deux tables `factures` de deux bases donneraient la même colonne), elle fixe sans discussion le schéma d'enregistrement de la contrainte et de l'index (celui de la source), et elle garde la suppression logique d'une base entière (chapitre 06) calculable. La levée de cette restriction est renvoyée à la v2, au même titre que le « plusieurs vers plusieurs ».

### 9.4 Séquences

`_id` étant un `uuid` v7 servi par `_basedb_local.uuid_generate_v7()` (A9), **aucune séquence d'identité n'est créée pour la clé primaire**.

Si un type de champ du chapitre 04 s'appuie sur une séquence, celle-ci est **créée explicitement**, avec un nom alloué par le registre **avant** l'émission du DDL qui s'en sert, puis rattachée par `ALTER SEQUENCE … OWNED BY`. Alternative rejetée : `bigserial` ou `GENERATED … AS IDENTITY`, qui délèguent le nom à `ChooseRelationName()`. Celui-ci ne garantit pas le motif : il tronque à 63 octets et, si le nom est déjà pris, ajoute un compteur (`factures__numero_seq1`). Le registre enregistrerait alors un nom que la base n'a pas attribué — dérive immédiate et silencieuse entre le catalogue et `pg_class`. Variante également écartée : accepter le nom du serveur puis le relire par `pg_get_serial_sequence()` — cela fonctionne, mais impose un aller-retour supplémentaire dans l'étape de structure et laisse le registre subir un nom au lieu de l'attribuer.

`ALTER TABLE … RENAME` ne renomme jamais la séquence liée, ce qui est cohérent avec la règle du §9.5 : les objets dérivés ne sont pas renommés.

### 9.5 Relégation : nommage de la suppression logique

**Tables et champs.** `zz_supprime_<AAAAMMJJ>_<nom>`, date en UTC, format `AAAAMMJJ` sans séparateur. Le préfixe fait 21 octets (`zz_supprime_` = 12, date = 8, `_` = 1), il reste **42 octets** pour l'ancien nom, tronqué à cette longueur.

**Schémas.** La suppression logique s'étend aux bases. Le marqueur vient alors **après** le préfixe positionnel, jamais devant : `b_<tenantId>_zz_supprime_<AAAAMMJJ>_<slug de base>`. La lecture par position du §5 est ainsi préservée — un outil d'exploitation qui énumère les schémas d'un tenant continue de fonctionner — et le budget reste tenable : 2 + 7 + 1 (préfixe) + 12 + 8 + 1 (marqueur) = 31 octets, il reste **32 octets** pour le slug de base, qui est donc retronqué de 53 à 32 à cette occasion. Mettre le marqueur devant aurait produit `zz_supprime_20260918_b_t4z56fq_crm`, illisible par position et long de 84 octets dans le pire cas, soit au-delà de la limite.

**Les objets dérivés ne sont pas renommés.** Après `ALTER TABLE "factures" RENAME TO "zz_supprime_20260918_factures"`, le schéma contient toujours `pk_factures`, `ix_factures__clients_id`, `fk_factures__clients_id` et les déclencheurs de `factures`. C'est une décision, pas un oubli :

- aucun de ces noms ne sera jamais réattribué (§6.3), il n'y a donc **aucun risque de collision** avec une table « Clients » recréée, qui recevra `clients_2` et des dérivés `pk_clients_2`, `ix_clients_2__…` ;
- les renommer coûterait autant d'entrées de registre, autant d'instructions DDL dans une étape de suppression qui doit rester courte, et ferait exploser les budgets (21 + `pk_<table>` jusqu'à 51 = 72 octets) ;
- leurs lignes de registre **restent en état `active`** tant que l'objet physique existe, et passent à `purged` lors du DROP réel.

Conséquence à connaître : une violation de contrainte sur une table reléguée affiche `pk_factures` alors que la table s'appelle `zz_supprime_20260918_factures`. La traduction des erreurs serveur (chapitre 03) résout le nom de contrainte par le registre et affiche le libellé de l'objet, ce qui referme l'écart côté utilisateur ; la lecture brute d'un journal PostgreSQL, elle, demande de connaître cette règle.

**Relégation le même jour.** Supprimer un champ « Remise », le recréer, puis le supprimer à nouveau le même jour produirait deux fois `zz_supprime_20260918_remise`. La boucle de suffixe s'applique comme partout ailleurs : `zz_supprime_20260918_remise_2`. Sans cette règle, le second `ALTER TABLE … RENAME COLUMN` échouerait en erreur serveur au milieu d'une étape de suppression.

### 9.6 Assemblage d'un nom dérivé et répartition du budget

Un nom dérivé composite peut dépasser 63 octets. La règle d'assemblage est déterministe et reproductible ; elle ne dépend d'aucune donnée extérieure aux composants et n'emploie **jamais d'empreinte cryptographique** (A6).

1. Décomposer le nom visé en **parties fixes** (préfixe `fk_`, `ix_`, `uq_`, `ck_`, `tg_` ; séparateurs `__` ; suffixe de vocabulaire fermé) et en **composants variables**, dans l'ordre du motif.
2. Une contrainte d'unicité ne nomme au plus que **trois colonnes** ; au-delà, le motif se termine par le composant fixe `__etc` (`uq_<table>__<c1>__<c2>__<c3>__etc`). Sans ce bornage, `uq_` n'aurait pas de borne supérieure.
3. `budget = 63 − somme des parties fixes`. Si la somme des longueurs des composants tient dans `budget`, assembler tel quel.
4. Sinon, répartir : `part = budget ÷ n` (division entière, `n` = nombre de composants variables) ; les composants plus courts que `part` gardent leur longueur et les octets qu'ils n'utilisent pas sont redistribués à parts égales entre les composants restants ; répéter jusqu'à stabilisation ; le reste de la division entière est attribué aux composants dans l'ordre du motif.
5. Tronquer chaque composant à la longueur qui lui revient, puis lui retirer un éventuel `_` final.
6. Réassembler. Si le nom obtenu est indisponible au registre, la boucle de suffixe du §6.1 s'applique par-dessus, en rabotant d'autant le budget.

Exemple : table `liste_des_contrats_de_prevoyance_collective_sous` (48 octets), colonne `client_livre_id` (15 octets). Parties fixes de `fk_…__…` : 5 octets, donc `budget` = 58 ; la somme des composants vaut 63, il faut répartir. `part` = 29 ; la colonne (15) tient et rend 14 octets, la table reçoit 43. Résultat :

```
fk_liste_des_contrats_de_prevoyance_collective__client_livre_id   (63 octets)
```

Lisible aux deux bouts, ce qui est l'objectif : c'est ce nom que PostgreSQL affichera dans le message de violation.

Alternative rejetée : le raccourcissement par empreinte (tronquer à 56 octets et suffixer par 6 caractères dérivés d'un SHA-256 du nom visé). Déterministe et sans consultation du registre, mais il produit un suffixe opaque précisément à l'endroit où le nom doit être reconnaissable, et il ajoute un second mécanisme de résolution de collision là où la boucle de suffixe suffit.

---

## 10. Contrat SQL et contrat de connexion

### 10.1 Quoting et qualification

Quatre règles, sans exception, dans tout le SQL généré — DDL comme DML.

1. **Quoting systématique.** Tout identifiant est émis entre guillemets doubles, y compris quand il ne comporte aucun caractère qui l'exige. Une règle sans exception est vérifiable par lecture ; une règle conditionnelle ne l'est pas.
2. **Qualification explicite.** Toute référence à une relation, une séquence, un type non natif ou une fonction porte son schéma : `"b_t4z56fq_crm"."factures"`, `"_basedb_local"."uuid_generate_v7"()`. Aucune requête générée ne dépend du schéma courant. Cela inclut `pg_temp` pour toute table temporaire.
3. **`search_path` vide** sur toutes les connexions (§10.3). Aucune référence non qualifiée ne peut alors se résoudre vers un schéma utilisateur, et le détournement d'un opérateur ou d'une fonction par un objet placé en tête de chemin devient impossible. Deux précisions importent : les types et fonctions natifs continuent de se résoudre, `pg_catalog` étant implicitement prioritaire ; et **le schéma temporaire de la session reste implicitement consulté** pour les relations et les types, avant même `pg_catalog`, même absent du chemin. Un `search_path` vide ne ferme donc pas à lui seul le cas d'un objet temporaire masquant une relation : c'est la règle 2, qualification explicite sans exception, qui est la protection réelle. Le moteur ne crée aucune table temporaire portant le nom d'une table utilisateur.
4. **Échappement du guillemet double.** La fonction de quoting double tout `"` présent dans l'identifiant. Nos identifiants n'en contiennent jamais — leur alphabet est `[a-z0-9_]` — mais l'échappement est appliqué quand même : défense en profondeur qui ne coûte rien et protège d'une régression future de l'alphabet.

### 10.2 L'invariant de sécurité

> **Aucune chaîne fournie par un utilisateur n'est jamais concaténée dans du SQL. Seuls des noms physiques issus du registre le sont. Les valeurs passent toujours par des paramètres liés.**

Trois contrôles redondants le tiennent :

1. **À l'écriture du registre** : contrainte `CHECK` imposant l'alphabet **B** et `octet_length(name) <= 63` (chapitre 02). Un nom non conforme ne peut pas entrer dans le catalogue. La procédure d'allocation (§6.1) impose en amont l'alphabet **A**, plus strict, pour tout ce qui provient d'un libellé ou d'une saisie ; le `_` de tête n'est ainsi accessible qu'à la liste close du §2.3.
2. **À la lecture, avant quoting** : le constructeur SQL revalide l'alphabet **B** et lève `IDENTIFIER_INVALID` s'il n'est pas satisfait. C'est une assertion, pas un assainissement : on n'essaie pas de réparer le nom, on refuse d'émettre du SQL. La validation porte sur B et non sur A, sans quoi le moteur ne pourrait pas émettre `"_id"` ni `"_basedb_local"`, donc aucune requête.
3. **Par construction** : le constructeur SQL n'accepte pas de chaîne libre à la place d'un identifiant. Il reçoit des références d'objets de catalogue.

Ce triple contrôle est l'unique défense en DDL, où le protocole PostgreSQL n'offre aucun paramètre lié pour les identifiants. Il n'y a rien d'autre.

### 10.3 Pools et paramètres sémantiques de connexion

Trois pools, sur la même base d'accueil et le même rôle. Leur dimensionnement, leurs files d'attente, leurs délais d'acquisition et leurs délais d'expiration (`lock_timeout`, `statement_timeout`, `idle_in_transaction_session_timeout`) sont fixés par le chapitre 10 — Architecture logicielle ; les écarts par étape de migration le sont par le chapitre 03.

| Pool | Usage | Étapes de structure |
|---|---|---|
| `catalogue` | lecture/écriture du schéma `_basedb` pour le service : métadonnées, permissions, jetons, journaux | non |
| `donnees` | lecture/écriture des schémas `b_*` : API, MCP, UI, webhooks | non |
| `ddl` | **une étape d'opération de structure entière** : verrou consultatif, allocation de nom, écriture du catalogue et DDL | oui |

La séparation `catalogue` / `donnees` existe pour permettre une séparation physique ultérieure sans refonte. Elle ne concerne pas les étapes de structure, qui doivent rester atomiques et empruntent donc le pool dédié. Les étapes qui ne peuvent pas s'exécuter dans un bloc transactionnel — `CREATE INDEX CONCURRENTLY` (A11) — empruntent le même pool ; leur ordonnancement et leur reprise appartiennent au chapitre 03.

**Paramètres sémantiques, posés dans le paquet de démarrage de la connexion** — `options=-c <param>=<valeur>` dans la chaîne de connexion, ou `ALTER ROLE <role> SET <param>` pour les paramètres `USERSET` —, identiques sur les trois pools :

| Paramètre | Valeur | Raison |
|---|---|---|
| `search_path` | `''` | §10.1 règle 3 |
| `TimeZone` | `UTC` | restitution stable des `timestamptz` (§8) |
| `DateStyle` | `ISO, YMD` | formats de sortie indépendants de l'instance |
| `IntervalStyle` | `iso_8601` | idem |
| `client_encoding` | `UTF8` | cohérence avec §11.2 |
| `standard_conforming_strings` | `on` | valeur par défaut, posée et vérifiée explicitement |

**Le paquet de démarrage, et pas un `SET` de session.** Un `SET search_path = ''` exécuté après connexion est annulé par `DISCARD ALL` et par `RESET ALL`, que la plupart des pools émettent au retour d'une connexion : la valeur restaurée est alors la valeur de démarrage, c'est-à-dire `"$user", public`. Avec PgBouncer en mode transaction, un `SET` de session est en outre inapplicable. Posé dans le paquet de démarrage, le paramètre **devient** la valeur de réinitialisation : `DISCARD ALL` le restaure au lieu de le détruire. La garantie disparaîtrait sinon silencieusement, sans qu'aucun test ne le voie, exactement dans la configuration de production.

**Assertion au premier usage d'une connexion** : `SHOW search_path` doit renvoyer une chaîne vide et `SHOW TimeZone` doit renvoyer `UTC`. Sinon, la connexion est retirée du pool et l'incident `CONNECTION_CONTRACT_BROKEN` est journalisé.

---

## 11. Contrôles d'amorçage et réconciliation

Ce chapitre fabrique des schémas et des tables ; il doit donc dire ce qu'il exige de la base d'accueil, et comment il constate qu'on le lui a retiré.

### 11.1 Privilèges

Au démarrage, avant tout service, le moteur vérifie le privilège `CREATE` sur la base d'accueil — requis pour `CREATE SCHEMA` — et la **propriété** de `_basedb`, de `_basedb_local` et de chaque schéma `b_*`, requise pour tout le reste (`ALTER`, `DROP`, création d'index et de contraintes) :

```sql
SELECT has_database_privilege(current_user, current_database(), 'CREATE');
SELECT n.nspname, pg_get_userbyid(n.nspowner)
FROM pg_namespace n
WHERE n.nspname IN ('_basedb', '_basedb_local') OR n.nspname LIKE 'b\_%';
```

Un manquement est un refus de démarrage nommé `PRIVILEGES_INSUFFICIENT`, avec la liste des schémas fautifs. Aucun privilège d'instance n'est requis, et le moteur n'émet jamais `CREATE DATABASE` ni `ALTER SYSTEM`.

### 11.2 Encodage et collation

```sql
SELECT pg_encoding_to_char(encoding), datcollate, datctype, datcollversion
FROM pg_database WHERE datname = current_database();
```

- `encoding` doit valoir `UTF8`. Toute l'argumentation NFKD, octets et 63 octets de ce chapitre suppose des libellés Unicode stockables ; sur une base `LATIN1` ou `SQL_ASCII`, les libellés acceptés au §2.2 ne le sont plus et les budgets changent de sens. Sinon : refus de démarrage `DB_ENCODING_NOT_UTF8`.
- `datcollversion` est comparé à la version courante de la collation. En cas de divergence, l'avertissement `COLLATION_VERSION_MISMATCH` est journalisé, avec la procédure à suivre (`ALTER DATABASE … REFRESH COLLATION VERSION` puis `REINDEX` des index en collation non-`C`). Ce n'est pas bloquant pour basedb — les index d'identifiants sont en `COLLATE "C"` (§6.3) et y sont insensibles — mais les index utilisateur sur colonnes texte, eux, sont concernés.

### 11.3 Disponibilité d'un nom de schéma dans la base d'accueil

Le registre n'est autorité que sur ce qu'il connaît. La base d'accueil peut contenir des schémas créés hors basedb : un `pg_restore --schema` partiel, une reprise manuelle, un autre outil. Un `CREATE SCHEMA` sur un nom déjà pris échouerait en `42P06`, au milieu d'une étape de structure.

L'allocation d'un nom de schéma teste donc **en plus** du registre :

```sql
SELECT 1 FROM pg_namespace WHERE nspname = <nom assemblé>;
```

Si le nom existe dans `pg_namespace` sans ligne de registre correspondante, l'opération est refusée avec `NAME_TAKEN_OUTSIDE_REGISTRY` et le nom visé en charge utile. Le moteur ne contourne pas le cas par un suffixe : un schéma inconnu dans la base d'accueil est une anomalie d'exploitation qui demande un humain, pas un `_2` silencieux.

### 11.4 Réconciliation registre ↔ catalogue système

Le régime d'exécution de la réconciliation, le catalogue de ses classes et ses requêtes appartiennent au chapitre 02, qui s'appuie sur la vue `_basedb.v_physical_name_qualified`. Le présent chapitre n'y ajoute qu'une classe, `NOM-REG` — la comparaison du registre des noms à `pg_namespace`, `pg_class`, `pg_attribute` et `pg_constraint`, dans les deux sens — et la qualification de ses écarts. Elle se restreint au **registre des noms** ; la correspondance générale entre une ligne de registre et un objet physique reste celle de `CAT-NAME`, que `NOM-REG` ne redouble pas mais détaille par nature d'objet et par gravité :

| Classe | Écart | Gravité |
|---|---|---|
| `NOM-REG1` | Nom en état `active`, `relegated` ou `alias` sans objet physique | **bloquant** |
| `NOM-REG2` | Table, vue SQL, colonne ou contrainte physique dans `_basedb`, `_basedb_local` ou `b_*` sans ligne de registre | **bloquant** |
| `NOM-REG3` | Nom en état `retired` ou `purged` porté par un objet physique | **bloquant** |
| `NOM-REG4` | Index ou séquence physique sans ligne de registre | avertissement (création d'exploitation plausible) |
| `NOM-REG5` | Objets vivant dans un autre schéma | ignoré — la base d'accueil peut héberger autre chose |

Un écart bloquant lève `REGISTRY_DIVERGENT` et **suspend les opérations de structure sur la base concernée**, pas sur l'instance entière : la lecture et l'écriture des données restent servies, puisque le catalogue décrit correctement ce qu'elles utilisent. La réparation est une opération d'administration arbitrée par un humain ; aucune réconciliation automatique n'est prévue en v1, le risque d'aggraver un écart mal diagnostiqué étant supérieur au bénéfice.

---

## 12. Exemples de bout en bout

Table, `MAX` = 48, dans une base neuve, traités dans l'ordre du tableau.

| Libellé saisi | Nom physique | Ce qui s'est passé |
|---|---|---|
| `Clients` | `clients` | Cas nominal |
| `Résumé` | `resume` | NFKD puis suppression des marques (étapes 1–2) |
| `Resume` | `resume_2` | Libellé distinct (la clé de comparaison conserve les diacritiques), slug identique → suffixe |
| `Straße` | `strasse` | Table de translittération |
| `ﬁche produit` | `fiche_produit` | NFKD décompose la ligature `ﬁ` |
| `İstanbul` | `istanbul` | NFKD isole le point suscrit, supprimé à l'étape 2 ; le même résultat est obtenu sous locale turque, le `ı` produit par le repliement étant rattrapé par la table du §3.3 |
| `Chiffre d'affaires (€)` | `chiffre_d_affaires` | Apostrophe, parenthèses et `€` → `_`, puis réduction et suppression finale |
| `🚀 Lancement 2026` | `lancement_2026` | Emoji → `_`, supprimé en tête |
| `2024 ventes` | `n_2024_ventes` | Slug commençant par un chiffre → préfixe `n_` |
| `½ journée` | `n_1_2_journee` | NFKD éclate `½` en `1`, barre de fraction, `2` ; la barre devient `_` ; préfixe `n_` |
| `select` | `select_2` | Mot réservé (`catcode` R) : indisponible → boucle de suffixe. Pas de `select_1` |
| `Time` | `time_2` | Mot réservé (`catcode` C) : évite `SELECT time FROM t` |
| `Mon.Site.com` | `mon_site_com` | Le point est libre en libellé, interdit en nom physique |
| `_id` | `id` | Les `_` de tête sont retirés : collision avec la colonne système structurellement impossible |
| `zz_archive` | `x_zz_archive` | Préfixe réservé → échappement, pas boucle de suffixe |
| `PG monitoring` | `x_pg_monitoring` | Idem |
| `Клиенты` | `table_k3f9x2` | Aucun caractère retenu → repli (§3.5), avertissement `SLUG_FALLBACK_APPLIED`, saisie d'un nom technique proposée |
| `...` | `table_m7d2qs` | Ponctuation seule → repli |
| *(chaîne vide)* | — | `LABEL_EMPTY`, refus avant slugification |
| `Liste des contrats de prévoyance collective souscrits par les entreprises de plus de cinquante salariés en 2024` | `liste_des_contrats_de_prevoyance_collective_sous` | Troncature dure à 48 octets ; le nom attribué est retourné à l'appelant et affiché (§2.5) |
| `Clients` *(après suppression logique d'une table « Clients »)* | `clients_2` | Le libellé est libre, le nom reste occupé à vie (§2.2, §6.3) |

Noms de schéma et noms dérivés :

| Objet | Nom physique | Ce qui s'est passé |
|---|---|---|
| Base « CRM » du tenant `t4z56fq` | `b_t4z56fq_crm` | Assemblage §5 |
| Base « CRM » du tenant `t9k2mnp` | `b_t9k2mnp_crm` | Aucune collision : le registre porte le nom assemblé (§6.1) |
| Base « CRM » supprimée logiquement le 18/09/2026 | `b_t4z56fq_zz_supprime_20260918_crm` | Marqueur après le préfixe positionnel (§9.5) |
| Alias de compatibilité après renommage de la base en `b_t4z56fq_clients` | schéma `b_t4z56fq_crm`, vue SQL `factures` | L'ancien nom passe `retired → alias` ; la vue réutilise le nom de la table réelle, sous une autre portée (§6.2) |
| Lien « Client » vers `clients` dans `factures` | colonne `clients_id`, contrainte `fk_factures__clients_id`, index `ix_factures__clients_id` | §9.1 à §9.3 |
| Second lien « Client livré » vers `clients` | colonne `client_livre_id` | Nom de cible déjà pris (§9.3, règle 2) |
| FK de `liste_des_contrats_de_prevoyance_collective_sous` sur `client_livre_id` | `fk_liste_des_contrats_de_prevoyance_collective__client_livre_id` | Répartition du budget par composant (§9.6) |
| Champ « Remise » supprimé le 18/09/2026 | `zz_supprime_20260918_remise` | §9.5 |

Exemple complet de requête pleinement qualifiée telle qu'émise :

```sql
SELECT "f"."_id", "f"."numero", "c"."raison_sociale"
FROM "b_t4z56fq_crm"."factures" AS "f"
LEFT JOIN "b_t4z56fq_crm"."clients" AS "c"
       ON "c"."_id" = "f"."clients_id"
WHERE "f"."_id" > $1
ORDER BY "f"."_id"
LIMIT $2;
```

---

## 13. Codes d'erreur définis par ce chapitre

Ces codes sont en anglais, à raison d'un par condition (A2, A23), et versés au registre unique des codes d'erreur. Ils peuvent y être ajoutés, jamais renommés ni resémantisés sans changement de version d'API, et ne sont jamais remplacés par une erreur serveur PostgreSQL brute.

Charge utile accompagnant tout code, dans l'enveloppe d'erreur du chapitre 08 : `code`, `object` (nature et clé de catalogue quand elle existe), `target_name`, `label`, `details`, et `suggestion` quand une action utilisateur est possible.

| Code | Déclencheur | Niveau |
|---|---|---|
| `LABEL_EMPTY` | Libellé vide après suppression des espaces | Validation |
| `LABEL_TOO_LONG` | Libellé de plus de 255 caractères en NFC | Validation |
| `LABEL_DUPLICATE` | Clé de comparaison de libellé déjà prise parmi les objets actifs du parent | Validation |
| `NAME_COLLISION_UNRESOLVED` | Suffixes `_2` à `_99` tous indisponibles ; `suggestion` porte un libellé alternatif | Validation |
| `IDENTIFIER_INVALID` | Nom technique saisi ne satisfaisant pas l'alphabet A ; ou, côté constructeur SQL, nom ne satisfaisant pas l'alphabet B | Validation / Incident |
| `LINK_CROSS_DATABASE` | Champ lien dont la table cible appartient à une autre base (§9.3) | Validation |
| `NAME_TOO_LONG` | Nom dérivé dépassant 63 octets après répartition (§9.6) | Invariant — incident |
| `NAME_TAKEN_OUTSIDE_REGISTRY` | Nom de schéma présent dans `pg_namespace` sans ligne de registre | Incident |
| `TENANT_ID_EXHAUSTED` | 10 tirages consécutifs en collision ou exclus | Incident |
| `PRIVILEGES_INSUFFICIENT` | Privilège `CREATE` ou propriété de schéma manquants (§11.1) | Amorçage — refus de démarrage |
| `COLLATION_VERSION_MISMATCH` | Version de collation de la base d'accueil différente de celle enregistrée | Amorçage — avertissement |
| `CONNECTION_CONTRACT_BROKEN` | `search_path` ou `TimeZone` non conformes au premier usage d'une connexion | Incident |
| `REGISTRY_DIVERGENT` | Écart bloquant entre le registre et le catalogue système (§11.4) | Incident — suspension des opérations de structure |
| `LOCK_UNAVAILABLE` | `lock_timeout` atteint sur le verrou consultatif ou sur un verrou de table | Exploitation |
| `SLUG_FALLBACK_APPLIED` | Nom de repli attribué faute de caractère exploitable (§3.5) | Avertissement, pas une erreur |

`DB_ENCODING_NOT_UTF8` est défini par le chapitre 02 et n'est invoqué ici qu'au titre du contrôle d'amorçage (§11.2).

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Deux alphabets normatifs : A (`^[a-z][a-z0-9_]{0,62}$`) pour les noms alloués, B (`^_?[a-z][a-z0-9_]{0,62}$`) pour tout nom émis | Le moteur doit pouvoir émettre `"_id"`, `"_basedb"` et `"_basedb_local"` ; un alphabet unique interdirait la moindre requête | Alphabet unique sans `_` de tête, avec liste d'exceptions traitée hors validation |
| Contrainte d'octets écrite séparément (`octet_length(name) <= 63`) | Protège d'une évolution de l'alphabet ; interdit le comptage en unités UTF-16 | Compter sur la longueur en caractères de l'expression régulière |
| Slugification en 10 étapes, NFKD, locale racine, double passe de suppression des marques | Déterminisme inter-machines ; le repliement de casse crée des marques combinantes qu'une seule passe laisserait devenir des `_` | Une seule suppression de marques avant le repliement |
| Aucune romanisation des écritures non latines ; domaine de validité v1 borné aux libellés à dominante latine | Les systèmes de romanisation sont multiples et contestés ; un choix arbitraire produit des noms que personne ne reconnaît | Embarquer des tables de romanisation par écriture |
| Nom technique saisissable à la création | Rend le produit utilisable hors domaine latin sans passer par une opération d'administration | Laisser le repli aléatoire comme seule issue |
| Budgets 53 / 48 / 48 / 63 octets (A6) | Protège les noms dérivés à un seul composant ; rend les composites lisibles après répartition | 63 octets partout, au détriment de tous les noms dérivés |
| Répartition du budget par composant pour les noms dérivés composites, sans empreinte cryptographique (A6) | Un `fk_` lisible aux deux bouts, là où il est lu : les messages d'erreur | Raccourcissement par empreinte SHA-256, ou désambiguïsateur opaque inséré dans le nom |
| Troncature dure, sans recul jusqu'au séparateur | Deux implémentations indépendantes donnent le même résultat | Reculer au dernier `_` (heuristique, longueurs imprévisibles) |
| Deux familles d'indisponibilité : mots réservés et noms pris → boucle de suffixe ; préfixes réservés → échappement `x_` | Un suffixe ne corrige pas un préfixe ; `zz_archive_2` reste interdit | Boucle de suffixe pour tout ; ou refus à la saisie |
| `x_` n'est pas lui-même un préfixe réservé | Sinon l'échappement interdirait sa propre sortie et bouclerait | Ajouter `x_` aux préfixes réservés « pour l'idempotence » |
| Filtre des mots-clés étendu à `catcode IN ('R','T','C')` | La catégorie C est la liste des noms de types SQL : une colonne `row` ou une table `time` piègent les consommateurs à vie | `('R','T')` seulement |
| Aucun contrôle de mot réservé, de `pg_` ni de schéma réservé sur le slug de base ; `_basedb` et `_basedb_local` réservés au seul alphabet B | Le préfixe `b_<tenantId>_` rend le nom assemblé disjoint de ces familles ; les contrôles seraient vides de sens ou refuseraient des libellés légitimes | Appliquer ces interdictions au slug de base |
| Pas d'interdiction du préfixe `b_` pour les bases | La lecture positionnelle du §5 rend le cas non ambigu | L'interdire pour raison esthétique |
| `_basedb.physical_name` seul détenteur du nom physique ; les tables d'objets le référencent par clé étrangère (A5) | Deux copies divergent ; le catalogue est la source de vérité unique | Colonne de nom dupliquée sur chaque table d'objet |
| Règles de calcul, états et transitions ici ; DDL, `CHECK`, index unique et vue qualifiée au chapitre 02 (A5) | Une seule définition du stockage, une seule des règles | Redéfinir le registre dans les deux chapitres |
| `scope_id` = le **schéma** pour les relations ; l'instance pour les schémas ; la table pour champs et déclencheurs | Sans cela les vues SQL d'un alias de compatibilité ne peuvent pas porter le nom des tables réelles | `scope_id` = la base |
| Le registre enregistre le **nom assemblé** pour les schémas | Deux tenants doivent pouvoir avoir chacun une base « CRM » | Enregistrer le slug de base sous une portée d'instance |
| Colonnes d'identifiants et index d'unicité en `COLLATE "C"` | Un changement de version de collation système réordonne un index unique et laisse passer des doublons | Collation par défaut de la base d'accueil |
| Clé de comparaison de libellé calculée par l'application et stockée dans `label_key` | `lower()` n'est pas le repli de casse Unicode et dépend de la collation | Index unique sur `lower(libelle)` |
| Libellé unique parmi les objets **actifs** ; nom physique occupé à vie, aucune ligne de registre détruite | Le libellé appartient à l'utilisateur, le nom à l'historique ; l'épuration des pierres tombales ne doit pas rouvrir un nom | Occuper aussi le libellé après suppression logique ; épurer les lignes `purged` |
| Cinq états de registre (A5), transitions explicites, `retired → alias` comme seule exception, ouverte aux schémas et aux tables | Rend calculables la purge, l'historique des structures et les alias de renommage du chapitre 06 | Un simple booléen « actif » ; ou restreindre l'alias aux seuls schémas |
| Unicité par contrainte `UNIQUE (scope_id, name)`, `SELECT` préalable non contractuel | Le *check-then-act* en `READ COMMITTED` produit deux lignes pour un objet | Se fier au `SELECT` |
| Allocation sérialisée par portée via un verrou consultatif dont la clé entière est attribuée et stockée au catalogue (A8), acquis avant tout verrou de table | Suffixes denses, pas d'annulation de DDL, pas d'interblocage ; `hashtext()` collisionne entre bases sans rapport | `hashtext()` ; ou rejeu optimiste seul |
| Une **étape** de structure = une connexion = une transaction, sur le pool `ddl` ; l'opération est un plan à plusieurs étapes (A11) | « DDL et catalogue ensemble » est impossible sur deux connexions sans 2PC ; `CREATE INDEX CONCURRENTLY` interdit la transaction unique | Une transaction unique pour toute l'opération ; répartir l'étape entre `catalogue` et `donnees` |
| Paramètres sémantiques posés dans le paquet de démarrage ; dimensionnement et délais au chapitre 10 | Un `SET` de session est détruit par `DISCARD ALL` / `RESET ALL` au retour au pool | `SET search_path = ''` après connexion ; trois tableaux de pools concurrents |
| Séquences créées explicitement, nom alloué avant le DDL ; aucune séquence pour `_id`, servi par `_basedb_local.uuid_generate_v7()` (A9) | `ChooseRelationName()` uniquifie : le registre enregistrerait un nom que la base n'a pas attribué | `bigserial` / `GENERATED AS IDENTITY`, ou relecture par `pg_get_serial_sequence()` |
| Un seul index généré par colonne, avec déduplication catalogue | Sinon deux index identiques et deux noms indiscernables dès qu'un utilisateur indexe une colonne de lien | Motifs distincts pour l'index d'office et l'index demandé |
| Colonne de lien : `<table_cible>_id`, puis slug du libellé du champ suivi de `_id`, puis suffixe numérique (A7) ; nom figé à la création | Deux liens vers la même cible restent discernables dans un `SELECT` | Numéroter directement (`clients_id_2`) |
| Motif de déclencheur `tg_<table>__<role>`, liste des rôles fixée par le chapitre 07 (A10) | Un seul endroit décide quels déclencheurs existent sur une table utilisateur | Vocabulaire fermé de rôles défini ici |
| Les objets dérivés ne sont pas renommés lors d'une relégation | Aucun risque de collision (noms jamais réattribués) ; renommer ferait exploser les budgets | Les renommer avec le même marqueur |
| Marqueur de relégation **après** le préfixe positionnel pour les schémas, slug retronqué à 32 octets | Préserve la lecture par position et la limite de 63 octets | `zz_supprime_<date>_b_<tenantId>_<base>` |
| Un lien ne traverse jamais deux bases en v1 (`LINK_CROSS_DATABASE`) | Rend `<table_cible>_id` non ambigu, fixe le schéma de la contrainte et de l'index | Autoriser les liens inter-bases sans règle de nommage associée |
| Contrôles d'amorçage : privilèges, encodage `UTF8`, version de collation, contrat de connexion | Le chapitre fabrique des schémas : il doit dire ce qu'il exige et échouer avec un nom | Découvrir le manque au premier `CREATE SCHEMA` |
| Codes d'erreur en anglais, un par condition (A23) | Un code est un identifiant machine porté par un registre unique, pas un message | Codes en français, dédoublés d'un chapitre à l'autre |
| Le nom physique attribué est retourné à l'appelant et affiché | C'est ce nom que les consommateurs SQL écriront | Le laisser deviner |

## Risques et limites connues

- **Croissance monotone du registre.** Aucun nom n'est jamais libéré : un cycle création/suppression répété sur le même libellé épuise `_2`…`_99` puis échoue en `NAME_COLLISION_UNRESOLVED`. Le cas demande 99 suppressions logiques du même libellé dans la même portée ; il est improbable mais atteignable par un automate mal réglé.
- **Lisibilité des noms très longs.** Au-delà de `_9`, la troncature ronge le nom d'un octet supplémentaire ; après répartition, un nom dérivé à deux composants longs reste correct mais tronqué. Le libellé, lui, reste intact.
- **Tenants non latins.** Hors du domaine de validité v1, l'utilisateur doit saisir ses noms techniques lui-même. Sans cette saisie, tous ses objets portent des noms de repli et la promesse d'exploitation SQL directe tombe.
- **Espace des `tenantId`.** 2³⁰ valeurs : au-delà de quelques dizaines de milliers de tenants, les collisions sont l'ordinaire (gérées par rejeu) ; au-delà de quelques centaines de milliers, l'allongement du `tenantId` serait un déménagement de tous les schémas, sans chemin de migration prévu.
- **Sérialisation des allocations.** Le verrou consultatif par portée plafonne le débit de création de structures dans une même base, et une étape de structure longue fait attendre les autres jusqu'à `lock_timeout`. C'est le prix de suffixes denses et de migrations non annulées.
- **Le registre n'est pas préventif.** Le rôle utilisé étant propriétaire de la base d'accueil, rien n'empêche un tiers d'y créer des objets. La réconciliation (§11.4) détecte, elle ne protège pas.
- **Changement de version de collation.** Les identifiants sont immunisés par `COLLATE "C"`, mais les index utilisateur sur colonnes texte ne le sont pas : la procédure `REFRESH COLLATION VERSION` + `REINDEX` reste à la charge de l'exploitation.
- **Noms dérivés d'objets relégués.** `pk_factures` survit à la relégation de `factures` : la lecture brute d'un journal PostgreSQL demande de connaître la règle du §9.5. La traduction d'erreur du chapitre 03 referme l'écart côté utilisateur, pas côté exploitation.

## Questions ouvertes

1. **Droit de saisie du nom technique.** Ouvert à tout rôle pouvant créer une table, ou réservé à un rôle d'administration comme le renommage physique ? La question relève du chapitre 05.
2. **Romanisation en v2.** Quelles écritures, quelles tables, avec quel arbitrage linguistique, et faut-il rendre le choix configurable par tenant ?

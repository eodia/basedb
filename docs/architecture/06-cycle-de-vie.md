# 06 — Cycle de vie : renommage, alias, suppression logique, purge

## Rôle de ce chapitre

Ce chapitre spécifie ce qui arrive à un objet — base, table, champ — entre sa création et sa disparition physique : renommer son libellé, renommer son nom en base, le retirer de la vue de tout le monde, le détruire pour de bon, ou le ramener.

Il **compose** des mécanismes posés ailleurs et ne les redéfinit pas : les alphabets, budgets d'octets, motifs de relégation et états du registre viennent du chapitre 01 — Conventions de nommage ; le DDL du catalogue, le registre des classes de verrous, les états physiques et la réconciliation de référence du chapitre 02 — Schéma du catalogue `_basedb` ; la machine à états des migrations, l'ordre de pose d'un champ lien et la traduction des erreurs serveur du chapitre 03 — Moteur DDL ; la projection des types, l'empreinte physique d'un champ et le budget d'attributs du chapitre 04 — Types de champs ; la définition du rôle d'administration et la non-divulgation du chapitre 05 — Permissions ; l'historisation du chapitre 07 ; les pools, l'ordonnanceur et la sauvegarde du chapitre 10.

Un principe gouverne tout ce qui suit : **le catalogue est le seul à savoir qu'un objet a changé de nom ou a disparu ; PostgreSQL n'en garde qu'une trace inerte.** Un nom qui n'est plus servi n'est pas effacé, il est marqué. Une colonne supprimée n'est pas détruite, elle est reléguée. Une base supprimée est un schéma renommé. C'est cette inertie qui rend la restauration possible, et c'est elle qui coûte — en octets d'identifiants, en numéros d'attributs, en discipline d'exploitation. Les deux faces sont traitées ici.

Second principe, jamais enfreint : **une opération de cycle de vie est une migration** au sens de A11, c'est-à-dire une suite d'étapes numérotées, chacune dans sa propre transaction sur le pool `ddl`, chacune idempotente et rejouable, dont l'avancement est persisté hors des transactions qu'il décrit. Aucune opération de ce chapitre n'est « une transaction » ; toutes sont des plans. C'est ce qui permet d'avoir à la fois l'atomicité exigée — aucune étape ne laisse un objet physique sans sa description au catalogue — et des verrous tenus quelques millisecondes sur des tables de dix millions de lignes.

Le socle est PostgreSQL 16 (A1), contrôlé au démarrage avec `POSTGRES_VERSION_TOO_OLD`. Aucune extension n'est requise par ce chapitre : les identifiants des lignes de catalogue qu'il crée viennent de `_basedb_local.uuid_generate_v7()` (A9).

---

## 1. Deux registres : le libellé et le nom physique

### 1.1 Ce qui les sépare

| | Libellé | Nom physique |
|---|---|---|
| Vit dans | le catalogue seulement | `_basedb.physical_name` **et** PostgreSQL |
| Modifiable par | tout rôle portant `manage_schema` sur la portée de l'objet | rôle d'administration seulement |
| Effet en base | aucun, hors le `COMMENT ON` d'un objet sans description (ci-dessous) | `ALTER … RENAME`, verrou `ACCESS EXCLUSIVE` |
| Contraintes | `label_key` non vide, ≤ 255 caractères NFC, unique parmi les objets vivants du parent | alphabets, budgets et mots réservés du chapitre 01 |
| Libéré à la suppression | **oui, immédiatement** | **jamais**, y compris après la purge |
| Trace | `audit_log` | `audit_log` + `_basedb.migration` + ligne de registre |

Renommer un libellé est un `UPDATE` d'une ligne de catalogue et rien d'autre. C'est délibérément banal : c'est l'opération la plus fréquente, elle ne prend aucun verrou sur une table de données — à une exception, dite plus bas —, et elle n'est pas une migration. Le `COMMENT ON` du schéma `b_*` porte la `description` de l'objet et son libellé seulement à défaut (chapitre 04 §1.1) : renommer un objet **décrit** ne touche donc pas au commentaire. Renommer un objet **sans description** le réécrit avec le nouveau libellé, dans la même transaction, par un unique `COMMENT ON` de la classe « Pose » du chapitre 03 §2.2 : c'est l'exception, un verrou bref sur la table, mais un énoncé et non un plan, aucune étape à reprendre, et toujours pas une migration.

**Éditer une description** est du même registre : une ligne de catalogue, `manage_schema` sur la portée de l'objet, aucune migration. Le `COMMENT ON` de la table ou de la colonne est réécrit **dans la transaction de l'édition**, sur le pool `ddl`, jamais avant ni après elle — le catalogue et le commentaire ne se contredisent à aucun instant observable, ce que vérifie `CAT-CMT`. L'opération incrémente `base.catalog_version` (§1.3) : la description est projetée par la documentation, la spécification OpenAPI et le MCP, qui doivent la suivre sans qu'on vide un cache. La description d'une base, sans contrepartie physique, ne réécrit aucun commentaire. La valeur elle-même — texte brut, 1 000 caractères au plus, refusée au-delà et jamais tronquée — suit les règles du chapitre 02.

### 1.2 Ce que « rôle d'administration » signifie ici

Définition opérationnelle employée dans tout ce chapitre, dont le chapitre 05 reste l'autorité : **`app_user.is_instance_admin` vrai, ou une permission `manage_schema` de portée `tenant`.** Une permission `manage_schema` de portée inférieure autorise la création, la modification et la suppression logique d'objets ; elle n'autorise **jamais** le renommage physique, le `ON DELETE CASCADE`, la coupure à blanc, la suppression d'un alias, le remplacement des valeurs d'une colonne reléguée, ni la purge. Le refus porte `ADMIN_REQUIRED` (403) lorsque l'acteur a le droit de voir l'objet, et `RESOURCE_NOT_FOUND` (404) sinon.

### 1.3 Propagation du changement, et l'angle mort propre aux alias

Toute opération de ce chapitre incrémente `base.catalog_version` dans la transaction de sa dernière étape et émet `NOTIFY basedb_catalog` **dans cette même transaction** — `NOTIFY` est transactionnel, il est délivré au `COMMIT` et jamais avant. Le protocole complet — connexion d'écoute hors pool, sondage périodique, durée de vie maximale du cache, relecture et rejeu unique sur `42P01` / `42703` — appartient au chapitre 10. Ce chapitre en tire trois conséquences qui lui sont propres.

**Un renommage avec alias ne lève aucune erreur, donc ne déclenche aucun rattrapage.** C'est l'exception à la règle « un cache périmé se signale par un `42P01` ». Un processus dont le cache est en retard continue d'émettre l'ancien nom, celui-ci résout vers la vue d'alias, et la requête réussit. La borne de péremption du cache est donc le **seul** mécanisme qui ramène ce processus à jour.

**Cet angle mort est borné et bénin, et il faut le dire pour qu'on ne construise pas de rustine contre lui.** La vue d'alias désigne la table réelle par son OID : une écriture qui la traverse atterrit dans la bonne table, les valeurs par défaut s'appliquent, et **les déclencheurs de la table de base se déclenchent normalement**. Un processus en retard écrit donc des données correctes, à travers une vue plutôt que directement. Trois écarts seulement, tous détectables :

1. La vue est **figée** aux colonnes existant à l'instant du renommage. Un processus en retard qui vise une colonne créée depuis obtient `42703`, ce qui déclenche la relecture et le rejeu — le filet fonctionne là où il est nécessaire.
2. Les formes d'écriture que PostgreSQL refuse sur une vue automatiquement modifiable échouent (§3.3). Le noyau n'en émet aucune ; un consommateur externe, si.
3. Après une suppression logique de champ, la vue est régénérée dans la même étape (§3.4) : un champ supprimé n'y reste jamais lisible.

**Aucune opération de cycle de vie n'est jamais rejouée automatiquement par l'exécuteur de requêtes.** Le rejeu unique sur `42P01` / `42703` s'applique aux opérations de données, qui tiennent dans une transaction. Une opération de cycle de vie est un plan à plusieurs transactions : son rejeu est celui de la machine à états des migrations, étape par étape, précédé du contrôle d'existence dans `pg_catalog`, et déclenché par un humain ou par la reprise au démarrage.

---

## 2. Renommage physique

Renommer en base n'est pas un champ de l'écran de paramétrage. C'est une opération d'administration, avec analyse d'impact, confirmation par saisie, et trace de ce que l'administrateur avait sous les yeux.

### 2.1 Déroulé de l'écran

1. **Cible et nouveau nom.** L'écran affiche le nom actuel qualifié (`b_t4z56fq_crm.clients`, lu par `_basedb.v_physical_name_qualified`) et propose le slug dérivé du libellé courant ; l'administrateur peut saisir le nom à la main. Il est validé par l'alphabet A du chapitre 01 et soumis aux mêmes interdictions : mots réservés, préfixes réservés, budgets d'octets.
2. **Analyse d'impact.** Le moteur produit : la liste des consommateurs connus (§2.2), les colonnes de lien qui deviendront désalignées (§2.6), le nombre de lignes **estimé** et la taille de l'objet, les objets dépendants inconnus du catalogue (§3.4), et l'occupation réelle du nom visé dans `pg_class` et `pg_namespace`.
3. **Options.** Case « créer un alias de compatibilité », cochée par défaut, échéance par défaut de 180 jours. La case est **désactivée et grisée pour un renommage de champ**, motif affiché (§3.1).
4. **Confirmation.** Saisie du nom actuel en toutes lettres. La liste des consommateurs affichée est recopiée telle quelle dans la charge utile de l'entrée `audit_log` : on doit pouvoir savoir, six mois plus tard, ce que l'administrateur avait sous les yeux, et non ce que la même requête rendrait aujourd'hui.
5. **Exécution.** Le plan du §2.4.

**Le comptage est une estimation, et l'écran le dit.** `count(*)` exact est un parcours complet : sur dix millions de lignes, l'ouverture de l'écran coûterait plusieurs secondes et chargerait la base au moment précis où l'on s'apprête à demander un verrou exclusif. L'écran affiche donc `pg_class.reltuples`, explicitement libellé « estimation », accompagné de `pg_total_relation_size()` qui, lui, est instantané, et d'un bouton facultatif « compter exactement ». `reltuples` vaut `-1` sur une table jamais analysée (A1) : l'écran affiche alors « inconnu », jamais zéro. Seule la purge fait un comptage exact, pendant l'export, qui parcourt déjà les lignes (§5.2).

**Les écrans de renommage physique et de listing des consommateurs sont hors phase 2**, dont ne font partie que les primitives DDL de renommage et d'alias. Ce qui suit spécifie donc d'abord les primitives, ensuite le contenu des écrans.

### 2.2 Les consommateurs connus : d'où vient chaque ligne

| Ligne affichée | Source | Fiabilité |
|---|---|---|
| Webhooks abonnés | `webhook_subscription` joint à `webhook` (`is_active`, `deleted_at IS NULL`), par `table_id` ; pour une base, tous ses webhooks | **Exacte**, déclarative |
| Jetons d'intégration actifs récemment | `api_token` où `revoked_at IS NULL AND expires_at > now() AND last_used_at > now() - interval '30 days'` | Bonne, mais **globale au tenant** : on sait qu'un jeton a servi, pas qu'il a touché cet objet |
| Acteurs ayant lu le schéma sur 30 jours | `audit_log`, `action = 'schema.read'`, servi par `idx_audit_schema_read` | Bonne |
| Workflows | **n'existe pas** comme objet de basedb | voir ci-dessous |
| Consommateurs SQL directs | — | **inobservable** (§2.3) |

`api_token.last_used_at` est écrite au plus une fois toutes les cinq minutes par jeton et n'est indexée nulle part (chapitre 02) : elle est exacte à cinq minutes près, jamais à la requête près, et l'écran l'annonce. Les lectures de schéma, elles, ne viennent que de trois surfaces — `GET /schema`, le téléchargement OpenAPI, les outils MCP de description —, dont le volume autorise une ligne `audit_log` par appel ; les lectures de **données** sont trop volumineuses pour y entrer et n'y entrent pas. Ce sont bien les lecteurs de schéma qui intéressent l'écran : ce sont eux qui ont matérialisé la forme quelque part.

**Aucune table d'agrégat d'accès n'est créée.** Le catalogue a déjà `audit_log`, partitionnée et dotée d'une rétention. Une seconde table, indexée sur six colonnes et dimensionnée au produit « objets × acteurs × surfaces × jours », coûterait des centaines de millions de lignes pour répondre à une question qui n'en demande que trente, et introduirait des clés étrangères vers `app_user` et `api_token` capables de rendre un jeton indestructible.

**« Rôles ayant lu » est mal posé, et l'écran ne l'affiche pas tel quel.** Un utilisateur porte plusieurs rôles ; attribuer sa lecture à l'un d'eux serait arbitraire. L'écran liste donc des **acteurs** — utilisateur nommé, ou jeton nommé — et n'affiche un rôle que pour les jetons, où `api_token.role_id` le rend univoque.

**Les workflows n'existent pas comme objet de basedb.** Le cadrage prévoit n8n via HTTP et webhooks : un workflow est, vu d'ici, un jeton plus un webhook. On affiche donc les jetons et les webhooks en disant explicitement qu'ils sont la projection des workflows externes, et on s'appuie sur `api_token.label` et `webhook.label` pour que l'humain reconnaisse les siens. Conséquence à porter jusque dans l'interface : l'écran de création d'un jeton demande « à quoi sert ce jeton ? », pas « nom du jeton ».

### 2.3 Les consommateurs SQL directs : ce qu'on ne saura pas

**Le point à dire franchement : les consommateurs que l'alias existe pour protéger sont exactement ceux qu'on ne sait pas mesurer.** L'API, le serveur MCP et l'interface résolvent les noms par le catalogue, sont parfaitement journalisés, et ne cassent jamais puisqu'ils ne connaissent que le nom courant. Un script `psql`, un rapport Metabase, un modèle dbt qui écrit `b_t4z56fq_crm.clients` à la main n'est visible d'aucune table du catalogue.

Il n'existe aucun moyen de l'observer dans le périmètre de privilèges retenu, et le chapitre 02 en tire la conséquence : les compteurs `db_schema.app_access_count` et `db_schema.app_last_access_at` **ne mesurent que ce qui passe par l'application**, et leur nom le dit. Quatre pistes sont fermées, non par choix mais par contrainte : `pg_stat_statements` et le journal des requêtes exigent `shared_preload_libraries`, donc un privilège d'instance que le cadrage interdit ; les vues n'ont pas de compteur propre dans `pg_stat_*`, n'ayant pas de tas ; il n'existe pas de déclencheur sur `SELECT`, et une fonction volatile placée dans la vue pour écrire un journal casse toute transaction en lecture seule et peut être court-circuitée par le planificateur. `pg_stat_user_tables` reste consultable, mais ses compteurs sont cumulatifs et remis à zéro par `pg_stat_reset()`, par `pg_upgrade` et — bien plus fréquent — **par tout arrêt brutal du serveur**.

**Conséquence de gouvernance, écrite ici pour qu'aucun écran ne prétende le contraire : on ne supprime jamais un alias sur la foi d'un compteur.** La seule méthode fiable pour savoir si un alias sert encore est la coupure à blanc (§3.5), et l'écran de renommage avertit explicitement que les connexions SQL directes ne sont pas observables.

### 2.4 Ordre canonique d'une étape, et plans de renommage

Ordre valable pour **toutes** les étapes de ce chapitre qui émettent du DDL :

1. `SET LOCAL lock_timeout = '5s'` et `SET LOCAL statement_timeout` au budget de l'étape.
2. Verrous consultatifs du registre `_basedb.lock_class` (A8), pris par numéro de classe croissant : `name_allocation` (classe 2, seconde clé = `lock_key` de la portée d'allocation — `db_schema.lock_key` pour un nom de table, `table_def.lock_key` pour un nom de champ, la clé réservée `1` pour un nom de schéma), puis `structure_step` (classe 3, `base.lock_key`). **L'ordre est imposé** : deux familles de verrous prises dans deux ordres différents produisent un `40P01` après `deadlock_timeout`, parfaitement évitable. Le verrou d'allocation est toujours acquis avant tout verrou de table (chapitre 01 §6.4).
3. `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` sur **toutes** les relations que l'étape va modifier, **par OID croissant**, avant toute autre écriture.
4. Écritures dans `_basedb` : registre des noms, tables d'objets, états physiques.
5. DDL.
6. Incrément de `base.catalog_version` et `NOTIFY` — à la dernière étape du plan seulement.

**Pourquoi cet ordre, et pas un autre.** Prendre les verrous de relation en tête de transaction, en une fois, borne le gel à **une** fenêtre de `lock_timeout` au lieu de N : sans cela, une étape qui renomme, crée une vue puis supprime une contrainte peut faire patienter les lecteurs jusqu'à 5 s × nombre d'acquisitions, en conservant pendant tout ce temps les verrous déjà obtenus. Écrire les lignes de catalogue **après** les verrous de relation évite l'inverse : une transaction qui verrouille d'abord le catalogue, puis attend un `ACCESS EXCLUSIVE` derrière une lecture longue, transforme une attente sur les données en gel du plan de contrôle et bloque toutes les autres migrations du tenant.

**Ce que `lock_timeout` fait, et ce qu'il ne fait pas.** Il borne à 5 secondes l'attente derrière autrui ; il ne supprime pas la file. Une demande d'`ACCESS EXCLUSIVE` entre dans la file dès son émission, et la file est ordonnée : toute requête arrivant après elle se place derrière, y compris un simple `SELECT`. Une table lue par un rapport de quatre minutes n'est donc pas gelée quatre minutes — la demande échoue en `55P03` au bout de 5 secondes et libère la file —, mais elle est bien gelée pendant ces 5 secondes. `lock_timeout` ne borne par ailleurs jamais la **détention** d'un verrou : ce qui la borne ici, c'est que chaque étape n'émet que du DDL de catalogue, instantané par nature. `55P03` est traduit en `LOCK_UNAVAILABLE` (503), réessayable avec repli exponentiel, et l'entrée d'échec porte l'identité du détenteur du verrou (§9.1).

**Plan d'un renommage de table.** Le renommage et la création de l'alias tiennent dans la même étape : les deux ordres portent sur la même relation, dont le verrou est déjà détenu, et `CREATE VIEW` ne demande qu'un `ACCESS SHARE` sur la table source.

| # | Étape | Nature | Contenu |
|---|---|---|---|
| 1 | Contrôles | `READ ONLY`, 30 s | Disponibilité du nom visé au registre ; absence dans `pg_class` du schéma ; nombre d'alias vivants sur l'objet ; objets dépendants inconnus du catalogue ; estimation de taille |
| 2 | Renommage et alias | Verrou court, 5 s | Ordre canonique, puis `ALTER TABLE … RENAME TO`, `CREATE VIEW` de l'alias, mouvements de registre (`active → retired`, puis `retired → alias`), nouveau `table_def.name_id`, ligne `sql_view_alias`, `catalog_version`, `NOTIFY` |

**Plan d'un renommage de base.** Le schéma d'alias doit contenir une vue par table vivante ; à 500 tables, cela ne peut pas être une transaction.

| # | Étape | Nature | Contenu |
|---|---|---|---|
| 1 | Contrôles | `READ ONLY`, 30 s | Comme ci-dessus, plus l'absence du nom visé dans `pg_namespace` |
| 2 | Renommage | Verrou court, 5 s | `ALTER SCHEMA … RENAME TO`, `CREATE SCHEMA` de l'alias, nouveau `name_id` sur la ligne `db_schema` courante, ligne `db_schema` de `role = 'alias'`, `catalog_version`, `NOTIFY` |
| 3…n | Vues d'alias | Verrou court, 5 s, **par lots de 10 tables** | `CREATE VIEW` par table, une ligne `sql_view_alias` par vue |

Le découpage par lots de dix n'est pas un choix de ce chapitre : le chapitre 03 plafonne une migration à dix tables et refuse au-delà avec `MIGRATION_TOO_LARGE`. Le renommage d'une base à 500 tables est donc une opération d'administration composée de 51 migrations enchaînées, portant la même clé d'idempotence, reprenable, dont l'écran affiche la progression.

**Conséquence assumée, annoncée avant confirmation : entre la fin de l'étape 2 et la fin de la dernière étape, l'ancien nom de schéma existe mais ne contient pas encore toutes ses vues.** Un consommateur SQL direct obtient `42P01` sur une table pas encore aliasée, pendant quelques secondes à quelques minutes. L'alternative — une transaction unique de 500 `CREATE VIEW` — supprimerait cette fenêtre au prix d'une transaction sans borne de durée, non reprenable, et d'une déconnexion HTTP laissant l'administrateur sans information sur un travail qui continue côté serveur. On préfère une interruption courte, annoncée et reprenable à une opération opaque.

### 2.5 Renommages en chaîne

| Situation | Résultat |
|---|---|
| `clients` → `comptes` (alias `clients`), puis `comptes` → `tiers` | Les deux alias vivent. La vue `clients` **suit l'objet** : PostgreSQL résout par OID, elle pointe vers `tiers` sans intervention. `sql_view_alias.target_table_id` est une clé de catalogue, donc invariante. Rien à faire. |
| Renommer vers un nom occupé par un alias | **Refus `NAME_RETIRED`.** L'écran nomme l'alias en cause, sa date, et propose `clients_2` en un clic. |
| Renommer vers le nom d'un objet purgé ou relégué | Même refus : le registre conserve le nom à vie, quel que soit son état. |
| Renommer vers un nom porté par un objet inconnu du catalogue | **Refus `NAME_TAKEN_OUTSIDE_REGISTRY`**, avec le type, le schéma et le propriétaire de l'objet occupant. Détecté à l'étape de contrôle, jamais au DDL. |
| Renommer deux fois | Autorisé, un alias par renommage. **Plafond de 5 alias vivants par objet** : au-delà, `TOO_MANY_ALIASES`. Un objet renommé six fois est un problème de gouvernance, pas de moteur. |
| Permuter deux noms (A ↔ B) | **Impossible, et c'est définitif.** `uq_physical_name` interdit qu'un nom serve à un autre objet. L'utilisateur obtient `clients_2` et `comptes_2`. L'écran l'annonce avant confirmation plutôt que d'échouer en cours de route. |

**La boucle de suffixe ne s'applique jamais silencieusement à un renommage d'administration.** Le chapitre 01 l'applique lors d'une allocation ordinaire, où l'utilisateur fournit un libellé et se moque du nom produit. Ici l'administrateur a saisi un nom exact : lui rendre `clients_2` sans le dire serait le pire des deux mondes. Le refus est explicite, la suggestion est proposée, et c'est un second clic qui l'accepte.

### 2.6 Renommage physique et relations

**La contrainte de clé étrangère survit à tout renommage** : elle référence des OID, jamais des noms. Son propre nom, `fk_<table_source>__<colonne>`, contient le nom de la table **source** ; renommer la table **cible** ne le rend pas faux. L'index `ix_<table_source>__<colonne>` de même. Aucun objet dérivé n'est renommé — règle du chapitre 01 §9.5, qui vaut ici sans exception.

**Ce qui casse, c'est la convention `<table_cible>_id` de la colonne référençante.** Décision : **la colonne de clé étrangère n'est jamais renommée en cascade**, conformément à A7, qui fige le nom à la création. Une cascade transformerait un renommage administratif en opération à N objets, cassant N consommateurs pour un gain cosmétique ; la colonne peut déjà ne pas suivre la convention, le deuxième lien vers une même cible étant nommé d'après le libellé du champ ; et le nom de la colonne n'est pas la source de vérité du lien — le catalogue l'est.

Ce que voit un consommateur SQL après coup : `b_t4z56fq_crm.factures.clients_id` référence `b_t4z56fq_crm.comptes._id`. Incohérent à l'œil, correct à l'exécution. Trois atténuations : le `COMMENT ON COLUMN` de la colonne de lien, quand le champ n'a pas de description, est régénéré et porte « Lien vers "comptes" (anciennement "clients") » ; la documentation générée et les outils MCP affichent la cible réelle, jamais le nom de la colonne comme indice ; l'écran de renommage liste les colonnes qui deviendront désalignées avec, pour chacune, un bouton de renommage **séparé**, chacun étant un renommage physique de champ à part entière, donc sans alias et avec son propre écran d'impact.

**Ce que l'alias couvre dans ce cas.** L'alias du renommage de table occupe l'ancien nom de table ; la colonne, elle, n'a pas bougé. Un consommateur qui écrivait `FROM clients` et joignait `f.clients_id = c._id` continue de fonctionner intégralement à travers la vue. L'alias couvre donc exactement le cas nominal, et rien de plus.

**Renommer `_id` n'existe pas.** C'est une colonne système : elle n'est pas exposée à l'éditeur de schéma, et l'API ne propose aucune opération qui la vise. Tous les noms dérivés, l'expansion `?expand=`, les charges utiles de webhooks et l'historique la nomment ; la rendre renommable créerait un nom variable au cœur de tout le produit pour aucun bénéfice. Il en va de même des quatre autres colonnes système (A18).

**Renommer le champ désigné colonne d'affichage** n'a aucun effet sur la désignation : elle est portée par `table_def.display_field_id`, une clé de catalogue, pas par un nom. Seuls les consommateurs SQL qui lisaient la colonne par son nom cassent — sans alias possible, conformément au §3.1.

---

## 3. Alias de compatibilité

### 3.1 Les deux granularités et leur DDL

Un alias est toujours **une ou plusieurs vues SQL**, jamais autre chose, et il n'existe qu'à deux granularités.

**Renommage de base** — un schéma portant l'ancien nom, contenant une vue par table vivante à l'instant du renommage :

```sql
ALTER SCHEMA "b_t4z56fq_crm" RENAME TO "b_t4z56fq_ventes";
CREATE SCHEMA "b_t4z56fq_crm";

CREATE VIEW "b_t4z56fq_crm"."factures" WITH (security_invoker = true) AS
  SELECT "f"."_id"         AS "_id",
         "f"."_created_at" AS "_created_at",
         "f"."_updated_at" AS "_updated_at",
         "f"."_created_by" AS "_created_by",
         "f"."_updated_by" AS "_updated_by",
         "f"."numero"      AS "numero",
         "f"."clients_id"  AS "clients_id"
  FROM "b_t4z56fq_ventes"."factures" AS "f";
```

**Renommage de table** — une vue portant l'ancien nom, dans le schéma courant de la base :

```sql
ALTER TABLE "b_t4z56fq_crm"."clients" RENAME TO "comptes";

CREATE VIEW "b_t4z56fq_crm"."clients" WITH (security_invoker = true) AS
  SELECT "c"."_id" AS "_id", … FROM "b_t4z56fq_crm"."comptes" AS "c";
```

Quatre règles de construction, toutes nécessaires :

- **Jamais `SELECT *`.** PostgreSQL développe l'étoile à la création ; une liste explicite est de toute façon ce qui est stocké, autant la maîtriser et la rendre comparable à un texte de référence versionné.
- **Chaque colonne porte un alias explicite `AS "<nom>"`.** Ce n'est pas une protection contre un renommage de colonne : **les noms de sortie d'une vue sont figés dans ses propres lignes `pg_attribute` à la création, et un `ALTER TABLE … RENAME COLUMN` sur la table de base ne les change jamais.** L'alias explicite rend le nom de sortie indépendant du texte SQL que le moteur régénère. Effet de lecture à connaître pour l'exploitation : après un renommage de colonne, `pg_get_viewdef` affiche `SELECT c.nouveau_nom AS ancien_nom`, c'est-à-dire un alias que personne n'a écrit. C'est la désérialisation de la définition, et c'est ce qu'on lira à trois heures du matin.
- **Les cinq colonnes système sont projetées.** Un consommateur SQL en a besoin, et `_id` est la clé de toute jointure.
- **`security_invoker = true`** : sans effet aujourd'hui, puisqu'il n'y a qu'un rôle, mais il garantit qu'un rôle en lecture seule créé plus tard par l'exploitant n'obtienne pas par la vue un accès qu'il n'a pas sur la table.

**Il n'existe pas d'alias de compatibilité pour un champ.** Un alias ne fonctionne que s'il occupe exactement le nom que le consommateur écrit déjà. Pour une colonne, cela supposerait soit une vue portant le nom de sa propre table dans le même schéma — impossible —, soit une colonne générée portant l'ancien nom. Cette seconde piste est rejetée : `GENERATED … STORED` duplique les données, impose une réécriture complète de la table sous `ACCESS EXCLUSIVE`, reste en lecture seule, et consomme un attribut sur les 1 600 (§8.1). Conséquence assumée : le renommage physique d'un champ est offert, avec le même écran d'impact, mais **sans filet**, et l'écran le dit avant confirmation.

### 3.2 Ce que le registre et le catalogue enregistrent

Un alias occupe un nom ; il apparaît donc au registre, faute de quoi la classe `CAT-NAME` le signalerait comme objet physique inconnu.

| Granularité | Ligne de registre | Transition |
|---|---|---|
| Schéma d'alias (renommage de base) | le nom de schéma, portée `instance` | `active → retired`, puis `retired → alias` |
| Vue d'alias dans un schéma d'alias | le nom de la vue, portée = le schéma d'alias, `object_kind = 'sql_view'` | allocation → `active` : la portée est neuve, le nom y est libre |
| Vue d'alias après renommage de table | le nom de la table, portée = le schéma courant | `active → retired`, puis `retired → alias` |

La transition `retired → alias` est encadrée par le chapitre 01 §6.3 et ouverte aux noms de schéma comme aux noms de table : l'objet qui reprend le nom n'est pas celui qui le portait, et le nom reste inattribuable à tout autre objet. `uq_physical_name (scope_id, name)`, non partiel, interdit d'ailleurs toute autre mise en œuvre.

Côté catalogue, un alias de base est une ligne `_basedb.db_schema` de `role = 'alias'` portant l'ancien `name_id`, `dropped_at` et les compteurs d'accès applicatifs ; chaque vue est une ligne `_basedb.sql_view_alias` (`schema_id`, `target_table_id`, `name_id`, `dropped_at`). Un alias de table est une seule ligne `sql_view_alias` dont le `schema_id` est le schéma courant. L'échéance et la fenêtre de coupure à blanc sont portées par la ligne d'alias — `drop_after`, `blank_cut_from`, `blank_cut_until` —, sur `db_schema` pour un alias de base et sur `sql_view_alias` pour un alias de table. **Aucune colonne ne recopie la liste des colonnes projetées** : la vue est son propre inventaire, et sa régénération lit ses `pg_attribute`.

### 3.3 Écriture à travers l'alias

**Décision : les vues d'alias sont modifiables, nativement, sans règle ni déclencheur.** Une vue à une seule relation source, sans `DISTINCT`, agrégat, fenêtre, `GROUP BY` ni opérateur ensembliste, dont toutes les colonnes sont des références simples, est automatiquement modifiable ; les valeurs par défaut de la table sous-jacente s'appliquent aux colonnes non listées dans un `INSERT`. *Alternative rejetée* : alias en lecture seule. Un workflow n8n qui insère par l'ancien nom est exactement le consommateur qu'il s'agit de ne pas casser ; lui rendre la lecture en lui retirant l'écriture ne fait que déplacer la panne.

**Ce qui traverse l'alias sans changement.** L'écriture est réécrite en une commande sur la table de base : les valeurs par défaut s'appliquent, et **tous les déclencheurs de la table de base se déclenchent normalement**, y compris la capture de A10 — une écriture passant par un alias est historisée comme les autres. `WITH CHECK OPTION` est sans objet, la vue n'ayant pas de `WHERE`.

**Ce qui ne traverse pas, parce que c'est applicatif et non physique** — vrai de toute écriture SQL directe, par l'alias ou non : `_created_by` et `_updated_by` ne sont pas renseignés faute de variable de session d'acteur, et aucune permission de champ n'est appliquée.

**Les trois écritures qu'une vue ne sait pas porter, et qu'il faut annoncer.** Elles sont la seule vraie perte de fonctionnalité de l'alias, et l'écran de renommage les liste :

| Forme | Pourquoi | Ce que voit le consommateur |
|---|---|---|
| `INSERT … ON CONFLICT (colonne) DO UPDATE` | Une vue n'a ni index ni contrainte : l'inférence d'arbitre n'a rien sur quoi porter | « no unique or exclusion constraint matching the ON CONFLICT specification » |
| `COPY <vue> FROM …` | `COPY` exige une table, ou une vue dotée d'un déclencheur `INSTEAD OF INSERT` | « cannot copy to view » |
| `TRUNCATE <vue>` | Non supporté sur une vue | Erreur de syntaxe d'objet |

`INSERT … ON CONFLICT DO NOTHING` sans spécification d'arbitre fonctionne, de même que `SELECT … FOR UPDATE`, `UPDATE`, `DELETE` et `RETURNING`. Le noyau n'émet aucune des trois formes du tableau ; un consommateur externe qui fait de l'upsert ou du chargement en masse par l'ancien nom, si — et c'est le seul cas où l'alias ne remplit pas sa promesse.

### 3.4 Régénération, et objets dépendants inconnus

Une vue d'alias est **figée** aux tables et aux colonnes existant à l'instant du renommage : une table créée ensuite n'apparaît pas dans l'alias de schéma, une colonne ajoutée ensuite n'apparaît pas dans la vue. L'alias est un pont de migration, pas un second nom permanent.

**Un renommage de colonne ne déclenche aucune régénération**, puisqu'il ne change pas le nom de sortie de la vue (§3.1). Il n'y a **qu'un seul cas** de régénération : **la suppression logique d'un champ que la vue projette**. Sans elle, la vue continuerait d'exposer, sous l'ancien nom, une colonne devenue `zz_supprime_…` — un champ « invisible partout » resterait lisible. `CREATE OR REPLACE VIEW` ne sait pas retirer une colonne : la régénération est un `DROP VIEW` suivi d'un `CREATE VIEW`, **dans l'étape même qui renomme la colonne** (§4.1), reconstruit à partir des `pg_attribute` de la vue moins la colonne retirée.

**Tout `DROP VIEW`, `DROP TABLE` et `DROP SCHEMA` de ce chapitre est précédé d'un contrôle de dépendance.** Un consommateur SQL peut avoir créé sa propre vue au-dessus d'une vue d'alias — usage typique d'un rapport ou d'un modèle de transformation, exactement le public que l'alias existe pour protéger. Le `DROP` échouerait alors en `2BP01 dependent objects still exist`, avec un message PostgreSQL brut, au milieu d'une opération courante. Le contrôle est fait **sous le verrou déjà acquis**, donc sans concurrence possible :

```sql
SELECT DISTINCT n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner)
FROM pg_depend d
JOIN pg_rewrite r   ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
JOIN pg_class   c   ON c.oid = r.ev_class
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE d.refobjid = <oid de l'objet à supprimer>
  AND d.refclassid = 'pg_class'::regclass
  AND c.oid <> <oid de l'objet à supprimer>;
```

Le refus porte `DEPENDENT_OBJECT` (409), nomme chaque dépendant, et propose deux issues : supprimer d'abord l'objet tiers, par son auteur ; ou, s'il s'agit d'une suppression d'alias, la faire précéder d'une confirmation d'administration assumant la casse. **Jamais de `CASCADE`** : la même politique protège les objets tiers partout dans ce chapitre, du `DROP VIEW` d'un alias au `DROP SCHEMA` d'une purge. Détruire en silence ce qu'un consommateur a créé dans un schéma qui lui est ouvert serait le contraire de l'intention des alias.

Ce contrôle figure aussi dans l'analyse d'impact du renommage, de la suppression logique d'un champ et de celle d'une table : l'écran annonce l'obstacle avant la confirmation, il ne le découvre pas à l'exécution.

### 3.5 Fin de vie d'un alias

Trois voies, dans cet ordre de préférence.

**1. Coupure à blanc.** L'administrateur renomme la vue pour une durée choisie ; les consommateurs cassés se manifestent d'eux-mêmes. Un bouton rétablit le nom en une opération, la vue n'ayant jamais été détruite.

- **Durée par défaut : 35 jours, configurable, jamais moins.** Quarante-huit heures ne couvrent aucun cycle mensuel : un export de clôture passerait la coupure sans bruit puis casserait le 31 du mois, après la suppression de l'alias, au pire moment. L'écran pose explicitement la question « quel est le cycle d'exécution le plus long connu sur cette base ? » et propose la durée correspondante.
- **Nom de coupure** : `zz_alias_<AAAAMMJJ>_<nom>`, assemblé par la répartition de budget du chapitre 01 §9.6 — parties fixes `zz_alias_` (9 octets), date (8) et séparateur (1), soit 45 octets pour le nom d'origine. Le nom est alloué au registre en état `relegated` et contrôlé dans `pg_class` du schéma d'accueil avant émission ; en cas de collision, la boucle de suffixe `_2 … _99` s'applique, et son épuisement rend `NAME_COLLISION_UNRESOLVED`. À la remise en service, la ligne de coupure passe `relegated → purged` et la ligne du nom d'alias `retired → alias`.
- **Le seul canal d'observation disponible est le journal d'erreurs du serveur PostgreSQL**, où un `42P01` accompagné de l'ancien nom apparaît sous `log_min_error_statement = error`, actif par défaut. basedb ne le lit pas : il n'a pas accès au système de fichiers du serveur. La documentation d'exploitation dit où le chercher. **Sans accès à ce journal, la coupure à blanc ne mesure rien** : sa durée doit alors être allongée, jamais raccourcie, et c'est le seul arbitrage honnête.
- **Une vue tierce posée sur l'alias n'est pas coupée** : elle suit le renommage par OID et continue de fonctionner. Elle est donc listée séparément à l'ouverture de la coupure, comme un consommateur connu que la mesure ne verra pas.
- Deux rappels automatiques, à mi-parcours et trois jours avant la fin de la fenêtre.

**2. Suppression après échéance.** `drop_after` atteint, l'écran d'entretien la propose ; elle n'est jamais automatique. Le rapport hebdomadaire de l'ordonnanceur la rappelle.

**3. Suppression forcée**, par un administrateur, à tout moment, avec confirmation.

Dans tous les cas : contrôle de dépendance (§3.4), puis `DROP VIEW`, puis `DROP SCHEMA` **sans `CASCADE`** pour un alias de base — si le schéma d'alias contient un objet inattendu, la suppression échoue au lieu de détruire en silence ce qu'un consommateur y aurait créé. Les lignes de registre passent `alias → retired`, `dropped_at` est renseigné sur la ligne d'alias, et cette ligne est conservée : elle est la trace du nom retiré.

---

## 4. Suppression logique

### 4.1 Champ

L'empreinte physique d'un champ — quelles contraintes, quel index, quelle valeur par défaut, quelle expression — est fixée par le chapitre 04 §1.11, qui énumère les objets à défaire. Ce chapitre en ordonne l'exécution et ajoute ce qui lui est propre : le nom de relégation et la régénération des vues d'alias.

| # | Étape | Nature | Contenu |
|---|---|---|---|
| 1 | Contrôles | `READ ONLY`, 30 s | Formules dépendantes ; vues d'alias projetant la colonne ; objets dépendants inconnus (§3.4) ; disponibilité du nom de relégation ; désignation d'affichage (§4.5 c) ; estimation de taille |
| 2 | Relégation | Verrou court, 5 s | Ordre canonique du §2.4, puis le bloc ci-dessous |
| 3 | Index | **Hors transaction** | `DROP INDEX CONCURRENTLY` de l'index de lien devenu inutile ; `table_index.state` passe `dropping → dropped` |

```sql
-- Étape 2, après SET LOCAL lock_timeout, verrous consultatifs,
-- et LOCK TABLE des relations concernées par OID croissant.
UPDATE _basedb.field
   SET deleted_at = $context_timestamp,
       deleted_by = $actor,
       is_live    = false,
       name_id    = $new_name_id
 WHERE id = $field_id;

DROP VIEW "b_t4z56fq_crm"."clients";              -- vues d'alias projetant la colonne
ALTER TABLE "b_t4z56fq_crm"."factures" DROP CONSTRAINT "ck_factures__remise__range";
ALTER TABLE "b_t4z56fq_crm"."factures" DROP CONSTRAINT "uq_factures__remise";
ALTER TABLE "b_t4z56fq_crm"."factures"
  RENAME COLUMN "remise" TO "zz_supprime_20260918_remise";
ALTER TABLE "b_t4z56fq_crm"."factures"
  ALTER COLUMN "zz_supprime_20260918_remise" DROP NOT NULL,
  ALTER COLUMN "zz_supprime_20260918_remise" DROP DEFAULT;
CREATE VIEW "b_t4z56fq_crm"."clients" WITH (security_invoker = true) AS …;  -- sans la colonne
```

La ligne de registre d'origine passe `active → retired`, la nouvelle est créée en `relegated`, et `field.name_id` bascule sur la nouvelle ; `previous_name_id` chaîne les deux (chapitre 02). `field.required_state` retombe à `absent` et les lignes `table_constraint` / `table_index` concernées passent à `dropped`.

**Le `DROP NOT NULL` n'est pas une commodité.** Sans lui, toute insertion ultérieure échoue sur une colonne que l'utilisateur croit disparue et que l'API ne renseigne plus. C'est la ligne la plus importante du bloc. Le `DROP DEFAULT` l'accompagne pour que la colonne reléguée cesse de consommer une valeur par défaut, et, si le champ était une formule projetée en colonne générée, `DROP EXPRESSION` s'y ajoute.

**Un index unique ne se supprime pas par `DROP INDEX`.** L'index qui porte une contrainte d'unicité disparaît avec elle, par `DROP CONSTRAINT` : le tenter autrement rend `2BP01`. Seul l'index de lien `ix_<table>__<colonne>`, qui n'adosse aucune contrainte, est supprimé — et il l'est **hors transaction, en `CONCURRENTLY`**, à l'étape 3. La règle d'atomicité catalogue/DDL n'y fait pas obstacle : elle se tient étape par étape (A11), et l'état intermédiaire `dropping` est représenté au catalogue. Une interruption entre les étapes 2 et 3 laisse un index sans champ correspondant : c'est une dérive `CYCLE-RELEG`, détectée et rejouable, pas une corruption.

**Format, budget et collision du nom de relégation.** `zz_supprime_` (12 octets) + `AAAAMMJJ` en UTC (8) + `_` (1) = 21 octets de préfixe, il reste **42 octets** pour l'ancien nom (chapitre 01 §9.5). Deux précisions que ce chapitre ajoute, parce qu'elles n'ont de sens qu'ici :

- **La date vient du même horodatage que `deleted_at`.** Le noyau ne lit jamais l'heure système : il lit l'horodatage figé du contexte de l'opération, et ce même instant alimente `deleted_at` et le suffixe `AAAAMMJJ` converti en UTC. Sans cette règle, une dérive d'horloge ou un fuseau mal configuré produirait un nom daté d'un jour et un `deleted_at` d'un autre, avec des écrans d'entretien et des tests qui divergent de façon intermittente. C'est aussi ce qui rend les noms reproductibles en test.
- **La collision se teste dans `pg_catalog`, jamais dans le registre seul.** Un nom `zz_supprime_…` est bien enregistré au registre, mais le registre n'est autorité que sur ce qu'il connaît, et une colonne reléguée peut préexister à basedb ou provenir d'une reprise manuelle. Le contrôle porte donc sur `pg_attribute` pour un champ — **y compris les attributs `attisdropped`**, dont le nom reste occupé sous une forme interne et dont le numéro n'est jamais réutilisé — et sur `pg_class` pour une table, un index ou un schéma. La boucle de suffixe `_2 … _99` s'applique aux trois granularités, la troncature reculant d'autant ; son épuisement rend `NAME_COLLISION_UNRESOLVED`. `octet_length(nom) <= 63` est vérifié avant émission, et un dépassement est un incident `NAME_TOO_LONG` : on ne compte jamais sur la troncature silencieuse de PostgreSQL, qui se contente d'un `NOTICE` que les pilotes ignorent.

### 4.2 Table

| # | Étape | Nature | Contenu |
|---|---|---|---|
| 1 | Contrôles | `READ ONLY`, 30 s | Champs lien actifs pointant vers la table (§4.5 a) ; contraintes physiques non déclarées (§4.5 d) ; objets dépendants inconnus ; vues d'alias pointant vers la table ; disponibilité du nom de relégation |
| 2 | Relégation | Verrou court, 5 s | Cascade logique sur les champs (voir ci-dessous) ; `DROP CONSTRAINT` de chaque clé étrangère **portée par** la table, avec `fk_dropped_at` sur le `field_link_config` correspondant ; `DROP VIEW` de chaque vue d'alias la visant ; `ALTER TABLE … RENAME TO "zz_supprime_20260918_clients"` ; `table_def.deleted_at`, nouveau `name_id`, `sql_view_alias.dropped_at` |

Quatre points qui ne vont pas de soi :

- **La cascade logique sur les champs est obligatoire, et la base l'impose.** Le miroir `field.table_is_live` et `ck_field_table_live` interdisent qu'un champ vivant survive à sa table : l'étape renseigne donc `deleted_at` sur tous les champs de la table, dans la même transaction. **Leurs colonnes ne sont pas renommées** et leurs lignes de registre restent `active` tant que l'objet physique existe : la table entière porte déjà le marqueur `zz_supprime_`, et renommer N colonnes allongerait une étape qui doit rester brève. Elles passeront `active → purged` avec la table (chapitre 01 §6.3).
- **Les contraintes et index ne sont pas renommés.** Ils restent sous `pk_clients`, `ix_clients__…` ; le registre garantit qu'une table recréée s'appellera `clients_2`, donc sans collision.
- **Les index de la table reléguée sont conservés.** Elle ne reçoit plus d'écritures : ils ne coûtent rien, et leur présence rend la restauration exacte et gratuite.
- **La liste des relations à verrouiller inclut les tables cibles.** `ALTER TABLE … DROP CONSTRAINT` sur une clé étrangère prend un `ACCESS EXCLUSIVE` sur la table référencée **aussi**, puisqu'il faut y détruire des déclencheurs système. Supprimer une table qui porte trois liens gèle donc brièvement quatre tables. Elles sont toutes verrouillées en tête d'étape, par OID croissant, et l'écran de confirmation les nomme.

### 4.3 Base

Le miroir `table_def.base_is_live` impose le même ordre d'un cran plus haut : supprimer une base dont une table est encore vivante est refusé par la base de données avec `ck_table_base_live`, traduit en `BASE_NOT_EMPTY`. Le plan enchaîne donc, par lots de dix tables (`MIGRATION_TOO_LARGE` au-delà), la suppression logique de chaque table, puis la suppression des schémas d'alias de la base — contrôle de dépendance, `DROP VIEW` par lots, `DROP SCHEMA` sans `CASCADE` —, puis une dernière étape à verrou court : `ALTER SCHEMA … RENAME TO "b_t4z56fq_zz_supprime_20260918_crm"`, forme et budget fixés par le chapitre 01 §9.5 — le marqueur vient **après** le préfixe positionnel, et le slug de base est retronqué de 53 à 32 octets à cette occasion. Cette dernière étape porte aussi la cascade logique restante du catalogue : applications, vues enregistrées, lignes `db_schema`.

Le renommage d'un schéma ne verrouille aucune table : il modifie une ligne de `pg_namespace`, les requêtes en cours ne sont pas bloquées, et seules des résolutions de noms concurrentes attendent brièvement.

Aucune référence inter-bases n'est possible — un champ lien ne traverse jamais une frontière de base (`LINK_CROSS_DATABASE`) — donc aucun refus au titre des relations. Les jetons et webhooks portés sur la base ne sont **pas** révoqués, pour que la restauration les retrouve ; l'API répond par une absence, conformément à la règle de non-divulgation du chapitre 05.

### 4.4 Ce qui est libéré, ce qui ne l'est jamais

| Ressource | Libérée à la suppression logique ? |
|---|---|
| Libellé | **Oui, immédiatement.** `label_key` redevient disponible dans le parent |
| Nom physique | **Non, jamais** — ni à la suppression, ni après la purge. Recréer une table « Clients » donne `clients_2` |
| Position, appartenance à une application | Oui, l'objet en est retiré |
| Espace disque, numéro d'attribut | Non (§8.1) |
| Données de la colonne ou de la table | Conservées, **et lisibles en SQL direct** (§4.7) |
| Permissions de champ, dépendances de formule, options de liste, abonnements de webhook | Conservées : c'est ce qui rend la restauration fidèle |

Les index uniques partiels du catalogue (`WHERE deleted_at IS NULL`) autorisent techniquement la réutilisation d'un `label_key` ; `uq_physical_name`, non partiel, l'interdit pour le nom physique. **Le plus strict gagne**, et c'est exactement ce qui rend la restauration toujours possible côté nom (§6).

### 4.5 Face aux clés étrangères et à la colonne d'affichage

**a) Supprimer logiquement une table encore référencée : refus.** Il est **déclaratif**, et ce chapitre n'y ajoute aucun déclencheur : `field_link_config.target_is_live` est un miroir de `table_def.is_live` propagé par `ON UPDATE CASCADE`, et `ck_link_target_live` refuse tant que la contrainte physique n'a pas été retirée. Le refus est donc insensible à la concurrence — le verrou de clé étrangère pris par la création du lien sérialise les deux transactions, là où un déclencheur `BEFORE UPDATE` sous `READ COMMITTED` les laisserait passer toutes les deux. Le service traduit en `TABLE_REFERENCED` (409) ; la charge utile et le message sont ceux du chapitre 03 §9.2, la liste nommée des champs fautifs vient de la requête des liens inverses du chapitre 02, et son filtrage par les droits du lecteur du chapitre 05. Aucune cascade n'est proposée, pas même à un administrateur ; l'écran offre un lien direct vers la suppression de chaque champ fautif.

**b) Supprimer logiquement le champ lien : la contrainte est retirée immédiatement (A17).** Une contrainte survivante refuserait des `DELETE` sur la table cible en nommant `fk_factures__clients_id`, contrainte d'un champ que l'utilisateur croit disparu et qu'aucun écran ne permet plus de toucher : un refus littéralement inexplicable et sans issue. On retire donc la contrainte et son index — ce dernier ne sert plus à rien et coûte à chaque écriture —, on relègue la colonne, on renseigne `field_link_config.fk_dropped_at`. Les valeurs sont conservées. Effet de bord à annoncer sur l'écran de confirmation lorsque la clé étrangère était en `ON DELETE CASCADE` : des suppressions qui emportaient des lignes filles cesseront de le faire.

**c) Supprimer logiquement le champ désigné colonne d'affichage : refus (A15).** `table_def.display_field_id` est nullable et l'absence de désignation est un état valide, mais `is_live` fait partie de la clé étrangère `fk_display_field` : passer le champ à `is_live = false` la viole. Le refus porte `DISPLAY_FIELD_IN_USE` (409) et invite à désigner un autre champ d'abord. **Aucune bascule automatique n'existe, sous aucune forme** — ni vers le champ suivant, ni vers `_id` : elle changerait sans prévenir ce que voient tous les consommateurs de tous les liens pointant vers cette table. Les types éligibles et les cas limites de la désignation appartiennent au chapitre 04 §5.

**d) Supprimer logiquement une table dont les lignes sont référencées physiquement sans champ lien correspondant.** S'il existe un champ lien actif, c'est le cas (a). S'il n'en existe pas mais qu'une contrainte physique subsiste, le moteur interroge `pg_constraint` avant d'émettre le `RENAME` — `confrelid` pour les références entrantes, `conrelid` pour les sortantes — et refuse avec `REGISTRY_DIVERGENT`.

**La raison n'est pas celle qu'on croit, et il faut l'écrire.** `ALTER TABLE … RENAME TO` **n'échoue jamais** à cause d'une clé étrangère, entrante ou sortante : les contraintes référencent des OID (§2.6). La relégation réussirait donc en silence, et c'est bien plus grave qu'un échec : une table « invisible partout » continuerait de refuser des `DELETE` sur ses lignes au nom d'une contrainte introuvable dans le catalogue. Le refus est émis par basedb, jamais par PostgreSQL. L'endroit où PostgreSQL refuse effectivement, lui, c'est la purge : `DROP TABLE` sans `CASCADE` échoue en `2BP01` sur une clé étrangère entrante non déclarée.

Si des colonnes `zz_supprime_` d'autres tables contiennent encore des identifiants de ses lignes, aucun obstacle : leurs contraintes ont déjà été retirées, les valeurs deviennent des références orphelines et sont conservées telles quelles.

### 4.6 Objets dépendants : la règle en trois cas

> **Refus** quand la dépendance est une contrainte d'intégrité ou de calcul. **Cascade logique** quand la dépendance est de composition. **Orphelinage contrôlé et signalé** quand la dépendance est de présentation.

| Objet supprimé | Dépendant | Règle |
|---|---|---|
| champ | formule qui l'utilise | **Refus** `FIELD_USED_BY_FORMULA`, nommant les formules. Contrôle de service à l'étape 1, `field_formula_dependency` ne portant de miroir que sur `is_purged` |
| champ | colonne d'affichage de sa table | **Refus** `DISPLAY_FIELD_IN_USE` (§4.5 c) |
| champ | permission de champ | Conservée |
| champ | filtre ou tri d'une vue enregistrée | **`view_def.is_invalid` à vrai**, bandeau dans l'interface, proposition de retirer le filtre. Jamais d'ignorance silencieuse : un filtre ignoré élargit le jeu de résultats, ce qui est pire qu'une erreur |
| champ ou table | vue SQL tierce inconnue du catalogue | **Refus** `DEPENDENT_OBJECT` (§3.4) |
| table | champ lien pointant vers elle | **Refus** `TABLE_REFERENCED` |
| table | ses propres champs | Cascade logique, sans renommage de colonne (§4.2) |
| table | abonnement webhook | Autorisé ; aucun événement ne peut plus naître, par construction. L'abonnement reste en base et redevient actif à la restauration |
| table | appartenance à une application, vues enregistrées | Retirée / cascade logique |
| table | vue SQL d'alias | Alias supprimé (§4.2) |
| base | tables, champs, applications, vues, alias | Cascade logique complète, de bas en haut (§4.3) |
| base | jetons et webhooks portés sur elle | Conservés, inopérants |

### 4.7 Remplacement des valeurs d'une colonne reléguée

Une colonne supprimée logiquement conserve ses valeurs, lisibles par tout consommateur SQL direct et visibles dans un `SELECT *`. **Supprimer un champ ne supprime pas ses données.** L'écran de suppression affiche cet avertissement et propose une case, décochée par défaut, intitulée **« remplacer les valeurs par NULL »** — et non « effacer les valeurs », qui promettrait une garantie que PostgreSQL ne donne pas.

**Ce que l'opération fait, et ce qu'elle ne fait pas.** Sous MVCC, l'`UPDATE` crée une nouvelle version de chaque ligne et laisse les anciennes intactes sur disque. Les valeurs cessent d'être lisibles par une requête ordinaire ; elles subsistent dans les anciennes versions jusqu'au passage de `VACUUM`, dans les pages non réutilisées ensuite, dans le journal des transactions, sur toute réplique et dans toute sauvegarde physique. Un effacement réel exige une réécriture complète de la table (`VACUUM FULL` ou `CLUSTER`, verrou `ACCESS EXCLUSIVE` pour une durée proportionnelle au volume) puis l'expiration des sauvegardes : ce sont des opérations d'exploitation, hors du périmètre de basedb, et l'écran le dit en une phrase.

**Ce n'est jamais une étape de la transaction de suppression.** Derrière la case se cache la réécriture intégrale de la table : sur dix millions de lignes, doublement de la taille sur disque jusqu'au passage de l'autovacuum, plusieurs gigaoctets de journal, un retard de réplication, et tout cela dans une transaction qui tiendrait déjà un `ACCESS EXCLUSIVE`. C'est le scénario d'incident type, déclenché par un utilisateur qui croyait cocher une option de confidentialité. Le remplacement est donc une **tâche différée**, comme l'export de purge (§5.2) :

```sql
CREATE TABLE _basedb.deferred_task (
  id           uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  kind         text NOT NULL CHECK (kind IN ('null_out','purge_export')),
  object_kind  text NOT NULL,
  object_id    uuid NOT NULL,
  status       text NOT NULL CHECK (status IN
                 ('pending','running','interrupted','failed','done','cancelled')),
  request_id   uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_at   timestamptz NULL,
  finished_at  timestamptz NULL,
  heartbeat_at timestamptz NULL,
  executor_id  text COLLATE "C" NULL,
  lease_token  bigint NOT NULL DEFAULT 0,
  progress     bigint NOT NULL DEFAULT 0,
  total_estimate bigint NULL,
  cursor_id    uuid NULL,                     -- dernier _id traité
  parameters   jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code   text COLLATE "C" NULL REFERENCES _basedb.error_code(code),
  error_detail jsonb NULL
);
CREATE UNIQUE INDEX uq_deferred_task_object
  ON _basedb.deferred_task (object_kind, object_id)
  WHERE status IN ('pending','running');
```

Règles d'exécution, alignées sur l'ordonnanceur du chapitre 10 :

1. Une seule tâche vivante par objet ; une seconde demande rend `TASK_IN_PROGRESS` (409).
2. L'exécutant prend un verrou consultatif de classe `maintenance` sur la tâche, incrémente `lease_token`, et **toute écriture de la tâche vérifie ce jeton** : un détenteur dont la connexion est tombée sans qu'il le sache ne peut plus écrire.
3. Battement de cœur toutes les 10 secondes. Une tâche dont `heartbeat_at` a plus de 60 secondes et dont le verrou consultatif est libre passe à `interrupted` par la surveillance périodique, et est proposée à la reprise.
4. Traitement par lots de 10 000 lignes ordonnées par `_id`, un `COMMIT` par lot, `cursor_id` mis à jour à chaque lot. Verrou `ROW EXCLUSIVE` seulement : ni les lecteurs ni les écrivains de la table ne sont bloqués.
5. Reprise idempotente depuis `cursor_id` ; annulation lue entre deux lots. **La colonne étant déjà reléguée, aucune écriture applicative ne la vise** : un lot interrompu n'a aucune conséquence fonctionnelle.
6. `ANALYZE` de la table à la fin, hors de tout verrou lourd : un `UPDATE` de masse fausse durablement les estimations de largeur de ligne et de sélectivité. `ANALYZE` prend un `SHARE UPDATE EXCLUSIVE`, ne bloque ni lecture ni écriture, et est autorisé dans un bloc de transaction — contrairement à `VACUUM`.
7. L'écran des objets supprimés affiche l'état, l'avancement et l'horodatage d'achèvement. Avant confirmation, il affiche le nombre estimé de lignes et exige une confirmation supplémentaire au-delà d'un seuil configurable.
8. **La restauration sans perte devient impossible** dès le premier lot : l'écran le dit, et la tâche est réservée au rôle d'administration.

---

## 5. Purge et épuration

La purge est la seule opération irréversible du produit. Tout ce qui suit existe pour que personne ne la déclenche par accident, et pour qu'elle reste reprenable quand elle est déclenchée à dessein.

### 5.1 Qui, et les trois garanties préalables

**Qui.** Rôle d'administration uniquement. Jamais l'API REST sans jeton d'administration, **jamais le serveur MCP** : le cadrage exclut les opérations destructrices du MCP, et la purge est exactement cela.

**Garantie 1 — délai minimal de 30 jours** depuis `deleted_at`, sinon `PURGE_TOO_EARLY` (409). Un administrateur d'instance peut le réduire, avec une entrée d'audit distincte portant la mention du contournement, son auteur et sa justification saisie.

**Garantie 2 — export préalable achevé et vérifié** (§5.2), sinon `EXPORT_UNAVAILABLE` (503). Au-delà d'un plafond de volume configurable, l'administrateur peut confirmer explicitement une purge sans export ; c'est une seconde saisie, jamais une case.

**Garantie 3 — confirmation** par saisie du libellé exact, avec la taille (`pg_total_relation_size()`) et le **nombre exact de lignes issu du manifeste d'export**, jamais un `count(*)` déclenché à l'ouverture de l'écran.

### 5.2 L'export

**L'export est produit par `COPY (SELECT …) TO STDOUT WITH (FORMAT csv, HEADER)`, streamé par la connexion applicative, et écrit dans un répertoire de l'hôte applicatif.** Aucune écriture de fichier côté serveur PostgreSQL n'est utilisée : `COPY … TO '<fichier>'` exige `pg_write_server_files` ou le superutilisateur, que le propriétaire de la base n'a pas. Écrire le contraire rendrait `EXPORT_UNAVAILABLE` permanent et la purge inexécutable. *Alternative rejetée* : piloter `pg_dump` depuis le serveur applicatif, qui exige un binaire client et des identifiants hors application, et qui ne saurait pas exporter une seule colonne reléguée.

**Contenu.** Un fichier CSV par table — pour la purge d'un champ, un fichier à deux colonnes, `_id` et la colonne reléguée — et un manifeste JSON portant : l'extrait de catalogue purgé (bases, tables, champs, y compris supprimés, avec leurs lignes de registre), le **nombre exact de lignes par table, compté pendant l'export**, l'empreinte SHA-256 de chaque fichier, et, pour chaque table, `pg_total_relation_size()` ainsi que les compteurs `n_tup_ins`, `n_tup_upd`, `n_tup_del` de `pg_stat_user_tables` lus au début de l'export.

**C'est une tâche différée** (`_basedb.deferred_task`, `kind = 'purge_export'`), pas une étape de la purge : plusieurs gigaoctets de CSV n'ont pas leur place dans une requête HTTP synchrone, et son échec ne doit pas laisser une purge à moitié faite.

**Décalage entre l'export et la destruction.** L'export prend un `ACCESS SHARE` et ne bloque rien ; la purge, plus tard, prend un `ACCESS EXCLUSIVE` bref. Entre les deux, un consommateur SQL direct peut avoir écrit — le schéma `b_*` lui est ouvert. Décision : la première étape de la purge **relit les compteurs de `pg_stat_user_tables` et les compare au manifeste** ; toute divergence, y compris un compteur inférieur à celui enregistré (ce qui signale une remise à zéro des statistiques), rend `EXPORT_STALE` (409) et exige un nouvel export. Ce contrôle détecte, il ne prouve pas : les statistiques sont collectées avec un léger retard, et un cycle écriture/annulation peut passer. On l'accepte, parce que l'objet est invisible de basedb depuis trente jours au moins, et parce que l'alternative — tenir l'export et la destruction dans une seule transaction — exigerait une transaction de plusieurs minutes détenant des verrous exclusifs.

**Les fichiers d'export ne sont jamais supprimés par basedb.** Ils sont listés par l'entretien hebdomadaire (§9.5) avec leur tâche d'origine et son état, pour que l'exploitant sache lesquels correspondent à une purge annulée.

### 5.3 Le plan de purge

**La purge ne supprime jamais une ligne de catalogue (A22).** Elle exécute le `DROP` physique et renseigne `purged_at` / `purged_by` ; la ligne devient une pierre tombale, `is_purged` passe à vrai, et les lignes de registre correspondantes passent `relegated → purged` ou `active → purged` pour les noms dérivés détruits avec leur parent. Les contraintes `ck_*_purge` du catalogue imposent qu'une purge suive une suppression logique.

**Ordre canonique**, de bas en haut, le même que celui de la suppression logique : (1) champs lien visant la table, (2) autres champs, (3) vues enregistrées, appartenances d'application, abonnements de webhook, permissions de champ, dépendances de formule, (4) la table, (5) la base, (6) les schémas d'alias. L'ordre n'est pas imposé par PostgreSQL — les contraintes des champs supprimés ont déjà été retirées, et une table purgée n'était référencée par aucun champ lien actif — mais par le catalogue : `field_link_config.target_table_id` et `field_formula_dependency` sont en `ON DELETE RESTRICT`, et les miroirs `is_purged` en dépendent.

**Découpage et reprise.** La purge d'une base est une suite de migrations d'au plus dix tables (`MIGRATION_TOO_LARGE` au-delà), chacune dans sa transaction, chacune renseignant `purged_at` sur les lignes de catalogue concernées et émettant les `DROP TABLE` correspondants. La reprise s'appuie sur `purged_at`, renseigné objet par objet : une purge interrompue reprend à la première table dont `purged_at` est nul. La base porte pendant toute l'opération `structure_state = 'frozen'`, ce qui interdit sa restauration et toute autre opération de structure sur elle. Sans ce découpage, un `DROP TABLE` par table dans une transaction unique gèlerait la base entière jusqu'au commit, et un seul verrou indisponible en fin de liste annulerait tout après avoir bloqué tout le reste.

**Côté physique.** `DROP TABLE` emporte contraintes, index et séquence liée. `DROP SCHEMA` est émis **sans `CASCADE`**, après suppression explicite de tout ce que basedb connaît et après le contrôle de dépendance du §3.4. Un schéma `b_*` est ouvert aux consommateurs SQL, qui peuvent y avoir créé leurs propres vues ou tables : un `CASCADE` les détruirait en silence.

**Si le `DROP SCHEMA` final échoue** — `2BP01`, objet tiers résiduel —, l'opération ne repart pas en arrière : les tables sont détruites, c'est irréversible. La base passe à l'état **`RESIDUAL_SCHEMA`** : `purged_at` est renseigné, le schéma reste listé dans l'écran d'entretien avec le message PostgreSQL restitué tel quel et la liste des objets qui l'occupent, et sa suppression est une opération manuelle de l'exploitant. C'est un état nommé et visible, pas un échec silencieux.

### 5.4 Ce qui reste, ce que la purge ne rend pas

**Les pierres tombales.** La ligne de catalogue survit à la purge : c'est elle qui porte la trace de ce qui a existé, qui donne un référent à `audit_log.object_id`, qui rend observables les index partiels `WHERE purged_at IS NULL` et qui permet à la réconciliation d'exclure ce qui a été légitimement détruit. Une **épuration de second niveau**, distincte et postérieure, détruit ces lignes passé la rétention `catalog_tombstone` (12 mois par défaut, A24), dans l'ordre champs, tables, bases, en s'appuyant sur les clauses `ON DELETE` du chapitre 02 ; un refus d'épuration n'est jamais visible d'un utilisateur, la tâche saute la ligne et le journalise.

**Les lignes de registre ne sont jamais détruites**, même en état `purged`, même par l'épuration de second niveau : c'est ce qui garantit qu'un nom purgé n'est jamais réattribué. Les entrées `audit_log` ne sont pas purgées avec l'objet, `object_name` les gardant lisibles. Le devenir des révisions d'enregistrements relève du chapitre 07.

**Ce que la purge ne rend pas.** `ALTER TABLE … DROP COLUMN` ne réécrit pas la table : l'attribut est marqué supprimé et les valeurs existantes restent sur disque jusqu'à réécriture de chaque ligne. L'écran annonce un espace « marqué récupérable », jamais un espace libéré, et basedb ne lance **jamais** de `VACUUM FULL` automatiquement : il prendrait un `ACCESS EXCLUSIVE` pour une durée proportionnelle au volume et doublerait temporairement l'occupation disque.

---

## 6. Restauration

Possible depuis l'écran des objets supprimés, par le même rôle que la suppression. L'ordre de pose des objets physiques — contrainte en `NOT VALID` puis `VALIDATE`, index en `CONCURRENTLY` — est celui du chapitre 03, et les états intermédiaires sont ceux de `_basedb.physical_state`.

| # | Étape | Nature | Contenu |
|---|---|---|---|
| 1 | Contrôles | `READ ONLY`, 30 s | Parent vivant ; libellé disponible ; cible de lien non purgée ; **anti-jointures de revalidation des données** ; disponibilité du nom d'origine dans `pg_class` / `pg_attribute` |
| 2 | Remise en service | Verrou court, 5 s | `deleted_at`, `deleted_by` à `NULL`, `is_live` à vrai, `name_id` remis à la ligne de registre d'origine (`retired → active`), `RENAME` inverse, `ADD CONSTRAINT … NOT VALID` (`state = 'not_valid'`), régénération des vues d'alias concernées |
| 3 | Index | **Hors transaction** | `CREATE INDEX CONCURRENTLY` des index retirés (`state = 'building'`) |
| 4 | Validation | Propre transaction | `VALIDATE CONSTRAINT`, `SET NOT NULL` si le champ était obligatoire, `state = 'active'`, `required_state = 'active'` |

**Le nom d'origine est toujours récupérable**, et c'est la meilleure justification de la règle « aucun nom n'est jamais libéré » : puisque personne d'autre n'a pu le prendre, l'objet reprend exactement le sien. Le contrôle dans `pg_class` et `pg_attribute` reste nécessaire malgré tout — le registre n'est autorité que sur ce qu'il connaît, et un consommateur a pu créer une table `clients` dans le schéma pendant l'absence. Le refus porte alors `NAME_TAKEN_OUTSIDE_REGISTRY`, nomme l'objet, son type et son propriétaire, et propose la seule issue possible : faire retirer l'objet tiers, ou restaurer sous un autre nom — ce qui n'est plus une restauration et est présenté comme tel.

**L'échantillon de lignes fautives est collecté avant toute tentative**, par anti-jointure, comme l'impose le chapitre 03 : après un échec de pose de contrainte, il n'y a plus de transaction utilisable pour le collecter. Jusqu'à 50 entrées sont restituées dans `migration.error_sample`, limitées à la colonne responsable du refus et filtrées par les permissions de champ du lecteur.

Ce qui peut empêcher une restauration :

| Cause | Code | Issue proposée |
|---|---|---|
| Le libellé a été repris (il est libéré, lui) | `LABEL_DUPLICATE` | L'écran demande un nouveau libellé. Pas de suffixe automatique |
| Le parent est supprimé logiquement | `PARENT_DELETED` | Restaurer la base ou la table d'abord |
| Champ lien dont la table cible a été purgée | `TARGET_PURGED` | **Aucune.** L'invariant du catalogue interdit un lien sans cible ; recréer un champ ordinaire n'est pas une restauration et n'est pas proposé sous ce nom |
| Valeurs de lien devenues invalides pendant l'absence de la contrainte | `LINK_ORPHAN_VALUES` | Lignes fautives restituées, et action explicite « mettre ces valeurs à NULL » si le champ est nullable |
| Le champ était obligatoire et des lignes ont été insérées sans lui | `INCOMPATIBLE_VALUES`, `details.constraint = 'required'` | Même mécanisme, avec saisie d'une valeur de remplissage |
| Le champ était unique et des doublons sont apparus | `INCOMPATIBLE_VALUES`, `details.constraint = 'unique'` | Restitution des groupes en doublon |
| Le nom d'origine est occupé par un objet tiers | `NAME_TAKEN_OUTSIDE_REGISTRY` | Retirer l'objet tiers |
| Une tâche de remplacement par NULL a été exécutée | — | La restauration est possible, mais les valeurs sont perdues ; l'écran l'annonce et exige une confirmation |
| L'objet a été purgé | — | Impossible : la pierre tombale décrit ce qui a existé, elle ne le reconstitue pas |

**Coût, annoncé avant confirmation.** La recréation d'un index est concurrente et ne bloque pas les écritures, mais elle dure : à dix millions de lignes, plusieurs minutes. Une interruption laisse un index `indisvalid = false`, jamais utilisé en lecture mais maintenu à chaque écriture ; la séquence de reprise — détection dans `pg_index`, `DROP INDEX CONCURRENTLY`, réémission — est celle du chapitre 03, et la classe `CAT-STATE` la détecte. `ADD CONSTRAINT … NOT VALID` puis `VALIDATE CONSTRAINT` ne prend qu'un `SHARE UPDATE EXCLUSIVE` pendant la validation : le DML continue. L'écran affiche la taille de la table et exige une confirmation supplémentaire au-delà d'un seuil configurable.

---

## 7. Dérives propres au cycle de vie

Ce chapitre est le premier producteur d'écart possible entre le catalogue et la base physique : noms renommés, colonnes reléguées, contraintes retirées avec `fk_dropped_at`, vues et schémas d'alias, étapes hors transaction interruptibles. Il doit donc dire comment on répond à la question « le catalogue et la base sont-ils d'accord ? ».

Le régime d'exécution, le catalogue des classes et les requêtes de référence appartiennent au chapitre 02 ; ce chapitre n'ajoute que **deux classes**, dans son propre espace de noms `CYCLE-`, sur les seuls objets dont il est l'auteur.

| Classe | Question posée | Comparaison |
|---|---|---|
| `CYCLE-ALIAS` | Les alias déclarés existent-ils, et n'existe-t-il qu'eux ? | `db_schema` (`role = 'alias'`) et `sql_view_alias` dont `dropped_at IS NULL`, contre `pg_namespace` et `pg_class` (`relkind = 'v'`) ; et réciproquement, toute vue d'un schéma `b_*` sans ligne d'alias vivante |
| `CYCLE-RELEG` | Chaque objet supprimé logiquement porte-t-il exactement son nom de relégation, et réciproquement ? | Objets du catalogue avec `deleted_at IS NOT NULL` contre `pg_class` / `pg_attribute` (en incluant `attisdropped`) ; et toute relation, colonne, contrainte ou index nommé `zz_supprime_%` sans ligne de catalogue supprimée correspondante |

**Ce chapitre n'ajoute aucune classe sur les liens.** `CAT-FK1`, `CAT-FK2` et `CAT-FK3` couvrent déjà la correspondance entre `field_link_config` et `pg_constraint` dans les deux sens et sur les propriétés, y compris la correspondance imposée par A13 : `restrict → confdeltype = 'a'`, `set_null → 'n'`, `cascade → 'c'`, un `'r'` étant lui-même une dérive puisque le moteur n'émet jamais `RESTRICT`. De même, `CAT-STATE` couvre les index `indisvalid = false` et les états physiques non terminaux laissés par une étape interrompue, et `CAT-NAME` couvre les noms de registre sans objet physique.

**Ce qui n'est pas une dérive, et ne doit pas le devenir.** Le nombre d'attributs consommés d'une table est un **état physique observé**, pas un invariant du catalogue : il diffère légitimement entre une instance et sa restauration logique (§8.1). Les droits posés à la main, les commentaires écrits par un consommateur et les objets tiers d'un schéma `b_*` ne sont pas davantage des dérives : ils sont signalés à titre informatif, jamais comme un écart bloquant.

**Quand ces contrôles s'exécutent.** Aux mêmes moments que ceux du chapitre 02 : après chaque migration, à la demande depuis l'administration, une fois par nuit sous le verrou `maintenance`, en post-test après chaque test d'intégration avec exigence de zéro ligne, et **obligatoirement après toute restauration de sauvegarde, avant réouverture du service**. Ils ne sont **pas** exécutés intégralement au démarrage de chaque processus : à 50 bases et 500 tables, ce serait plusieurs secondes de `pg_catalog` multipliées par le nombre de répliques, au moment précis où l'on cherche à redémarrer vite.

**Réparation.** Aucune n'est automatique. Un écart bloquant passe `base.structure_state` à `frozen` et lève `REGISTRY_DIVERGENT` : les lectures et écritures de données **restent servies**, seules les opérations de structure de cette base sont suspendues. Les trois issues — rejouer, adopter, mettre en orphelin — sont celles du chapitre 10, proposées par l'écran d'administration au rôle admin et consignées dans l'audit.

**Adoption d'un DDL appliqué à la main.** C'est le cas de trois heures du matin : un exploitant a renommé une colonne en `psql` pour débloquer la production. Procédure, entièrement manuelle et journalisée :

1. Lancer la réconciliation sur la base concernée ; ses opérations de structure sont gelées.
2. L'écran liste les écarts typés, un par ligne, avec le SQL qui les a produits lorsque `migration.up_sql` en garde la trace.
3. Pour chaque écart, l'administrateur choisit **adopter** — le catalogue est aligné sur ce qui existe : ligne de registre ajoutée dans l'état correspondant, `name_id` de l'objet basculé, ancienne ligne passée à `retired` — ou **rejouer** le DDL manquant, ou **mettre en orphelin** l'objet inattendu, renommé `zz_orphelin_<date>_<nom>`.
4. Une ligne `_basedb.migration` d'origine `system` consigne l'ensemble, avec l'auteur, l'identifiant de corrélation et une justification saisie obligatoire.
5. Un écart n'est **pas adoptable** si le physique ne se projette sur aucun type de champ v1, ou si le nom adopté violerait les alphabets ou le budget d'octets : la seule issue est alors la mise en orphelin, ou un renommage manuel préalable vers un nom conforme.
6. La base ne sort de `frozen` que lorsque la réconciliation repasse à zéro écart bloquant.

---

## 8. Coût cumulé, quotas et rétention

### 8.1 Le budget d'attributs est la seule limite dure

**Ce n'est pas la lisibilité qui borne l'accumulation de colonnes reléguées, c'est le nombre d'attributs.** PostgreSQL plafonne une table à 1 600 colonnes, et ce compteur inclut les colonnes supprimées : `DROP COLUMN` ne libère pas le numéro d'attribut, qui n'est jamais réutilisé. Les seuils d'alerte, le plafond dur et le code de refus sont ceux du chapitre 04 §1.13 ; ce chapitre n'en redéfinit aucun et en tire deux conséquences qui lui sont propres.

**Le budget est consommé jusqu'à la prochaine réécriture complète de la table, pas définitivement.** Deux remèdes existent, de coûts très différents : une migration de copie — table neuve, transfert, bascule — qui rend tous les attributs d'une table au prix d'une fenêtre d'indisponibilité en écriture et du double de l'espace pendant le transfert ; ou un cycle `pg_dump` / restauration logique, qui les rend sur toute l'instance au prix d'une fenêtre de restauration complète.

**`pg_dump` n'émet pas les colonnes réellement supprimées** : une instance restaurée logiquement a des numéros d'attributs recompactés. **Une instance restaurée n'est donc pas identique à l'originale sur ce point.** Le nombre d'attributs consommés est un état physique observé, jamais un invariant du catalogue, et il ne fait partie d'aucune dérive (§7).

**Aucun plafond bloquant propre aux colonnes reléguées n'existe, et c'est une décision.** Un garde-fou interdisant la création d'un champ au-delà de N colonnes reléguées se combinerait avec le délai minimal de purge de trente jours en un blocage total et auto-infligé : une campagne de nettoyage supprimant vingt-six champs interdirait toute création sur la table, et la seule levée possible — la purge — serait elle-même refusée pendant un mois. Le seuil d'avertissement du chapitre 04 est remonté dans la ligne de compteurs et proposé à l'entretien hebdomadaire ; il ne refuse rien.

### 8.2 Politique de rétention

Les durées applicables aux traces et aux journaux sont celles de A24, portées par `_basedb.retention_policy`. Ce chapitre ne fixe que les délais propres au cycle de vie :

| Objet | Délai minimal avant purge | Proposé à l'entretien | Purge automatique |
|---|---|---|---|
| Champ | 30 jours | au-delà de 90 jours | non |
| Table | 30 jours | au-delà de 90 jours | non |
| Base | 30 jours | au-delà de 180 jours | non |
| Alias de compatibilité | `drop_after`, 180 jours par défaut | à échéance, après coupure à blanc | non |
| Coupure à blanc | 35 jours par défaut | rappel à mi-parcours et à J-3 | non |
| Pierre tombale de catalogue | — | — | **oui**, épuration de second niveau à 12 mois (§5.4) |

Aucune purge d'objet n'est automatique : le cadrage impose une opération manuelle et séparée. Seule l'épuration des pierres tombales, qui ne détruit plus rien de physique, s'exécute d'office.

### 8.3 Ordres de grandeur

Valeurs indicatives sur matériel ordinaire, destinées à dimensionner les écrans de confirmation et à décider d'une fenêtre de maintenance. Ce ne sont pas des engagements.

| Volume | Renommage | Relégation d'un champ (étape 2) | `DROP INDEX CONCURRENTLY` | `CREATE INDEX CONCURRENTLY` | Remplacement par NULL | Export CSV | `DROP TABLE` |
|---|---|---|---|---|---|---|---|
| 10⁵ lignes | < 10 ms | < 10 ms | < 1 s | ~ 1 s | ~ 5 s | ~ 2 s | < 10 ms |
| 10⁶ lignes | < 10 ms | < 10 ms | < 1 s | ~ 10 s | ~ 1 min | ~ 20 s | < 100 ms |
| 10⁷ lignes | < 10 ms | < 10 ms | ~ 1 s | 2 à 5 min | 10 à 30 min | 3 à 10 min | ~ 1 s |

Le point important : **aucune opération de renommage ou de suppression logique ne dépend du volume.** Toutes sont du DDL de catalogue. Ce qui dépend du volume, c'est la reconstruction d'index à la restauration, le remplacement des valeurs et l'export — et ces trois-là sont soit concurrents, soit des tâches différées. Une fenêtre de maintenance n'est recommandée que pour la restauration d'un champ indexé au-delà de 10⁷ lignes, et pour une migration de copie.

### 8.4 Coût de verrouillage par opération

| Opération | Ordre SQL | Verrou pris | Sur quoi | Durée |
|---|---|---|---|---|
| Renommage de libellé | `UPDATE` catalogue | `ROW EXCLUSIVE` | `_basedb` | µs |
| Renommage de table, de colonne | `ALTER TABLE … RENAME` | `ACCESS EXCLUSIVE` | la table | instantané |
| Renommage de schéma | `ALTER SCHEMA … RENAME TO` | ligne de `pg_namespace` | le schéma | instantané, n'interrompt pas les requêtes en cours |
| Création d'une vue d'alias | `CREATE VIEW` | `ACCESS SHARE` | la table source | instantané |
| Retrait d'une clé étrangère | `ALTER TABLE … DROP CONSTRAINT` | `ACCESS EXCLUSIVE` | **la table source *et* la table cible** | instantané |
| Retrait d'un `CHECK` ou d'une unicité, `DROP NOT NULL`, `DROP DEFAULT` | `ALTER TABLE …` | `ACCESS EXCLUSIVE` | la table | instantané |
| Suppression ou création d'index | `… INDEX CONCURRENTLY` | `SHARE UPDATE EXCLUSIVE` | la table | création : proportionnelle au volume |
| Pose de contrainte | `ADD CONSTRAINT … NOT VALID` | `ACCESS EXCLUSIVE` | source et cible | instantané, pas de parcours |
| Validation de contrainte | `VALIDATE CONSTRAINT` | `SHARE UPDATE EXCLUSIVE` | source et cible | proportionnelle au volume |
| Suppression d'une vue d'alias | `DROP VIEW` | `ACCESS EXCLUSIVE` | la vue | instantané |
| Purge | `DROP TABLE`, `DROP SCHEMA` | `ACCESS EXCLUSIVE` | l'objet | instantané ; libération des fichiers au commit |
| Remplacement par NULL | `UPDATE` par lots | `ROW EXCLUSIVE` | la table | proportionnelle, hors transaction de cycle de vie |
| Mise à jour des statistiques | `ANALYZE` | `SHARE UPDATE EXCLUSIVE` | la table | quelques secondes |

Toute étape prenant un `ACCESS EXCLUSIVE` pose `SET LOCAL lock_timeout = '5s'` et prend l'ensemble de ses verrous en tête de transaction, par OID croissant (§2.4). Aucune exception.

---

## 9. Exploitation

### 9.1 Ce qu'on compte, et comment un échec laisse une trace

Le chapitre 10 exclut toute métrique au-delà du journal structuré et d'une **ligne de compteurs émise toutes les 60 secondes**, passant en avertissement dès qu'un seuil est franchi. Ce chapitre y ajoute huit compteurs, chacun annonçant une panne ou une impasse avant qu'elle n'arrive :

| Compteur | Seuil d'alerte |
|---|---|
| Écarts `CYCLE-ALIAS` et `CYCLE-RELEG` à la dernière réconciliation | ≠ 0 |
| Âge de la dernière réconciliation complète | > 36 h |
| Alias vivants dont l'âge dépasse `drop_after` | > 0 |
| Alias en coupure à blanc dont la fenêtre est échue | > 0 |
| Maximum de colonnes reléguées sur une table, et la table concernée | seuil d'avertissement du chapitre 04 §1.13 |
| Maximum d'attributs consommés sur une table, et la table concernée | seuils du chapitre 04 §1.13 |
| Âge du plus ancien objet supprimé non purgé, par nature | > 180 jours |
| Tâches différées en état `interrupted`, et fichiers d'export sans tâche vivante | > 0 |

Deux compteurs viennent en plus du socle : le nombre de rejeux sur `42P01` / `42703`, dont une hausse signale une dérive de fraîcheur du cache plutôt qu'une panne ; et le nombre d'échecs `LOCK_UNAVAILABLE` par heure.

**Un échec doit laisser une trace, alors qu'il annule sa propre transaction.** Deux mécanismes complémentaires :

- **Les échecs d'étape** sont couverts par la règle du chapitre 03 : `_basedb.migration` est écrit sur une autre connexion, dans ses propres transactions, avant et après chaque étape. Le statut terminal, `pg_sqlstate`, `failed_statement` et `error_sample` survivent au `ROLLBACK`.
- **Les refus détectés à l'étape de contrôle** — `TABLE_REFERENCED`, `DISPLAY_FIELD_IN_USE`, `DEPENDENT_OBJECT`, `NAME_RETIRED`, `NAME_TAKEN_OUTSIDE_REGISTRY`, `PURGE_TOO_EARLY`, `EXPORT_STALE` — n'ouvrent jamais de transaction DDL. Ils écrivent une entrée `audit_log` avec le code, l'objet visé, la charge utile affichée à l'écran et `request_id`, qui relie l'écran, la ligne de migration et le journal applicatif.

**Pour `LOCK_UNAVAILABLE`, savoir qui bloque.** Après l'expiration de `lock_timeout`, la transaction est morte et ne peut plus rien interroger. La connexion de contrôle échantillonne donc, pendant l'exécution de l'étape, `pg_blocking_pids(<pid du backend DDL>)` joint à `pg_stat_activity`, et conserve le dernier échantillon non vide : `pid`, `usename`, `application_name`, début de la requête et âge. C'est ce qui est joint à l'entrée d'échec, sans quoi l'administrateur ne peut pas savoir qui l'empêche de renommer sa table. La même information est affichée en avertissement sur l'écran de confirmation quand une requête active de plus de 60 secondes porte déjà sur l'objet visé.

### 9.2 Ce que l'astreinte regarde en premier

1. **La base est-elle gelée ?** Un `structure_state = 'frozen'` explique tous les refus d'opération de structure d'un coup.
2. **La réconciliation** : nombre d'écarts et âge de la dernière exécution.
3. **Les tâches différées `interrupted`** : elles bloquent une purge ou laissent un remplacement de valeurs à moitié fait.
4. **Les migrations `applying` les plus anciennes** : au-delà de quinze minutes, une opération de cycle de vie est restée en plan, bail compris.
5. **Les rejeux et l'âge du cache** : une hausse conjointe signale un problème de propagation, pas un problème de données.
6. **Les compteurs de saturation** : attributs et colonnes reléguées, qui annoncent un refus futur.

### 9.3 Écritures opportunistes et base en lecture seule

Une base peut devenir non inscriptible sans que basedb l'ait décidé : bascule sur un secondaire, disque plein, `default_transaction_read_only`. Règle : **on dégrade en silence ce que personne n'a demandé, on refuse en le nommant ce que quelqu'un a demandé, et on compte les deux.**

| Écriture | En base non inscriptible |
|---|---|
| Compteurs d'usage bridés (`api_token.last_used_at`, `db_schema.app_access_count`) | abandon, compteur `dropped_writes{kind}` |
| `audit_log` d'une lecture de schéma | abandon, compteur |
| Battement de cœur d'une tâche différée | la tâche passe `interrupted` et se retire |
| Toute opération de cycle de vie | **refus immédiat `BASE_READ_ONLY`** (503), avec `Retry-After` |
| `audit_log` d'un refus | tentée ; si elle échoue, écrite dans le journal applicatif avec le même identifiant de corrélation |

La détection s'appuie sur `pg_is_in_recovery()` au démarrage et sur les SQLSTATE `25006` et `53100` en cours de service ; un compteur `dropped_writes` non nul est une alerte, pas une information.

### 9.4 Tâches ajoutées à l'ordonnanceur

Toutes s'exécutent sous les règles de l'ordonnanceur du chapitre 10 : verrou consultatif de classe `maintenance`, ligne de bail avec détenteur, échéance et jeton de cloisonnement, idempotence obligatoire.

| Tâche | Période | Instance unique | Pourquoi |
|---|---|---|---|
| Dérives `CYCLE-ALIAS` et `CYCLE-RELEG` | quotidienne | **oui** | Coûteuse en lectures de `pg_catalog` |
| Surveillance des tâches différées (battements, passage en `interrupted`) | 60 s | **oui** | Un bail expiré doit être constaté une seule fois |
| Rapport d'entretien : alias échus, coupures à blanc échues, objets purgeables, colonnes reléguées, restes d'opérations | hebdomadaire | **oui** | Une notification par réplique serait une notification ignorée |
| Épuration de second niveau des pierres tombales | quotidienne | **oui** | `DELETE` sur le catalogue : jamais concurrent à lui-même |

Le registre des baux porte l'identité de l'instance détentrice de chaque tâche : quand une tâche ne tourne plus, on sait à qui parler.

### 9.5 Restes d'une opération avortée

Ces objets n'ont ni propriétaire ni échéance ; s'ils ne sont pas listés, ils s'accumulent. L'entretien hebdomadaire les rassemble et propose une action, jamais ne l'exécute :

| Reste | Détection | Action proposée |
|---|---|---|
| Fichiers d'export d'une purge annulée ou échouée | `deferred_task` en `cancelled` / `failed` / absente, fichiers de plus de 7 jours | Suppression manuelle, après vérification |
| Tâche de remplacement par NULL interrompue | `status = 'interrupted'` | Reprise depuis `cursor_id`, ou annulation |
| Schéma d'alias sans ligne `db_schema` vivante | `CYCLE-ALIAS` | Mise en orphelin, ou adoption |
| Colonne ou table `zz_supprime_%` sans ligne de catalogue | `CYCLE-RELEG` | Adoption, ou mise en orphelin |
| Vue `zz_alias_%` dont la fenêtre de coupure est échue | échéance de coupure dépassée | Rétablissement, ou suppression définitive |
| Index `indisvalid = false`, état physique non terminal depuis plus de 24 h | `CAT-STATE` | Séquence de reprise du chapitre 03 |
| Base en état `RESIDUAL_SCHEMA` | état de catalogue | Suppression manuelle du schéma |

### 9.6 Objets PostgreSQL périphériques

Le schéma `b_*` appartient au rôle propriétaire, que l'exploitant utilise aussi. Position, en une règle : **basedb ne réémet jamais de `GRANT` et ne restaure aucun droit posé hors de lui.**

| Objet | Renommage | Suppression logique | Purge | Restauration |
|---|---|---|---|---|
| Privilèges `GRANT` posés à la main | conservés (portés par l'OID) | conservés | détruits | **non rétablis** |
| Commentaire posé par un consommateur | conservé | conservé | détruit | non rétabli. Sur les objets que basedb décrit, un `COMMENT ON` régénéré l'écrase — c'est ce que vérifie `CAT-CMT` |
| Séquence explicite liée | **non renommée** | conservée | détruite avec la table | conservée |
| Appartenance à une publication de réplication logique | conservée | conservée | perdue | **non rétablie** ; une publication `FOR ALL TABLES` reprend la table d'elle-même |
| Politique de sécurité au niveau ligne posée à la main | conservée | conservée | détruite | non rétablie ; elle s'applique aussi aux lectures passant par une vue d'alias en `security_invoker` |

### 9.7 Sauvegarde : ce que ce chapitre ajoute

La règle générale appartient au chapitre 10 et ne souffre aucune exception : **le catalogue et les données sont sauvegardés et restaurés ensemble, jamais séparément**, par `pg_dump -Fc` de la base entière ou par une sauvegarde physique. Ce chapitre en donne la raison la plus concrète et ajoute deux points.

**Pourquoi un cliché par schéma est irrestaurable, ici plus qu'ailleurs.** `pg_dump -n b_t4z56fq_crm` produit un fichier qui contient les vues du schéma d'alias — lesquelles référencent **un autre schéma**, celui du nom courant — et qui ne contient ni le registre des noms, ni `sql_view_alias`, ni `fk_dropped_at`, c'est-à-dire rien de ce qui donne un sens à un nom `zz_supprime_…`. Un cliché de `_basedb` et un cliché des schémas `b_*` pris à deux instants différents produisent une dérive systématique sur tout objet renommé ou supprimé entre les deux ; aucun contrôle ne pourrait la distinguer d'une corruption.

**Deux ajouts.** D'abord, **la réconciliation complète, classes `CYCLE-` comprises, est obligatoire après toute restauration, avant réouverture du service** — c'est le seul moment où l'on sait qu'un état intermédiaire d'étape hors transaction a pu être figé dans le cliché. Ensuite, toute tâche différée trouvée en `running` après restauration est passée à `interrupted` : son détenteur n'existe plus, et son verrou consultatif non plus.

**Restaurer un seul objet d'hier** — le besoin le plus fréquent — ne se fait jamais par copie de fichiers ni de tables entre schémas : on restaure le cliché dans une base de travail, puis on réimporte par l'API, ou l'on relit l'export CSV produit avant la purge. Toute autre méthode recrée un objet physique que le catalogue ne décrit pas, c'est-à-dire une dérive.

### 9.8 Ce que les tests doivent prouver

Le chapitre 10 impose déjà l'horloge et l'aléa injectés — ce qui rend `zz_supprime_20260918_remise` reproductible — et l'instantané caractère par caractère du SQL émis par chaque opération de schéma. Ce chapitre y ajoute quatre exigences :

1. **Les vidages de compteurs bridés sont déclenchables explicitement.** Aucun test n'attend cinq minutes.
2. **Deux tests d'intégration à deux connexions concurrentes** : créer un champ lien vers T pendant qu'on supprime T logiquement, dans les deux ordres d'entrelacement, et exiger qu'exactement une des deux opérations réussisse et que l'autre rende `TABLE_REFERENCED` ou `CONCURRENT_CONFLICT` — jamais les deux réussites, jamais un `40P01` remonté brut. C'est le test qui prouve que `ck_link_target_live` et le verrou de clé étrangère suffisent, sans déclencheur.
3. **Un test de restauration** : supprimer logiquement une table non référencée, tenter d'ajouter un champ lien vers elle pendant qu'elle est supprimée — ce qui est refusé par `fk_link_target` —, puis la restaurer, et exiger que la restauration passe.
4. **Un test d'objet tiers** : créer une vue de consommateur au-dessus d'une vue d'alias, puis supprimer logiquement un champ projeté, et exiger `DEPENDENT_OBJECT` avec le nom du dépendant, jamais un message PostgreSQL brut. Le même test avec un objet occupant le nom visé doit rendre `NAME_TAKEN_OUTSIDE_REGISTRY`.

Les instantanés de SQL couvrent les cinq plans de ce chapitre : renommage de table, renommage de base, relégation de champ, relégation de table, purge.

---

## 10. Codes d'erreur définis par ce chapitre

Ces codes sont en anglais, à raison d'un par condition (A2, A23), et versés au registre unique `_basedb.error_code`. Les codes définis ailleurs et réutilisés ici tels quels ne sont pas redéfinis : `TABLE_REFERENCED`, `DISPLAY_FIELD_IN_USE`, `BASE_NOT_EMPTY` (chapitre 02) ; `LABEL_DUPLICATE`, `NAME_TAKEN_OUTSIDE_REGISTRY`, `NAME_COLLISION_UNRESOLVED`, `NAME_TOO_LONG`, `LOCK_UNAVAILABLE`, `REGISTRY_DIVERGENT`, `LINK_CROSS_DATABASE` (chapitre 01) ; `LINK_ORPHAN_VALUES`, `MIGRATION_TOO_LARGE` (chapitre 03) ; `RESOURCE_NOT_FOUND` (chapitre 05).

| Code | Déclencheur | Niveau | HTTP |
|---|---|---|---|
| `ADMIN_REQUIRED` | Action réservée à l'administration, l'acteur voyant la ressource ; cycle de vie compris (A23) | Autorisation | 403 |
| `NAME_RETIRED` | Nom visé par un renommage d'administration déjà enregistré au registre, quel que soit son état | Conflit | 409 |
| `CONCURRENT_CONFLICT` | Entrelacement concurrent de deux opérations de structure sur le même objet | Conflit | 409 |
| `TOO_MANY_ALIASES` | Plus de 5 alias vivants sur un même objet | Conflit | 409 |
| `DEPENDENT_OBJECT` | Objet inconnu du catalogue dépendant d'une vue, d'une table ou d'un schéma à supprimer | Conflit | 409 |
| `FIELD_USED_BY_FORMULA` | Suppression logique d'un champ dont dépend une formule vivante | Conflit | 409 |
| `TASK_IN_PROGRESS` | Seconde tâche différée demandée sur le même objet | Conflit | 409 |
| `PURGE_TOO_EARLY` | Purge demandée avant le délai minimal | Conflit | 409 |
| `EXPORT_STALE` | Écriture détectée sur l'objet depuis l'export préalable | Conflit | 409 |
| `PARENT_DELETED` | Restauration d'un objet dont le parent est supprimé | Conflit | 409 |
| `TARGET_PURGED` | Restauration d'un champ lien dont la table cible est purgée | Conflit | 409 |
| `INCOMPATIBLE_VALUES` | Revalidation en échec à la restauration ; `details.constraint` vaut `required` ou `unique`, avec l'échantillon de lignes | Validation | 422 |
| `EXPORT_UNAVAILABLE` | Répertoire d'export absent, non inscriptible, ou export en échec | Indisponibilité | 503 |
| `BASE_READ_ONLY` | Opération de cycle de vie demandée sur une base non inscriptible | Indisponibilité | 503 |
| `RESIDUAL_SCHEMA` | État d'une base purgée dont le `DROP SCHEMA` final a échoué ; affiché, pas renvoyé en réponse à une écriture | Exploitation | — |

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Toute opération de cycle de vie est un plan d'étapes, jamais une transaction unique (A11) | Verrous tenus quelques millisecondes, reprise après incident, `CONCURRENTLY` possible | Une transaction par opération, avec ses `ACCESS EXCLUSIVE` tenus jusqu'au commit |
| Ordre canonique : `lock_timeout`, verrous consultatifs par classe croissante, `LOCK TABLE` par OID croissant, écritures catalogue, DDL | Un seul gel d'au plus une fenêtre de `lock_timeout` ; jamais de verrou de plan de contrôle tenu pendant une attente sur les données | Verrouiller le catalogue d'abord, puis demander l'`ACCESS EXCLUSIVE` |
| Clés de verrou lues dans `_basedb.lock_class` et `lock_key` (A8) | Une clé attribuée ne collisionne pas entre bases sans rapport | `pg_advisory_xact_lock(<constante>, hashtext(…))` |
| Alias = vues SQL automatiquement modifiables, aux deux granularités base et table | Un workflow qui insère par l'ancien nom est le consommateur à ne pas casser | Alias en lecture seule ; ou alias réservé au renommage de base |
| Alias explicites `AS` sur chaque colonne ; la vue est son propre inventaire de colonnes projetées | Les noms de sortie sont figés à la création ; la régénération lit `pg_attribute` au lieu d'une liste recopiée au catalogue | `SELECT *` ; ou une colonne de catalogue dupliquant la liste |
| Aucun alias pour un champ | Aucune construction n'occupe le nom d'une colonne sans dupliquer les données et geler la table | Colonne générée portant l'ancien nom |
| Aucun `CASCADE`, jamais, et contrôle de `pg_depend` avant chaque `DROP` | Un schéma `b_*` est ouvert aux consommateurs ; détruire leurs objets en silence est pire que refuser | `DROP … CASCADE`, ou laisser remonter `2BP01` |
| Coupure à blanc à 35 jours par défaut, seule mesure fiable de l'usage d'un alias | 48 h ne couvrent aucun cycle mensuel ; aucun compteur ne voit un consommateur SQL direct | Retrait d'alias sur compteur à zéro |
| Aucune observation des sessions SQL directes, aucune table d'agrégat d'accès | `pg_stat_statements` et le journal des requêtes exigent un privilège d'instance ; l'écran le dit au lieu de laisser croire l'inverse | Échantillonnage de `pg_stat_activity` dans une table partitionnée du catalogue |
| La date de relégation vient de l'horodatage du contexte, comme `deleted_at` | Une dérive d'horloge produirait un nom et une date incohérents, de façon intermittente ; et les tests deviennent rejouables | `now()` côté base pour l'un, horloge applicative pour l'autre |
| Collision de nom de relégation testée dans `pg_attribute` / `pg_class`, pas dans le registre seul | Le registre n'est autorité que sur ce qu'il connaît ; un attribut `attisdropped` occupe encore le nom | Se fier au registre |
| Refus de supprimer une table référencée porté par `ck_link_target_live`, sans aucun déclencheur de ce chapitre | Une contrainte est insensible à la concurrence ; un déclencheur `BEFORE UPDATE` sous `READ COMMITTED` laisse passer deux transactions | Déclencheur de catalogue plus verrou consultatif d'invariant de référence |
| Suppression logique d'une table : cascade logique sur ses champs, sans renommer leurs colonnes | `ck_field_table_live` l'impose ; renommer N colonnes allongerait une étape qui doit rester brève, sans aucun gain | Renommer chaque colonne avec le marqueur de relégation |
| La contrainte du champ lien tombe à la suppression logique (A17) | Un champ invisible partout ne doit pas continuer à refuser des `DELETE` ailleurs | Conserver la contrainte jusqu'à la purge |
| Colonne d'affichage : refus `DISPLAY_FIELD_IN_USE`, aucune bascule (A15) | Une bascule change sans prévenir ce que voient tous les consommateurs de tous les liens | Repli automatique vers le champ suivant ou vers `_id` |
| Le refus d'une contrainte fantôme est émis par basedb, jamais par PostgreSQL | `RENAME` n'échoue jamais sur une clé étrangère : la relégation réussirait en silence | Laisser PostgreSQL trancher |
| Export par `COPY … TO STDOUT` vers l'hôte applicatif, en tâche différée, avec contrôle de péremption | `COPY … TO '<fichier>'` exige un privilège que le rôle n'a pas ; une transaction unique export + purge serait sans borne | Export côté serveur ; ou export et purge dans la même transaction |
| Purge découpée en migrations d'au plus dix tables, reprise sur `purged_at` | Un `DROP TABLE` par table dans une transaction unique gèle la base entière et annule tout sur un seul verrou indisponible | Une transaction de purge par base |
| La purge conserve la ligne de catalogue ; l'épuration de second niveau la détruit à 12 mois (A22, A24) | La pierre tombale donne un référent à l'audit, rend observables les index partiels et permet à la réconciliation d'exclure ce qui a été détruit | Supprimer la ligne au moment de la purge |
| État nommé `RESIDUAL_SCHEMA` si le `DROP SCHEMA` final échoue | La destruction est irréversible : il faut un état visible, pas un échec silencieux | `DROP SCHEMA … CASCADE` |
| « Remplacer les valeurs par NULL » en tâche différée par lots, jamais dans la transaction de suppression | L'opération réécrit la table entière ; sous MVCC elle n'efface d'ailleurs rien | Case à cocher exécutée en ligne, libellée « effacer » |
| Seuils d'attributs et de colonnes reléguées lus au chapitre 04 §1.13, aucun plafond propre à ce chapitre | Un garde-fou dur se combinerait avec le délai de purge de 30 jours en blocage d'un mois ; et un seul chapitre doit porter la limite | Trois couples de seuils et trois codes pour la même limite PostgreSQL |
| Deux classes de dérive seulement, `CYCLE-ALIAS` et `CYCLE-RELEG`, dans l'espace de noms du chapitre | Les liens, les états physiques et les noms sont déjà couverts par `CAT-FK*`, `CAT-STATE` et `CAT-NAME` ; une lettre nue est inexploitable dans un rapport | Redéfinir des classes E, F, G qui se télescopent avec celles des autres chapitres |
| Un écart bloquant gèle les opérations de structure de la base, pas ses écritures de données | C'est le catalogue qui est suspect, pas les données que les utilisateurs continuent de saisir | Passer la base en lecture seule intégrale |
| Refus explicite `NAME_RETIRED` plutôt que suffixe automatique lors d'un renommage d'administration | L'administrateur a saisi un nom exact ; lui rendre `clients_2` en silence est le pire des deux mondes | Boucle de suffixe partout |

## Risques et limites connues

- **Les consommateurs que l'alias protège sont ceux qu'on ne sait pas mesurer.** Aucun compteur ne voit une connexion SQL directe. La coupure à blanc reste la seule mesure fiable, et elle dépend d'un journal serveur auquel basedb n'a pas accès.
- **La fenêtre d'un renommage de base à N tables.** Entre le renommage du schéma et la dernière vue d'alias, un consommateur SQL direct obtient `42P01` sur les tables pas encore aliasées. C'est borné, annoncé et reprenable, mais c'est une interruption réelle.
- **Trois formes d'écriture ne traversent pas un alias** : l'upsert avec inférence d'arbitre, `COPY … FROM` et `TRUNCATE`. Un consommateur qui les utilise casse malgré l'alias.
- **Le refus `FIELD_USED_BY_FORMULA` est un contrôle de service, pas une contrainte.** `field_formula_dependency` ne porte de miroir que sur `is_purged` : deux transactions concurrentes, l'une créant une formule et l'autre supprimant logiquement le champ dont elle dépend, peuvent passer toutes les deux. Le filet est alors la purge, qui refuse, et la réconciliation.
- **Le contrôle de péremption de l'export détecte, il ne prouve pas.** Une écriture directe suivie d'une annulation, ou un délai de collecte des statistiques, peut passer inaperçu.
- **La purge d'une base n'est pas atomique.** Elle est reprenable, mais une interruption laisse une base partiellement détruite, visible seulement dans l'écran d'administration des migrations.
- **Croissance monotone du registre et des lignes d'alias.** Rien n'est jamais libéré ; c'est le prix de la restauration et de la non-réattribution, et la borne pratique reste la boucle de suffixe `_2 … _99`.
- **Le nombre de relations croît vite** : 50 bases × 500 tables, plus les index, plus une vue par table aliasée, dépassent aisément 50 000 lignes dans `pg_class`. Conséquences à surveiller : durée d'un `pg_dump`, taille du catalogue système, et durée du rechargement complet du catalogue applicatif au démarrage d'un processus.
- **Un objet tiers peut bloquer une opération courante.** Une vue de consommateur posée sur un alias empêche la suppression logique d'un champ tant que son auteur ne l'a pas retirée. Le refus est nommé et la liste est fournie, mais l'utilisateur dépend d'un tiers.
- **`security_invoker` ne protège rien aujourd'hui** : il n'existe qu'un rôle. Sa valeur est entièrement dans un futur où l'exploitant crée un rôle en lecture seule.

## Questions ouvertes

1. **Emplacement du répertoire d'export.** Hôte applicatif par décision de ce chapitre ; reste à arbitrer son montage — volume local éphémère, volume persistant partagé entre répliques, ou stockage objet — sachant qu'une purge lancée sur une réplique et reprise sur une autre exige un volume partagé.
2. **Durée par défaut de la coupure à blanc.** 35 jours couvrent un cycle mensuel, pas un cycle trimestriel ni une clôture annuelle. Faut-il une valeur par base, saisie à la première coupure et mémorisée ?
3. **Sauvegarde après séparation physique de `_basedb`** (§9.7). Aucune procédure ne permet aujourd'hui deux clichés cohérents sans fenêtre d'arrêt des opérations de structure. À trancher avant la séparation, pas après.

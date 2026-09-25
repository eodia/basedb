# 02 — Schéma du catalogue `_basedb`

## Rôle et principes de conception

Le catalogue est la description exhaustive, dans des tables PostgreSQL ordinaires, de tout ce que l'application sait des structures utilisateur. Il n'est pas un cache ni un miroir : c'est l'original. La documentation générée, la spécification OpenAPI, les outils MCP et l'éditeur de schéma lisent le catalogue, jamais `information_schema` ni `pg_catalog`. La réciproque est vraie : rien n'existe en base sans ligne de catalogue correspondante.

Ce chapitre fait autorité sur le **stockage**. Les règles de calcul des noms appartiennent au chapitre 01 — Conventions de nommage ; la machine à états des opérations de structure au chapitre 03 — Moteur DDL ; la projection des types au chapitre 04 — Types de champs.

Cinq principes gouvernent le DDL qui suit.

1. **Typer plutôt que sérialiser.** Chaque paramètre a une colonne, chaque référence une clé étrangère. La liste des colonnes `jsonb` et le critère de leur emploi figurent en fin de chapitre.
2. **Déclarer plutôt que vérifier.** Chaque fois qu'un invariant peut être porté par une contrainte — au prix d'une colonne dénormalisée, d'une colonne miroir et d'une clé étrangère composite — il l'est. Une contrainte survit à un correctif SQL manuel, à un bogue applicatif et à une exécution concurrente. Corollaire : le chapitre n'annonce jamais une garantie que la base ne rend pas ; là où le service reste responsable, c'est écrit.
3. **Nommer une fois.** Aucun nom physique n'est stocké en clair dans une table d'objet. Le registre `_basedb.physical_name` est le seul détenteur des chaînes (A5) ; les objets le référencent par clé étrangère. Le moteur ne recalcule jamais un nom : il le relit.
4. **Le catalogue est une donnée chaude en lecture.** La partie « structures » reste petite et sert des lectures par clé. Les tables de traces qui vivent dans le même schéma obéissent à un autre régime, traité dans « Volumétrie, rétention et exploitation ».
5. **Une étape de structure = une connexion = une transaction**, sur le pool `ddl` (chapitre 01 §10.3). Une opération de structure est un plan à plusieurs étapes (A11) ; aucune étape ne laisse le catalogue et la structure physique désaccordés, et l'état intermédiaire est représenté au catalogue par les colonnes d'état physique décrites plus bas. Il n'y a aucune validation en deux phases : `PREPARE TRANSACTION` exige `max_prepared_transactions > 0`, hors de portée d'un rôle propriétaire de base.

## Vue d'ensemble

```
physical_name (registre des noms, 5 etats)      lock_class ── lock_key
      ▲ FK depuis tout objet nomme                 (verrous consultatifs, A8)
      │
tenant ── app_user ──< session, auth_identity, confirmation_challenge
  │  │         └──< role_member >── role ──< permission
  │  │                                  └──< field_permission >── field
  │  └── authz_version
  └──< base
        ├── catalog_version, lock_key, mcp_enabled, current_migration_id
        ├──< db_schema (courant | alias) ──< sql_view_alias
        ├──< application ──< application_table >── table_def
        ├──< migration ──< (execution : chapitre 07)
        ├──< cascade_grant, webhook ──< webhook_subscription, webhook_header
        └──< table_def
              ├── display_field_id ─────┐ FK composite differee (A15)
              ├──< view_def             │
              ├──< table_constraint ──< table_constraint_member >── field
              ├──< table_index      ──< table_index_member      >── field
              └──< field ───────────────┘
                    ├──< select_option
                    ├─1:1 field_text_config, field_number_config,
                    │     field_datetime_config, field_boolean_config,
                    │     field_select_config, field_formula_config
                    │     ──< field_formula_dependency
                    └─1:1 field_link_config ── target_table_id ──> table_def

Transverses : error_code, retention_policy, setting, secret, idempotency_key,
catalog_migration, audit_log, ai_call, change_event, webhook_delivery,
security_log (les cinq dernieres partitionnees par mois).

Objets de _basedb definis par un autre chapitre, recenses ici :
  deferred_task                                             -> chapitre 06
  record_revision, record_revision_field, record_deletion,
  bulk_operation, structure_revision, migration_execution,
  capture_gap, history_archive, erasure_request,
  v_record_deletion, v_record_deletion_horizon (vues)       -> chapitre 07

Colocalisees aux donnees : _basedb_local (fonctions partagees, tampons de capture,
change_feed_state).
```

---

## Socle technique

### Pré-conditions de déploiement

Vérifiées au démarrage, avant tout service ; un manquement est un refus de démarrer nommé, jamais une erreur serveur brute.

| Condition | Vérification | Si absente |
|---|---|---|
| PostgreSQL 16 minimum (A1) | `SHOW server_version_num` ≥ 160000 | `POSTGRES_VERSION_TOO_OLD` |
| Encodage `UTF8` | `pg_database.encoding` | `DB_ENCODING_NOT_UTF8` |
| Rôle connecté propriétaire de la base d'accueil | `pg_database.datdba` | `DB_NOT_OWNED` |
| Propriété de `_basedb`, `_basedb_local` et des schémas `b_*` | chapitre 01 §11.1 | `PRIVILEGES_INSUFFICIENT` |
| `pg_trgm`, `unaccent`, collations ICU (A3) | chapitre 10 | un code par extension manquante |

**Le propriétaire de la base peut tout lire.** Avec un rôle unique et sans `CREATEROLE`, il est impossible d'empêcher un consommateur SQL direct d'atteindre `auth_identity.password_hash`, `api_token.token_hash`, `webhook.signing_secret_encrypted` et `secret.value_encrypted`. La parade est la forme des données, pas les droits : empreintes argon2id, empreintes SHA-256 de secrets à haute entropie, et chiffrement des secrets réversibles par la clé d'instance lue dans `BASEDB_ENCRYPTION_KEY` (A25), qui ne réside jamais en base.

### Le schéma colocalisé `_basedb_local`

Conformément à A9, les objets partagés dont les schémas de données dépendent vivent dans `_basedb_local`, dont le nom est **figé et non configurable** : il est écrit dans la clause `DEFAULT` de la colonne `_id` de toutes les tables utilisateur. Aucune variable de configuration de schéma n'existe nulle part, et aucun objet d'un schéma `b_*` ne référence `_basedb`.

```sql
CREATE SCHEMA _basedb;
CREATE SCHEMA _basedb_local;

-- Corps de reference unique. Corps analyse a la creation (BEGIN ATOMIC) :
-- les dependances sont figees, aucune resolution ne depend du search_path.
CREATE FUNCTION _basedb_local.uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE
SET search_path = pg_catalog
BEGIN ATOMIC
  SELECT encode(
           set_bit(
             set_bit(
               overlay(uuid_send(gen_random_uuid())
                       PLACING substring(
                         int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)
                         FROM 3)
                       FROM 1 FOR 6),
               52, 1),
             53, 1),
           'hex')::uuid;
END;

COMMENT ON FUNCTION _basedb_local.uuid_generate_v7() IS
  'UUIDv7 : 48 bits d''horodatage ms + aleatoire. floor() et non arrondi : un cast
   numeric -> bigint arrondirait jusqu''a une demi-milliseconde dans le futur.
   Remplacable par uuidv7() natif en PG18, par migration de catalogue.';

-- Corps de reference unique. clock_timestamp() et non now() : deux ecritures
-- successives d'une meme transaction doivent rester ordonnables par _updated_at.
CREATE FUNCTION _basedb_local.set_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW."_updated_at" := clock_timestamp();
  NEW."_updated_by" := nullif(current_setting('basedb.actor_id', true), '')::uuid;
  RETURN NEW;
END $$;
```

`_basedb_local` porte en outre la fonction de normalisation `_basedb_local.fold_v1()` utilisée par les index d'expression (chapitre 04, qui en fixe le corps), la fonction de capture `_basedb_local.capture_v1()` (chapitre 07, normatif sur son corps et sur la liste des déclencheurs posés sur une table utilisateur), les deux tables tampon décrites dans « Capture et drain », et `_basedb_local.change_feed_state` (chapitre 07, normatif), l'état plat que la capture consulte à chaque instruction : il est colocalisé avec les tampons qu'il commande, précisément pour qu'aucune écriture de donnée n'ait à lire `_basedb` depuis un schéma `b_*` (A9).

En-tête systématique de toute table de données générée, pour mémoire (chapitre 03 pour le gabarit complet) :

```sql
_id         uuid        PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
_created_by uuid        NULL,
_updated_by uuid        NULL
```

`_created_by` et `_updated_by` **ne portent aucune clé étrangère vers `_basedb.app_user`** : une contrainte par table de données vers le catalogue produirait des milliers de contraintes traversant la frontière que A9 protège. La résolution de l'auteur est applicative, et une ligne dont l'auteur a été purgé affiche « utilisateur supprimé ». Conformément à A18, ces cinq colonnes sont lisibles dès que la lecture de la table est accordée, ne sont jamais inscriptibles et ne peuvent pas porter de permission de champ — structurellement, puisqu'elles n'ont pas de ligne dans `field`.

**Partout ailleurs dans `_basedb`**, toute colonne d'auteur (`created_by`, `updated_by`, `deleted_by`, `purged_by`, `granted_by`, `requested_by`, `approved_by`, `applied_by`, `revoked_by`, `suspended_by`) porte `REFERENCES _basedb.app_user(id) ON DELETE RESTRICT`. Un utilisateur n'est donc jamais détruit physiquement : `app_user` ne connaît que la suppression logique. Les seules exceptions sont `audit_log` et les tables de journal, traitées plus bas.

### Clé primaire, collation, types proscrits

Toutes les tables du catalogue et la colonne `_id` de toutes les tables de données emploient le type `uuid` alimenté en **UUIDv7** : 16 octets de taille fixe, ordonné dans le temps (insertion en queue d'index, pas de division de page aléatoire), **généré côté client** — l'identifiant existe avant l'insertion, ce qui est indispensable pour écrire le catalogue et émettre le DDL dans la même étape, pour construire une charge utile sans relecture, et pour qu'une migration proposée nomme les objets qu'elle créera avant d'être appliquée. *Alternatives rejetées* : `bigint GENERATED … AS IDENTITY`, qui impose un aller-retour et rend toute copie de base conflictuelle ; clé textuelle, disqualifiée parce qu'un slug est renommable.

Toute colonne du catalogue contenant un identifiant SQL, une clé de comparaison de libellé ou un `tenantId` est déclarée **`text COLLATE "C"`** : `physical_name.name`, `tenant.ref`, `label_key`, `setting.key`, `secret.key`, `api_token.token_prefix`, `error_code.code`, les codes des tables d'énumération. PostgreSQL compare ses propres identifiants octet à octet ; indexer ces colonnes sous une collation linguistique ferait dépendre l'unicité d'une bibliothèque système, qu'une mise à jour (rupture glibc 2.28, mises à jour ICU) réordonne. `label`, `description` et l'index `lower(email)` restent en collation par défaut : ce sont des textes humains.

Les types `char(n)` sont proscrits : leur conversion implicite vers `text` retire les espaces de fin et rend les expressions régulières de validation subtilement fausses. Partout : `text COLLATE "C"` plus un `CHECK (length(…) = n)`.

### Noms physiques : motifs et budgets

Les motifs et les budgets sont ceux du chapitre 01, rappelés ici pour mémoire et non redéfinis (A6) :

| Objet | Motif | Budget |
|---|---|---|
| Clé primaire | `pk_<table>` | slug de base : **53** octets |
| Clé étrangère | `fk_<table>__<colonne>` | nom de table : **48** |
| Index | `ix_<table>__<colonne>` | nom de champ : **48** |
| Unicité | `uq_<table>__<colonne>` | nom dérivé assemblé : **63** |
| Vérification | `ck_<table>__<colonne>__<regle>` | |

Le respect des budgets par nature d'objet est une propriété de la **procédure d'allocation** (chapitre 01 §6.1), pas du stockage : le registre ne sait pas si une chaîne de 50 octets est un nom de table ou un nom dérivé. Le catalogue pose donc une seule barrière, la dernière : l'alphabet B et la limite de 63 octets, en `CHECK` sur la colonne de nom du registre. Il n'existe **aucun désambiguïsateur inséré dans un nom** et aucune contrainte limitant un nom à 29 ou 35 octets ; les collisions sont résolues par la boucle de suffixe et les dépassements par la répartition de budget du chapitre 01 §9.6.

### Colonnes de cycle de vie

Le bloc n'est pas universel, et sa portée est une décision.

**Les objets ayant une contrepartie physique en base — `base`, `db_schema`, `table_def`, `field`** — portent le bloc complet : `label`, `label_key`, `name_id`, `description`, `definition_state`, `created_at`/`created_by`, `updated_at`/`updated_by`, `deleted_at`/`deleted_by`, `is_live`, `purged_at`/`purged_by`, `is_purged`.

**Les objets purement logiques — `application`, `role`, `view_def`, `webhook`** — portent `label`, `name`, `description`, les colonnes d'auteur et `deleted_at`/`deleted_by` : ni nom physique, ni purge, ni miroirs. Les invariants portant sur le nom physique et la purge ne les concernent pas.

- `label_key` est la **clé de comparaison de libellé** calculée par l'application (chapitre 01 §2.2), stockée, en `COLLATE "C"`, et porteuse d'un index d'unicité partiel sur les objets vivants. Toute unicité de libellé fondée sur `lower()` côté serveur est interdite.
- `is_live` et `is_purged` sont des colonnes ordinaires contraintes par `CHECK (is_live = (deleted_at IS NULL))` et `CHECK (is_purged = (purged_at IS NOT NULL))`, mises à jour dans la même instruction que l'horodatage. Ce ne sont pas des colonnes générées : une colonne générée ne peut pas servir de cible à une clé étrangère avec propagation.
- `definition_state` vaut `pending` ou `active`. Une définition créée au milieu d'un plan à plusieurs étapes reste `pending` — invisible de l'API, du MCP et de la documentation générée — jusqu'à l'étape qui la bascule en `active`. C'est ce qui rend une opération de structure atomique **du point de vue du consommateur** alors qu'elle ne l'est pas du point de vue de PostgreSQL (A11).
- `description` dit **à quoi sert** l'objet, là où le libellé dit comment il s'appelle. C'est un texte facultatif, **brut** — ni Markdown ni HTML, ce qui permet à chaque consommateur de l'échapper sans rien en perdre (chapitre 08 §7.6) —, normalisé à l'écriture : espaces de tête et de fin retirés, NFC, `CRLF` et `CR` ramenés à `LF`. Une valeur absente ou blanche est stockée `NULL` et rendue `null` : il n'existe pas de chaîne vide, pas plus qu'au chapitre 04 §1.3. La borne est de **1 000 caractères**, comptés en caractères et non en octets ; au-delà, l'écriture est **refusée** par `TEXT_TOO_LONG` (`details = {field: 'description', maximum: 1000}`) et jamais tronquée, car une phrase coupée est pire que le refus qui laisse son auteur la raccourcir. `U+0000` est refusé (`VALUE_INVALID`), tout type JSON autre que la chaîne aussi (`REQUEST_INVALID`).
- La description se pose **à la création** et se modifie ensuite, sur la portée de l'objet, par tout rôle portant `manage_schema` : c'est une ligne de catalogue comme un libellé, donc **sans migration** (chapitre 06 §1.1). Elle incrémente `base.catalog_version` et émet `NOTIFY basedb_catalog`, puisque la documentation, la spécification OpenAPI et `/meta` la projettent et que leur `ETag` dérive de cette version (chapitre 08 §9.2). **Aucune règle de permission, de nommage, de projection ou de migration ne lit une description** : elle est écrite par des personnes, lue par des personnes et par des agents, et n'est jamais la source d'une décision.

**Qui lit la description.** Quatre consommateurs, tous à partir du catalogue et jamais de `pg_catalog` : la documentation lisible, la spécification OpenAPI et `/meta` (chapitre 08 §9) ; les outils `describe_base` et `describe_table` du serveur MCP (chapitre 09 §4) ; et le `COMMENT ON TABLE` / `COMMENT ON COLUMN` du schéma `b_*`, ce que lit l'humain qui explore la base en `psql`. Le commentaire porte la description ou, à défaut, le libellé (chapitre 04 §1.1) ; il est réécrit **dans la transaction** de toute modification, et `CAT-CMT` en vérifie la conformité. La description d'une base n'a pas de contrepartie physique : elle ne vit qu'au catalogue. Les cinq colonnes système, qui n'ont pas de ligne de catalogue, portent une description fixe, en français, posée par le noyau : sans elle, la documentation expliquerait toutes les colonnes sauf `_id`, la seule dont un champ lien ait besoin. **Une description suit son objet** : elle est visible exactement quand l'objet l'est, et la projection n'en contient jamais que pour ce que le lecteur voit (chapitre 08 §9.3).

### Le patron miroir, énoncé une fois

Le catalogue rend déclaratif un invariant qui traverse deux tables toujours de la même façon :

1. la table parente expose un `UNIQUE (id, <colonne d'état>)`, redondant avec sa clé primaire mais nécessaire comme cible ;
2. la table enfant duplique `<colonne d'état>` dans une colonne miroir ;
3. une clé étrangère composite relie `(parent_id, miroir)` à `(id, <colonne d'état>)`, déclarée `ON UPDATE CASCADE` ;
4. un `CHECK` local sur le miroir exprime l'invariant.

Changer l'état du parent propage la valeur dans l'enfant, où le `CHECK` refuse la combinaison interdite. Le refus est immédiat, nommé, et insensible à la concurrence — deux transactions concourantes ne peuvent pas passer toutes les deux, contrairement à une vérification en code ou en PL/pgSQL sous `READ COMMITTED`.

**Règle sur `ON UPDATE CASCADE`** : employée seulement si (a) toutes les colonnes référencées sont immuables sauf l'état propagé et (b) aucune autre table ne référence la clé primaire de la table référençante. Sont immuables par construction, et aucune migration de catalogue n'a le droit de les réécrire : `tenant.id`, `tenant.ref`, `base.id`, `db_schema.id`, `table_def.id`, `table_def.base_id`, `field.id`, `field.table_id`, `field.base_id`, `field.kind`, tout `name_id`. Partout ailleurs, `ON UPDATE RESTRICT`.

### Indexation des clés étrangères du catalogue

PostgreSQL indexe le côté **référencé** d'une clé étrangère, jamais le côté **référençant**. Sans index côté référençant, chaque suppression de clé parente déclenche un `SELECT 1 FROM enfant WHERE fk = $1 FOR KEY SHARE`, donc un balayage séquentiel avec pose de verrous de ligne. Le piège, dans un catalogue truffé d'index partiels, est que **cette vérification interne ne porte pas le prédicat du partiel**.

> **Toute colonne référençante d'une clé étrangère du catalogue porte un index non partiel, en plus des index partiels de service.**

La liste n'est pas tenue à la main : la dérive `CAT-IDX` l'établit mécaniquement et signale toute omission. Les blocs DDL qui suivent omettent ces index, où ils noieraient la structure.

Ces blocs sont **groupés par domaine pour la lecture**, pas par ordre de création : la migration de catalogue `0001` crée toutes les tables, puis toutes les contraintes, puis tous les index. Les quelques références croisées entre domaines — `field_select_config` vers `table_constraint`, `base` vers `migration` — sont donc posées après coup, ce que le DDL signale là où c'est le cas. Convention interne : tables au singulier, `snake_case`, sans préfixe puisque le schéma cloisonne ; `table_def` et non `table`, `app_user` et non `user`, ces deux mots étant réservés par SQL. Toute table et toute colonne porte un `COMMENT ON` destiné aux développeurs ; les commentaires destinés aux consommateurs SQL sont générés dans les schémas `b_*` depuis les colonnes `description` (à défaut, depuis le libellé), et leur conformité est vérifiée par la dérive `CAT-CMT`.

### États physiques

Les opérations de structure sont des plans à plusieurs étapes (A11) : une contrainte peut exister sans être validée, un index peut être en construction, une contrainte d'échafaudage peut attendre sa suppression. Ces états intermédiaires sont **explicitement représentés au catalogue**, dans un vocabulaire unique et fermé, partagé par toutes les colonnes d'état.

```sql
CREATE TABLE _basedb.physical_state (
  code        text COLLATE "C" PRIMARY KEY,
  is_enforced boolean NOT NULL,   -- la contrainte s'applique-t-elle aux ecritures
  is_terminal boolean NOT NULL,   -- un etat non terminal depuis > 24 h est une derive
  description text NOT NULL
);
INSERT INTO _basedb.physical_state VALUES
 ('absent',     false, true,  'Aucun objet physique ; etat initial et final'),
 ('pending',    false, false, 'Etape planifiee, DDL non encore emis'),
 ('building',   false, false, 'CREATE INDEX CONCURRENTLY en cours'),
 ('not_valid',  true,  false, 'ADD CONSTRAINT ... NOT VALID emis, lignes anciennes non verifiees'),
 ('validating', true,  false, 'VALIDATE CONSTRAINT en cours'),
 ('active',     true,  true,  'Objet present et valide'),
 ('invalid',    false, false, 'Residu a supprimer : indisvalid = false, echafaudage abandonne'),
 ('dropping',   true,  false, 'DROP planifie, objet encore present'),
 ('dropped',    false, true,  'Objet retire, ligne conservee pour la reconciliation');
```

Correspondance avec les états que le chapitre 03 nomme, pour qu'un seul objet porte chaque état :

| État réclamé | Colonne qui le porte |
|---|---|
| `required_state` | `field.required_state` |
| `unique_state` | `table_constraint.state` de la contrainte d'unicité concernée |
| `check_state` | `table_constraint.state` de la contrainte de vérification concernée |
| `fk_state` | `table_constraint.state` de la contrainte de clé étrangère du lien |
| `fk_index_state` | `table_index.state` de l'index de la colonne de lien |
| `validate_attempts`, `next_attempt_at` | `table_constraint` |
| état `pending` / `active` d'une définition | `definition_state` sur `base`, `table_def`, `field` |

Une unicité ou une vérification peut être composite : son état ne peut donc pas vivre sur un champ. C'est la raison pour laquelle `field` ne porte ni `is_unique` ni `unique_state` ; l'unicité d'un champ est une ligne de `table_constraint` à un seul membre, et l'API la restitue sous la forme booléenne attendue par les utilisateurs.

### Suppression logique, purge, épuration

Trois états après le vivant, et la distinction est structurante.

| État | Catalogue | Base physique | Libellé | Nom physique |
|---|---|---|---|---|
| Vivant | ligne, `deleted_at IS NULL` | objet présent | occupé | `active` au registre |
| Supprimé logiquement | ligne, `deleted_at` renseigné | objet relégué `zz_supprime_…` | **libéré** | ancien nom `retired`, nom de relégation `relegated` |
| Purgé (niveau 1) | **ligne conservée**, `purged_at` renseigné | objet détruit (`DROP`) | libéré | `purged` |
| Épuré (niveau 2) | ligne détruite | — | libéré | `purged`, ligne de registre **jamais détruite** |

**La purge ne supprime jamais la ligne de catalogue (A22).** Elle exécute le `DROP` physique et renseigne `purged_at` ; la ligne devient une pierre tombale. C'est elle qui porte la trace de ce qui a existé, qui donne un référent à `audit_log.object_id`, qui rend observables les index partiels `WHERE purged_at IS NULL` et qui permet à la réconciliation d'exclure ce qui a été légitimement détruit.

**L'épuration de second niveau** détruit les pierres tombales passé la rétention `catalog_tombstone` (12 mois par défaut, A24). C'est le seul chemin où un `DELETE` frappe le catalogue, et c'est lui seul qui donne un sens aux clauses `ON DELETE` :

- `ON DELETE CASCADE` sur les dépendances **existentielles** : `auth_identity` → `app_user`, `select_option` → `field`, satellites → `field`, `field_permission` → `field`, `table_constraint_member` → `table_constraint`, `application_table` → `application`, `webhook_subscription`/`webhook_header` → `webhook`.
- `ON DELETE RESTRICT` entre objets de **niveau égal** : `field_link_config` → `table_def` cible, `field_formula_dependency` → `field`, `api_token` → `role`, toute colonne d'auteur → `app_user`.

L'ordre d'épuration est donc : champs, puis tables, puis bases. Un refus d'épuration n'est jamais visible d'un utilisateur : la tâche saute la ligne et le journalise.

**Aucune ligne du registre des noms n'est jamais détruite**, y compris en état `purged` : l'épuration porte sur les tables d'objets, jamais sur le registre. Supprimer la table « Clients » puis la recréer donne `clients_2`, à vie (chapitre 01 §6.3).

**Ordre de suppression logique imposé, de bas en haut.** Supprimer une table suppose que tous ses champs le soient déjà ; supprimer une base suppose que toutes ses tables le soient. Ce n'est pas une convention : les miroirs `field.table_is_live` et `table_def.base_is_live` le rendent impossible autrement, et la base refuse avec le nom de la contrainte.

---

## Domaine 1 — Noms physiques et verrous

### Le registre `_basedb.physical_name`

Conformément à A5, c'est le **seul** détenteur des noms physiques. Les tables d'objets le référencent par clé étrangère et ne dupliquent jamais la chaîne. Il n'existe nulle part de colonne `schema_name`, `physical_name`, `rel_name`, `fk_constraint_name` ou équivalente sur une table d'objet du catalogue, et il n'existe pas de second registre. La seule chaîne de nom conservée hors du registre est `audit_log.object_name`, instantané historique et non référence courante (voir « Journal d'audit »).

```sql
CREATE TABLE _basedb.physical_name (
  id           uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  scope_kind   text NOT NULL CHECK (scope_kind IN ('instance','schema','table')),
  scope_id     uuid NOT NULL,
  name         text COLLATE "C" NOT NULL,
  object_kind  text NOT NULL CHECK (object_kind IN
                 ('schema','table','sql_view','field','system_field',
                  'index','constraint','sequence','trigger')),
  state        text NOT NULL DEFAULT 'active'
                 CHECK (state IN ('active','relegated','retired','alias','purged')),
  slug_version integer NOT NULL,
  previous_name_id uuid NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  allocated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  allocated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),

  -- Alphabet B du chapitre 01 §2.3, plus la contrainte d'octets ecrite separement.
  CONSTRAINT ck_name_alphabet CHECK (name ~ '^_?[a-z][a-z0-9_]{0,62}$'),
  CONSTRAINT ck_name_length   CHECK (octet_length(name) <= 63),
  -- Portee instance : la constante SCOPE_INSTANCE, et elle seule.
  CONSTRAINT ck_name_scope CHECK (
    (scope_kind = 'instance') = (scope_id = '00000000-0000-0000-0000-000000000001'::uuid)),
  -- Un nom de schema est toujours de portee instance, un champ toujours de portee table.
  CONSTRAINT ck_name_scope_kind CHECK (
        (object_kind IN ('schema','sql_view') OR scope_kind <> 'instance')
    AND (object_kind NOT IN ('field','system_field','trigger') OR scope_kind = 'table')),
  CONSTRAINT uq_name_id_scope UNIQUE (id, scope_id)   -- cible de FK composite
);

-- Seule autorite d'unicite du produit. Non partiel : aucun etat ne libere un nom.
CREATE UNIQUE INDEX uq_physical_name ON _basedb.physical_name (scope_id, name);
CREATE INDEX idx_physical_name_state ON _basedb.physical_name (state, object_kind)
  WHERE state IN ('active','relegated','alias');
```

Trois points appellent une explication.

**`scope_id` ne porte pas de clé étrangère typée.** La portée est de trois natures, dont une constante qui n'est la ligne d'aucune table. L'existence de la portée est garantie **par l'autre bout** : chaque table d'objet référence `(name_id, <portée>)` vers `(id, scope_id)`, ce qui interdit d'attacher à une table un nom alloué sous la portée d'une autre. C'est la première des quatre entorses assumées au principe 2, et elle est compensée par une contrainte plus forte que celle qu'on a renoncé à écrire.

**Il n'y a pas de colonne `object_id`.** La référence va du catalogue vers le registre, jamais l'inverse (A5). Une ligne de registre que rien ne référence est soit une colonne système (`system_field`), soit un nom retiré, soit une dérive — que la réconciliation nomme.

**`previous_name_id` rend la relégation navigable.** Une suppression logique produit deux mouvements : la ligne du nom d'origine passe à `retired`, une nouvelle ligne est créée en `relegated` pour `zz_supprime_…`, et le `name_id` de l'objet bascule sur la nouvelle. Sans ce chaînage, l'ancien nom deviendrait introuvable depuis l'objet.

Les cinq états et leurs transitions autorisées sont ceux du chapitre 01 §6.3 ; le catalogue ne les redéfinit pas. L'allocation est sérialisée par portée au moyen du verrou consultatif de classe `name_allocation` défini ci-dessous, et l'unicité est garantie par l'index `uq_physical_name`, jamais par un `SELECT` préalable.

### Vue de confort : le nom qualifié

```sql
CREATE VIEW _basedb.v_physical_name_qualified AS
SELECT n.id AS name_id,
       n.object_kind,
       n.state,
       n.scope_kind,
       coalesce(s.name, n.name) AS schema_name,
       CASE WHEN s.name IS NULL THEN NULL ELSE n.name END AS object_name,
       CASE WHEN s.name IS NULL THEN quote_ident(n.name)
            ELSE quote_ident(s.name) || '.' || quote_ident(n.name) END AS qualified_name
FROM _basedb.physical_name n
LEFT JOIN _basedb.db_schema sc
       ON sc.id = CASE n.scope_kind
            WHEN 'schema' THEN n.scope_id
            WHEN 'table'  THEN (SELECT t.schema_id FROM _basedb.table_def t
                                 WHERE t.id = n.scope_id)
          END
LEFT JOIN _basedb.physical_name s ON s.id = sc.name_id;
```

Elle n'existe que pour la lisibilité des requêtes de diagnostic et de réconciliation ; aucun chemin d'écriture ne la traverse, et le constructeur SQL du produit lit les lignes de registre, pas la vue.

### Registre des classes de verrous consultatifs

Conformément à A8, les verrous consultatifs emploient une **clé entière attribuée et stockée au catalogue**, jamais `hashtext()`, dont les collisions provoqueraient des blocages mutuels entre bases sans rapport et dont l'algorithme n'est pas documenté.

```sql
CREATE TABLE _basedb.lock_class (
  key         integer PRIMARY KEY,
  code        text COLLATE "C" NOT NULL UNIQUE,
  scope_kind  text NOT NULL CHECK (scope_kind IN ('instance','name_scope','base')),
  holding     text NOT NULL CHECK (holding IN ('transaction','session')),
  description text NOT NULL
);
INSERT INTO _basedb.lock_class VALUES
 (1,'catalog_migration','instance',  'session',     'Migrations du schema _basedb au demarrage'),
 (2,'name_allocation',  'name_scope','transaction', 'Allocation d''un nom dans une portee'),
 (3,'structure_step',   'base',      'transaction', 'Etape d''une operation de structure'),
 (4,'maintenance',      'instance',  'session',     'Partitions, purge, reconciliation'),
 (5,'drain',            'base',      'session',     'Drain des tampons de capture');

CREATE SEQUENCE _basedb.lock_key_seq AS integer START 2;   -- 1 = portee instance
```

La **seconde clé** est la colonne `lock_key integer NOT NULL UNIQUE DEFAULT nextval('_basedb.lock_key_seq')` portée par `base`, `db_schema` et `table_def`. Une séquence unique pour les trois tables garantit qu'un couple `(classe, clé)` désigne une portée et une seule. La portée instance emploie la clé réservée `1`. L'appel émis est donc toujours de la forme `pg_advisory_xact_lock(<lock_class.key>, <lock_key>)`, ou `pg_advisory_lock` pour les classes en détention de session.

Le moment de l'acquisition, la durée de détention et la politique de reprise après expiration de `lock_timeout` appartiennent au chapitre 03. Une seule règle est posée ici, parce qu'elle conditionne l'absence d'interblocage : **le verrou d'allocation de nom est toujours acquis avant tout verrou de table.**

---

## Domaine 2 — Identité, sessions, permissions

```sql
CREATE TABLE _basedb.tenant (
  id             uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  ref            text COLLATE "C" NOT NULL,   -- tenantId : 't' + 6 caracteres
  label          text NOT NULL,
  is_system      boolean NOT NULL DEFAULT false,
  authz_version  bigint NOT NULL DEFAULT 1,   -- incremente a toute ecriture d'autorisation
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by     uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at     timestamptz NULL,
  deleted_by     uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_tenant_ref    UNIQUE (ref),
  CONSTRAINT uq_tenant_id_ref UNIQUE (id, ref),
  CONSTRAINT ck_tenant_ref    CHECK (ref ~ '^t[2-9a-km-np-z]{6}$')
);
COMMENT ON COLUMN _basedb.tenant.authz_version IS
  'Compteur monotone. Incremente a toute ecriture de permission, de role, d''affectation
   ou de jeton. C''est la cle d''invalidation des caches de droits et de la specification
   OpenAPI ; aucun autre compteur de permissions n''existe dans le produit.';

CREATE TABLE _basedb.app_user (
  id                uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id         uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  email             text NOT NULL,
  display_name      text NOT NULL,
  is_instance_admin boolean NOT NULL DEFAULT false,
  is_system         boolean NOT NULL DEFAULT false,
  locale            text NOT NULL DEFAULT 'fr',
  timezone          text NOT NULL DEFAULT 'Europe/Paris',
  disabled_at       timestamptz NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  bootstrap_secret_hash        bytea NULL,
  bootstrap_secret_expires_at  timestamptz NULL,
  bootstrap_secret_consumed_at timestamptz NULL,
  last_seen_at      timestamptz NULL,        -- ecriture bridee, non indexee
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_user_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT ck_user_bootstrap CHECK (
    (bootstrap_secret_hash IS NULL) = (bootstrap_secret_expires_at IS NULL)
    AND (bootstrap_secret_consumed_at IS NULL OR bootstrap_secret_hash IS NOT NULL))
);
CREATE UNIQUE INDEX uq_app_user_email_live
  ON _basedb.app_user (tenant_id, lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE _basedb.auth_identity (
  id            uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  user_id       uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE CASCADE,
  provider      text COLLATE "C" NOT NULL,   -- 'password' | 'oidc:<slug>'
  subject       text NOT NULL,               -- courriel normalise, ou "sub" du fournisseur
  password_hash text NULL,                   -- argon2id, jamais autre chose
  failed_attempts smallint NOT NULL DEFAULT 0,  -- verrouillage apres echecs (chapitre 13)
  locked_until  timestamptz NULL,            -- fin du verrouillage en cours, NULL si aucun
  last_used_at  timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_identity_provider_subject UNIQUE (provider, subject),
  CONSTRAINT ck_identity_password
    CHECK ((provider = 'password') = (password_hash IS NOT NULL))
);
CREATE UNIQUE INDEX uq_identity_one_password_per_user
  ON _basedb.auth_identity (user_id) WHERE provider = 'password';

CREATE TABLE _basedb.session (
  id                  uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  user_id             uuid NOT NULL,
  tenant_id           uuid NOT NULL,          -- fige a la creation, sans bascule
  token_hash          bytea NOT NULL,         -- SHA-256 du jeton ; le jeton n'est pas stocke
  created_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  absolute_expires_at timestamptz NOT NULL,
  elevated_until      timestamptz NULL,
  revoked_at          timestamptz NULL,
  revoked_reason      text NULL,
  ip                  inet NULL,
  user_agent          text NULL,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id, tenant_id)
    REFERENCES _basedb.app_user (id, tenant_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_session_token UNIQUE (token_hash),
  CONSTRAINT ck_session_expiry CHECK (absolute_expires_at > created_at)
);
CREATE INDEX idx_session_live ON _basedb.session (user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE _basedb.confirmation_challenge (
  id             uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  actor_user_id  uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  session_id     uuid NULL REFERENCES _basedb.session(id) ON DELETE RESTRICT,
  operation      text COLLATE "C" NOT NULL,   -- code de l'operation reservee visee
  target_kind    text COLLATE "C" NOT NULL,
  target_id      uuid NOT NULL,
  challenge_hash bytea NOT NULL,              -- empreinte du texte a saisir
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz NULL,
  CONSTRAINT ck_challenge_expiry CHECK (expires_at > created_at)
);
CREATE INDEX idx_challenge_open ON _basedb.confirmation_challenge (actor_user_id, target_id)
  WHERE consumed_at IS NULL;
-- Resolution d'un defi presente par sa seule empreinte, et unicite de l'empreinte
-- parmi les defis ouverts : sans lui, la confirmation de reinitialisation de mot de
-- passe imposerait un parcours sequentiel, et rien n'interdirait deux defis ouverts
-- de meme empreinte. Partiel : une empreinte consommee ne bloque plus rien.
CREATE UNIQUE INDEX uq_challenge_hash_open ON _basedb.confirmation_challenge (challenge_hash)
  WHERE consumed_at IS NULL;
```

`session.tenant_id` est figé à la création : un utilisateur appartient à exactement un tenant (`app_user.tenant_id NOT NULL`), et la clé étrangère composite interdit une session dont le tenant ne serait pas celui de son porteur. Il n'existe pas de table d'appartenance multiple ; le cadrage demande le nommage du multi-tenant, pas la bascule.

`confirmation_challenge` porte la confirmation en deux temps des opérations réservées — suppression cascadante, renommage physique, purge. Le défi est consommé une fois ; sa réexécution après `consumed_at` est refusée.

```sql
CREATE TABLE _basedb.role (
  id        uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  label     text NOT NULL,
  label_key text COLLATE "C" NOT NULL,
  name      text COLLATE "C" NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  -- group : un groupe d'utilisateurs, administre depuis l'ecran des permissions ;
  -- token : le role propre d'un jeton d'integration, sans membre, jamais liste.
  kind      text COLLATE "C" NOT NULL DEFAULT 'group' CHECK (kind IN ('group','token')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_role_id_tenant UNIQUE (id, tenant_id)
);
CREATE UNIQUE INDEX uq_role_name_live  ON _basedb.role (tenant_id, name)      WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_role_label_live ON _basedb.role (tenant_id, label_key) WHERE deleted_at IS NULL;

CREATE TABLE _basedb.role_member (
  role_id    uuid NOT NULL REFERENCES _basedb.role(id)     ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  granted_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, user_id)
);

CREATE TABLE _basedb.permission (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  role_id uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE CASCADE,
  scope_kind text NOT NULL
    CHECK (scope_kind IN ('tenant','project','base','application','table')),
  scope_project_id     uuid NULL REFERENCES _basedb.project(id)     ON DELETE CASCADE,
  scope_base_id        uuid NULL REFERENCES _basedb.base(id)        ON DELETE CASCADE,
  scope_application_id uuid NULL REFERENCES _basedb.application(id) ON DELETE CASCADE,
  scope_table_id       uuid NULL REFERENCES _basedb.table_def(id)   ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN
    ('read','create','update','delete','manage_schema','manage_permissions','manage_tokens')),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  granted_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_permission_scope CHECK (
    num_nonnulls(scope_project_id, scope_base_id, scope_application_id, scope_table_id)
      = CASE scope_kind WHEN 'tenant' THEN 0 ELSE 1 END
    AND (scope_kind <> 'project'     OR scope_project_id     IS NOT NULL)
    AND (scope_kind <> 'base'        OR scope_base_id        IS NOT NULL)
    AND (scope_kind <> 'application' OR scope_application_id IS NOT NULL)
    AND (scope_kind <> 'table'       OR scope_table_id       IS NOT NULL)),
  CONSTRAINT uq_permission UNIQUE NULLS NOT DISTINCT
    (role_id, scope_kind, scope_project_id, scope_base_id, scope_application_id,
     scope_table_id, action)
);

CREATE TABLE _basedb.field_permission (
  id       uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  role_id  uuid NOT NULL REFERENCES _basedb.role(id)  ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES _basedb.field(id) ON DELETE CASCADE,
  access   text NOT NULL CHECK (access IN ('hidden','read','write')),
  CONSTRAINT uq_field_permission UNIQUE (role_id, field_id)
);
```

**La portée d'une permission n'est pas polymorphe.** `permission` est la table la plus sensible du catalogue ; un `scope_id uuid` sans clé étrangère autoriserait une permission désignant un objet inexistant, ou une base purgée puis un homonyme recréé. Les quatre colonnes typées portent chacune une vraie clé étrangère `ON DELETE CASCADE` ; `scope_kind` subsiste parce que l'API et l'interface raisonnent dessus, et `ck_permission_scope` garantit qu'il ne peut pas mentir. `UNIQUE NULLS NOT DISTINCT` est indispensable : sans lui, deux permissions identiques de portée `tenant` seraient réputées distinctes et insérables en double.

La sémantique — additivité, absence de règle `deny`, résolution de l'effectif, signature du décideur d'autorisation et prédicat de lignes constamment vrai (A20) — appartient au chapitre 05. Le catalogue ne connaît que les lignes.

---

## Domaine 3 — Structure

### Projets, bases, schémas, alias

```sql
CREATE TABLE _basedb.project (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  label       text NOT NULL,
  label_key   text COLLATE "C" NOT NULL,
  description text NULL,
  position    integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_project_id_tenant UNIQUE (id, tenant_id)   -- cible : base
);
CREATE UNIQUE INDEX uq_project_label_live
  ON _basedb.project (tenant_id, label_key) WHERE deleted_at IS NULL;

CREATE TABLE _basedb.base (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  project_id  uuid NOT NULL,
  label       text NOT NULL,
  label_key   text COLLATE "C" NOT NULL,
  description text NULL,
  -- Apparence : celle d'une option de liste (chapitre 04 §3), memes bornes.
  color       text NULL,                  -- #rrggbb, minuscules
  icon        text NULL,                  -- nom d'un pictogramme de la bibliotheque de l'interface
  image       text NULL,                  -- URL https ou data URL, 16 384 caracteres au plus
  definition_state text NOT NULL DEFAULT 'active'
                     CHECK (definition_state IN ('pending','active')),
  catalog_version bigint NOT NULL DEFAULT 1,
  lock_key    integer NOT NULL DEFAULT nextval('_basedb.lock_key_seq'),
  mcp_enabled boolean NOT NULL DEFAULT true,
  structure_state text NOT NULL DEFAULT 'open'
                    CHECK (structure_state IN ('open','frozen')),
  current_migration_id uuid NULL,     -- FK ajoutee apres la creation de migration
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  is_live    boolean NOT NULL DEFAULT true,
  purged_at  timestamptz NULL,
  purged_by  uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  is_purged  boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_base_lock_key  UNIQUE (lock_key),
  CONSTRAINT uq_base_id_tenant UNIQUE (id, tenant_id),   -- cible : api_token
  CONSTRAINT uq_base_id_live   UNIQUE (id, is_live),     -- cible : table_def
  -- Un projet et ses bases appartiennent au meme tenant.
  CONSTRAINT fk_base_project FOREIGN KEY (project_id, tenant_id)
    REFERENCES _basedb.project (id, tenant_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_base_live  CHECK (is_live = (deleted_at IS NULL)),
  CONSTRAINT ck_base_purge CHECK (is_purged = (purged_at IS NOT NULL)
                                  AND (purged_at IS NULL OR deleted_at IS NOT NULL)),
  CONSTRAINT ck_base_color CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_base_icon  CHECK (icon IS NULL OR icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT ck_base_image CHECK (image IS NULL OR char_length(image) <= 16384),
  CONSTRAINT ck_base_glyph CHECK (icon IS NULL OR image IS NULL)
);
CREATE UNIQUE INDEX uq_base_label_live
  ON _basedb.base (project_id, label_key) WHERE deleted_at IS NULL;

COMMENT ON COLUMN _basedb.base.catalog_version IS
  'Incremente a chaque migration appliquee. Les processus API comparent ce compteur
   avant de servir un schema memorise ; un NOTIFY basedb_catalog les reveille.';
COMMENT ON COLUMN _basedb.base.structure_state IS
  'frozen : une derive bloquante a ete constatee. Les lectures et ecritures de donnees
   restent servies ; les operations de structure sont suspendues sur cette base seule.';

CREATE TABLE _basedb.db_schema (
  id       uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id  uuid NOT NULL,
  base_is_live boolean NOT NULL DEFAULT true,
  role     text NOT NULL CHECK (role IN ('current','alias')),
  name_id  uuid NOT NULL,
  name_scope_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  lock_key integer NOT NULL DEFAULT nextval('_basedb.lock_key_seq'),
  -- Alias de compatibilite : compteurs d'acces APPLICATIFS uniquement.
  drop_after         timestamptz NULL,
  dropped_at         timestamptz NULL,
  app_last_access_at timestamptz NULL,
  app_access_count   bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schema_base FOREIGN KEY (base_id, base_is_live)
    REFERENCES _basedb.base (id, is_live) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_schema_name FOREIGN KEY (name_id, name_scope_id)
    REFERENCES _basedb.physical_name (id, scope_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_schema_name_scope CHECK
    (name_scope_id = '00000000-0000-0000-0000-000000000001'::uuid),
  CONSTRAINT ck_schema_alias CHECK (role = 'alias' OR drop_after IS NULL),
  CONSTRAINT uq_schema_name    UNIQUE (name_id),
  CONSTRAINT uq_schema_lock    UNIQUE (lock_key),
  CONSTRAINT uq_schema_id_base UNIQUE (id, base_id)      -- cible : table_def
);
-- Une base possede exactement un schema courant vivant.
CREATE UNIQUE INDEX uq_schema_current
  ON _basedb.db_schema (base_id) WHERE role = 'current' AND dropped_at IS NULL;

CREATE TABLE _basedb.sql_view_alias (
  id              uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  schema_id       uuid NOT NULL REFERENCES _basedb.db_schema(id) ON DELETE RESTRICT,
  target_table_id uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE RESTRICT,
  name_id         uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  dropped_at timestamptz NULL,
  CONSTRAINT uq_view_alias_name UNIQUE (name_id)
);
```

**Le projet regroupe des bases ; il n'a aucune existence physique.** Une base reste un schéma PostgreSQL, et un projet n'est qu'une ligne du catalogue : il ne change ni le nom d'un schéma, ni celui d'une table, et déplacer une base d'un projet à un autre ne touche pas une ligne de données. Il est à la fois l'unité de navigation de l'interface — on choisit un projet, puis on y crée des bases et, dans chaque base, des tables — et une **portée de permission** au-dessus de la base (chapitre 05 §15). Le libellé d'une base est unique dans son projet, non plus dans le tenant ; le nom physique, lui, reste alloué à l'échelle de l'instance par la boucle de suffixes du chapitre 01.

C'est le **schéma**, et non la base, qui porte l'espace de noms des relations (chapitre 01 §6.2) : un schéma d'alias contient des vues SQL portant exactement les noms des tables du schéma courant, et cette reprise ne serait pas exprimable si la portée d'unicité était la base. Le cycle de vie des alias — création, durée de vie, avertissement au renommage — appartient au chapitre 06.

**Les compteurs d'accès aux alias ne mesurent que ce qui passe par l'application, et leur nom le dit.** L'exécution d'un `SELECT` sur une vue ne laisse aucune trace exploitable dans le périmètre de privilèges retenu : les vues n'apparaissent pas dans `pg_stat_user_tables`, et `pg_stat_statements` comme `pgaudit` exigent `shared_preload_libraries`. L'écran de renommage liste donc les jetons actifs, les webhooks abonnés et les rôles ayant lu le schéma sur 30 jours, et **avertit que les connexions SQL directes ne sont pas observables** au lieu de laisser croire l'inverse. *Alternative rejetée* : rendre la vue d'alias écrivante par un appel en `InitPlan`, qui place une écriture sur un chemin de lecture et interdit toute transaction `READ ONLY`.

### Tables

```sql
CREATE TABLE _basedb.table_def (
  id           uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id      uuid NOT NULL,
  base_is_live boolean NOT NULL DEFAULT true,
  schema_id    uuid NOT NULL,
  name_id      uuid NOT NULL,
  label        text NOT NULL,
  label_key    text COLLATE "C" NOT NULL,
  description  text NULL,
  color        text NULL,                 -- apparence, bornee comme celle d'une base
  icon         text NULL,
  image        text NULL,
  position     integer NOT NULL DEFAULT 0,
  definition_state text NOT NULL DEFAULT 'active'
                     CHECK (definition_state IN ('pending','active')),
  lock_key     integer NOT NULL DEFAULT nextval('_basedb.lock_key_seq'),

  display_field_id             uuid    NULL,
  display_field_kind           text    NULL,
  display_field_is_live        boolean NULL,
  display_field_can_be_display boolean NULL,

  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  is_live    boolean NOT NULL DEFAULT true,
  purged_at  timestamptz NULL,
  purged_by  uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  is_purged  boolean NOT NULL DEFAULT false,

  -- La table appartient a une base, et une table vivante exige une base vivante.
  CONSTRAINT fk_table_base FOREIGN KEY (base_id, base_is_live)
    REFERENCES _basedb.base (id, is_live) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_table_base_live CHECK (base_is_live OR deleted_at IS NOT NULL),
  -- Le schema est un schema de cette base ...
  CONSTRAINT fk_table_schema FOREIGN KEY (schema_id, base_id)
    REFERENCES _basedb.db_schema (id, base_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  -- ... et le nom est alloue sous la portee de ce schema-la.
  CONSTRAINT fk_table_name FOREIGN KEY (name_id, schema_id)
    REFERENCES _basedb.physical_name (id, scope_id) ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT uq_table_name         UNIQUE (name_id),
  CONSTRAINT uq_table_lock         UNIQUE (lock_key),
  CONSTRAINT uq_table_id_base_live UNIQUE (id, base_id, is_live),  -- cible : field, lien
  CONSTRAINT uq_table_id_base      UNIQUE (id, base_id),
  CONSTRAINT ck_table_live  CHECK (is_live = (deleted_at IS NULL)),
  CONSTRAINT ck_table_purge CHECK (is_purged = (purged_at IS NOT NULL)
                                   AND (purged_at IS NULL OR deleted_at IS NOT NULL)),
  CONSTRAINT ck_display_pair CHECK (
    num_nonnulls(display_field_id, display_field_kind,
                 display_field_is_live, display_field_can_be_display) IN (0, 4)),
  CONSTRAINT ck_display_live CHECK (display_field_id IS NULL OR display_field_is_live),
  CONSTRAINT ck_display_kind CHECK (display_field_id IS NULL OR display_field_can_be_display),
  CONSTRAINT ck_table_color CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_table_icon  CHECK (icon IS NULL OR icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT ck_table_image CHECK (image IS NULL OR char_length(image) <= 16384),
  CONSTRAINT ck_table_glyph CHECK (icon IS NULL OR image IS NULL)
);
CREATE UNIQUE INDEX uq_table_label_live
  ON _basedb.table_def (base_id, label_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_table_by_base
  ON _basedb.table_def (base_id, position) WHERE deleted_at IS NULL;
```

`fk_table_base` fait trois choses d'un coup : la table appartient à une base existante, une base ne peut pas être épurée tant qu'une table la référence, et **supprimer logiquement une base dont une table est encore vivante est refusé par la base de données**, avec le nom `ck_table_base_live`, que le service traduit en `BASE_NOT_EMPTY`.

**Une base et une table ont une apparence**, celle d'une option de liste (chapitre 04 §3, « Apparence des options ») : une couleur, et un pictogramme ou une image, jamais les deux, tenus par les mêmes contraintes. Elle ne vit qu'au catalogue — ni le schéma ni la table PostgreSQL n'en savent rien — et la changer n'écrit rien d'autre qu'une ligne du catalogue.

### Champs

Le type d'un champ est **immuable**. Changer de type, c'est créer un champ, recopier, supprimer l'ancien — une migration explicite dont `field.superseded_by_field_id` garde la trace. Cette immuabilité est ce qui autorise la dénormalisation de `kind` dans les satellites et dans `table_def`, donc les contraintes déclaratives qui suivent.

```sql
CREATE TABLE _basedb.field_kind (
  code           text COLLATE "C" PRIMARY KEY,
  label          text NOT NULL,
  can_be_display boolean NOT NULL,
  has_config     boolean NOT NULL,     -- le type possede-t-il une table satellite
  CONSTRAINT uq_kind_displayable UNIQUE (code, can_be_display)   -- cible : table_def
);
INSERT INTO _basedb.field_kind (code, label, can_be_display, has_config) VALUES
 ('short_text','Texte court',    true,  true),
 ('long_text', 'Texte long',     false, true),
 ('number',    'Nombre',         true,  true),
 ('boolean',   'Booleen',        false, true),
 ('date',      'Date',           true,  true),
 ('datetime',  'Date-heure',     true,  true),
 ('select',    'Liste de choix', true,  true),
 ('multi_select', 'Choix multiple', false, true),
 ('link',      'Lien',           false, true),
 ('formula',   'Formule',        true,  true),
 ('file',      'Document',       false, true),
 ('image',     'Image',          false, true);

CREATE TABLE _basedb.field (
  id            uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  table_id      uuid NOT NULL,
  base_id       uuid NOT NULL,
  table_is_live boolean NOT NULL DEFAULT true,
  kind          text COLLATE "C" NOT NULL REFERENCES _basedb.field_kind(code)
                  ON DELETE RESTRICT ON UPDATE RESTRICT,
  name_id       uuid NOT NULL,
  label         text NOT NULL,
  label_key     text COLLATE "C" NOT NULL,
  description   text NULL,
  position      integer NOT NULL DEFAULT 0,

  is_required     boolean NOT NULL DEFAULT false,
  required_state  text NOT NULL DEFAULT 'absent'
                    REFERENCES _basedb.physical_state(code) ON UPDATE RESTRICT,
  is_sortable     boolean NOT NULL DEFAULT true,
  is_searchable   boolean NOT NULL DEFAULT false,
  expose_to_agents boolean NOT NULL DEFAULT true,
  superseded_by_field_id uuid NULL REFERENCES _basedb.field(id) ON DELETE RESTRICT,
  definition_state text NOT NULL DEFAULT 'active'
                     CHECK (definition_state IN ('pending','active')),

  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  is_live    boolean NOT NULL DEFAULT true,
  purged_at  timestamptz NULL,
  purged_by  uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  is_purged  boolean NOT NULL DEFAULT false,

  -- Le champ appartient a une table de sa propre base, et un champ vivant exige
  -- une table vivante. Une seule contrainte porte les trois invariants.
  CONSTRAINT fk_field_table FOREIGN KEY (table_id, base_id, table_is_live)
    REFERENCES _basedb.table_def (id, base_id, is_live)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_field_table_live CHECK (table_is_live OR deleted_at IS NOT NULL),
  -- Le nom est alloue sous la portee de cette table-la.
  CONSTRAINT fk_field_name FOREIGN KEY (name_id, table_id)
    REFERENCES _basedb.physical_name (id, scope_id) ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT uq_field_name                UNIQUE (name_id),
  CONSTRAINT uq_field_id_kind             UNIQUE (id, kind),
  CONSTRAINT uq_field_id_kind_base_req    UNIQUE (id, kind, base_id, is_required),
  CONSTRAINT uq_field_id_table            UNIQUE (id, table_id),
  CONSTRAINT uq_field_id_table_kind_live  UNIQUE (id, table_id, kind, is_live),
  CONSTRAINT uq_field_id_table_purged     UNIQUE (id, table_id, is_purged),

  CONSTRAINT ck_field_live  CHECK (is_live = (deleted_at IS NULL)),
  CONSTRAINT ck_field_purge CHECK (is_purged = (purged_at IS NOT NULL)
                                   AND (purged_at IS NULL OR deleted_at IS NOT NULL)),
  CONSTRAINT ck_field_superseded CHECK (superseded_by_field_id IS NULL
                                        OR superseded_by_field_id <> id)
);
CREATE UNIQUE INDEX uq_field_label_live
  ON _basedb.field (table_id, label_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_field_by_table
  ON _basedb.field (table_id, position) WHERE deleted_at IS NULL;
```

Les cinq contraintes `UNIQUE (id, …)` sont redondantes avec la clé primaire ; elles n'existent que pour servir de cible à des clés étrangères composites. Leur coût est de cinq index sur une table dont les écritures sont rares et les lectures massives : c'est ce qui permet de tenir la moitié du tableau des invariants sans une ligne de code.

**Il n'y a pas de colonne `default_expr`.** Stocker une expression SQL libre pour l'injecter dans du DDL généré serait la seule construction du document garantie par rien d'autre qu'une validation en code. *Hors périmètre v1* ; le jour où les valeurs par défaut entreront, ce sera sous forme de **littéral typé** dans le satellite du type concerné, jamais d'expression.

**Matérialisation de `is_required`.** Le passage à vrai suit la recette du chapitre 03 : `ADD CONSTRAINT ck_…__not_null CHECK (col IS NOT NULL) NOT VALID`, `VALIDATE CONSTRAINT`, `SET NOT NULL`, puis `DROP CONSTRAINT`. L'échafaudage est une ligne ordinaire de `table_constraint` ; `field.required_state` suit le plan étape par étape. Aucune colonne ne stocke le nom de l'échafaudage : il est au registre, comme tous les autres.

### Configuration par type : satellites 1:1, pas de `jsonb`

**Décision : les paramètres propres à un type vivent dans une table satellite par famille de types, en colonnes réelles, dont la clé primaire est la clé étrangère vers `field`.** *Alternative rejetée* : une colonne `config jsonb` sur `field`, plus courte à écrire, mais qui rend impossible la seule chose qui compte ici — que la cible d'un champ lien soit une **vraie** clé étrangère vers `table_def`.

La clé étrangère composite `(field_id, kind)` empêche d'attacher une configuration « nombre » à un champ texte et, le type étant immuable, rend la ligne satellite structurellement indissociable de son champ.

```sql
CREATE TABLE _basedb.field_text_config (
  field_id     uuid PRIMARY KEY,
  kind         text COLLATE "C" NOT NULL CHECK (kind IN ('short_text','long_text')),
  max_length   integer NULL CHECK (max_length IS NULL OR max_length > 0),
  is_multiline boolean NOT NULL DEFAULT false,
  is_rich      boolean NOT NULL DEFAULT false,
  sanitizer_profile text NOT NULL DEFAULT 'none'
    CHECK (sanitizer_profile IN ('none','basic','rich')),
  CONSTRAINT fk_text_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT ck_text_rich      CHECK (NOT is_rich OR kind = 'long_text'),
  CONSTRAINT ck_text_multiline CHECK (NOT is_multiline OR kind = 'long_text'),
  CONSTRAINT ck_text_sanitizer CHECK (is_rich = (sanitizer_profile <> 'none'))
);

CREATE TABLE _basedb.field_number_config (
  field_id  uuid PRIMARY KEY,
  kind      text COLLATE "C" NOT NULL DEFAULT 'number' CHECK (kind = 'number'),
  precision smallint NOT NULL DEFAULT 18 CHECK (precision BETWEEN 1 AND 38),
  scale     smallint NOT NULL DEFAULT 2  CHECK (scale BETWEEN 0 AND 10),
  min_value numeric NULL,
  max_value numeric NULL,
  display_format text NOT NULL DEFAULT 'decimal'
    CHECK (display_format IN ('decimal','integer','percent','currency')),
  currency_code  text COLLATE "C" NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT fk_number_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT ck_number_scale  CHECK (scale <= precision),
  CONSTRAINT ck_number_bounds CHECK (min_value IS NULL OR max_value IS NULL
                                     OR min_value <= max_value),
  CONSTRAINT ck_number_currency
    CHECK ((display_format = 'currency') = (currency_code IS NOT NULL))
);

CREATE TABLE _basedb.field_datetime_config (
  field_id       uuid PRIMARY KEY,
  kind           text COLLATE "C" NOT NULL CHECK (kind IN ('date','datetime')),
  timezone_mode  text NOT NULL DEFAULT 'utc' CHECK (timezone_mode IN ('utc','fixed')),
  fixed_timezone text NULL,
  display_format text NOT NULL DEFAULT 'iso',
  CONSTRAINT fk_datetime_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT ck_datetime_tz CHECK ((timezone_mode = 'fixed') = (fixed_timezone IS NOT NULL)),
  CONSTRAINT ck_datetime_tz_kind CHECK (kind = 'datetime' OR timezone_mode = 'utc')
);

CREATE TABLE _basedb.field_boolean_config (
  field_id     uuid PRIMARY KEY,
  kind         text COLLATE "C" NOT NULL DEFAULT 'boolean' CHECK (kind = 'boolean'),
  -- Cote indexe : un index partiel sur la valeur minoritaire, ou aucun index.
  indexed_side text NOT NULL DEFAULT 'none' CHECK (indexed_side IN ('none','true','false')),
  CONSTRAINT fk_boolean_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE _basedb.field_select_config (
  field_id uuid PRIMARY KEY,
  kind     text COLLATE "C" NOT NULL DEFAULT 'select'
             CHECK (kind IN ('select','multi_select')),
  enum_constraint_id uuid NOT NULL REFERENCES _basedb.table_constraint(id)
                       ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_select_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT uq_select_enum UNIQUE (enum_constraint_id)
);

CREATE TABLE _basedb.field_file_config (
  field_id uuid PRIMARY KEY,
  kind     text COLLATE "C" NOT NULL CHECK (kind IN ('file','image')),
  -- `ck_<table>__<colonne>__files` : la forme de la colonne `jsonb` (chapitre 04 §3 bis).
  shape_constraint_id uuid NOT NULL REFERENCES _basedb.table_constraint(id)
                        ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_file_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT uq_file_shape UNIQUE (shape_constraint_id)
);

CREATE TABLE _basedb.field_formula_config (
  field_id    uuid PRIMARY KEY,
  kind        text COLLATE "C" NOT NULL DEFAULT 'formula' CHECK (kind = 'formula'),
  input_expression text NOT NULL,   -- expression saisie, langage propre a basedb
  ast         jsonb NOT NULL,       -- forme canonique de l'arbre syntaxique (chapitre 04)
  result_kind text COLLATE "C" NOT NULL REFERENCES _basedb.field_kind(code)
                ON DELETE RESTRICT ON UPDATE RESTRICT,
  is_stored   boolean NOT NULL DEFAULT true,
  CONSTRAINT fk_formula_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT ck_formula_result
    CHECK (result_kind NOT IN ('formula','link','multi_select','file','image'))
);

CREATE TABLE _basedb.select_option (
  id         uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  field_id   uuid NOT NULL REFERENCES _basedb.field(id) ON DELETE CASCADE,
  value      text COLLATE "C" NOT NULL,   -- valeur stockee dans la colonne PostgreSQL
  label      text NOT NULL,
  color      text NULL,                   -- #rrggbb, minuscules
  icon       text NULL,                   -- nom d'un pictogramme de la bibliotheque de l'interface
  image      text NULL,                   -- URL https ou data URL, 16 384 caracteres au plus
  position   integer NOT NULL,
  deleted_at timestamptz NULL,
  CONSTRAINT ck_option_color CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_option_icon  CHECK (icon IS NULL OR icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT ck_option_image CHECK (image IS NULL OR char_length(image) <= 16384),
  CONSTRAINT ck_option_glyph CHECK (icon IS NULL OR image IS NULL)
);
CREATE UNIQUE INDEX uq_option_value_live
  ON _basedb.select_option (field_id, value) WHERE deleted_at IS NULL;

CREATE TABLE _basedb.field_formula_dependency (
  formula_field_id     uuid NOT NULL,
  depends_on_field_id  uuid NOT NULL,
  table_id             uuid NOT NULL,           -- partage : force la meme table
  formula_is_purged    boolean NOT NULL DEFAULT false,
  depends_on_is_purged boolean NOT NULL DEFAULT false,
  PRIMARY KEY (formula_field_id, depends_on_field_id),
  CONSTRAINT fk_dep_formula FOREIGN KEY (formula_field_id, table_id, formula_is_purged)
    REFERENCES _basedb.field (id, table_id, is_purged)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dep_source FOREIGN KEY (depends_on_field_id, table_id, depends_on_is_purged)
    REFERENCES _basedb.field (id, table_id, is_purged)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_dep_purge_order CHECK (NOT depends_on_is_purged OR formula_is_purged),
  CONSTRAINT ck_dep_not_self    CHECK (formula_field_id <> depends_on_field_id)
);
```

Quatre précisions.

**La présence ou l'absence de l'heure n'est pas dupliquée** : elle est portée par `kind` (`date` ou `datetime`) et par rien d'autre. *Alternative rejetée* : une colonne `with_time boolean`, qui autorise la combinaison absurde `kind = 'date'` + heure. Les chapitres qui attendent un tel drapeau lisent `kind = 'datetime'`.

**Le choix multiple est un type, pas un drapeau** : `select` est une colonne `text`, `multi_select` une colonne `text[]`, et les deux partagent `field_select_config` et `select_option`. Aucune colonne `is_multiple` n'existe — le type étant immuable, un drapeau qui changerait le type physique de la colonne serait un second `kind` déguisé. Le « plusieurs vers plusieurs » reste hors périmètre v1, comme la relation « un vers un », qui n'est que l'unicité d'un champ lien et ne constitue pas un type de relation distinct.

**Un document ou une image n'est pas stocké dans la table.** La colonne `jsonb` d'un champ `file` ou `image` porte la liste des fichiers — identifiant, nom, type, taille — et les octets vivent dans le stockage de fichiers de l'instance (chapitre 04 §3 bis). `field_file_config` ne porte que la contrainte de forme, dont le nom est au registre comme toute contrainte système.

**`field_formula_config.ast` est la seule colonne `jsonb` qui alimente du DDL.** Elle le peut parce qu'elle n'est pas une chaîne libre : c'est la forme canonique produite par l'analyseur du chapitre 04, et **toute référence qu'elle contient est doublée d'une ligne typée** dans `field_formula_dependency`. C'est cette ligne, et non le `jsonb`, qui porte la garantie référentielle.

**`field_formula_dependency` porte `table_id` une seule fois**, partagé par les deux clés étrangères : une formule v1 ne dépend que de champs de sa propre table, conséquence directe du choix de matérialiser les formules stockées par une colonne générée. Le couple de miroirs avec `ck_dep_purge_order` exprime l'invariant utile : purger un champ dont dépend une formule encore vivante est refusé, et le devient dès que la formule elle-même est purgée.

**Présence obligatoire du satellite.** Un champ de type `link` sans ligne dans `field_link_config` est un champ lien sans cible : le moteur ne peut rien en faire. La règle vaut pour tout `kind` dont `field_kind.has_config` est vrai. C'est une contrainte d'existence (« au moins une ligne ») que PostgreSQL ne sait pas déclarer ; elle est portée par un déclencheur de contrainte différé, listé dans « Les déclencheurs du catalogue ».

### Fichiers déposés

Un fichier est déposé **pour un champ** avant d'être écrit dans une ligne : le dépôt rend un identifiant, et c'est cet identifiant que l'écriture de la ligne cite. Le noyau n'accepte dans la colonne que des identifiants déposés pour **ce** champ, et recopie depuis cette table le nom, le type et la taille — ce que la ligne affiche ne vient donc jamais du client.

```sql
CREATE TABLE _basedb.stored_file (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id     uuid NOT NULL REFERENCES _basedb.base(id)  ON DELETE CASCADE,
  field_id    uuid NOT NULL REFERENCES _basedb.field(id) ON DELETE CASCADE,
  storage_key text COLLATE "C" NOT NULL,   -- clé dans le stockage de fichiers, jamais montrée
  name        text NOT NULL,               -- nom d'origine, affiché et proposé au téléchargement
  mime_type   text COLLATE "C" NOT NULL,
  size_bytes  bigint NOT NULL,
  sha256      text COLLATE "C" NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by  uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_stored_file_key  UNIQUE (storage_key),
  CONSTRAINT ck_stored_file_name CHECK (char_length(name) BETWEEN 1 AND 255),
  CONSTRAINT ck_stored_file_mime CHECK (mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  CONSTRAINT ck_stored_file_size CHECK (size_bytes >= 0),
  CONSTRAINT ck_stored_file_hash CHECK (sha256 ~ '^[0-9a-f]{64}$')
);
```

**Aucune clé étrangère ne va de la table utilisateur vers `stored_file`** : elle traverserait la frontière `_basedb` (A9). Un fichier retiré d'une ligne reste donc au catalogue et dans le stockage ; les rattacher à nouveau à leurs lignes, puis purger ceux qui n'en ont plus, relève d'une épuration à venir, pas de l'écriture.

### Contraintes et index des tables utilisateur

Tout objet dérivé nommé d'une table utilisateur a une ligne de catalogue, un nom au registre et un état physique. C'est ce qui rend calculables la réconciliation, la reprise d'une étape interrompue, et la connaissance — exigée par le chapitre 05 — des colonnes qui composent une contrainte composite.

```sql
CREATE TABLE _basedb.table_constraint (
  id       uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  table_id uuid NOT NULL,
  base_id  uuid NOT NULL,
  kind     text NOT NULL CHECK (kind IN ('primary_key','foreign_key','unique','check')),
  name_id  uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  rule     text COLLATE "C" NULL,   -- suffixe <regle> d'un ck_ ; vocabulaire ferme, chapitre 04
  origin   text NOT NULL CHECK (origin IN ('system','user')),
  state    text NOT NULL DEFAULT 'pending'
             REFERENCES _basedb.physical_state(code) ON UPDATE RESTRICT,
  nulls_not_distinct boolean NOT NULL DEFAULT false,
  validate_attempts  integer NOT NULL DEFAULT 0,
  next_attempt_at    timestamptz NULL,
  state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  dropped_at timestamptz NULL,
  CONSTRAINT fk_constraint_table FOREIGN KEY (table_id, base_id)
    REFERENCES _basedb.table_def (id, base_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_constraint_name     UNIQUE (name_id),
  CONSTRAINT uq_constraint_id_table UNIQUE (id, table_id),
  CONSTRAINT ck_constraint_rule     CHECK ((rule IS NOT NULL) = (kind = 'check')),
  CONSTRAINT ck_constraint_nnd      CHECK (NOT nulls_not_distinct OR kind = 'unique')
);

CREATE TABLE _basedb.table_constraint_member (
  constraint_id uuid NOT NULL,
  field_id      uuid NOT NULL,
  table_id      uuid NOT NULL,          -- partage : force la meme table
  position      smallint NOT NULL,
  PRIMARY KEY (constraint_id, field_id),
  CONSTRAINT fk_member_constraint FOREIGN KEY (constraint_id, table_id)
    REFERENCES _basedb.table_constraint (id, table_id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_member_field FOREIGN KEY (field_id, table_id)
    REFERENCES _basedb.field (id, table_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_member_position UNIQUE (constraint_id, position)
);

CREATE TABLE _basedb.table_index (
  id       uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  table_id uuid NOT NULL,
  base_id  uuid NOT NULL,
  name_id  uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  method   text NOT NULL DEFAULT 'btree' CHECK (method IN ('btree','gin')),
  origin   text NOT NULL CHECK (origin IN ('system','user')),
  expression_kind text NULL CHECK (expression_kind IN ('fold','trigram')),
  predicate_kind  text NULL CHECK (predicate_kind IN ('not_null','true','false')),
  state    text NOT NULL DEFAULT 'pending'
             REFERENCES _basedb.physical_state(code) ON UPDATE RESTRICT,
  build_attempts integer NOT NULL DEFAULT 0,
  state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  dropped_at timestamptz NULL,
  CONSTRAINT fk_index_table FOREIGN KEY (table_id, base_id)
    REFERENCES _basedb.table_def (id, base_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_index_name     UNIQUE (name_id),
  CONSTRAINT uq_index_id_table UNIQUE (id, table_id)
);

CREATE TABLE _basedb.table_index_member (
  index_id  uuid NOT NULL,
  field_id  uuid NOT NULL,
  table_id  uuid NOT NULL,
  position  smallint NOT NULL,
  direction text NOT NULL DEFAULT 'asc' CHECK (direction IN ('asc','desc')),
  PRIMARY KEY (index_id, field_id),
  CONSTRAINT fk_ixmember_index FOREIGN KEY (index_id, table_id)
    REFERENCES _basedb.table_index (id, table_id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_ixmember_field FOREIGN KEY (field_id, table_id)
    REFERENCES _basedb.field (id, table_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_ixmember_position UNIQUE (index_id, position)
);
```

- Une contrainte d'unicité est adossée à un index créé par PostgreSQL et portant le nom de la contrainte : elle n'a donc **pas** de ligne dans `table_index`.
- Le `CHECK` de liste de choix est une ligne `table_constraint` de `kind = 'check'`, `rule = 'enum'`, à un membre, référencée par `field_select_config.enum_constraint_id`. Il est régénéré à chaque modification des options, en deux temps : `DROP` puis `ADD … NOT VALID` dans l'étape de structure (verrou bref, aucun balayage, contrainte applicable immédiatement aux écritures), puis `VALIDATE CONSTRAINT` dans une étape séparée. Un ajout d'option ne peut pas invalider de ligne existante ; un retrait exige la validation, et l'échantillon des lignes fautives remonte à l'utilisateur. *Alternative rejetée : le type `ENUM` PostgreSQL* — on ne peut pas en retirer une valeur, c'est un objet partagé dont l'évolution est transverse à des tables que l'utilisateur n'a pas touchées, et sa modification le verrouille pour tous ses usagers.
- Une colonne de lien porte systématiquement un index `ix_<table>__<colonne>` (`origin = 'system'`) : PostgreSQL n'indexe que le côté référencé, et sans lui chaque suppression d'une ligne cible impose un parcours complet de la table source. Un index demandé sur une colonne déjà indexée d'office est satisfait par l'index existant — la règle de déduplication du chapitre 01 §9.2 porte sur la colonne de tête.

### Champs lien

```sql
CREATE TABLE _basedb.field_link_config (
  field_id        uuid PRIMARY KEY,
  kind            text COLLATE "C" NOT NULL DEFAULT 'link' CHECK (kind = 'link'),
  base_id         uuid NOT NULL,
  is_required     boolean NOT NULL,                 -- miroir de field.is_required
  target_table_id uuid NOT NULL,
  target_is_live  boolean NOT NULL DEFAULT true,    -- miroir de table_def.is_live

  fk_constraint_id uuid NOT NULL REFERENCES _basedb.table_constraint(id) ON DELETE RESTRICT,
  fk_index_id      uuid NOT NULL REFERENCES _basedb.table_index(id)      ON DELETE RESTRICT,
  fk_dropped_at    timestamptz NULL,

  on_delete text NOT NULL DEFAULT 'restrict'
            CHECK (on_delete IN ('restrict','set_null','cascade')),
  cascade_grant_id uuid NULL REFERENCES _basedb.cascade_grant(id) ON DELETE RESTRICT,

  CONSTRAINT fk_link_field FOREIGN KEY (field_id, kind, base_id, is_required)
    REFERENCES _basedb.field (id, kind, base_id, is_required)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- La cible est une table de la MEME base ; elle ne peut etre ni purgee ni
  -- supprimee logiquement tant qu'un lien actif la designe.
  CONSTRAINT fk_link_target FOREIGN KEY (target_table_id, base_id, target_is_live)
    REFERENCES _basedb.table_def (id, base_id, is_live)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_link_target_live CHECK (target_is_live OR fk_dropped_at IS NOT NULL),
  CONSTRAINT ck_link_set_null_nullable
    CHECK (on_delete <> 'set_null' OR is_required = false),
  CONSTRAINT ck_link_cascade_granted
    CHECK (on_delete <> 'cascade' OR cascade_grant_id IS NOT NULL),
  CONSTRAINT uq_link_fk_constraint UNIQUE (fk_constraint_id),
  CONSTRAINT uq_link_fk_index      UNIQUE (fk_index_id)
);
CREATE INDEX idx_link_target
  ON _basedb.field_link_config (target_table_id) WHERE fk_dropped_at IS NULL;

CREATE TABLE _basedb.cascade_grant (
  id         uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id    uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE RESTRICT,
  granted_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  challenge_id uuid NULL REFERENCES _basedb.confirmation_challenge(id) ON DELETE RESTRICT,
  confirmation_text text NOT NULL,
  reason     text NULL,
  CONSTRAINT ck_cascade_confirmation CHECK (length(confirmation_text) > 0)
);
```

**Un champ lien est un champ ordinaire de la table source** : sa colonne physique *est* la colonne de clé étrangère, il n'y a pas de second nom à gérer. Son type PostgreSQL est `uuid`, imposé par la projection du `kind`, donc structurellement compatible avec `_id` de la cible : le cas « type source incompatible » n'est pas rattrapé, il est rendu impossible. Le nom de la colonne suit A7 et le chapitre 01 §9.3 — `<table_cible>_id`, puis le slug du libellé du champ suivi de `_id`, puis un suffixe numérique — et il est figé à la création. Aucune contrainte de catalogue ne le vérifie : le nom n'est plus une colonne de `field`, il est au registre, et son motif est une propriété de l'allocation.

**Un lien ne traverse jamais deux bases en v1** (`LINK_CROSS_DATABASE`). La clé étrangère `fk_link_target` le rend structurel, en partageant `base_id` entre les deux bouts.

**`ck_link_target_live` remplace un déclencheur, et un refus fiable remplace un refus probable.** Supprimer logiquement une table est un `UPDATE` ; la propagation `ON UPDATE CASCADE` écrit `target_is_live = false` dans toutes les lignes de `field_link_config` qui la désignent, où le `CHECK` refuse tant que la contrainte physique n'a pas été retirée. Le service traduit ce refus en `TABLE_REFERENCED` ; la charge utile et le message appartiennent au chapitre 03, la liste nommée des champs fautifs vient de la requête des liens inverses, et son filtrage par les permissions du lecteur au chapitre 05. *Alternative rejetée* : un déclencheur `BEFORE UPDATE`, qui sous `READ COMMITTED` laisse passer deux transactions concurrentes dont l'une supprime la table et l'autre crée un lien vers elle.

**Suppression logique d'un champ lien : la contrainte tombe immédiatement (A17).** Le moteur exécute `DROP CONSTRAINT`, supprime l'index, relègue la colonne et renseigne `fk_dropped_at`. Conserver la contrainte jusqu'à la purge laisserait un champ invisible partout continuer à refuser des suppressions de lignes dans une autre table, sans que rien dans l'interface n'explique le refus. Les données de la colonne sont conservées jusqu'à la purge ; restaurer le champ repasse par la validation complète.

**Autorisation d'un `ON DELETE CASCADE`.** La base garantit qu'aucun lien en cascade n'existe sans une ligne `cascade_grant` portant un auteur réel, un horodatage, un défi de confirmation consommé et un texte de confirmation non vide, et que cette ligne ne peut pas disparaître tant que le lien existe. Ce qu'elle **ne garantit pas**, et il faut le dire : que `granted_by` fût titulaire du rôle admin à cet instant. Un miroir vers `app_user.is_instance_admin` rendrait impossible toute rétrogradation ultérieure d'un administrateur. La vérification du rôle, l'élévation et la confirmation en deux temps relèvent du chapitre 05 ; la trace relève de `audit_log`. *La véracité de l'autorisation relève donc du service ; son existence, son auteur et son horodatage relèvent de la base.*

Conformément à A14, la clause `ON DELETE CASCADE` est réellement émise et la suppression en chaîne est celle de PostgreSQL : l'application n'implémente aucune cascade applicative, elle effectue un décompte des lignes atteintes et exige une confirmation avant d'exécuter.

### Colonne d'affichage

```sql
ALTER TABLE _basedb.table_def
  ADD CONSTRAINT fk_display_field
  FOREIGN KEY (display_field_id, id, display_field_kind, display_field_is_live)
  REFERENCES _basedb.field (id, table_id, kind, is_live)
  ON DELETE NO ACTION ON UPDATE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE _basedb.table_def
  ADD CONSTRAINT fk_display_kind
  FOREIGN KEY (display_field_kind, display_field_can_be_display)
  REFERENCES _basedb.field_kind (code, can_be_display)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
```

Le quadruplet garantit quatre choses d'un coup : le champ existe ; **il appartient bien à cette table** (grâce à `id` du côté référençant, comparé à `table_id` du côté référencé) ; il est vivant ; et son type est affichable, `field_kind.can_be_display` restant l'unique endroit où la règle d'affichabilité est écrite.

`NO ACTION` et non `RESTRICT`, parce que la contrainte est **différée** : `RESTRICT` n'est jamais différable, `NO ACTION` l'est. La vérification a donc lieu au `COMMIT`, ce qui permet d'écrire la table, ses champs et la désignation dans n'importe quel ordre à l'intérieur d'une même transaction.

Conformément à A15, et sans exception :

- **`display_field_id` est nullable, et l'absence de désignation est un état valide.** L'API renvoie alors `"display": null`, et l'interface affiche les huit premiers caractères de `_id`. Une table sans champ affichable ne bloque pas la création d'un lien vers elle.
- **Supprimer logiquement le champ désigné est refusé, pas compensé.** `is_live` faisant partie de la clé étrangère, passer le champ à `is_live = false` viole `fk_display_field` : refus nommé, traduit en **`DISPLAY_FIELD_IN_USE`**, avec invitation à désigner un autre champ d'abord.
- **Aucune bascule automatique n'existe, sous aucune forme.** Ni vers le champ suivant, ni vers `_id`. Une bascule changerait sans prévenir ce que voient tous les consommateurs de tous les liens pointant vers cette table, et elle réintroduirait un déclencheur là où une contrainte suffit. Le cadrage pose sur les relations la règle générale — mieux vaut un refus explicite qu'un effet silencieux — et elle s'applique ici sans nuance.
- **Désignation par défaut à la création** : le premier champ, dans l'ordre de `position`, dont le `kind` est `short_text` ; à défaut, le premier champ affichable ; à défaut, `NULL`.
- **Si le champ désigné est masqué pour le lecteur**, la valeur d'affichage n'est pas calculée : `"display": null`. La désignation est une propriété de la table, la visibilité une propriété du lecteur ; les confondre ferait de la valeur d'affichage un canal de fuite pour un champ explicitement masqué.
- **Si la table cible est illisible pour le lecteur**, la forme de réponse est celle de A16, identique dans le catalogue, l'API et le MCP :

```json
{ "client_id": { "id": null, "display": null, "masked": true } }
```

L'identifiant est masqué et non renvoyé en clair : un UUIDv7 porte un horodatage, qui révélerait la date de création d'une ligne d'une table que le lecteur n'a pas le droit de voir. Le filtre et le tri sur ce champ se réduisent à « renseigné » et « non renseigné ». Il n'existe aucun espace d'identifiants opaques calculés par HMAC : ni au catalogue, ni dans OpenAPI, ni dans le MCP.

### Liens inverses

Les lignes qui référencent une ligne donnée se déduisent intégralement de `field_link_config`. Aucune table de liaison, aucune colonne de configuration, aucun libellé à saisir : le libellé inverse affiché est `<label de la table source> · <label du champ>`, calculé à la lecture. Requête de référence, servie par `idx_link_target` :

```sql
-- « Quels champs lien pointent vers cette table ? » Sert trois usages : liens inverses
-- de la vue detail, refus de suppression d'une table referencee, description MCP.
SELECT f.id AS field_id, f.label AS field_label, fq.object_name AS fk_column,
       st.id AS source_table_id, st.label AS source_table_label,
       tq.qualified_name AS source_table, lc.on_delete
FROM _basedb.field_link_config lc
JOIN _basedb.field     f  ON f.id  = lc.field_id AND f.deleted_at  IS NULL
JOIN _basedb.table_def st ON st.id = f.table_id  AND st.deleted_at IS NULL
JOIN _basedb.v_physical_name_qualified fq ON fq.name_id = f.name_id
JOIN _basedb.v_physical_name_qualified tq ON tq.name_id = st.name_id
WHERE lc.target_table_id = $1 AND lc.fk_dropped_at IS NULL;
```

Le bornage de la restitution (nombre de blocs, de lignes, seuil de décompte) appartient au chapitre 04 ; le contrat HTTP au chapitre 08.

### Applications et vues enregistrées

```sql
CREATE TABLE _basedb.application (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE RESTRICT,
  label text NOT NULL,
  label_key text COLLATE "C" NOT NULL,
  name  text COLLATE "C" NOT NULL,
  icon  text NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_application_id_base UNIQUE (id, base_id)
);
CREATE UNIQUE INDEX uq_application_label_live
  ON _basedb.application (base_id, label_key) WHERE deleted_at IS NULL;

CREATE TABLE _basedb.application_table (
  application_id uuid NOT NULL,
  table_id       uuid NOT NULL,
  base_id        uuid NOT NULL,          -- partage : force la meme base
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (application_id, table_id),
  CONSTRAINT fk_apptable_application FOREIGN KEY (application_id, base_id)
    REFERENCES _basedb.application (id, base_id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_apptable_table FOREIGN KEY (table_id, base_id)
    REFERENCES _basedb.table_def (id, base_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE _basedb.view_def (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  table_id uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE RESTRICT,
  label text NOT NULL,
  label_key text COLLATE "C" NOT NULL,
  name  text COLLATE "C" NOT NULL,
  kind  text NOT NULL DEFAULT 'grid' CHECK (kind IN ('grid')),
  spec  jsonb NOT NULL DEFAULT '{}'::jsonb,   -- filtres, tri, largeurs, ordre des colonnes
  is_invalid boolean NOT NULL DEFAULT false,  -- un champ reference a disparu (chapitre 06)
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_view_label_live
  ON _basedb.view_def (table_id, label_key) WHERE deleted_at IS NULL;
```

Une **vue enregistrée** est une présentation, sans existence physique : elle reste au périmètre v1 et son régime de permission est celui de sa table, sans droit propre. Il n'existe pas de colonne `owner_user_id` : les vues sont partagées à l'échelle de la table, et les vues personnelles sont hors périmètre v1.

`application_table` porte `base_id` une seule fois, partagé par ses deux clés étrangères : rattacher à une application de la base X une table de la base Y est structurellement impossible.

---

## Domaine 4 — Intégrations et configuration

```sql
CREATE TABLE _basedb.api_token (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  label text NOT NULL,
  token_prefix text COLLATE "C" NOT NULL CHECK (length(token_prefix) = 8),
  token_hash bytea NOT NULL,          -- SHA-256 du secret ; le secret n'est jamais stocke
  role_id uuid NOT NULL,
  base_id uuid NULL,
  allowed_surfaces text[] NOT NULL DEFAULT ARRAY['rest']::text[],
  expires_at timestamptz NULL,        -- NULL : sans échéance, le défaut ; sinon un an au plus
  last_used_at timestamptz NULL,      -- ecriture bridee, non indexee
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  -- Suspension : reversible, contrairement a la revocation. Decidee EN DIFFERE.
  suspended_at     timestamptz NULL,
  suspended_reason text NULL,
  suspended_by     uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  -- Un jeton, son role et sa base appartiennent tous au meme tenant.
  CONSTRAINT fk_token_role FOREIGN KEY (role_id, tenant_id)
    REFERENCES _basedb.role (id, tenant_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_token_base FOREIGN KEY (base_id, tenant_id)
    REFERENCES _basedb.base (id, tenant_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_token_hash   UNIQUE (token_hash),
  CONSTRAINT ck_token_expiry CHECK (expires_at > created_at),
  CONSTRAINT ck_token_surfaces CHECK (
    allowed_surfaces <@ ARRAY['rest','mcp']::text[] AND array_length(allowed_surfaces,1) >= 1),
  CONSTRAINT ck_token_suspension CHECK (
    (suspended_at IS NULL) = (suspended_reason IS NULL)
    AND (suspended_by IS NULL OR suspended_at IS NOT NULL))
);
COMMENT ON COLUMN _basedb.api_token.suspended_at IS
  'Suspension automatique du jeton (TOKEN_SUSPENDED, chapitre 09), reversible : la levee
   depuis l''ecran Integrations remet les trois colonnes a NULL. La decision est prise
   EN DIFFERE, a partir de _basedb.security_log, par le meme processus qui draine les
   evenements. Aucune table de compteurs par fenetre glissante n''existe : elle mettrait
   une ecriture en base sur le chemin de chaque requete, ce que le chapitre 08 interdit.
   Les seaux a jetons de la limitation de debit restent en memoire de processus, avec
   l''approximation multi-instances assumee (A4). suspended_by porte l''utilisateur
   systeme quand la suspension est automatique, l''administrateur quand elle est manuelle.';

CREATE TABLE _basedb.webhook (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE RESTRICT,
  label text NOT NULL,
  target_url text NOT NULL,
  signing_secret_encrypted bytea NOT NULL,   -- chiffre, pas hache : il faut signer avec
  signing_key_version smallint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  disabled_reason text NULL CHECK (disabled_reason IN ('field_masked','failures','manual')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_webhook_disabled CHECK (is_active OR disabled_reason IS NOT NULL)
);

CREATE TABLE _basedb.webhook_header (
  webhook_id uuid NOT NULL REFERENCES _basedb.webhook(id) ON DELETE CASCADE,
  name  text COLLATE "C" NOT NULL CHECK (name ~ '^[A-Za-z0-9-]{1,64}$'),
  value text NOT NULL,
  PRIMARY KEY (webhook_id, name)
);

CREATE TABLE _basedb.webhook_subscription (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  webhook_id uuid NOT NULL REFERENCES _basedb.webhook(id)   ON DELETE CASCADE,
  table_id   uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('create','update','delete')),
  CONSTRAINT uq_subscription UNIQUE (webhook_id, table_id, event)
);
CREATE INDEX idx_subscription_by_table ON _basedb.webhook_subscription (table_id, event);

CREATE TABLE _basedb.idempotency_key (
  actor_kind  text COLLATE "C" NOT NULL CHECK (actor_kind IN ('user','token')),
  actor_id    uuid NOT NULL,            -- app_user.id ou api_token.id selon actor_kind
  key         text COLLATE "C" NOT NULL CHECK (octet_length(key) <= 255),
  tool        text COLLATE "C" NOT NULL,   -- route REST appelee, ou outil MCP
  params_hash bytea NOT NULL,              -- SHA-256 du corps normalise
  claim_id    uuid NOT NULL DEFAULT _basedb_local.uuid_generate_v7(),
  authz_version    bigint NOT NULL,        -- droits de l'acteur au moment de la revendication
  lease_expires_at timestamptz NOT NULL,   -- bail de la revendication
  response    jsonb NULL,                  -- NULL tant que la revendication court
  http_status smallint NULL,               -- code HTTP memorise avec la reponse
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at  timestamptz NOT NULL,
  PRIMARY KEY (actor_kind, actor_id, key),
  CONSTRAINT ck_idempotency_response CHECK ((response IS NULL) = (http_status IS NULL))
);
CREATE INDEX idx_idempotency_expiry ON _basedb.idempotency_key (expires_at);

CREATE TABLE _basedb.setting (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  scope_kind text NOT NULL CHECK (scope_kind IN ('instance','tenant')),
  tenant_id  uuid NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  key        text COLLATE "C" NOT NULL,
  value      jsonb NOT NULL,
  is_secret  boolean NOT NULL DEFAULT false,   -- la valeur vit dans secret, pas ici
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_setting_scope CHECK ((scope_kind = 'instance') = (tenant_id IS NULL)),
  CONSTRAINT uq_setting UNIQUE NULLS NOT DISTINCT (scope_kind, tenant_id, key)
);

CREATE TABLE _basedb.secret (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  scope_kind text NOT NULL CHECK (scope_kind IN ('instance','tenant')),
  tenant_id  uuid NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  key        text COLLATE "C" NOT NULL,     -- ex. 'ai.openai.api_key'
  value_encrypted bytea NOT NULL,
  key_version smallint NOT NULL,            -- version de la cle d'instance (A25)
  -- Verdict du destinataire du secret, pas du produit : une cle d'IA refusee en
  -- amont (401 du fournisseur) passe en 'invalid' et le reste jusqu'a remplacement.
  status     text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','invalid')),
  status_changed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_secret_scope CHECK ((scope_kind = 'instance') = (tenant_id IS NULL)),
  CONSTRAINT uq_secret UNIQUE NULLS NOT DISTINCT (scope_kind, tenant_id, key)
);

-- Journal des appels sortants aux fournisseurs d'IA : une ligne par tentative.
CREATE TABLE _basedb.ai_call (
  id uuid NOT NULL DEFAULT _basedb_local.uuid_generate_v7(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  tenant_id     uuid NOT NULL,
  base_id       uuid NULL,
  actor_user_id uuid NULL,
  surface    text COLLATE "C" NOT NULL CHECK (surface IN ('ui','rest')),
  usage_kind text COLLATE "C" NOT NULL
             CHECK (usage_kind IN ('structure_draft','expression_draft')),
  provider   text COLLATE "C" NOT NULL
             CHECK (provider IN ('openai','anthropic','mistral')),
  model      text COLLATE "C" NOT NULL,
  key_scope  text COLLATE "C" NOT NULL CHECK (key_scope IN ('instance','tenant')),
  status     text COLLATE "C" NOT NULL
             CHECK (status IN ('accepted','refused','failed','unusable')),
  error_code text COLLATE "C" NULL REFERENCES _basedb.error_code(code),
  tokens_in  integer NULL,
  tokens_out integer NULL,
  tokens_estimated boolean NOT NULL DEFAULT false,
  duration_ms integer NULL,
  request_id  uuid NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX ix_ai_call__tenant_id__occurred_at
  ON _basedb.ai_call (tenant_id, occurred_at DESC);
```

La clé composite de `setting` et de `secret` est structurante : c'est elle qui **rend représentable** la règle « modèle d'IA configurable au niveau instance, surchargeable par tenant ». La résolution est une recherche en deux temps — la ligne `('tenant', <id>, clé)` si elle existe, sinon `('instance', NULL, clé)` — et rien d'autre n'est nécessaire. Aucune clé de réglage ne nomme un schéma : `_basedb` et `_basedb_local` sont figés (A9).

**`secret.status` porte le verdict du destinataire, pas celui du produit.** Une clé d'IA que le fournisseur refuse en amont passe en `invalid`, avec `status_changed_at` : la ligne subsiste, la portée concernée cesse d'être servie, et une clé refusée ne se confond jamais avec une absence de configuration — deux états qui n'appellent ni le même message ni la même action de l'administrateur. Le chapitre 12 est normatif sur ce qui provoque ce basculement et sur ce qu'il change.

**`ai_call` suit le régime de `audit_log`** : partitionnée par mois sur `occurred_at`, sans clé étrangère vers les objets qu'elle décrit — ses partitions doivent pouvoir être détachées —, purgée selon `retention_policy` (24 mois, A24). Le chapitre 12 est normatif sur ce qui y est écrit, sur les plafonds et sur la résolution du fournisseur, du modèle et des clés.

**`idempotency_key` porte un acteur, un bail et un état de revendication.** La clé primaire est le triplet `(actor_kind, actor_id, key)` : une clé d'idempotence n'a de portée que dans celle de l'acteur qui la présente, et l'en-tête `Idempotency-Key` est accepté aussi bien d'une session que d'un jeton d'intégration. C'est cette unicité qui sérialise deux réessais concurrents. La ligne est insérée **avant** le travail, `response` et `http_status` nuls, `lease_expires_at` portant le bail de la revendication ; `authz_version` fige les droits de l'acteur à cet instant, de sorte qu'une réponse mémorisée ne soit jamais rejouée vers un appelant dont les droits ont changé. `actor_id` ne porte pas de clé étrangère typée, l'acteur étant de deux natures : c'est la quatrième et dernière entorse assumée au principe 2, bornée par la purge de la ligne à `expires_at`. Le chapitre 08 est normatif sur les réponses produites dans chaque situation.

**`claim_id` nomme la revendication, que le triplet ne sait pas nommer.** Le triplet `(actor_kind, actor_id, key)` désigne la *place* de la revendication, pas son *occurrence* : la même clé peut être réutilisée par le même acteur passé `expires_at`. `claim_id`, attribué à l'insertion de la ligne et jamais réécrit, est l'identifiant que portent les révisions produites sous cette revendication — c'est lui qui permet au chapitre 08 §3.3 de relier une réponse mémorisée aux écritures qu'elle a réellement faites, et de distinguer un rejeu d'une seconde tentative.

**Webhooks : masque de lecture complet exigé (A19).** Le rôle porté par un webhook doit avoir un masque complet sur chaque table abonnée ; un masquage survenu après coup désactive le webhook en renseignant `disabled_reason = 'field_masked'`. `signing_secret_encrypted` est chiffré et non haché : un secret HMAC doit être relu pour signer.

**Colonnes d'usage.** `app_user.last_seen_at`, `auth_identity.last_used_at`, `api_token.last_used_at` et `session.last_seen_at` sont écrites **au plus une fois toutes les cinq minutes** par entité et **ne sont indexées nulle part**. Les deux contraintes vont ensemble : une colonne indexée mise à jour à chaque appel interdit la mise à jour HOT, produit une version de ligne et une entrée d'index par appel, et transforme une table minuscule et très chaude en point de contention. Les questions du type « quels consommateurs sur 30 jours » passent par `audit_log`.

---

## Domaine 5 — Migrations, journalisation, capture

### Migrations de structures utilisateur

```sql
CREATE TABLE _basedb.migration (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id  uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE RESTRICT,
  sequence bigint NULL,               -- attribue au passage en 'applying' (A12)
  label    text NOT NULL,
  origin   text NOT NULL CHECK (origin IN ('ui','rest','mcp','system')),
  status   text NOT NULL CHECK (status IN
             ('proposed','approved','applying','applied','failed',
              'interrupted','superseded','expired')),
  planner_version integer NOT NULL,

  -- Contenu : tableau ORDONNE d'enonces, jamais un bloc de texte.
  up_sql   jsonb NOT NULL,
  down_sql jsonb NULL,
  checksum bytea NOT NULL,
  catalog_diff     jsonb NOT NULL,
  affected_objects jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Planification, bail d'execution, reprise.
  scheduled_for timestamptz NULL,
  executor_id   text COLLATE "C" NULL,       -- identite du processus qui detient le bail
  lease_until   timestamptz NULL,
  attempts      integer NOT NULL DEFAULT 0,
  step          integer NULL,                -- etape courante du plan (A11)
  step_count    integer NULL,
  started_at    timestamptz NULL,
  finished_at   timestamptz NULL,
  duration_ms   integer NULL,

  -- Diagnostic PostgreSQL complet en cas d'echec.
  error_code         text COLLATE "C" NULL REFERENCES _basedb.error_code(code),
  pg_sqlstate        text COLLATE "C" NULL CHECK (pg_sqlstate ~ '^[0-9A-Z]{5}$'),
  pg_message         text NULL,
  pg_detail          text NULL,
  pg_hint            text NULL,
  pg_constraint_name text COLLATE "C" NULL,
  pg_backend_pid     integer NULL,
  failed_statement_n integer NULL,           -- rang dans up_sql
  failed_statement   text NULL,              -- enonce fautif, tel qu'emis
  error_sample       jsonb NULL,             -- au plus 50 entrees, colonne fautive seule
  error_sample_expires_at timestamptz NULL,

  requested_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_by  uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  approved_at  timestamptz NULL,
  applied_by   uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  applied_at   timestamptz NULL,
  superseded_by_id uuid NULL REFERENCES _basedb.migration(id) ON DELETE RESTRICT,

  CONSTRAINT ck_migration_up_sql CHECK (jsonb_typeof(up_sql) = 'array'),
  CONSTRAINT ck_migration_down_sql CHECK (down_sql IS NULL OR jsonb_typeof(down_sql) = 'array'),
  -- Le numero d'ordre n'est attribue qu'au passage en execution.
  CONSTRAINT ck_migration_sequence CHECK (
    (sequence IS NOT NULL) = (status IN ('applying','applied','failed','interrupted'))),
  CONSTRAINT ck_migration_applied CHECK (
    status <> 'applied' OR (applied_at IS NOT NULL AND applied_by IS NOT NULL)),
  CONSTRAINT ck_migration_lease CHECK (
    (executor_id IS NULL) = (lease_until IS NULL)
    AND (status <> 'applying' OR executor_id IS NOT NULL)),
  CONSTRAINT ck_migration_approve_pair CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  -- Une migration proposee par MCP n'est jamais appliquee sans confirmation humaine.
  CONSTRAINT ck_migration_mcp_approved CHECK (
    origin <> 'mcp' OR status IN ('proposed','superseded','expired')
    OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
  CONSTRAINT ck_migration_superseded CHECK (
    (status = 'superseded') = (superseded_by_id IS NOT NULL)),
  CONSTRAINT ck_migration_error CHECK (
    status <> 'failed' OR error_code IS NOT NULL)
);

-- Ordre dense, mais seulement pour les migrations entrees en execution.
CREATE UNIQUE INDEX uq_migration_sequence
  ON _basedb.migration (base_id, sequence) WHERE sequence IS NOT NULL;
-- Une seule migration en cours d'application par base.
CREATE UNIQUE INDEX uq_migration_running
  ON _basedb.migration (base_id) WHERE status = 'applying';
CREATE INDEX idx_migration_due
  ON _basedb.migration (scheduled_for) WHERE status = 'approved';

ALTER TABLE _basedb.base
  ADD CONSTRAINT fk_base_current_migration
  FOREIGN KEY (current_migration_id) REFERENCES _basedb.migration(id) ON DELETE RESTRICT;
```

Le vocabulaire d'états est celui de A12, et il est unique : `proposed`, `approved`, `applying`, `applied`, `failed`, `interrupted`, `superseded`, `expired`. **Le bail d'exécution vit sur la migration, pas sur la base** : `base.current_migration_id` désigne la ligne, et `executor_id` / `lease_until` s'y lisent. Un bail expiré rend la migration reprenable par un autre exécuteur, qui incrémente `attempts` ; `step` dit où reprendre.

`ck_migration_mcp_approved` est la traduction déclarative de la règle « les opérations de structure produisent une migration proposée, jamais appliquée directement ». Aucun chemin, pas même un script, ne peut faire passer une migration d'origine `mcp` à `applied` sans une approbation humaine horodatée et attribuée.

**`sequence` est attribué sous le verrou de classe `structure_step` de la base**, pris pour la durée de la transaction :

```sql
SELECT pg_advisory_xact_lock(3, (SELECT lock_key FROM _basedb.base WHERE id = $1));
SELECT coalesce(max(sequence), 0) + 1 FROM _basedb.migration WHERE base_id = $1;
```

**`error_sample` ne recopie pas de données utilisateur au-delà du strict nécessaire** : au plus cinquante entrées `{ "_id": …, "column": …, "value": … }`, **limitées à la colonne responsable du refus**, jamais la ligne entière, restituées à travers le même filtre de permissions de champ que n'importe quelle lecture. Sans cette règle, `_basedb` deviendrait un chemin de lecture parallèle échappant au point de contrôle unique. Conformément à A24, l'échantillon est effacé après 30 jours (`error_sample_expires_at`), la ligne de migration restant, elle, **conservée sans limite** : c'est elle qui porte la rejouabilité.

### Versionnement du catalogue lui-même

```sql
CREATE TABLE _basedb.catalog_migration (
  version     integer PRIMARY KEY,           -- 1, 2, 3... strictement sequentiel
  name        text NOT NULL,
  checksum    bytea NOT NULL,                -- SHA-256 du fichier .sql livre
  applied_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  app_release text NOT NULL,
  duration_ms integer NOT NULL
);
```

| | Migration de catalogue | Migration de structure utilisateur |
|---|---|---|
| Objet | schéma `_basedb`, `_basedb_local` | schémas `b_<tenantId>_<base>` |
| Auteur | développeur, fichier `NNNN_nom.sql` versionné | utilisateur, via interface, API ou MCP |
| Déclencheur | démarrage de l'application | action explicite |
| Réversibilité | aucune : on corrige par une migration suivante | `down_sql` quand le moteur sait l'écrire |
| Audit | aucune entrée (ce n'est pas un acte utilisateur) | entrée systématique |
| Concurrence | classe de verrou `catalog_migration`, clé `1`, détention de session | classe `structure_step`, `base.lock_key`, détention de transaction |

### Journal d'audit

```sql
CREATE TABLE _basedb.audit_log (
  id uuid NOT NULL DEFAULT _basedb_local.uuid_generate_v7(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  tenant_id uuid NULL, base_id uuid NULL, table_id uuid NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('user','token','mcp','system')),
  actor_user_id uuid NULL, actor_token_id uuid NULL, actor_role_id uuid NULL,
  surface text NOT NULL CHECK (surface IN ('ui','rest','mcp','webhook','system')),
  action  text NOT NULL,
  object_kind text NOT NULL,
  object_id   uuid NULL,
  object_name text NULL,       -- instantane du nom au moment de l'acte
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id uuid NULL, ip inet NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_audit_object ON _basedb.audit_log (object_kind, object_id, occurred_at DESC);
CREATE INDEX idx_audit_tenant ON _basedb.audit_log (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_schema_read ON _basedb.audit_log (base_id, occurred_at DESC)
  WHERE action = 'schema.read';
```

**`audit_log` ne porte aucune clé étrangère, délibérément.** Une table partitionnée dont les partitions doivent pouvoir être détachées et supprimées ne peut pas être liée aux objets qu'elle décrit, et l'audit doit survivre à l'épuration de second niveau de ces objets. C'est la raison de `object_name`, instantané du nom au moment de l'acte, qui rend la ligne lisible quand l'objet n'existe plus nulle part. C'est la troisième des quatre entorses assumées au principe 2, avec `scope_id` du registre, l'absence de clé étrangère d'auteur sur les tables de données et l'acteur polymorphe de `idempotency_key`.

`actor_role_id` et l'action `schema.read` ne sont pas décoratifs : ce sont eux qui rendent possible la liste, avant un renommage physique, des rôles ayant lu le schéma dans les 30 derniers jours. L'action est émise par l'API REST, le serveur MCP et la génération OpenAPI.

**Création des partitions.** Une tâche du processus applicatif, exécutée au démarrage puis quotidiennement sous le verrou de classe `maintenance`, crée les partitions manquantes jusqu'à M+2 et détache celles qui sortent de la rétention. **Aucune dépendance à `pg_cron` ni à `pg_partman`**, qui exigent `shared_preload_libraries`. La partition `DEFAULT` est un filet, pas un mode de fonctionnement : attacher une partition alors qu'une `DEFAULT` non vide existe impose un balayage sous `ACCESS EXCLUSIVE` ; la tâche vérifie qu'elle est vide et alerte sinon. Même régime pour `security_log`, `webhook_delivery`, `change_event`, `ai_call` et les partitions d'historique.

### Journal de sécurité

Distinct de `audit_log`, et la distinction est la raison d'être de la table : l'audit trace ce qui a **réussi**, tandis qu'une énumération, un bourrage d'identifiants ou un jeton fuité se lisent dans ce qui a **échoué**. Les deux journaux ont des rétentions, des lecteurs et des volumétries différents ; les confondre reviendrait à noyer la décision d'administration dans le bruit des refus.

```sql
-- Journal de securite. Partitionne par mois sur occurred_at, comme audit_log, et
-- comme lui SANS AUCUNE CLE ETRANGERE : il doit survivre a la suppression, a la
-- purge et a l'epuration de l'acteur qu'il met en cause, et ses partitions doivent
-- pouvoir etre detachees. error_code est un code du registre A23, recopie et non
-- reference, pour la meme raison que dans webhook_delivery.
CREATE TABLE _basedb.security_log (
  id uuid NOT NULL DEFAULT _basedb_local.uuid_generate_v7(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_kind  text COLLATE "C" NOT NULL
              CHECK (actor_kind IN ('user','token','anonymous')),
  actor_user_id  uuid NULL,        -- app_user.id, sans FK
  actor_token_id uuid NULL,        -- api_token.id, sans FK
  ip          inet NULL,
  route       text NOT NULL,       -- chemin seul, JAMAIS la chaine de requete
  error_code  text COLLATE "C" NOT NULL,
  http_status smallint NULL,
  request_id  uuid NULL,
  PRIMARY KEY (id, occurred_at),
  -- Un acteur OU une adresse : une entree qui ne designe personne n'est pas exploitable.
  CONSTRAINT ck_security_actor CHECK (
    CASE actor_kind
      WHEN 'user'      THEN actor_user_id  IS NOT NULL AND actor_token_id IS NULL
      WHEN 'token'     THEN actor_token_id IS NOT NULL AND actor_user_id  IS NULL
      WHEN 'anonymous' THEN actor_user_id IS NULL AND actor_token_id IS NULL
                            AND ip IS NOT NULL
    END),
  -- La chaine de requete porte filtres et curseurs : elle n'entre pas ici.
  CONSTRAINT ck_security_route CHECK (strpos(route, '?') = 0)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX ix_security_log__ip__occurred_at
  ON _basedb.security_log (ip, occurred_at DESC) WHERE ip IS NOT NULL;
CREATE INDEX ix_security_log__token__occurred_at
  ON _basedb.security_log (actor_token_id, occurred_at DESC) WHERE actor_token_id IS NOT NULL;
CREATE INDEX ix_security_log__code__occurred_at
  ON _basedb.security_log (error_code, occurred_at DESC);
```

**Ce qui y entre et ce qui n'y entre jamais** appartient au chapitre 08, normatif : refus d'authentification et d'autorisation, `404` d'invisibilité, dépassements de seuil, jetons présentés hors `Authorization`, adresses de webhook refusées par le filtre. Le catalogue n'en fixe que la forme, et deux interdits y sont portés par une contrainte plutôt que par une consigne : jamais de chaîne de requête, jamais de corps, de valeur de filtre ni de curseur — ce sont des données personnelles, et un journal de sécurité qui les recopie devient lui-même le canal de fuite qu'il surveille. Rétention 180 jours (A24), sous `retention_policy`.

**Aucune clé étrangère, délibérément.** La raison n'est pas seulement le détachement des partitions : une entrée met souvent en cause un acteur qui sera ensuite désactivé, supprimé puis épuré, et c'est précisément à ce moment-là qu'elle doit rester lisible. `actor_user_id` et `actor_token_id` sont donc des clés nues.

**C'est de ce journal, et de nul autre, que se décide la suspension d'un jeton d'intégration** (`api_token.suspended_at`). La décision est prise **en différé**, par le processus qui draine les événements, en relisant les entrées de la fenêtre écoulée pour un jeton donné. Il n'existe **aucune table de compteurs par fenêtre glissante** dans le catalogue : elle placerait une écriture en base sur le chemin de chaque requête, ce que le chapitre 08 interdit explicitement, et elle ferait du contrôle de débit un point de contention global. Les seaux à jetons de la limitation de débit vivent en mémoire de processus, avec l'approximation multi-instances documentée et assumée (A4). Pour la même raison, la protection contre le bourrage d'identifiants ne s'appuie sur aucun compteur par identité : elle est portée par `auth_identity.failed_attempts` et `auth_identity.locked_until`, persistants et exacts ; la limitation par adresse IP, elle, reste en mémoire de processus et reste approximative.

### Capture et drain

Conformément à A10, l'historique des enregistrements et les événements sortants sont capturés par des **déclencheurs PostgreSQL**, dans la transaction qui écrit la donnée, vers deux tables tampon de `_basedb_local` ; un processus de drain les transfère ensuite vers `_basedb`. C'est la seule architecture qui tienne la promesse centrale du cadrage — une écriture SQL directe est historisée comme les autres — et elle préserve l'atomicité sans exiger qu'une transaction couvre deux pools. Il n'existe **aucune table `_outbox` dans un schéma de données**, aucun schéma technique alimenté applicativement, et aucune table `webhook_outbox` : une seule table de révisions, une seule table d'événements sortants, un seul mécanisme.

```sql
-- Cote donnees : tampons, ecrits par _basedb_local.capture_v1() dans la transaction
-- de l'utilisateur. Volontairement sans index autre que celui du drain.
CREATE TABLE _basedb_local.revision_buffer (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  xact_id     xid8 NOT NULL DEFAULT pg_current_xact_id(),
  base_id     uuid NOT NULL,
  table_id    uuid NOT NULL,
  record_id   uuid NOT NULL,
  op          text NOT NULL CHECK (op IN ('insert','update','delete')),
  is_cascade  boolean NOT NULL DEFAULT false,   -- pg_trigger_depth() > 1
  actor_kind  text NOT NULL,
  actor_user_id  uuid NULL,
  actor_token_id uuid NULL,
  sql_identity   text NULL,        -- variable de session brute si non exploitable
  bulk_id     uuid NULL,
  format_version smallint NOT NULL,
  before jsonb NULL,
  after  jsonb NULL,
  drained_at timestamptz NULL
);
CREATE INDEX ix_revision_buffer__pending
  ON _basedb_local.revision_buffer (id) WHERE drained_at IS NULL;

CREATE TABLE _basedb_local.change_event_buffer (LIKE _basedb_local.revision_buffer
  INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
```

Deux tampons et non un seul : une révision est produite à chaque écriture et draine vers un historique mensuel à 24 mois de rétention ; un événement sortant n'est produit que pour une table abonnée et draine vers un flux à 7 jours, consommé par les webhooks. Les séparer garde le second petit et purgeable agressivement, et permet d'arrêter la diffusion sans toucher à l'historique.

```sql
-- Cote catalogue : destinations du drain.
CREATE TABLE _basedb.change_event (
  id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  drained_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  base_id uuid NOT NULL, table_id uuid NOT NULL, record_id uuid NOT NULL,
  op text NOT NULL CHECK (op IN ('insert','update','delete')),
  is_cascade boolean NOT NULL DEFAULT false,
  xact_id xid8 NOT NULL,
  actor_kind text NOT NULL,
  actor_user_id uuid NULL, actor_token_id uuid NULL,
  format_version smallint NOT NULL,
  before jsonb NULL, after jsonb NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX idx_change_event_feed ON _basedb.change_event (base_id, occurred_at, id);

CREATE TABLE _basedb.webhook_delivery (
  id uuid NOT NULL DEFAULT _basedb_local.uuid_generate_v7(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  webhook_id      uuid NOT NULL,
  subscription_id uuid NOT NULL,
  base_id         uuid NOT NULL,
  event_id        uuid NOT NULL,   -- reference vers change_event : JAMAIS le corps
  event_occurred_at timestamptz NOT NULL,
  role_id         uuid NOT NULL,   -- role de projection, relu a l'emission
  partition_key   text COLLATE "C" NOT NULL,   -- ordre FIFO strict par cle
  status text NOT NULL CHECK (status IN ('pending','in_flight','delivered','failed','abandoned')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NULL,
  response_code smallint NULL,
  error_code text COLLATE "C" NULL,
  delivered_at timestamptz NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_delivery_due ON _basedb.webhook_delivery (partition_key, created_at, id)
  WHERE status IN ('pending','failed');
```

**`webhook_delivery` ne conserve que la référence, le rôle de projection et l'état.** Le corps est recalculé depuis `change_event` à l'émission, et reprojeté selon les droits — ceux de l'abonné à l'émission, ceux du lecteur à l'inspection. Sans cette règle, un lot de mille modifications sur une table à documents écrirait plusieurs gigaoctets dans le catalogue. Comme `audit_log`, ces deux tables partitionnées ne portent aucune clé étrangère.

**Le chapitre 02 fait autorité sur le stockage : tout objet de `_basedb` y est au moins recensé**, même quand un autre chapitre en donne le DDL et la sémantique. Le recensement des objets définis ailleurs :

| Objet de `_basedb` | Régime | Chapitre normatif |
|---|---|---|
| `record_revision` (en-tête), `record_revision_field` (détail) | partitionnées par mois sur `occurred_at` | 07 |
| `record_deletion` | partitionnée par mois sur `deleted_at` | 07 |
| `bulk_operation`, `structure_revision`, `migration_execution` | non partitionnées | 07 |
| `capture_gap`, `history_archive`, `erasure_request` | non partitionnées, petites tables d'exploitation | 07 |
| `v_record_deletion`, `v_record_deletion_horizon` | vues, sans existence physique | 07 |
| `deferred_task` | non partitionnée | 06 |

Aucune de ces tables de journal ne porte de contrainte référentielle vers le catalogue ; les trois tables d'exploitation et `deferred_task`, qui n'en sont pas, suivent la règle générale et référencent `app_user` sur leurs colonnes d'auteur. **Leurs noms, leur schéma d'accueil `_basedb` et le régime de partitionnement sont fixés ici** pour qu'aucune divergence ne soit possible ; le chapitre normatif indiqué l'est sur tout le reste, y compris la liste des déclencheurs posés sur une table utilisateur et l'immuabilité des journaux.

`change_feed_state` ne figure pas dans ce recensement : il vit dans **`_basedb_local`** (chapitre 07, normatif), colocalisé avec les tampons de capture dont il commande l'alimentation. C'est la conséquence directe de A9 — la capture le lit dans la transaction qui écrit la donnée, et aucune écriture de donnée ne doit atteindre `_basedb` depuis un schéma `b_*`.

---

## Registre des codes d'erreur et rétentions

Conformément à A23, un registre unique fixe un code par condition. Il est porté par le paquet de types partagé, publié en annexe du chapitre 00, et **semé dans le catalogue** par une migration de catalogue afin que toute colonne `error_code` puisse le référencer. Un chapitre peut y ajouter un code, jamais en renommer un.

```sql
CREATE TABLE _basedb.error_code (
  code        text COLLATE "C" PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  origin      text NOT NULL,      -- chapitre qui definit la condition
  level       text NOT NULL CHECK (level IN
                ('validation','conflict','permission','incident','startup','warning')),
  http_status smallint NULL,
  description text NOT NULL
);
```

Codes définis par le présent chapitre :

| Code | Condition | Niveau |
|---|---|---|
| `POSTGRES_VERSION_TOO_OLD` | Version de PostgreSQL inférieure à 16 (A1) | Amorçage |
| `DB_ENCODING_NOT_UTF8` | Base d'accueil non `UTF8` | Amorçage |
| `DB_NOT_OWNED` | Le rôle connecté n'est pas propriétaire de la base d'accueil | Amorçage |
| `CATALOG_CHECKSUM_MISMATCH` | Somme de contrôle d'une migration de catalogue déjà appliquée divergente | Amorçage |
| `CATALOG_VERSION_AHEAD` | La base est en avance sur le code livré | Amorçage |
| `PHYSICAL_NAME_TAKEN` | Nom déjà enregistré dans la portée demandée | Validation |
| `TABLE_REFERENCED` | Suppression d'une table encore référencée par un lien actif | Conflit |
| `DISPLAY_FIELD_IN_USE` | Suppression du champ désigné comme colonne d'affichage (A15) | Conflit |
| `BASE_NOT_EMPTY` | Suppression logique d'une base dont une table est encore vivante | Conflit |
| `FIELD_CONFIG_MISSING` | Champ dont le type exige un satellite absent | Incident |
| `LAST_INSTANCE_ADMIN` | Retrait du dernier administrateur d'instance | Conflit |

Les codes des autres chapitres sont référencés, pas redéfinis. Les cinq familles dédoublées relevées par A23 sont fusionnées : `TABLE_REFERENCED`, `LINK_ORPHAN_VALUES`, `LINK_TARGET_NOT_FOUND`, `ROW_REFERENCED`, `DUPLICATE_VALUE`.

Conformément à A24, les durées de rétention sont déclarées une fois, toutes configurables :

```sql
CREATE TABLE _basedb.retention_policy (
  object           text COLLATE "C" PRIMARY KEY,
  default_interval interval NOT NULL,
  current_interval interval NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
);
-- Valeurs semees par la migration de catalogue initiale (A24).
--  record_revision      24 mois     audit_log            24 mois
--  structure_revision   60 mois     webhook_delivery     90 jours
--  change_event          7 jours    catalog_tombstone    12 mois
--  security_log        180 jours    migration_error_sample 30 jours
--  ai_call              24 mois
```

Les lignes de `migration` ne figurent pas dans cette table : elles ne sont jamais purgées, parce qu'elles portent la rejouabilité et l'historique des structures. Seul leur échantillon d'erreur expire.

---

## Les déclencheurs du catalogue

Le catalogue est déclaratif partout où PostgreSQL le permet. Il comporte néanmoins une **liste close de déclencheurs**, donnée ici ; toute addition passe par ce chapitre.

| Déclencheur | Table | Rôle | Pourquoi il n'est pas déclaratif |
|---|---|---|---|
| `ck_field_config_present` | `_basedb.field` | Exige une ligne de satellite pour tout `kind` dont `has_config` est vrai | « Au moins une ligne » n'est pas exprimable en SQL |
| `ck_last_instance_admin` | `_basedb.app_user` | Refuse la désactivation ou la suppression du dernier administrateur d'instance | Même raison, sur un décompte global |
| Immuabilité des journaux | tables d'historique de `_basedb` | Refuse `UPDATE` et `DELETE` hors maintenance | Chapitre 07, normatif |

```sql
-- Verifie au COMMIT, donc compatible avec l'ordre naturel d'ecriture
-- (champ puis satellite) dans une meme transaction.
CREATE CONSTRAINT TRIGGER ck_field_config_present
  AFTER INSERT OR UPDATE ON _basedb.field
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _basedb.assert_field_config_present();
```

Les déclencheurs posés sur les **tables utilisateur** des schémas `b_*` sont d'une autre nature et ne figurent pas dans cette liste : ils appellent les fonctions partagées de `_basedb_local` (A9), il n'y a jamais une fonction par table, et le chapitre 07 est normatif sur leur liste et sur les rôles du motif `tg_<table>__<role>`.

---

## Invariants

| # | Invariant | Garanti par |
|---|---|---|
| I1 | Tout champ appartient à une table de sa propre base | FK composite `(table_id, base_id, table_is_live) → table_def` |
| I2 | Un champ vivant exige une table vivante, une table vivante une base vivante | Miroirs `table_is_live`, `base_is_live` + `CHECK` |
| I3 | Une configuration de type ne s'attache qu'à un champ de ce type | FK composite `(field_id, kind) → field(id, kind)` + `CHECK (kind …)` |
| I4 | Tout champ dont le type a un satellite possède exactement une ligne dans ce satellite | Clé primaire du satellite (au plus une) + `ck_field_config_present` (au moins une) |
| I5 | Le champ d'affichage appartient à la table, est vivant, et son type est affichable | `fk_display_field`, `fk_display_kind`, `ck_display_kind` (A15) |
| I6 | La cible d'un champ lien est une table de la même base | FK composite `(target_table_id, base_id, target_is_live)` |
| I7 | Une table référencée par un lien actif n'est ni supprimée logiquement ni purgée | Miroir `target_is_live` + `ck_link_target_live` ; `ON DELETE RESTRICT` |
| I8 | Un `ON DELETE CASCADE` a une autorisation existante, attribuée, horodatée et confirmée | FK vers `cascade_grant` + `ck_link_cascade_granted`. *La qualité d'administrateur relève du service* |
| I9 | Un `ON DELETE SET NULL` implique un champ non obligatoire | Miroir `is_required` + `ON UPDATE CASCADE` + `ck_link_set_null_nullable` |
| I10 | Un libellé est unique parmi les objets vivants de son parent | Index uniques partiels sur `label_key`, `COLLATE "C"` |
| I11 | Un nom physique n'est jamais réattribué, quel que soit l'état de l'objet | `uq_physical_name` non partiel (A5) |
| I12 | Aucun objet ne porte un nom alloué sous la portée d'un autre | FK composites `(name_id, <portée>) → physical_name(id, scope_id)` |
| I13 | Aucun identifiant émis ne dépasse 63 octets ni ne quitte l'alphabet B | `ck_name_alphabet`, `ck_name_length` |
| I14 | Un nom est détenu par au plus un objet | `UNIQUE (name_id)` sur chaque table d'objet |
| I15 | Une purge implique une suppression logique préalable | `ck_*_purge` |
| I16 | Un champ dont dépend une formule vivante ne peut pas être purgé | Miroirs + `ck_dep_purge_order` |
| I17 | Une formule ne dépend que de champs de sa propre table | `table_id` partagé par les deux FK composites |
| I18 | Un jeton, son rôle et sa base appartiennent au même tenant ; une session au tenant de son porteur | FK composites vers `role(id, tenant_id)`, `base(id, tenant_id)`, `app_user(id, tenant_id)` |
| I19 | Une application ne référence que des tables de sa base | `base_id` partagé par les deux FK composites |
| I20 | Une permission ne désigne que des objets existants | Trois FK typées `ON DELETE CASCADE` + `ck_permission_scope` |
| I21 | Un jeton d'intégration n'expire pas, sauf échéance donnée à sa création, postérieure à celle-ci et à un an au plus | `CHECK` ; la borne d'un an, par le noyau |
| I22 | Une migration d'origine MCP n'atteint `applied` qu'avec approbation humaine horodatée | `ck_migration_mcp_approved` |
| I23 | Une migration en exécution porte un numéro d'ordre, un bail et un exécuteur, et elle est seule sur sa base | `ck_migration_sequence`, `ck_migration_lease`, `uq_migration_running` |
| I24 | Les colonnes participant à une contrainte composite sont connues et de la même table | `table_constraint_member`, `table_id` partagé |
| I25 | Toute colonne d'auteur de `_basedb` désigne un utilisateur existant | `REFERENCES app_user(id) ON DELETE RESTRICT`, hors tables de journal |
| I26 | Toute clé étrangère physique d'un `b_*` correspond à un champ lien actif, et réciproquement, avec la même action et la même cible | **Réconciliation** `CAT-FK1/2/3` |
| I27 | Toute colonne physique non système correspond à un champ non purgé, et réciproquement | **Réconciliation** `CAT-COL1/2` |
| I28 | Tout nom de registre en état `active`, `relegated` ou `alias` correspond à un objet physique | **Réconciliation** `CAT-NAME` |
| I29 | Toute clé étrangère du catalogue a un index non partiel côté référençant | **Réconciliation** `CAT-IDX` |

Les invariants I10 à I15 ne concernent que les objets ayant une contrepartie physique. Seuls les quatre derniers ne sont pas déclarables : ils portent sur la correspondance entre deux espaces, le catalogue et `pg_catalog`, qu'aucune contrainte ne peut relier.

---

## Réconciliation catalogue ↔ `pg_catalog`

**Une réconciliation qui ne compare que des noms ne sert à rien.** Une contrainte dont quelqu'un a changé l'action par un correctif SQL manuel — un refus devenu une cascade, exactement le scénario que l'autorisation d'admin cherche à empêcher —, qui pointe vers une autre table, qui porte sur une autre colonne, ou qui est restée `NOT VALID`, doit être détectée. La procédure compare donc les **propriétés**.

### Nomenclature des classes de dérive

Les classes sont préfixées par leur chapitre d'origine, et une lettre nue ne désigne jamais rien : `CAT-` pour ce chapitre, `NOM-` pour le chapitre 01, `DDL-` pour le 03, `TYPE-` pour le 04, `CYCLE-` pour le 06, `HIST-` pour le 07. Un rapport de réconciliation nomme donc toujours la classe en entier, et tout chapitre qui ajoute une classe la numérote dans son propre espace.

| Classe | Question |
|---|---|
| `CAT-FK1` | Clé étrangère physique dans `b_*` sans champ lien actif correspondant |
| `CAT-FK2` | Clé étrangère présente mais **divergente** : validation, action `ON DELETE`, cible, colonne |
| `CAT-FK3` | Champ lien actif sans clé étrangère physique |
| `CAT-COL1` | Colonne physique non système sans champ de catalogue non purgé |
| `CAT-COL2` | Champ non purgé sans colonne physique |
| `CAT-NAME` | Nom de registre `active`/`relegated`/`alias` sans objet physique, ou objet physique sans nom de registre |
| `CAT-CK` | Contrainte de liste de choix manquante, divergente des options actives, ou non validée |
| `CAT-STATE` | État physique non terminal depuis plus de 24 heures, ou index `indisvalid = false` |
| `CAT-CMT` | `COMMENT ON` physique divergent du texte attendu : la colonne `description` du catalogue, à défaut le libellé |
| `CAT-IDX` | Clé étrangère du catalogue sans index non partiel utilisable côté référençant |

### Régime d'exécution

- **Isolation** : `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`. Sous `READ COMMITTED`, chaque instruction prend un nouvel instantané et enchaîner dix requêtes produirait des faux positifs dès qu'une migration s'exécute en parallèle.
- **Concurrence** : la procédure prend d'abord le verrou de classe `structure_step` de la base examinée. Si elle ne l'obtient pas dans la seconde, elle ne conclut pas à une dérive : elle diffère l'examen et le note.
- **Fréquence** : à chaque démarrage en test et en intégration continue ; **après chaque migration**, parce que c'est le seul contrôle capable de voir que la base ne ressemble plus à ce que le décideur d'autorisation croit ; à la demande depuis l'administration ; une fois par nuit en production, sous le verrou `maintenance`.
- **Résultat** : des lignes de dérive, avec la classe, l'objet et la propriété divergente. Zéro ligne vaut succès. Aucune correction automatique : la réconciliation constate, l'administration décide. Un écart bloquant passe `base.structure_state` à `frozen` et lève `REGISTRY_DIVERGENT` : les lectures et écritures de données restent servies, les opérations de structure de cette base seule sont suspendues.

`CAT-FK2` est celle qui fait le travail utile. Elle intègre la correspondance exacte imposée par A13 :

```sql
-- CAT-FK2 : contrainte presente mais divergente (validation, action, cible, colonne).
-- Correspondance catalogue -> confdeltype : restrict -> 'a' (NO ACTION reellement
-- emis), set_null -> 'n', cascade -> 'c'. Un 'r' est donc lui-meme une derive :
-- il signale un RESTRICT pose a la main, que le moteur n'emet jamais.
SELECT f.id AS field_id, nq.object_name AS constraint_name,
       c.convalidated, c.confdeltype, c.confupdtype,
       c.confrelid::regclass AS cible_reelle,
       att.attname AS colonne_reelle
FROM _basedb.field_link_config lc
JOIN _basedb.field           f  ON f.id  = lc.field_id AND f.deleted_at IS NULL
JOIN _basedb.table_def       st ON st.id = f.table_id
JOIN _basedb.table_def       tt ON tt.id = lc.target_table_id
JOIN _basedb.table_constraint kc ON kc.id = lc.fk_constraint_id
JOIN _basedb.v_physical_name_qualified nq ON nq.name_id = kc.name_id
JOIN _basedb.v_physical_name_qualified sq ON sq.name_id = st.name_id
JOIN _basedb.v_physical_name_qualified tq ON tq.name_id = tt.name_id
JOIN _basedb.v_physical_name_qualified fq ON fq.name_id = f.name_id
JOIN _basedb.physical_state  ps ON ps.code = kc.state
JOIN pg_namespace  n ON n.nspname = sq.schema_name
JOIN pg_class      t ON t.relnamespace = n.oid AND t.relname = sq.object_name
JOIN pg_constraint c ON c.conrelid = t.oid AND c.conname = nq.object_name
LEFT JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = c.conkey[1]
WHERE lc.fk_dropped_at IS NULL
  AND (
       c.convalidated <> (kc.state = 'active')
    OR c.confupdtype <> 'a'                      -- ON UPDATE vaut toujours NO ACTION
    OR CASE c.confdeltype WHEN 'a' THEN 'restrict' WHEN 'n' THEN 'set_null'
                          WHEN 'c' THEN 'cascade' ELSE '?' END <> lc.on_delete
    OR c.confrelid <> tq.qualified_name::regclass
    OR array_length(c.conkey, 1) <> 1            -- une FK de lien est mono-colonne
    OR att.attname IS DISTINCT FROM fq.object_name);
```

`CAT-COL1` et `CAT-COL2` suivent le même patron sur `pg_attribute`, avec les filtres sans lesquels elles remonteraient les colonnes internes de PostgreSQL et surtout toutes les colonnes des **vues SQL d'alias**, qui vivent elles aussi dans des schémas `b_*` :

```sql
… FROM pg_attribute a
   JOIN pg_class c     ON c.oid = a.attrelid
   JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'           -- tables ordinaires, pas les vues d'alias
    AND a.attnum > 0              -- pas les colonnes systeme de PostgreSQL
    AND NOT a.attisdropped        -- pas les colonnes supprimees non compactees
    AND n.nspname LIKE 'b\_%'
    AND n.nspname NOT IN (SELECT q.schema_name
                          FROM _basedb.db_schema s
                          JOIN _basedb.v_physical_name_qualified q ON q.name_id = s.name_id
                          WHERE s.role = 'alias' AND s.dropped_at IS NULL)
    AND a.attname NOT IN ('_id','_created_at','_updated_at','_created_by','_updated_by')
…
```

`CAT-IDX` est le seul contrôle mécanique de la règle d'indexation, et c'est lui qui tient à jour la liste que le chapitre ne tient pas à la main :

```sql
-- CAT-IDX : cle etrangere du catalogue sans index NON PARTIEL utilisable cote
-- referençant. Un index partiel ne peut pas servir la verification interne
-- SELECT 1 FROM enfant WHERE fk = $1 FOR KEY SHARE.
SELECT c.conrelid::regclass AS table_referencante, c.conname
FROM pg_constraint c
JOIN pg_class     t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE c.contype = 'f' AND n.nspname = '_basedb'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND i.indpred IS NULL AND i.indisvalid
      AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] @> c.conkey
      AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] <@ c.conkey);
```

---

## Amorçage

Les colonnes `created_by NOT NULL` imposent qu'un auteur existe avant tout. L'ordre est fixé et exécuté par les premières migrations de catalogue.

1. **Séquence de démarrage.** Ouvrir une **connexion dédiée, hors pool**, et la garder pour toute la séquence : un verrou consultatif de session est attaché à une connexion précise. Y poser `lock_timeout = '3s'` et `statement_timeout = '60s'` — sans `lock_timeout`, un `ALTER TABLE` en attente d'un `ACCESS EXCLUSIVE` bloque derrière lui toutes les lectures qui se présentent, et l'application entière se fige pendant un déploiement. Prendre `pg_try_advisory_lock(1, 1)` (classe `catalog_migration`, portée instance) dans une boucle bornée à dix tentatives.
2. Vérifier les sommes de contrôle des migrations déjà appliquées : une divergence est un **arrêt immédiat** (`CATALOG_CHECKSUM_MISMATCH`), jamais un avertissement. Si la base est en avance sur le code — retour arrière de déploiement — refuser de démarrer (`CATALOG_VERSION_AHEAD`) plutôt que d'écrire dans un schéma dont on ignore la forme.
3. Appliquer les migrations manquantes, **chacune dans sa propre transaction**, avec réessai sur expiration de `lock_timeout`. Créer les partitions manquantes, relâcher le verrou, fermer la connexion.
4. **Migration `0001`** : schémas `_basedb` et `_basedb_local`, fonctions partagées, toutes les tables, tous les index, les déclencheurs de la liste close, les partitions initiales, et la ligne de registre du nom réservé `SCOPE_INSTANCE` avec `lock_key = 1`.
5. **Migration `0002`** : le tenant système `tsystem` (`is_system = true`, figurant à ce titre dans la liste d'exclusion du chapitre 01 §7.2, donc inattribuable à un tenant réel), puis l'utilisateur système d'identifiant constant `00000000-0000-7000-8000-000000000000`, `is_system = true`, `is_instance_admin = true`, `created_by` égal à son propre identifiant — l'auto-référence est acceptée, la clé étrangère étant vérifiée après insertion de la ligne. Cet utilisateur n'a **aucune ligne dans `auth_identity`** : il ne peut pas se connecter. Il est l'auteur de tout acte du système.
6. **Migration `0003`** : semis de `physical_state`, `field_kind`, `lock_class`, `error_code`, `retention_policy` et des réglages par défaut, sous cet auteur.
7. **Au premier démarrage**, si aucun tenant réel n'existe, l'assistant d'installation crée en une transaction : le `tenant`, ses trois rôles système (`owner`, `editor`, `reader`), le premier `app_user` réel avec son secret d'amorçage, son `auth_identity` de type `password` et son `role_member` sur `owner`.

**Règles imposées aux migrations de catalogue.** Aucune ne met à jour une colonne déclarée immuable. Aucune ne réécrit un `name_id` sans émettre, dans la même transaction, le DDL de renommage correspondant et les mouvements d'état du registre. Aucune ne pose une contrainte validée en une fois sur une table volumineuse. Les déploiements progressifs exigent des migrations **en deux temps**, afin que les versions N et N+1 du code coexistent sur le même schéma.

---

## Volumétrie, rétention et exploitation

| Table | Régime | Rétention | Paramétrage |
|---|---|---|---|
| Structures (`base`, `table_def`, `field`, satellites, contraintes, index) | quelques milliers de lignes, écritures rares, lectures massives | aucune | défaut |
| `app_user`, `session`, `api_token`, `auth_identity` | petites, mises à jour d'usage bridées | hors `retention_policy` : entretien, les sessions révoquées disparaissant passé `absolute_expires_at` | `fillfactor = 80`, `autovacuum_vacuum_scale_factor = 0.02` |
| `physical_name` | croissance monotone, jamais purgée | aucune | défaut |
| `audit_log`, `security_log`, `ai_call`, `webhook_delivery`, `change_event` | ajout seul, partitionnées par mois | `retention_policy` | `fillfactor = 100` |
| Tampons de `_basedb_local` | très chauds, purgés après drain | hors `retention_policy` : suppression des lignes marquées au passage de drain suivant (chapitre 07) | `fillfactor = 100`, autovacuum agressif |

Les requêtes qui survivent au cache — et celles qui le reconstruisent — sont servies par : `uq_physical_name` (allocation), `uq_token_hash` (authentification machine), `uq_session_token` (authentification humaine), `idx_role_member_user` et `permission(role_id)` (droits effectifs), `uq_field_permission` (masque de champs), `idx_link_target` (liens inverses et refus de suppression), `idx_subscription_by_table` (abonnements à chaque écriture), `idx_audit_schema_read` (consommateurs avant renommage).

**Chargement du schéma : une seule transaction, et en `REPEATABLE READ`.** Une transaction ne suffit pas : sous `READ COMMITTED`, charger tables, puis champs, puis satellites en trois requêtes produirait exactement le cache mêlant deux états qu'on cherche à éviter. Le cache est invalidé par `base.catalog_version` et un `NOTIFY basedb_catalog`.

**Réplique en lecture : hors objectif v1.** Les colonnes d'usage sont des écritures sur un chemin de lecture et provoqueraient `cannot execute UPDATE in a read-only transaction`. Le remède est connu et localisé : les déplacer dans une table `UNLOGGED` du primaire, agrégée périodiquement.

**Colonnes `jsonb` du catalogue, liste exhaustive.** `view_def.spec`, `setting.value`, `secret` (chiffré), `field_formula_config.ast`, `migration.up_sql`, `migration.down_sql`, `migration.catalog_diff`, `migration.affected_objects`, `migration.error_sample`, `audit_log.payload`, les images `before`/`after` des tampons et de `change_event`. Le critère est unique et vérifiable : **une valeur `jsonb` ne porte jamais une référence de catalogue qui doit être protégée ; toute référence qu'elle contient est doublée d'une ligne typée.** `up_sql` est un tableau ordonné d'énoncés, pas un bloc de texte ; `ast` est doublé par `field_formula_dependency` ; `spec` en sortira le jour où un filtre devra empêcher la suppression du champ qu'il référence.

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| `_basedb.physical_name` seul détenteur des noms ; aucune colonne de nom ailleurs (A5) | Deux copies divergent, et une seule ligne modifiée suffit à faire mentir le catalogue | Colonnes `physical_name`/`schema_name` sur chaque objet, plus un second registre |
| Registre sans `object_id` : la référence va du catalogue vers le registre | Une seule direction, donc une seule chose à maintenir | Double référencement, invérifiable |
| Portée d'unicité = le schéma pour les relations, la table pour les champs | Sans cela, les vues SQL d'alias ne peuvent pas porter le nom des tables réelles | Portée = la base |
| Clés étrangères composites `(name_id, portée)` | Interdit d'attacher à un objet un nom alloué sous une autre portée | `name_id` simple, vérifié en code |
| Budgets et motifs du chapitre 01 (A6), sans désambiguïsateur inséré | Un nom dérivé doit rester lisible dans un message d'erreur PostgreSQL | `<id12>` avant la partie variable ; noms de tables limités à 29 octets |
| PostgreSQL 16 minimum (A1) | `pg_input_is_valid`, `EXPLAIN (GENERIC_PLAN)`, `reltuples = -1`, `NULLS NOT DISTINCT` | 14 ou 15, au prix d'index d'expression illisibles |
| `uuid_generate_v7()` et `set_updated_at()` dans `_basedb_local`, nom figé (A9) | Le nom est écrit dans le `DEFAULT` de `_id` de toutes les tables : le rendre variable imposerait un `ALTER` général | Cinq emplacements concurrents, ou un schéma configurable |
| Satellites typés 1:1 par famille de types | Rend possible une vraie clé étrangère de `field_link_config` vers `table_def` | `config jsonb` sur `field`, qui déplace toute la validation dans le code |
| Colonnes miroir + clés étrangères composites pour les invariants transverses | Refus immédiat, nommé, insensible à la concurrence | Déclencheurs PL/pgSQL, sujets aux courses sous `READ COMMITTED` |
| Liste close de trois déclencheurs de catalogue, publiée ici | « Au moins une ligne » n'est pas déclarable ; le reste l'est | Interdire tout déclencheur, puis en poser ailleurs sans le dire |
| États physiques nommés et partagés (`physical_state`), portés par le catalogue (A11) | Une migration en plusieurs étapes doit pouvoir être reprise là où elle s'est arrêtée | Booléens `*_validated_at` épars, incapables de dire « en construction » |
| `table_constraint` + `table_constraint_member`, `table_index` + `table_index_member` | Seul moyen de savoir quelles colonnes composent une contrainte composite, ce dont dépend la clôture des contraintes croisées du chapitre 05 | Colonnes de nom de contrainte éparpillées sur `field` et ses satellites |
| Pas de `field.is_unique` ni de `field.unique_state` | Une unicité peut être composite : son état ne peut pas vivre sur un champ | Dupliquer l'état sur le champ et sur la contrainte |
| `migration.up_sql` en `jsonb`, `sequence` nullable avec index unique partiel (A12) | Un plan est une suite ordonnée d'énoncés ; le numéro d'ordre n'a de sens qu'à l'exécution | Bloc de texte et `sequence NOT NULL` dès la proposition |
| Bail d'exécution porté par `migration`, pas par `base` | Une seule ligne à relire pour savoir qui exécute quoi et jusqu'à quand | Bail dupliqué sur la base |
| Clause émise `ON DELETE NO ACTION` pour `restrict` (A13), attendue en `confdeltype = 'a'` | Même refus, vérifié en fin d'instruction : une suppression en lot hiérarchique cesse d'échouer sans raison métier | Attendre `'r'`, ce qui ferait de chaque clé étrangère une dérive |
| Colonne d'affichage : nullable, refus explicite, aucune bascule (A15) | Une bascule change sans prévenir ce que voient tous les consommateurs de tous les liens | Repli automatique vers le champ suivant ou vers `_id` |
| La purge conserve la ligne de catalogue (A22) ; épuration de second niveau distincte | Donne un référent à l'audit et à la réconciliation, rend observables les index partiels | Supprimer la ligne à la purge |
| Aucune ligne de registre n'est jamais détruite, même en état `purged` | Un nom réémis créerait des homonymes à travers le temps dans l'historique et les migrations rejouables | Épurer le registre avec les pierres tombales |
| Registre des classes de verrous, clé entière attribuée et stockée (A8) | `hashtext()` n'est pas documentée, a déjà changé d'algorithme, et collisionne entre bases sans rapport | `pg_advisory_lock(hashtext('…'))` ; trois espaces de clés concurrents |
| Capture par déclencheur vers `_basedb_local`, drain vers `_basedb` (A10) | Une écriture SQL directe doit être historisée comme les autres, sans transaction sur deux pools | `_outbox` dans le schéma de données ; alimentation applicative ; `webhook_outbox` |
| `webhook_delivery` ne porte que la référence, jamais le corps | Un lot de mille modifications écrirait des gigaoctets dans le catalogue | Charge utile recopiée par livraison |
| Un utilisateur appartient à exactement un tenant | Le contexte d'acteur porte toujours un `tenant_id` figé, sans bascule ni sélecteur | Table d'appartenance multiple |
| Permissions à portées typées, avec de vraies clés étrangères | `permission` est la table la plus sensible ; une référence polymorphe n'est pas contraignable | `scope_id uuid` sans clé étrangère |
| `COLLATE "C"` sur tous les identifiants et clés de comparaison | Une mise à jour de collation système réordonne un index unique et laisse passer des doublons | Collation par défaut de la base d'accueil |
| Index **non partiel** côté référençant de chaque clé étrangère, liste établie par `CAT-IDX` | La vérification interne d'intégrité ne porte pas le prédicat d'un index partiel, et une liste tenue à la main se périme | S'appuyer sur les index partiels ; maintenir l'énumération dans le texte |
| Réconciliation comparant les propriétés, classes préfixées par chapitre | Un `RESTRICT` devenu `CASCADE` doit être vu ; une lettre nue est inexploitable dans un rapport | Comparaison de `conname` ; lettres A à G réutilisées par cinq chapitres |
| Registre des codes d'erreur et table des rétentions dans le catalogue (A23, A24) | Un code par condition, une durée par objet, et les deux vérifiables par requête | Codes dispersés, valeurs de rétention citées de mémoire |
| `security_log` en base, partitionné, sans clé étrangère (A24) | La détection d'une énumération doit survivre à un redémarrage et à l'épuration de l'acteur qu'elle met en cause | Journal technique hors base, ou entrées mêlées à `audit_log` |
| **Aucune table de compteurs par fenêtre glissante**, ni par jeton ni par identité | Un compteur lu et incrémenté à chaque appel mettrait une écriture en base sur le chemin de chaque requête et ferait du contrôle de débit un point de contention global | Compteurs synchrones en base ; la suspension est décidée en différé depuis `security_log`, le verrouillage d'identité par `auth_identity` |

## Risques et limites connues

1. **Le propriétaire de la base peut lire tout `_basedb`.** Sans `CREATEROLE`, aucun cloisonnement SQL n'est possible. La parade est la forme des données — empreintes argon2id et SHA-256, secrets chiffrés par une clé hors base (A25) —, pas les droits. Un second rôle en lecture seule restreint aux schémas `b_*` relève de l'administrateur d'instance.
2. **La véracité de l'autorisation d'un `ON DELETE CASCADE` reste du ressort du service.** La base garantit l'existence, l'auteur, l'horodatage et la confirmation ; elle ne peut pas garantir que cet auteur était administrateur, sous peine de rendre impossible toute rétrogradation.
3. **La forme du nom de schéma n'est plus contrainte par le catalogue.** Les noms vivant au registre, l'assemblage `b_<tenantId>_<base>` est une propriété de l'allocation (chapitre 01 §5), vérifiée par `CAT-NAME`, non par un `CHECK`. C'est le prix du registre unique, et il est assumé.
4. **Quatre invariants ne sont pas déclarables** (I26 à I29) : ils relient deux espaces que rien ne peut contraindre ensemble. Leur filet est la réconciliation, dont la fiabilité dépend du régime `REPEATABLE READ` et de la prise du verrou de structure.
5. **Le coût d'écriture du catalogue est délibérément élevé** : cinq index uniques redondants sur `field`, un index non partiel par colonne référençante, une ligne de registre par objet physique. C'est le prix des invariants déclaratifs, payé sur des tables dont les écritures sont rares.
6. **Croissance monotone du registre des noms.** Rien n'est jamais libéré. Un cycle création/suppression répété sur le même libellé épuise les suffixes `_2`…`_99` et finit par échouer.
7. **La partition `DEFAULT` est un filet, pas un mode nominal.** Si elle se remplit, l'attachement de la partition suivante impose un balayage sous `ACCESS EXCLUSIVE`. La tâche vérifie et alerte.
8. **Les compteurs d'accès aux alias ne voient pas les consommateurs SQL directs.** C'est une limite du périmètre de privilèges, pas une omission ; l'écran de renommage le dit à l'utilisateur.
9. **Aucune réplique en lecture n'est possible en l'état**, du fait des écritures d'usage sur des chemins de lecture.

## Questions ouvertes

1. **Second rôle PostgreSQL en lecture seule.** Le déploiement doit-il exiger de l'administrateur d'instance un rôle restreint aux schémas `b_*`, pour que les consommateurs SQL directs ne lisent pas `_basedb` ? L'outil n'a pas les privilèges de le créer lui-même.
2. **Réplique en lecture.** Objectif à moyen terme ? Si oui, les écritures d'usage doivent être isolées dès la phase 2 plutôt qu'après coup.
3. **Utilisateur d'amorçage visible.** L'utilisateur système apparaît comme auteur des actes du moteur. Faut-il l'afficher sous un libellé particulier dans l'interface, ou le masquer ?

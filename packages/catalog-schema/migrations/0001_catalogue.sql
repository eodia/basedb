-- 0001_catalogue.sql — the `_basedb` catalog and the colocated `_basedb_local` schema
--
-- GENERATED FILE from docs/architecture/02-catalogue.md.
-- Regenerate with: node scripts/extract-catalog-ddl.mjs --write
--
-- Chapter 02 is authoritative on the catalog: every correction is made in the
-- document, never here.
--
-- 111 statements, topologically sorted. The chapter order is a reading order,
-- not an application order: the name registry references `app_user`, which belongs to
-- the next domain.


-- ────────────────────────────────────────────────────────────────────────
-- Le schéma colocalisé `_basedb_local` (chapter 02, line 84)
-- ────────────────────────────────────────────────────────────────────────
CREATE SCHEMA _basedb;

CREATE SCHEMA _basedb_local;

-- Pliage casse et accents — chapitre 04 §1.8, qui fait autorité sur le corps.
--
-- Ce fichier est CONFRONTÉ au document par un test : toute divergence, dans un sens
-- comme dans l'autre, fait échouer la suite. Le corps ne se corrige donc pas ici.
--
-- La fonction n'est JAMAIS remplacée. Un `CREATE OR REPLACE` ultérieur rendrait faux,
-- sans aucune erreur, tous les index d'expression bâtis sur elle : une évolution du
-- pliage crée `fold_v2` et reconstruit les index des champs concernés.

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

COMMENT ON FUNCTION _basedb_local.fold_v1(text) IS
  'Pliage casse et accents, version 1. Immuable : jamais remplacée, une évolution crée fold_v2.';

-- Fonctions des déclencheurs du catalogue.
--
-- FICHIER ÉCRIT À LA MAIN, à la différence du reste de la migration.
--
-- Le chapitre 02 donne la liste close des déclencheurs du catalogue et le rôle de
-- chacun, mais pas le corps de leurs fonctions : c'est le bon niveau pour un document
-- d'architecture. Elles sont donc écrites ici, et le générateur les injecte en tête de
-- la migration.
--
-- `check_function_bodies` ne valide pas l'existence des relations citées dans un corps
-- PL/pgSQL : ces fonctions peuvent donc être créées avant les tables qu'elles lisent.

-- ─────────────────────────────────────────────────────────────────────────────
-- ck_field_config_present — « Exige une ligne de satellite pour tout `kind` dont
-- `has_config` est vrai » (chapitre 02, « Les déclencheurs du catalogue »).
--
-- Contrainte différée : vérifiée au COMMIT, donc compatible avec l'ordre naturel
-- d'écriture — le champ puis son satellite — dans une même transaction.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION _basedb.assert_field_config_present() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_has_config boolean;
  v_present    boolean;
BEGIN
  SELECT has_config INTO v_has_config
    FROM _basedb.field_kind
   WHERE code = NEW.kind;

  IF NOT COALESCE(v_has_config, false) THEN
    RETURN NULL;
  END IF;

  -- Un satellite par FAMILLE de types : `short_text` et `long_text` partagent
  -- `field_text_config`, `date` et `datetime` partagent `field_datetime_config`.
  v_present := CASE NEW.kind
    WHEN 'short_text' THEN EXISTS (SELECT 1 FROM _basedb.field_text_config     WHERE field_id = NEW.id)
    WHEN 'long_text'  THEN EXISTS (SELECT 1 FROM _basedb.field_text_config     WHERE field_id = NEW.id)
    WHEN 'number'     THEN EXISTS (SELECT 1 FROM _basedb.field_number_config   WHERE field_id = NEW.id)
    WHEN 'boolean'    THEN EXISTS (SELECT 1 FROM _basedb.field_boolean_config  WHERE field_id = NEW.id)
    WHEN 'date'       THEN EXISTS (SELECT 1 FROM _basedb.field_datetime_config WHERE field_id = NEW.id)
    WHEN 'datetime'   THEN EXISTS (SELECT 1 FROM _basedb.field_datetime_config WHERE field_id = NEW.id)
    WHEN 'select'     THEN EXISTS (SELECT 1 FROM _basedb.field_select_config   WHERE field_id = NEW.id)
    WHEN 'link'       THEN EXISTS (SELECT 1 FROM _basedb.field_link_config     WHERE field_id = NEW.id)
    WHEN 'formula'    THEN EXISTS (SELECT 1 FROM _basedb.field_formula_config  WHERE field_id = NEW.id)
    -- Un `kind` ajouté au catalogue sans être câblé ici doit échouer bruyamment,
    -- jamais passer en silence.
    ELSE NULL
  END;

  IF v_present IS NULL THEN
    RAISE EXCEPTION
      'FIELD_CONFIG_MISSING: type de champ % non cable dans assert_field_config_present', NEW.kind
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT v_present THEN
    RAISE EXCEPTION
      'FIELD_CONFIG_MISSING: champ % de type % sans ligne de configuration', NEW.id, NEW.kind
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END
$fn$;

COMMENT ON FUNCTION _basedb.assert_field_config_present() IS
  'Exige une ligne de satellite pour tout kind dont has_config est vrai. « Au moins une ligne » n''est pas exprimable en SQL déclaratif.';

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


-- ────────────────────────────────────────────────────────────────────────
-- États physiques (chapter 02, line 202)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Registre des classes de verrous consultatifs (chapter 02, line 341)
-- ────────────────────────────────────────────────────────────────────────
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

CREATE SEQUENCE _basedb.lock_key_seq AS integer START 2;

-- 1 = portee instance


-- ────────────────────────────────────────────────────────────────────────
-- Champs (chapter 02, line 702)
-- ────────────────────────────────────────────────────────────────────────
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
 ('link',      'Lien',           false, true),
 ('formula',   'Formule',        true,  true);


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 4 — Intégrations et configuration (chapter 02, line 1180)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Versionnement du catalogue lui-même (chapter 02, line 1456)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.catalog_migration (
  version     integer PRIMARY KEY,           -- 1, 2, 3... strictement sequentiel
  name        text NOT NULL,
  checksum    bytea NOT NULL,                -- SHA-256 du fichier .sql livre
  applied_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  app_release text NOT NULL,
  duration_ms integer NOT NULL
);


-- ────────────────────────────────────────────────────────────────────────
-- Journal d'audit (chapter 02, line 1478)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Journal de sécurité (chapter 02, line 1511)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Capture et drain (chapter 02, line 1560)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Registre des codes d'erreur et rétentions (chapter 02, line 1654)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.error_code (
  code        text COLLATE "C" PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  origin      text NOT NULL,      -- chapitre qui definit la condition
  level       text NOT NULL CHECK (level IN
                ('validation','conflict','permission','incident','startup','warning')),
  http_status smallint NULL,
  description text NOT NULL
);


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 4 — Intégrations et configuration (chapter 02, line 1180)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Registre des codes d'erreur et rétentions (chapter 02, line 1685)
-- ────────────────────────────────────────────────────────────────────────
-- Valeurs semees par la migration de catalogue initiale (A24).
--  record_revision      24 mois     audit_log            24 mois
--  structure_revision   60 mois     webhook_delivery     90 jours
--  change_event          7 jours    catalog_tombstone    12 mois
--  security_log        180 jours    migration_error_sample 30 jours
--  ai_call              24 mois


-- ────────────────────────────────────────────────────────────────────────
-- Le registre `_basedb.physical_name` (chapter 02, line 267)
-- ────────────────────────────────────────────────────────────────────────
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
  allocated_by uuid NOT NULL,
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


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 2 — Identité, sessions, permissions (chapter 02, line 367)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.tenant (
  id             uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  ref            text COLLATE "C" NOT NULL,   -- tenantId : 't' + 6 caracteres
  label          text NOT NULL,
  is_system      boolean NOT NULL DEFAULT false,
  authz_version  bigint NOT NULL DEFAULT 1,   -- incremente a toute ecriture d'autorisation
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by     uuid NOT NULL,
  deleted_at     timestamptz NULL,
  deleted_by     uuid NULL,
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

CREATE TABLE _basedb.role (
  id        uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  label     text NOT NULL,
  label_key text COLLATE "C" NOT NULL,
  name      text COLLATE "C" NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
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


-- ────────────────────────────────────────────────────────────────────────
-- Bases, schémas, alias (chapter 02, line 546)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.base (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id   uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  label       text NOT NULL,
  label_key   text COLLATE "C" NOT NULL,
  description text NULL,
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
  CONSTRAINT ck_base_live  CHECK (is_live = (deleted_at IS NULL)),
  CONSTRAINT ck_base_purge CHECK (is_purged = (purged_at IS NOT NULL)
                                  AND (purged_at IS NULL OR deleted_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_base_label_live
  ON _basedb.base (tenant_id, label_key) WHERE deleted_at IS NULL;

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


-- ────────────────────────────────────────────────────────────────────────
-- Tables (chapter 02, line 635)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.table_def (
  id           uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id      uuid NOT NULL,
  base_is_live boolean NOT NULL DEFAULT true,
  schema_id    uuid NOT NULL,
  name_id      uuid NOT NULL,
  label        text NOT NULL,
  label_key    text COLLATE "C" NOT NULL,
  description  text NULL,
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
  CONSTRAINT ck_display_kind CHECK (display_field_id IS NULL OR display_field_can_be_display)
);


-- ────────────────────────────────────────────────────────────────────────
-- Vue de confort : le nom qualifié (chapter 02, line 315)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Bases, schémas, alias (chapter 02, line 546)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.sql_view_alias (
  id              uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  schema_id       uuid NOT NULL REFERENCES _basedb.db_schema(id) ON DELETE RESTRICT,
  target_table_id uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE RESTRICT,
  name_id         uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  dropped_at timestamptz NULL,
  CONSTRAINT uq_view_alias_name UNIQUE (name_id)
);


-- ────────────────────────────────────────────────────────────────────────
-- Tables (chapter 02, line 635)
-- ────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_table_label_live
  ON _basedb.table_def (base_id, label_key) WHERE deleted_at IS NULL;

CREATE INDEX idx_table_by_base
  ON _basedb.table_def (base_id, position) WHERE deleted_at IS NULL;


-- ────────────────────────────────────────────────────────────────────────
-- Champs (chapter 02, line 702)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 2 — Identité, sessions, permissions (chapter 02, line 481)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.field_permission (
  id       uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  role_id  uuid NOT NULL REFERENCES _basedb.role(id)  ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES _basedb.field(id) ON DELETE CASCADE,
  access   text NOT NULL CHECK (access IN ('hidden','read','write')),
  CONSTRAINT uq_field_permission UNIQUE (role_id, field_id)
);


-- ────────────────────────────────────────────────────────────────────────
-- Champs (chapter 02, line 702)
-- ────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_field_label_live
  ON _basedb.field (table_id, label_key) WHERE deleted_at IS NULL;

CREATE INDEX idx_field_by_table
  ON _basedb.field (table_id, position) WHERE deleted_at IS NULL;


-- ────────────────────────────────────────────────────────────────────────
-- Configuration par type : satellites 1:1, pas de `jsonb` (chapter 02, line 796)
-- ────────────────────────────────────────────────────────────────────────
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
  CONSTRAINT ck_formula_result CHECK (result_kind NOT IN ('formula','link'))
);

CREATE TABLE _basedb.select_option (
  id         uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  field_id   uuid NOT NULL REFERENCES _basedb.field(id) ON DELETE CASCADE,
  value      text COLLATE "C" NOT NULL,   -- valeur stockee dans la colonne PostgreSQL
  label      text NOT NULL,
  color      text NULL,
  position   integer NOT NULL,
  deleted_at timestamptz NULL
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


-- ────────────────────────────────────────────────────────────────────────
-- Contraintes et index des tables utilisateur (chapter 02, line 921)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Configuration par type : satellites 1:1, pas de `jsonb` (chapter 02, line 796)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.field_select_config (
  field_id uuid PRIMARY KEY,
  kind     text COLLATE "C" NOT NULL DEFAULT 'select' CHECK (kind = 'select'),
  enum_constraint_id uuid NOT NULL REFERENCES _basedb.table_constraint(id)
                       ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_select_field FOREIGN KEY (field_id, kind)
    REFERENCES _basedb.field (id, kind) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT uq_select_enum UNIQUE (enum_constraint_id)
);


-- ────────────────────────────────────────────────────────────────────────
-- Contraintes et index des tables utilisateur (chapter 02, line 921)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Champs lien (chapter 02, line 1004)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Colonne d'affichage (chapter 02, line 1066)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Applications et vues enregistrées (chapter 02, line 1122)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 2 — Identité, sessions, permissions (chapter 02, line 481)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.permission (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  role_id uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE CASCADE,
  scope_kind text NOT NULL CHECK (scope_kind IN ('tenant','base','application','table')),
  scope_base_id        uuid NULL REFERENCES _basedb.base(id)        ON DELETE CASCADE,
  scope_application_id uuid NULL REFERENCES _basedb.application(id) ON DELETE CASCADE,
  scope_table_id       uuid NULL REFERENCES _basedb.table_def(id)   ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN
    ('read','create','update','delete','manage_schema','manage_permissions','manage_tokens')),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  granted_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_permission_scope CHECK (
    num_nonnulls(scope_base_id, scope_application_id, scope_table_id)
      = CASE scope_kind WHEN 'tenant' THEN 0 ELSE 1 END
    AND (scope_kind <> 'base'        OR scope_base_id        IS NOT NULL)
    AND (scope_kind <> 'application' OR scope_application_id IS NOT NULL)
    AND (scope_kind <> 'table'       OR scope_table_id       IS NOT NULL)),
  CONSTRAINT uq_permission UNIQUE NULLS NOT DISTINCT
    (role_id, scope_kind, scope_base_id, scope_application_id, scope_table_id, action)
);


-- ────────────────────────────────────────────────────────────────────────
-- Applications et vues enregistrées (chapter 02, line 1122)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 4 — Intégrations et configuration (chapter 02, line 1180)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.api_token (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  label text NOT NULL,
  token_prefix text COLLATE "C" NOT NULL CHECK (length(token_prefix) = 8),
  token_hash bytea NOT NULL,          -- SHA-256 du secret ; le secret n'est jamais stocke
  role_id uuid NOT NULL,
  base_id uuid NULL,
  allowed_surfaces text[] NOT NULL DEFAULT ARRAY['rest']::text[],
  expires_at timestamptz NOT NULL,    -- obligatoire, sans exception
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


-- ────────────────────────────────────────────────────────────────────────
-- Migrations de structures utilisateur (chapter 02, line 1355)
-- ────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────
-- Registre des codes d'erreur et rétentions (chapter 02, line 1685)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE _basedb.retention_policy (
  object           text COLLATE "C" PRIMARY KEY,
  default_interval interval NOT NULL,
  current_interval interval NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
);


-- ────────────────────────────────────────────────────────────────────────
-- Les déclencheurs du catalogue (chapter 02, line 1715)
-- ────────────────────────────────────────────────────────────────────────
-- Verifie au COMMIT, donc compatible avec l'ordre naturel d'ecriture
-- (champ puis satellite) dans une meme transaction.
CREATE CONSTRAINT TRIGGER ck_field_config_present
  AFTER INSERT OR UPDATE ON _basedb.field
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _basedb.assert_field_config_present();


-- ────────────────────────────────────────────────────────────────────────
-- Le registre `_basedb.physical_name` (chapter 02, line 267)
-- ────────────────────────────────────────────────────────────────────────
-- Deferred constraint: _basedb.physical_name.allocated_by → _basedb.app_user, creation cycle.
--
-- DEFERRABLE INITIALLY DEFERRED: a CREATION cycle is almost always an INSERTION
-- cycle too. `tenant.created_by` requires an `app_user`, whose `tenant_id`
-- requires a `tenant`: without deferring the check to COMMIT, the product's very
-- first bootstrap would be impossible. Chapter 02 already applies this regime to
-- the `table_def` ↔ `field` cycle.
ALTER TABLE _basedb.physical_name
  ADD CONSTRAINT fk_physical_name__allocated_by FOREIGN KEY (allocated_by)
  REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;


-- ────────────────────────────────────────────────────────────────────────
-- Domaine 2 — Identité, sessions, permissions (chapter 02, line 367)
-- ────────────────────────────────────────────────────────────────────────
-- Deferred constraint: _basedb.tenant.created_by → _basedb.app_user, creation cycle.
--
-- DEFERRABLE INITIALLY DEFERRED: a CREATION cycle is almost always an INSERTION
-- cycle too. `tenant.created_by` requires an `app_user`, whose `tenant_id`
-- requires a `tenant`: without deferring the check to COMMIT, the product's very
-- first bootstrap would be impossible. Chapter 02 already applies this regime to
-- the `table_def` ↔ `field` cycle.
ALTER TABLE _basedb.tenant
  ADD CONSTRAINT fk_tenant__created_by FOREIGN KEY (created_by)
  REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- Deferred constraint: _basedb.tenant.deleted_by → _basedb.app_user, creation cycle.
--
-- DEFERRABLE INITIALLY DEFERRED: a CREATION cycle is almost always an INSERTION
-- cycle too. `tenant.created_by` requires an `app_user`, whose `tenant_id`
-- requires a `tenant`: without deferring the check to COMMIT, the product's very
-- first bootstrap would be impossible. Chapter 02 already applies this regime to
-- the `table_def` ↔ `field` cycle.
ALTER TABLE _basedb.tenant
  ADD CONSTRAINT fk_tenant__deleted_by FOREIGN KEY (deleted_by)
  REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- Index des colonnes référençantes du catalogue.
--
-- FICHIER ÉCRIT À LA MAIN, à la différence du DDL engendré.
--
-- Le chapitre 02, « Indexation des clés étrangères du catalogue », pose la règle :
--
--   « Toute colonne référençante d'une clé étrangère du catalogue porte un index non
--     partiel, en plus des index partiels de service. »
--
-- et précise que les blocs DDL du chapitre les OMETTENT délibérément, « où ils
-- noieraient la structure », la liste n'étant « pas tenue à la main » mais établie
-- mécaniquement par la dérive CAT-IDX.
--
-- C'est donc ce bloc qui l'établit. PostgreSQL indexe le côté référencé d'une clé
-- étrangère, jamais le côté référençant : sans cet index, chaque suppression de clé
-- parente déclenche un balayage séquentiel de la table enfant avec pose de verrous de
-- ligne. Le piège, dans un catalogue truffé d'index partiels, est que cette
-- vérification interne NE PORTE PAS le prédicat du partiel — d'où l'exigence d'un
-- index non partiel.
--
-- Idempotent : relancer la migration ne crée rien de nouveau.

DO $ix$
DECLARE
  r      record;
  nom    text;
  base   text;
BEGIN
  FOR r IN
    SELECT
      c.conrelid::regclass::text AS relation,
      rel.relname                AS table_courte,
      (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS colonnes,
      (SELECT string_agg(a.attname, '__' ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS suffixe
    FROM pg_constraint c
    JOIN pg_namespace n   ON n.oid = c.connamespace
    JOIN pg_class     rel ON rel.oid = c.conrelid
   WHERE n.nspname = '_basedb'
     AND c.contype = 'f'
     -- Aucun index NON PARTIEL dont la clé commence par les colonnes de la contrainte.
     -- `indkey::smallint[]` est un tableau à base 0, d'où le découpage à partir de 0.
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indpred IS NULL
          AND (i.indkey::smallint[])[0:array_length(c.conkey, 1) - 1] = c.conkey
     )
   ORDER BY 1, 2
  LOOP
    -- Motif normatif du chapitre 01 §9.1 : `ix_<table>__<colonne>[__<colonne>…]`.
    base := 'ix_' || r.table_courte || '__' || r.suffixe;

    -- Budget de 63 octets (A6). La troncature est dure, puis le `_` final retiré ;
    -- une collision de nom reste possible en théorie et ferait échouer la migration
    -- bruyamment, ce qui est préférable à un index silencieusement absent.
    nom := rtrim(left(base, 63), '_');

    EXECUTE format('CREATE INDEX %I ON %s (%s)', nom, r.relation, r.colonnes);
  END LOOP;
END
$ix$;

-- Compteurs d'invalidation : `base.catalog_version` et `tenant.authz_version`.
--
-- FICHIER ÉCRIT À LA MAIN, comme les autres fonctions de déclencheurs.
--
-- Le chapitre 02 (§ « Chargement du schéma ») et le chapitre 05 (§7.2) donnent le rôle
-- de ces deux compteurs et exigent qu'ils soient incrémentés DANS LA MÊME TRANSACTION
-- que l'écriture qui les concerne. D'où des déclencheurs, et non un incrément applicatif :
-- la promesse du produit est qu'on écrive en SQL direct, donc tout compteur tenu par
-- l'application serait faux dès le premier `INSERT` passé à côté d'elle — et un cache
-- qui s'y fie servirait indéfiniment une structure qui n'existe plus.
--
-- `NOTIFY` part à la validation, jamais sur un travail annulé. Un processus qui a manqué
-- une notification le détecte par comparaison du compteur, qui est monotone.

-- ─────────────────────────────────────────────────────────────────────────────
-- catalog_version — toute modification de structure d'une base
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _basedb.bump_catalog_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cible uuid;
BEGIN
  cible := CASE WHEN TG_OP = 'DELETE' THEN OLD.base_id ELSE NEW.base_id END;
  IF cible IS NOT NULL THEN
    UPDATE _basedb.base SET catalog_version = catalog_version + 1 WHERE id = cible;
    PERFORM pg_notify('basedb_catalog', cible::text);
  END IF;
  RETURN NULL;   -- AFTER trigger : la valeur retournée est ignoree
END;
$$;

COMMENT ON FUNCTION _basedb.bump_catalog_version() IS
  'Incremente base.catalog_version et notifie basedb_catalog, dans la transaction de l ecriture.';

-- Le satellite de texte ne porte pas `base_id` : il se rattache par son champ. Les
-- autres satellites suivront la même forme le jour où la projection les lira.
CREATE OR REPLACE FUNCTION _basedb.bump_catalog_version_by_field() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cible uuid;
BEGIN
  SELECT f.base_id INTO cible
    FROM _basedb.field f
   WHERE f.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.field_id ELSE NEW.field_id END;
  IF cible IS NOT NULL THEN
    UPDATE _basedb.base SET catalog_version = catalog_version + 1 WHERE id = cible;
    PERFORM pg_notify('basedb_catalog', cible::text);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_catalog_version_table_def
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.table_def
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version();

CREATE TRIGGER tg_catalog_version_field
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version();

CREATE TRIGGER tg_catalog_version_link
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_link_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version();

CREATE TRIGGER tg_catalog_version_schema
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.db_schema
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version();

CREATE TRIGGER tg_catalog_version_text_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_text_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version_by_field();

-- Les options d'une liste de choix sont lues par la projection : sans ce declencheur,
-- renommer une option laisse le cache servir l'ancien libelle jusqu'a ce qu'autre chose
-- fasse bouger le compteur. La regle est simple : tout ce que la projection lit doit
-- faire avancer la version.
CREATE TRIGGER tg_catalog_version_select_option
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.select_option
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version_by_field();

-- ─────────────────────────────────────────────────────────────────────────────
-- authz_version — le SEUL compteur d'invalidation des droits (05 §7.2)
--
-- « Toute écriture sur role, role_member, permission, field_permission, api_token,
--   webhook, session ou app_user émet le NOTIFY dans la même transaction et incrémente
--   tenant.authz_version. »
--
-- Il n'en existe aucun autre, sous aucun autre nom : deux compteurs pour la même chose
-- divergent dès la première écriture.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _basedb.bump_authz_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ligne   record;
  cible   uuid;
BEGIN
  ligne := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- Le chemin vers le tenant diffère selon la table : direct quand la colonne existe,
  -- par le rôle ou par l'utilisateur sinon.
  CASE TG_TABLE_NAME
    WHEN 'role', 'app_user' THEN
      cible := ligne.tenant_id;
    WHEN 'permission', 'field_permission', 'role_member' THEN
      SELECT r.tenant_id INTO cible FROM _basedb.role r WHERE r.id = ligne.role_id;
    WHEN 'session', 'api_token' THEN
      SELECT u.tenant_id INTO cible FROM _basedb.app_user u WHERE u.id = ligne.user_id;
    WHEN 'webhook' THEN
      cible := ligne.tenant_id;
    ELSE
      cible := NULL;
  END CASE;

  IF cible IS NOT NULL THEN
    UPDATE _basedb.tenant SET authz_version = authz_version + 1 WHERE id = cible;
    PERFORM pg_notify('basedb_authz', cible::text);
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION _basedb.bump_authz_version() IS
  'Incremente tenant.authz_version et notifie basedb_authz, dans la transaction de l ecriture.';

CREATE TRIGGER tg_authz_version_role
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.role
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_role_member
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.role_member
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_permission
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.permission
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_field_permission
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_permission
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_app_user
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.app_user
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_session
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.session
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_api_token
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.api_token
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

CREATE TRIGGER tg_authz_version_webhook
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.webhook
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

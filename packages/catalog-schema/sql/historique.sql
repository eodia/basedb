-- ════════════════════════════════════════════════════════════════════════
-- Historique des données — chapitre 07 (normatif sur ces objets).
--
-- La capture vit dans _basedb_local, colocalisée avec les données (A9) : aucun
-- déclencheur d'un schéma b_* ne lit ni n'écrit _basedb. Les journaux vivent dans
-- _basedb, alimentés par le drain et par lui seul.
-- ════════════════════════════════════════════════════════════════════════

-- Indicateur d'abonnement (§11.3), une ligne par table, colocalisé avec les tampons.
-- Absente, la capture écrit l'événement : on ne perd jamais un événement par prudence.
-- Le noyau pose is_active = false à la création de la table, et le chapitre 08 le
-- bascule avec les abonnements.
CREATE TABLE _basedb_local.change_feed_state (
  table_id     uuid PRIMARY KEY,
  is_active    boolean NOT NULL DEFAULT false,
  full_payload boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- TRUNCATE ne déclenche aucun déclencheur DML : il est donc refusé (§1.5).
CREATE FUNCTION _basedb_local.assert_no_truncate() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
AS $fn$
BEGIN
  RAISE EXCEPTION 'TRUNCATE_FORBIDDEN: vider une table passe par DELETE, qui est historisé'
    USING ERRCODE = 'raise_exception';
END
$fn$;

-- La capture (§1.3). SECURITY DEFINER et non INVOKER : la console SQL écrit sous un rôle
-- restreint qui n'a aucun droit sur _basedb_local, et ne doit pas en avoir — lui donner
-- l'insertion dans les tampons lui permettrait de fabriquer un historique. La fonction
-- s'exécute donc avec les droits du propriétaire, et fixe elle-même son environnement.
CREATE FUNCTION _basedb_local.capture_v1() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog
  SET "TimeZone" = 'UTC'
  SET "DateStyle" = 'ISO, YMD'
  SET "IntervalStyle" = 'iso_8601'
  SET extra_float_digits = 0
AS $fn$
DECLARE
  v_base      uuid     := TG_ARGV[0]::uuid;
  v_table     uuid     := TG_ARGV[1]::uuid;
  v_format    smallint := TG_ARGV[2]::smallint;
  v_raw_actor text     := nullif(current_setting('basedb.actor_id', true), '');
  v_raw_kind  text     := nullif(current_setting('basedb.actor_kind', true), '');
  v_raw_token text     := nullif(current_setting('basedb.token_id', true), '');
  v_raw_bulk  text     := nullif(current_setting('basedb.bulk_id', true), '');
  v_kind      text;
  v_actor     uuid;
  v_token     uuid;
  v_bulk      uuid;
  v_identity  text;
  v_feed      boolean;
  v_full      boolean;
  v_select    text;
  v_count     bigint;
  v_total     bigint;
BEGIN
  -- Identité (§2) : lue avec tolérance, jamais une raison de refuser l'écriture.
  IF v_raw_actor IS NULL THEN
    v_kind := 'sql_direct';
    v_identity := concat_ws(' · ',
      'session ' || pg_backend_pid()::text,
      coalesce(host(inet_client_addr()), 'connexion locale'),
      nullif(current_setting('application_name', true), ''),
      session_user::text);
  ELSE
    BEGIN
      v_actor := v_raw_actor::uuid;
      v_kind := CASE WHEN v_raw_kind IN ('user', 'token', 'mcp', 'system', 'form', 'automation')
                     THEN v_raw_kind ELSE 'unknown' END;
    EXCEPTION WHEN invalid_text_representation THEN
      v_actor := NULL;
      v_kind := 'unknown';
      v_identity := v_raw_actor;
    END;
    IF v_raw_token IS NOT NULL THEN
      BEGIN
        v_token := v_raw_token::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_token := NULL;
      END;
    END IF;
    -- Un jeton sans identifiant exploitable n'est pas un jeton : la contrainte de
    -- record_revision l'exige, et la ligne ne doit jamais faire échouer l'écriture.
    IF v_kind = 'token' AND v_token IS NULL THEN
      v_kind := 'unknown';
      v_identity := coalesce(v_identity, v_raw_token);
    END IF;
  END IF;

  IF v_raw_bulk IS NOT NULL THEN
    BEGIN
      v_bulk := v_raw_bulk::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_bulk := NULL;
    END;
  END IF;

  -- Le SELECT des lignes, selon l'opération. Aucune instruction statique ne cite les
  -- tables de transition : leur forme change d'une table à l'autre, et un plan mis en
  -- cache serait celui de la première table capturée.
  --
  -- Les alias commencent par « _ », qu'aucun nom physique ne peut porter : `to_jsonb(n)`
  -- serait ambigu sur une table qui a une colonne `n` — un champ « N° » —, et chaque
  -- écriture de cette table échouerait.
  IF TG_OP = 'INSERT' THEN
    v_select := 'SELECT _n."_id" AS record_id, NULL::jsonb AS before, pg_catalog.to_jsonb(_n) AS after
                   FROM new_rows _n';
  ELSIF TG_OP = 'UPDATE' THEN
    v_select := 'SELECT _n."_id" AS record_id, pg_catalog.to_jsonb(_o) AS before, pg_catalog.to_jsonb(_n) AS after
                   FROM old_rows _o JOIN new_rows _n ON _n."_id" = _o."_id"
                  WHERE pg_catalog.to_jsonb(_o) IS DISTINCT FROM pg_catalog.to_jsonb(_n)';
  ELSE
    v_select := 'SELECT _o."_id" AS record_id, pg_catalog.to_jsonb(_o) AS before, NULL::jsonb AS after
                   FROM old_rows _o';
  END IF;

  EXECUTE
    'INSERT INTO _basedb_local.revision_buffer
       (base_id, table_id, record_id, op, is_cascade, actor_kind, actor_user_id,
        actor_token_id, sql_identity, bulk_id, format_version, before, after)
     SELECT $1, $2, p.record_id, $3, pg_catalog.pg_trigger_depth() > 1,
            $4, $5, $6, $7, $8, $9, p.before, p.after
       FROM (' || v_select || ') p'
    USING v_base, v_table, lower(TG_OP), v_kind, v_actor, v_token, v_identity, v_bulk, v_format;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Une table de transition vide (MERGE, UPDATE qui ne change rien) n'écrit rien.
  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  -- Plafond dur, cumulé par transaction (§5.1) : une cascade émet une instruction par
  -- ligne parente, et un seuil par instruction n'y verrait rien passer.
  v_total := coalesce(nullif(current_setting('basedb.rows_written', true), '')::bigint, 0) + v_count;
  PERFORM pg_catalog.set_config('basedb.rows_written', v_total::text, true);
  IF v_total > 100000 THEN
    RAISE EXCEPTION 'BULK_OPERATION_REFUSED: % lignes capturées dans cette transaction', v_total
      USING ERRCODE = 'raise_exception';
  END IF;

  -- Le second tampon, si la table est abonnée (§11.3) ; absente, la ligne vaut « oui ».
  SELECT s.is_active, s.full_payload INTO v_feed, v_full
    FROM _basedb_local.change_feed_state s WHERE s.table_id = v_table;
  IF NOT FOUND THEN
    v_feed := true;
    v_full := true;
  END IF;

  IF v_feed THEN
    EXECUTE
      'INSERT INTO _basedb_local.change_event_buffer
         (base_id, table_id, record_id, op, is_cascade, actor_kind, actor_user_id,
          actor_token_id, sql_identity, bulk_id, format_version, before, after)
       SELECT $1, $2, p.record_id, $3, pg_catalog.pg_trigger_depth() > 1,
              $4, $5, $6, $7, $8, $9,
              CASE WHEN $10 THEN p.before END, CASE WHEN $10 THEN p.after END
         FROM (' || v_select || ') p'
      USING v_base, v_table, lower(TG_OP), v_kind, v_actor, v_token, v_identity, v_bulk,
            v_format, v_full;
  END IF;

  -- Réveille le drain (§11.4) : une notification par transaction — PostgreSQL fusionne les
  -- notifications identiques —, et aucune quand la file est remplie à plus de moitié : la
  -- capture ne doit jamais échouer pour un réveil.
  IF pg_catalog.pg_notification_queue_usage() < 0.5 THEN
    PERFORM pg_catalog.pg_notify('basedb_drain', '');
  END IF;

  RETURN NULL;
END
$fn$;

COMMENT ON FUNCTION _basedb_local.capture_v1() IS
  'Capture des écritures d''une table utilisateur vers les tampons (chapitre 07 §1.3). Arguments immuables : base_id, table_id, format_version.';

-- ── Journaux (§3, §6) ────────────────────────────────────────────────────
-- Partitionnés par mois sur l'instant de l'écriture. La partition DEFAULT reçoit tout
-- tant que la tâche de maintenance des partitions mensuelles (§10.2) n'existe pas : une
-- écriture d'historique ne doit jamais échouer faute de partition.

CREATE TABLE _basedb.record_revision (
  id             uuid        NOT NULL,
  occurred_at    timestamptz NOT NULL,
  drained_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  xact_id        xid8        NOT NULL,
  base_id        uuid NOT NULL,
  table_id       uuid NOT NULL,
  record_id      uuid NOT NULL,
  op             text NOT NULL CHECK (op IN ('insert','update','delete')),
  is_cascade     boolean NOT NULL DEFAULT false,
  bulk_id        uuid NULL,
  record_display text NULL,
  actor_kind     text NOT NULL CHECK (actor_kind IN
                   ('user','token','mcp','system','form','automation','sql_direct','unknown')),
  actor_user_id  uuid NULL,
  actor_token_id uuid NULL,
  sql_identity   text NULL,
  format_version smallint NOT NULL,
  PRIMARY KEY (id, occurred_at),
  CONSTRAINT ck_revision_user  CHECK (actor_kind <> 'user'  OR actor_user_id  IS NOT NULL),
  CONSTRAINT ck_revision_token CHECK (actor_kind <> 'token' OR actor_token_id IS NOT NULL)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE _basedb.record_revision_default PARTITION OF _basedb.record_revision DEFAULT;

CREATE INDEX idx_revision_record ON _basedb.record_revision (table_id, record_id, occurred_at DESC);
CREATE INDEX idx_revision_actor  ON _basedb.record_revision (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_revision_base   ON _basedb.record_revision (base_id, occurred_at DESC);
CREATE INDEX idx_revision_xact   ON _basedb.record_revision (occurred_at, xact_id);
CREATE INDEX idx_revision_bulk   ON _basedb.record_revision (bulk_id) WHERE bulk_id IS NOT NULL;

-- Une valeur est scalaire, ou un tableau : les choix multiples (text[]) et les champs
-- Document et Image (liste de fichiers) en produisent, ce que la v1 du chapitre 07
-- n'avait pas encore — l'extension qu'il prévoyait (§3.3) est faite ici.
CREATE TABLE _basedb.record_revision_field (
  revision_id    uuid        NOT NULL,
  occurred_at    timestamptz NOT NULL,
  base_id        uuid        NOT NULL,
  field_id       uuid        NOT NULL,
  field_kind     text        NOT NULL,
  before_value   jsonb NULL,
  after_value    jsonb NULL,
  before_display text  NULL,
  after_display  text  NULL,
  PRIMARY KEY (revision_id, occurred_at, field_id),
  CONSTRAINT ck_revision_field_value CHECK (
    (before_value IS NULL OR jsonb_typeof(before_value)
       IN ('string','number','boolean','null','array')) AND
    (after_value  IS NULL OR jsonb_typeof(after_value)
       IN ('string','number','boolean','null','array')))
) PARTITION BY RANGE (occurred_at);

CREATE TABLE _basedb.record_revision_field_default
  PARTITION OF _basedb.record_revision_field DEFAULT;

CREATE INDEX idx_revision_field ON _basedb.record_revision_field (field_id, occurred_at DESC);

CREATE TABLE _basedb.record_deletion (
  base_id     uuid NOT NULL,
  table_id    uuid NOT NULL,
  record_id   uuid NOT NULL,
  deleted_at  timestamptz NOT NULL,
  deleted_by  uuid NULL,
  actor_kind  text NOT NULL,
  is_cascade  boolean NOT NULL DEFAULT false,
  revision_id uuid NOT NULL,
  PRIMARY KEY (table_id, deleted_at, record_id)
) PARTITION BY RANGE (deleted_at);

CREATE TABLE _basedb.record_deletion_default PARTITION OF _basedb.record_deletion DEFAULT;

CREATE VIEW _basedb.v_record_deletion AS
SELECT d.base_id, d.table_id,
       d.record_id  AS "_id",
       d.deleted_at,
       d.deleted_by,
       CASE WHEN d.is_cascade THEN 'cascade' ELSE 'direct' END AS cause
FROM   _basedb.record_deletion d;

-- Les événements sortants et leurs livraisons (chapitres 02, 08) ont eux aussi besoin
-- d'une partition pour recevoir la première ligne.
CREATE TABLE _basedb.change_event_default PARTITION OF _basedb.change_event DEFAULT;
CREATE TABLE _basedb.webhook_delivery_default PARTITION OF _basedb.webhook_delivery DEFAULT;

-- ── Immuabilité (§3.5) ───────────────────────────────────────────────────
-- Au niveau instruction, sur chaque journal ET sur chaque partition : un déclencheur
-- d'instruction n'est pas hérité, et une écriture visant la partition le contournerait.
CREATE FUNCTION _basedb.assert_history_immutable() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
AS $fn$
BEGIN
  IF current_setting('basedb.maintenance', true) = 'on' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'HISTORY_IMMUTABLE: le journal % n''accepte ni UPDATE ni DELETE', TG_TABLE_NAME
    USING ERRCODE = 'raise_exception';
END
$fn$;

CREATE TRIGGER tg_record_revision__immutable
  BEFORE UPDATE OR DELETE ON _basedb.record_revision
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();
CREATE TRIGGER tg_record_revision_default__immutable
  BEFORE UPDATE OR DELETE ON _basedb.record_revision_default
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();
CREATE TRIGGER tg_record_revision_field__immutable
  BEFORE UPDATE OR DELETE ON _basedb.record_revision_field
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();
CREATE TRIGGER tg_record_revision_field_default__immutable
  BEFORE UPDATE OR DELETE ON _basedb.record_revision_field_default
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();
CREATE TRIGGER tg_record_deletion__immutable
  BEFORE UPDATE OR DELETE ON _basedb.record_deletion
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();
CREATE TRIGGER tg_record_deletion_default__immutable
  BEFORE UPDATE OR DELETE ON _basedb.record_deletion_default
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();

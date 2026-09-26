-- ════════════════════════════════════════════════════════════════════════
-- Historique des structures — chapitre 07 §8 (normatif sur ces objets).
--
-- FICHIER ÉCRIT À LA MAIN, comme le reste de l'historique : le chapitre 07 possède son
-- DDL, et `structure_revision` est un journal, pas une table de catalogue.
--
-- Une ligne par objet de catalogue modifié : son image avant, son image après, l'acte
-- et son auteur. C'est ce qui dit comment une table s'appelait, quand une option a
-- disparu, qui a rendu un champ obligatoire — et ce que la comparaison de deux
-- environnements (chapitre 14) lit pour savoir qui a changé quoi depuis leur dernier
-- point commun.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE _basedb.structure_revision (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  migration_id uuid NULL,              -- cle de catalogue nue, sans FK (§7.1)
  base_id uuid NOT NULL,
  object_kind text NOT NULL CHECK (object_kind IN
    ('base','db_schema','table_def','field','field_config','select_option',
     'table_constraint','table_index','application','view_def','role','permission')),
  -- La table de catalogue dont la ligne est l'image : un satellite de configuration ne
  -- se reconnaît qu'à elle (`field_text_config`, `field_ai_config`…).
  catalog_table text NOT NULL,
  object_id uuid NOT NULL,
  parent_object_id uuid NULL,
  op text NOT NULL CHECK (op IN
    ('create','update','soft_delete','restore','purge','rename_physical','replace')),
  before_row jsonb NULL,               -- ligne de catalogue avant
  after_row  jsonb NULL,               -- ligne de catalogue apres
  replaced_by_object_id uuid NULL,
  name_id uuid NULL,                   -- ligne de registre en vigueur, cle nue
  requested_by uuid NULL, approved_by uuid NULL, approved_at timestamptz NULL,
  actor_kind text NOT NULL, actor_user_id uuid NULL, actor_token_id uuid NULL
);
CREATE INDEX idx_structure_revision_object    ON _basedb.structure_revision
  (object_kind, object_id, occurred_at DESC);
CREATE INDEX idx_structure_revision_migration ON _basedb.structure_revision (migration_id);
CREATE INDEX idx_structure_revision_base      ON _basedb.structure_revision
  (base_id, occurred_at DESC);
CREATE INDEX idx_structure_revision_parent    ON _basedb.structure_revision
  (parent_object_id, occurred_at DESC);

COMMENT ON TABLE _basedb.structure_revision IS
  'Historique des structures (chapitre 07 §8.1) : une ligne par objet de catalogue modifie,
   images avant et apres, ecrite par _basedb.capture_structure_v1() dans la transaction.';

-- Un journal ne se réécrit pas (§3.5) : même règle que les journaux de données.
CREATE TRIGGER tg_structure_revision__immutable
  BEFORE UPDATE OR DELETE ON _basedb.structure_revision
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb.assert_history_immutable();

-- La capture. *Décision révisée* : le §8.1 la voulait applicative, « en un point
-- unique ». Les écritures de structure passent en fait par une vingtaine d'opérations
-- du noyau — libellé, description, options, apparence, IA, ordre des champs, cycle de
-- vie — et un oubli dans l'une d'elles serait un trou silencieux dans l'historique. Un
-- déclencheur par table de catalogue ne peut pas en oublier, et il voit aussi l'écriture
-- faite à la main en psql, attribuée `sql_direct`. `migration_id` n'est pas perdu pour
-- autant : le moteur de migration le pose en variable de session pendant chaque étape,
-- comme l'auteur.
--
-- Ne sont pas des révisions les colonnes que l'exploitation fait bouger sans que la
-- structure change : compteurs de version, baux, états physiques d'une contrainte en
-- cours de validation, avancement d'un calcul d'IA. Une mise à jour qui ne touche
-- qu'elles n'écrit rien.
CREATE FUNCTION _basedb.capture_structure_v1() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
AS $fn$
DECLARE
  v_noise constant text[] := ARRAY[
    'updated_at', 'updated_by', 'catalog_version', 'current_migration_id', 'lock_key',
    'state', 'state_changed_at', 'validate_attempts', 'next_attempt_at', 'build_attempts',
    'required_state', 'definition_state', 'next_sweep_at', 'sweep_after', 'lease_until',
    'last_run_at', 'last_error', 'last_error_at', 'computed_count'];
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_old     jsonb;
  v_new     jsonb;
  v_row     jsonb;
  v_kind    text;
  v_object  uuid;
  v_parent  uuid;
  v_base    uuid;
  v_op      text;
  v_raw     text;
  v_actor   uuid;
  v_token   uuid;
  v_mig     uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  v_row := coalesce(v_new, v_old);

  IF TG_OP = 'UPDATE' AND (v_old - v_noise) = (v_new - v_noise) THEN
    RETURN NULL;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'base' THEN
      v_kind := 'base';
      v_object := (v_row->>'id')::uuid;
      v_parent := (v_row->>'project_id')::uuid;
      v_base := v_object;
    WHEN 'table_def' THEN
      v_kind := 'table_def';
      v_object := (v_row->>'id')::uuid;
      v_parent := (v_row->>'base_id')::uuid;
      v_base := v_parent;
    WHEN 'field' THEN
      v_kind := 'field';
      v_object := (v_row->>'id')::uuid;
      v_parent := (v_row->>'table_id')::uuid;
      v_base := (v_row->>'base_id')::uuid;
    WHEN 'select_option' THEN
      v_kind := 'select_option';
      v_object := (v_row->>'id')::uuid;
      v_parent := (v_row->>'field_id')::uuid;
      SELECT f.base_id INTO v_base FROM _basedb.field f WHERE f.id = v_parent;
    WHEN 'table_constraint', 'table_index' THEN
      v_kind := TG_TABLE_NAME;
      v_object := (v_row->>'id')::uuid;
      v_parent := (v_row->>'table_id')::uuid;
      v_base := (v_row->>'base_id')::uuid;
    ELSE
      -- Un satellite de configuration : il n'a d'identité que celle de son champ.
      v_kind := 'field_config';
      v_object := (v_row->>'field_id')::uuid;
      SELECT f.base_id, f.table_id INTO v_base, v_parent
        FROM _basedb.field f WHERE f.id = v_object;
  END CASE;

  -- Un satellite emporté par la purge de son champ : la ligne du champ a déjà dit l'acte.
  IF v_base IS NULL THEN
    RETURN NULL;
  END IF;

  v_op := CASE
    WHEN TG_OP = 'INSERT' THEN 'create'
    WHEN TG_OP = 'DELETE' THEN 'purge'
    WHEN (v_old->>'purged_at') IS NULL AND (v_new->>'purged_at') IS NOT NULL THEN 'purge'
    WHEN (v_old->>'deleted_at') IS NULL AND (v_new->>'deleted_at') IS NOT NULL THEN 'soft_delete'
    WHEN (v_old->>'deleted_at') IS NOT NULL AND (v_new->>'deleted_at') IS NULL THEN 'restore'
    WHEN (v_old->>'dropped_at') IS NULL AND (v_new->>'dropped_at') IS NOT NULL THEN 'soft_delete'
    WHEN (v_old->>'name_id') IS DISTINCT FROM (v_new->>'name_id') THEN 'rename_physical'
    ELSE 'update'
  END;

  v_raw := current_setting('basedb.actor_id', true);
  IF v_raw ~ v_uuid THEN v_actor := v_raw::uuid; END IF;
  v_raw := current_setting('basedb.token_id', true);
  IF v_raw ~ v_uuid THEN v_token := v_raw::uuid; END IF;
  v_raw := current_setting('basedb.migration_id', true);
  IF v_raw ~ v_uuid THEN v_mig := v_raw::uuid; END IF;

  INSERT INTO _basedb.structure_revision
    (migration_id, base_id, object_kind, catalog_table, object_id, parent_object_id, op,
     before_row, after_row, name_id, actor_kind, actor_user_id, actor_token_id)
  VALUES
    (v_mig, v_base, v_kind, TG_TABLE_NAME, v_object, v_parent, v_op,
     v_old, v_new,
     CASE WHEN (v_row->>'name_id') ~ v_uuid THEN (v_row->>'name_id')::uuid END,
     coalesce(nullif(current_setting('basedb.actor_kind', true), ''), 'sql_direct'),
     v_actor, v_token);
  RETURN NULL;
END
$fn$;

COMMENT ON FUNCTION _basedb.capture_structure_v1() IS
  'Ecrit une ligne de structure_revision par ligne de catalogue modifiee (chapitre 07 §8.1).';

CREATE TRIGGER tg_structure_base
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.base
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_table_def
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.table_def
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_field
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_select_option
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.select_option
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_table_constraint
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.table_constraint
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_table_index
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.table_index
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_text_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_text_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_number_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_number_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_datetime_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_datetime_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_boolean_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_boolean_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_select_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_select_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_file_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_file_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_ai_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_ai_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_formula_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_formula_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();
CREATE TRIGGER tg_structure_link_config
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_link_config
  FOR EACH ROW EXECUTE FUNCTION _basedb.capture_structure_v1();

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

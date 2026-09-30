-- ────────────────────────────────────────────────────────────────────────
-- 0015 — Des valeurs par defaut (chapitre 04 §1.5).
--
-- Un champ peut porter une valeur que prend toute ligne creee sans elle : une valeur
-- fixe, la date du jour, l'instant, ou la personne qui cree la ligne. Le noyau
-- l'applique a la creation, quelle que soit la surface — interface, API, MCP, import,
-- formulaire — ; aucune clause DEFAULT n'est posee sur la colonne : « la personne qui
-- cree » et « aujourd'hui dans son fuseau » n'existent pas pour PostgreSQL. Une ecriture
-- SQL directe n'en recoit donc aucune.
--
-- La projection lit le defaut (l'interface preremplit) : il fait avancer
-- base.catalog_version, comme les autres satellites de champ.
--
-- Rejouable : chaque instruction laisse en l'etat ce qui l'est deja.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.field_default (
  field_id   uuid PRIMARY KEY REFERENCES _basedb.field(id) ON DELETE CASCADE,
  -- value : la valeur de `value` ; today : la date du jour ; now : l'instant ;
  -- me : la personne qui cree la ligne.
  kind       text NOT NULL CHECK (kind IN ('value', 'today', 'now', 'me')),
  value      jsonb NULL,
  updated_by uuid NULL REFERENCES _basedb.app_user(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_field_default_value CHECK ((kind = 'value') = (value IS NOT NULL))
);

COMMENT ON TABLE _basedb.field_default IS
  'Valeur par defaut d un champ, appliquee par le noyau a la creation d une ligne (04 §1.5).';

DROP TRIGGER IF EXISTS tg_catalog_version_field_default ON _basedb.field_default;
CREATE TRIGGER tg_catalog_version_field_default
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.field_default
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_catalog_version_by_field();

-- ────────────────────────────────────────────────────────────────────────
-- 0014 — Des droits par ligne (chapitre 05 §6.1, §16).
--
-- Un groupe peut ne voir, d'une table, que les lignes qu'une regle retient : « Commercial
-- est moi », « Region est Nord ». La regle s'ecrit dans le langage des filtres
-- (chapitre 08 §4), sur les champs de la table, avec @moi pour la personne connectee.
-- Elle ne fait que retrancher : une personne voit l'union de ce que lui ouvrent ses
-- groupes, et un groupe sans regle voit toutes les lignes. Le decideur en fait le
-- predicat de lignes que chaque requete portait deja, constamment vrai jusqu'ici.
--
-- Une regle est une ecriture d'autorisation : elle fait avancer tenant.authz_version,
-- comme field_permission, pour que toute decision en cache tombe.
--
-- Rejouable : chaque instruction laisse en l'etat ce qui l'est deja.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.row_permission (
  role_id    uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE CASCADE,
  table_id   uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE CASCADE,
  -- Le filtre tel que l'administrateur l'a ecrit, sur les noms physiques des champs.
  filter     text NOT NULL CHECK (char_length(filter) BETWEEN 1 AND 4096),
  created_by uuid REFERENCES _basedb.app_user(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES _basedb.app_user(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (role_id, table_id)
);
CREATE INDEX IF NOT EXISTS idx_row_permission_table ON _basedb.row_permission (table_id);

COMMENT ON TABLE _basedb.row_permission IS
  'Regle de lignes d un groupe sur une table (05 §16) : un filtre qui retranche, jamais n accorde.';

-- La meme fonction, une table de plus dans la branche « par le role ».
CREATE OR REPLACE FUNCTION _basedb.bump_authz_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ligne   record;
  cible   uuid;
BEGIN
  ligne := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  CASE TG_TABLE_NAME
    WHEN 'role', 'app_user', 'api_token' THEN
      cible := ligne.tenant_id;
    WHEN 'permission', 'field_permission', 'row_permission', 'role_member' THEN
      SELECT r.tenant_id INTO cible FROM _basedb.role r WHERE r.id = ligne.role_id;
    WHEN 'session' THEN
      SELECT u.tenant_id INTO cible FROM _basedb.app_user u WHERE u.id = ligne.user_id;
    WHEN 'webhook' THEN
      SELECT b.tenant_id INTO cible FROM _basedb.base b WHERE b.id = ligne.base_id;
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

DROP TRIGGER IF EXISTS tg_authz_version_row_permission ON _basedb.row_permission;
CREATE TRIGGER tg_authz_version_row_permission
  AFTER INSERT OR UPDATE OR DELETE ON _basedb.row_permission
  FOR EACH ROW EXECUTE FUNCTION _basedb.bump_authz_version();

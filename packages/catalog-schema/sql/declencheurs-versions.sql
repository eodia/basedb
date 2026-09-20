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

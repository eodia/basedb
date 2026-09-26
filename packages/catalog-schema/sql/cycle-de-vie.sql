-- ════════════════════════════════════════════════════════════════════════
-- Cycle de vie — chapitre 06 : fin de vie des alias, export préalable à la purge.
--
-- Le chapitre 06 §3.2 porte l'échéance et la fenêtre de coupure à blanc « par la
-- ligne d'alias — sur db_schema pour un alias de base et sur sql_view_alias pour un
-- alias de table ». Le chapitre 02 ne les avait posées que sur db_schema, et à moitié :
-- elles sont complétées ici, au même endroit que le reste du DDL écrit après lui.
-- ════════════════════════════════════════════════════════════════════════

-- Toute clé étrangère du catalogue porte un index complet, jamais partiel (CAT-IDX).

-- Alias de table : échéance et coupure à blanc (§3.5). Le nom de coupure est une ligne
-- du registre, allouée en état `relegated` et passée `purged` à la remise en service.
ALTER TABLE _basedb.sql_view_alias
  ADD COLUMN drop_after        timestamptz NULL,
  ADD COLUMN blank_cut_from    timestamptz NULL,
  ADD COLUMN blank_cut_until   timestamptz NULL,
  ADD COLUMN blank_cut_name_id uuid NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_view_alias_cut CHECK (
    num_nonnulls(blank_cut_from, blank_cut_until, blank_cut_name_id) IN (0, 3)
    AND (blank_cut_until IS NULL OR blank_cut_until > blank_cut_from));

CREATE INDEX idx_view_alias_cut_name ON _basedb.sql_view_alias (blank_cut_name_id);
CREATE INDEX idx_view_alias_target ON _basedb.sql_view_alias (target_table_id)
  WHERE dropped_at IS NULL;

-- Alias de base : la coupure à blanc renomme le schéma d'alias lui-même.
ALTER TABLE _basedb.db_schema
  ADD COLUMN blank_cut_from    timestamptz NULL,
  ADD COLUMN blank_cut_until   timestamptz NULL,
  ADD COLUMN blank_cut_name_id uuid NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_schema_cut CHECK (
    (role = 'alias' OR blank_cut_from IS NULL)
    AND num_nonnulls(blank_cut_from, blank_cut_until, blank_cut_name_id) IN (0, 3)
    AND (blank_cut_until IS NULL OR blank_cut_until > blank_cut_from));

CREATE INDEX idx_schema_cut_name ON _basedb.db_schema (blank_cut_name_id);

-- Export préalable à la purge (§5.2) : ce qui a été écrit, où, les statistiques de
-- chaque table au début de l'export, et une empreinte prise sous son instantané (nombre
-- de lignes, plus grand xmin) que la purge recalcule — `EXPORT_STALE` si quelqu'un a
-- écrit depuis. Les fichiers ne sont jamais supprimés par basedb ; la ligne non plus :
-- elle dit à l'exploitant à quoi ils servaient.
CREATE TABLE _basedb.purge_export (
  id         uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id  uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  base_id    uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE RESTRICT,
  -- NULL : la base entière ; sinon, cette table seule.
  table_id   uuid NULL REFERENCES _basedb.table_def(id) ON DELETE RESTRICT,
  directory  text NOT NULL,
  manifest   jsonb NOT NULL,
  total_rows bigint NOT NULL CHECK (total_rows >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  -- La purge qui l'a consommé : un export ne sert qu'une fois.
  used_at    timestamptz NULL,
  used_by    uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_purge_export_used CHECK ((used_at IS NULL) = (used_by IS NULL)),
  CONSTRAINT ck_purge_export_manifest CHECK (jsonb_typeof(manifest) = 'object')
);

CREATE INDEX idx_purge_export_tenant  ON _basedb.purge_export (tenant_id);
CREATE INDEX idx_purge_export_base    ON _basedb.purge_export (base_id, created_at DESC);
CREATE INDEX idx_purge_export_table   ON _basedb.purge_export (table_id);
CREATE INDEX idx_purge_export_creator ON _basedb.purge_export (created_by);
CREATE INDEX idx_purge_export_user    ON _basedb.purge_export (used_by);

COMMENT ON TABLE _basedb.purge_export IS
  'Export CSV préalable à une purge (chapitre 06 §5.2) : répertoire, manifeste, empreinte recalculée à la purge.';

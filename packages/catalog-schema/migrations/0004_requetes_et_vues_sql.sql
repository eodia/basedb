-- ────────────────────────────────────────────────────────────────────────
-- 0004 — Les requetes enregistrees et les vues SQL (chapitre 11 §1.7 et §1.8).
--
-- Une requete enregistree est un texte SQL range sous une base, a soi, a toute la base ou
-- a certains groupes. Chacun l'execute avec ses propres droits : partager une requete
-- partage son texte, jamais ce que son auteur peut lire.
--
-- Une vue SQL est une vraie vue PostgreSQL du schema de la base, que le catalogue nomme,
-- habille comme une table et suit a travers les operations de structure.
--
-- Rejouable : chaque instruction tient compte de ce qui existe deja.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.saved_query (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id     uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 255),
  label_key   text COLLATE "C" NOT NULL,
  description text NULL,
  statement   text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 100000),
  -- personal : son auteur seul la voit ; base : quiconque lit la base ; groups : les
  -- membres des groupes de saved_query_role, et qui gere la structure de la base.
  audience    text NOT NULL DEFAULT 'personal'
                CHECK (audience IN ('personal', 'base', 'groups')),
  owner_id    uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by  uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT
);

-- Un libelle est unique parmi les requetes partagees d'une base, et parmi les requetes
-- personnelles d'une meme personne sur cette base : chacun peut avoir « Mes relances ».
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_query_label
  ON _basedb.saved_query (
    base_id,
    (CASE WHEN audience = 'personal' THEN owner_id
          ELSE '00000000-0000-0000-0000-000000000000'::uuid END),
    label_key);

CREATE INDEX IF NOT EXISTS idx_saved_query_base    ON _basedb.saved_query (base_id);
CREATE INDEX IF NOT EXISTS idx_saved_query_owner   ON _basedb.saved_query (owner_id);
CREATE INDEX IF NOT EXISTS idx_saved_query_updater ON _basedb.saved_query (updated_by);

-- Les groupes a qui une requete « groups » est ouverte.
CREATE TABLE IF NOT EXISTS _basedb.saved_query_role (
  query_id uuid NOT NULL REFERENCES _basedb.saved_query(id) ON DELETE CASCADE,
  role_id  uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE CASCADE,
  PRIMARY KEY (query_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_query_role_role ON _basedb.saved_query_role (role_id);

-- Une vue SQL : son nom physique est alloue dans la portee du schema de la base, celle de
-- ses tables, et ne peut donc jamais en prendre un. Elle est creee WITH (security_invoker) :
-- la lire, c'est lire ses tables avec ses propres droits.
CREATE TABLE IF NOT EXISTS _basedb.sql_view (
  id          uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id     uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE CASCADE,
  schema_id   uuid NOT NULL REFERENCES _basedb.db_schema(id) ON DELETE RESTRICT,
  name_id     uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 255),
  label_key   text COLLATE "C" NOT NULL,
  description text NULL,
  -- Apparence : celle d'une table, memes bornes.
  color       text NULL,
  icon        text NULL,
  image       text NULL,
  position    integer NOT NULL DEFAULT 0,
  -- Le SELECT tel qu'il a ete ecrit ; PostgreSQL garde, lui, sa forme compilee.
  definition  text NOT NULL CHECK (char_length(definition) BETWEEN 1 AND 100000),
  -- Non nul : une operation de structure a du retirer la vue de PostgreSQL (une table
  -- purgee, une colonne recreee). La definition reste, a corriger.
  broken_reason text NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by  uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by  uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_sql_view_name UNIQUE (name_id),
  CONSTRAINT ck_sql_view_color CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_sql_view_icon  CHECK (icon IS NULL OR icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT ck_sql_view_image CHECK (image IS NULL OR char_length(image) <= 16384),
  CONSTRAINT ck_sql_view_glyph CHECK (icon IS NULL OR image IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sql_view_label ON _basedb.sql_view (base_id, label_key);

CREATE INDEX IF NOT EXISTS idx_sql_view_base    ON _basedb.sql_view (base_id, position);
CREATE INDEX IF NOT EXISTS idx_sql_view_schema  ON _basedb.sql_view (schema_id);
CREATE INDEX IF NOT EXISTS idx_sql_view_creator ON _basedb.sql_view (created_by);
CREATE INDEX IF NOT EXISTS idx_sql_view_updater ON _basedb.sql_view (updated_by);

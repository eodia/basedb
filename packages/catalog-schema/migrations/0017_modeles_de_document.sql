-- ────────────────────────────────────────────────────────────────────────
-- 0017 — Des modèles de document (chapitre 21).
--
-- Un modèle dit comment une ligne d'une table devient un document PDF : une facture, un
-- devis, une fiche. Il appartient à la table ; sa définition — la page, la langue, le
-- pied de page, et la suite de ses blocs : texte riche citant les colonnes, champs de la
-- ligne, tableau des lignes liées, saut de page — est un JSON que le noyau valide à
-- l'écriture et relit contre le catalogue du jour à chaque rendu. Le rendu lit la ligne
-- et ses lignes liées avec les droits de qui le demande : un modèle ne donne rien à lire
-- qui ne le soit déjà.
--
-- Rejouable : chaque instruction laisse en l'état ce qui l'est déjà.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.document_template (
  id         uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  table_id   uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE CASCADE,
  label      text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  spec       jsonb NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE SET NULL
);

COMMENT ON TABLE _basedb.document_template IS
  'Modele de document PDF d une table : page, langue, blocs (chapitre 21).';

CREATE INDEX IF NOT EXISTS idx_document_template_table
  ON _basedb.document_template (table_id, position);

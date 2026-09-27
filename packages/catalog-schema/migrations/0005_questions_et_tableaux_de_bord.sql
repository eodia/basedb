-- ────────────────────────────────────────────────────────────────────────
-- 0005 — Les questions enregistrees, et les tableaux de bord en grille (chapitre 18).
--
-- Une question est une lecture nommee d'une base : construite a la souris (une table,
-- ses jointures, ses filtres, ses agregats par groupes) ou ecrite en SQL, avec la
-- facon de la montrer (un chiffre, une courbe, un tableau croise…). Elle n'emporte
-- aucun droit : chacun la lit avec les siens, par les routes de donnees pour une
-- question construite, en lecture seule sur son propre role pour une question SQL.
--
-- Un tableau de bord range desormais des cartes sur une grille de 24 colonnes, dans
-- des onglets, sous des filtres qui pilotent les cartes qu'on leur relie. Ses anciens
-- blocs (la colonne `blocks`) restent lus tant que `cards` est nul : le noyau les
-- traduit en cartes, et les remplace au premier enregistrement.
--
-- Rejouable : chaque instruction tient compte de ce qui existe deja.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.question (
  id            uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id       uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE CASCADE,
  label         text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 255),
  description   text NULL,
  -- builder : la requete construite, validee par le noyau ; sql : un SELECT et ses
  -- variables.
  kind          text NOT NULL CHECK (kind IN ('builder', 'sql')),
  query         jsonb NOT NULL,
  -- Le graphique et ses reglages (chapitre 18 §3).
  visualization jsonb NOT NULL DEFAULT '{}'::jsonb,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by    uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by    uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  deleted_at    timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_question_base ON _basedb.question (base_id, position)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_question_creator ON _basedb.question (created_by);
CREATE INDEX IF NOT EXISTS idx_question_updater ON _basedb.question (updated_by);

ALTER TABLE _basedb.dashboard
  -- Les onglets, dans leur ordre : [{id, label}]. Vide : une seule page.
  ADD COLUMN IF NOT EXISTS tabs jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Les cartes et leur place sur la grille. Nul : pas encore traduit des blocs.
  ADD COLUMN IF NOT EXISTS cards jsonb NULL,
  -- Les filtres du tableau, que chaque carte relie a l'une de ses colonnes.
  ADD COLUMN IF NOT EXISTS parameters jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ────────────────────────────────────────────────────────────────────────
-- 0022 — Des boutons dans la barre d'outils d'une table.
--
-- Chapitre 11 §1.6, chapitre 17 §1.1 : un champ Bouton agit sur SA ligne. Un bouton de
-- la barre d'outils appartient à la table, s'affiche dans toutes ses vues grille, pour
-- tous ceux qui la lisent, et se règle par qui gère la structure. Il ouvre une adresse,
-- ou lance une automatisation sur une cible choisie avec lui :
--   'selection' : les lignes cochées, une exécution chacune ;
--   'view'      : les lignes de la vue à l'écran, son filtre compris ;
--   'none'      : aucune ligne — une automatisation sans table (horloge, adresse web).
-- Le budget horaire de l'automatisation borne toujours le nombre d'exécutions.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Ni transaction explicite, ni CREATE INDEX CONCURRENTLY : elle s'exécute déjà dans une.
-- Une fois publiée, elle ne change plus : la correction va dans la suivante.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.table_button (
  id            uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  table_id      uuid NOT NULL REFERENCES _basedb.table_def(id) ON DELETE CASCADE,
  label         text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  color         text NULL CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$'),
  action        text NOT NULL CHECK (action IN ('url', 'automation')),
  url           text NULL CHECK (url IS NULL OR char_length(url) <= 2048),
  automation_id uuid NULL REFERENCES _basedb.automation(id) ON DELETE CASCADE,
  target        text NOT NULL DEFAULT 'selection' CHECK (target IN ('selection', 'view', 'none')),
  -- Demander confirmation avant de lancer : une action sur toute une vue, un envoi.
  confirm       boolean NOT NULL DEFAULT false,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by    uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by    uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT ck_table_button_action CHECK (
       (action = 'url' AND url IS NOT NULL AND automation_id IS NULL)
    OR (action = 'automation' AND automation_id IS NOT NULL AND url IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_table_button_table      ON _basedb.table_button (table_id, position);
CREATE INDEX IF NOT EXISTS idx_table_button_automation ON _basedb.table_button (automation_id);
CREATE INDEX IF NOT EXISTS idx_table_button_creator    ON _basedb.table_button (created_by);
CREATE INDEX IF NOT EXISTS idx_table_button_updater    ON _basedb.table_button (updated_by);

COMMENT ON TABLE _basedb.table_button IS
  'Les boutons de la barre d''outils d''une table (chapitre 11 §1.6) : ouvrir une adresse,
   ou lancer une automatisation sur les lignes cochées, sur la vue à l''écran ou sans ligne.';

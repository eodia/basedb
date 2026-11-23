-- ────────────────────────────────────────────────────────────────────────
-- 0024 — Synchronisation paramétrable, et les questions d'insights pour source.
--
-- Chapitre 19 §3.5 : une table synchronisée choisit comment elle suit sa source —
--   mirror   : comme la source (créées, modifiées, supprimées) — le comportement d'avant ;
--   upsert   : créées et modifiées, jamais supprimées ;
--   insert   : seulement les clés nouvelles, rien de ce qui existe ne change ;
--   replace  : tout effacé puis tout réécrit, sans clé ;
--   snapshot : chaque passage ajoute toutes les lignes, datées — un historique ;
-- quand (toutes les N minutes, chaque jour à une heure, à la main seulement), sur quelle
-- clé (une ou plusieurs colonnes de la source) et, pour une question d'insights, avec
-- quels paramètres.
--
-- Une table existante garde ce qu'elle faisait : mirror, à intervalle, la clé de sa source.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Ni transaction explicite, ni CREATE INDEX CONCURRENTLY : elle s'exécute déjà dans une.
-- Une fois publiée, elle ne change plus : la correction va dans la suivante.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE _basedb.table_sync DROP CONSTRAINT IF EXISTS table_sync_source_kind_check;
ALTER TABLE _basedb.table_sync ADD CONSTRAINT table_sync_source_kind_check
  CHECK (source_kind IN ('csv','ics','basedb','insights'));

ALTER TABLE _basedb.table_sync
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'mirror',
  ADD COLUMN IF NOT EXISTS schedule text NOT NULL DEFAULT 'interval',
  -- « daily » : l'heure, HH:MM, dans le fuseau time_zone.
  ADD COLUMN IF NOT EXISTS daily_at text NULL,
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'UTC',
  -- Les colonnes de la source (leurs clés) qui forment la clé d'une ligne ; NULL : celle
  -- que la source désigne elle-même (id, UID, identifiant de ligne).
  ADD COLUMN IF NOT EXISTS key_columns jsonb NULL,
  -- Ce que la source demande de plus : la question d'insights, ses paramètres.
  ADD COLUMN IF NOT EXISTS source_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- « snapshot » : le champ qui date chaque ligne ajoutée.
  ADD COLUMN IF NOT EXISTS stamp_field_id uuid NULL REFERENCES _basedb.field(id) ON DELETE SET NULL;

ALTER TABLE _basedb.table_sync DROP CONSTRAINT IF EXISTS table_sync_mode_check;
ALTER TABLE _basedb.table_sync ADD CONSTRAINT table_sync_mode_check
  CHECK (mode IN ('mirror','upsert','insert','replace','snapshot'));

ALTER TABLE _basedb.table_sync DROP CONSTRAINT IF EXISTS table_sync_schedule_check;
ALTER TABLE _basedb.table_sync ADD CONSTRAINT table_sync_schedule_check
  CHECK (schedule IN ('interval','daily','manual')
         AND (schedule <> 'daily' OR daily_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));


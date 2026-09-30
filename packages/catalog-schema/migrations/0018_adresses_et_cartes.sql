-- ────────────────────────────────────────────────────────────────────────
-- 0018 — Des adresses et des cartes (chapitre 04 §2.11, chapitre 11 §1.9).
--
-- Une adresse est un texte court au format « Adresse » : la colonne reste un texte, seule
-- la lecture change (un lien vers la carte, des propositions à la saisie). La vue « Carte »
-- place les lignes d'une table sur un fond de carte, d'après une adresse ou d'après deux
-- nombres, latitude et longitude.
--
-- Une adresse devient un point par un service de géocodage que l'exploitant choisit
-- (Nominatim d'OpenStreetMap par défaut). Chaque réponse est gardée, par locataire, dans
-- _basedb.geocode : le service n'est interrogé qu'une fois par adresse, comme sa politique
-- d'usage le demande, et une adresse introuvable l'est aussi.
--
-- Rejouable : chaque instruction laisse en l'état ce qui l'est déjà.
-- ────────────────────────────────────────────────────────────────────────

-- Le format « Adresse » d'un texte court. La contrainte de 0001 était anonyme : elle prend
-- un nom, pour que la suivante la retrouve.
ALTER TABLE _basedb.field_text_config
  DROP CONSTRAINT IF EXISTS field_text_config_display_format_check;
ALTER TABLE _basedb.field_text_config DROP CONSTRAINT IF EXISTS ck_text_display_format;
ALTER TABLE _basedb.field_text_config
  ADD CONSTRAINT ck_text_display_format
  CHECK (display_format IN ('plain', 'phone', 'barcode', 'address'));

-- La vue « Carte ».
ALTER TABLE _basedb.view_def DROP CONSTRAINT IF EXISTS ck_view_def_kind;
ALTER TABLE _basedb.view_def
  ADD CONSTRAINT ck_view_def_kind
  CHECK (kind IN ('grid','kanban','calendar','timeline','gallery','list','form','survey','quiz','map'));

-- Ce que le service de géocodage a répondu, adresse par adresse : un point, ou rien.
CREATE TABLE IF NOT EXISTS _basedb.geocode (
  tenant_id  uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE CASCADE,
  -- L'adresse telle que cherchée : espaces réduits, en minuscules.
  query      text COLLATE "C" NOT NULL CHECK (char_length(query) BETWEEN 1 AND 500),
  lat        double precision NULL CHECK (lat BETWEEN -90 AND 90),
  lng        double precision NULL CHECK (lng BETWEEN -180 AND 180),
  -- Ce que le service a reconnu : ce qu'une infobulle peut montrer.
  label      text NULL CHECK (label IS NULL OR char_length(label) <= 500),
  fetched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, query),
  CONSTRAINT ck_geocode_point CHECK ((lat IS NULL) = (lng IS NULL))
);

COMMENT ON TABLE _basedb.geocode IS
  'Reponses du service de geocodage, par locataire et par adresse (chapitre 11 §1.9).';

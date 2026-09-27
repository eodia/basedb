-- ────────────────────────────────────────────────────────────────────────
-- 0009 — La langue de chacun (chapitre 11 §10) : celle de l'interface, de ses
-- messages et des courriels que basedb lui envoie.
--
-- Nulle par defaut : l'interface prend alors la langue du navigateur. Un choix fait
-- dans les parametres la fixe, et suit la personne d'un poste a l'autre.
-- La liste suit LOCALES de @basedb/contracts.
--
-- Rejouable : une colonne deja presente est laissee telle quelle, contrainte comprise.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE _basedb.app_user
  ADD COLUMN IF NOT EXISTS locale text
    CONSTRAINT ck_user_locale CHECK (locale IS NULL OR locale IN (
      'fr', 'en', 'de', 'es', 'it', 'pt-BR', 'nl', 'pl', 'cs', 'sv',
      'da', 'nb', 'fi', 'ro', 'hu', 'tr', 'uk', 'ja', 'zh-CN', 'ko'));

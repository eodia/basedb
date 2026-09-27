-- ────────────────────────────────────────────────────────────────────────
-- 0011 — La langue de chacun, pour de bon (chapitre 11 §10.1).
--
-- app_user.locale existe depuis 0001, obligatoire et 'fr' par defaut : 0009, qui
-- croyait l'ajouter, n'a donc rien fait. Elle devient ce qu'elle doit etre : le choix
-- de la personne, ou NULL — aucun choix, la langue du navigateur. Un 'fr' ecrit par
-- le defaut n'etait pas un choix : il redevient NULL, comme toute valeur hors de la
-- liste de @basedb/contracts (LOCALES).
--
-- Rejouable : chaque instruction laisse en l'etat ce qui l'est deja.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE _basedb.app_user
  ALTER COLUMN locale DROP NOT NULL,
  ALTER COLUMN locale DROP DEFAULT;

UPDATE _basedb.app_user
   SET locale = NULL
 WHERE locale IS NOT NULL
   AND (locale = 'fr' OR locale NOT IN (
     'fr', 'en', 'de', 'es', 'it', 'pt-BR', 'nl', 'pl', 'cs', 'sv',
     'da', 'nb', 'fi', 'ro', 'hu', 'tr', 'uk', 'ja', 'zh-CN', 'ko'));

ALTER TABLE _basedb.app_user DROP CONSTRAINT IF EXISTS ck_user_locale;
ALTER TABLE _basedb.app_user
  ADD CONSTRAINT ck_user_locale CHECK (locale IS NULL OR locale IN (
    'fr', 'en', 'de', 'es', 'it', 'pt-BR', 'nl', 'pl', 'cs', 'sv',
    'da', 'nb', 'fi', 'ro', 'hu', 'tr', 'uk', 'ja', 'zh-CN', 'ko'));

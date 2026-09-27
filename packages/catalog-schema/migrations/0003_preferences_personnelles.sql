-- ────────────────────────────────────────────────────────────────────────
-- 0003 — Les preferences de chacun (chapitre 11 §10, chapitre 16 §2.3) : comment
-- s'ecrivent les dates, quel jour ouvre la semaine, et quelles notifications on refuse.
--
-- Portees par le compte et non par le navigateur : une personne qui change de poste
-- retrouve ses reglages. Le theme, lui, reste au navigateur, parce que « suivre le
-- systeme » depend de l'appareil.
--
-- Rejouable : une colonne deja presente est laissee telle quelle, contrainte comprise.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE _basedb.app_user
  -- 'dmy' : 25/09/2026, la lecture par defaut ; 'iso' : 2026-09-25.
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'dmy'
    CONSTRAINT ck_user_date_format CHECK (date_format IN ('dmy', 'iso')),
  -- Le premier jour d'une semaine de calendrier : 1 lundi, 0 dimanche.
  ADD COLUMN IF NOT EXISTS week_start smallint NOT NULL DEFAULT 1
    CONSTRAINT ck_user_week_start CHECK (week_start IN (0, 1)),
  -- Les natures de notification que la personne ne veut plus recevoir. Vide : toutes.
  -- La liste suit la contrainte de _basedb.notification.kind.
  ADD COLUMN IF NOT EXISTS muted_notifications text[] NOT NULL DEFAULT '{}'
    CONSTRAINT ck_user_muted_notifications CHECK (
      muted_notifications <@ ARRAY['mention', 'reply', 'assigned', 'automation']::text[]);

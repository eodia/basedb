-- ────────────────────────────────────────────────────────────────────────
-- 0016 — Des courriels (chapitres 16 §2.4 et 17 §1.3).
--
-- Deux sources : une notification restée non lue, que la personne a demandé à recevoir
-- aussi par courriel pour sa nature ; et l'étape « Envoyer un courriel » d'une
-- automatisation. Toutes deux passent par une file, _basedb.mail_outbox, qu'une boucle
-- du noyau vide par le serveur SMTP de l'exploitant : un envoi ne ralentit ni ne fait
-- échouer l'écriture qui l'a causé, et un relais indisponible est réessayé.
--
-- La mise en file d'une notification est un déclencheur sur _basedb.notification : les
-- trois endroits qui en écrivent (commentaires, attribution, automatisations) et ceux à
-- venir y passent sans rien savoir du courriel. Son texte est composé à l'envoi, dans la
-- langue de la personne ; celui d'une automatisation l'est à l'exécution de l'étape.
--
-- Rejouable : chaque instruction laisse en l'état ce qui l'est déjà.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.mail_outbox (
  id              uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id       uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE CASCADE,
  -- notification : composé à l'envoi ; automation : sujet et texte déjà rendus.
  origin          text NOT NULL CHECK (origin IN ('notification', 'automation')),
  notification_id uuid NULL REFERENCES _basedb.notification(id) ON DELETE CASCADE,
  automation_id   uuid NULL REFERENCES _basedb.automation(id) ON DELETE SET NULL,
  run_id          uuid NULL REFERENCES _basedb.automation_run(id) ON DELETE SET NULL,
  -- Un compte du locataire, quand le destinataire en est un.
  user_id         uuid NULL REFERENCES _basedb.app_user(id) ON DELETE CASCADE,
  recipient       text NOT NULL CHECK (char_length(recipient) <= 254),
  reply_to        text NULL CHECK (reply_to IS NULL OR char_length(reply_to) <= 254),
  subject         text NULL CHECK (subject IS NULL OR char_length(subject) <= 300),
  body_text       text NULL CHECK (body_text IS NULL OR char_length(body_text) <= 20000),
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,
  -- Pas avant : une notification attend d'avoir été laissée non lue.
  not_before      timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error      text NULL,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  done_at         timestamptz NULL,
  CONSTRAINT ck_mail_notification CHECK ((origin = 'notification') = (notification_id IS NOT NULL)),
  CONSTRAINT ck_mail_rendered CHECK (
    origin = 'notification' OR (subject IS NOT NULL AND body_text IS NOT NULL))
);

COMMENT ON TABLE _basedb.mail_outbox IS
  'File des courriels a envoyer par le serveur SMTP de l exploitant (16 §2.4, 17 §1.3).';

CREATE INDEX IF NOT EXISTS idx_mail_outbox_due
  ON _basedb.mail_outbox (not_before) WHERE status = 'pending';

-- Les natures qu'une personne reçoit aussi par courriel, quand elle ne les a pas lues.
-- Toutes par défaut : le courriel n'attend que le transport de l'exploitant.
ALTER TABLE _basedb.app_user
  ADD COLUMN IF NOT EXISTS mailed_notifications text[] NOT NULL
    DEFAULT '{mention,reply,assigned,automation}'
    CONSTRAINT ck_user_mailed_notifications CHECK (
      mailed_notifications <@ ARRAY['mention', 'reply', 'assigned', 'automation']::text[]);

-- Dix minutes : le temps de lire ce qui arrive pendant qu'on travaille, sans courriel.
CREATE OR REPLACE FUNCTION _basedb.queue_notification_mail() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _basedb.mail_outbox (tenant_id, origin, notification_id, user_id, recipient, not_before)
  SELECT NEW.tenant_id, 'notification', NEW.id, u.id, u.email, NEW.created_at + interval '10 minutes'
    FROM _basedb.app_user u
   WHERE u.id = NEW.user_id
     AND NEW.kind = ANY (u.mailed_notifications)
     AND u.disabled_at IS NULL
     AND u.deleted_at IS NULL;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tg_notification_mail ON _basedb.notification;
CREATE TRIGGER tg_notification_mail
  AFTER INSERT ON _basedb.notification
  FOR EACH ROW EXECUTE FUNCTION _basedb.queue_notification_mail();

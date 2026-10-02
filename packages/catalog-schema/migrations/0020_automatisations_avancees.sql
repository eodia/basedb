-- ────────────────────────────────────────────────────────────────────────
-- 0020 — Des automatisations qui attendent, réagissent à plus d'événements et écrivent des
-- courriels plus riches (chapitre 17).
--
-- Déclencheurs : une ligne supprimée, une ligne qui entre dans un filtre, une date qui
-- arrive, un webhook entrant. Exécutions : l'étape « Attendre » garde une exécution en
-- attente, son état et l'heure de sa reprise. Courriels : HTML, envoi groupé, copie,
-- pièces jointes.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Rejouable : chaque instruction laisse en l'état ce qui l'est déjà.
-- ────────────────────────────────────────────────────────────────────────

-- Les déclencheurs. Les contraintes de 0001 n'avaient pas de nom : PostgreSQL leur a donné
-- le sien, que l'on retire avant de poser la nouvelle, nommée.
ALTER TABLE _basedb.automation DROP CONSTRAINT IF EXISTS automation_trigger_kind_check;
ALTER TABLE _basedb.automation DROP CONSTRAINT IF EXISTS ck_automation_trigger_kind;
ALTER TABLE _basedb.automation ADD CONSTRAINT ck_automation_trigger_kind CHECK (trigger_kind IN (
  'record_created', 'record_updated', 'schedule', 'button',
  'record_deleted', 'record_matches', 'date_reached', 'webhook'));

-- Une horloge et un webhook entrant ne portent pas de table ; tous les autres, si.
ALTER TABLE _basedb.automation DROP CONSTRAINT IF EXISTS ck_automation_table;
ALTER TABLE _basedb.automation ADD CONSTRAINT ck_automation_table
  CHECK ((trigger_kind IN ('schedule', 'webhook')) = (table_id IS NULL));

-- L'adresse d'un webhook entrant : son empreinte pour la retrouver à chaque appel, et la
-- même scellée par la clé d'instance pour la remontrer à qui construit la base.
ALTER TABLE _basedb.automation ADD COLUMN IF NOT EXISTS hook_hash bytea NULL;
ALTER TABLE _basedb.automation ADD COLUMN IF NOT EXISTS hook_sealed text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_hook ON _basedb.automation (hook_hash)
  WHERE hook_hash IS NOT NULL;

-- Une date qui arrive : jusqu'où les échéances ont été cherchées. `next_run_at` dit quand
-- chercher à nouveau, comme pour une horloge.
ALTER TABLE _basedb.automation ADD COLUMN IF NOT EXISTS scanned_until timestamptz NULL;
DROP INDEX IF EXISTS _basedb.idx_automation_due;
CREATE INDEX IF NOT EXISTS idx_automation_due ON _basedb.automation (next_run_at)
  WHERE deleted_at IS NULL AND is_enabled AND trigger_kind IN ('schedule', 'date_reached');

-- Les exécutions qui attendent : l'heure de leur reprise, et ce qu'elles tenaient — les
-- lignes par leur identifiant, ce que les étapes ont répondu, la trace, le flux tel qu'il
-- était à leur départ.
ALTER TABLE _basedb.automation_run DROP CONSTRAINT IF EXISTS automation_run_status_check;
ALTER TABLE _basedb.automation_run DROP CONSTRAINT IF EXISTS ck_automation_run_status;
ALTER TABLE _basedb.automation_run ADD CONSTRAINT ck_automation_run_status
  CHECK (status IN ('queued', 'running', 'waiting', 'succeeded', 'failed', 'skipped'));
ALTER TABLE _basedb.automation_run ADD COLUMN IF NOT EXISTS resume_at timestamptz NULL;
ALTER TABLE _basedb.automation_run ADD COLUMN IF NOT EXISTS state jsonb NULL;
-- Ce que le déclencheur apporte sans ligne à relire : le corps d'un webhook entrant, la
-- ligne telle qu'elle était avant d'être supprimée.
ALTER TABLE _basedb.automation_run ADD COLUMN IF NOT EXISTS payload jsonb NULL;
-- Une automatisation lancée par une autre : à quelle profondeur de la chaîne.
ALTER TABLE _basedb.automation_run ADD COLUMN IF NOT EXISTS depth smallint NOT NULL DEFAULT 0;
ALTER TABLE _basedb.automation_run DROP CONSTRAINT IF EXISTS ck_automation_run_waiting;
ALTER TABLE _basedb.automation_run ADD CONSTRAINT ck_automation_run_waiting
  CHECK ((status = 'waiting') = (resume_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_automation_run_waiting ON _basedb.automation_run (resume_at)
  WHERE status = 'waiting';

-- Les lignes qui satisfont le filtre d'une automatisation « entre dans un filtre » : elle
-- part quand une ligne y entre, et ne repart qu'après qu'elle en est sortie.
CREATE TABLE IF NOT EXISTS _basedb.automation_match (
  automation_id uuid NOT NULL REFERENCES _basedb.automation(id) ON DELETE CASCADE,
  record_id     uuid NOT NULL,
  matched_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (automation_id, record_id)
);

COMMENT ON TABLE _basedb.automation_match IS
  'Lignes dans le filtre d une automatisation « entre dans un filtre » (17 §1.1).';

-- Les courriels d'une automatisation : en HTML, envoyés ensemble à plusieurs, avec une
-- copie et des pièces jointes (des fichiers du stockage, par leur clé).
ALTER TABLE _basedb.mail_outbox ADD COLUMN IF NOT EXISTS body_html text NULL;
ALTER TABLE _basedb.mail_outbox ADD COLUMN IF NOT EXISTS also_to text[] NULL;
ALTER TABLE _basedb.mail_outbox ADD COLUMN IF NOT EXISTS cc text[] NULL;
ALTER TABLE _basedb.mail_outbox ADD COLUMN IF NOT EXISTS attachments jsonb NULL;
ALTER TABLE _basedb.mail_outbox DROP CONSTRAINT IF EXISTS ck_mail_outbox_html;
ALTER TABLE _basedb.mail_outbox ADD CONSTRAINT ck_mail_outbox_html
  CHECK (body_html IS NULL OR char_length(body_html) <= 200000);
ALTER TABLE _basedb.mail_outbox DROP CONSTRAINT IF EXISTS ck_mail_outbox_also_to;
ALTER TABLE _basedb.mail_outbox ADD CONSTRAINT ck_mail_outbox_also_to
  CHECK (also_to IS NULL OR cardinality(also_to) <= 50);
ALTER TABLE _basedb.mail_outbox DROP CONSTRAINT IF EXISTS ck_mail_outbox_cc;
ALTER TABLE _basedb.mail_outbox ADD CONSTRAINT ck_mail_outbox_cc
  CHECK (cc IS NULL OR cardinality(cc) <= 20);

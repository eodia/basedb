-- ────────────────────────────────────────────────────────────────────────
-- 0019 — Un index sous chaque clé étrangère des tables de 0014 à 0017.
--
-- Chapitre 02 : sans index du côté qui référence, supprimer la ligne visée parcourt toute
-- la table qui la cite (la dérive CAT-IDX, qui doit rester vide). Les droits par ligne, les
-- valeurs par défaut, la file des courriels et les modèles de document en citaient sans.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Rejouable : IF NOT EXISTS partout.
-- ────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_row_permission_created_by ON _basedb.row_permission (created_by);
CREATE INDEX IF NOT EXISTS idx_row_permission_updated_by ON _basedb.row_permission (updated_by);

CREATE INDEX IF NOT EXISTS idx_field_default_updated_by ON _basedb.field_default (updated_by);

CREATE INDEX IF NOT EXISTS idx_mail_outbox_tenant ON _basedb.mail_outbox (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_user ON _basedb.mail_outbox (user_id);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_automation ON _basedb.mail_outbox (automation_id);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_run ON _basedb.mail_outbox (run_id);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_notification ON _basedb.mail_outbox (notification_id);

CREATE INDEX IF NOT EXISTS idx_document_template_created_by
  ON _basedb.document_template (created_by);
CREATE INDEX IF NOT EXISTS idx_document_template_updated_by
  ON _basedb.document_template (updated_by);

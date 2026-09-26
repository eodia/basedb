-- ────────────────────────────────────────────────────────────────────────
-- 0002 — Comptes de chacun, projets de chacun, partage par invitation
-- (chapitre 05 §15.1 et §15.8, chapitre 13 §8).
--
-- Rejouable : chaque instruction tient compte de ce qui existe deja, pour qu'une base
-- de developpement creee entre deux versions monte comme une installation publiee.
-- ────────────────────────────────────────────────────────────────────────

-- Le role propre d'une personne, son seul membre, qui porte les acces qu'on lui partage
-- directement. Jamais liste parmi les groupes.
ALTER TABLE _basedb.role DROP CONSTRAINT IF EXISTS role_kind_check;
ALTER TABLE _basedb.role
  ADD CONSTRAINT role_kind_check CHECK (kind IN ('group', 'token', 'person'));

-- Le nom d'un projet est unique parmi les projets de la personne qui l'a cree, pas dans le
-- tenant : chacun cree ses projets, et un nom deja pris par un projet qu'on ne voit pas ne
-- doit ni bloquer ni reveler qu'il existe. L'ancienne unicite etant plus stricte, aucune
-- ligne existante ne la contredit.
DROP INDEX IF EXISTS _basedb.uq_project_label_live;
CREATE UNIQUE INDEX uq_project_label_live
  ON _basedb.project (tenant_id, created_by, label_key) WHERE deleted_at IS NULL;

-- Une invitation a un projet ou a une base, a un niveau : un lien a usage unique que la
-- personne invitee ouvre pour recevoir l'acces, en se connectant ou en creant son compte.
-- L'adresse est un repere pour qui invite, pas une condition : c'est le lien qui prouve.
CREATE TABLE IF NOT EXISTS _basedb.invitation (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  scope_kind text NOT NULL CHECK (scope_kind IN ('project','base')),
  scope_project_id uuid NULL REFERENCES _basedb.project(id) ON DELETE CASCADE,
  scope_base_id    uuid NULL REFERENCES _basedb.base(id)    ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('read','edit','manage')),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  -- Le secret du lien : son empreinte pour le retrouver, et le secret scelle par la cle
  -- d'instance pour le remontrer a qui gere l'acces. Jamais en clair.
  token_hash   bytea NOT NULL,
  token_sealed text NOT NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  accepted_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  revoked_at  timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by  uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  CONSTRAINT uq_invitation_token UNIQUE (token_hash),
  CONSTRAINT ck_invitation_scope CHECK (
    (scope_kind = 'project') = (scope_project_id IS NOT NULL)
    AND (scope_kind = 'base') = (scope_base_id IS NOT NULL)),
  CONSTRAINT ck_invitation_accepted CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_invitation_tenant   ON _basedb.invitation (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitation_project  ON _basedb.invitation (scope_project_id);
CREATE INDEX IF NOT EXISTS idx_invitation_base     ON _basedb.invitation (scope_base_id);
CREATE INDEX IF NOT EXISTS idx_invitation_accepted ON _basedb.invitation (accepted_by);
CREATE INDEX IF NOT EXISTS idx_invitation_creator  ON _basedb.invitation (created_by);

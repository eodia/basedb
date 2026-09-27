-- ────────────────────────────────────────────────────────────────────────
-- 0007 — Le partage d'un tableau de bord par un lien (chapitre 18 §2.5).
--
-- Comme une vue partagee (chapitre 15 §10) : un lien public, ou reserve aux membres
-- connectes du tenant — eventuellement a certains groupes —, qui ouvre le tableau en
-- lecture a qui n'a aucun droit sur la base. Ses cartes lisent alors sur l'autorite de la
-- personne qui a publie le partage, reverifiee a chaque lecture, et rien d'autre que ce
-- que le tableau montre : ni exploration, ni requete fournie par le visiteur.
--
-- Le secret du lien : son empreinte pour le retrouver, et le secret scelle par la cle
-- d'instance pour le remontrer a qui partage. Jamais en clair. Un seul partage par tableau.
--
-- Rejouable : chaque instruction tient compte de ce qui existe deja.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _basedb.dashboard_share (
  id           uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES _basedb.tenant(id) ON DELETE RESTRICT,
  dashboard_id uuid NOT NULL REFERENCES _basedb.dashboard(id) ON DELETE CASCADE,
  base_id      uuid NOT NULL REFERENCES _basedb.base(id) ON DELETE CASCADE,
  access       text NOT NULL CHECK (access IN ('public', 'members')),
  token_hash   bytea NOT NULL,
  token_sealed text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  -- La page peut s'integrer dans une autre (iframe) quand on l'a voulu.
  can_embed    boolean NOT NULL DEFAULT false,
  -- Au nom de qui les cartes lisent : la derniere personne qui a enregistre le partage.
  published_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by   uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  updated_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_dashboard_share_dashboard UNIQUE (dashboard_id),
  CONSTRAINT uq_dashboard_share_token UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_share_tenant    ON _basedb.dashboard_share (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_share_base      ON _basedb.dashboard_share (base_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_share_publisher ON _basedb.dashboard_share (published_by);
CREATE INDEX IF NOT EXISTS idx_dashboard_share_creator   ON _basedb.dashboard_share (created_by);

-- Un partage « membres » peut etre reserve a des groupes ; sans ligne ici, tout membre
-- connecte du tenant le lit.
CREATE TABLE IF NOT EXISTS _basedb.dashboard_share_role (
  share_id uuid NOT NULL REFERENCES _basedb.dashboard_share(id) ON DELETE CASCADE,
  role_id  uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE CASCADE,
  PRIMARY KEY (share_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_share_role_role ON _basedb.dashboard_share_role (role_id);

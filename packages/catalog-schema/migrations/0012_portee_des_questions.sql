-- ────────────────────────────────────────────────────────────────────────
-- 0012 — Des questions a soi (chapitre 18 §1, chapitre 11 §1.7).
--
-- Une question etait a toute la base, et seul qui la construit l'enregistrait. Elle
-- prend l'audience des requetes enregistrees : personnelle — son auteur seul la voit,
-- et quiconque lit la base en garde —, a toute la base, ou a des groupes
-- (question_role). Les questions existantes restent a toute la base. Personne n'y
-- gagne de droit : chacun l'execute avec les siens, en lecture.
--
-- L'auteur d'une question est son createur (created_by).
--
-- Rejouable : chaque instruction laisse en l'etat ce qui l'est deja.
-- ────────────────────────────────────────────────────────────────────────

-- personal : son auteur seul la voit ; base : quiconque lit la base ; groups : les
-- membres des groupes de question_role, et qui gere la structure de la base.
ALTER TABLE _basedb.question
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'base';
ALTER TABLE _basedb.question ALTER COLUMN audience SET DEFAULT 'personal';
ALTER TABLE _basedb.question DROP CONSTRAINT IF EXISTS ck_question_audience;
ALTER TABLE _basedb.question
  ADD CONSTRAINT ck_question_audience CHECK (audience IN ('personal', 'base', 'groups'));

CREATE TABLE IF NOT EXISTS _basedb.question_role (
  question_id uuid NOT NULL REFERENCES _basedb.question(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES _basedb.role(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_question_role_role ON _basedb.question_role (role_id);

-- ────────────────────────────────────────────────────────────────────────
-- 0013 — La vue quiz (chapitre 11 §1.4, chapitre 15).
--
-- Un quiz pose les questions d'un questionnaire, une par ecran, mais chacune peut avoir
-- une bonne reponse et des points : le score se compte a la fin, et peut s'ecrire dans
-- un champ nombre de la ligne. Tout tient dans le spec de la vue ; le catalogue n'a qu'a
-- accepter le nouveau genre.
--
-- La contrainte de 0001 etait anonyme (view_def_kind_check) : elle prend un nom, pour que
-- la suivante sache laquelle remplacer.
--
-- Rejouable : chaque instruction laisse en l'etat ce qui l'est deja.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE _basedb.view_def DROP CONSTRAINT IF EXISTS view_def_kind_check;
ALTER TABLE _basedb.view_def DROP CONSTRAINT IF EXISTS ck_view_def_kind;
ALTER TABLE _basedb.view_def
  ADD CONSTRAINT ck_view_def_kind
  CHECK (kind IN ('grid','kanban','calendar','timeline','gallery','list','form','survey','quiz'));

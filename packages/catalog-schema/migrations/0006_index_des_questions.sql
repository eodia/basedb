-- ────────────────────────────────────────────────────────────────────────
-- 0006 — L'index des questions d'une base, entier (chapitre 02, derive CAT-IDX).
--
-- 0005 l'avait fait partiel, sur les seules questions non supprimees : il sert la liste,
-- mais pas la cle etrangere vers la base, dont la suppression parcourrait alors toute la
-- table. Un index entier sert les deux ; 0005, deja appliquee, ne change plus.
--
-- Rejouable : l'ancien index tombe s'il existe, le nouveau n'est cree qu'une fois.
-- ────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS _basedb.idx_question_base;

CREATE INDEX IF NOT EXISTS idx_question_base ON _basedb.question (base_id, position);

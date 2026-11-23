-- ────────────────────────────────────────────────────────────────────────
-- 0025 — Les tableaux de bord de basedb s'en vont : ceux d'insights les remplacent.
--
-- Chapitre 19 §5 : « Tableaux de bord » ouvre insights, branché à côté de basedb ; ses
-- tableaux croisent les bases de basedb et les sources externes. Les tableaux natifs
-- (chapitre 18), leurs partages publics et leurs rôles partent avec leurs données. Les
-- questions enregistrées restent.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Ni transaction explicite, ni CREATE INDEX CONCURRENTLY : elle s'exécute déjà dans une.
-- Une fois publiée, elle ne change plus : la correction va dans la suivante.
-- ────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS _basedb.dashboard_share_role;
DROP TABLE IF EXISTS _basedb.dashboard_share;
DROP TABLE IF EXISTS _basedb.dashboard;

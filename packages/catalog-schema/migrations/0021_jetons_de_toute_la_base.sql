-- ────────────────────────────────────────────────────────────────────────
-- 0021 — Un jeton pour toute la base, tous ses environnements.
--
-- Chapitre 08 §11.3, chapitre 14 §1 : un jeton s'attachait à UNE ligne de _basedb.base,
-- donc à un seul environnement ; brancher la production et la recette demandait deux
-- jetons, deux configurations, deux noms de base. Un jeton qui couvre tous les
-- environnements garde base_id sur la production de la base, et ouvre chaque base de la
-- même lignée : l'environnement se choisit à chaque requête (en-tête
-- X-Basedb-Environment, ?environment= de l'adresse MCP, argument environment des outils).
--
-- Les jetons existants restent sur leur seul environnement (false) : une migration
-- n'élargit pas en silence ce qu'un jeton déjà distribué peut ouvrir.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Rejouable : IF NOT EXISTS partout.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE _basedb.api_token
  ADD COLUMN IF NOT EXISTS all_environments boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN _basedb.api_token.all_environments IS
  'true : le jeton ouvre tous les environnements de la base de base_id (sa production),
   ceux d''aujourd''hui et ceux qu''on ajoutera ; false : base_id seul. Ses droits restent
   ceux de son rôle, recoupés environnement par environnement avec ceux de son créateur.';

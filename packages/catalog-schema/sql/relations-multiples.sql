-- ════════════════════════════════════════════════════════════════════════
-- Relations multiples — chapitre 04 §4 bis (normatif sur ces objets).
--
-- FICHIER ÉCRIT À LA MAIN, à la différence du reste de la migration.
--
-- Une relation multiple est une colonne uuid[] : aucune clé étrangère ne peut porter
-- sur un tableau. Son intégrité est tenue par deux fonctions partagées (A9), jamais
-- une par table, que le moteur DDL attache à la source et à la cible de chaque champ.
-- Elles lèvent les SQLSTATE d'une contrainte (23514, 23503), que le noyau retraduit
-- comme ceux d'une clé étrangère.
--
-- SECURITY DEFINER, comme une vérification de clé étrangère s'exécute avec les droits
-- du propriétaire de la table : la console SQL écrit sous un rôle restreint, qui doit
-- être tenu par la règle sans avoir à lire la table cible. Les arguments viennent du
-- moteur DDL, jamais d'un appelant, et chaque nom passe par format(%I).
-- ════════════════════════════════════════════════════════════════════════

-- Sur la source : BEFORE INSERT OR UPDATE OF "<colonne>" FOR EACH ROW.
-- TG_ARGV : 0 colonne, 1 schéma de la cible, 2 table de la cible.
CREATE FUNCTION _basedb_local.multi_link_check_v1() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog
AS $fn$
DECLARE
  v_ids     uuid[];
  v_found   bigint;
  v_missing uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) USING NEW INTO v_ids;
  IF v_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vide s'écrit NULL, comme pour le choix multiple ; un tableau imbriqué ou un élément
  -- nul ne désigne rien.
  IF cardinality(v_ids) = 0 OR array_ndims(v_ids) <> 1
     OR array_position(v_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'relation multiple « % » : liste vide, imbriquée ou avec un élément nul', TG_ARGV[0]
      USING ERRCODE = 'check_violation', COLUMN = TG_ARGV[0];
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v_ids) AS u(x)) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'relation multiple « % » : une ligne y figure deux fois', TG_ARGV[0]
      USING ERRCODE = 'check_violation', COLUMN = TG_ARGV[0];
  END IF;

  -- FOR KEY SHARE, comme une clé étrangère : une suppression concurrente de la cible
  -- attend la fin de cette transaction, ou la vérification la voit.
  EXECUTE format(
    'SELECT count(*) FROM (SELECT 1 FROM %I.%I t WHERE t."_id" = ANY($1) FOR KEY SHARE) s',
    TG_ARGV[1], TG_ARGV[2])
    USING v_ids INTO v_found;
  IF v_found <> cardinality(v_ids) THEN
    EXECUTE format(
      'SELECT x FROM unnest($1) AS u(x) WHERE NOT EXISTS (SELECT 1 FROM %I.%I t WHERE t."_id" = x) LIMIT 1',
      TG_ARGV[1], TG_ARGV[2])
      USING v_ids INTO v_missing;
    RAISE EXCEPTION 'relation multiple « % » : la ligne % n''existe pas dans %.%',
      TG_ARGV[0], v_missing, TG_ARGV[1], TG_ARGV[2]
      USING ERRCODE = 'foreign_key_violation', COLUMN = TG_ARGV[0], DETAIL = v_missing::text;
  END IF;
  RETURN NEW;
END
$fn$;

-- Sur la cible : AFTER DELETE FOR EACH STATEMENT REFERENCING OLD TABLE AS old_rows.
-- TG_ARGV : 0 schéma de la source, 1 table de la source, 2 colonne, 3 on_delete.
--
-- En fin d'instruction, comme NO ACTION : une suppression en lot qui retire, dans la
-- même instruction, une ligne et celles qui la citent — une table qui se lie à
-- elle-même — réussit.
CREATE FUNCTION _basedb_local.multi_link_deleted_v1() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF TG_ARGV[3] = 'restrict' THEN
    EXECUTE format(
      'SELECT o."_id" FROM old_rows o
        WHERE EXISTS (SELECT 1 FROM %I.%I s WHERE s.%I @> ARRAY[o."_id"]) LIMIT 1',
      TG_ARGV[0], TG_ARGV[1], TG_ARGV[2])
      INTO v_id;
    IF v_id IS NOT NULL THEN
      RAISE EXCEPTION 'la ligne % est encore liée par %.%.%', v_id, TG_ARGV[0], TG_ARGV[1], TG_ARGV[2]
        USING ERRCODE = 'foreign_key_violation', DETAIL = v_id::text;
    END IF;
  ELSE
    -- « Retirer de la liste » : l'ordre des autres est gardé, une liste vidée devient NULL.
    EXECUTE format(
      'UPDATE %1$I.%2$I s
          SET %3$I = NULLIF(ARRAY(SELECT u.x FROM unnest(s.%3$I) WITH ORDINALITY AS u(x, i)
                                   WHERE u.x NOT IN (SELECT o."_id" FROM old_rows o)
                                   ORDER BY u.i), ''{}''::uuid[])
        WHERE s.%3$I && ARRAY(SELECT o."_id" FROM old_rows o)',
      TG_ARGV[0], TG_ARGV[1], TG_ARGV[2]);
  END IF;
  RETURN NULL;
END
$fn$;

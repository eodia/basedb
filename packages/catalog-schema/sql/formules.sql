-- ════════════════════════════════════════════════════════════════════════
-- Fonctions des formules — chapitre 04 §7.3.
--
-- FICHIER ÉCRIT À LA MAIN. Une formule stockée est une colonne générée : toute fonction
-- qu'elle appelle doit être IMMUABLE, et ne jamais lever d'erreur — le calcul ayant
-- lieu à l'écriture, une erreur rendrait la ligne inécrivable pour toujours.
--
-- Comme fold_v1, une fonction n'est jamais remplacée : une évolution crée une _v2.
-- ════════════════════════════════════════════════════════════════════════

-- DATE(a; m; j) : la date, ou NULL si elle n'existe pas — le 31 février n'est pas une
-- erreur d'écriture, c'est une valeur vide.
CREATE FUNCTION _basedb_local.safe_date_v1(y numeric, m numeric, d numeric) RETURNS date
  LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
  SET search_path = pg_catalog
AS $fn$
BEGIN
  IF y IS NULL OR m IS NULL OR d IS NULL
     OR y < 1 OR y > 9999 OR m < 1 OR m > 12 OR d < 1 OR d > 31 THEN
    RETURN NULL;
  END IF;
  RETURN make_date(y::int, m::int, d::int);
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$fn$;

COMMENT ON FUNCTION _basedb_local.safe_date_v1(numeric, numeric, numeric) IS
  'DATE() des formules : une date, ou NULL si elle n''existe pas. Immuable, jamais remplacée.';

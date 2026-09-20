-- Pliage casse et accents — chapitre 04 §1.8, qui fait autorité sur le corps.
--
-- Ce fichier est CONFRONTÉ au document par un test : toute divergence, dans un sens
-- comme dans l'autre, fait échouer la suite. Le corps ne se corrige donc pas ici.
--
-- La fonction n'est JAMAIS remplacée. Un `CREATE OR REPLACE` ultérieur rendrait faux,
-- sans aucune erreur, tous les index d'expression bâtis sur elle : une évolution du
-- pliage crée `fold_v2` et reconstruit les index des champs concernés.

CREATE FUNCTION _basedb_local.fold_v1(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog AS $$
  SELECT lower(
    regexp_replace(
      normalize(t, NFKD),
      U&'[\0300-\036F\1AB0-\1AFF\1DC0-\1DFF\20D0-\20FF\FE20-\FE2F]',
      '', 'g'
    ) COLLATE "und-x-icu"
  );
$$;

COMMENT ON FUNCTION _basedb_local.fold_v1(text) IS
  'Pliage casse et accents, version 1. Immuable : jamais remplacée, une évolution crée fold_v2.';

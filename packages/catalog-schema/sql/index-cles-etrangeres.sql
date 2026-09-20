-- Index des colonnes référençantes du catalogue.
--
-- FICHIER ÉCRIT À LA MAIN, à la différence du DDL engendré.
--
-- Le chapitre 02, « Indexation des clés étrangères du catalogue », pose la règle :
--
--   « Toute colonne référençante d'une clé étrangère du catalogue porte un index non
--     partiel, en plus des index partiels de service. »
--
-- et précise que les blocs DDL du chapitre les OMETTENT délibérément, « où ils
-- noieraient la structure », la liste n'étant « pas tenue à la main » mais établie
-- mécaniquement par la dérive CAT-IDX.
--
-- C'est donc ce bloc qui l'établit. PostgreSQL indexe le côté référencé d'une clé
-- étrangère, jamais le côté référençant : sans cet index, chaque suppression de clé
-- parente déclenche un balayage séquentiel de la table enfant avec pose de verrous de
-- ligne. Le piège, dans un catalogue truffé d'index partiels, est que cette
-- vérification interne NE PORTE PAS le prédicat du partiel — d'où l'exigence d'un
-- index non partiel.
--
-- Idempotent : relancer la migration ne crée rien de nouveau.

DO $ix$
DECLARE
  r      record;
  nom    text;
  base   text;
BEGIN
  FOR r IN
    SELECT
      c.conrelid::regclass::text AS relation,
      rel.relname                AS table_courte,
      (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS colonnes,
      (SELECT string_agg(a.attname, '__' ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS suffixe
    FROM pg_constraint c
    JOIN pg_namespace n   ON n.oid = c.connamespace
    JOIN pg_class     rel ON rel.oid = c.conrelid
   WHERE n.nspname = '_basedb'
     AND c.contype = 'f'
     -- Aucun index NON PARTIEL dont la clé commence par les colonnes de la contrainte.
     -- `indkey::smallint[]` est un tableau à base 0, d'où le découpage à partir de 0.
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indpred IS NULL
          AND (i.indkey::smallint[])[0:array_length(c.conkey, 1) - 1] = c.conkey
     )
   ORDER BY 1, 2
  LOOP
    -- Motif normatif du chapitre 01 §9.1 : `ix_<table>__<colonne>[__<colonne>…]`.
    base := 'ix_' || r.table_courte || '__' || r.suffixe;

    -- Budget de 63 octets (A6). La troncature est dure, puis le `_` final retiré ;
    -- une collision de nom reste possible en théorie et ferait échouer la migration
    -- bruyamment, ce qui est préférable à un index silencieusement absent.
    nom := rtrim(left(base, 63), '_');

    EXECUTE format('CREATE INDEX %I ON %s (%s)', nom, r.relation, r.colonnes);
  END LOOP;
END
$ix$;

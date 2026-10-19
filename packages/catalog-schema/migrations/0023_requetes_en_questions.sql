-- ────────────────────────────────────────────────────────────────────────
-- 0023 — Les requêtes enregistrées deviennent des questions SQL.
--
-- Chapitre 11 §1.7, chapitre 18 §1 : « Requête SQL » (la console et ses requêtes
-- enregistrées) et « Nouvelle question SQL » ne font plus qu'une question. Une requête
-- enregistrée est une question SQL — son texte, sa portée, son auteur —, montrée en
-- tableau tant que personne n'en a choisi un autre dessin.
--
-- Chaque requête passe dans _basedb.question sous le MÊME identifiant : l'adresse
-- d'une requête (/requetes/<id>), un signet, un onglet ouvert la retrouvent. Ses
-- groupes passent dans _basedb.question_role. L'ancienne table reste, une version, pour
-- qui voudrait relire ce qu'elle contenait ; plus rien ne l'écrit.
--
-- Rien n'est copié deux fois : ON CONFLICT DO NOTHING, sur l'identifiant. Une requête dont
-- la question existe déjà — la migration rejouée — n'est pas recopiée, ni modifiée.
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Ni transaction explicite, ni CREATE INDEX CONCURRENTLY : elle s'exécute déjà dans une.
-- Une fois publiée, elle ne change plus : la correction va dans la suivante.
-- ────────────────────────────────────────────────────────────────────────

-- Les requêtes, à la suite des questions de leur base, dans l'ordre où elles furent écrites.
-- L'auteur d'une question est son créateur (created_by) : le propriétaire de la requête.
INSERT INTO _basedb.question
  (id, base_id, label, description, kind, query, visualization, position, audience,
   created_at, created_by, updated_at, updated_by)
SELECT q.id,
       q.base_id,
       q.label,
       q.description,
       'sql',
       jsonb_build_object('kind', 'sql', 'sql', q.statement),
       jsonb_build_object('type', 'table'),
       coalesce((SELECT max(p.position) FROM _basedb.question p WHERE p.base_id = q.base_id), 0)
         + row_number() OVER (PARTITION BY q.base_id ORDER BY q.created_at, q.id),
       q.audience,
       q.created_at,
       q.owner_id,
       q.updated_at,
       q.updated_by
  FROM _basedb.saved_query q
ON CONFLICT (id) DO NOTHING;

-- Les groupes à qui une requête « groups » était ouverte. Une question qui a déjà ses groupes
-- — la migration rejouée, une portée changée depuis — garde les siens.
INSERT INTO _basedb.question_role (question_id, role_id)
SELECT r.query_id, r.role_id
  FROM _basedb.saved_query_role r
  JOIN _basedb.question q ON q.id = r.query_id AND q.kind = 'sql'
 WHERE NOT EXISTS (SELECT 1 FROM _basedb.question_role x WHERE x.question_id = r.query_id)
ON CONFLICT DO NOTHING;

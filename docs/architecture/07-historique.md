# 07 — Historique des données et des structures

## Rôle de ce chapitre

Ce chapitre spécifie deux journaux distincts, qui n'ont ni le même mécanisme de capture, ni la même volumétrie, ni la même rétention :

- l'**historique des données** : qui a changé quelle valeur, dans quel enregistrement, quand, et quelle était la valeur avant ;
- l'**historique des structures** : quelle migration a créé, modifié ou supprimé quel objet de catalogue, demandée par qui, appliquée par qui, avec quel DDL exact et quel résultat.

Il est normatif sur la **liste des déclencheurs posés sur une table utilisateur** (A10), sur le corps de la fonction de capture `_basedb_local.capture_v1()`, sur le drain qui transfère les tampons vers `_basedb`, sur `record_revision`, `record_revision_field`, `record_deletion`, `bulk_operation`, `structure_revision`, `migration_execution` et `change_feed_state`, sur l'immuabilité des journaux, et sur le partitionnement, la purge, l'archivage et l'effacement ciblé qui les entourent.

Il ne redéfinit pas : le schéma `_basedb_local`, les tampons `revision_buffer` et `change_event_buffer`, `_basedb.change_event`, `_basedb.webhook_delivery`, `_basedb.migration`, `_basedb.audit_log`, `_basedb.retention_policy` et le registre des classes de verrous (chapitre 02) ; les motifs de noms dérivés et le contrat de connexion (chapitre 01) ; la machine à états des opérations de structure (chapitre 03) ; la projection des types (chapitre 04) ; le point d'application unique des permissions (chapitre 05) ; la suppression logique et la purge des objets (chapitre 06) ; la forme de la charge utile d'un webhook, sa signature et ses rejeux (chapitre 08).

---

## 1. Capture et drain

### 1.1 Le mécanisme

Conformément à A10, la capture se fait par **déclencheurs PostgreSQL au niveau instruction**, dans la transaction qui écrit la donnée, vers les **tables tampon de `_basedb_local`** ; un **drain** transfère ensuite les lignes vers `_basedb`.

Trois propriétés fondent ce choix.

**Aucun déclencheur d'un schéma `b_*` n'écrit ni ne lit `_basedb`.** Le déclencheur appelle une fonction de `_basedb_local` qui écrit dans `_basedb_local` : la donnée, ses fonctions partagées et ses tampons restent d'un seul côté de la frontière que A9 protège, et la séparation physique ultérieure du catalogue ne casse aucun objet. Une écriture directe dans `_basedb` depuis un schéma de données rendrait cette séparation impossible.

**La capture est dans la transaction de la donnée.** Une écriture SQL directe faite par un humain avec `psql` est historisée comme les autres, et une transaction annulée ne laisse aucune trace : c'est la promesse centrale du cadrage. Une capture applicative produirait un journal qui ment par omission, et un journal qui ment par omission est pire qu'une absence de journal, parce qu'on s'y fie.

**Le déclencheur est au niveau instruction, pas au niveau ligne.** Un déclencheur `FOR EACH ROW` en PL/pgSQL coûte une invocation et une ouverture de contexte par ligne ; sur un `UPDATE` de 100 000 lignes, il multiplie la durée par un facteur à deux chiffres. Les tables de transition (`REFERENCING OLD TABLE` / `NEW TABLE`) donnent à une seule invocation la totalité des lignes de l'instruction et permettent d'écrire le tampon par un `INSERT … SELECT` ensembliste.

Conséquence directe de la colocalisation : **l'écriture utilisateur ne dépend plus de la disponibilité du catalogue**. Une partition d'historique manquante, un disque plein sur le tablespace de `_basedb`, une migration de catalogue en cours arrêtent le drain, pas les écritures. Ce qui reste indispensable au chemin d'écriture est réduit au minimum : un tampon local, sans index de service et sans contrainte référentielle.

### 1.2 Les déclencheurs posés sur une table utilisateur — liste normative

**Cette liste fait foi.** Elle est la seule source du vocabulaire fermé des rôles du motif `tg_<table>__<role>` fixé par le chapitre 01 §9.1, et aucun autre chapitre n'y ajoute de rôle. Le moteur DDL émet les cinq déclencheurs en même temps que la table, dans la même étape de structure. PostgreSQL interdisant les tables de transition sur un déclencheur déclaré pour plusieurs événements, il en faut un par opération.

| Rôle | Nom | Moment | Fonction appelée | Effet |
|---|---|---|---|---|
| `system` | `tg_<table>__system` | `BEFORE INSERT OR UPDATE FOR EACH ROW` | `_basedb_local.set_updated_at()` (chapitre 02) | Renseigne `_updated_at` et `_updated_by` |
| `capture_ins` | `tg_<table>__capture_ins` | `AFTER INSERT FOR EACH STATEMENT REFERENCING NEW TABLE AS new_rows` | `_basedb_local.capture_v1()` | Capture des créations |
| `capture_upd` | `tg_<table>__capture_upd` | `AFTER UPDATE FOR EACH STATEMENT REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows` | idem | Capture des modifications, appariement sur `_id` |
| `capture_del` | `tg_<table>__capture_del` | `AFTER DELETE FOR EACH STATEMENT REFERENCING OLD TABLE AS old_rows` | idem | Capture des suppressions, ligne complète |
| `capture_trunc` | `tg_<table>__capture_trunc` | `BEFORE TRUNCATE FOR EACH STATEMENT` | `_basedb_local.assert_no_truncate()` | Lève `TRUNCATE_FORBIDDEN` |

Quatre règles attachées à cette liste :

1. **Les cinq noms sont alloués au registre** `_basedb.physical_name` en `object_kind = 'trigger'`, portée `table`, comme tout nom dérivé. Le rôle le plus long est `capture_trunc` : les parties fixes de `tg_<table>__capture_trunc` valent 18 octets, le budget du composant « table » est donc de 45 octets et la répartition du chapitre 01 §9.6 s'applique dès que le nom de table le dépasse. **Aucun nom n'est produit par concaténation directe**, donc aucune troncature silencieuse à 63 octets n'est possible.
2. **La réconciliation ne cherche jamais un déclencheur par nom reconstruit** : elle l'identifie par `pg_trigger.tgrelid` et `pg_trigger.tgfoid`, puis rapproche la ligne de registre. Le nom sert l'œil humain qui lit un message d'erreur, pas le programme.
3. **Les déclencheurs sont créés en mode `ORIGIN` (`pg_trigger.tgenabled = 'O'`), jamais `ALWAYS`.** `ALWAYS` les ferait survivre à une session `replica` sur une instance disposant d'un superutilisateur, donc à une restauration conduite par cet exploitant, qui régénérerait un historique intégral daté du jour. La réconciliation exige exactement `'O'` ; toute autre valeur est un incident (§13).
4. **Les arguments des déclencheurs de capture sont immuables** : `base_id`, `table_id`, `format_version`. Aucun n'est affecté par un ajout, une suppression ou une purge de champ, donc **aucune migration de colonne ne recrée les déclencheurs** et aucune carte de colonnes figée ne peut diverger du catalogue. La correspondance colonne physique → champ est établie par le drain, à partir du catalogue relu au moment du drain.

```sql
CREATE TRIGGER "tg_factures__capture_upd"
  AFTER UPDATE ON "b_t4z56fq_crm"."factures"
  REFERENCING OLD TABLE AS "old_rows" NEW TABLE AS "new_rows"
  FOR EACH STATEMENT
  EXECUTE FUNCTION _basedb_local.capture_v1('<base_id>', '<table_id>', '1');
```

### 1.3 La fonction de capture `_basedb_local.capture_v1()`

**Attributs figés.** La fonction fixe elle-même son environnement d'exécution, parce qu'elle s'exécute aussi sur des sessions qui n'ont pas le contrat de connexion du chapitre 01 §10.3 — celles d'un humain avec `psql` :

```sql
CREATE FUNCTION _basedb_local.capture_v1() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog
  SET "TimeZone" = 'UTC'
  SET "DateStyle" = 'ISO, YMD'
  SET "IntervalStyle" = 'iso_8601'
  SET extra_float_digits = 0
AS $fn$ … $fn$;
```

Sans ces quatre derniers `SET`, `to_jsonb()` sérialiserait un `timestamptz` dans le fuseau de la session appelante : la même valeur écrite depuis l'application (`UTC`) et depuis un `psql` réglé sur `Europe/Paris` produirait deux chaînes JSON différentes, un `IS DISTINCT FROM` entre deux états successifs signalerait un changement qui n'a pas eu lieu, et les rejeux de tests cesseraient d'être déterministes. **Toute valeur temporelle traverse donc la capture en UTC, au format ISO 8601**, et n'est convertie qu'à l'affichage. `search_path = pg_catalog` et la qualification explicite de tous les objets du corps appliquent la règle du chapitre 01 §10.1 : une fonction de déclenchement hérite sinon du `search_path` de l'appelant, ce qui est un vecteur de détournement sur le chemin d'écriture de **toutes** les tables du produit.

**Aucune instruction SQL statique de la fonction ne référence `old_rows` ni `new_rows`.** C'est une règle, pas une préférence. PL/pgSQL met en cache un plan par instruction statique ; les tables de transition sont des relations éphémères dont le descripteur de tuple est celui de la table au moment de la planification. Une fonction partagée par toutes les tables du produit obtiendrait donc, dès le deuxième appel, un plan construit sur la forme de ligne d'une autre table. Toute la capture passe par `EXECUTE` avec les valeurs en `USING` ; le SQL est replanifié à chaque appel, coût négligeable au regard des écritures qu'il commande.

**Forme du SQL construit**, pour une modification :

```sql
WITH pair AS (
  SELECT n."_id" AS record_id,
         pg_catalog.to_jsonb(o) AS before,
         pg_catalog.to_jsonb(n) AS after
  FROM   "old_rows" o
  JOIN   "new_rows" n ON n."_id" = o."_id"
)
INSERT INTO _basedb_local.revision_buffer
  (base_id, table_id, record_id, op, is_cascade, actor_kind, actor_user_id,
   actor_token_id, sql_identity, bulk_id, format_version, before, after)
SELECT $1, $2, p.record_id, 'update', pg_catalog.pg_trigger_depth() > 1,
       $3, $4, $5, $6, $7, $8, p.before, p.after
FROM   pair p
WHERE  p.before IS DISTINCT FROM p.after;
```

Quatre propriétés de cette forme :

1. **Le tampon porte la ligne entière, avant et après.** C'est ce qui permet au drain de calculer le delta par champ **et** de servir une charge utile de webhook complète à partir de la même écriture. Aucune correspondance colonne → champ n'est nécessaire ici, donc aucune lecture de catalogue n'a lieu dans le chemin d'écriture.
2. **Une modification qui ne change rien n'écrit rien.** Le prédicat final élimine les `UPDATE` qui réécrivent les mêmes valeurs. Pour une insertion, `before` reçoit un `NULL` SQL et il n'y a pas de prédicat ; pour une suppression, `after` reçoit un `NULL` SQL.
3. **La capture sort immédiatement si la table de transition est vide.** Une instruction `MERGE` déclenche les déclencheurs d'instruction des trois événements mentionnés même quand l'action correspondante n'a concerné aucune ligne ; sans ce test, elle écrirait des lignes de tampon sans contenu.
4. **Le second tampon est conditionnel.** La même invocation écrit dans `_basedb_local.change_event_buffer` si et seulement si la table est abonnée (§11), dans la même transaction.

**Versionnement.** La fonction porte sa version de contrat dans son nom, chaque déclencheur référence une version précise, et chaque ligne de tampon porte `format_version`. Les règles de déploiement sont au §17.

### 1.4 Le drain

Le drain est un processus applicatif, sérialisé par base au moyen du verrou consultatif de classe `drain` du chapitre 02 : `pg_advisory_lock(5, base.lock_key)`. Il s'exécute en continu, avec une scrutation toutes les 5 secondes et un réveil par `NOTIFY` (§11).

Un passage, pour une base :

1. **Lire** au plus `history.drain_batch` lignes (10 000 par défaut) de `_basedb_local.revision_buffer` où `drained_at IS NULL`, par l'index `ix_revision_buffer__pending`, sur le pool `donnees`.
2. **Résoudre** sur le même pool et dans la même transaction de lecture : la valeur d'affichage de chaque enregistrement et celle de chaque lien modifié (§4.2), à partir du catalogue relu pour les tables concernées.
3. **Écrire** sur le pool `catalogue` : les en-têtes dans `_basedb.record_revision`, le détail par champ dans `_basedb.record_revision_field`, les suppressions dans `_basedb.record_deletion` (§6), les compteurs dans `_basedb.bulk_operation` (§5). Le même passage draine `change_event_buffer` vers `_basedb.change_event`.
4. **Marquer** `drained_at` sur le pool `donnees`, puis supprimer les lignes ainsi marquées au passage suivant.

**L'idempotence est structurelle, et c'est ce qui rend les deux pools acceptables.** L'identifiant de la ligne de tampon devient l'identifiant de la révision : `record_revision` est alimentée en `INSERT … ON CONFLICT (id, occurred_at) DO NOTHING`, `record_revision_field` en `ON CONFLICT (revision_id, occurred_at, field_id) DO NOTHING`, `record_deletion` et `change_event` de même. Une panne entre les étapes 3 et 4 provoque un rejeu qui ne produit aucun doublon ; une panne pendant l'étape 3 provoque un rejeu qui complète ce qui manque. Aucune validation en deux phases n'est nécessaire, ce qui est indispensable puisque `max_prepared_transactions` est un paramètre d'instance que le rôle propriétaire ne peut pas poser.

**Latence et retard.** La cible est une consolidation en moins de 5 secondes. Le retard du drain — âge de la plus ancienne ligne non drainée — est mesuré (§14) ; au-delà de `history.drain_lag_max` (60 s), `DRAIN_LAGGING` est levé, et au-delà d'une heure la gravité est maximale : le tampon n'est borné que par le disque du côté données, et un drain arrêté est un incident, jamais un mode de fonctionnement.

**Conséquence assumée, écrite plutôt que découverte : la consultation de l'historique est décalée du délai de drain.** Une écriture validée il y a deux secondes peut ne pas encore figurer dans `record_revision`. L'écran d'historique affiche la date de dernière consolidation quand celle-ci remonte à plus d'une minute ; il n'invente jamais une ligne manquante.

### 1.5 Ce que la capture attrape, et ce qu'elle n'attrape pas

Sont capturés sans exception : les écritures de l'API REST, du MCP, de l'interface, d'un `psql` interactif, d'un `COPY … FROM`, et **les suppressions et mises à `NULL` en chaîne provoquées par une contrainte `FOREIGN KEY`** (A14) — l'action référentielle émet de véritables instructions sur la table référençante, qui déclenchent ses propres déclencheurs.

Restent trois trous, tous nommés, tous surveillés :

1. **`TRUNCATE`** ne déclenche aucun déclencheur DML. Bouché par `tg_<table>__capture_trunc`, qui refuse l'opération avec `TRUNCATE_FORBIDDEN`. Vider une table passe par `DELETE`, avec le coût d'historisation correspondant, ou par la purge de la table (chapitre 06). Ce refus a une conséquence sur la restauration, traitée au §12.2.
2. **`ALTER TABLE … DISABLE TRIGGER`** : accessible au propriétaire de la table, donc au rôle du produit. C'est le levier de la procédure de restauration (§12.2) et, hors de cette procédure, une anomalie détectée par la réconciliation.
3. **Écriture directe dans les tampons ou dans les journaux** : un humain disposant de la connexion peut fabriquer un faux historique. C'est la même frontière de confiance que pour les données elles-mêmes (§2.3).

**Un quatrième trou n'en est pas un dans le modèle de privilèges retenu**, et il faut le dire précisément pour ne pas bâtir de procédure dessus. `session_replication_role = 'replica'` désactive tous les déclencheurs `ORIGIN` de la session, mais c'est un paramètre de contexte `superuser` : **le rôle propriétaire de la base ne peut pas le positionner**, et le cadrage exclut tout privilège d'instance. Un `GRANT SET ON PARAMETER session_replication_role` accordé par un superutilisateur le rendrait accessible ; c'est un prérequis d'installation facultatif, jamais une capacité acquise. Deux conséquences se déduisent l'une de l'autre : le trou est fermé par construction tant qu'aucun superutilisateur n'intervient ; et **`pg_restore --disable-triggers` repose exactement sur ce paramètre et échoue donc avec le rôle du produit**, d'où la procédure du §12.2.

### 1.6 Ce que la capture coûte réellement

**Instruction mono-ligne — le cas dominant.** En usage réel d'une grille avec édition en ligne, l'immense majorité des instructions portent sur une ligne. Le déclencheur matérialise alors un tuplestore d'une ligne, invoque une fonction PL/pgSQL et exécute une à deux instructions dynamiques sur une table locale sans index de service. L'ordre de grandeur attendu est **0,3 à 0,8 ms ajoutés** à un `UPDATE` mono-ligne dont l'exécution nue vaut 0,2 à 0,5 ms : en proportion, c'est un doublement ; en valeur absolue, c'est invisible derrière les 5 à 20 ms d'aller-retour réseau et d'évaluation des permissions. **Seuil d'acceptation, vérifié en phase 2 : p95 du surcoût ≤ 1,5 ms par écriture mono-ligne**, mesuré sur le jeu de référence du §15.

**Cascade de clé étrangère — le cas coûteux.** Les actions référentielles sont exécutées par des déclencheurs internes `AFTER … FOR EACH ROW` sur la table parente : ils émettent **une instruction par ligne parente**, pas une instruction pour l'ensemble. Supprimer 5 000 lignes parentes déclenche 5 000 `DELETE` sur la table enfant, donc 5 000 invocations de la capture, chacune avec une table de transition de quelques lignes. L'argument d'écriture ensembliste ne s'applique pas à ce chemin, et un garde-fou évalué par instruction n'y verrait jamais rien passer : c'est pourquoi le comptage du §5 est **cumulé par transaction**.

L'ordre d'exécution vaut d'être énoncé : pour une instruction donnée, PostgreSQL exécute les déclencheurs `AFTER … FOR EACH ROW` — dont les déclencheurs référentiels — **avant** le déclencheur `AFTER … FOR EACH STATEMENT` de la même instruction. Les lignes de tampon des enfants sont donc écrites **avant** celle du parent qui les a causées, ce dont le drain tient compte (§4.2).

**Tables de transition et espace temporaire.** Le tuplestore de transition est rempli **pendant** l'exécution de l'instruction, avant tout déclencheur `AFTER`. Il tient en mémoire jusqu'à `work_mem` puis déborde en fichier temporaire, soumis à `temp_file_limit`. Un `COPY … FROM` d'un million de lignes matérialise un million de lignes de transition, que l'historique soit écrit ou non. Dimensionnement retenu : `work_mem` à 64 Mo sur le pool `donnees`, `temp_file_limit` à 8 Go, et **découpe obligatoire des imports en lots de 10 000 lignes côté application** (§5). Aucun mécanisme interne au déclencheur ne réduit ce coût : il est payé avant que le déclencheur n'existe.

---

## 2. Identité de l'auteur

### 2.1 Variables de session, positionnées par transaction

Il n'y a qu'une connexion PostgreSQL partagée et aucun rôle par utilisateur. L'identité voyage donc par des **paramètres de configuration personnalisés**, positionnés au début de chaque transaction d'écriture et lus par la capture et par `set_updated_at()`.

| Variable | Contenu | Posée par |
|---|---|---|
| `basedb.actor_kind` | `user` \| `token` \| `mcp` \| `system` \| `form` | Noyau, à l'ouverture de la transaction |
| `basedb.actor_id` | Clé de catalogue de l'utilisateur | idem |
| `basedb.token_id` | Clé de catalogue du jeton d'intégration, le cas échéant | idem |
| `basedb.bulk_id` | Opération de masse déclarée (§5) | idem |
| `basedb.rows_written` | Compteur cumulé de lignes de tampon écrites dans la transaction (§5) | La capture elle-même |
| `basedb.maintenance` | `on` pendant une purge, un effacement ciblé ou une bascule de partition (§3.5) | Tâches d'exploitation |

Cinq points d'implémentation décisifs :

1. **`SET LOCAL`, jamais `SET`.** Les connexions sont mutualisées ; une valeur de session survivrait à la transaction et attribuerait les écritures suivantes au mauvais auteur. `SET LOCAL` est annulé au `COMMIT` comme au `ROLLBACK`.
2. **`SET LOCAL` n'accepte pas de paramètre lié.** Le positionnement se fait par `SELECT set_config('basedb.actor_id', $1, true)`. Écrire `SET LOCAL basedb.actor_id = '…'` par concaténation serait une injection SQL sur le chemin le plus sensible du produit.
3. **`is_local = true` hors d'un bloc transactionnel est sans effet.** Toute écriture passe donc par un `BEGIN` explicite, y compris une écriture d'une seule instruction. Deux tâches d'exploitation dérogent explicitement à cette règle et le disent : la création et le détachement de partitions (§10.2, §10.3), qui ne peuvent pas s'exécuter dans un bloc transactionnel.
4. **La lecture est tolérante** : `nullif(current_setting('basedb.actor_id', true), '')`. Le second argument évite l'erreur `unrecognized configuration parameter` quand la variable n'a jamais été posée — c'est le cas nominal d'une session SQL directe.
5. **Les variables d'identité ne fixent pas l'environnement de sérialisation.** C'est le contrat de connexion (chapitre 01 §10.3) qui pose `TimeZone`, `DateStyle` et `IntervalStyle` sur les connexions du produit, et les attributs de la fonction de capture (§1.3) qui les garantissent sur toutes les autres.

Les mêmes variables alimentent `_created_by` et `_updated_by`. Conséquence voulue : ces colonnes et l'historique ne peuvent pas diverger, et l'application n'a aucun moyen de les oublier. Conformément à A18, elles sont lisibles dès que la lecture de la table est accordée et ne sont jamais inscriptibles par l'API ; une restauration d'enregistrement (§12.1) est une opération système qui fournit explicitement `_id`, `_created_at` et `_created_by`, valeurs que `set_updated_at()` ne réécrit jamais.

### 2.2 Identité absente : l'écriture SQL directe

**L'écriture n'est jamais refusée pour absence d'identité.** Refuser reviendrait à interdire le SQL direct, c'est-à-dire à renier la promesse du produit.

Quand `basedb.actor_id` est absente ou vide, la ligne est écrite avec `actor_kind = 'sql_direct'`, `actor_user_id` et `actor_token_id` nuls, et `sql_identity` renseignée par la capture avec `session_user`, `application_name`, `pg_backend_pid()` et `inet_client_addr()` assemblés en une chaîne. Le couple `(pg_backend_pid(), instant)` distingue deux sessions simultanées et permet de corréler avec `pg_stat_activity` et les journaux serveur ; `inet_client_addr()` est **nul en connexion par socket Unix locale**, c'est-à-dire dans le cas le plus fréquent d'un `psql` lancé sur le serveur, et doit être affiché comme « connexion locale », jamais comme une adresse vide.

L'interface affiche donc « modification SQL directe — session 48211, connexion locale, `application_name` : `psql` » et non un nom d'utilisateur. C'est une information moins précise, mais c'est une information : la ligne existe, elle est datée, elle porte les valeurs avant et après, et elle porte l'identifiant de transaction qui regroupe toutes les écritures de la même transaction.

Si `basedb.actor_id` contient une valeur qui n'est pas une clé de catalogue valide, la capture **ne lève pas** : elle écrit `actor_kind = 'unknown'` et reporte la chaîne brute dans `sql_identity`. Une variable de session mal formée ne doit jamais faire échouer la transaction d'un utilisateur ; elle doit être visible dans le journal et remonter en métrique (§14).

### 2.3 Ce que ce mécanisme ne protège pas

Les variables de session ne sont **pas une frontière de sécurité**. Quiconque ouvre une session SQL avec le rôle propriétaire peut positionner `basedb.actor_id` à la valeur de son choix, désactiver les déclencheurs d'une table, ou écrire directement dans les tampons. La frontière de confiance est l'accès au compte PostgreSQL propriétaire de la base, et rien d'autre. L'historique est fiable *contre l'erreur et l'oubli*, pas *contre un administrateur malveillant*. Un journal opposable exigerait un rôle par utilisateur, ce que le cadrage exclut.

---

## 3. Stockage de l'historique des données

### 3.1 `_basedb.record_revision` — l'en-tête

Une ligne par couple (enregistrement, instruction), écrite par le drain à partir d'une ligne de tampon dont elle reprend l'identifiant.

```sql
CREATE TABLE _basedb.record_revision (
  id             uuid        NOT NULL,          -- identifiant de la ligne de tampon
  occurred_at    timestamptz NOT NULL,          -- instant de l'ecriture utilisateur
  drained_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  xact_id        xid8        NOT NULL,
  base_id        uuid NOT NULL,
  table_id       uuid NOT NULL,
  record_id      uuid NOT NULL,
  op             text NOT NULL CHECK (op IN ('insert','update','delete')),
  is_cascade     boolean NOT NULL DEFAULT false,
  bulk_id        uuid NULL,
  record_display text NULL,
  actor_kind     text NOT NULL CHECK (actor_kind IN
                   ('user','token','mcp','system','form','sql_direct','unknown')),
  actor_user_id  uuid NULL,
  actor_token_id uuid NULL,
  sql_identity   text NULL,
  format_version smallint NOT NULL,
  PRIMARY KEY (id, occurred_at),
  CONSTRAINT ck_revision_user  CHECK (actor_kind <> 'user'  OR actor_user_id  IS NOT NULL),
  CONSTRAINT ck_revision_token CHECK (actor_kind <> 'token' OR actor_token_id IS NOT NULL)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_revision_record ON _basedb.record_revision (table_id, record_id, occurred_at DESC);
CREATE INDEX idx_revision_actor  ON _basedb.record_revision (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_revision_base   ON _basedb.record_revision (base_id, occurred_at DESC);
CREATE INDEX idx_revision_xact   ON _basedb.record_revision (occurred_at, xact_id);
CREATE INDEX idx_revision_bulk   ON _basedb.record_revision (bulk_id) WHERE bulk_id IS NOT NULL;
```

Cinq points de lecture de ce DDL :

**`occurred_at` est l'instant de l'écriture utilisateur, pas celui du drain.** Il vient de la ligne de tampon, où il vaut `clock_timestamp()` au moment de la capture. `drained_at` porte l'instant de consolidation : c'est le couple des deux qui permet de mesurer le retard du drain après coup et d'expliquer un écran d'historique incomplet.

**L'identifiant de transaction est le couple `(occurred_at, xact_id)`, jamais `xact_id` seul.** Le compteur de transactions est propre à l'instance et repart à zéro après une restauration dans un nouveau cluster : deux révisions séparées de six mois peuvent porter le même `xact_id`, et les afficher comme un seul événement serait un contresens exactement au moment où on enquête. Le couple est indexé dans cet ordre, et l'égalité sur `occurred_at` élague les partitions parfaitement. Le type est `xid8` — natif, comparable, indexable — et non un `bigint` obtenu par transtypage.

**L'ordre à l'intérieur d'une transaction est partiel.** Un UUIDv7 ordonne de façon fiable deux instructions successives, pas les N lignes produites par une même instruction ensembliste, qui partagent la milliseconde. L'affichage ordonne par `(occurred_at DESC, id DESC)` et ne prétend rien de plus ; l'unité de regroupement est la transaction, pas la ligne.

**`is_cascade` porte la distinction exigée par A14** : il vaut `pg_trigger_depth() > 1` au moment de la capture. Une suppression en chaîne est donc historisée comme les autres, et distinguée d'une suppression directe sans aucune comparaison à une ligne racine (§4.1). `record_display` est la valeur d'affichage de la ligne au moment de la révision (§4.2) : une liste « ce que Marc a modifié hier » qui affiche des identifiants n'est pas consultable.

**`form` est l'acteur d'une réponse à un formulaire partagé public** (chapitre 15 §2). La ligne n'a été saisie ni par la personne qui a publié le formulaire, ni par quelqu'un de connu : `actor_user_id` porte le publiant, sur l'autorité duquel la réponse est écrite, et `actor_token_id` le partage (`_basedb.form_share`), que l'écran d'historique résout en « Formulaire « libellé de la vue » ». `_created_by` et `_updated_by` restent à `NULL` : le noyau n'écrit pas d'auteur, et `set_updated_at()` n'en déduit pas un de `basedb.actor_id` pour cet acteur. Une réponse à un partage réservé aux membres, elle, est une écriture `user` ordinaire, au nom de la personne qui a répondu.

### 3.2 `_basedb.record_revision_field` — le détail

Une ligne par champ effectivement modifié, calculée par le drain.

```sql
CREATE TABLE _basedb.record_revision_field (
  revision_id    uuid        NOT NULL,
  occurred_at    timestamptz NOT NULL,
  base_id        uuid        NOT NULL,
  field_id       uuid        NOT NULL,
  field_kind     text        NOT NULL,
  before_value   jsonb NULL,
  after_value    jsonb NULL,
  before_display text  NULL,
  after_display  text  NULL,
  PRIMARY KEY (revision_id, occurred_at, field_id),
  CONSTRAINT ck_revision_field_scalar CHECK (
    (before_value IS NULL OR jsonb_typeof(before_value)
       IN ('string','number','boolean','null')) AND
    (after_value  IS NULL OR jsonb_typeof(after_value)
       IN ('string','number','boolean','null')))
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_revision_field ON _basedb.record_revision_field (field_id, occurred_at DESC);
```

**Aucune clé étrangère vers `record_revision`.** C'est une entorse assumée au principe « déclarer plutôt que vérifier » du chapitre 02, pour trois raisons : le journal est en ajout seul et les deux lignes sont écrites par la même transaction de drain, donc la fenêtre d'incohérence n'existe pas ; une contrainte entre deux tables partitionnées contraindrait l'ordre de détachement des partitions ; et le coût de vérification s'appliquerait à chaque consolidation. Le prix est payé au §10.3, qui **impose l'ordre des lots de purge et une détection d'orphelins**.

**`base_id` est dénormalisé ici**, et c'est la seule dénormalisation retenue. Elle rend autonomes les trois opérations qui, sans elle, devraient toujours passer par l'en-tête : la mesure de volumétrie par base, la purge d'un tenant à rétention plus courte, et l'attribution d'une ligne orpheline. *Alternative écartée* : dénormaliser aussi `table_id` et `record_id`, soit environ 20 % de volume supplémentaire, pour des opérations qui passent de toute façon par les en-têtes.

**`field_kind` est dénormalisé** : c'est ce qui rend la ligne auto-descriptive, donc interprétable même quand le champ a été purgé du catalogue (§7).

**Le drain n'écrit que les colonnes reconnues.** Il apparie les clés du JSON de tampon aux `field.name_id` de la table, relus au catalogue. Une colonne physique sans champ correspondant — colonne reléguée `zz_supprime_…`, colonne ajoutée à la main — n'est pas historisée et relève de la dérive `CAT-COL1` du chapitre 02, qui la nomme. Les colonnes système ne portent pas de ligne de `field` (chapitre 02) et n'apparaissent donc jamais dans le détail ; elles sont lisibles dans l'en-tête et dans la ligne elle-même.

### 3.3 Pourquoi du JSONB ici, et sous quelle forme

Le cadrage interdit le JSONB fourre-tout **pour les données utilisateur** : pas d'EAV, des colonnes typées et nommées métier, parce que ces données doivent être interrogeables en SQL par un humain qui connaît le métier. L'historique est un autre espace : en ajout seul, hétérogène par nature, interrogé par identifiant — `record_id`, `field_id`, `actor_user_id` — et jamais par valeur métier, et il doit survivre à la disparition de la structure qui a produit la valeur. Un jeu de colonnes typées plus un discriminant produirait six colonnes dont cinq toujours nulles, sans gagner la moindre requête.

Le JSONB des valeurs est **scalaire, sans réserve** : une valeur, jamais un objet ni un tableau, ce que le `CHECK` du §3.2 garantit. Ce n'est pas un sac ; c'est un type somme dont le discriminant est `field_kind`. Aucun type de champ de la v1 ne produit de valeur composite. Une liste de choix multiple, envisagée au-delà de la v1, produirait un tableau : l'ajout de `'array'` au `CHECK` devra alors se faire en `ADD CONSTRAINT … NOT VALID` puis `VALIDATE CONSTRAINT` **partition par partition** (A11), faute de quoi 24 mois d'historique seraient réécrits sous verrou exclusif.

Trois propriétés achèvent de justifier le choix, et la troisième en marque la limite :

- PostgreSQL stocke les nombres JSONB en `numeric` : un `numeric(18,2)` traverse l'historique sans perte de précision ;
- le format distingue nativement la chaîne `"42"` du nombre `42` et du booléen `true`, ce que `text` ne ferait pas ;
- **JSON n'a pas de littéral pour les valeurs numériques spéciales.** Un `NaN` ou un `Infinity` est sérialisé en chaîne et `jsonb_typeof` bascule de `number` à `string`. Le chapitre 04 interdit ces valeurs au niveau du type ; la règle de lecture correspondante est posée ici : **`field_kind = 'number'` avec `jsonb_typeof = 'string'` signifie valeur spéciale**, affichée telle quelle et jamais convertie.

**`NULL` SQL et `null` JSON ne sont pas la même chose**, à la lecture comme à l'écriture : `before_value IS NULL` signifie « ce champ n'est pas concerné par cette opération » ; `before_value = 'null'::jsonb` signifie « ce champ valait `NULL` ». Toute lecture utilise `IS DISTINCT FROM`. À l'écriture, le piège est plus vicieux : `to_jsonb(ligne)->'colonne'` d'une colonne SQL `NULL` ne rend pas `NULL` SQL mais le jsonb `'null'`, si bien qu'un filtre `WHERE valeur IS NOT NULL` ne filtre rien. Le prédicat correct, celui que le drain emploie, est `jsonb_typeof(…) <> 'null'`.

### 3.4 Delta, pas instantané — sauf à la suppression

| Opération | Détail écrit par le drain |
|---|---|
| `insert` | Une ligne par champ **dont la valeur n'est pas `null`** : `before_value` à `NULL` SQL, `after_value` à la valeur. |
| `update` | Une ligne par champ dont la valeur a changé au sens `IS DISTINCT FROM`, uniquement. |
| `delete` | Une ligne par champ, **y compris les champs nuls et les champs supprimés logiquement dont la colonne existe encore** : `before_value` à la valeur, `after_value` à `NULL` SQL. |

L'écart de traitement est délibéré. Pour une modification, stocker la ligne entière multiplierait le volume par la largeur de la table sans rien apprendre. Pour une suppression, la ligne d'historique est **la seule copie restante** : elle doit être complète, sinon la restauration (§12.1) est impossible.

Reconstituer l'état d'un enregistrement à une date donnée se fait donc en rejouant les deltas depuis la création, ou en repartant de l'état courant et en remontant. C'est plus coûteux qu'un instantané, et c'est accepté : le besoin exprimé est « qui a changé quoi », pas la requête temporelle. Un retour en arrière sur un enregistrement se contente du dernier delta.

### 3.5 Immuabilité et réglage physique

**Immuabilité.** Un déclencheur `BEFORE UPDATE OR DELETE FOR EACH STATEMENT` nommé `tg_<table>__immutable`, posé sur chaque journal de `_basedb` et sur **chacune de ses partitions**, appelle `_basedb.assert_history_immutable()` et lève `HISTORY_IMMUTABLE`, sauf si `basedb.maintenance = 'on'` — variable que seules la tâche de purge et l'opération d'effacement ciblé positionnent (§10.6). Le test de `basedb.maintenance` est la première instruction de la fonction. C'est le déclencheur que le chapitre 02 inscrit dans sa liste close sous la ligne « immuabilité des journaux ».

Le niveau **instruction** est un choix, pas un raccourci : un déclencheur `FOR EACH ROW` ferait payer 10 000 invocations PL/pgSQL à chaque lot de purge, sur chacune des tables, pour vérifier une condition qui ne dépend pas de la ligne. Conséquence à connaître : **les déclencheurs d'instruction ne sont pas hérités par les partitions**, et une écriture visant directement une partition contournerait celui du parent. La tâche de création de partitions pose donc le même déclencheur sur chaque partition (§10.2), et la réconciliation vérifie sa présence sur chacune (`HIST-4`).

**Réglage physique**, appliqué à la création de chaque partition :

| Objet | Réglage | Raison |
|---|---|---|
| Partitions des journaux | `fillfactor = 100` | Tables en ajout seul, jamais mises à jour hors effacement ciblé : laisser de l'espace libre serait du gaspillage pur. |
| idem | `autovacuum_vacuum_scale_factor = 0`, `autovacuum_vacuum_threshold = 50000`, `autovacuum_vacuum_insert_threshold = 100000`, `autovacuum_analyze_scale_factor = 0`, `autovacuum_analyze_threshold = 20000` | Les seuils proportionnels par défaut sont calculés sur la taille de la table : sur une partition qui grossit, ils retardent indéfiniment le gel et les statistiques. |
| Partition en cours de purge ligne à ligne (§10.3) | `autovacuum_vacuum_threshold = 5000` le temps de l'opération | Une purge par lots produit des millions de tuples morts sur une partition encore lue. |
| `before_value`, `after_value`, et les colonnes `before` / `after` des tampons et de `change_event` | `SET COMPRESSION lz4` | Un champ « texte long » de plusieurs centaines de kilo-octets traverse le tampon à chaque écriture ; `lz4` décompresse trois à cinq fois plus vite que `pglz` pour un taux voisin. À défaut de `lz4` compilé dans l'instance, `pglz` s'applique et la volumétrie du §15 est majorée de 20 %. |

---

## 4. Cas particuliers de capture

### 4.1 Cascade, mise à `NULL` en chaîne, suppression multiple

**La distinction est portée par la profondeur de déclenchement, jamais par comparaison à une racine** (A14) :

```
is_cascade = (pg_trigger_depth() > 1)
```

Le critère « ce n'est pas la ligne racine » serait faux dès qu'une suppression porte sur plusieurs lignes en une instruction — sélection multiple dans la grille, `DELETE … WHERE statut = 'annulé'` depuis l'API, lot supprimé par le MCP : toutes les lignes sauf une seraient marquées comme cascadées et rattachées à une racine avec laquelle elles n'ont aucun rapport, et l'écran de restauration proposerait de rétablir une arborescence qui n'a jamais existé. `pg_trigger_depth()` expose directement l'information cherchée : à l'intérieur du déclencheur d'une instruction émise par une action référentielle, la profondeur vaut au moins 2.

Les lignes supprimées par un `ON DELETE CASCADE` **sont historisées**, avec le même auteur que la suppression d'origine — même transaction, mêmes variables de session — et au même niveau de détail que toute autre suppression : ligne complète, donc restaurables. Elles produisent aussi leurs événements sortants (§11), ce qui est la contrepartie de A14 : la cascade est exécutée par PostgreSQL, et la capture par déclencheur la voit.

Avec `is_cascade` et `op`, l'interface distingue les trois cas qui l'intéressent : suppression directe, suppression en chaîne (`op = 'delete'`, cascadée), déliaison en chaîne (`op = 'update'`, cascadée). Le regroupement d'affichage s'appuie sur `(occurred_at, xact_id)` : « Marc a supprimé 42 factures — 341 lignes supprimées en chaîne, 12 lignes déliées », dépliable. Aucun identifiant de racine n'est stocké : sur une suppression multiple il n'en existe pas, et sur une suppression unitaire la transaction suffit à le retrouver.

### 4.2 Valeur d'affichage : ligne et lien

Le drain résout deux valeurs d'affichage et les fige.

**Celle de l'enregistrement**, `record_revision.record_display`, est lue dans le JSON de tampon, à la clé du champ désigné par `table_def.display_field_id`. Elle n'existe donc que si la colonne d'affichage est une **colonne physique stockée** — colonne ordinaire ou colonne générée `STORED` —, ce que le chapitre 04 garantit en projetant ainsi tout champ éligible. Une valeur plus longue que 200 caractères est tronquée avec un caractère de continuation : c'est un libellé de liste, pas une copie du champ.

**Celle d'un lien**, `before_display` / `after_display`, est la valeur d'affichage de la ligne cible **au moment de la modification**. La redondance est réelle — quelques dizaines d'octets par changement de lien — et ce qu'elle achète est la seule chose qui compte pour un journal : rester lisible indéfiniment. Sans elle, une ligne se lit « Client : `0a3f…` → `9b21…` », et ce pour toujours ; pire, une résolution paresseuse à la lecture afficherait la valeur *actuelle* de la cible, c'est-à-dire un mensonge — « Client : ACME France » alors que la société s'appelait ACME SA le jour du changement.

La résolution suit trois rangs, dans cet ordre, parce que la source principale est indisponible précisément dans le cas qui motive la fonctionnalité — une cible supprimée en cascade n'existe plus quand le drain passe :

| Rang | Source | Quand elle sert |
|---|---|---|
| 1 | Jointure vers la table cible par clé primaire, ensembliste, sur la colonne d'affichage lue au catalogue | Cas nominal : la cible existe encore |
| 2 | Le lot de tampon en cours de drain, puis `record_revision.record_display` déjà consolidée pour le couple `(table_id, record_id)` | Cible supprimée dans la même transaction ou depuis, quelle qu'en soit l'origine — y compris une cascade lancée en SQL direct |
| 3 | Marqueur explicite « cible supprimée » | Aucun des deux précédents |

Le rang 2 est ce que la capture différée rend possible : au moment du drain, la suppression de la cible est validée et sa propre ligne de tampon est présente, alors qu'un déclencheur synchrone ne verrait ni l'une ni l'autre.

Corollaire assumé : **ces valeurs ne sont jamais rafraîchies.** Ce sont des témoins du passé, pas des caches. Renommer un client ne réécrit pas l'historique. L'interface rend une valeur absente comme une information manquante — « valeur d'affichage non conservée » — et jamais comme une chaîne vide. La même règle s'applique aux listes de choix : `before_value` porte la valeur stockée, `before_display` le libellé de l'option à cette date, les options étant renommables et supprimables.

### 4.3 Une table peut n'avoir aucune colonne d'affichage

`display_field_id` est nullable et l'absence de désignation est un état valide (A15) ; la suppression logique du champ désigné est refusée avec `DISPLAY_FIELD_IN_USE`, jamais compensée par une bascule silencieuse. La contrainte et la désignation relèvent du chapitre 02, les types éligibles du chapitre 04.

Conséquence pour ce chapitre : `record_display` vaut alors `NULL`, et l'interface affiche la clé primaire rendue en texte, préfixée de la mention « sans libellé ». C'est un défaut de paramétrage visible, pas une erreur : l'écran de paramétrage de la table propose de désigner une colonne d'affichage, et la métrique du §14 compte les tables qui n'en ont pas.

### 4.4 Instructions composites : `ON CONFLICT`, `MERGE`, `COPY`

| Instruction | Ce que PostgreSQL déclenche | Ce qui est capturé |
|---|---|---|
| `INSERT … ON CONFLICT DO UPDATE` | Le déclencheur d'instruction `INSERT` **et** celui de l'`UPDATE`, chacun avec la table de transition de sa propre part | Deux ensembles, `op = 'insert'` pour les lignes créées et `op = 'update'` pour les autres, regroupés par `(occurred_at, xact_id)` |
| `INSERT … ON CONFLICT DO NOTHING` | Le seul déclencheur `INSERT`, avec les seules lignes réellement insérées | Révisions `insert` ordinaires ; les lignes ignorées ne produisent rien, ce qui est correct : rien n'a changé |
| `MERGE` | Les déclencheurs des **trois** événements mentionnés dans la commande, **même si l'action correspondante n'a concerné aucune ligne** | La capture sort sur table de transition vide (§1.3) ; les ensembles non vides produisent leurs révisions |
| `COPY … FROM` | Le déclencheur d'instruction `INSERT`, une fois par commande | Révisions `insert`, soumises à la règle des lots de 10 000 lignes (§5) |

L'interface présente comme une seule opération les ensembles partageant la transaction, et comme une opération de masse ceux qui portent le même `bulk_id`.

### 4.5 Quand la capture échoue, et quand le drain échoue

Les deux cas n'ont ni la même gravité ni le même effet, et les confondre conduit à surdimensionner l'un et à ignorer l'autre.

**La capture est dans la transaction de la donnée : si elle échoue, l'écriture échoue.** Il n'existe pas de mode dégradé où la donnée passerait sans sa trace — ce serait le journal qui ment par omission, refusé au §1.1. Deux causes seulement subsistent, la colocalisation ayant supprimé les autres :

| Cause | Symptôme | Prévention | Code |
|---|---|---|---|
| Disque plein ou `temp_file_limit` atteint côté données | `could not extend file`, `temporary file size exceeds temp_file_limit` | Lots bornés côté noyau (§5), dimensionnement (§1.6), alerte à 80 % d'occupation | `HISTORY_UNAVAILABLE` |
| Erreur dans la fonction de capture | Erreur PL/pgSQL sur toute écriture de la table | Réconciliation (§13), déploiement contrôlé (§17) | `HISTORY_UNAVAILABLE` |

L'erreur remonte à l'utilisateur traduite par le noyau — jamais en erreur serveur brute —, avec la mention explicite que l'écriture n'a pas eu lieu, et déclenche une alerte de gravité maximale. Les lectures continuent d'être servies.

**Le drain, lui, peut échouer sans arrêter le produit.** Partition d'historique manquante, catalogue indisponible, migration de catalogue en cours : le drain s'arrête, le tampon s'accumule, les écritures continuent. L'incident se lit dans le retard du drain (`DRAIN_LAGGING`), la consultation d'historique affiche sa date de dernière consolidation, et la reprise est automatique puisque le drain est idempotent. La seule borne est le disque du côté données, ce qui laisse des heures — et non des secondes — pour intervenir.

---

## 5. Opérations en masse

### 5.1 Le garde-fou est en amont ; le déclencheur n'est qu'un filet tardif

Il faut dire honnêtement ce qu'un contrôle placé dans un déclencheur `AFTER` peut et ne peut pas. Quand il s'exécute, l'instruction a été **entièrement exécutée** : le WAL a été produit, les tuples morts créés, les verrous de ligne tenus, le tuplestore de transition matérialisé. **Un refus à ce stade ne protège que le volume d'historique ; il ne supprime ni le coût de l'instruction, ni le gonflement de la table, ni l'annulation coûteuse qui suit.**

La protection réelle est en amont, en trois couches :

1. **Le noyau compte avant d'écrire.** Toute opération de masse émise par le produit exécute un `SELECT count(*)` sur le même prédicat dans la même transaction, refuse avant émission si le total dépasse le plafond, puis **découpe obligatoirement l'écriture** : lots de clés primaires pour `UPDATE` et `DELETE`, lots de 10 000 lignes pour `COPY`. Aucune instruction de masse non bornée n'est jamais émise par le produit.
2. **Les délais de garde s'appliquent.** `statement_timeout` et `lock_timeout`, posés par le contrat de connexion du chapitre 01 §10.3, sont le seul garde-fou réellement actif contre une instruction non bornée venue d'un `psql`. Ils arrêtent le travail pendant qu'il se fait, ce qu'aucun déclencheur ne sait faire.
3. **Le déclencheur est le filet**, documenté comme tel : il attrape ce que le SQL direct a laissé passer, refuse tardivement et annule la transaction après travail.

**Plafond dur : `history.bulk_hard_cap`, 100 000 lignes de tampon par transaction, cumulées.** Le compteur `basedb.rows_written` est maintenu par la capture elle-même, par `set_config(…, true)`, donc transaction-local et annulé au `ROLLBACK`. Le cumul est indispensable : une cascade produit une instruction par ligne parente (§1.6), et 200 instructions de 400 lignes échapperaient à tout seuil évalué par instruction. Au-delà, `BULK_OPERATION_REFUSED`, avec le nombre de lignes déjà capturées et l'invitation à découper.

Les seuils de réécriture de table du chapitre 04 sont distincts de ceux-ci et ne les remplacent pas : ils bornent le DDL et la durée de verrouillage, ce chapitre borne le volume d'historique. Les deux s'appliquent à une même opération.

### 5.2 Ce qui est écrit au-dessus du seuil

`history.bulk_threshold` vaut **500 lignes cumulées par transaction** par défaut.

| Opération | Au-dessus du seuil | Pourquoi |
|---|---|---|
| `insert` | **Aucune révision par ligne** si la politique de l'opération déclarée le dit (§5.3). Une ligne de `bulk_operation` : nombre de lignes, champs alimentés, échantillon de 50 identifiants, auteur, durée. | Une création ne détruit aucune information : les données insérées *sont* leur propre trace. Un import de 100 000 lignes produirait 100 000 en-têtes et environ 1,2 million de lignes de détail pour redire ce que la table contient déjà. |
| `update` | **Révisions par ligne, toujours.** Plus une ligne de `bulk_operation` qui les regroupe. | Une modification détruit la valeur d'avant. Ne pas l'écrire, c'est la perdre. |
| `delete` | **Révisions par ligne, toujours**, avec la ligne complète. Plus une ligne de `bulk_operation`. | Idem, en plus irréversible. |

**La décision est prise par le drain, pas par la capture.** La capture écrit toujours dans le tampon — elle n'a ni la politique de l'opération, ni le droit de lire le catalogue. Le drain lit la ligne de `bulk_operation` désignée par `bulk_id`, applique sa politique, et supprime les lignes de tampon non retenues avec les autres. C'est le seul endroit où la règle est évaluée, donc le seul endroit où elle peut être fausse.

### 5.3 La décision porte sur l'opération déclarée, pas sur l'instruction

Un seuil évalué par instruction ne garantit rien : un importateur qui insère par lots de 500 — c'est-à-dire le comportement normal d'un client HTTP, et exactement ce que le message de refus recommande — passe systématiquement sous le seuil et produit les 1,2 million de lignes de détail que l'on voulait éviter. Le comportement du système dépendrait alors de la taille de lot choisie par un client, pas de la nature de l'opération.

**Quand `basedb.bulk_id` est posée, c'est la ligne de `bulk_operation` qui décide**, quel que soit le nombre de lignes de chaque instruction.

```sql
CREATE TABLE _basedb.bulk_operation (
  id uuid PRIMARY KEY,                  -- pose par le noyau avant la premiere instruction
  base_id  uuid NOT NULL,
  table_id uuid NOT NULL,
  op     text NOT NULL CHECK (op IN ('insert','update','delete')),
  source text NOT NULL CHECK (source IN ('import','ui','rest','mcp','sql','system')),
  label text NULL,
  filter_description text NULL,
  expected_row_count bigint NULL,
  row_count bigint NOT NULL DEFAULT 0,
  field_ids uuid[] NOT NULL DEFAULT '{}',
  sample_record_ids uuid[] NOT NULL DEFAULT '{}',
  detail_written text NOT NULL CHECK (detail_written IN ('full','none','partial')),
  actor_kind text NOT NULL, actor_user_id uuid NULL, actor_token_id uuid NULL,
  started_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz NULL,
  xact_id xid8 NULL
);
CREATE INDEX idx_bulk_operation_open ON _basedb.bulk_operation (started_at)
  WHERE finished_at IS NULL;
```

1. L'application **crée la ligne avant la première instruction**, avec `expected_row_count`, `source`, `label`, `filter_description` et `detail_written` (`full` ou `none` ; `none` n'est accepté que pour `op = 'insert'`), puis pose `basedb.bulk_id`.
2. Le drain incrémente `row_count` à chaque lot consolidé, par `UPDATE … SET row_count = row_count + $1` : l'opération est idempotente par lot puisque le lot n'est marqué drainé qu'après.
3. `detail_written` passe à `partial` quand le seuil a été franchi en cours d'opération et que les premières instructions ont écrit leur détail.
4. **`finished_at` est écrit par l'application** pour une opération déclarée. Pour une opération **détectée** — plus de `history.bulk_threshold` lignes de tampon partageant `(table_id, xact_id)` sans `bulk_id` —, la ligne est créée par le drain avec `source = 'sql'`, `detail_written = 'full'`, `label` nul et `finished_at = started_at`.

**Aucune clé étrangère vers le catalogue** (§7.1). `base_id` et `table_id` sont des clés de catalogue nues ; le libellé d'une table purgée est restitué par sa pierre tombale de `structure_revision`, comme partout ailleurs dans ce chapitre.

`detail_written = 'none'` est le marqueur honnête d'un historique volontairement absent : l'interface affiche « import de 100 000 lignes le 12 mars par Marc — détail non conservé », plutôt qu'un silence.

### 5.4 Le coût annoncé à l'utilisateur

L'interface **annonce le coût avant confirmation**, et l'annonce doit être juste : une estimation fausse par défaut est pire qu'une absence d'estimation, parce qu'elle est crue.

```
transitoire (tampon) ≈ lignes × (2 × taille moyenne de la ligne en JSON + 150 o)
durable              ≈ lignes × (en-tête 300 o + index 200 o)
                     + lignes × champs_modifiés × (détail 190 o + index 100 o)
                     + lignes × (2 × taille JSON + 150 o)   [si la table est abonnée]
WAL induit           ≈ 1,5 à 3 × (transitoire + durable)
```

Appliqué à l'exemple canonique — 42 300 lignes, un champ modifié, ligne moyenne de 600 octets en JSON, au moins un abonné :

| Poste | Volume |
|---|---|
| Tampon, le temps du drain | ≈ 57 Mo |
| En-têtes | ≈ 21 Mo |
| Détails | ≈ 12 Mo |
| `change_event` | ≈ 57 Mo |
| **Total durable** | **≈ 90 Mo** (≈ 33 Mo sans abonné) |
| WAL induit | 220 à 440 Mo |

L'écran affiche donc : « cette mise à jour concerne 42 300 lignes et produira environ 90 Mo d'historique et d'événements, plus 220 à 440 Mo de journal de transactions. » C'est le prix d'une opération réversible, et l'utilisateur doit le voir. Les constantes sont mesurées sur le jeu de référence du §15 et révisées à chaque campagne de volumétrie.

---

## 6. Journal de suppression des enregistrements

C'est la source, et la seule, du chemin de reprise après panne d'un consommateur exposé par le chapitre 08 sous la forme `GET /data/{base}/{table}/deleted?since=`. Il est défini ici parce que la suppression n'est connue que de la capture, et il est **distinct de `record_revision`** pour trois raisons qui ne se ramènent pas l'une à l'autre : sa clé de pagination est `(deleted_at, record_id)` et non `(occurred_at, id)` ; sa rétention est celle d'un chemin de reprise, pas celle d'un journal d'enquête ; et il doit rester consultable à coût constant par un consommateur qui interroge toutes les minutes, sans traverser un journal cent fois plus volumineux.

```sql
CREATE TABLE _basedb.record_deletion (
  base_id     uuid NOT NULL,
  table_id    uuid NOT NULL,
  record_id   uuid NOT NULL,
  deleted_at  timestamptz NOT NULL,        -- occurred_at de la revision correspondante
  deleted_by  uuid NULL,                   -- NULL si SQL direct ou auteur inconnu
  actor_kind  text NOT NULL,
  is_cascade  boolean NOT NULL DEFAULT false,
  revision_id uuid NOT NULL,               -- cle nue vers record_revision (§7.1)
  PRIMARY KEY (table_id, deleted_at, record_id)
) PARTITION BY RANGE (deleted_at);
```

**La clé primaire est l'index de lecture**, dans l'ordre exact de la route : filtre sur `table_id`, borne basse sur `deleted_at`, départage par `record_id`. Un consommateur qui reprend depuis un curseur `(deleted_at, record_id)` exécute un parcours d'index en avant, sur les seules partitions couvrant sa fenêtre. Aucun autre index n'est créé : ce journal n'a qu'une requête.

La vue de lecture donne la charge utile attendue par le chapitre 08, qui n'en définit que l'exposition HTTP :

```sql
CREATE VIEW _basedb.v_record_deletion AS
SELECT d.base_id, d.table_id,
       d.record_id  AS "_id",
       d.deleted_at,
       d.deleted_by,
       CASE WHEN d.is_cascade THEN 'cascade' ELSE 'direct' END AS cause
FROM   _basedb.record_deletion d;

CREATE VIEW _basedb.v_record_deletion_horizon AS
SELECT greatest(
         (SELECT (value)::timestamptz FROM _basedb.setting
           WHERE key = 'history.deletion_journal_since'),
         clock_timestamp()
           - (SELECT current_interval FROM _basedb.retention_policy
               WHERE object = 'webhook_delivery')) AS horizon;
```

**`horizon` est l'instant le plus ancien réellement couvert**, et il est calculé, jamais supposé : c'est le plus récent de deux instants — la date de mise en service du journal sur cette instance, et la borne de rétention. Un `since` antérieur signifie que le consommateur est au-delà du point de non-retour, et le chapitre 08 le lui dit explicitement plutôt que de lui renvoyer une page vide qu'il interpréterait comme « rien n'a été supprimé ».

**Rétention : 90 jours** (A24), la même que les livraisons de webhooks dont ce journal est le filet. Elle est celle de l'objet `webhook_delivery` de `_basedb.retention_policy` — aucun objet de rétention propre n'est créé —, purgée par détachement de partition comme les autres journaux (§10.3). Elle est délibérément plus longue que les 7 jours de `change_event` — un consommateur arrêté une semaine a perdu ses événements, il n'a pas perdu la liste de ce qui a disparu — et plus courte que les 24 mois de `record_revision`, qui répond à une autre question.

**Alimentation.** Le drain écrit une ligne par révision `op = 'delete'`, dans la même transaction que l'en-tête, en `ON CONFLICT DO NOTHING`. Aucune ligne n'est écrite pour une table purgée après coup : le journal survit à la table, comme le reste de l'historique.

---

## 7. Effet des changements de structure sur l'historique

### 7.1 Le principe, et la règle qui en découle

**L'historique n'est indexé que par des clés de catalogue, jamais par des noms.** C'est la décision qui rend tout le reste possible : un renommage physique, une relégation, un alias de compatibilité n'ont aucun effet sur le journal.

Elle a une conséquence impérative : **aucune table de journal ne porte de contrainte référentielle vers le catalogue.** Ni `record_revision`, ni `record_revision_field`, ni `record_deletion`, ni `bulk_operation`, ni `structure_revision`, ni `migration_execution`. Une seule clé `ON DELETE RESTRICT` suffirait à rendre impossible la purge d'une table ou d'une base pendant toute la rétention du journal ; une clé `ON DELETE CASCADE` détruirait le journal avec l'objet qu'il documente, ce qui est exactement ce qu'on cherche à éviter. La cohérence est garantie par le point d'écriture unique — le drain —, pas par une contrainte.

Les trois petites tables d'exploitation de ce chapitre — `capture_gap` (§13), `history_archive` (§10.5) et `erasure_request` (§10.6) — ne sont pas des journaux de données : elles suivent la règle générale du chapitre 02 et référencent `app_user` sur leurs colonnes d'auteur.

### 7.2 Table des effets

| Changement | Effet sur l'historique |
|---|---|
| Libellé d'un champ modifié | Aucun. Le libellé n'est pas stocké ; il est résolu à la lecture depuis le catalogue. Les lignes anciennes s'affichent avec le libellé actuel, ce qui est le comportement attendu. |
| … et on veut savoir comment il s'appelait | `structure_revision` (§8.1) contient la ligne de catalogue avant et après chaque changement. L'interface propose « libellé à cette date » au survol. |
| Champ supprimé logiquement | Aucun effet. La ligne de catalogue subsiste avec sa date de suppression ; l'interface marque le champ « supprimé le … ». |
| Champ supprimé puis recréé sous le même libellé | Deux clés de catalogue distinctes, donc deux historiques distincts, présentés comme deux champs. Les valeurs d'avant la suppression n'ont aucune continuité avec celles d'après. |
| Champ purgé | La ligne de catalogue devient une pierre tombale (A22), puis disparaît à l'épuration. L'historique reste interprétable grâce à `field_kind` porté par chaque ligne de détail, et à la dernière ligne de `structure_revision` pour cette clé, qui contient la ligne de catalogue complète telle qu'elle était juste avant la purge. **`structure_revision` tient lieu de pierre tombale de dernier recours** ; aucune table séparée n'est nécessaire. |
| Table purgée | Les journaux conservent la trace, sans référence au catalogue (§7.1). Le libellé vient de la pierre tombale. |
| Type d'un champ modifié | Impossible directement : le type est immuable. L'opération est « créer, recopier, supprimer », et la migration écrit deux lignes de `structure_revision` liées par `replaced_by_object_id`. L'historique de l'ancien champ conserve ses valeurs dans l'ancien type, correctement rendues grâce à `field_kind` ; la vue détail propose « historique du champ précédent ». |
| Table ou champ renommé physiquement | Aucun effet : rien dans l'historique ne porte de nom physique (A5). |
| Champ ajouté ou supprimé | Aucun effet sur les déclencheurs, dont les arguments sont immuables (§1.2). Le drain apparie les colonnes au catalogue relu, donc une colonne nouvelle est historisée dès la première écriture qui la touche. |

Deux conditions font tenir l'ensemble et sont tenues par d'autres chapitres :

1. La purge d'un champ ou d'une table **écrit sa ligne de `structure_revision` dans la même transaction** que la mise à jour de la ligne de catalogue (chapitre 06).
2. La rétention des structures est **toujours supérieure ou égale** à celle des données (§10.4). Purger l'historique des structures avant celui des données rendrait ce dernier ininterprétable.

---

## 8. Historique des structures

`_basedb.migration` (chapitre 02) porte la migration : ses énoncés, son statut, son planificateur, son bail, ses tentatives et son diagnostic PostgreSQL complet en cas d'échec (A12). Deux compléments relèvent de ce chapitre, et aucun ne redouble une colonne de `migration`.

### 8.1 `_basedb.structure_revision` — ce qui a changé, objet par objet

```sql
CREATE TABLE _basedb.structure_revision (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  migration_id uuid NULL,              -- cle de catalogue nue, sans FK (§7.1)
  base_id uuid NOT NULL,
  object_kind text NOT NULL CHECK (object_kind IN
    ('base','db_schema','table_def','field','select_option','table_constraint',
     'table_index','application','view_def','role','permission')),
  object_id uuid NOT NULL,
  parent_object_id uuid NULL,
  op text NOT NULL CHECK (op IN
    ('create','update','soft_delete','restore','purge','rename_physical','replace')),
  before_row jsonb NULL,               -- ligne de catalogue avant
  after_row  jsonb NULL,               -- ligne de catalogue apres
  replaced_by_object_id uuid NULL,
  name_id uuid NULL,                   -- ligne de registre en vigueur, cle nue
  requested_by uuid NULL, approved_by uuid NULL, approved_at timestamptz NULL,
  actor_kind text NOT NULL, actor_user_id uuid NULL, actor_token_id uuid NULL
);
CREATE INDEX idx_structure_revision_object    ON _basedb.structure_revision
  (object_kind, object_id, occurred_at DESC);
CREATE INDEX idx_structure_revision_migration ON _basedb.structure_revision (migration_id);
CREATE INDEX idx_structure_revision_base      ON _basedb.structure_revision
  (base_id, occurred_at DESC);
```

`before_row` et `after_row` sont des images JSONB de la ligne de catalogue. Le JSONB est ici pleinement justifié : la forme du catalogue **change avec les versions de l'application**, et une image typée serait fausse dès la migration de catalogue suivante. C'est la seule représentation qui reste fidèle à ce qui existait. `name_id` désigne la ligne de registre en vigueur au moment de l'acte ; le nom lui-même n'est jamais recopié (A5), et il reste résolvable indéfiniment puisqu'aucune ligne de registre n'est jamais détruite.

`requested_by` et `approved_by` sont distincts, et c'est le point qui compte pour le MCP : celui-ci **propose** une migration sans jamais l'appliquer, donc `requested_by` est l'agent et `approved_by` l'humain qui a validé. Quand la demande et l'application viennent de la même personne dans l'interface, les deux colonnes portent la même valeur — ce qui doit rester visible plutôt qu'être élidé.

*Décision révisée* : la capture devait être **applicative**, « en un point unique ». Elle est faite **par déclencheur** sur les tables de catalogue — `base`, `table_def`, `field`, ses satellites de configuration, `select_option`, `table_constraint`, `table_index` —, par `_basedb.capture_structure_v1()`, dans la transaction de l'écriture. Les écritures de structure passent en réalité par une vingtaine d'opérations du noyau, et un oubli dans l'une d'elles serait un trou silencieux ; un déclencheur ne peut pas en oublier, et il attribue à `sql_direct` l'écriture faite à la main en psql au lieu de l'ignorer. `migration_id` n'est pas perdu : le moteur de migration le pose en variable de session (`basedb.migration_id`) pendant chaque étape, comme l'auteur. Deux compléments au schéma ci-dessus : `catalog_table`, la table de catalogue dont la ligne est l'image — un satellite ne se reconnaît qu'à elle —, et la valeur `field_config` d'`object_kind`, dont l'`object_id` est le champ. Une mise à jour qui ne touche que des colonnes d'exploitation — compteurs de version, baux, états physiques, avancement d'un calcul d'IA — n'écrit rien. Le journal est immuable comme les autres (`HISTORY_IMMUTABLE`), et c'est lui que la comparaison des environnements lit (chapitre 14 §3.4).

### 8.2 `_basedb.migration_execution` — ce qui s'est réellement passé

Une ligne **par tentative d'exécution**, car une migration peut échouer, être corrigée puis rejouée, et un statut unique sur `migration` ne raconte pas cette histoire.

```sql
CREATE TABLE _basedb.migration_execution (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  migration_id uuid NOT NULL,          -- cle de catalogue nue, sans FK (§7.1)
  base_id uuid NOT NULL,
  attempt smallint NOT NULL,           -- valeur de migration.attempts au demarrage
  step smallint NOT NULL,              -- etape du plan (A11)
  direction text NOT NULL CHECK (direction IN ('up','down')),
  applied_sql text NOT NULL,           -- le DDL REELLEMENT execute a cette etape
  applied_checksum bytea NOT NULL,
  started_at timestamptz NOT NULL, finished_at timestamptz NULL,
  duration_ms integer NULL,
  lock_wait_ms integer NULL,
  lock_attempts smallint NOT NULL DEFAULT 1,
  outcome text NOT NULL CHECK (outcome IN ('applying','applied','failed','interrupted')),
  error_code text COLLATE "C" NULL,
  server_version text NOT NULL, app_release text NOT NULL,
  app_instance text NOT NULL, backend_pid integer NOT NULL,
  actor_kind text NOT NULL, actor_user_id uuid NULL, actor_token_id uuid NULL,
  CONSTRAINT uq_migration_execution UNIQUE (migration_id, direction, attempt, step)
);
```

Le vocabulaire d'`outcome` est celui de A12, restreint à ce qu'une tentative peut valoir : il n'en introduit aucun autre. Le diagnostic PostgreSQL détaillé — `pg_sqlstate`, `pg_message`, `pg_detail`, `pg_hint`, `pg_constraint_name`, énoncé fautif — vit sur `_basedb.migration` et n'est pas recopié ici ; `error_code` ne porte que le code du registre unique.

`applied_sql` est distinct des énoncés de `migration.up_sql` : c'est le texte effectivement soumis au serveur à cette étape, qui peut différer si la migration a été régénérée depuis le catalogue entre la proposition et l'application. C'est ce texte, et lui seul, qui a valeur de trace.

**Deux règles sans lesquelles le témoin ne vaut rien.**

*La trace s'écrit sur une connexion distincte.* Une trace écrite dans la transaction de l'étape disparaît avec elle en cas d'échec, c'est-à-dire exactement dans le cas où elle sert. Le moteur ouvre donc, pour la durée de l'étape, une seconde connexion du pool `catalogue` : `outcome = 'applying'` avant, mise à jour après. L'absence de clé étrangère (§7.1) supprime la cause matérielle d'une attente entre les deux connexions.

*`lock_wait_ms` se mesure, il ne se déduit pas.* La colonne ne se remplit pas toute seule ; sans protocole écrit, elle reste nulle ou ment. L'étape prend donc le verrou par un `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` **en instruction isolée, chronométrée seule** : c'est cette mesure, et elle seule, qui donne `lock_wait_ms`. Une demande de verrou exclusif en attente bloque toutes les requêtes suivantes sur la table, y compris les lectures : une seule transaction longue en lecture suffit à figer la table pour tout le monde, et `lock_timeout` est ce qui borne ce dommage. En cas d'échec d'acquisition, `outcome = 'failed'`, `error_code = 'LOCK_UNAVAILABLE'` (chapitre 01), `lock_attempts` incrémenté : l'échec sur verrou est un résultat normal, enregistré, non une panne. La valeur du délai, la temporisation entre tentatives et la reprise appartiennent au chapitre 03.

**L'unicité de l'applicateur n'est pas garantie ici.** Elle l'est déclarativement par `uq_migration_running` et le bail `lease_until` de `_basedb.migration` (chapitre 02, I23), et la sérialisation des étapes par le verrou de classe `structure_step`. Ce chapitre n'ajoute ni verrou consultatif propre, ni balayage de reprise : une tentative dont le bail a expiré est portée en `interrupted` par le chapitre 03, et `app_instance` et `backend_pid` permettent de corroborer par `pg_stat_activity`.

### 8.3 Ordre de purge des journaux de structure

Les lignes de `_basedb.migration` **ne sont jamais purgées** : elles portent la rejouabilité et l'historique des structures (chapitre 02). Seuls leur échantillon d'erreur et les deux tables de ce chapitre expirent, dans cet ordre, en une transaction par lot :

1. `migration_execution` — les tentatives d'abord ;
2. `structure_revision` — les révisions de structure ensuite.

Les deux suivent la rétention `structure_revision` (60 mois, A24) calculée sur leur propre `occurred_at` / `started_at`. Une tentative sans révision de structure reste lisible — elle porte son `applied_sql` et sa migration —, l'ordre inverse produirait l'inverse.

---

## 9. Consultation

### 9.1 Requêtes, index et élagage de partitions

| Consultation | Filtre | Index |
|---|---|---|
| Historique d'un enregistrement | `table_id`, `record_id`, fenêtre | `idx_revision_record` |
| Historique d'un champ | `field_id`, fenêtre | `idx_revision_field`, puis jointure sur l'en-tête par `(revision_id, occurred_at)` |
| Activité d'un auteur | `actor_user_id`, fenêtre | `idx_revision_actor` |
| Activité d'une base sur une période | `base_id`, fenêtre | `idx_revision_base` |
| Regroupement d'une transaction | `(occurred_at, xact_id)` | `idx_revision_xact` |
| Contenu d'une opération de masse | `bulk_id` | `idx_revision_bulk` |
| Reprise d'un consommateur | `table_id`, `deleted_at` | clé primaire de `record_deletion` (§6) |
| Historique d'un objet de schéma | `object_kind`, `object_id` | `idx_structure_revision_object` |

La requête canonique, paginée par curseur :

```sql
WITH page AS (
  SELECT r.*
  FROM   _basedb.record_revision r
  WHERE  r.table_id = $1 AND r.record_id = $2
    AND  r.occurred_at >= $3                      -- plancher de fenetre, obligatoire
    AND  r.occurred_at <= $4                      -- plafond, redondant et indispensable
    AND  (r.occurred_at, r.id) < ($4, $5)         -- curseur
  ORDER BY r.occurred_at DESC, r.id DESC
  LIMIT 50
)
SELECT p.id, p.occurred_at, p.op, p.is_cascade, p.actor_kind, p.actor_user_id,
       p.record_display, f.field_id, f.field_kind,
       f.before_value, f.after_value, f.before_display, f.after_display
FROM   page p
LEFT JOIN _basedb.record_revision_field f
       ON f.revision_id = p.id AND f.occurred_at = p.occurred_at
      AND f.field_id = ANY($6)                    -- champs lisibles par l'appelant
ORDER BY p.occurred_at DESC, p.id DESC, f.field_id;
```

Quatre points sur cette requête, dont deux conditionnent les performances de l'écran le plus consulté du produit :

1. **Le `LIMIT` porte sur les révisions, pas sur les lignes de détail.** Sans la sous-requête, une révision touchant 30 champs consommerait la moitié de la page.
2. **Le plafond `r.occurred_at <= $4` est écrit en plus du comparateur de ligne, et ce n'est pas une redondance inutile.** Le planificateur ne déduit aucune contrainte sur `occurred_at` seul d'un comparateur de ligne : sans ce prédicat scalaire, chaque page sonderait toutes les partitions postérieures.
3. **Le plancher `$3` est obligatoire, et sa valeur par défaut n'est pas la période de rétention.** Le fixer à 24 mois laisserait 24 partitions dans le plan, c'est-à-dire le cas dégradé qu'on cherche à éviter. La stratégie retenue est la **pagination descendante mois par mois** : la première page interroge la partition du mois courant ; si elle n'est pas pleine, l'API élargit la fenêtre d'un mois et recommence, jusqu'à remplir la page ou atteindre la borne de rétention. Le paramètre `since` **réduit** cette exploration, il ne l'élargit pas. Le coût d'un écran d'historique tombe ainsi de 24 parcours d'index à un ou deux.
4. **La même règle s'applique à la consultation « historique d'un champ »**, qui n'a pas de filtre sélectif autre que `field_id` et balaierait sinon toute la rétention.

La requête joint enfin `_basedb.capture_gap` sur `(base_id, table_id)` et l'intervalle de la page, pour que l'interface insère ses bandeaux de discontinuité (§13.2). La pagination par curseur `(occurred_at, id)` reprend la convention du chapitre 08 ; le couple est un ordre total.

### 9.2 Permissions

Les lectures d'historique passent par le point d'application unique du chapitre 05, avec le même prédicat de lignes constamment vrai que les lectures de données (A20). Trois règles propres :

1. **Lire l'historique d'un enregistrement exige `read` sur sa table.** Aucune action distincte n'est introduite : un utilisateur qui peut lire la ligne peut savoir qui l'a modifiée, l'information étant déjà dans `_updated_by`, lisible de droit (A18).
2. **Le détail par champ est filtré.** Les lignes de `record_revision_field` dont le `field_id` est masqué pour le rôle du lecteur ne sont pas retournées — c'est le paramètre `$6` ci-dessus. Un champ en lecture seule est visible dans l'historique ; un champ en écriture aussi.
3. **Une révision `update` dont tous les champs modifiés sont masqués est retirée du résultat**, en-tête compris. La retourner vide révélerait qu'un champ interdit a changé, et quand — un canal d'inférence sur un salaire ou un statut. Les révisions `insert` et `delete` restent toujours visibles : la création et la suppression d'une ligne sont des faits de ligne, pas de champ ; seul leur détail est filtré. **Conséquence pour l'API : une page peut contenir moins d'éléments que la limite demandée sans que ce soit la fin du flux ; c'est le curseur, et non le nombre d'éléments, qui indique la fin.**

Deux cas particuliers : l'historique d'un **champ purgé** n'a plus de ligne de permission et n'est visible qu'avec le droit de gestion du schéma ; et `applied_sql` n'est visible qu'avec ce même droit, parce qu'il peut contenir des expressions par défaut ou des contraintes révélant des champs masqués. Le reste de l'historique des structures — quel objet, quand, par qui — est visible avec `read` sur la portée.

---

## 10. Partitionnement, rétention, purge, archivage

### 10.1 Partitionnement mensuel

**Partitionnement par plage mensuelle**, sur `occurred_at` pour `record_revision` et `record_revision_field`, sur `deleted_at` pour `record_deletion`. Le mois est le bon grain : 24 partitions pour la rétention par défaut, ce qui reste sous le seuil où la planification souffre du nombre de partitions, tout en donnant une granularité de purge acceptable. `_basedb.change_event` suit le même régime, fixé par le chapitre 02.

*Alternative écartée* : partitionner par `base_id`. Cela servirait la suppression d'une base mais pas la rétention, qui est le mécanisme de croissance dominant, et produirait autant de partitions que de bases.

Conformément au régime du chapitre 02, une partition `DEFAULT` existe comme **filet, jamais comme mode de fonctionnement** : la tâche de maintenance vérifie à chaque passage qu'elle est vide et alerte sinon. Une ligne qui y tombe signifie que le drain a consolidé un enregistrement dont le mois n'avait pas de partition — un incident de maintenance, pas une perte de donnée, puisque le tampon a retenu la ligne jusque-là. Deux conséquences techniques doivent être connues plutôt que rencontrées : `DETACH PARTITION … CONCURRENTLY` n'est pas utilisable tant qu'une partition par défaut existe, et attacher une partition alors que la partition par défaut est non vide impose un parcours de celle-ci sous `ACCESS EXCLUSIVE`. La purge emploie donc le détachement ordinaire (§10.3), et la partition par défaut est maintenue vide.

### 10.2 La tâche de maintenance des partitions

Elle s'exécute **toutes les heures**, sous le verrou consultatif de classe `maintenance` (chapitre 02), en dehors de toute transaction englobante, et fait trois choses.

**Création, trois mois à l'avance.** La partition est créée en deux temps, ce qui évite le verrou fort sur le parent :

```sql
SET lock_timeout = '2s';
CREATE TABLE _basedb.record_revision_2026_12 (LIKE _basedb.record_revision INCLUDING ALL);
ALTER TABLE _basedb.record_revision_2026_12
  ADD CONSTRAINT ck_bounds CHECK (occurred_at >= '2026-12-01Z' AND occurred_at < '2027-01-01Z');
ALTER TABLE _basedb.record_revision
  ATTACH PARTITION _basedb.record_revision_2026_12
  FOR VALUES FROM ('2026-12-01Z') TO ('2027-01-01Z');
```

`ATTACH PARTITION` ne prend qu'un `SHARE UPDATE EXCLUSIVE` sur la table parente, compatible avec le drain en cours, et la contrainte `CHECK` posée d'avance sur une table vide dispense du parcours de validation. Un `CREATE TABLE … PARTITION OF` direct prendrait un `ACCESS EXCLUSIVE` sur le parent : la demande se mettrait en file derrière la plus longue transaction en cours et **bloquerait à son tour toutes les consolidations suivantes**, les demandes de verrou ne se doublant pas.

La tâche pose ensuite sur la nouvelle partition le déclencheur d'immuabilité et les paramètres de stockage (§3.5), puis enregistre le nom de la partition au registre des noms physiques.

**Protocole d'exécution** : `lock_timeout = '2s'`, reprise avec temporisation exponentielle, journalisation de chaque échec d'acquisition, et **report des opérations lourdes si une ligne de `bulk_operation` est ouverte** — sauf la création de partition, trop critique pour être reportée et retentée à chaque passage.

**Sonde, et non alerte a posteriori** : à chaque passage, la tâche vérifie que les partitions des mois M+1 et M+2 existent pour tous les journaux partitionnés. Si l'une manque et ne peut être créée, `HISTORY_PARTITION_MISSING` est levé en gravité élevée — c'est une panne imminente du drain, et non plus des écritures utilisateur (§4.5), ce qui laisse le temps d'intervenir sans interrompre le service.

### 10.3 Purge

**Le mode nominal est le détachement de partition entière.** Il est à coût constant, il ne produit aucun tuple mort et il ne touche pas aux partitions vivantes.

```
ALTER TABLE _basedb.record_revision DETACH PARTITION _basedb.record_revision_2024_03;
DROP TABLE _basedb.record_revision_2024_03;
```

Le détachement prend brièvement un `ACCESS EXCLUSIVE` sur le parent et attend les transactions en cours ; la tâche **suspend le drain de la base concernée** pour la durée de l'opération — quelques dizaines de millisecondes —, sous `lock_timeout` et avec reprise programmée plutôt qu'attente indéfinie. Le drain reprend ensuite sans perte, le tampon ayant continué de recevoir.

**La purge ligne à ligne est l'exception**, réservée au cas d'un tenant ayant demandé une rétention plus courte que celle de l'instance. Elle est alors soumise à trois règles impératives :

1. **Une transaction par lot, et l'ordre est fixé** : sélection des identifiants de révisions du lot (10 000 au maximum), **suppression des lignes de détail par jointure sur `(revision_id, occurred_at)`, puis suppression des en-têtes**. L'ordre inverse laisse des lignes de détail que plus rien ne rattache à une base — orphelines définitives, invisibles à la purge par détachement, et faussant toute mesure de volumétrie.
2. **`basedb.maintenance = 'on'`** pour la durée du lot, sans quoi le déclencheur d'immuabilité refuse (§3.5).
3. **Réglage autovacuum renforcé** sur les partitions concernées le temps de l'opération (§3.5).

La réconciliation détecte les orphelins éventuels (`HIST-5`), et leur suppression est une opération d'administration explicite, jamais automatique.

### 10.4 Rétentions et invariant

Les durées sont celles de A24 et vivent dans `_basedb.retention_policy` (chapitre 02) ; aucun paramètre concurrent n'existe dans ce chapitre.

| Objet de `retention_policy` | Défaut | Portée dans ce chapitre |
|---|---|---|
| `record_revision` | **24 mois** | `record_revision`, `record_revision_field`, `bulk_operation` |
| `webhook_delivery` | **90 jours** | `record_deletion` (§6), aligné sur les livraisons de webhooks dont ce journal est le filet |
| `structure_revision` | **60 mois** | `structure_revision`, `migration_execution` (§8.3) |
| `change_event` | **7 jours** | `_basedb.change_event`, purgé quel que soit l'état de consommation |

Un tenant peut demander une rétention **plus courte** que celle de l'instance ; elle est appliquée par la purge ligne à ligne du §10.3. Une rétention **plus longue** est refusée : elle serait incompatible avec la suppression de partitions entières, seul mécanisme de purge à coût constant.

**Invariant : la rétention des structures est supérieure ou égale à celle des données.** Purger l'historique des structures avant celui des données rendrait ce dernier ininterprétable (§7.2). L'invariant est porté par une contrainte sur `retention_policy` et **doublé d'un contrôle applicatif** exécuté par la tâche de rétention avant chaque passage, qui refuse de s'exécuter et lève `RETENTION_INCONSISTENT`. Le contrôle applicatif est ce qui restera disponible le jour où le catalogue sera physiquement séparé des données.

### 10.5 Archivage : une machine à états, pas une séquence

Si `history.archive_enabled` est actif, chaque partition est exportée avant d'être supprimée. La séquence « archiver → vérifier → détacher → supprimer » n'est pas une suite d'instructions mais **une machine à états reprenable**, parce qu'un incident entre deux étapes est la situation normale d'une tâche qui tourne toutes les nuits pendant des années : sans état, une reprise produit soit un doublon d'archive, soit une partition supprimée dont on ne sait plus si elle a été exportée.

```sql
CREATE TABLE _basedb.history_archive (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  partition_name_id uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  table_name_id     uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,
  range_from timestamptz NOT NULL, range_to timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN
    ('started','exported','verified','detach_requested','detached','dropped','failed')),
  row_count bigint NULL, byte_size bigint NULL, sha256 bytea NULL,
  location text NULL,
  erasure_pending boolean NOT NULL DEFAULT false,
  last_error text NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz NULL, dropped_at timestamptz NULL,
  CONSTRAINT uq_history_archive_partition UNIQUE (partition_name_id)
);
```

Transitions, chacune reprenable à l'identique :

1. `started` — ligne créée avant le premier octet exporté. Les deux noms sont ceux du registre des noms physiques (A5), jamais des chaînes recopiées ; ils sont résolus à l'affichage par `_basedb.v_physical_name_qualified`. L'unicité sur `partition_name_id` rend l'opération idempotente : une reprise retrouve sa ligne au lieu d'en créer une seconde.
2. `exported` — export terminé, `row_count`, `byte_size`, `sha256` et `location` renseignés.
3. `verified` — **l'archive est relue et son empreinte recalculée**, puis comparée. Aucune partition n'est détachée sur la foi d'une empreinte calculée à l'écriture.
4. `detach_requested` → `detached` — détachement (§10.3).
5. `dropped` — `DROP TABLE`, `dropped_at` renseigné.

**La suppression d'une partition non archivée alors que l'archivage est actif est refusée** : `ARCHIVE_MISSING`. Un échec à n'importe quelle étape écrit `failed` et `last_error`, et la tâche reprend au passage suivant.

### 10.6 Effacement ciblé

Une demande d'effacement de données personnelles doit atteindre toutes les copies que ce chapitre a produites. En oublier une revient à déclarer une conformité qui n'existe pas.

**L'opération d'effacement ciblé** est réservée à un rôle admin, journalisée dans `audit_log` avec son périmètre et son motif, et pilotée par une ligne de suivi :

```sql
CREATE TABLE _basedb.erasure_request (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  requested_by uuid NOT NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  scope jsonb NOT NULL,            -- table_id, record_id, field_ids, fenetre
  state text NOT NULL CHECK (state IN
    ('requested','buffers_drained','revisions_done','events_purged',
     'archives_done','complete','incomplete')),
  archives_concerned uuid[] NOT NULL DEFAULT '{}',
  finished_at timestamptz NULL,
  detail text NULL
);
```

| Cible | Traitement |
|---|---|
| Tampons de `_basedb_local` | **Drain forcé puis vidage** : l'effacement ne commence qu'une fois le tampon consolidé, faute de quoi une ligne non encore drainée réintroduirait la valeur effacée |
| `record_revision_field` | `before_value`, `after_value`, `before_display`, `after_display` remplacés par le marqueur `{"erased": true}` ; l'en-tête est conservé (auteur, date, champ, opération) |
| `record_revision` | `record_display` remplacé par le même marqueur |
| `change_event` | **Purge** des lignes de la fenêtre : c'est une file de 7 jours, pas un journal, et elle contient la ligne complète avant et après |
| `bulk_operation.sample_record_ids` | Vidé pour les opérations touchant les enregistrements visés |
| `history_archive` | Les archives couvrant la fenêtre sont listées dans `archives_concerned` et **réécrites** : relecture, neutralisation, ré-export, nouvelle empreinte, remplacement et journalisation |

`record_deletion` n'est pas concerné : il ne porte que des identifiants et des horodatages, jamais une valeur.

Ces écritures sont **les seules autorisées en modification** sur les journaux ; elles s'exécutent sous `basedb.maintenance = 'on'` (§3.5).

**Si l'archivage est actif et que le stockage d'archives est immuable en écriture**, la réécriture est impossible : l'état passe à `incomplete`, `ERASURE_INCOMPLETE` est levé, et la demande reste visible tant qu'un humain ne l'a pas close explicitement. **Le choix entre un archivage immuable et un engagement d'effacement complet est une décision d'exploitation à prendre à l'installation** ; ce chapitre refuse de laisser croire que les deux sont compatibles sans procédure.

---

## 11. Articulation avec les webhooks

### 11.1 Un point de capture, deux tampons, deux destinations

La même invocation de `capture_v1()` alimente `revision_buffer` et, quand la table est abonnée, `change_event_buffer`. Le drain les consolide respectivement vers l'historique et vers `_basedb.change_event`, dont le DDL, la partition et la rétention appartiennent au chapitre 02 ; la construction des livraisons, la forme de la charge utile, la signature, les rejeux et les codes de retour appartiennent au chapitre 08.

**Effet recherché, et qu'aucune capture applicative n'obtiendrait : une écriture SQL directe déclenche les webhooks.** Une transaction annulée n'en déclenche aucun, puisque le tampon est annulé avec elle.

### 11.2 Quel masque la capture applique : aucun

**La capture écrit la ligne physique complète**, telle que `to_jsonb()` la rend, sans aucune notion de rôle, de permission ni de champ masqué. Elle s'exécute dans la transaction de la donnée, où aucun rôle applicatif n'est connu, et toute projection à cet endroit serait à la fois impossible et fausse — un même événement sert plusieurs abonnés.

C'est ce qui rend A19 tenable : le rôle porté par un webhook doit avoir un **masque de lecture complet** sur chaque table abonnée, la souscription est refusée sinon, et un masquage survenu après coup désactive le webhook. La projection appliquée à l'émission par le chapitre 08 est donc, par construction, l'identité : **la charge utile n'est jamais amputée silencieusement**. Un consommateur qui reçoit une ligne incomplète sans le savoir est pire qu'un consommateur désactivé.

Les colonnes système font partie de la charge utile au même titre que les autres (A18), et ce sont elles qui rendent la reprise incrémentale possible.

### 11.3 L'indicateur d'abonnement `change_feed_state`

Écrire un événement pour chaque écriture même quand personne n'écoute doublerait le coût de la capture (§5.4). Résoudre les abonnements dans le chemin d'écriture coûterait une lecture de catalogue par instruction — et, surtout, **serait une lecture de `_basedb` depuis un schéma de données, que A9 interdit**.

Le compromis retenu est un **indicateur plat, une ligne par table, colocalisé avec les données** :

```sql
CREATE TABLE _basedb_local.change_feed_state (
  table_id     uuid PRIMARY KEY,
  is_active    boolean NOT NULL DEFAULT false,
  full_payload boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);
```

Il est maintenu par le chapitre 08 à chaque changement d'abonnement, dans la même transaction que ce changement. La capture fait **une lecture par index, une fois par instruction**, sur une table de quelques centaines de lignes toujours en cache. Si la ligne est absente ou illisible, **le comportement par défaut est d'écrire** : on ne perd jamais un événement par excès de prudence. `full_payload = false` fait écrire l'événement sans `before` ni `after`, pour les abonnés qui se contentent d'une notification.

### 11.4 `NOTIFY`, réveil du drain

Un `NOTIFY basedb_drain` est émis **par la capture au `COMMIT`** et réveille le drain, qui scrute de toute façon toutes les 5 secondes. Trois précautions :

- la file de notifications de PostgreSQL est **globale à l'instance et plafonnée** ; si une session `LISTEN` cesse de consommer, la file se remplit et **toutes les transactions émettant un `NOTIFY` commencent à échouer**. `pg_notification_queue_usage()` est donc mesuré (§14), avec alerte à 25 % et **coupure de l'émission des `NOTIFY` — jamais de la capture — au-delà de 50 %** ;
- la scrutation périodique rend le drain insensible à un `NOTIFY` perdu, à un redémarrage, et au fait qu'un `LISTEN` ne traverse pas un pooler en mode transaction ;
- la connexion `LISTEN` est **dédiée, hors pool, et ne tient jamais de transaction ouverte**.

### 11.5 Ce qui se passe quand un consommateur décroche

`change_event` est purgée sur l'âge (7 jours), **quel que soit l'état de consommation** : purger les seules lignes livrées ferait dépendre la taille du disque de la bonne santé d'un processus distant. Un consommateur arrêté plus longtemps a donc perdu des événements, et c'est assumé.

Sa reprise ne passe pas par le flux mais par les deux chemins bornés du chapitre 08 : les modifications par filtre sur `_updated_at`, les suppressions par le journal de suppression du §6, dont la rétention de 90 jours est précisément dimensionnée pour ce cas. **Aucun événement agrégé de substitution n'est écrit.** *Alternative écartée* : un événement unique « trou de diffusion » ou un agrégat par opération de masse — un consommateur qui entretient un miroir ne peut pas recalculer la fermeture d'une cascade ni la liste des lignes touchées, et un agrégat lui donnerait l'illusion d'être à jour. Un événement par ligne, ou un renvoi explicite vers la reprise : rien entre les deux.

---

## 12. Restauration

### 12.1 Restaurer un enregistrement supprimé

La règle du §3.4 — une suppression écrit la ligne complète — n'a d'intérêt que si le chemin de retour existe.

**L'opération de restauration** est disponible depuis la vue détail d'une suppression et depuis l'entrée de regroupement d'une suppression en chaîne :

1. Le noyau réinsère les lignes en fournissant explicitement `_id`, `_created_at` et `_created_by` lus dans l'historique ; `set_updated_at()` ne réécrit que `_updated_at` et `_updated_by`, qui portent donc l'auteur et l'instant de la restauration. Aucun mode de session particulier n'est nécessaire.
2. **L'ordre d'insertion est dérivé du graphe des clés étrangères du catalogue, racine d'abord**, puis les lignes référençantes. L'ordre inverse violerait la contrainte.
3. Si une ligne aujourd'hui absente est référencée par une ligne à restaurer — la cible a été supprimée depuis, ou elle n'est pas dans le périmètre —, la restauration est **refusée avant toute écriture**, avec `RESTORE_TARGET_MISSING` et la liste des lignes bloquantes.
4. Si la partition portant les révisions `delete` a déjà été purgée, la restauration est refusée avec `RESTORE_OUT_OF_RETENTION`. **L'écran annonce cette limite avant la fenêtre de rétention**, pas au moment du refus.
5. La restauration produit des révisions `insert` ordinaires, avec l'auteur de la restauration : l'historique de la restauration est lui-même historisé.

### 12.2 Restaurer une sauvegarde — procédure encadrée

Le §1.5 pose que `session_replication_role` est inaccessible au rôle du produit. La procédure ci-dessous est la seule faisable avec ce rôle, et elle est obligatoire : conduite sans elle, une restauration `--data-only` écrase les colonnes système, régénère un historique intégral daté du jour, et déverse un événement de diffusion par ligne restaurée.

**Le mode restauration** est réservé à un rôle admin et consigné dans `audit_log` à l'ouverture et à la fermeture.

| Étape | Action | Pourquoi |
|---|---|---|
| 1 | Fermeture des écritures sur les bases concernées ; arrêt du drain et du distributeur de livraisons | Aucun événement ne doit partir pendant l'opération |
| 2 | `ALTER TABLE "<b_*>"."<table>" DISABLE TRIGGER USER` sur toutes les tables du périmètre | N'exige que la propriété de la table. `DISABLE TRIGGER ALL`, qui toucherait les déclencheurs internes de contrainte, exigerait le superutilisateur |
| 3 | Suppression des données existantes par `DELETE` ou recréation du schéma, **jamais par `--clean --data-only`** | `pg_restore --clean --data-only` émet des `TRUNCATE`, refusés par `tg_<table>__capture_trunc` : la restauration échouerait en plein milieu, partiellement appliquée |
| 4 | Chargement des données, **dans l'ordre des dépendances de clés étrangères** | `DISABLE TRIGGER USER` laisse les déclencheurs référentiels actifs. `pg_restore` respecte cet ordre pour un dump complet, pas pour un chargement table par table |
| 5 | `ENABLE TRIGGER USER`, puis **passage obligatoire de la réconciliation du §13** avant réouverture | Vérifie que les cinq déclencheurs sont revenus en `tgenabled = 'O'` et que leurs arguments correspondent au catalogue restauré |
| 6 | Vidage des tampons de `_basedb_local` produits pendant la fenêtre, purge des lignes de `change_event` correspondantes, puis redémarrage du drain | Les lignes produites par le chargement ne correspondent à aucun fait métier |
| 7 | Écriture d'une ligne dans `_basedb.capture_gap` (`cause = 'restore'`, bornes de l'opération) et d'une ligne dans `audit_log` | **L'historique de la période restaurée est définitivement perdu et aucun rattrapage n'est possible** : les valeurs d'avant n'existent plus. Seule la déclaration de discontinuité empêche le journal de mentir |
| 8 | Rattrapage des partitions | Un dump ancien contient des lignes dont les partitions ont pu être purgées. La tâche du §10.2 est exécutée en mode rattrapage, qui crée les partitions manquantes sur toute l'étendue des données restaurées |
| 9 | Revalidation des contraintes de clé étrangère si le chargement a été fait contraintes non validées | Un chargement déclencheurs désactivés n'est pas un chargement contraintes désactivées, mais les deux se confondent souvent dans les procédures d'exploitation |

**Trois avertissements à porter dans le runbook :**

- **Restauration complète, `data-only` et restauration d'une seule base ne sont pas la même opération.** Une restauration complète recrée les déclencheurs après les données et ne pose pas le problème de l'étape 2 ; une restauration `data-only` le pose entièrement ; une restauration d'une seule base ne restaure pas le catalogue correspondant, et l'écart doit être arbitré par la réconciliation du chapitre 02 avant réouverture.
- **Un dump d'un seul schéma `b_*` n'est pas restaurable ailleurs en l'état** : ses déclencheurs référencent `_basedb_local` et des clés de catalogue qui n'existent pas dans la base d'accueil. Exporter une base utilisateur pour la réimporter ailleurs suppose d'exporter aussi son périmètre de catalogue — ce n'est pas une sauvegarde, c'est une migration.
- **Si l'exploitant dispose d'un superutilisateur**, un `GRANT SET ON PARAMETER session_replication_role` simplifie les étapes 2 et 5 sans rien changer au reste, en particulier ni à l'étape 3 ni à l'étape 7.

### 12.3 Annuler les écritures d'un acteur sur une fenêtre — capacité d'exploitation

Le chapitre 09 §6.4 fonde son budget d'écriture sur l'existence de ce chemin : un jeton d'intégration qui a écrasé des centaines de lignes avant sa suspension ne devient un incident réparable que si l'on sait rejouer les valeurs d'avant. **C'est une capacité d'exploitation réservée à un rôle admin, et non une route d'API** : ni le chapitre 08 ni le chapitre 09 ne l'exposent, et aucun jeton ne peut la déclencher, encore moins celui qu'elle répare.

**Sélection.** Les révisions candidates sont lues dans `record_revision` sur un triplet obligatoire, aucune de ses trois composantes n'étant facultative :

| Composante | Prédicat |
|---|---|
| Table | `table_id`, une seule par opération |
| Acteur | `actor_kind` et, selon sa valeur, `actor_token_id` ou `actor_user_id` |
| Période | `occurred_at` entre deux bornes explicites |

Deux filtres s'y ajoutent de droit : `op = 'update'`, parce qu'une création ne s'annule que par une suppression — décision métier, hors de ce chemin — et qu'une suppression se restaure par le §12.1 ; et `is_cascade = false`, les révisions cascadées étant la conséquence d'une écriture déjà présente dans la sélection. Le parcours emploie `idx_revision_base` et l'élagage de partitions par `occurred_at` ; l'acteur et la table sont filtrés ensuite, **aucun index dédié n'est ajouté** pour une opération exceptionnelle et administrative.

**Réapplication.** Les lignes de détail `record_revision_field` des révisions retenues sont jointes à leur en-tête par `(revision_id, occurred_at)`, puis regroupées par `record_id` et par `field_id`, et la valeur réappliquée est le `before_value` de la **révision la plus ancienne** du groupe : c'est l'état du champ avant la première écriture de l'acteur dans la fenêtre. La réécriture est un `UPDATE` **champ par champ, jamais de ligne entière** : un champ qu'un autre acteur a modifié depuis n'est pas touché, et les champs qui n'apparaissent dans aucune révision de la fenêtre ne sont pas cités dans l'énoncé. Les lignes supprimées depuis ne sont pas recréées : elles sont listées dans le rapport et renvoyées vers le §12.1.

**Trois refus, tous prononcés avant la première écriture :**

| Situation | Refus |
|---|---|
| Une partition portant des révisions de la fenêtre a déjà été purgée | `RESTORE_OUT_OF_RETENTION` |
| Un champ visé a été supprimé, purgé ou remplacé par changement de type depuis (§7.2) | `RESTORE_FIELD_CHANGED`, avec la liste des champs |
| Une valeur d'avant violerait une contrainte aujourd'hui posée — unicité, lien vers une ligne supprimée depuis | `RESTORE_TARGET_MISSING`, avec la liste des lignes bloquantes |

**Bornes de volume.** L'opération est une opération de masse déclarée au sens du §5.3 : elle crée sa ligne de `bulk_operation` avec `source = 'system'`, `op = 'update'` et `detail_written = 'full'`, pose `basedb.bulk_id`, et **est donc elle-même intégralement historisée** — revenir en arrière est un acte, pas un effacement, et il s'annule par le même chemin. Elle est soumise au découpage obligatoire du §5.1 en lots de clés primaires et au plafond `history.bulk_hard_cap`, au-delà duquel elle est refusée par `BULK_OPERATION_REFUSED`. Deux bornes propres s'y ajoutent : la fenêtre ne peut excéder **31 jours**, et la sélection **10 000 enregistrements distincts** ; au-delà de l'une ou de l'autre, l'opération est refusée et l'exploitant est renvoyé vers la restauration de sauvegarde du §12.2. Le coût est annoncé avant confirmation selon le §5.4, l'annulation produisant autant de révisions que l'opération annulée.

---

## 13. Réconciliation et réparation

### 13.1 Classes de dérive `HIST-`

Les classes sont préfixées par leur chapitre d'origine selon la nomenclature du chapitre 02, qui porte le régime d'exécution, l'isolation et la fréquence. Ce chapitre n'ajoute que ses classes propres, et une lettre nue ne désigne jamais rien.

| Classe | Question | Code levé |
|---|---|---|
| `HIST-1` | Une table utilisateur vivante porte-t-elle ses cinq déclencheurs, identifiés par `tgrelid` + `tgfoid`, tous en `tgenabled = 'O'` ? | `CAPTURE_TRIGGER_MISSING` |
| `HIST-2` | Les arguments d'un déclencheur de capture correspondent-ils aux clés de catalogue de la table et à une version de contrat installée ? | `CAPTURE_NOT_CONFORMING` |
| `HIST-3` | `pg_proc.proconfig` de la fonction de capture porte-t-il `search_path`, `TimeZone`, `DateStyle`, `IntervalStyle` et `extra_float_digits` aux valeurs du §1.3 ? | `CAPTURE_NOT_CONFORMING` |
| `HIST-4` | Le déclencheur d'immuabilité est-il présent sur chaque journal **et sur chacune de ses partitions** ? | `CAPTURE_NOT_CONFORMING` |
| `HIST-5` | Existe-t-il des lignes de `record_revision_field` sans en-tête sur la même partition ? | `HISTORY_ORPHAN_ROWS` |
| `HIST-6` | Le tampon d'une base contient-il des lignes non drainées au-delà du seuil de retard ? | `DRAIN_LAGGING` |

**`HIST-1` à `HIST-5` sont classés incident, jamais avertissement.** Une table sans capture, ou dont la capture est partielle, est un incident d'exploitation. `HIST-6` est une alerte d'exploitation qui devient un incident au-delà d'une heure.

La correspondance colonne ↔ champ n'apparaît pas dans cette liste : elle est vérifiée par `CAT-COL1` et `CAT-COL2` du chapitre 02, et le drain relisant le catalogue à chaque passage, elle ne peut pas se figer.

### 13.2 Réparation, et la fenêtre non couverte

Détecter ne suffit pas : recréer les déclencheurs restaure la capture mais laisse derrière elle un intervalle non couvert dont plus rien ne garderait la trace, et les consultations continueraient d'afficher un journal d'apparence continue — le mensonge par omission refusé au §1.1.

**L'opération de recréation des déclencheurs** est réservée à un rôle admin, idempotente, reprenable, table par table :

1. Verrou de classe `structure_step` sur la base, comme toute opération de structure.
2. `SET LOCAL lock_timeout = '3s'` ; un échec d'acquisition reporte la table, il n'interrompt jamais l'opération.
3. `DROP TRIGGER IF EXISTS` puis `CREATE TRIGGER` des cinq déclencheurs.
4. Écriture d'une ligne de `capture_gap` **avant** de passer à la table suivante.
5. Ligne dans `audit_log` : périmètre, tables traitées, tables reportées, durée.

```sql
CREATE TABLE _basedb.capture_gap (
  id uuid PRIMARY KEY DEFAULT _basedb_local.uuid_generate_v7(),
  base_id  uuid NOT NULL,
  table_id uuid NULL,                -- NULL = toutes les tables de la base
  started_at timestamptz NOT NULL,   -- dernier controle reussi, ou debut de la restauration
  ended_at   timestamptz NOT NULL,   -- reparation ou reouverture des ecritures
  cause text NOT NULL CHECK (cause IN
    ('trigger_missing','trigger_disabled','restore','capture_not_conforming','other')),
  detail text NULL,
  declared_by uuid NULL REFERENCES _basedb.app_user(id) ON DELETE RESTRICT,
  declared_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_capture_gap_scope ON _basedb.capture_gap (base_id, table_id, started_at);
```

**Toute consultation d'historique qui traverse une fenêtre non couverte l'affiche.** La requête du §9.1 joint cette table, et l'interface insère dans la chronologie un bandeau « aucune modification n'a été enregistrée entre le 3 et le 5 mars — déclencheurs absents, réparés le 5 mars ». C'est ce bandeau, et lui seul, qui empêche le journal de mentir.

`started_at` vaut la date du dernier contrôle de réconciliation réussi sur cette table : on ne sait pas quand la capture s'est arrêtée, on sait seulement depuis quand on ne l'a plus vérifiée. Dire moins serait faux, dire plus serait inventé.

---

## 14. Observabilité

Un chapitre qui place la capture dans le moteur de base doit dire ce qu'on regarde pour savoir qu'elle fonctionne. Les métriques sont exposées au format du chapitre 10.

| Métrique | Type | Seuil d'alerte |
|---|---|---|
| Durée ajoutée par la capture, par instruction (p50, p95, p99) | Histogramme, par base | p95 > 1,5 ms sur écriture mono-ligne (§1.6) |
| **Retard du drain** : âge de la plus ancienne ligne non drainée | Jauge, par base | > 60 s → `DRAIN_LAGGING` ; > 1 h → gravité maximale |
| Taille des tampons de `_basedb_local` | Jauge, par base | Croissance monotone sur trois passages |
| Facteur d'amplification d'écriture (octets durables ÷ octets de donnée) | Jauge quotidienne | > 6 — indique un flux d'événements actif inutilement ou des tables trop larges |
| Croissance mensuelle des journaux et de `change_event` | Jauge, par base et par table | Projection dépassant 80 % du disque à 3 mois |
| `pg_notification_queue_usage()` | Jauge | > 25 % alerte, > 50 % coupure des `NOTIFY` |
| Présence des partitions M+1 et M+2, partition `DEFAULT` vide | Booléen, horaire | Absente ou non vide → `HISTORY_PARTITION_MISSING` |
| Durée et résultat des tâches de partitionnement, purge, archivage | Compteur + durée | Deux échecs consécutifs |
| `lock_wait_ms` des étapes de migration | Histogramme | p95 > 3 s sur 24 h |
| Écarts de réconciliation `HIST-*` | Compteur par classe | Tout écart non nul |
| Lignes de tampon écrites par transaction | Histogramme | p99 > 50 000 — précurseur de `BULK_OPERATION_REFUSED` |
| Révisions avec `actor_kind IN ('sql_direct','unknown')` | Compteur quotidien | Croissance inattendue : soit du SQL direct légitime, soit un chemin applicatif qui a oublié les variables de session |
| Tables sans colonne d'affichage désignée | Jauge | Informatif, affiché dans l'administration (§4.3) |
| Fenêtres non couvertes ouvertes dans les 30 derniers jours | Jauge | Toute valeur non nulle |

Les traces applicatives d'une écriture portent la base, la table, le nombre de lignes affectées, le nombre de lignes de tampon écrites et la durée de la transaction — assez pour rapprocher une lenteur observée côté interface d'une opération de masse ou d'une cascade.

---

## 15. Volumétrie

Les décisions de ce chapitre sont prises au nom du volume ; le volume doit donc être chiffré, et les chiffres vérifiables sur un jeu de référence de 20 colonnes, ligne moyenne de 600 octets en JSON.

| Poste | Taille |
|---|---|
| Ligne de tampon (deux images complètes) | ≈ 1 350 o, **transitoire** |
| Ligne de `record_revision` (tas) | ≈ 300 o |
| Entrées d'index par révision (quatre index) | ≈ 200 o |
| Ligne de `record_revision_field` (tas) | ≈ 190 o |
| Entrées d'index par détail | ≈ 100 o |
| Ligne de `record_deletion` (tas + clé primaire) | ≈ 110 o |
| Ligne de `change_event` avec deux images complètes | ≈ 1 350 o |

**Amplification par écriture utilisateur** (12 champs non nuls à la création, 1,5 champ modifié par mise à jour, 20 champs à la suppression) :

| Opération | Durable, sans abonné | Durable, avec abonné | Transitoire |
|---|---|---|---|
| Création | ≈ 4,0 Ko | ≈ 5,4 Ko | ≈ 0,8 Ko |
| Modification | ≈ 0,9 Ko | ≈ 2,2 Ko | ≈ 1,4 Ko |
| Suppression | ≈ 6,4 Ko | ≈ 7,8 Ko | ≈ 0,8 Ko |
| **Moyenne pondérée** (20 % / 70 % / 10 %) | **≈ 2,0 Ko** | **≈ 3,4 Ko** | **≈ 1,2 Ko** |

**Le tampon est le prix de la colocalisation, et il se paie en WAL, pas en disque durable.** Une ligne de tampon vit quelques secondes, mais elle est journalisée à l'écriture et à la suppression : le WAL induit passe d'environ 1,5 à 3 fois le volume durable à 2 à 4 fois. C'est le coût de l'indépendance du chemin d'écriture vis-à-vis du catalogue, et il est annoncé plutôt que découvert.

**Paliers**, pour 50 bases et 500 tables, rétention 24 mois, sans abonné :

| Écritures / mois | Croissance mensuelle | Total à 24 mois | WAL induit / mois |
|---|---|---|---|
| 100 000 | ≈ 0,2 Go | ≈ 5 Go | 0,5 à 1 Go |
| 1 000 000 | ≈ 2,0 Go | ≈ 48 Go | 5 à 10 Go |
| 10 000 000 | ≈ 20 Go | ≈ 480 Go | 50 à 100 Go |

`change_event` n'entre pas dans ces totaux : sa rétention de 7 jours lui donne une taille d'équilibre d'environ 0,3 Go pour un million d'écritures mensuelles avec abonné. `record_deletion` reste marginal : 90 jours de suppressions représentent moins de 1 % du total.

**Seuil de non-tenue de la rétention** : au-delà d'environ **2,5 millions d'écritures par mois sur un disque de 200 Go dédié à `_basedb`**, la rétention de 24 mois n'est plus tenable et l'un des trois leviers doit être actionné — réduire la rétention, activer l'archivage avec suppression (§10.5), ou dédier un tablespace. Le franchissement est annoncé par la métrique de projection de croissance, pas découvert un vendredi soir. Ces constantes sont révisées à chaque campagne de volumétrie, et le jeu de référence est versionné avec les tests.

---

## 16. Stratégie de test

Tout le mécanisme repose sur des comportements serveur difficiles à reproduire ; la stratégie de test fait donc partie de la spécification.

1. **Les partitions font partie de la mise en place.** Le jeu de tests crée les partitions du mois courant, du mois précédent et des deux mois suivants avant tout drain. Un drain qui échoue faute de partition doit lever `HISTORY_PARTITION_MISSING` et non une erreur PostgreSQL brute : c'est aussi un test.
2. **Le drain est testable seul.** Les tests écrivent directement dans les tampons, lancent un passage de drain, et assertent sur le contenu de `_basedb`. Le rejeu du même lot deux fois doit produire un résultat identique : c'est le test d'idempotence, et c'est le plus important du chapitre.
3. **Aucune injection d'horloge.** Les instants viennent du serveur ; les assertions portent sur l'**ordre relatif** (révision B postérieure à A, même transaction que C), jamais sur des instants absolus.
4. **Les données antérieures sont posées directement.** Pour tester la purge, la rétention, la bascule de partition et la pagination mois par mois, les tests insèrent des lignes avec un instant choisi : l'immuabilité ne bloque que `UPDATE` et `DELETE`, l'insertion directe reste le mécanisme de fixture officiel.
5. **Les seuils sont des paramètres.** `history.bulk_threshold` et le plafond dur sont abaissés à 5 et 20 dans les tests.
6. **Les chaînes `CASCADE` et `SET NULL` sont testées avec de vraies contraintes**, sur un parent de trois lignes et un enfant de trente, avec assertion sur `is_cascade`, sur le regroupement par `(occurred_at, xact_id)` et sur les trois rangs de résolution de `before_display`, chacun testé en isolant les autres.
7. **Les instructions composites ont leurs propres cas** : `ON CONFLICT DO UPDATE` (deux ensembles), `ON CONFLICT DO NOTHING` (un seul), `MERGE` avec une branche sans ligne (aucune écriture), `COPY` (un seul déclenchement).
8. **Les cas d'échec sont testés autant que les cas nominaux** : partition absente, déclencheur désactivé, plafond franchi, drain interrompu au milieu d'un lot, catalogue indisponible pendant que les écritures continuent.
9. **Un jeu de référence de volumétrie**, versionné, sert à remesurer les constantes du §15 et la latence mono-ligne du §1.6. C'est le seul test qui a le droit d'être lent.

---

## 17. Versionnement de la capture

Ce chapitre place délibérément de la logique dans des fonctions de base de données. Il doit donc dire comment elles évoluent, faute de quoi le premier déploiement progressif produit un incident.

1. **La fonction de capture est versionnée dans son nom** : `_basedb_local.capture_v1`, `capture_v2`. Les deux coexistent pendant toute la durée d'une migration de contrat, chaque déclencheur référence une version précise, et chaque ligne de tampon puis chaque révision porte `format_version`.
2. **Ordre de déploiement : la fonction d'abord, le code ensuite.** La migration qui installe `capture_v2` est appliquée avant le déploiement applicatif qui sait la piloter, et `v2` doit accepter les arguments de `v1`. L'ordre inverse produit une application qui appelle une fonction inexistante.
3. **Le drain doit savoir lire toutes les versions de format encore présentes dans les tampons**, y compris pendant la bascule. C'est `format_version`, et non la date, qui commande l'interprétation.
4. **Un retour arrière applicatif ne ramène pas la fonction de base.** Toute version `vN+1` doit donc continuer à fonctionner correctement quand elle est pilotée par la version `N` de l'application : une fonction qui exigerait une nouvelle variable de session obligatoire serait un aller sans retour, d'où l'exigence que toute nouvelle variable ait une valeur de repli.
5. **La bascule des déclencheurs vers une nouvelle version est une opération de masse**, conduite par l'opération du §13.2 : table par table, sous `lock_timeout` de 3 s, reprenable, avec report des tables verrouillées. Sur 500 tables, l'ordre de grandeur est de 10 à 20 minutes en heure creuse, dominé par l'attente de verrous et non par le DDL. Pendant l'opération, `HIST-2` tolère explicitement un mélange de versions tant qu'une bascule est déclarée ouverte dans `audit_log`, et le signale comme incident dès sa clôture.
6. **La suppression d'une version de fonction** n'intervient qu'après un passage complet de réconciliation confirmant qu'aucun déclencheur ne la référence plus et qu'aucun tampon ne porte son `format_version`.

---

## 18. Codes d'erreur définis par ce chapitre

Ces codes sont en anglais, à raison d'un par condition (A2, A23), et versés au registre unique `_basedb.error_code`. Ils peuvent y être ajoutés, jamais renommés ni resémantisés sans changement de version d'API, et ne sont jamais remplacés par une erreur serveur PostgreSQL brute.

| Code | Condition | Niveau |
|---|---|---|
| `TRUNCATE_FORBIDDEN` | `TRUNCATE` sur une table utilisateur | Validation |
| `BULK_OPERATION_REFUSED` | Plafond de lignes capturées dans une transaction dépassé (§5.1) | Validation |
| `HISTORY_IMMUTABLE` | `UPDATE` ou `DELETE` sur un journal hors maintenance | Incident |
| `HISTORY_UNAVAILABLE` | La capture a échoué, donc l'écriture de données aussi (§4.5) | Incident — indisponibilité des écritures |
| `DRAIN_LAGGING` | Retard du drain au-delà de `history.drain_lag_max` | Exploitation, incident au-delà d'une heure |
| `HISTORY_PARTITION_MISSING` | Partition du mois courant, de M+1 ou de M+2 absente, ou partition `DEFAULT` non vide | Incident |
| `CAPTURE_TRIGGER_MISSING` | Table utilisateur sans ses cinq déclencheurs actifs en `tgenabled = 'O'` | Incident |
| `CAPTURE_NOT_CONFORMING` | Arguments de déclencheur, attributs de la fonction de capture ou déclencheur d'immuabilité non conformes | Incident |
| `HISTORY_ORPHAN_ROWS` | Lignes de détail sans en-tête sur la même partition | Incident |
| `PARTITION_DETACH_STUCK` | Partition restée en détachement au-delà d'un passage de la tâche | Exploitation |
| `ARCHIVE_MISSING` | Suppression d'une partition non archivée, archivage actif | Exploitation |
| `RETENTION_INCONSISTENT` | Rétention des structures inférieure à celle des données | Configuration |
| `RESTORE_TARGET_MISSING` | Restauration référençant une ligne absente et hors périmètre | Validation |
| `RESTORE_OUT_OF_RETENTION` | Révisions nécessaires à la restauration déjà purgées (§12.1, §12.3) | Validation |
| `RESTORE_FIELD_CHANGED` | Champ visé par une annulation en masse supprimé, purgé ou remplacé depuis (§12.3) | Validation |
| `ERASURE_INCOMPLETE` | Effacement ciblé n'ayant pas pu atteindre les archives | Conformité — incident |

Deux codes employés ici sont définis ailleurs : `LOCK_UNAVAILABLE` (chapitre 01) et `DISPLAY_FIELD_IN_USE` (chapitre 02).

---

## État de la mise en œuvre (v1)

**Fait.** Les déclencheurs d'instruction à tables de transition posés à la création de
chaque table (§1.2), la fonction `_basedb_local.capture_v1()`, les tampons, le drain sous
verrou consultatif qui écrit `record_revision`, `record_revision_field`,
`record_deletion` et `change_event` dans une seule transaction, l'identité de l'auteur par
variables de session (`sql_direct` quand elles manquent), l'immuabilité des journaux, le
refus de `TRUNCATE`, la consultation (historique d'une ligne, d'une base, filtré par les
droits actuels du lecteur), l'annulation d'une modification (`REVISION_SUPERSEDED` si un
champ a bougé depuis) et la restauration d'une ligne supprimée.

**Écarts assumés.**

- `capture_v1` est `SECURITY DEFINER`, avec un `search_path` et des réglages de
  formatage figés : un consommateur SQL direct qui écrit dans une table n'a pas à détenir de
  droit sur les tampons.
- Les journaux n'ont qu'une partition `DEFAULT` : pas de partition mensuelle ni de tâche
  qui les crée d'avance.
- Le drain ne se réveille pas sur `NOTIFY` : il sonde toutes les deux secondes.
- Le garde-fou des opérations en masse (§5) se réduit au plafond cumulé de
  `basedb.rows_written` (100 000 lignes, `BULK_OPERATION_REFUSED`) : pas d'opération en
  masse déclarée ni de ligne `bulk_operation`.
- `structure_revision` (§8.1) est alimentée par déclencheur et non par le moteur, et se lit
  dans l'onglet « Structure » de l'historique d'une base ; sa rétention n'a pas de tâche de
  purge.


## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Capture par déclencheur, tampon dans `_basedb_local`, drain vers `_basedb` (A10) | Le cadrage promet l'écriture SQL directe historisée ; la colocalisation préserve l'atomicité sans qu'un objet de `b_*` touche `_basedb`, donc sans hypothéquer la séparation physique du catalogue (A9) | Capture applicative ; écriture directe du déclencheur dans `_basedb` ; boîte d'envoi dans le schéma de données |
| Déclencheurs `AFTER … FOR EACH STATEMENT` avec tables de transition | Écriture ensembliste, comptage avant écriture | `FOR EACH ROW` : une invocation par ligne, aucun comptage possible |
| Cinq déclencheurs, liste normative, noms alloués au registre | PostgreSQL interdit les tables de transition sur un déclencheur multi-événements ; l'allocation supprime tout risque de troncature silencieuse à 63 octets | Rôles construits par concaténation, réconciliation par comparaison de chaînes |
| Arguments de déclencheur immuables (`base_id`, `table_id`, `format_version`) | Aucune migration de colonne ne recrée les déclencheurs, et aucune carte figée ne peut diverger du catalogue en silence | Carte colonne → champ figée dans les arguments, protégée par une empreinte et un verrou de sérialisation |
| Correspondance colonne → champ établie par le drain, catalogue relu à chaque passage | Le seul endroit où la règle peut être fausse est un endroit unique, hors du chemin d'écriture | Résolution dans le déclencheur, donc lecture de `_basedb` depuis un schéma `b_*` |
| Idempotence du drain par reprise de l'identifiant de tampon et `ON CONFLICT DO NOTHING` | Deux pools, deux transactions : c'est la seule façon d'obtenir l'exactement-une-fois sans validation en deux phases, indisponible au rôle propriétaire | Validation en deux phases ; marquage avant écriture |
| Fonction de capture avec `SET search_path`, `TimeZone`, `DateStyle`, `IntervalStyle`, `extra_float_digits` | Le contrat de connexion ne couvre pas les sessions `psql` ; sans ces attributs la sérialisation JSON dépend de la session et l'historique cesse d'être comparable | S'en remettre au contrat de connexion |
| Aucune instruction statique référençant `old_rows` / `new_rows` ; tout par `EXECUTE` | Une fonction partagée par toutes les tables obtiendrait un plan construit sur la forme de ligne d'une autre table | SQL statique en PL/pgSQL, plus lisible |
| Déclencheurs en `ORIGIN`, jamais `ALWAYS` ; `session_replication_role` déclaré inaccessible | C'est un paramètre `superuser` ; `ALWAYS` ferait régénérer un historique faux lors d'une restauration conduite par un superutilisateur | `ENABLE ALWAYS` ; `pg_restore --disable-triggers` |
| Identité par variables de session `SET LOCAL` + `set_config` paramétré | Connexions mutualisées ; `SET` survivrait à la transaction, la concaténation serait une injection | `SET` de session, ou colonne applicative |
| Écriture jamais refusée pour absence d'identité (`actor_kind = 'sql_direct'`) | Refuser reviendrait à interdire le SQL direct | Refus, ou écriture sans trace |
| Distinction de la cascade par `pg_trigger_depth() > 1` (A14) | Une suppression multiple marquerait toutes les lignes sauf une en « cascade » et inventerait une arborescence | Comparaison à une ligne racine transmise par variable de session |
| En-tête + détail, JSONB **scalaire** contraint, `field_kind` dénormalisé | Journal hétérogène, interrogé par identifiant, devant survivre à la purge de la structure | Colonnes typées (cinq colonnes nulles sur six) ; table d'historique par table utilisateur |
| Delta pour `insert` et `update`, ligne complète pour `delete` | À la suppression, la ligne d'historique est la seule copie restante | Instantané complet à chaque opération |
| Aucune clé étrangère d'un journal vers le catalogue | Une seule `RESTRICT` rendrait la purge d'une table impossible pendant toute la rétention ; une `CASCADE` détruirait le journal avec l'objet | Clés étrangères vers `base`, `table_def`, `migration` |
| Valeur d'affichage résolue par le drain, trois rangs, jamais rafraîchie | Au moment du drain la révision de la cible est déjà disponible, ce qu'un déclencheur synchrone ne verrait pas ; une résolution à la lecture afficherait la valeur actuelle, donc fausse | Résolution paresseuse à la lecture ; jointure seule à l'écriture avec repli par variable de session |
| Garde-fou de masse **cumulé par transaction**, décision « détail ou non » portée par la ligne `bulk_operation` déclarée | Une cascade émet une instruction par ligne parente, et un seuil par instruction dépend de la taille de lot du client, pas de la nature de l'opération | Seuil et plafond par instruction |
| Journal de suppression dédié, clé `(table_id, deleted_at, record_id)`, rétention 90 jours (A24) | Le chemin de reprise d'un consommateur a sa propre clé de pagination, sa propre durée et son propre coût ; le faire traverser 24 mois de révisions le rendrait impraticable | Lecture paginée de `record_revision` filtrée sur `op = 'delete'` |
| Capture sans aucun masque ; masque complet exigé du rôle du webhook (A19) | Une charge utile amputée en silence est pire qu'un webhook désactivé, et la capture ne connaît aucun rôle | Projection par rôle dans le chemin d'écriture ; troncature des champs volumineux |
| Un événement par ligne, aucun agrégat de substitution | Un miroir ne peut pas recalculer la fermeture d'une cascade ; un agrégat lui donnerait l'illusion d'être à jour | Événement agrégé de masse ; événement « trou de diffusion » |
| Indicateur `change_feed_state` colocalisé dans `_basedb_local` | Résoudre les abonnements dans le chemin d'écriture serait une lecture de `_basedb` depuis `b_*`, que A9 interdit | Résolution des abonnements à l'écriture ; écriture inconditionnelle des événements |
| Purge de `change_event` sur l'âge, quel que soit l'état de consommation | Sinon la taille du disque dépend de la bonne santé d'un processus distant | Purge des seules lignes livrées |
| Déclencheur d'immuabilité au niveau instruction, sur le parent **et chaque partition** | Évite 10 000 invocations par lot de purge ; les déclencheurs d'instruction ne sont pas hérités | `FOR EACH ROW` sur le parent seul |
| Partitions créées par `CREATE TABLE` + `CHECK` + `ATTACH`, purgées par détachement, partition `DEFAULT` maintenue vide | `ATTACH` ne prend qu'un `SHARE UPDATE EXCLUSIVE` ; `CREATE … PARTITION OF` gèlerait les consolidations derrière une transaction longue | `CREATE TABLE … PARTITION OF` ; partition par défaut utilisée comme filet permanent |
| Archivage modélisé en machine à états, `UNIQUE (partition_name_id)`, empreinte revérifiée à la relecture | Une interruption entre deux étapes est la situation normale d'une tâche nocturne ; sans état, la reprise duplique ou perd | Séquence d'instructions avec reprise implicite |
| Purge ligne à ligne : détails d'abord, en-têtes ensuite, une transaction par lot | L'ordre inverse produit des orphelins définitifs et inatteignables | Suppression des en-têtes en premier |
| `migration_execution` réduit à la trace d'exécution, diagnostic laissé à `migration` (A12) | Deux colonnes portant le même diagnostic divergent toujours ; l'unicité de l'applicateur est déjà garantie déclarativement | Table d'exécution portant son propre vocabulaire d'états et son propre verrou d'applicateur |
| `capture_gap` affichée dans toute consultation qui la traverse | Réparer sans déclarer le trou laisse un journal d'apparence continue, c'est-à-dire un mensonge | Réparer silencieusement |
| Fonction de capture versionnée dans son nom, `format_version` sur chaque ligne | Un retour arrière applicatif ne ramène pas la fonction de base | Fonction unique remplacée en place |

## Risques et limites connues

- **L'historique n'est pas opposable.** Les variables de session ne sont pas une frontière de sécurité : quiconque détient la connexion propriétaire peut se déclarer qui il veut, désactiver un déclencheur ou écrire dans les tampons. La frontière de confiance est l'accès au compte PostgreSQL, et rien d'autre.
- **Une défaillance de la capture reste une indisponibilité des écritures.** Elle est dans la transaction de la donnée, donc un disque plein côté données ou une fonction de capture en erreur arrêtent les écritures du produit. La colocalisation a réduit la liste des causes à deux, elle ne l'a pas vidée.
- **La consultation de l'historique est décalée.** Ce qui vient d'être écrit n'est visible dans les journaux qu'après le drain. Le délai est mesuré et annoncé, il n'est pas nul, et aucun écran ne peut prétendre le contraire.
- **Le tampon coûte du WAL.** Deux images complètes de chaque ligne transitent par `_basedb_local`, journalisées à l'écriture et à la suppression. C'est le prix de l'indépendance vis-à-vis du catalogue, et il double presque l'amplification d'écriture sur les modifications.
- **Un drain arrêté remplit le disque des données.** Il n'y a pas d'autre borne que ce disque. Le retard est mesuré et alerté à une minute, la gravité devient maximale à une heure, mais un incident non traité finit par arrêter les écritures — plus tard qu'une capture synchrone, et pour la même raison.
- **La cascade reste le chemin coûteux.** Une instruction par ligne parente, donc autant d'invocations de la capture. Le cumul par transaction le rend visible et bornable, il ne le rend pas bon marché.
- **`before_display` peut manquer.** Les trois rangs couvrent les cas connus ; une cible supprimée avant la mise en service du journal aboutit au marqueur « cible supprimée ». L'information est perdue et ne peut pas être reconstituée.
- **La purge détruit de la traçabilité.** Au-delà de la fenêtre de rétention, « qui a mis cette valeur » n'a plus de réponse et les restaurations de lignes supprimées deviennent impossibles. L'interface l'affiche en permanence ; cela reste une perte.
- **L'archivage et l'effacement complet ne sont compatibles qu'au prix d'une réécriture d'archives.** Sur un stockage immuable, le choix doit être fait à l'installation et la non-conformité assumée explicitement.
- **Le détachement de partition prend brièvement un verrou exclusif.** La partition `DEFAULT` maintenue comme filet interdit le détachement concurrent ; la purge suspend donc le drain quelques dizaines de millisecondes, ce qui est acceptable pour le drain et ne le serait pas pour des écritures utilisateur.
- **Deux dérogations à la règle « toujours `BEGIN` »** : la création et le détachement de partitions, hors bloc transactionnel. Ce sont les deux seules, elles sont écrites, et toute troisième serait une régression.

## Questions ouvertes

1. **Archivage obligatoire au-delà d'un palier de volumétrie.** La rétention par défaut de l'historique des enregistrements est de 24 mois (A24) et n'est pas rediscutée ici ; le chiffre est tenable jusqu'à environ 2,5 millions d'écritures mensuelles sur le disque prévu. Ce qui reste ouvert est le régime au-delà : faut-il rendre l'archivage du §10.5 obligatoire à partir d'un palier de volumétrie, au lieu de le laisser au choix de l'exploitant par `history.archive_enabled` ? La réponse dépend du profil d'usage réel, inconnu à ce stade.
2. **Seuil de masse à 500 lignes cumulées.** Assez bas pour attraper les imports, assez haut pour ne pas déclarer « opération de masse » une saisie de 200 lignes dans la grille. À confirmer sur les premiers usages, le paramètre étant réglable par instance.
3. **Conservation des révisions d'une base supprimée.** Ce chapitre ne purge rien à la suppression d'une base ; l'historique vit sa propre rétention. Faut-il, à la purge d'une base, purger aussi son historique par anticipation, ou le laisser expirer ? Le premier choix libère du disque immédiatement, le second préserve la capacité d'enquête après une suppression contestée.
4. **Restauration d'un ensemble supprimé en chaîne de grande ampleur.** Le chemin du §12.1 est spécifié pour une racine et ses dépendances. Au-delà de quelques milliers de lignes, faut-il le refuser et renvoyer vers une restauration de sauvegarde, et à partir de quel seuil ?


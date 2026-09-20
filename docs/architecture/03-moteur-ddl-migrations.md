# 03 — Moteur DDL et stratégie de migration

## Rôle du moteur

Le moteur DDL est le **seul** composant autorisé à émettre `CREATE`, `ALTER` ou `DROP` sur les schémas `b_*`. L'API REST, l'interface et le serveur MCP n'appellent jamais PostgreSQL pour modifier une structure : ils soumettent une *intention de structure*, le moteur la transforme en **plan**, exécute ce plan étape par étape et tient le catalogue à jour dans les transactions de ces étapes.

Les schémas `_basedb` et `_basedb_local` sont hors de ce périmètre : ils relèvent des migrations de catalogue décrites au chapitre 02 — Schéma du catalogue `_basedb`. Le moteur **écrit** dans `_basedb` — définitions, registre des noms, journal de migration — mais n'en **modifie jamais la structure**.

Aucun `GRANT` ni `REVOKE` n'est émis : les droits sont applicatifs (chapitre 05 — Modèle de permissions), la connexion est propriétaire de la base d'accueil.

### Invariants

- **I-DDL-1 — Rien n'entre dans le SQL sans passer par un rendu contrôlé.** Les identifiants proviennent de `_basedb.physical_name` et sont revalidés puis quotés avant émission. Les valeurs passent par des paramètres liés partout où le protocole les accepte — c'est-à-dire **jamais dans un énoncé utilitaire** : `CREATE`, `ALTER`, `COMMENT ON` n'acceptent aucun `$1`. Les cinq points d'entrée littéraux du DDL sont énumérés et encadrés au §6.2.
- **I-DDL-2 — À l'issue de chaque étape, le catalogue et la structure physique décrivent le même monde.** Aucune étape ne laisse un objet physique sans sa ligne de catalogue, ni une ligne de catalogue sans son objet : c'est la lecture retenue de l'exigence « DDL et catalogue dans la même transaction » (A11). Les seules divergences tolérées sont les **états intermédiaires nommés au catalogue**, pris dans le vocabulaire fermé `_basedb.physical_state` du chapitre 02 — `pending`, `building`, `not_valid`, `validating`, `dropping` — et dans `definition_state = 'pending'`. Toute autre divergence est une dérive (§11).
- **I-DDL-3 — Jamais de `CASCADE` sur un `DROP`.** Aucune exception. Toute dépendance est résolue explicitement, dans l'ordre, par le plan — y compris les vues SQL d'alias de compatibilité (§10).
- **I-DDL-4 — Aucun identifiant n'est concaténé au moment de l'émission.** Tout nom émis — table, colonne, contrainte, index, séquence, déclencheur, nom de relégation `zz_supprime_…` — a été **alloué** au registre, borné à 63 octets par la répartition de budget du chapitre 01 §9.6, puis **relu** depuis le catalogue au moment de produire le SQL. Le moteur ne recalcule jamais un nom.
- **I-DDL-5 — Une transaction ne contient jamais à la fois un énoncé prenant `ACCESS EXCLUSIVE` et un énoncé à parcours complet de table.** PostgreSQL ne relâche aucun verrou de table avant le `COMMIT` : mélanger les deux annule tout le bénéfice des formes non bloquantes. Cet invariant est vérifiable par le planificateur, sur le plan, avant toute émission (§2.5).
- **I-DDL-6 — Aucune connexion n'est rendue à un pool avec un paramètre de session modifié.** Les réglages permanents sont dans le paquet de démarrage (chapitre 01 §10.3), les écarts par étape passent par `SET LOCAL`, et une étape hors transaction s'exécute sur une connexion ouverte et fermée pour elle.
- **I-DDL-7 — Aucune clé étrangère n'est retirée automatiquement**, hors la fenêtre de reprise immédiate du plan qui vient de la poser, et sur la seule erreur `23503` (§9.4).
- **I-DDL-8 — Aucune réparation automatique de dérive.** La seule action automatique du moteur sur une structure existante est la **reprise d'un plan inachevé**, qui est l'exécution normale de la machine à états. Tout le reste est arbitré par un humain (§11).

---

## 1. Prérequis PostgreSQL et objets partagés

### 1.1 Version minimale et comportements datés

**basedb exige PostgreSQL 16 ou plus** (A1) ; en dessous, le processus ne démarre pas, avec le code `POSTGRES_VERSION_TOO_OLD` du chapitre 02. Ce chapitre s'appuie sur des comportements qui n'existent pas dans les versions antérieures, et une garantie de verrouillage fausse est pire qu'une garantie absente.

| Comportement exploité | Introduit en | Utilisé par |
|---|---|---|
| `ADD CONSTRAINT … FOREIGN KEY` en `SHARE ROW EXCLUSIVE` au lieu d'`ACCESS EXCLUSIVE` | 9.5 | §9.5 |
| `pg_blocking_pids()` | 9.6 | §5.3, §14.3 |
| `ADD COLUMN` avec défaut **constant** sans réécriture de table | 11 | §7.2 |
| `SET NOT NULL` instantané s'il s'adosse à un `CHECK (x IS NOT NULL)` déjà validé | 12 | §7.2 |
| `REINDEX CONCURRENTLY` | 12 | §11.3 (réparation arbitrée) |
| `gen_random_uuid()` dans le noyau, sans extension | 13 | §1.3 |
| `reltuples = -1` pour une relation jamais analysée (et non plus `0`) | 14 | §9.4 |
| `UNIQUE NULLS NOT DISTINCT` | 15 | §7.2 |
| `pg_input_is_valid` | 16 | pré-contrôles du chapitre 04 |

Le plancher étant unique, il n'existe **qu'une seule version cible** : la description de l'effet et du profil de verrouillage de chaque opération est celle du §7.1, sans table de correspondance par version majeure. Le jour où le plancher changerait, cette description serait versionnée par `planner_version`, comme le reste du comportement du planificateur.

### 1.2 Extensions et collations

Conformément à A3, `pg_trgm`, `unaccent` et la disponibilité des collations ICU sont des **prérequis d'installation**, vérifiés au démarrage par le chapitre 10 — Architecture logicielle, avec un code distinct par élément manquant. **Le moteur n'installe aucune extension** : `CREATE EXTENSION` d'une extension non « trusted » exige des privilèges d'instance dont le rôle ne dispose pas.

| Extension | Usage envisageable | Décision |
|---|---|---|
| `pg_trgm`, `unaccent` | recherche « contient » indexée, comparaison insensible aux accents | **prérequis d'installation** (A3), jamais installées par le moteur |
| `uuid-ossp` | génération d'UUID | **non requise.** Elle n'expose que v1, v1mc, v3, v4, v5 : elle ne fournit **pas** de v7, contrairement à ce que son préfixe `uuid_generate_` laisse croire |
| `pgcrypto` | `gen_random_uuid()` | **non requise** depuis PostgreSQL 13, où la fonction est dans le noyau |
| `pg_stat_statements`, `pg_repack`, toute autre | diagnostic, réécriture de table | **hors périmètre.** Utiles à l'exploitant, jamais supposées présentes ni appelées par le moteur |

La fonction native `uuidv7()` n'apparaît qu'en PostgreSQL 18 : le produit ne s'appuie pas dessus, et ne s'y appuiera pas une fois PostgreSQL 18 répandu, pour la raison donnée au §1.3.

### 1.3 Objets partagés de `_basedb_local`

Conformément à A9, les objets partagés dont dépend le DDL de toutes les tables utilisateur vivent dans `_basedb_local`, dont le nom est figé et non configurable. **Leur corps de référence est donné par le chapitre 02** ; le moteur les référence, ne les crée jamais et ne les redéfinit nulle part.

| Objet | Rôle | Référencé par |
|---|---|---|
| `_basedb_local.uuid_generate_v7()` | valeur par défaut de `_id` | le `CREATE TABLE` de chaque table utilisateur |
| `_basedb_local.set_updated_at()` | tient `_updated_at` et `_updated_by`, y compris sur une écriture SQL directe | les déclencheurs posés sur chaque table utilisateur, dont le chapitre 07 — Historique des données et des structures est normatif (A10) |
| `_basedb_local.fold_v1()` | normalisation des index d'expression | chapitre 04 — Types de champs et projection vers PostgreSQL, qui en fixe le corps |
| `_basedb_local.capture_v1()` | capture par déclencheur vers les tampons | chapitre 07, normatif sur son corps |

Deux conséquences pour ce chapitre :

1. **La rejouabilité (§4.6) est définie relativement à eux** : « rejouer les `up_sql` d'une base reconstruit sa structure » suppose une base d'accueil où les migrations de catalogue ont déjà été appliquées. Un rejeu dans une base absolument vierge échouerait sur le premier `CREATE TABLE`, et ce n'est pas un défaut : c'est le même prérequis que l'existence de `_basedb`.
2. **Leur absence ou leur divergence est une dérive** (`DDL-BOOT`, §11.2), constatée au démarrage avant l'ouverture du service, pas découverte à la première création de table.

*Alternative rejetée* : `DEFAULT gen_random_uuid()`, natif et sans objet partagé. Un UUID v4 n'est pas ordonné temporellement : il fragmente l'index de clé primaire à l'insertion et retire à `ORDER BY "_id"` toute signification chronologique, alors que la pagination par curseur du chapitre 08 — API REST, OpenAPI, webhooks, jetons d'intégration s'appuie dessus. *Alternative également rejetée* : appeler `uuidv7()` quand le serveur est en 18 et notre fonction sinon — le SQL émis dépendrait alors de la version du serveur, ce qui détruit la rejouabilité (§4.6) pour un gain nul.

### 1.4 Paramètres d'instance vérifiés au démarrage

Le rôle ne peut pas les modifier ; il peut les lire, les documenter et refuser de faire semblant.

| Paramètre | Contrôle | Comportement |
|---|---|---|
| `server_version_num` | ≥ 160000 | refus de démarrer, `POSTGRES_VERSION_TOO_OLD` |
| `max_locks_per_transaction` | ≥ 128 recommandé | avertissement journalisé sous ce seuil, avec le calcul : un plan borné à 10 relations (§3.3) verrouille table, index et table TOAST, soit environ 40 entrées ; le défaut de 64 tient, mais sans marge pour une purge et le trafic simultané |
| `max_wal_size`, slots de réplication | lus et journalisés | une construction d'index ou une recopie sur 10 M de lignes produit plusieurs gigaoctets de WAL ; c'est un prérequis d'exploitation (§13.3), pas un réglage que le moteur peut poser |
| `TimeZone`, `DateStyle`, `standard_conforming_strings`, `search_path` | imposés dans le paquet de démarrage des connexions | chapitre 01 §10.3 ; une connexion non conforme est détruite, pas utilisée |

---

## 2. De l'intention au plan

### 2.1 Les étapes d'une opération de structure

Une opération traverse toujours la même suite. Les étapes 1 à 6 ne touchent à rien ; l'étape 7 lit ; seules les étapes 8 et suivantes écrivent.

1. **Réception de l'intention.** Une structure typée (créer une table, ajouter un champ, changer un `ON DELETE`…), jamais du SQL. L'origine est `ui`, `rest`, `mcp` ou `system`. L'appelant fournit une clé d'idempotence (`_basedb.idempotency_key`).
2. **Autorisation.** Permission de gestion de schéma sur la portée concernée (chapitre 05). Un refus renvoie une absence, jamais une erreur qui révèle l'existence de l'objet.
3. **Contrôle d'état de la base.** `base.structure_state = 'frozen'` → `BASE_STRUCTURE_FROZEN` (409) ; migration inachevée sur cette base → `MIGRATION_IN_PROGRESS` (409). Ce contrôle est refait **sous le bail** à l'étape 8 : ici il sert à répondre vite, là il sert à décider.
4. **Validation sémantique.** Libellés, compatibilité des paramètres de type, cible d'un lien dans la même base, matrice de conversion du chapitre 04, refus croisés (§9.7). Toute erreur est rendue avant toute écriture.
5. **Résolution des noms.** Slugification, puis allocation au registre de **tous** les noms, y compris dérivés (§6.1).
6. **Planification.** Graphe de dépendances, tri topologique en deux phases (§3.1), découpage en étapes, vérification des invariants I-DDL-5 et I-DDL-6 et des bornes (§3.3), production du `up_sql` canonique, du `down_sql` et du `catalog_diff`.
7. **Contrôles de données.** En lecture seule, sur le pool `donnees` : valeurs orphelines, `NULL` avant un passage en obligatoire, doublons avant une unicité, valeurs non convertibles. Un contrôle en échec arrête l'opération **avant toute écriture**, avec les lignes fautives.
8. **Ouverture du journal.** Sur le pool `catalogue`, dans sa propre transaction : prise du bail de structure de la base, allocation de `sequence`, écriture de la ligne `_basedb.migration` en `applying` avec `catalog_diff`, `up_sql`, `down_sql`, `checksum`, `planner_version` et la clé d'idempotence. Une opération directe naît en `applying` ; une proposition MCP naît `proposed` et passe par `approved` (§12).
9. **Exécution des étapes.** Chacune dans sa propre transaction sur le pool `ddl` (ou hors transaction pour les étapes concurrentes), précédée et suivie d'une écriture de journal sur le pool `catalogue`. Chaque étape est idempotente et reprenable ; `migration.step` dit où reprendre.
10. **Clôture.** Dernière étape : bascule des `definition_state` de `pending` à `active`, `base.catalog_version = catalog_version + 1`, `NOTIFY basedb_catalog`, entrée d'audit, événement de domaine. Puis, sur le pool `catalogue` : `migration.status = 'applied'`, bail relâché.

L'émission de webhooks n'appartient pas au moteur : l'étape 10 écrit un événement de domaine, la livraison est faite ailleurs (chapitres 08 et 10).

**Atomicité vue du consommateur.** L'exigence « DDL et catalogue ensemble » est tenue **étape par étape** (I-DDL-2), et complétée par `definition_state = 'pending'` : une base, une table ou un champ créé par un plan est invisible du cache de schéma, de l'API, de l'interface, de la documentation générée et du MCP jusqu'à la bascule finale. Un plan interrompu ne laisse jamais un champ à moitié utilisable ; il laisse un champ qui n'existe pour personne, sauf pour l'écran d'administration des migrations.

*Alternative rejetée* : une transaction unique pour tout le DDL d'une opération. Elle est séduisante sur le papier et fausse en production — elle interdit `CREATE INDEX CONCURRENTLY`, elle rend `NOT VALID`/`VALIDATE` inutile puisque les verrous ne tombent qu'au `COMMIT`, et elle transforme toute opération sur une grosse table en indisponibilité complète.

### 2.2 Classes d'étapes

| Classe | Transaction | Verrou typique | `statement_timeout` | Reprise |
|---|---|---|---|---|
| **Contrôle** (anti-jointure, comptage, estimation) | `READ ONLY`, pool `donnees` | aucun | 30 s | rejouable, sans effet |
| **Pose** (`ADD COLUMN`, `RENAME`, `DROP CONSTRAINT`, `ADD CONSTRAINT … NOT VALID`, `SET NOT NULL` adossé, `DROP NOT NULL`, `DROP EXPRESSION`, `COMMENT ON`) | propre transaction, pool `ddl` | `ACCESS EXCLUSIVE` bref, ou `SHARE ROW EXCLUSIVE` bref pour une FK | 5 s | rejouable après contrôle d'existence dans `pg_catalog` |
| **Parcours** (`VALIDATE CONSTRAINT`) | propre transaction, pool `ddl` | `SHARE UPDATE EXCLUSIVE` | 300 s | rejouable : `VALIDATE` sur une contrainte valide est sans effet |
| **Concurrente** (`CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`) | **aucune**, connexion dédiée hors pool | `SHARE UPDATE EXCLUSIVE` | dérivé de la taille (§13.2) | séquence imposée du chapitre 10 |
| **Recopie** (`UPDATE` de conversion, par lots bornés) | une transaction par lot, pool `ddl` | `ROW EXCLUSIVE` | 30 s par lot | rejouable : l'expression de recopie est totale et déterministe (§8) |
| **Catalogue** (bascule `pending → active`, états physiques, `catalog_version`) | fusionnée avec l'étape qui la justifie | — | 5 s | conditionnelle, idempotente |

Les délais sont posés par `SET LOCAL` dans la transaction de l'étape, ou par le paquet de démarrage d'une connexion dédiée pour une étape concurrente (I-DDL-6). Le réglage du pool n'est qu'un plafond de sécurité.

### 2.3 Exclusivité de structure par base, bail et reprise

Un plan dure plusieurs transactions ; un verrou de transaction ne peut donc pas le protéger de bout en bout. L'exclusion est portée par **une ligne de catalogue**, pas par l'absence d'un verrou : `base.current_migration_id` désigne la migration qui occupe la base, et `migration.executor_id`, `migration.lease_until`, `migration.attempts` et `migration.step` portent le bail et le point de reprise (chapitre 02). L'index unique partiel `uq_migration_running` en est le doublage déclaratif : une seule migration `applying` par base, quoi que fasse le service.

Règles, sans exception :

1. **Prise du bail** (étape 8), sur le pool `catalogue`, en un seul `UPDATE _basedb.base SET current_migration_id = $1 WHERE id = $2 AND current_migration_id IS NULL`. Échec → `MIGRATION_IN_PROGRESS` (409) avec l'identifiant, le libellé, l'auteur et l'horodatage de l'opération en cours.
2. **`current_migration_id` n'est libéré qu'à un état terminal** (`applied`, `failed`). Une migration `interrupted` **garde le bail** : tant qu'un plan inachevé traîne sur une base, aucune autre opération de structure n'y est acceptée. C'est ce qui garantit que `sequence` est l'ordre réel d'application (§4.4).
3. **`lease_until` est rafraîchi avant chaque étape** (durée : deux fois le budget d'étape). Il n'autorise pas une autre migration à démarrer ; il autorise **un autre exécuteur à reprendre la même migration**, ce qui est le cas du redémarrage d'instance.
4. **La reprise** relit la ligne en `SELECT … FOR UPDATE`, vérifie `lease_until < now()`, tente `pg_try_advisory_xact_lock(3, <base.lock_key>)` (§5.1) — s'il n'est pas obtenu, une étape est vivante, on passe son tour — puis s'attribue le bail par `UPDATE … WHERE executor_id = <celui constaté>` en incrémentant `attempts`. Toute écriture ultérieure de cet exécuteur porte la même condition : un exécuteur qui s'est réveillé entre-temps ne peut pas être écrasé.
5. **Un exécuteur qui perd son bail abandonne proprement** : avant chaque étape, il relit son `executor_id` ; s'il a changé, il n'émet rien et s'arrête.

Ce dispositif remplace toute tentative de déduire l'état d'un plan de la présence ou de l'absence d'un verrou. « Le verrou est libre » ne prouve pas que la transaction est morte — il peut n'avoir pas encore été pris ; « le verrou est tenu » ne prouve pas que quelqu'un travaille — une coupure réseau laisse un backend vivant plus de deux heures avec les réglages TCP par défaut. Les deux raisonnements sont faux, et c'est la ligne de bail qui tranche. En complément, les connexions du pool `ddl` portent `keepalives_idle=30`, `keepalives_interval=10`, `keepalives_count=3`, et le chien de garde de la connexion de contrôle (chapitre 10) annule puis termine un backend DDL au-delà du budget.

### 2.4 Ce qui n'est jamais dans une transaction d'étape

| Opération | Raison | Traitement |
|---|---|---|
| `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`, `REINDEX CONCURRENTLY` | interdits en bloc transactionnel | étape concurrente, connexion dédiée |
| `VACUUM`, `VACUUM FULL`, `ANALYZE` explicite | interdits en bloc transactionnel | **jamais émis par le moteur.** L'autovacuum fait son travail ; une réécriture d'espace est une décision d'exploitation (§13.4) |
| `CREATE DATABASE`, `CREATE TABLESPACE`, `CREATE ROLE`, `ALTER SYSTEM` | privilèges d'instance | hors périmètre absolu |
| Appel HTTP, envoi de webhook | irréversible | événement de domaine écrit dans l'étape, livraison en dehors |
| Écriture du journal de migration | une transaction abandonnée rend `25P02` : on ne peut pas y écrire son propre échec | pool `catalogue`, transactions propres, avant et après chaque étape |

### 2.5 La règle d'or des verrous

> **Une transaction ne mélange jamais un énoncé qui prend `ACCESS EXCLUSIVE` et un énoncé qui parcourt la table.**

PostgreSQL conserve tout verrou de table jusqu'au `COMMIT`. Trois conséquences que le planificateur vérifie mécaniquement sur le plan, avant émission, et qui lèvent l'incident `PLAN_LOCK_CONFLICT` en cas de violation :

- `ADD CONSTRAINT … CHECK … NOT VALID` prend un `ACCESS EXCLUSIVE` — la réduction de niveau ne concerne que `ADD FOREIGN KEY`. Le `VALIDATE` qui suit ne peut donc pas être dans la même transaction, sinon le parcours s'exécute sous `ACCESS EXCLUSIVE` et bloque lectures **et** écritures.
- `DROP CONSTRAINT` d'une clé étrangère prend un `ACCESS EXCLUSIVE` sur la table source **et** sur la table cible. Enchaîné avec un `VALIDATE` dans la même transaction, il gèle la table cible — typiquement `clients`, la plus sollicitée de la base — pendant tout le parcours.
- Une sous-commande `ALTER TABLE` à verrou élevé regroupée avec une sous-commande à verrou réduit **élève l'ensemble** : `ADD COLUMN` et `ADD CONSTRAINT … FOREIGN KEY … NOT VALID` ne sont jamais fusionnés.

**Regroupement autorisé, et recommandé.** Les sous-commandes visant la même relation, de la même classe de verrou et sans parcours, sont fusionnées en un seul `ALTER TABLE` : créer une table avec dix champs, ou ajouter trois champs en une intention, ne prend le verrou qu'une fois au lieu de trois. L'ordre des sous-commandes est celui du tri déterministe (§3.2).

---

## 3. Ordre, déterminisme, bornes du plan

### 3.1 Tri topologique en deux phases

Un plan peut contenir plusieurs créations simultanées : import d'un modèle, proposition MCP portant sur plusieurs tables, création d'une table avec ses liens. Le graphe orienté a pour nœuds les objets à créer et pour arêtes les dépendances : colonne → table porteuse, index → colonne, `CHECK` → colonne, désignation d'affichage → champ, contrainte FK → table cible **et** colonne source, vue SQL d'alias → relation cible (§10).

- **Phase 1 — structures.** Tri de Kahn sur le graphe **privé des arêtes de clé étrangère** : schémas, tables, colonnes, `CHECK`, déclencheurs, commentaires. Ce graphe est acyclique par nature.
- **Phase 2 — intégrité référentielle.** Tous les `ADD CONSTRAINT … FOREIGN KEY` et les index qui les servent, émis après la phase 1, lorsque toutes les tables cibles existent.

La règle « la table cible existe avant la contrainte » est ainsi satisfaite sans raisonnement conditionnel, et **un cycle entre tables n'est jamais une erreur** : les arêtes qui le formaient ne sont pas dans le graphe trié. *Alternative rejetée* : trier en incluant les FK et refuser les cycles, ce qui interdirait un modèle légitime et fréquent (une commande désigne sa ligne principale, une ligne appartient à sa commande).

Le détecteur de cycle reste actif sur la phase 1 : un reliquat non vide y signale un **défaut du planificateur**, pas une saisie utilisateur, et lève `PLAN_CYCLIC`, code d'incident.

### 3.2 Déterminisme

À rang topologique égal, les nœuds sont ordonnés par nature — schéma, table, colonne, `CHECK`, index, contrainte, déclencheur, commentaire — puis par nom physique en ordre lexicographique d'octets (les noms sont ASCII, la comparaison est binaire). Deux planifications de la même intention, sur le même état de catalogue et avec le même `planner_version`, produisent le **même** `up_sql`, donc le même `checksum`. C'est ce qui rend vérifiable l'approbation d'une migration proposée (§12) et ce qui donne un sens aux instantanés de SQL du harnais de test (chapitre 10).

Le déterminisme impose que le SQL ne dépende d'aucun état extérieur : aucune fonction de temps dans un nom, la date des noms `zz_supprime_` étant matérialisée dans `up_sql` **après** allocation ; aucun `TimeZone`, `DateStyle` ni `search_path` de session dans le sens d'une expression (§6.2).

### 3.3 Bornes d'un plan

| Borne | Valeur v1 | Vérifiée | Code |
|---|---|---|---|
| Relations existantes touchées par un plan | 10 | planification | `MIGRATION_TOO_LARGE` |
| Objets créés par un plan | 200 | planification | `MIGRATION_TOO_LARGE` |
| Budget total d'un plan | 900 s | chien de garde | `TIMEOUT_EXCEEDED` |
| Tables par base | 500 | planification | `TOO_MANY_TABLES` |

Le **budget d'attributs d'une table** — seuil d'alerte, plafond de refus et code associé — est celui du chapitre 04, qui décrit l'empreinte physique d'un champ et la consommation d'un numéro d'attribut à chaque conversion. Le planificateur le vérifie, il ne le fixe pas.

Ces bornes ne sont pas décoratives : elles évitent une panne que PostgreSQL rend incompréhensible. **La table de verrous partagée** est dimensionnée pour toute l'instance : purger une base de 500 tables en une transaction accumule 500 verrous `ACCESS EXCLUSIVE` de table, plus ceux des index et des tables TOAST — de l'ordre de 2 000 entrées, là où le défaut (`max_locks_per_transaction` × (`max_connections` + `max_prepared_transactions`)) en offre 6 400. L'échec `53200 out of shared memory` ne frappe alors pas que la purge : il frappe toute session qui demande un verrou pendant ce temps. Une purge de base est donc **une suite de migrations séquencées**, chacune bornée, chacune reprenable, chacune interruptible.

---

## 4. La migration : identité, contenu, ordre, rejouabilité

Le DDL de `_basedb.migration`, ses colonnes de bail, de planification et de diagnostic, son vocabulaire d'états et ses contraintes sont donnés par le chapitre 02 (A12). Le présent chapitre en décrit l'usage.

### 4.1 L'intention et le SQL, tous les deux

`catalog_diff` porte l'intention structurée ; `up_sql` et `down_sql` portent le SQL matérialisé. Ce n'est pas une indécision, c'est une répartition des rôles :

- **l'intention fait foi à la revue** — l'écran d'approbation et le serveur MCP présentent un diff lisible, jamais un bloc SQL ;
- **le SQL fait foi à l'application et au rejeu** — régénérer le SQL depuis l'intention avec une version ultérieure du planificateur produirait un SQL différent, donc une structure potentiellement différente. Une migration appliquée est un fait figé.

### 4.2 Forme canonique de `up_sql`

`up_sql` n'est **pas** un bloc de texte : c'est un tableau ordonné d'énoncés en `jsonb`, où chaque entrée porte son rang, son étape, sa classe et son caractère transactionnel. Les clés sont en anglais, comme tout identifiant système (A2).

```json
[
  {"n": 1, "step": 3, "class": "pose", "transactional": true,
   "sql": "ALTER TABLE \"b_t4z56fq_crm\".\"factures\" ADD COLUMN \"clients_id\" uuid NULL"},
  {"n": 2, "step": 4, "class": "concurrent", "transactional": false,
   "sql": "CREATE INDEX CONCURRENTLY \"ix_factures__clients_id\" ON \"b_t4z56fq_crm\".\"factures\" (\"clients_id\")"},
  {"n": 3, "step": 5, "class": "pose", "transactional": true,
   "sql": "ALTER TABLE \"b_t4z56fq_crm\".\"factures\" ADD CONSTRAINT \"fk_factures__clients_id\" FOREIGN KEY (\"clients_id\") REFERENCES \"b_t4z56fq_crm\".\"clients\" (\"_id\") ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID"},
  {"n": 4, "step": 6, "class": "scan", "transactional": true,
   "sql": "ALTER TABLE \"b_t4z56fq_crm\".\"factures\" VALIDATE CONSTRAINT \"fk_factures__clients_id\""}
]
```

Sans cette forme, la rejouabilité serait une promesse invérifiable : un rejeu qui enveloppe le tout dans une transaction — réflexe naturel — échoue en `25001` sur le premier `CREATE INDEX CONCURRENTLY`, et un `up_sql` qui omettrait les énoncés concurrents ne reconstruirait ni les index ni les contraintes validées.

### 4.3 `checksum`

SHA-256 de la concaténation du `catalog_diff` sous forme canonique (clés triées, sans espaces superflus) et du `up_sql` sous la même forme. Vérifié avant toute application d'une proposition (§12). Une divergence est un incident, `MIGRATION_TAMPERED`, jamais une invitation à appliquer quand même.

### 4.4 `sequence`

Strictement croissant par base, **nullable** tant que la migration n'est pas entrée en exécution — une proposition MCP n'a pas de rang, l'ordre n'existe qu'à l'application, et `ck_migration_sequence` le rend structurel. Le rang est alloué par `coalesce(max(sequence), 0) + 1` dans la **transaction du journal qui prend le bail** (§2.3), sous le verrou de classe `structure_step`. Comme le bail interdit qu'une seconde migration démarre sur la même base tant que la première n'est pas terminale, `sequence` est par construction l'ordre réel d'application, et pas celui de la demande.

Une migration `failed` consomme son rang : c'est un trou assumé, visible à l'audit, et c'est préférable à une renumérotation qui rendrait les journaux inintelligibles.

### 4.5 Idempotence

Elle ne porte **pas** sur `up_sql` : le DDL n'est pas idempotent, et le moteur n'émet jamais `IF NOT EXISTS`, qui masquerait précisément les dérives qu'on cherche à voir. Elle porte sur **l'opération identifiée par sa clé d'idempotence** : la resoumettre rend le résultat de la première si elle est terminée, `MIGRATION_IN_PROGRESS` sinon. C'est ce qui protège du scénario banal — le mandataire HTTP coupe à 15 secondes, l'utilisateur reclique — qui produirait sinon `clients` et `clients_2`.

Au niveau de l'étape, l'idempotence est obtenue autrement : chaque étape de pose est précédée d'un contrôle d'existence dans `pg_catalog`, chaque `VALIDATE` est sans effet sur une contrainte valide, chaque étape de recopie est rejouable, chaque étape concurrente suit la séquence de reprise du chapitre 10.

### 4.6 Rejouabilité

> Appliquer, dans l'ordre de `sequence`, les `up_sql` des migrations `applied` d'une base, sur une base d'accueil où les migrations de catalogue ont été appliquées et où le schéma de la base n'existe pas, reconstruit **exactement la structure physique courante**.

Ce n'est pas une reprise après sinistre — la restauration se fait par sauvegarde PostgreSQL — c'est la propriété qui rend une base **reproductible en environnement de test** et qui justifie qu'un nom retiré ne soit jamais réattribué (chapitre 01 §6.3). Elle impose que les lignes `migration` ne soient jamais purgées (§13.5).

Deux précisions. Le rejeu exécute les blocs transactionnels dans une transaction et les énoncés `"transactional": false` en dehors, dans l'ordre. Et, sur une base neuve sans concurrence, le rejeu **peut** substituer `CREATE INDEX` à `CREATE INDEX CONCURRENTLY` : la propriété porte sur la structure obtenue, pas sur le texte exécuté.

### 4.7 `down_sql`

Écrit seulement lorsque le moteur sait produire l'inverse exact **sans perte** ; `NULL` sinon, et cette nullité vaut « non réversible automatiquement ». Une migration non réversible n'est pas interdite : elle est annoncée comme telle avant confirmation. `down_sql` est un outil de développement et de test, **jamais un bouton d'annulation exposé en production** : il ne restaure pas des données détruites. En production, on corrige par une migration suivante.

### 4.8 Ce qui est écrit quand une étape échoue

Le journal étant hors de la transaction qu'il décrit, l'échec est consigné après le `ROLLBACK`, sur une connexion saine. Sont enregistrés, au minimum :

| Colonne | Contenu |
|---|---|
| `status` | `failed`, ou `interrupted` si la cause est une perte d'exécuteur |
| `error_code` | code fonctionnel de ce chapitre (§15) |
| `pg_sqlstate`, `pg_message`, `pg_detail`, `pg_hint`, `pg_constraint_name` | l'erreur serveur telle quelle, pour l'exploitant, jamais pour l'utilisateur |
| `failed_statement_n`, `failed_statement` | le rang et le texte de l'énoncé fautif dans `up_sql` — sans eux, un `up_sql` de vingt énoncés ne se diagnostique pas |
| `step`, `duration_ms`, `pg_backend_pid` | à quelle étape, en combien de temps, derrière quel backend |
| `error_sample` | jusqu'à 50 entrées, **limitées à la colonne responsable du refus**, collectées avant la tentative, effacées à 30 jours (A24) |

Si l'écriture de l'échec échoue à son tour, la ligne reste `applying` avec un bail expiré : la reprise la traite, et la réconciliation tranche.

---

## 5. Verrous, délais, erreurs de concurrence

### 5.1 Verrous consultatifs

Conformément à A8, les clés sont **entières, attribuées et stockées au catalogue**, jamais `hashtext()`. Les classes et la dérivation de la seconde clé sont celles du registre `_basedb.lock_class` (chapitre 02) ; ce chapitre arrête le moment de l'acquisition, la durée de détention et l'ordre.

- **Classe 3, `structure_step`, seconde clé `base.lock_key`** : acquise en tête de chaque transaction d'étape, avant tout verrou de table, relâchée au `COMMIT` de l'étape. Elle exclut deux exécuteurs sur la même base au niveau de l'étape, là où le bail (§2.3) les exclut au niveau du plan.
- **Classe 2, `name_allocation`, seconde clé = `lock_key` de la portée d'allocation** : la clé réservée `1` pour la portée instance (noms de schéma), `db_schema.lock_key` pour les relations, `table_def.lock_key` pour les champs et les déclencheurs. Elle sérialise la boucle de suffixe du chapitre 01 §6.1 et se prend **toujours avant tout verrou de table**.
- **Ordre d'acquisition** quand plusieurs portées sont en jeu (création ou renommage de base, qui touche la portée instance) : instance, puis base, puis schéma, puis table. Un ordre unique, écrit une fois, supprime la classe entière des interblocages entre migrations.
- **Aucune étape de structure ne prend de verrou consultatif de session.** Un verrou de session pris sur une connexion de pool survit à sa restitution : tout chemin d'erreur qui saute le déverrouillage rend la base inmigrable jusqu'au recyclage de la connexion, pour un diagnostic — une entrée `pg_locks` de type `advisory` sans requête active — que personne ne trouve à trois heures du matin. Les classes en détention de session (`catalog_migration`, `maintenance`, `drain`) n'appartiennent pas au moteur DDL et s'exécutent sur des connexions dédiées hors pool.
- **Traçabilité.** Les deux entiers émis sont lisibles dans `pg_locks` (`locktype = 'advisory'`, `classid` = la classe, `objid` = la `lock_key`, `objsubid = 2` pour la forme à deux entiers) et journalisés avec la ligne `migration`. Aucune collision n'est possible : une séquence unique alimente les `lock_key` des trois tables porteuses.

### 5.2 Écarts de délais par étape

Les valeurs permanentes sont posées dans le paquet de démarrage des connexions (chapitre 01 §10.3, dimensionnement au chapitre 10). Ce tableau donne les seuls **écarts par étape**, posés en `SET LOCAL`, et le motif de chacun.

| Paramètre | Pose / Parcours | Concurrente | Recopie | Motif |
|---|---|---|---|---|
| `lock_timeout` | 3 s | 3 s | 3 s | un `ALTER TABLE` en attente d'`ACCESS EXCLUSIVE` bloque **toutes** les requêtes qui arrivent derrière lui, lectures comprises : PostgreSQL sert la file dans l'ordre. Mieux vaut cent refus `LOCK_UNAVAILABLE` qu'une minute d'indisponibilité |
| `statement_timeout` | 5 s / 300 s | dérivé de la taille, plafond 2 h | 30 s par lot | une pose qui dépasse 5 s est un incident ; un parcours est long par nature ; un lot trop long est un lot trop gros |
| `idle_in_transaction_session_timeout` | 10 s | sans objet | 10 s | aucune pause légitime entre deux énoncés d'une étape ne dépasse quelques centaines de millisecondes |
| `maintenance_work_mem` | — | 256 Mo | — | seul levier de performance réellement disponible pour une construction d'index, et positionnable par un rôle ordinaire |

Deux nuances que le couple `lock_timeout`/`statement_timeout` ne couvre pas, et qu'il ne faut pas croire couvertes :

1. **`lock_timeout` borne l'attente, pas la détention.** Une fois l'`ACCESS EXCLUSIVE` acquis, l'énoncé le garde jusqu'au `COMMIT`. C'est le découpage en étapes courtes qui borne la détention, pas ce réglage.
2. **`CREATE INDEX CONCURRENTLY` et `VALIDATE CONSTRAINT` attendent la fin des transactions concurrentes**, attente sur identifiant de transaction que `lock_timeout` n'encadre pas. Une transaction ouverte depuis une heure sur le pool `donnees` suffit à les faire patienter jusqu'au `statement_timeout`. D'où le contrôle du §5.3 — et le rappel qu'un `VALIDATE` long détient un `SHARE UPDATE EXCLUSIVE` qui **empêche l'autovacuum** de la table pendant toute sa durée, raison pour laquelle le plafond de 2 h est un plafond et non une cible.

Le danger réel vient des transactions **oubliées côté données**, pas côté DDL : l'`idle_in_transaction_session_timeout` du pool `donnees` est ce qui protège les migrations, bien plus que le même réglage côté `ddl`.

### 5.3 Contrôle de faisabilité préalable

Avant une étape de pose sur une table volumineuse et avant toute étape concurrente, le moteur regarde qui travaille :

```sql
SELECT a.pid, a.state, a.xact_start, now() - a.xact_start AS age,
       a.wait_event_type, a.wait_event
FROM pg_stat_activity a
WHERE a.datname = current_database()
  AND a.xact_start IS NOT NULL
  AND now() - a.xact_start > interval '5 minutes';
```

Une transaction ouverte depuis plus de cinq minutes fait **différer** l'étape concurrente — code `STEP_DEFERRED`, `build_attempts` ou `validate_attempts` incrémenté, `next_attempt_at` reculé exponentiellement (1 min, 5, 15, 60, plafond 6 h, arrêt et alerte au bout de 5 échecs) — plutôt que de lancer une construction qui durera des heures en bloquant l'autovacuum. Pour une étape de pose, le même constat est affiché à l'utilisateur **avant** la tentative : « table occupée par la session 4711 depuis 12 minutes » vaut mieux que trois échecs successifs.

Avec un seul rôle, propriétaire de la base et sans superutilisateur, `pg_stat_activity` ne montre `query`, `client_addr` et `application_name` que pour les sessions **du même rôle**. Pour les autres (un DBA en psql, un outil tiers, une réplication logique), `pid`, `state`, `xact_start` et `wait_event_type` restent visibles, le texte de la requête non. Le moteur remonte donc `pg_blocking_pids()` et ces colonnes, et n'affiche le texte que lorsqu'il l'a. L'appartenance à `pg_read_all_stats` est notée comme **prérequis facultatif** à demander à l'administrateur d'instance pour un diagnostic complet ; le moteur n'en dépend pas.

### 5.4 Résolution des erreurs serveur

La traduction des `SQLSTATE` en codes fonctionnels se fait en **un seul endroit**, l'exécuteur de requêtes du noyau, décrit au chapitre 10. Le présent chapitre n'y ajoute que deux choses.

**La résolution par le registre.** Le nom de contrainte, d'index ou de colonne présent dans l'erreur est recherché dans `_basedb.physical_name`, ce qui rend l'objet de catalogue et donc son **libellé**. C'est ce qui referme l'écart signalé au chapitre 01 §9.5 : une table reléguée conserve ses noms dérivés d'origine, et une violation de `pk_factures` sur `zz_supprime_20260918_factures` doit malgré tout nommer « Factures » à l'utilisateur. La vue `_basedb.v_physical_name_qualified` sert les requêtes de diagnostic correspondantes.

**Les `SQLSTATE` propres aux étapes de structure**, que le chemin de données ne rencontre pas :

| SQLSTATE | Origine | Code rendu |
|---|---|---|
| `55P03` | `lock_timeout` | `LOCK_UNAVAILABLE`, avec la table concernée, la durée d'attente et les bloqueurs quand ils sont lisibles |
| `57014` | `statement_timeout` | `TIMEOUT_EXCEEDED`, avec l'étape et la durée écoulée ; structure inchangée |
| `40P01` | interblocage | rejeu automatique de l'étape, puis `TIMEOUT_EXCEEDED` |
| `42P07`, `42701`, `42703`, `42P01` | objet inattendu ou manquant | incident `REGISTRY_DIVERGENT` : la base passe `structure_state = 'frozen'`, sauf le cas de péremption de cache traité au chapitre 10 |
| `53200` | table de verrous saturée | incident, avec le rappel de la borne de plan (§3.3) et du prérequis `max_locks_per_transaction` |
| `25P02` | énoncé émis dans une transaction déjà avortée | incident : défaut du moteur, jamais une condition métier (§6.1) |

---

## 6. Identifiants et littéraux dans le SQL généré

### 6.1 Identifiants

La règle est entièrement posée par le chapitre 01 : alphabets normatifs, quoting systématique, qualification explicite, `search_path` vide, registre unique, répartition de budget pour les noms composites. Le moteur DDL n'y ajoute qu'une obligation, mais elle est absolue :

> **Tout identifiant émis a été alloué au registre avant l'émission, puis relu depuis le catalogue au moment de produire le SQL.** Aucun nom n'est fabriqué par concaténation à l'instant de l'écriture — ni un `ck_…__not_null`, ni un `ix_…`, ni un nom de relégation `zz_supprime_…`.

Sans cette règle, le moteur produirait des noms que PostgreSQL **tronque silencieusement à 63 octets avec un simple `NOTICE`** que les pilotes ignorent : le nom stocké au catalogue divergerait du nom physique dès la première table un peu longue, et deux colonnes longues d'une même base produiraient deux index homonymes après troncature, donc un `42P07` en pleine migration. L'allocation préalable et la répartition de budget suppriment les deux cas.

**Allocation sous conflit.** Une erreur `23505` avorte la transaction en cours : toute instruction suivante reçoit `25P02`, et une boucle de suffixe naïve dans la transaction de l'étape échouerait dès la première collision. L'insertion au registre se fait donc en `INSERT … ON CONFLICT DO NOTHING RETURNING id`, dont le retour vide signale l'indisponibilité sans lever d'erreur et fait passer au suffixe suivant. L'index `uq_physical_name` n'étant pas partiel (A5), l'inférence est directe. À défaut de cette forme, un `SAVEPOINT` par tentative est acceptable ; l'implémentation retenue est la première, pour ne jamais salir une transaction de structure.

### 6.2 Les cinq points d'entrée littéraux

Un énoncé utilitaire n'accepte aucun paramètre lié. Il existe donc exactement cinq endroits où une chaîne d'origine utilisateur entre en littéral dans le DDL, et ils sont traités de la même façon.

| Point d'entrée | Où | Encadrement |
|---|---|---|
| Valeur par défaut d'un champ | `DEFAULT …` | vocabulaire fermé (§7.2) : littéral typé du champ ou mot-clé de la liste close |
| Expression d'une formule | colonne générée, chapitre 04 | grammaire fermée arbitrée par le chapitre 04, validée avant émission |
| Nom de fuseau horaire | `AT TIME ZONE '…'` d'une conversion | validé contre `pg_timezone_names` avant émission ; refus `TIMEZONE_UNKNOWN` |
| Texte d'une description | `COMMENT ON TABLE/COLUMN … IS '…'` | longueur bornée à 1 000 caractères, caractère NUL interdit |
| Valeurs d'options de liste de choix | `CHECK ("x" IN ('…','…'))` | longueur bornée à 200 caractères par option, 200 options, caractère NUL interdit |

Pour tous les cinq, sans exception :

1. **Échappement par une routine unique**, de sémantique identique à `quote_literal` : doublement du guillemet simple, rejet du caractère NUL, `standard_conforming_strings` garanti à `on` par le contrat de connexion — sans quoi un antislash changerait de sens. Une seule routine, utilisée partout, testée une fois.
2. **Validation avant échappement**, pas à la place : un fuseau inconnu, une option trop longue, un défaut hors vocabulaire sont refusés avec un code fonctionnel, jamais assainis en silence.
3. **Jeu de tests nommé, adversarial** : valeurs contenant `'; DROP TABLE …--`, apostrophes simples et doubles, antislashs, caractères multi-octets, NUL, sur les cinq points d'entrée.

C'est la seule défense possible : en DDL, le protocole PostgreSQL n'offre rien d'autre. Le moteur émet ce SQL sur le pool `ddl`, avec le rôle propriétaire de la base : une faille ici n'aurait pas de second rempart.

---

## 7. Catalogue des opérations v1

### 7.1 Tableau de référence

Les verrous sont notés sur la table concernée. « Bref » signifie pris et relâché en quelques millisecondes, **dans une transaction où rien d'autre ne parcourt la table** (I-DDL-5). La colonne « 10 M lignes » décrit le comportement attendu en production.

| Opération | Étapes | DDL émis | Verrou | `down_sql` | 10 M lignes |
|---|---|---|---|---|---|
| Créer une base | 1 | `CREATE SCHEMA` | aucun sur données | `DROP SCHEMA … RESTRICT` | sans objet |
| Créer une table | 1 à 2 | `CREATE TABLE`, déclencheurs, `COMMENT ON` | sur un objet inexistant | `DROP TABLE … RESTRICT` | sans objet |
| Ajouter un champ | 1 | `ALTER TABLE … ADD COLUMN "x" <type> NULL` | `ACCESS EXCLUSIVE` bref | `DROP COLUMN` | instantané (défaut constant uniquement) |
| Renommer un champ (physique) | 1 | `RENAME COLUMN` + `ALTER INDEX/CONSTRAINT … RENAME` | `ACCESS EXCLUSIVE` bref | symétrique | instantané |
| Rendre obligatoire | **3** | `ADD CONSTRAINT … CHECK (x IS NOT NULL) NOT VALID` ▸ `VALIDATE` ▸ `SET NOT NULL` + `DROP CONSTRAINT` | `AE` bref ▸ `SHARE UPDATE EXCLUSIVE` ▸ `AE` bref | `DROP NOT NULL` | écritures non bloquées pendant le parcours |
| Rendre facultatif | 1 | `ALTER COLUMN … DROP NOT NULL` | `ACCESS EXCLUSIVE` bref | `NULL` (les données peuvent avoir divergé) | instantané |
| Ajouter l'unicité | 2 | `CREATE UNIQUE INDEX CONCURRENTLY` ▸ bascule d'état | `SHARE UPDATE EXCLUSIVE` | `DROP INDEX CONCURRENTLY` | écritures non bloquées, deux parcours |
| Retirer l'unicité | 1 | `DROP INDEX CONCURRENTLY` | `SHARE UPDATE EXCLUSIVE` | recréation | instantané |
| Changer les options d'une liste | **3** | `ADD CONSTRAINT … CHECK (…) NOT VALID` ▸ `VALIDATE` ▸ `DROP CONSTRAINT` de l'ancienne | `AE` bref ▸ `SUE` ▸ `AE` bref | symétrique | écritures non bloquées |
| Changer le type | 4 à 6 | `ADD COLUMN` ▸ recopie par lots ▸ contraintes et index du type cible ▸ relégation de l'ancienne colonne | `AE` bref, puis `ROW EXCLUSIVE` par lot | `NULL` | recopie bornée, écritures non bloquées (§8) |
| Créer un champ lien | 4 | `ADD COLUMN uuid` ▸ `CREATE INDEX CONCURRENTLY` ▸ `ADD CONSTRAINT … NOT VALID` ▸ `VALIDATE` | §9.5 | `DROP CONSTRAINT` + `DROP COLUMN` | §9.4 |
| Changer le `ON DELETE` | **3** | `DROP CONSTRAINT` ▸ `ADD CONSTRAINT … NOT VALID` ▸ `VALIDATE` | §9.5 | symétrique | un parcours de validation, écritures libres |
| Supprimer logiquement un champ | 1 à 2 | objets défaits (chapitre 04) puis `RENAME COLUMN` en `zz_supprime_…` | `ACCESS EXCLUSIVE` bref | `RENAME` + recréation `NOT VALID` + `VALIDATE` | instantané |
| Supprimer logiquement une table / une base | 1 | `ALTER TABLE … RENAME TO` / `ALTER SCHEMA … RENAME TO` | `ACCESS EXCLUSIVE` bref | `RENAME` inverse | instantané |
| Purger un champ | 1 | `ALTER TABLE … DROP COLUMN` | `ACCESS EXCLUSIVE` bref | aucun | instantané ; **l'espace n'est pas rendu** (§13.4) |
| Purger une table / une base | 1 à N | `DROP TABLE … RESTRICT` / `DROP SCHEMA … RESTRICT` | `ACCESS EXCLUSIVE` bref | aucun | instantané ; **espace rendu au `COMMIT`** |

### 7.2 Précisions par opération

**Créer une table.** Gabarit émis, qualifié et quoté sans exception (chapitre 01 §10.1) :

```sql
CREATE TABLE "b_t4z56fq_crm"."factures" (
  "_id"         uuid NOT NULL DEFAULT "_basedb_local"."uuid_generate_v7"(),
  "_created_at" timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  "_updated_at" timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  "_created_by" uuid NULL,
  "_updated_by" uuid NULL,
  "numero"      text NULL,
  CONSTRAINT "pk_factures" PRIMARY KEY ("_id")
);
```

Ordre imposé ensuite : les `CHECK` des types, puis les déclencheurs dont le chapitre 07 est normatif, puis les index, puis les clés étrangères (phase 2 du tri, §3.1), puis les `COMMENT ON TABLE` et `COMMENT ON COLUMN`. La clé primaire est nommée explicitement `pk_<table>` : le nom doit être lisible dans un message d'erreur et connu du registre, jamais laissé au nommage automatique de PostgreSQL. Aucune clé étrangère ne traverse la frontière de `_basedb` (A9) : `_created_by` et `_updated_by` ne sont pas contraints.

**Valeurs par défaut.** `DEFAULT` est l'un des cinq points d'entrée littéraux (§6.2), contraint par un **vocabulaire fermé** : littéral du type du champ, `pg_catalog.now()`, `pg_catalog.current_date`, `true`, `false`, `null`. Toute autre expression est refusée (`DEFAULT_NOT_ALLOWED`). Un défaut **volatil** sur une colonne ajoutée est refusé (`DEFAULT_VOLATILE_FORBIDDEN`) : depuis PostgreSQL 11, un défaut constant est enregistré sans réécrire la table, un défaut volatil la réécrit intégralement sous `ACCESS EXCLUSIVE`. Sur dix millions de lignes, la différence est entre une milliseconde et une indisponibilité.

**Rendre un champ obligatoire — trois étapes, trois transactions.** C'est la seule forme qui évite un parcours complet sous `ACCESS EXCLUSIVE`, et elle n'a de sens que découpée (I-DDL-5). L'échafaudage est une ligne ordinaire de `_basedb.table_constraint`, dont le nom est au registre comme tous les autres.

1. `ALTER TABLE … ADD CONSTRAINT "ck_<table>__<colonne>__not_null" CHECK ("x" IS NOT NULL) NOT VALID` — `ACCESS EXCLUSIVE` bref. Catalogue : contrainte en `not_valid`, `field.required_state = 'not_valid'`. Dès ce `COMMIT`, **aucune nouvelle valeur nulle ne peut plus entrer**.
2. `ALTER TABLE … VALIDATE CONSTRAINT "ck_…"` — `SHARE UPDATE EXCLUSIVE`, long, reprenable, idempotent, écritures libres. Catalogue : `validating`.
3. `ALTER TABLE … ALTER COLUMN "x" SET NOT NULL` (instantané depuis PostgreSQL 12 grâce au `CHECK` validé) puis `DROP CONSTRAINT "ck_…"` — `ACCESS EXCLUSIVE` bref. Catalogue : `field.required_state = 'active'`, l'échafaudage passe `dropping` puis `dropped`.

Le contrôle de données préalable liste jusqu'à 50 lignes portant `NULL` ; s'il n'est pas vide, refus `REQUIRED_NULL_VALUES` sans aucun DDL. Pendant les états intermédiaires, l'API et l'interface présentent le champ comme « obligatoire, mise en place en cours » : la divergence est nommée au catalogue, donc permise par I-DDL-2, et bornée dans le temps par la dérive `CAT-STATE` du chapitre 02.

**Unicité.** Décision : **l'unicité d'un champ est obtenue par un index unique construit en `CONCURRENTLY`, pas par `ADD CONSTRAINT … UNIQUE`.** Raison : un index se construit concurremment, une contrainte non. Le nom reste `uq_<table>__<colonnes>` (chapitre 01 §9.1), et la ligne de catalogue est une ligne de `table_constraint` de `kind = 'unique'` portant l'état — l'unicité n'a pas de ligne dans `table_index` (chapitre 02). `nulls_not_distinct` est émis quand le catalogue le déclare. *Alternative rejetée* : `ADD CONSTRAINT … UNIQUE USING INDEX` après construction concurrente — correct, mais ajoute un `ACCESS EXCLUSIVE` pour un bénéfice purement cosmétique dans `\d`.

L'unicité est une propriété **sémantique**, visible de l'API, de l'interface et du MCP : elle n'est annoncée comme acquise qu'en état `active`. En `building`, l'interface affiche « unicité en cours de mise en place » et les doublons restent possibles. Si la construction échoue sur `23505` — cas inévitable : entre le contrôle de données et la fin de la construction concurrente, un doublon peut être inséré —, l'index reste `indisvalid = false` ; la séquence de reprise du chapitre 10 le retire, la ligne passe `invalid` puis `dropped`, la migration est `failed` avec `DUPLICATE_VALUE` et l'échantillon. **Aucune relance automatique** : relancer en boucle sur des doublons légitimes produirait une reconstruction horaire perpétuelle. L'intention de l'utilisateur n'est pas réécrite en base : il la resoumet quand les doublons sont corrigés.

**Changer les options d'une liste de choix.** Geste banal pour l'utilisateur, `ACCESS EXCLUSIVE` avec parcours complet si on l'écrit naïvement. Même motif que pour les FK : `ADD CONSTRAINT "ck_<table>__<colonne>__enum" CHECK ("x" IN (…)) NOT VALID` sous un nouveau nom alloué, puis `VALIDATE` en étape de parcours, puis `DROP CONSTRAINT` de l'ancienne. Le contrôle de données préalable liste les lignes portant une valeur retirée. La conformité du `CHECK` aux options actives est surveillée par la dérive `CAT-CK` du chapitre 02.

**Renommer un champ physiquement.** Le moteur renomme aussi les objets dérivés portant ce nom (`ALTER INDEX … RENAME TO`, `ALTER TABLE … RENAME CONSTRAINT`) et met à jour le registre. Sans cela, les messages d'erreur continueraient de nommer l'ancien champ. Cette règle ne vaut **que** pour le renommage physique d'administration ; lors d'une relégation, les objets dérivés ne sont pas renommés (chapitre 01 §9.5), et c'est la résolution par le registre du §5.4 qui referme l'écart.

**Supprimer logiquement un champ.** La liste des objets à défaire avant le `RENAME COLUMN` est fixée par le chapitre 04, qui décrit l'empreinte physique d'un champ. Ce chapitre n'en arrête que l'exécution : tout ce qui se fait en une transaction est fusionné dans l'étape de relégation, et le retrait de l'index unique passe par une **étape concurrente** (`DROP INDEX CONCURRENTLY`), qui ne peut pas y tenir. L'invariant correspondant : **une colonne `zz_supprime_` ne porte jamais de contrainte susceptible de refuser une écriture**, ce que la dérive `DDL-DEL` vérifie. Restaurer un champ repasse par le contrôle de données complet et la validation, exactement comme une création.

**Purger une base.** Jamais `DROP SCHEMA … CASCADE` (I-DDL-3). Le moteur purge les tables une à une, dans l'ordre topologique inverse, par plans successifs bornés (§3.3), après avoir traité les vues SQL d'alias (§10), puis émet `DROP SCHEMA … RESTRICT`. Un `RESTRICT` qui échoue est une dérive **sauf si une dépendance connue du catalogue l'explique** — une vue d'alias, typiquement : dans ce cas, c'est un défaut de plan, pas une anomalie de base.

---

## 8. Conversions de type : ce que le moteur exécute

Le type d'un champ est **immuable au catalogue** (chapitre 02). Une conversion n'est donc pas un `ALTER COLUMN … TYPE` : c'est une migration ordinaire qui crée un champ du type cible, recopie, puis supprime logiquement l'ancien, `field.superseded_by_field_id` gardant la trace du lien. La **matrice des couples autorisés**, les **expressions de recopie** — totales, adossées à `pg_input_is_valid` — et les **pré-contrôles** appartiennent au chapitre 04 (A11), qui les donne mot pour mot.

Ce que le présent chapitre arrête :

1. **Le nom physique.** La nouvelle colonne reçoit un **nom neuf** alloué au registre ; l'ancien nom suit la colonne reléguée jusqu'à la purge. Un nom n'est jamais réattribué (chapitre 01 §6.3), et `uq_field_name` interdit que deux lignes de catalogue détiennent le même nom : la conversion en place est structurellement impossible, pas simplement déconseillée.
2. **La forme du plan.** Étape de pose (`ADD COLUMN`, `ACCESS EXCLUSIVE` bref), étapes de recopie par lots bornés, étapes de pose et étapes concurrentes pour les contraintes et index du type cible, étape de relégation de l'ancienne colonne. Aucune de ces étapes ne détient de verrou long.
3. **La recopie.** Par lots bornés en `ROW EXCLUSIVE`, 30 s par lot, sur le pool `ddl`, sous le bail de structure. Elle est **rejouable sans état supplémentaire** : l'expression de recopie est totale et déterministe, réécrire une ligne déjà convertie produit la même valeur. Une reprise reprend la recopie depuis le premier lot ; c'est du temps perdu, jamais un résultat faux.

**Aucune réécriture de table n'est jamais émise.** C'est le bénéfice direct du chemin de recopie : un `ALTER COLUMN … TYPE` détient un `ACCESS EXCLUSIVE` pendant toute sa durée, reconstruit **tous** les index de la table, revalide les contraintes qui la référencent et exige que les deux versions coexistent jusqu'au `COMMIT`. Le chemin de recopie coûte à la place un numéro d'attribut — dont le budget est celui du chapitre 04 — et la taille de la seule colonne recopiée, et il est borné et reprenable à chaque lot. Le moteur ne peut d'ailleurs **pas mesurer l'espace disque libre** : les fonctions qui le permettraient sont réservées au superutilisateur. L'écran de confirmation affiche le besoin, il ne prétend pas vérifier la capacité.

---

## 9. Relations

### 9.1 Ordre, cycles, auto-référence

L'ordre est réglé par le tri en deux phases (§3.1) : la table cible existe avant la contrainte, par construction du plan et non par un raisonnement conditionnel.

**Auto-référence.** Une table qui se référence elle-même (`manager_id` vers `employes`) est un cas nominal, entièrement couvert par la phase 2. Cinq points d'attention :

1. `ADD CONSTRAINT` prend ses deux verrous sur la **même** table : aucune contention supplémentaire, mais aucun gain non plus.
2. Un `ON DELETE CASCADE` auto-référentiel cascade sur toute la descendance, PostgreSQL s'en chargeant (A14). L'écran de confirmation admin doit le dire en toutes lettres et afficher la profondeur observée.
3. Un `ON DELETE SET NULL` auto-référentiel détache les enfants au lieu de les supprimer : c'est généralement l'intention, et c'est le défaut proposé pour ce cas.
4. Le lien inverse de la vue détail liste la table elle-même ; l'interface doit gérer source = cible.
5. Le moteur **ne détecte pas les cycles de données** (un employé son propre manager, ou une boucle de trois). PostgreSQL ne l'empêche pas, une contrainte d'exclusion coûterait plus que le problème ne vaut : hors périmètre v1, dit explicitement dans l'aide du champ.

**Les estimations affichées sont bornées par construction.** Puisque le moteur reconnaît ne pas empêcher les cycles de données, toute requête récursive lancée depuis un écran de confirmation doit être bornée, sans quoi un écran d'avertissement devient lui-même une source d'incident, en heure de pointe, répétable à volonté d'un clic : `WITH RECURSIVE … WHERE depth < 20`, `statement_timeout` local de 2 s, sur le pool `donnees`. L'interface affiche « au moins 20 » quand la borne est atteinte, « estimation interrompue » au dépassement du délai. Même traitement pour le décompte des lignes qui seraient supprimées par une cascade : échantillon borné, jamais un comptage exact.

**Lien inter-bases : interdit** (`LINK_CROSS_DATABASE`), décision et motifs au chapitre 01 §9.3.

### 9.2 Refus de supprimer une table encore référencée

**L'information vient du catalogue, jamais de l'introspection.** Trois raisons : la décision doit être évaluable dans la transaction qui écrit le catalogue, sur des lignes qu'elle verrouille ; elle doit nommer des **libellés**, que `pg_catalog` ignore ; et elle doit être vraie pour les liens dont la clé étrangère n'est pas encore validée. L'introspection sert au contrôle de dérive (§11), pas à la décision.

Le refus est porté **deux fois** : par le service, avant toute écriture, pour produire un message riche ; et par le catalogue lui-même, de façon déclarative, même si le service est contourné — `ck_link_target_live` pour la suppression logique, `fk_link_target` en `ON DELETE RESTRICT` pour l'épuration (chapitre 02). La charge utile et le message, eux, sont fixés ici.

```json
{
  "error": {
    "code": "TABLE_REFERENCED",
    "message": "La table « Clients » ne peut pas être supprimée : 2 champs d'autres tables la référencent.",
    "details": {
      "target_table": { "id": "0192…", "label": "Clients", "name": "clients" },
      "referencing_count": 2,
      "referencing": [
        { "source_table_label": "Factures", "source_table_name": "factures",
          "field_label": "Client", "field_name": "clients_id", "on_delete": "restrict" },
        { "source_table_label": "Contrats", "source_table_name": "contrats",
          "field_label": "Souscripteur", "field_name": "souscripteur_id", "on_delete": "set_null" }
      ],
      "resolution": "Supprimez d'abord ces champs lien, ou modifiez leur table cible."
    }
  }
}
```

Sont nommés pour chaque référence : le libellé **et** le nom physique de la table source, le libellé **et** le nom physique du champ, et le comportement `ON DELETE`. La liste est bornée à 20 entrées, `referencing_count` donne le total. Elle est alimentée par la requête des liens inverses du chapitre 02 et filtrée par les permissions du demandeur (chapitre 05) : une table source qu'il n'a pas le droit de lire apparaît en `{"hidden": true}`, sans libellé, et compte dans le total — l'existence d'un blocage ne doit pas divulguer le nom d'un objet interdit, mais elle ne peut pas être cachée sans rendre le refus incompréhensible.

**Le refus s'applique à la suppression logique autant qu'à la purge.** La suppression logique d'une table est un `ALTER TABLE … RENAME TO "zz_supprime_…"` : PostgreSQL suit l'OID, **la contrainte de clé étrangère survit intacte au renommage et continue de s'appliquer**. Autoriser la suppression logique d'une table référencée ferait recevoir à l'utilisateur, plus tard, des refus provenant d'une table qu'il croit disparue, une insertion dans `factures` échouant au nom d'un objet invisible dans toute l'interface.

La symétrie est ce qui rend la règle utilisable : la suppression logique d'un **champ lien**, elle, retire la contrainte (A17, §9.8). La séquence utilisateur est donc toujours : supprimer les champs lien pointant vers la table, puis supprimer la table. L'interface propose cet enchaînement en un clic, comme une migration unique contenant les deux étapes — l'utilisateur voit la liste avant confirmation.

### 9.3 Compatibilité de type entre colonne source et clé cible

Elle n'est pas vérifiée, elle est **rendue impossible**. Le type lien impose `uuid`, et `_id` est `uuid` sur toutes les tables. Sa préservation dans le temps repose sur trois interdits :

1. **La colonne d'un champ lien ne change pas de type** tant que la contrainte existe : convertir un lien suppose de le supprimer d'abord.
2. **`_id` n'est pas un champ de catalogue** : aucune opération de structure ne peut le viser, et aucune écriture ne peut le modifier (`ID_IMMUTABLE`).
3. **Une clé étrangère ne peut cibler que `_id`.** Pas de clé étrangère vers une colonne unique arbitraire en v1, même indexée. *Raison* : cela ouvrirait l'espace des types (`text`, `numeric`), donc les questions de collation et d'`opclass`, et la cible pourrait perdre son unicité par une opération ultérieure. Code `LINK_TARGET_UNSUPPORTED`.

Également interdits : clé étrangère composite, `ON UPDATE` autre que `NO ACTION` (A13 : `_id` est immuable, la clause n'aurait aucun sens), `MATCH PARTIAL`.

### 9.4 Poser une clé étrangère : les cas réels

À la **création** d'un champ lien, la colonne source est créée par le plan lui-même : elle est vide, aucune valeur orpheline n'est possible, et le contrôle de données est sans objet. Les cas où des données préexistent sont au nombre de trois :

| Cas | Des orphelines sont-elles possibles ? | Traitement |
|---|---|---|
| **Restaurer un champ lien supprimé logiquement** | **oui** — pendant l'absence de la contrainte, des lignes cibles ont pu être supprimées | contrôle complet obligatoire, sur la colonne reléguée |
| **Changer le `ON DELETE`** (§9.7) | non, les données satisfont déjà la contrainte | pas de contrôle, mais le parcours de validation coûte |
| **Convertir un champ existant en lien**, si la matrice du chapitre 04 l'autorise | **oui** | contrôle complet obligatoire sur la colonne recopiée, avant la pose |

Le choix de la procédure repose ensuite sur la **volumétrie**, pas sur l'existence de données : même sur une colonne neuve et vide, une contrainte validante parcourt la table et détient `SHARE ROW EXCLUSIVE` sur la source **et sur la cible** pendant tout le parcours.

> **Règle de seuil, écrite en sûreté.** Le chemin simple — `ADD CONSTRAINT` validante directement — n'est choisi que si `reltuples >= 0 AND reltuples < 100 000 AND pg_relation_size(<source>) < 128 Mo`. Dans tous les autres cas, chemin prudent.

La condition `reltuples >= 0` n'est pas une coquetterie : depuis PostgreSQL 14, `reltuples` vaut **−1** pour une relation jamais analysée, et −1 < 100 000. Une table chargée par import massif puis enrichie d'un champ lien avant le passage de l'autovacuum prendrait sinon le chemin « petite table » et immobiliserait deux tables pendant dix millions de lignes. Le second signal, `pg_relation_size`, ne dépend d'aucun `ANALYZE`.

**Chemin prudent, en trois temps.**

*Temps 1 — contrôle de données*, en lecture seule sur le pool `donnees`, avant toute écriture, sans `ORDER BY` :

```sql
SELECT s."_id" AS row_id, s."clients_id" AS value
FROM "b_t4z56fq_crm"."factures" s
LEFT JOIN "b_t4z56fq_crm"."clients" c ON c."_id" = s."clients_id"
WHERE s."clients_id" IS NOT NULL AND c."_id" IS NULL
LIMIT 51;
```

`LIMIT 51` distingue « exactement 50 » de « plus de 50 ». L'absence d'`ORDER BY` est délibérée : trier imposerait un parcours de l'index de clé primaire avec une sonde par ligne, soit dix millions de sondes dans le cas le plus fréquent — celui où il n'y a **aucune** orpheline — là où une anti-jointure par hachage suffit. L'ordre des 50 lignes rapportées n'a aucune valeur ; l'interface trie si elle en a besoin. Un second passage compte les fautives avec un plafond (`SELECT count(*) FROM (… LIMIT 10001) z`) pour annoncer « 137 » ou « plus de 10 000 » sans parcourir inutilement.

Ce contrôle est borné par son propre `statement_timeout` (30 s, classe « contrôle »). **Son dépassement n'arrête pas l'opération sur le chemin prudent** : il est un confort, pas une garantie, puisque `NOT VALID` puis `VALIDATE` échouent déjà proprement. Le plan continue, et l'échantillon est produit après l'échec du `VALIDATE`.

Échec du contrôle → migration `failed`, `error_code = 'LINK_ORPHAN_VALUES'`, `error_sample` renseigné, **aucun DDL émis** :

```json
{
  "error": {
    "code": "LINK_ORPHAN_VALUES",
    "message": "Le champ « Client » ne peut pas être rétabli : 137 lignes de « Factures » portent une valeur absente de « Clients ».",
    "details": {
      "source_table": "factures", "source_column": "clients_id",
      "target_table": "clients", "target_key": "_id",
      "invalid_row_count": 137, "count_is_exact": true, "sample_limit": 50,
      "rows": [ { "_id": "0192a3…", "value": "0191ff…" } ]
    }
  }
}
```

Jamais un message PostgreSQL brut, jamais un 500. La valeur d'affichage de la ligne fautive est jointe quand le demandeur a le droit de la lire, pour que les 50 lignes soient exploitables sans requête supplémentaire.

*Temps 2 — étape de pose* : `ADD COLUMN … uuid NULL` si nécessaire, index concurrent (§9.6), puis

```sql
ALTER TABLE "b_t4z56fq_crm"."factures"
  ADD CONSTRAINT "fk_factures__clients_id"
  FOREIGN KEY ("clients_id") REFERENCES "b_t4z56fq_crm"."clients" ("_id")
  ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID;
```

La ligne `table_constraint` passe en `not_valid`. `NOT VALID` contraint **immédiatement** toute écriture future : dès ce `COMMIT`, aucune orpheline ne peut plus apparaître. Seules les lignes antérieures ne sont pas prouvées.

*Temps 3 — étape de parcours* : `VALIDATE CONSTRAINT`, état `validating` puis `active`.

**Si `VALIDATE` échoue.** La cause décide, et c'est le point qui compte :

| Cause | Décision |
|---|---|
| `23503` — une orpheline a été insérée entre le contrôle et le `COMMIT` du temps 2 | fenêtre étroite mais réelle. Le moteur relance le contrôle, remonte les lignes fautives, **retire la contrainte qu'il vient de poser** et met la migration en `failed`. C'est la seule circonstance où une clé étrangère est retirée automatiquement (I-DDL-7) |
| `55P03`, `57014`, coupure, redémarrage, bascule | **la contrainte reste en place.** `table_constraint.validate_attempts` est incrémenté, `next_attempt_at` reculé exponentiellement (1 min, 5, 15, 60, plafond 6 h), l'état reste `not_valid`, une alerte est levée au-delà de 24 h, et l'administration expose une action « valider maintenant » |

Supprimer une clé étrangère parce qu'un `VALIDATE` a expiré trois fois serait retirer de l'intégrité référentielle, de nuit, sans humain, sur un incident presque toujours transitoire — et le `DROP CONSTRAINT` correspondant prendrait au passage un `ACCESS EXCLUSIVE` sur les deux tables. Une contrainte `not_valid` qui dure est un défaut visible et surveillé (`CAT-STATE`) ; une contrainte supprimée est une perte silencieuse.

### 9.5 Verrous pris par `ADD FOREIGN KEY`

| Énoncé | Table source | Table cible | Ce qui est bloqué |
|---|---|---|---|
| `ADD CONSTRAINT … NOT VALID` | `SHARE ROW EXCLUSIVE` | `SHARE ROW EXCLUSIVE` | écritures sur **les deux** tables, le temps de poser la contrainte (millisecondes). Lectures libres |
| `ADD CONSTRAINT` validante | `SHARE ROW EXCLUSIVE` | `SHARE ROW EXCLUSIVE` | idem, mais **pendant tout le parcours de validation** |
| `VALIDATE CONSTRAINT` | `SHARE UPDATE EXCLUSIVE` | `ROW SHARE` | ni lectures ni écritures ; seuls sont bloqués les autres DDL et l'autovacuum sur la source |
| `DROP CONSTRAINT` | `ACCESS EXCLUSIVE` | `ACCESS EXCLUSIVE` | tout, sur les deux tables, pendant quelques millisecondes — **à condition que l'énoncé soit seul dans sa transaction** (I-DDL-5) |

Deux conséquences pour une base en production.

**Le verrou est pris sur la table cible aussi.** Ajouter un lien vers `clients` bloque les écritures sur `clients`, souvent bien plus sollicitée que la source. C'est la raison pour laquelle la version validante directe est réservée aux petites tables.

**La file d'attente est le vrai danger.** Un `ALTER TABLE` en attente bloque toutes les requêtes qui se présentent derrière lui, y compris les simples `SELECT`, parce que PostgreSQL sert la file dans l'ordre. Une transaction longue en cours sur `clients` suffit à figer l'application entière si le DDL attend sans limite. D'où le `lock_timeout` de 3 s, non négociable, et le contrôle de faisabilité du §5.3.

### 9.6 Index sur la colonne référençante

**Obligatoire, systématique, non désactivable**, sous le nom `ix_<table>__<colonne>`, avec la règle de déduplication du chapitre 01 §9.2. PostgreSQL indexe la colonne référencée, jamais la référençante. Trois usages en dépendent :

1. **Chaque suppression d'une ligne cible** évalue l'action référentielle en cherchant les lignes sources correspondantes. Sans index, c'est un parcours séquentiel complet de la table source **par ligne supprimée** : supprimer 100 clients devient 100 parcours de `factures`.
2. **Les liens inverses** de la vue détail (`… WHERE "clients_id" = $1 LIMIT 50`) sont servis par lui.
3. **L'expansion d'un lien** par l'API dégénère sans lui.

Il est créé en étape concurrente **avant** la pose de la contrainte, ce qui évite qu'une suppression de ligne cible tombe sur une fenêtre sans index. Son état vit dans `table_index.state` ; un index resté `indisvalid = false` est traité par la séquence de reprise du chapitre 10, à l'intérieur de la reprise du plan qui le construit — **jamais par une réparation de réconciliation** (I-DDL-8).

### 9.7 `ON DELETE` : matérialisation, changement, cascade

**Matérialisation.** Conformément à A13, les trois valeurs de `field_link_config.on_delete` se projettent ainsi :

| Valeur au catalogue | Clause émise | `pg_constraint.confdeltype` |
|---|---|---|
| `restrict` (défaut) | `ON DELETE NO ACTION` | `a` |
| `set_null` | `ON DELETE SET NULL` | `n` |
| `cascade` | `ON DELETE CASCADE` | `c` |

Le cadrage demande « un refus explicite plutôt qu'une suppression en chaîne silencieuse » ; il demande un **comportement**, pas une clause. `RESTRICT` et `NO ACTION` produisent exactement le même refus, avec le même SQLSTATE `23503`, mais `RESTRICT` vérifie **immédiatement, ligne à ligne**, alors que `NO ACTION` vérifie en fin d'énoncé. La différence est concrète : `DELETE FROM employes WHERE _id IN (<un manager et ses subordonnés>)` réussit avec `NO ACTION` et échoue avec `RESTRICT` selon l'ordre interne de suppression ; idem pour toute suppression multiple qu'un consommateur SQL écrirait naturellement. `NO ACTION` est donc retenu : refus identique côté utilisateur, suppressions multi-lignes cohérentes en un énoncé. Un `confdeltype = 'r'` constaté en base est lui-même une dérive (`CAT-FK2`) : le moteur n'émet jamais `RESTRICT`.

*Alternative rejetée* : `NO ACTION DEFERRABLE INITIALLY IMMEDIATE`, qui autoriserait en plus `SET CONSTRAINTS ALL DEFERRED` pour des chargements en masse. Une contrainte différable laisse la base transitoirement incohérente et repousse l'erreur au `COMMIT`, où plus aucun message ne peut désigner la ligne fautive ; les traitements en masse du moteur ordonnent leurs écritures eux-mêmes.

**Changer le `ON DELETE`.** PostgreSQL n'offre pas d'`ALTER CONSTRAINT` pour modifier une action référentielle (la clause ne couvre que la déferrabilité). La séquence est donc, en **trois étapes distinctes** : `DROP CONSTRAINT` (`ACCESS EXCLUSIVE` bref sur les deux tables), `ADD CONSTRAINT … NOT VALID`, puis `VALIDATE CONSTRAINT` en étape de parcours. Les données satisfont déjà la contrainte — la validation réussira — mais elle coûte un parcours, et ce parcours ne doit en aucun cas se dérouler dans la transaction qui détient l'`ACCESS EXCLUSIVE` du `DROP` : ce serait geler la table cible, typiquement la plus sollicitée de la base, pendant toute sa durée. L'utilisateur est averti de la durée estimée sur une grosse table.

**Refus croisé avec l'obligation.** `on_delete = set_null` sur un champ lien **obligatoire** est refusé, dans les deux sens : à la création du lien, et au passage en obligatoire d'un lien déjà en `set_null`. Code `LINK_SET_NULL_ON_REQUIRED` ; le catalogue le porte en plus de façon déclarative (`ck_link_set_null_nullable`). PostgreSQL accepterait sans broncher cette combinaison ; l'incohérence n'apparaîtrait qu'à la suppression d'une ligne cible, où l'action référentielle tente d'écrire `NULL` et lève un `23502` sur la table **source**, avec un message qui ne mentionne ni la table cible ni la suppression demandée. Le détachement promis ne se produirait jamais.

**Passage à `cascade`.** Conformément à A14, la clause `ON DELETE CASCADE` est réellement émise et **la suppression en chaîne est celle de PostgreSQL** : une suppression faite directement en SQL cascade exactement comme une suppression faite par l'API, et l'application n'implémente aucune cascade applicative. Ce qui est applicatif, c'est l'autorisation et l'avertissement : rôle admin, confirmation explicite, et écriture de la ligne `cascade_grant` que la contrainte `ck_link_cascade_granted` du catalogue exige, y compris face à un script. L'écran de confirmation affiche, avant l'exécution d'une suppression qui cascade, le nombre de lignes atteintes, mesuré par un **échantillon borné** (§9.1). Les lignes supprimées en chaîne sont historisées et produisent des événements sortants, la capture étant faite par déclencheur (A10).

### 9.8 Suppression logique et restauration d'un champ lien

Conformément à A17, la suppression logique d'un champ lien **retire la contrainte immédiatement**, avant de renommer la colonne : une contrainte survivante refuserait des suppressions de lignes dans une autre table au nom d'un champ que l'utilisateur croit disparu, sans que rien dans l'interface n'explique le refus. La ligne de contrainte passe `dropping` puis `dropped`, `field_link_config.fk_dropped_at` est renseigné, la colonne est reléguée avec ses valeurs.

Restaurer ce champ est donc l'unique cas où une clé étrangère se pose sur des données préexistantes susceptibles d'être orphelines : la restauration repasse par le contrôle complet du §9.4, sur la colonne reléguée, puis par le renommage inverse, la pose `NOT VALID` et la validation — exactement comme une création, contrôle en plus.

---

## 10. Alias de compatibilité : dépendances et purge

Un renommage physique crée un **alias de compatibilité** : un schéma portant l'ancien nom, contenant des vues SQL qui pointent vers le nouveau (chapitre 06 — Cycle de vie). Ces vues créent de vraies dépendances `pg_depend` sur les tables et colonnes cibles, avec trois conséquences que le moteur DDL doit traiter, faute de quoi il devient structurellement incapable de purger quoi que ce soit dès qu'un renommage a eu lieu :

- `ALTER TABLE … DROP COLUMN` sur une colonne utilisée par une vue d'alias échoue (`2BP01`, *other objects depend on it*) ;
- `DROP TABLE … RESTRICT` et `DROP SCHEMA … RESTRICT` échouent de même ;
- et I-DDL-3 interdit la sortie facile du `CASCADE`.

**Règle.** Le graphe de dépendances du plan (§3.1) inclut les vues d'alias, **lues dans `_basedb.db_schema` et `_basedb.sql_view_alias`**, jamais dans `pg_depend` — pour la même raison qu'au §9.2 : la décision doit être prise sur des lignes que la transaction verrouille, et nommer des libellés. `pg_depend` et `pg_rewrite` restent l'outil du contrôle de dérive, pas de la décision.

Le plan d'une purge ou d'une conversion émet donc, dans l'ordre : suppression explicite des vues d'alias dépendantes, opération sur l'objet cible, recréation des vues **si l'objet survit** et si sa forme le permet. Quand la recréation est impossible — la colonne aliasée a disparu, le type a changé de façon incompatible — l'opération est refusée avant toute écriture avec `ALIAS_DEPENDENT`, listant les schémas d'alias et les vues concernés, et la résolution proposée : supprimer l'alias depuis l'administration, puis recommencer.

Reformulation correspondante de la règle de purge : **un `RESTRICT` qui échoue est une dérive uniquement si aucune dépendance connue du catalogue ne l'explique.**

---

## 11. Dérive de forme entre catalogue et structure physique

### 11.1 Périmètre et principes

La réconciliation catalogue ↔ `pg_catalog` — son régime d'exécution (`REPEATABLE READ, READ ONLY`, verrou de classe `structure_step`, fréquence), son catalogue de classes et ses requêtes de référence — appartient au chapitre 02. Le présent chapitre n'y ajoute que les classes **de forme** qui lui sont propres, préfixées `DDL-`, et trois principes qui évitent le rapport inexploitable.

1. **Le périmètre vient du catalogue, pas d'un motif de nom.** Les schémas examinés sont ceux de `_basedb.db_schema` non `dropped_at`, résolus par `v_physical_name_qualified`, schémas d'alias et schémas relégués compris. Filtrer sur `nspname LIKE 'b\_%'` signalerait chaque schéma d'alias comme « schéma sans base » et manquerait chaque base reléguée, dont le schéma ne correspond plus au motif.
2. **Les colonnes reléguées sont dans le périmètre, pas hors de lui.** Une colonne `zz_supprime_%` a un champ de catalogue non purgé : elle n'est pas une colonne inconnue, mais elle doit être vérifiée pour ce qu'elle ne doit plus porter (`DDL-DEL`).
3. **On compare des formes canoniques, pas des chaînes.** `pg_get_constraintdef(oid)`, `pg_get_indexdef(oid)`, `pg_get_expr(adbin, adrelid)` pour les défauts, et `format_type(atttypid, atttypmod)` des **deux** côtés — le gabarit du catalogue étant résolu par `to_regtype(…)` puis reformaté. Comparer un gabarit brut à la sortie de `format_type` signalerait `varchar(255)` contre `character varying(255)` et `timestamptz` contre `timestamp with time zone` sur toutes les colonnes de la base.

### 11.2 Classes de dérive propres au moteur

| Classe | Constat | Introspection | Gravité |
|---|---|---|---|
| `DDL-IX1` | index décrit `active` au catalogue et absent de `pg_index` | anti-jointure sur `pg_index` | haute |
| `DDL-NULL` | nullabilité divergente, hors état intermédiaire nommé | `pg_attribute.attnotnull` | haute |
| `DDL-TYPE` | type physique divergent du gabarit du catalogue | `format_type` des deux côtés | haute |
| `DDL-VAL` | contrainte, hors clé étrangère et hors liste de choix, dont `convalidated` diverge de son état catalogue | `pg_constraint` | moyenne |
| `DDL-DEF` | valeur par défaut divergente | `pg_get_expr(adbin, adrelid)` | moyenne |
| `DDL-DEL` | contrainte ou `NOT NULL` survivant sur une colonne `zz_supprime_`, susceptible de refuser une écriture | `pg_attribute.attnotnull`, `pg_constraint` | haute |
| `DDL-BOOT` | objet partagé de `_basedb_local` absent ou divergent de son corps de référence | `pg_get_functiondef` | haute |

Les classes `CAT-` du chapitre 02 couvrent le reste et ne sont pas redites ici : clés étrangères non décrites, divergentes ou manquantes (`CAT-FK1/2/3`), colonnes sans champ et champs sans colonne (`CAT-COL1/2`), noms de registre sans objet et objets sans nom (`CAT-NAME`), `CHECK` de liste de choix (`CAT-CK`), commentaires (`CAT-CMT`), et **états physiques non terminaux depuis plus de 24 heures ou index `indisvalid = false`** (`CAT-STATE`). Cette dernière est celle qui manque le plus souvent aux systèmes de ce genre : une divergence « nommée au catalogue » est acceptable une minute, pas une semaine. Sans elle, une base fonctionne des mois avec des contraintes non prouvées et des index de clé étrangère absents, et la découverte se fait par une suppression devenue quadratique, jamais par une alerte. Le moteur en surveille en outre le seuil d'exploitation d'une heure (§14.2), bien avant que la classe ne se déclenche.

### 11.3 Ce qui est fait d'une dérive

**Rien d'automatique** (I-DDL-8). Un écart bloquant passe `base.structure_state` à `frozen` et lève `REGISTRY_DIVERGENT` : **les lectures et les écritures de données restent servies**, seules les opérations de structure de cette base sont suspendues, et elles répondent `BASE_STRUCTURE_FROZEN`. Les issues de réparation — rejouer un plan inachevé, adopter l'objet physique, mettre en orphelin — sont exposées à un administrateur et décrites au chapitre 10.

Une réparation automatique serait pire que le mal dans chacun des cas où elle serait tentante : détruire et reconstruire un index « invalide » détruirait un index qu'une autre instance est en train de construire ; valider automatiquement une contrainte masquerait la cause ; réécrire une colonne effacerait la preuve de l'intervention manuelle qui a produit la dérive. Une dérive `CAT-COL1`, `CAT-NAME` ou `DDL-TYPE` signale presque toujours une intervention humaine en base — laquelle mérite un humain en retour.

Le rapport porte, par ligne : classe, gravité, base, schéma, relation, objet, valeur attendue, valeur constatée, issue proposée, date de première observation. Il est publié dans l'administration et écrit dans `audit_log` avec un acteur `system`. La couverture effective du balayage est journalisée avec lui : un rapport « zéro dérive » ne doit jamais pouvoir signifier « rien n'a été regardé ».

**Le gel n'est pas qu'un état affiché.** Le contrôle est refait **en tête de chaque opération de structure, sous le bail** (§2.1, étapes 3 puis 8), et pas seulement au démarrage. Sans cela, un plan serait construit à partir d'un catalogue faux : le DDL échouerait au milieu, ou pire réussirait sur un objet inattendu, et l'incident de départ deviendrait une corruption.

---

## 12. Migrations proposées, approbation, fenêtre de maintenance

### 12.1 Proposition

Le serveur MCP produit des propositions, jamais des applications. Une proposition est une ligne `_basedb.migration` en `proposed`, `origin = 'mcp'`, avec `catalog_diff`, `up_sql`, `down_sql`, `checksum`, `planner_version` et la valeur de `base.catalog_version` au moment de la proposition. **Aucun `sequence` n'est alloué** : l'ordre n'existe qu'à l'application (§4.4). Les propositions passent en `expired` 24 heures après leur création, avec `MIGRATION_EXPIRED`, et sont bornées à 50 par base.

### 12.2 Revue et approbation

L'interface affiche le diff lisible (« ajouter le champ Client, lien vers Clients, refus de suppression ») et le SQL en second rideau. Jamais le SQL seul : personne n'approuve un `ALTER TABLE` qu'il doit relire pour comprendre.

L'approbation appartient à un humain porteur du droit de gestion de schéma ; elle écrit `approved_by`, `approved_at` et le statut `approved`. **Le serveur MCP ne peut pas approuver ses propres propositions** : c'est une règle de la couche de permissions, doublée par la contrainte `ck_migration_mcp_approved` du catalogue, pas une option de configuration.

L'application est un plan ordinaire, précédé de trois contrôles :

1. `checksum` recalculé = `checksum` stocké, sinon `MIGRATION_TAMPERED` (incident).
2. `base.catalog_version` inchangé → application directe.
3. `base.catalog_version` changé → **le plan est régénéré depuis `catalog_diff`** et comparé au `up_sql` stocké, sous sa forme canonique (§4.2). Le tri déterministe (§3.2) rend la comparaison fiable. Identiques → la structure a bougé ailleurs, sans incidence, on applique. Différents → refus `MIGRATION_STALE`, statut inchangé, nouveau diff présenté pour une nouvelle approbation. C'est la justification concrète du double stockage intention/SQL.

Une régénération faite par un `planner_version` différent de celui de la proposition produit `MIGRATION_STALE` sans autre forme de procès : pendant un déploiement progressif, deux versions du planificateur coexistent, et comparer leurs sorties n'aurait aucun sens.

### 12.3 Fenêtre de maintenance

Une migration approuvée peut porter un `scheduled_for` (au plus 7 jours). Elle n'est alors pas appliquée immédiatement : l'ordonnanceur la reprend à l'heure dite, sous les mêmes règles de bail, de contrôles et de gel. C'est la réponse d'exploitation disponible pour les opérations longues — construction d'index et recopie sur une très grosse table —, et elle doit exister, sans quoi « prévoyez une fenêtre de maintenance » n'est qu'une formule. L'écran d'approbation affiche l'estimation de durée au moment de l'approbation **et** la recalcule avant l'exécution différée : une table a pu grossir entre-temps.

---

## 13. Volumétrie et coûts d'exploitation

### 13.1 Comportement à 10 millions de lignes

| Opération | Effet | Réponse v1 |
|---|---|---|
| Ajouter un champ (défaut constant ou nul) | instantané | rien à faire |
| Ajouter un champ avec défaut volatil | réécriture complète | **refusé** (`DEFAULT_VOLATILE_FORBIDDEN`) |
| Index unique ou index de clé étrangère | quelques minutes | `CONCURRENTLY`, écritures non bloquées |
| Ajouter une clé étrangère | un parcours | `NOT VALID` puis `VALIDATE`, écritures non bloquées |
| Rendre obligatoire | un parcours | trois étapes, écritures non bloquées pendant le parcours |
| Changer les options d'une liste | un parcours | trois étapes, écritures non bloquées pendant le parcours |
| Changer le `ON DELETE` | un parcours | trois étapes ; sans le découpage, la table cible serait gelée |
| Changer le type | une recopie complète | colonne neuve, lots bornés, écritures non bloquées ; un numéro d'attribut consommé |
| Supprimer logiquement un champ ou une table | instantané | — |
| Purger une table ou un schéma | instantané | espace rendu au `COMMIT` |
| Purger un champ | instantané | **espace non rendu** (§13.4) |

### 13.2 Délai des étapes concurrentes

Le `statement_timeout` d'une étape concurrente est dérivé de `pg_total_relation_size`, jamais uniforme, et plafonné à 2 heures. Motif : un `VALIDATE` ou un `CREATE INDEX CONCURRENTLY` long détient un `SHARE UPDATE EXCLUSIVE` qui **empêche l'autovacuum** de la table pendant toute sa durée ; sur une table très écrite, un plafond de quatre heures transforme une construction d'index en gonflement durable. Combiné au contrôle de faisabilité du §5.3 et au recul exponentiel, ce plafond évite la boucle classique : construction tuée au délai → index invalide → reconstruction → tuée à nouveau, indéfiniment, tant que la transaction longue est là.

La durée réelle de chaque étape concurrente est journalisée : c'est la seule façon de voir une dégradation progressive avant qu'elle ne devienne une panne.

### 13.3 WAL, réplication, réplique physique

Ces points ne sont pas réglables par le moteur ; ils doivent être écrits dans les prérequis d'exploitation, parce qu'ils décident du succès d'une opération que le moteur aura déclarée sûre.

- Une construction d'index ou une recopie sur dix millions de lignes produit **plusieurs gigaoctets de WAL** : elle peut saturer `max_wal_size`, remplir un slot de réplication en retard et faire décrocher une standby. Le découpage en lots bornés étale la production, il ne la supprime pas.
- Un `ALTER TABLE` prenant un `ACCESS EXCLUSIVE` **se rejoue sur une réplique physique** et y annule les requêtes en cours au-delà de `max_standby_streaming_delay`. Une architecture qui promet des données « exploitables directement en SQL » verra apparaître une standby de lecture : le DDL y provoquera des annulations de requêtes, c'est un risque assumé et documenté, pas un défaut à découvrir.

### 13.4 Ce que la purge rend, et ce qu'elle ne rend pas

| Purge | Espace rendu ? |
|---|---|
| Table, schéma (`DROP TABLE`, `DROP SCHEMA`) | **oui, au `COMMIT`** : les fichiers sont détachés, aucun vacuum n'est nécessaire |
| Champ (`ALTER TABLE … DROP COLUMN`) | **non, jamais.** La colonne est marquée `attisdropped`, ses octets restent dans chaque tuple existant, et l'autovacuum ne les récupérera pas |

Seule une réécriture complète de la table — `VACUUM FULL`, `CLUSTER`, ou un outil externe — libère l'espace d'une colonne purgée, et le moteur n'émet jamais aucun des trois (§2.4). Le rapport de purge le dit en toutes lettres et fournit la requête à exécuter par l'exploitant, plutôt qu'une estimation de l'espace perdu : la calculer exigerait un parcours complet de la table pour une valeur indicative, ce qui coûterait plus que l'information ne vaut.

### 13.5 Croissance des sous-produits du moteur

Le moteur écrit lui-même dans `_basedb`. Les durées sont celles de `_basedb.retention_policy` (A24) ; aucune valeur n'est citée de mémoire ailleurs.

| Sous-produit | Rétention |
|---|---|
| Lignes `migration`, **propositions MCP `expired` comprises** | **jamais purgées** : elles portent la rejouabilité (§4.6) et l'historique des structures. Une proposition expirée n'est pas un sous-produit à part : c'est une ligne de `migration` dans l'état `expired` du vocabulaire unique (A12). Elles ne figurent pas dans `retention_policy` |
| `migration.error_sample` | 30 jours, par `error_sample_expires_at` ; c'est l'objet « Échantillons d'erreur de migration » de A24 |
| Rapports de réconciliation, avec ou sans dérive | **Aucun objet de rétention propre, et aucune table propre** : le rapport est écrit dans `audit_log` avec un acteur `system` (§11.3) et suit donc la rétention du journal d'audit. Au-delà de la fenêtre courte, l'administration ne publie qu'un rapport sans dérive par base et par jour ; un rapport portant au moins une dérive reste mis en avant tant que la dérive n'est pas résolue, ce qui est un état d'écran et non une durée de conservation |

---

## 14. Exploitation du moteur

### 14.1 Se rendre lisible depuis PostgreSQL

Au début de chaque étape, la connexion du pool `ddl` pose `application_name = 'basedb-ddl:<base>:<migration_id>'`, et `pg_backend_pid()` est enregistré dans le journal. Sans cela, la première question d'un incident — *quelle migration tient ce verrou ?* — n'a pas de réponse : `pg_stat_activity` montre un nom d'application vide et une requête tronquée.

### 14.2 Mesures propres au moteur

Les seuils sont ceux au-delà desquels un humain doit regarder.

| Mesure | Seuil |
|---|---|
| Durée d'une étape de pose (p95) | 5 s |
| Attente de verrou cumulée par heure | — |
| `MIGRATION_IN_PROGRESS` et `LOCK_UNAVAILABLE` par heure | croissance anormale |
| Migrations `applying` depuis plus de 5 minutes | **> 0, alerte immédiate** |
| États physiques non terminaux depuis plus d'une heure | > 0 |
| Dérives de gravité haute | **> 0, alerte immédiate** |
| Index `indisvalid = false` dans un schéma du périmètre | > 0 |
| Âge de la plus vieille proposition MCP | 24 h |
| Étapes concurrentes différées (`STEP_DEFERRED`) | > 3 consécutives sur le même objet |

### 14.3 Conduite d'incident

Les requêtes que l'on exécute réellement, dans l'ordre où l'on se les pose.

```sql
-- 1. Quelles migrations sont en vol, et depuis quand ?
SELECT id, base_id, sequence, status, origin, executor_id, lease_until,
       step, requested_at, pg_backend_pid
FROM _basedb.migration
WHERE status IN ('applying', 'interrupted')
ORDER BY requested_at;

-- 2. Que fait le backend correspondant ?
SELECT pid, application_name, state, xact_start, wait_event_type, wait_event,
       left(query, 200)
FROM pg_stat_activity
WHERE application_name LIKE 'basedb-ddl:%';

-- 3. Qui bloque qui ?
SELECT a.pid, pg_blocking_pids(a.pid) AS bloqueurs, a.state, now() - a.xact_start AS age
FROM pg_stat_activity a
WHERE cardinality(pg_blocking_pids(a.pid)) > 0;

-- 4. Quelle portee tient un verrou consultatif du moteur ?
--    classid 2 = name_allocation, 3 = structure_step (_basedb.lock_class).
SELECT pid, classid, objid, granted
FROM pg_locks
WHERE locktype = 'advisory' AND classid IN (2, 3) AND objsubid = 2;
```

Quatre actions d'administration sont exposées, réservées au rôle admin, chacune tracée dans l'audit avec son auteur et son motif :

| Action | Quand | Effet |
|---|---|---|
| **Reprendre** une migration | `applying` avec bail expiré, ou `interrupted` | la machine à états repart à l'étape suivante |
| **Abandonner** une migration | plan inachevé qu'on ne veut pas reprendre | statut `failed`, bail relâché, base placée en `frozen` pour arbitrage — jamais un simple effacement |
| **Relancer ou différer** une étape concurrente | `STEP_DEFERRED` répétée | remet `next_attempt_at` à maintenant, ou repousse |
| **Lever le gel** d'une base | dérive constatée et traitée | après réexécution de la réconciliation ; la levée sans réexécution est impossible |

Terminer un backend bloquant reste possible : le rôle peut signaler les sessions **du même rôle**, donc les siennes. Une session tierce (un DBA en psql) ne peut pas être terminée par le produit, et l'écran le dit au lieu d'échouer silencieusement.

---

## 15. Codes d'erreur définis par ce chapitre

Ils sont en anglais, à raison d'un par condition (A2, A23), et versés au registre unique `_basedb.error_code`. Ils peuvent y être ajoutés, jamais renommés ni resémantisés sans changement de version d'API.

Repris tels quels d'autres chapitres, et non redéfinis : `LOCK_UNAVAILABLE`, `LINK_CROSS_DATABASE`, `IDENTIFIER_INVALID`, `NAME_COLLISION_UNRESOLVED` (chapitre 01) ; `POSTGRES_VERSION_TOO_OLD`, `TABLE_REFERENCED`, `DISPLAY_FIELD_IN_USE`, `REGISTRY_DIVERGENT` (chapitre 02) ; `REQUIRED_NULL_VALUES` et les codes de conversion de type (chapitre 04) ; `DUPLICATE_VALUE` et `TIMEOUT_EXCEEDED` (chapitre 08). `MIGRATION_IN_PROGRESS` est la spécialisation de `LOCK_UNAVAILABLE` pour le bail de structure, qui n'est pas un verrou PostgreSQL et ne doit donc pas porter le même code.

| Code | Déclencheur | Niveau |
|---|---|---|
| `LINK_ORPHAN_VALUES` | valeurs sans correspondance à la pose d'une clé étrangère | Validation |
| `LINK_TARGET_UNSUPPORTED` | cible d'une clé étrangère autre que `_id` | Validation |
| `LINK_SET_NULL_ON_REQUIRED` | `set_null` sur un lien obligatoire, ou l'inverse | Validation |
| `ID_IMMUTABLE` | écriture ou opération de structure visant `_id` ou une autre colonne système | Validation |
| `DEFAULT_NOT_ALLOWED` / `DEFAULT_VOLATILE_FORBIDDEN` | expression de défaut hors vocabulaire, ou volatile | Validation |
| `TIMEZONE_UNKNOWN` | fuseau absent de `pg_timezone_names` | Validation |
| `ALIAS_DEPENDENT` | vue d'alias empêchant une purge ou une conversion non reconstructible | Validation |
| `TOO_MANY_TABLES` | borne de tables par base atteinte (§3.3) | Validation |
| `MIGRATION_TOO_LARGE` | bornes de plan dépassées | Validation |
| `MIGRATION_STALE` | structure ou planificateur modifiés entre proposition et approbation | Validation |
| `MIGRATION_EXPIRED` | proposition de plus de 24 h | Validation |
| `MIGRATION_IN_PROGRESS` | bail de structure non obtenu, ou clé d'idempotence rejouée | Concurrence |
| `STEP_DEFERRED` | étape concurrente reportée (transaction longue en cours) | Exploitation |
| `BASE_STRUCTURE_FROZEN` | opération de structure refusée sur une base gelée | Conflit |
| `MIGRATION_TAMPERED` | `checksum` divergent | Incident |
| `PLAN_CYCLIC` | cycle résiduel en phase 1 du tri | Incident |
| `PLAN_LOCK_CONFLICT` | violation d'I-DDL-5 détectée à la planification | Incident |

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Une opération de structure est une suite d'étapes, chacune dans sa transaction ; aucune étape ne laisse le catalogue et la structure désaccordés, et l'atomicité vue du consommateur vient de `definition_state` (A11) | Une transaction unique interdit `CONCURRENTLY`, annule le bénéfice de `NOT VALID`/`VALIDATE` et transforme toute opération sur une grosse table en indisponibilité | Une transaction unique par opération |
| Exclusion portée par un bail de catalogue (`base.current_migration_id`, `migration.lease_until`), doublée par `uq_migration_running` | « Verrou libre » ne prouve pas que la transaction est morte, « verrou tenu » ne prouve pas qu'on travaille | Déduire l'état d'un plan de la présence d'un verrou consultatif |
| Clés de verrou consultatif entières, lues dans `_basedb.lock_class` et les colonnes `lock_key` (A8) ; aucun verrou de session dans une étape | `hashtext()` n'est pas documentée, a changé d'algorithme et collisionne entre bases sans rapport ; un verrou de session survit à la restitution de la connexion | `pg_advisory_lock(hashtext(…))` ; contrôle de collision au démarrage |
| `sequence` allouée à la prise du bail, nullable avant | Le bail interdit qu'une autre migration démarre : `sequence` devient l'ordre réel d'application, condition de la rejouabilité | Allocation à la réception de l'intention |
| `up_sql` = tableau ordonné d'énoncés avec drapeau `transactional` (A12) | Un `CREATE INDEX CONCURRENTLY` ne peut pas être rejoué dans une transaction ; l'omettre rendrait la rejouabilité fausse | `up_sql` comme bloc de texte |
| « Rendre obligatoire », « changer les options d'une liste » et « changer le `ON DELETE` » en trois étapes | PostgreSQL ne relâche aucun verrou avant le `COMMIT` : groupées, ces séquences parcourent la table sous `ACCESS EXCLUSIVE` | Une transaction unique, avec `VALIDATE` au milieu |
| Invariant I-DDL-5 vérifié sur le plan avant émission | Rend la règle mécanique au lieu de reposer sur la vigilance de l'implémenteur | Règle écrite en prose seulement |
| `ON DELETE NO ACTION` pour la valeur catalogue `restrict` (A13) | Refus identique pour l'utilisateur, mais une suppression multi-lignes cohérente en un énoncé réussit au lieu d'échouer sans raison métier | `ON DELETE RESTRICT` ; `NO ACTION DEFERRABLE` |
| La cascade est exécutée par PostgreSQL, la clause est réellement émise (A14) ; seuls le décompte et la confirmation sont applicatifs | Une suppression SQL directe doit cascader comme une suppression par l'API | Cascade applicative, qui mentirait au consommateur SQL |
| La contrainte de clé étrangère tombe à la suppression logique du champ lien (A17) | Un champ invisible partout ne doit pas continuer à refuser des suppressions ailleurs | Conserver la contrainte jusqu'à la purge |
| Conversion de type par colonne neuve et recopie par lots ; aucune réécriture de table émise | Un `ALTER COLUMN … TYPE` détient `ACCESS EXCLUSIVE` pendant toute sa durée et reconstruit tous les index ; `uq_field_name` rend de toute façon la conversion en place impossible | `ALTER COLUMN … TYPE … USING` avec fenêtre de maintenance et contrôle d'espace disque |
| Seuil de volumétrie en sûreté : chemin simple seulement si `reltuples >= 0 AND reltuples < 100 000 AND pg_relation_size < 128 Mo` | Depuis PostgreSQL 14, `reltuples = -1` pour une table jamais analysée : un test naïf choisit le pire chemin sur la plus grosse table | Seuil sur `reltuples` seul |
| Cinq points d'entrée littéraux énumérés, une seule routine d'échappement, jeu de tests adverse | Aucun énoncé utilitaire n'accepte de paramètre lié : c'est la seule défense possible | Invariant « aucune chaîne utilisateur dans le SQL », faux tel quel |
| Objets partagés dans `_basedb_local`, référencés et jamais redéfinis (A9) ; extensions traitées en prérequis (A3) | Le nom est écrit dans le `DEFAULT` de `_id` de toutes les tables ; et prétendre ne dépendre d'aucune extension alors que la recherche indexée en exige deux serait faux | Schéma utilitaire configurable ; « aucune extension requise » |
| PostgreSQL 16 vérifié au démarrage (A1) | `SET NOT NULL` adossé (12), `reltuples = -1` (14), `NULLS NOT DISTINCT` (15), `pg_input_is_valid` (16) : une garantie fausse est pire qu'absente | Ne rien déclarer et espérer |
| Unicité par index unique concurrent, état porté par la ligne `table_constraint` | Un index se construit `CONCURRENTLY`, une contrainte non ; et l'unicité est une propriété sémantique qu'on ne peut pas annoncer avant qu'elle ne tienne | `ADD CONSTRAINT UNIQUE USING INDEX` ; drapeau `is_unique` au catalogue |
| Une clé étrangère n'est jamais retirée automatiquement, sauf `23503` dans la fenêtre de reprise du plan qui l'a posée | Les échecs de `VALIDATE` sont majoritairement transitoires ; retirer une contrainte la nuit sans humain est l'inverse de la prudence | Retrait après trois `VALIDATE` en échec |
| Aucune réparation automatique de dérive ; la seule action automatique est la reprise d'un plan inachevé | Une réparation automatique détruit la preuve du problème et peut détruire le travail d'une autre instance | Réparation automatique des index et des `VALIDATE` |
| Périmètre de réconciliation lu dans le catalogue, formes canoniques comparées, classes propres préfixées `DDL-` | `LIKE 'b\_%'` et la comparaison de gabarits produisent un rapport faux dès la première semaine ; une lettre nue est inexploitable dans un rapport | Motif de nom, comparaison de chaînes, lettres A à P |
| Une base gelée continue de servir lectures **et** écritures de données | Le catalogue décrit correctement ce que les données utilisent ; seule la construction d'un plan serait faussée | Passer la base en lecture seule |
| Bornes chiffrées de plan (10 relations, 200 objets, 500 tables), budget d'attributs délégué au chapitre 04 | `53200 out of shared memory` est une panne que PostgreSQL rend incompréhensible ; le budget d'attributs appartient à qui décrit l'empreinte d'un champ | Les découvrir en production ; trois couples de seuils concurrents |
| Les vues SQL d'alias entrent dans le graphe de dépendances, lues au catalogue | Sans cela, aucune purge n'est possible après le premier renommage, et I-DDL-3 interdit le `CASCADE` | Lire `pg_depend` pour décider, ou céder au `CASCADE` |

## Risques et limites connues

- **Une conversion de type consomme un numéro d'attribut** et duplique transitoirement la colonne. Sur une table très éditée, c'est le budget d'attributs du chapitre 04 qui devient la ressource rare, et sa seule issue reste une opération d'administration de compactage.
- **Une reprise de recopie recommence au premier lot.** L'expression étant totale et déterministe, le résultat est correct ; le temps déjà passé est perdu. Sur dix millions de lignes, une reprise tardive coûte cher.
- **L'espace d'une colonne purgée n'est jamais rendu** sans une réécriture de table que le moteur n'émet pas. Sur une table très éditée, l'écart entre la taille utile et la taille réelle croît sans que rien ne le corrige automatiquement.
- **Le moteur ne peut pas lire l'espace disque libre** : il annonce le besoin, il ne vérifie pas la capacité. Prétendre mesurer ce qu'on ne peut pas lire serait pire que de l'annoncer.
- **Une base gelée n'accepte plus aucune opération de structure** jusqu'à l'arbitrage d'un humain. C'est voulu — planifier à partir d'une description fausse est pire — mais cela signifie qu'une intervention manuelle en base par un tiers suffit à arrêter l'évolution d'une base.
- **Le contrôle de données est une photographie.** Entre lui et la pose de la contrainte, une écriture concurrente peut créer la ligne fautive ; le `VALIDATE` la rattrape, au prix d'un échec tardif. Réduire cette fenêtre exigerait de verrouiller la table, ce qui coûte plus cher que le cas ne vaut.
- **Aucune migration appliquée n'est annulable.** `down_sql` est un outil de test ; en production, on corrige par une migration suivante, et les données détruites ne reviennent que par une restauration.
- **Le diagnostic des sessions bloquantes est partiel** sans `pg_read_all_stats` : un blocage venu d'en dehors de l'application est visible mais pas explicable depuis le produit.
- **`reltuples` et `pg_total_relation_size` sont des estimations.** Les durées annoncées avant une validation ou une recopie sont des ordres de grandeur, pas des engagements.

## Questions ouvertes

1. **Seuil de volumétrie configurable.** 100 000 lignes et 128 Mo sont des valeurs arbitraires mais argumentées. Faut-il les exposer en configuration d'instance, au risque qu'un exploitant les relève et retrouve les blocages que le chemin prudent évite ?
2. **Curseur de reprise de la recopie.** La recopie est rejouable sans état supplémentaire, mais une reprise repart du premier lot. Faut-il porter un curseur au catalogue pour l'éviter, au prix d'une colonne de plus sur `migration` et d'un état à tenir à jour à chaque lot ?

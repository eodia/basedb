# Violations residuelles a corriger — groupe g-reste

Chaque entree a ete relevee par un verificateur qui a lu le document apres convergence.
La decision violee est citee ; sa lettre exacte est dans 00-decisions-structurantes.md.

## V1 — 03-moteur-ddl-migrations.md [majeur]
**Decision violee** : A2 — Identifiants système en anglais / A6 — Motifs des noms dérivés (le suffixe `<regle>` de `ck_` est le vocabulaire fermé à six valeurs du chapitre 04 §1.2, porté par `table_constraint.rule`)

**Passage** : l. 418 : « `ALTER TABLE … ADD CONSTRAINT "ck_<table>__<colonne>__nonvide" CHECK ("x" IS NOT NULL) NOT VALID` » ; l. 343 : « Aucun nom n'est fabriqué par concaténation à l'instant de l'écriture — ni un `ck_…__nonvide`, ni un `ix_…` ».

**Correction a appliquer** : Remplacer `nonvide` par `not_null` aux deux endroits : `ck_<table>__<colonne>__not_null` (l. 418) et `ck_…__not_null` (l. 343). C'est le nom employé par le chapitre 02 (l. 770, « `ADD CONSTRAINT ck_…__not_null CHECK (col IS NOT NULL) NOT VALID` ») et par le chapitre 04 (l. 46 et l. 77, `ck_<t>__<c>__not_null`, `rule = 'not_null'`). `nonvide` est en outre un faux ami : il suggère `not_empty`, qui est une autre règle du vocabulaire fermé et porte sur la chaîne vide, pas sur `NULL`.

---

## V2 — 06-cycle-de-vie.md [majeur]
**Decision violee** : A2 — Identifiants système en anglais / A6 — Motifs des noms dérivés (suffixe `<regle>` pris dans le vocabulaire fermé `enum`, `range`, `not_empty`, `format`, `length`, `not_null`)

**Passage** : l. 296 : « `ALTER TABLE "b_t4z56fq_crm"."factures" DROP CONSTRAINT "ck_factures__remise__plage";` »

**Correction a appliquer** : « `ALTER TABLE "b_t4z56fq_crm"."factures" DROP CONSTRAINT "ck_factures__remise__range";` ». `plage` n'appartient pas au vocabulaire fermé de `table_constraint.rule` ; la règle de bornes d'un champ `number` est `range` (chapitre 04 §1.2 et §9).

---

## V3 — 07-historique.md [majeur]
**Decision violee** : A5 — Un registre unique des noms physiques (les tables d'objets du catalogue référencent le registre par clé étrangère et ne dupliquent jamais la chaîne)

**Passage** : l. 777-791, DDL de `_basedb.history_archive` : « `partition_name text COLLATE "C" NOT NULL,` / `table_name     text COLLATE "C" NOT NULL,` » et « `CONSTRAINT uq_history_archive_partition UNIQUE (partition_name)` ». Le chapitre lui-même indique pourtant l. 732 que la tâche « enregistre le nom de la partition au registre des noms physiques » : la chaîne est donc stockée deux fois.

**Correction a appliquer** : Remplacer les deux colonnes texte par des références au registre : `partition_name_id uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,` et `table_name_id uuid NOT NULL REFERENCES _basedb.physical_name(id) ON DELETE RESTRICT,` ; renommer la contrainte d'unicité en `CONSTRAINT uq_history_archive_partition UNIQUE (partition_name_id)` ; résoudre les noms à l'affichage par `_basedb.v_physical_name_qualified`. La pérennité est acquise : A5 interdit la destruction d'une ligne de registre, y compris en état `purged`, donc la référence survit au `DROP TABLE` de l'étape `dropped`. Adapter en conséquence la phrase l. 796 (« L'unicité sur `partition_name` … » → « L'unicité sur `partition_name_id` … »).

---

## V4 — 01-conventions-nommage.md [mineur]
**Decision violee** : A6 — Motifs des noms dérivés (suffixe `<regle>` pris dans le vocabulaire fermé du chapitre 04) et A2

**Passage** : l. 389, tableau des motifs normatifs : « | Contrainte de vérification | `ck_<table>__<colonne>__<regle>` | `ck_factures__montant__positif` | ». L'exemple porte un suffixe français, `positif`, qui n'appartient pas aux six valeurs autorisées de `table_constraint.rule` (`enum`, `range`, `not_empty`, `format`, `length`, `not_null`).

**Correction a appliquer** : Remplacer l'exemple par `ck_factures__montant__range`, qui est la règle réellement émise pour borner un champ `number` (chapitre 04 §1.2 et §9). Le même exemple figure dans le tableau A6 de `00-decisions-structurantes.md` l. 92 : l'arbitrage étant la source, il faut l'y corriger d'abord, puis répercuter ici.

---

## V5 — 04-types-de-champs.md [mineur]
**Decision violee** : A6 — Motifs des noms dérivés identiques partout

**Passage** : Le tableau §1.2 (l. 40-50) et le §9 (l. 895, 898, 1041) emploient la forme abrégée `ck_<t>__<c>__…`, `fk_<t>__<c>`, `uq_<t>__<c>`, `ix_<t>__<c>`, `ix_<t>__<c>_2`, alors que le même chapitre écrit le motif complet quelques lignes plus bas (l. 55 : « `ix_<table>__<colonne>` sur une colonne système d'horodatage atteint 64 octets ») et que les chapitres 00, 01, 02, 03, 05, 06, 08 et 09 emploient tous `<table>__<colonne>`.

**Correction a appliquer** : Uniformiser sur les métavariables du chapitre 01 §9.1 : `ck_<table>__<colonne>__<regle>`, `fk_<table>__<colonne>`, `uq_<table>__<colonne>`, `ix_<table>__<colonne>`. À défaut, déclarer explicitement l'abréviation avant le tableau §1.2 (« `<t>` et `<c>` abrègent `<table>` et `<colonne>` »), afin qu'aucun lecteur n'y voie un second jeu de motifs.

---

## V6 — 10-architecture-logicielle.md [mineur]
**Decision violee** : A2 — Identifiants système en anglais

**Passage** : l. 383 : « | `BASEDB_POOL_CATALOGUE_MAX`, `BASEDB_POOL_DONNEES_MAX`, `BASEDB_POOL_DDL_MAX` | non | Tailles de pool ; défauts du §3.1 | ». Deux des trois noms sont français, alors que les onze autres variables d'environnement du produit sont en anglais (`BASEDB_ENCRYPTION_KEY`, `BASEDB_SESSION_SECRET`, `BASEDB_REQUEST_TIMEOUT_MS`, `BASEDB_SCHEMA_CACHE_MAX_MB`…).

**Correction a appliquer** : `BASEDB_POOL_CATALOG_MAX`, `BASEDB_POOL_DATA_MAX`, `BASEDB_POOL_DDL_MAX`. Renommer du même coup les pools eux-mêmes — `catalogue` → `catalog`, `donnees` → `data` — partout où ils sont nommés comme identifiants (03 l. 100-103, 115-119, 130, 146, 297, 299, 367, 446, 466, 530 ; 08 l. 398, 1277 ; 01 l. 693 ; 02 l. 15), ainsi que le marqueur SQL obligatoire `/*predicat_lignes:<table>*/` (08 l. 376, 383, 398, 464, 515, 730, 1277) → `/*row_predicate:<table>*/`.

---

## V7 — 03-moteur-ddl-migrations.md [mineur]
**Decision violee** : A2 — Identifiants système en anglais, en `snake_case` pour les identifiants SQL

**Passage** : l. 466 : « `WITH RECURSIVE … WHERE profondeur < 20`, `statement_timeout` local de 2 s, sur le pool `donnees` ».

**Correction a appliquer** : « `WITH RECURSIVE … WHERE depth < 20` ». `profondeur` est une colonne de CTE, donc un identifiant SQL émis par le produit, et non un libellé destiné à l'humain.

---

## V8 — 06-cycle-de-vie.md [mineur]
**Decision violee** : A2 — Identifiants système en anglais

**Passage** : l. 288-293, esquisse SQL de la suppression logique d'un champ : « `SET deleted_at = $horodatage_du_contexte, deleted_by = $acteur, … name_id = $nouvelle_ligne_de_registre WHERE id = $champ` ».

**Correction a appliquer** : Employer des métavariables anglaises, cohérentes avec les autres esquisses SQL du document (qui écrivent `$1`, `$2` ou des noms anglais) : `$context_timestamp`, `$actor`, `$new_name_id`, `$field_id` — ou, plus simplement, les paramètres liés numérotés `$1`…`$4`, forme employée partout ailleurs (02 l. 1367, 03 l. 130).

---

## V9 — 05-permissions.md [majeur]
**Decision violee** : A14 — la cascade est exécutée par PostgreSQL ; le décompte et la confirmation sont applicatifs

**Passage** : §5.7, ligne 380 : « Le noyau calcule, par table atteinte, le nombre de lignes que la cascade détruira […] Ce décompte est renvoyé avec `CONFIRMATION_REQUIRED` (409). Au-delà de 5 000 lignes atteintes au total — seuil configurable —, une session élevée est exigée en plus. »

**Correction a appliquer** : Contradiction frontale avec le chapitre 08 §8.3 étape 3 (ligne 776) : « Total supérieur à 5 000 : `409 CASCADE_TOO_LARGE`, aucune suppression, renvoi vers une opération d'administration », repris par le chapitre 11 (ligne 168, « le refuse et renvoie vers une opération d'administration »). Le même seuil de 5 000 donne donc, selon le chapitre, soit une suppression possible moyennant élévation, soit un refus sec. Le chapitre 08 fait foi sur le chemin d'exécution et deux chapitres sur trois le disent : remplacer la dernière phrase de l'étape 1 du §5.7 par « Au-delà de 5 000 lignes atteintes au total — seuil configurable —, la suppression est refusée : `CASCADE_TOO_LARGE` (409), aucune suppression, renvoi vers une opération d'administration (chapitre 08 §8.3). » Supprimer toute mention d'une session élevée comme voie de dépassement du seuil.

---

## V10 — 05-permissions.md [majeur]
**Decision violee** : A14 (confirmation applicative de la suppression cascadante) et A23 (registre unique des codes d'erreur : un code par condition)

**Passage** : §5.7, lignes 380-381 : « Ce décompte est renvoyé avec `CONFIRMATION_REQUIRED` (409) […] Si le décompte serveur a changé entre les deux temps, la réponse est de nouveau `CONFIRMATION_REQUIRED` avec la nouvelle valeur. » ; tableau des codes, ligne 630 : « `CONFIRMATION_REQUIRED` | opération réservée sans jeton de confirmation ; suppression cascadante sans décompte confirmé | 409 »

**Correction a appliquer** : La même condition — confirmation d'exécution d'une suppression qui cascade — porte `CASCADE_CONFIRMATION_REQUIRED` au chapitre 08 (§8.3 étape 4, ligne 777, et registre ligne 1326) et `CONFIRMATION_REQUIRED` ici. Dans les deux occurrences du §5.7 relatives à l'**exécution** (étapes 1 et 2), écrire `CASCADE_CONFIRMATION_REQUIRED` (409). Au tableau ligne 630, retirer « ; suppression cascadante sans décompte confirmé » de la ligne `CONFIRMATION_REQUIRED` — qui ne doit plus couvrir que l'opération réservée sans jeton, c'est-à-dire la **concession** — et ne pas redéfinir `CASCADE_CONFIRMATION_REQUIRED`, qui appartient au chapitre 08.

---

## V11 — 07-historique.md [majeur]
**Decision violee** : A24

**Passage** : §6, l. 519 : « **Rétention : 90 jours** (A24), la même que les livraisons de webhooks dont ce journal est le filet. Elle est portée par `_basedb.retention_policy` sous l'objet `record_deletion` […] » ; repris en §10.4, l. 762, dans le tableau « Objet de `retention_policy` » : « | `record_deletion` | **90 jours** | `record_deletion` (§6) | », et en l. 1125 : « rétention 90 jours (A24) ».

**Correction a appliquer** : A24 déclare huit objets et le semis normatif de `_basedb.retention_policy` (02-catalogue.md, l. 1551-1556 : `record_revision`, `structure_revision`, `change_event`, `security_log`, `audit_log`, `webhook_delivery`, `catalog_tombstone`, `migration_error_sample`) en compte exactement huit — `record_deletion` n'y figure pas. Le chapitre 07 crée donc un neuvième objet de rétention en l'attribuant à A24. Correction : ajouter dans la table d'A24 la ligne « | Journal de suppression des enregistrements | 90 jours | » et, dans le commentaire de semis de 02-catalogue.md l. 1551-1556, la valeur `record_deletion 90 jours`. Variante stricte si la table d'A24 doit rester close : supprimer la ligne `record_deletion` du tableau de 07 §10.4 et réécrire l. 519 « Elle est celle de l'objet `webhook_delivery` de `_basedb.retention_policy` (90 jours, A24) », en retirant la mention « sous l'objet `record_deletion` ».

---

## V12 — 12-integration-ia.md [majeur]
**Decision violee** : A24

**Passage** : l. 381-383 : « le régime de partitions de « Schéma du catalogue `_basedb` ». Rétention : 24 mois, alignée sur le journal d'audit (A24). » ; confirmé l. 549 : « **Dépendances externes assumées** : `_basedb.ai_call` et son entrée de rétention […] ».

**Correction a appliquer** : `ai_call` n'est ni dans la table d'A24, ni dans le semis de `retention_policy` du chapitre 02 : le chapitre crée une entrée de rétention qu'aucune décision ne déclare, tout en citant A24. Correction : ajouter « | Journal des appels d'IA | 24 mois | » à la table d'A24 et `ai_call 24 mois` au commentaire de semis de 02-catalogue.md (l. 1551-1556). Variante stricte : remplacer l. 382-383 par « Rétention : celle de l'objet `audit_log` de `_basedb.retention_policy` (24 mois, A24) ; aucun objet de rétention propre n'est créé », et retirer « et son entrée de rétention » de la l. 549.

---

## V13 — 03-moteur-ddl-migrations.md [majeur]
**Decision violee** : A24

**Passage** : §13.5, l. 758-766 : « Les durées sont celles de `_basedb.retention_policy` (A24) ; aucune valeur n'est citée de mémoire ailleurs. » puis, dans le tableau qui suit : « | Propositions MCP `expired` | 30 jours | », « | Rapports de réconciliation sans dérive | 30 jours, et au plus un par base et par jour conservé au-delà de 7 jours | », « | Rapports portant au moins une dérive | conservés jusqu'à résolution explicite, puis 1 an | ».

**Correction a appliquer** : Le chapitre affirme ne citer aucune valeur de mémoire, puis en fixe quatre (30 jours, 30 jours, 7 jours, 1 an) pour trois objets absents de la table d'A24 et du semis de `retention_policy`. Seule la ligne « `migration.error_sample` | 30 jours » correspond à un objet déclaré (`migration_error_sample`). Correction : déclarer ces objets dans la table d'A24 et dans le semis du chapitre 02 sous les clés `mcp_proposal_expired` (30 jours), `reconciliation_report_clean` (30 jours) et `reconciliation_report_drift` (12 mois) ; ou, à défaut, remplacer les durées de ces trois lignes par le renvoi « objet `…` de `retention_policy` » sans chiffre, la phrase d'introduction étant alors tenue.

---

## V14 — 00-decisions-structurantes.md [mineur]
**Decision violee** : A23 — registre unique des codes d'erreur

**Passage** : L327 : « Un registre unique, publié en annexe de ce chapitre et porté par le paquet de types partagé, fixe un code par condition. » Cette annexe n'existe pas dans le fichier, alors que 02-catalogue.md L1509 et 04-types-de-champs.md L952 y renvoient explicitement (« publié en annexe du chapitre 00 »).

**Correction a appliquer** : Ajouter en fin de 00-decisions-structurantes.md l'annexe « Registre des codes d'erreur » consolidant les codes des chapitres 01 à 13 (un code, sa condition, son statut HTTP), ou corriger les renvois de 02 et 04 vers l'emplacement réel du registre.

---

## V15 — 12-integration-ia.md [bloquant]
**Decision violee** : A5 / « Périmètre du document » — le chapitre 02 fait autorité sur le catalogue ; A24 — une seule valeur de rétention par objet, toutes déclarées au chapitre 00

**Passage** : §6.1 Comptage : « CREATE TABLE _basedb.ai_call ( id uuid NOT NULL DEFAULT _basedb_local.uuid_generate_v7(), occurred_at timestamptz … ) PARTITION BY RANGE (occurred_at); CREATE INDEX ix_ai_call__tenant_id__occurred_at … » — puis « Risques et limites connues » 6 : « Dépendances externes assumées : _basedb.ai_call et son entrée de rétention ». Or le mot ai_call n'apparaît nulle part dans 02-catalogue.md, ni dans son bloc de rétentions (record_revision, structure_revision, change_event, security_log, audit_log, webhook_delivery, catalog_tombstone, migration_error_sample), ni dans le tableau A24.

**Correction a appliquer** : Déplacer le bloc DDL de _basedb.ai_call et son index dans 02-catalogue.md, « Domaine 4 — Intégrations et configuration », juste après _basedb.secret, avec la mention du régime de partitionnement mensuel déjà appliqué à audit_log. Ajouter « ai_call 24 mois » au commentaire de _basedb.retention_policy de 02 et la ligne « Appels aux fournisseurs d'IA | 24 mois » au tableau A24 de 00-decisions-structurantes.md. Dans 12 §6.1, remplacer le bloc SQL par : « Une ligne par tentative dans _basedb.ai_call, dont le DDL est donné par « Schéma du catalogue _basedb ». Rétention 24 mois (A24). » Supprimer la mention de ai_call et de son entrée de rétention du point 6 des « Risques et limites connues ».

---

## V16 — 13-authentification.md [bloquant]
**Decision violee** : Récapitulatif « ce que cette section attend du catalogue » à absorber par le chapitre 02 ; A5 — le catalogue a un détenteur unique

**Passage** : « ## 9. Ajouts demandés au catalogue | Objet | Ajout | Pourquoi | … `_basedb.auth_identity` | `failed_attempts smallint NOT NULL DEFAULT 0` | Verrouillage exact (§2.4) | `_basedb.auth_identity` | `locked_until timestamptz NULL` | Idem ». Or le DDL de 02-catalogue.md ne porte ni l'une ni l'autre : « CREATE TABLE _basedb.auth_identity ( id, user_id, provider, subject, password_hash, last_used_at, created_at, … ) ». Le verrouillage du §2.4 est donc non implémentable en l'état.

**Correction a appliquer** : Ajouter dans 02-catalogue.md, au DDL de _basedb.auth_identity, les deux colonnes `failed_attempts smallint NOT NULL DEFAULT 0` et `locked_until timestamptz NULL`. Supprimer intégralement la section « 9. Ajouts demandés au catalogue » de 13-authentification.md, y compris la phrase « Rien d'autre : le défi de réinitialisation réutilise `confirmation_challenge`… », et renuméroter les sections 10 en 9. Les codes d'erreur restent où ils sont (section « Codes d'erreur définis par ce chapitre »), A23 prévoyant qu'un chapitre verse ses codes au registre.

---

## V17 — 10-architecture-logicielle.md [mineur]
**Decision violee** : Renvoi entre chapitres pointant vers un contenu qui ne traite pas le sujet annoncé

**Passage** : §1.2 Les paquets : « | `apps/web` | Interface du chapitre 11 (§1.5). | Next 15, React, Tailwind 4, shadcn/ui, Zustand | ». Le §1.5 du chapitre 11 s'intitule « Au-delà de 100 000 lignes » et ne dit rien de la structure du paquet. Le §1.5 visé est celui du chapitre 10 lui-même : « `apps/web` : structure, état, absence de données simulées ».

**Correction a appliquer** : Remplacer par : « | `apps/web` | Interface du chapitre 11 ; structure du paquet, état et interdiction des données simulées au §1.5 ci-dessous. | Next 15, React, Tailwind 4, shadcn/ui, Zustand | »


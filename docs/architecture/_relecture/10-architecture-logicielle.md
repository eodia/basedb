# Constats de relecture croisee concernant 10-architecture-logicielle.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

### Contradiction C5 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

VERSION MINIMALE DE POSTGRESQL : QUATRE RÉPONSES. 01 question ouverte 1 : « Aucune règle de ce chapitre n'exige mieux que PostgreSQL 14 ». 02 : « PostgreSQL 15 minimum », avec refus de démarrage PG_VERSION_TOO_OLD, motivé par UNIQUE NULLS NOT DISTINCT. 06 : « Décision : PostgreSQL 15 est le minimum requis par cette section », motivé par security_invoker. 03 §1.1 : « basedb exige PostgreSQL ≥ 16 », code VERSION_POSTGRES_INSUFFISANTE. 04 : « PostgreSQL 16 », motivé par pg_input_is_valid. 08 §13.3 : « fixe la version minimale de PostgreSQL à 16 » (EXPLAIN GENERIC_PLAN). 10 §9.1 : « PostgreSQL 16 ou plus ». Deux codes d'erreur distincts existent pour le même refus de démarrage.

**Correction demandee** : Fixer PostgreSQL 16 dans le chapitre 00 et dans 10 §9.1 (c'est le plancher effectif : 03, 04 et 08 en dépendent techniquement), supprimer la question ouverte 1 de 01, corriger 02 et 06, et ne conserver qu'un seul code (VERSION_POSTGRES_INSUFFISANTE).

---

### Contradiction C6 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LA FONCTION uuid_generate_v7() VIT DANS CINQ ENDROITS DIFFÉRENTS. 02 : « CREATE FUNCTION public.uuid_generate_v7() … Installée par défaut dans public, délibérément hors de _basedb et des schémas b_* », schéma effectif relu dans setting('ddl.uuid_function_schema'), corps en LANGUAGE sql BEGIN ATOMIC. 03 §1.3 : « <util>.uuid_generate_v7() » dans BASEDB_UTIL_SCHEMA, corps en plpgsql. 04 §10 : « DEFAULT _basedb.uuid_generate_v7() … La fonction vit dans _basedb, comme toutes les fonctions partagées ». 06 : « <BASEDB_UTIL_SCHEMA>.uuid_generate_v7() ». 07 §3.2 : « _basedb.uuid_v7() », nom différent, construite sur pgcrypto. 10 §6.1/§9.1 : BASEDB_UTIL_SCHEMA, « public par défaut », figé par témoin. Or ce nom est écrit dans le DEFAULT de la colonne _id de TOUTES les tables utilisateur : le changer après coup exige un ALTER de toutes les tables (10 §6.4 le dit explicitement).

**Correction demandee** : Trancher une seule fois dans le chapitre 02 : un nom (uuid_generate_v7), un schéma (BASEDB_UTIL_SCHEMA, valeur par défaut à arbitrer entre public et _basedb), un corps de référence. Corriger 03 §1.3, 04 §10, 06 et 07 §3.2 pour y renvoyer sans le redéfinir. Le même arbitrage vaut pour set_updated_at().

---

### Contradiction C7 [bloquant]
**Chapitres impliques** : 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 10-architecture-logicielle.md, 02-catalogue.md
**Chapitre designe pour porter la correction** : 03-moteur-ddl-migrations.md

RELATIONS — LA CLAUSE ON DELETE RÉELLEMENT ÉMISE DIVERGE. 03 §9.7 décide explicitement : « Valeur au catalogue restrict (défaut) → clause émise ON DELETE NO ACTION, pg_constraint.confdeltype = 'a' », avec l'argument des suppressions multi-lignes, et interdit ON UPDATE autre que NO ACTION (§9.3). 04 §4.1 émet au contraire, mot pour mot : « ON DELETE RESTRICT ON UPDATE RESTRICT », et §4.1 quatrième point justifie « ON UPDATE RESTRICT est explicite bien que _id soit immuable ». 10 §3.4.5 étape 5 émet « ADD CONSTRAINT … FOREIGN KEY … ON DELETE RESTRICT NOT VALID ». Or la réconciliation de 02 (dérive A′) compare confdeltype et déclare : « action ON DELETE : 'a' (NO ACTION) est toujours une dérive », tandis que 06 dérive G exige « confdeltype doit valoir r, n ou c selon ce que le catalogue déclare ». Avec la décision de 03, la réconciliation de 02 et de 06 signalerait une dérive haute sur chaque clé étrangère du produit.

**Correction demandee** : Trancher dans 03 §9.7 (qui porte l'argumentation la plus complète) et propager : si NO ACTION est retenu, corriger les DDL émis de 04 §4.1 et 10 §3.4.5, et corriger la dérive A′ de 02 et la dérive G de 06 pour attendre 'a' quand le catalogue dit 'restrict'. Si RESTRICT est retenu, supprimer l'argumentation de 03 §9.7 et la remplacer par la contrainte correspondante.

---

### Contradiction C8 [bloquant]
**Chapitres impliques** : 04-types-de-champs.md, 03-moteur-ddl-migrations.md, 02-catalogue.md, 06-cycle-de-vie.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 04-types-de-champs.md

LE COUPLE NOT VALID / VALIDATE ET CREATE INDEX CONCURRENTLY SONT SIMULTANÉMENT INTERDITS ET OBLIGATOIRES. 04 §1.10 : « Une opération de structure est une transaction unique, sur le pool migrations. Le couple NOT VALID / VALIDATE CONSTRAINT n'est pas utilisé en v1. … Toute contrainte de cette section est donc ajoutée validante, en une commande », et §1.6 : « Décision v1 : CREATE UNIQUE INDEX, non concurrent, dans la transaction de l'opération de structure ». À l'inverse, 03 (§2.1, §7.1, §9.4), 06 (§2 principe 2, §4.1 étape 3, §6) et 10 (§3.4.1, §3.4.4, §3.4.5) construisent toute la machine à états sur des plans à plusieurs transactions avec NOT VALID puis VALIDATE et CREATE INDEX CONCURRENTLY. 02 stocke les témoins correspondants (fk_validated_at, check_validated_at, unique_index_valid), 03 §15 réclame fk_state/unique_state/check_state/required_state, et 04 §11.2 demande à l'inverse que « toute contrainte pg_constraint.convalidated = false dans un schéma b_* soit une anomalie, cette section n'en produisant aucune ». Les deux modèles ne peuvent pas coexister : ils produisent des plans, des états de catalogue et des règles de réconciliation opposés.

**Correction demandee** : Retenir le modèle en étapes de 03/06/10 (il est le seul compatible avec l'exigence du cadrage « comportement correct au-delà de 100 000 lignes » et avec la pose d'une FK sur une table volumineuse) et réécrire 04 §1.6, §1.10 et §11.2 pour s'y adosser au lieu de le contredire — 04 conservant la projection des types, les expressions et les pré-contrôles, qui sont sa vraie matière.

---

### Contradiction C9 [bloquant]
**Chapitres impliques** : 05-permissions.md, 07-historique.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

QUATRE ARCHITECTURES CONCURRENTES POUR L'HISTORIQUE ET LA BOÎTE D'ENVOI DES WEBHOOKS. (a) 07 §1.1 : capture par déclencheurs PostgreSQL AFTER … FOR EACH STATEMENT, écriture dans _basedb.record_revision et _basedb.change_event, dans la transaction de la donnée, sur le pool donnees — « jamais par écriture applicative » ; §4.5 : « si l'historique échoue, la donnée échoue ». (b) 08 §10.1 : « Deux pools, c'est deux connexions, donc deux transactions : écrire la livraison directement dans _basedb.webhook_delivery dans la transaction qui écrit la donnée est impossible » → boîte d'envoi « b_<tenantId>_<base>._outbox » dans le schéma de données, alimentée par déclencheur, drainée ensuite vers _basedb où sont écrits audit_log ET l'historique (tableau §10.1 : « Historique des données | _basedb | non — produit par le drain »). (c) 10 §3.3 : un troisième schéma « _basedb_local » colocalisé avec les données, portant record_history, domain_event, audit_buffer, écrits applicativement par le noyau, relayés toutes les 5 s vers _basedb. (d) 05 §4.4 : « _basedb.webhook_outbox », capturé sous le contexte système webhook.capture avec le masque du rôle du webhook. Les quatre se contredisent sur le lieu, le nom des tables, le mécanisme de capture (déclencheur vs applicatif), l'atomicité et la latence.

**Correction demandee** : Arbitrage structurant à porter dans le chapitre 00 puis à propager. Recommandation : retenir la capture par déclencheur (c'est la seule qui tienne la promesse « écriture SQL directe » du cadrage, argument décisif de 07 §1.1 et repris par 08 §10.1) et un lieu unique. Puis réécrire entièrement 10 §3.3 (supprimer _basedb_local ou en faire le nom retenu), 08 §10.1 et 05 §4.4 pour renvoyer à 07 sans redéfinir. Une seule table de boîte d'envoi, un seul nom pour la table d'historique.

---

### Contradiction C10 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 06-cycle-de-vie.md

RELATIONS — LA COLONNE D'AFFICHAGE : QUATRE COMPORTEMENTS INCOMPATIBLES À LA SUPPRESSION DU CHAMP DÉSIGNÉ. 02 « Colonne d'affichage » : display_field_id est nullable, « NULL est un état valide », et « Supprimer logiquement le champ d'affichage est refusé, pas compensé » → DISPLAY_FIELD_IN_USE, avec rejet explicite de l'alternative : « Alternative rejetée : un déclencheur rebasculant silencieusement la désignation vers le champ suivant ». 04 §1.11 étape 8 et §5 : « Champ d'affichage supprimé ou converti → bascule vers le candidat suivant selon la même règle ». 06 §4.5 c : « La désignation étant obligatoire, elle n'est jamais mise à NULL : le trigger du catalogue rebascule vers le candidat suivant … et, s'il n'en existe aucun, vers _id. Aucun refus. » 10 §7.5 : « La désignation d'affichage vaut _id dès la création : elle n'est jamais nulle » et « Bascule automatique et journalisée sur _id, jamais d'état sans désignation ». 07 §4.3 exige au contraire explicitement qu'« une table peut n'avoir aucune colonne d'affichage désignée ». La contrainte fk_display_field de 02 (is_live dans la clé) rend la bascule de 06/10 impossible sans déclencheur, que 02 interdit.

**Correction demandee** : Trancher dans 02 (autorité sur le catalogue) : soit le refus + NULL valide, soit la bascule automatique + jamais nulle. Recommandation : retenir le refus explicite de 02 — il est cohérent avec « mieux vaut un refus explicite qu'un effet silencieux » posé par le cadrage sur les relations, et une bascule change sans prévenir ce que voient tous les consommateurs de tous les liens. Puis corriger 04 §1.11/§5, 06 §4.5 c et 10 §7.5.

---

### Contradiction C13 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 05-permissions.md, 06-cycle-de-vie.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

REGISTRE DES CODES D'ERREUR INCOHÉRENT, ET PARTICULIÈREMENT SUR LES RELATIONS. Même condition, codes différents : refus de supprimer une table référencée → TABLE_REFERENCED (02), TABLE_REFERENCEE (03 §16, 06 §10, 10 §8.1), LIEN_TABLE_REFERENCEE (04 §12), SUPPRESSION_TABLE_REFUSEE_REFERENCE (05 §14). Valeurs orphelines à la pose d'une FK → VALEURS_LIEES_INVALIDES (03, 06, 10), LIEN_VALEURS_ORPHELINES (04), LIEN_DONNEES_INCOMPATIBLES (05). Écriture d'un lien vers une cible inexistante → LIEN_CIBLE_INTROUVABLE (04, 08), VALEUR_LIEN_INEXISTANTE (05), VALEUR_LIEN_INVALIDE (09), VALEUR_LIEE_INTROUVABLE (10). Suppression d'une ligne référencée → SUPPRESSION_REFUSEE_REFERENCE (05), ENREGISTREMENT_REFERENCE (08), LIGNE_REFERENCEE (03, 10). Doublons → VALEURS_DUPLIQUEES (03), UNICITE_DOUBLONS (04), VALEUR_DUPLIQUEE (05, 08, 10), VALEUR_DEJA_UTILISEE (09). S'ajoute un conflit de langue : 05 §7.1 pose comme règle pour tout le document « Tous les codes d'erreur sont des identifiants machine en français », 10 §8.1 la confirme, mais 02 emploie PG_VERSION_TOO_OLD, DB_ENCODING_NOT_UTF8, DB_NOT_OWNED, PHYSICAL_NAME_TAKEN, TABLE_REFERENCED, DISPLAY_FIELD_IN_USE, BASE_NOT_EMPTY, FIELD_CONFIG_MISSING. Enfin le même refus d'encodage porte deux codes : ENCODAGE_NON_SUPPORTE (01) et DB_ENCODING_NOT_UTF8 (02).

**Correction demandee** : Constituer dans @basedb/contracts un registre unique des codes, publié en annexe du chapitre 00, et n'autoriser chaque chapitre qu'à y ajouter, jamais à renommer. Appliquer la règle de 05 §7.1 (français, majuscules ASCII) en corrigeant les huit codes anglais de 02, et fusionner les cinq familles de doublons ci-dessus en un code par condition.

---

### Contradiction C16 [bloquant]
**Chapitres impliques** : 10-architecture-logicielle.md, 04-types-de-champs.md, 07-historique.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

UN SCHÉMA b_* NE PEUT PAS RÉFÉRENCER _basedb — SAUF QUE DEUX CHAPITRES L'EXIGENT. 10 §3.5 pose l'interdit : « Aucun objet d'un schéma b_* (vue, fonction, déclencheur) ne référence _basedb », avec « une seule exception, nommée » : uuid_generate_v7() et set_updated_at(), tous deux dans BASEDB_UTIL_SCHEMA et qui « ne lisent rien ». Or 04 §1.8 pose des index d'expression sur les tables utilisateur bâtis sur _basedb.fold_v1() et l'opclass _basedb.gin_trgm_ops, et 07 §1.2 pose sur chaque table utilisateur quatre déclencheurs appelant _basedb.tg_capture_v1() qui écrit dans _basedb.record_revision. L'un des trois chapitres doit céder, et l'interdit de 10 est la clé de la séparation physique future annoncée par le cadrage.

**Correction demandee** : Reformuler l'interdit de 10 §3.5 en fonction de l'arbitrage sur la capture (contradiction sur l'historique ci-dessus) : soit l'exception est élargie et nommée exhaustivement (fonctions partagées immuables + fonction de capture), soit fold_v1 et la fonction de capture migrent dans BASEDB_UTIL_SCHEMA, qui suit les données. Dans les deux cas, écrire ce que devient la dépendance le jour de la séparation physique.

---

### Contradiction C17 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 09-serveur-mcp.md, 10-architecture-logicielle.md, 07-historique.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LA TABLE _basedb.migration NE PEUT PAS ÊTRE IMPLÉMENTÉE EN L'ÉTAT. 02 : status CHECK IN ('proposed','applying','applied','failed','reverted'), sequence bigint NOT NULL, up_sql text NOT NULL, origin, checksum, catalog_diff, error_sample. 03 §4.2 exige « up_sql n'est pas un bloc de texte : c'est un tableau ordonné d'énoncés, en JSON », §4.4 exige sequence « nullable tant que la migration n'est pas passée en en_cours », et §14.3/§16 emploient les statuts en_cours, appliquee, echouee, interrompue. 03 §15 réclame en outre planner_version, executor_id, lease_until, attempts, scheduled_for, pg_sqlstate, pg_message, pg_detail, failed_statement_n, etape, duration_ms, pg_backend_pid. 09 §7.2 emploie les statuts anglais de 02 plus un état superseded absent des deux, et 09 §7.2 dit que « le CHECK de _basedb.migration.status défini en section 02 ne comporte pas d'état expiré ». 07 §7.1 ajoute encore une table migration_execution avec outcome IN ('running','success','failed','cancelled','unknown'). 10 §3.4.2 emploie en_cours/appliquee/echouee/interrompue. Quatre vocabulaires d'états pour une même colonne.

**Correction demandee** : Réécrire la table migration dans 02 en intégrant le §15 de 03 : un seul vocabulaire d'états (choisir le français de 03/10 ou l'anglais de 02, cohérent avec l'arbitrage de langue du catalogue), sequence nullable avec l'index unique partiel correspondant, up_sql en jsonb, et les colonnes de bail, de diagnostic et de planificateur. Ajouter les états superseded et, si retenu, expired.

---

### Contradiction C18 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 06-cycle-de-vie.md, 04-types-de-champs.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 01-conventions-nommage.md

COMBIEN DE DÉCLENCHEURS SUR UNE TABLE UTILISATEUR ? 01 §9.1 fixe un vocabulaire fermé de deux rôles : tg_<table>__systeme et tg_<table>__historique. 04 §1.14 le confirme : « Les deux seuls triggers du produit sont … Aucun type ne produit de trigger de validation ». 10 §3.5 n'en autorise qu'un : « Un seul déclencheur autorisé dans b_* : set_updated_at() ». 07 §1.2 en pose cinq : tg_<table>__systeme plus historique_ins, historique_upd, historique_del, historique_trunc, en déclinant « le rôle historique en quatre sous-rôles », ce que le vocabulaire fermé de 01 n'autorise pas. 08 §10.1 en ajoute un sixième, non nommé, pour alimenter _outbox. Côté catalogue, 02 déclare de son côté « Le catalogue ne comporte aucun autre déclencheur » que ck_field_config_present, alors que 06 §4.5 a et §4.6 en posent deux de plus sur _basedb.table_def et _basedb.field, et 05 §12 un troisième sur _basedb.app_user (DERNIER_ADMIN).

**Correction demandee** : Étendre le vocabulaire fermé de 01 §9.1 à la liste réelle des rôles retenus après l'arbitrage sur la capture, et faire de 07 §1.2 la liste normative des déclencheurs des schémas b_*. Corriger 04 §1.14 et 10 §3.5. Côté catalogue, corriger la phrase absolue de 02 (« aucun autre déclencheur ») ou supprimer les déclencheurs de 06 et 05 au profit de contraintes déclaratives.

---

### Contradiction C20 [majeur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

RELATIONS — NOM DE LA COLONNE DE CLÉ ÉTRANGÈRE. 01 §9.3 : « <table_cible> désigne le nom physique de la table cible tel qu'il figure au registre, sans transformation : une table clients donne clients_id », et pour un second lien vers la même cible « le moteur bascule sur <slug du libellé du champ>_id » (client_livre_id), dérogation assumée et signalée. 04 §4.4 et 09 §4.2 reprennent clients_id et client_livre_id. 02 « Nom d'un champ lien » impose au contraire un suffixe numérique : « avec un suffixe numérique (_2, _3…) si ce nom est déjà pris », porté par ck_field_link_name, et donne l'exemple « name = 'client_id' » (cible au singulier). 08 et 10 emploient systématiquement client_id (08 §4.5, §5.6, §8.2 ; 10 §3.4.2, §8.1). Le nom de la colonne étant un contrat SQL public et apparaissant dans toutes les charges utiles, la divergence est visible de bout en bout.

**Correction demandee** : Retenir la règle de 01 §9.3 (première occurrence <table_cible>_id, suivantes <slug du libellé>_id), corriger 02 pour que ck_field_link_name accepte les deux formes, et harmoniser tous les exemples de 08 et 10 sur clients_id. Trancher au passage la question ouverte 2 de 01.

---

### Contradiction C21 [majeur]
**Chapitres impliques** : 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

SÉRIALISATION JSON DES NOMBRES. 04 §2.3 : « JSON : les nombres sont sérialisés en chaîne … OpenAPI déclare type: string, format: decimal. Alternative rejetée : le nombre JSON natif, plus naturel et silencieusement faux », et §9 en fait une règle normative. 09 §11.2 confirme : « numeric rendu en chaîne pour ne pas perdre de précision … règles du noyau, communes à toutes les surfaces », et prévient explicitement contre « deux représentations d'une même donnée selon la surface ». 10 §5 confirme aussi : « numeric est rendu en chaîne décimale et jamais converti ». 08 §7.2 décide l'inverse : « number si precision − scale ≤ 15 et scale ≤ 6, sinon string décimale », avec « Alternative rejetée : chaîne décimale systématique ». L'écart change le schéma OpenAPI de chaque champ nombre.

**Correction demandee** : Aligner 08 §7.2 sur 04 §2.3 (chaîne systématique), ou porter la règle conditionnelle dans 04, 09 et 10. Recommandation : la chaîne systématique, déjà retenue par trois chapitres sur quatre et par le décodage de type du pilote posé en 10 §5.

---

### Contradiction C25 [majeur]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 07-historique.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

EXTENSIONS POSTGRESQL : AUCUNE, OU TROIS. 03 §1.2 : « Aucune extension n'est requise, et le moteur n'en installe aucune », avec tableau de rejet (uuid-ossp, pgcrypto, pg_stat_statements). 10 §9.1 : « Aucune extension n'est requise ». 02 emploie gen_random_uuid() du cœur. Mais 04 §1.8 installe pg_trgm (« CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA _basedb ») et en fait un prérequis du filtre « contient » indexé, plus la collation ICU und-x-icu dont l'absence est un refus de démarrage (PREREQUIS_ICU_ABSENT). 08 §13.5 exige pg_trgm ET unaccent (« L'installation de unaccent et pg_trgm est une dépendance d'installation »), question ouverte 4 reconnaissant que le rôle peut ne pas en avoir le droit. 07 §3.2 construit _basedb.uuid_v7() « sur clock_timestamp() et gen_random_bytes() de pgcrypto — extension de confiance ».

**Correction demandee** : Trancher dans 10 §9.1 (autorité sur les hypothèses d'environnement) la liste close des extensions et collations exigées, avec le comportement de repli documenté quand elles manquent. Puis corriger 03 §1.2 pour qu'il cesse d'affirmer « aucune », et supprimer la dépendance à pgcrypto de 07 §3.2 (gen_random_uuid est dans le cœur depuis PG13).

---

### Contradiction C26 [majeur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

VERROUS CONSULTATIFS : hashtext() EST À LA FOIS IMPOSÉ ET INTERDIT. 01 §6.4 fixe la clé : « SELECT pg_advisory_xact_lock(1650552165, hashtext(<portee_id>::text)) ». 03 §5.1 et §14.3, 06 §2.4 et 07 §7.1 la reprennent telle quelle. 02 décide l'inverse dans ses décisions retenues : « Verrous consultatifs à constantes écrites en dur | hashtext() n'est pas documentée et a déjà changé d'algorithme | Alternative écartée : pg_advisory_lock(hashtext('basedb.catalog')) », et emploie « ('x' || right($base_id::text, 8))::bit(32)::int ». 10 §9.2 étape 4 emploie pourtant exactement la forme que 02 rejette : « pg_advisory_lock(hashtext('basedb.catalog')) ». S'ajoutent trois espaces de clés distincts (1650552165 en 01/03/06, 1734112001 en 02, 1650552166 en 07, 7460410000000001 en 02) sans registre commun.

**Correction demandee** : Créer dans 02 un registre unique des classes de verrous consultatifs (constante, dérivation de la seconde clé, portée, durée) et y renvoyer depuis 01 §6.4, 03 §5.1, 06 §2.4, 07 §7.1 et 10 §9.2. Trancher au passage la question ouverte 1 de 03 (hashtext contre clé entière stockée au catalogue).

---

### Contradiction C27 [majeur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 05-permissions.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

NOMS DES POOLS ET POOL QUI PORTE LE DDL. 01 §10.3 définit trois pools catalogue / donnees / migrations et place les opérations de structure sur migrations. 05 §6.3 et 07 reprennent ces trois noms. 04 §1.10 : « sur le pool migrations ». 02 principe 5 dit le contraire : « toute opération de structure — DDL sur b_* et écriture du catalogue — s'exécute sur une connexion unique, celle du pool catalogue ». 03 (§2.1, §5.2) et 10 §3.1 emploient une troisième nomenclature : catalog / data / ddl, le DDL allant sur ddl. Trois jeux de noms et deux affectations différentes pour la même connexion.

**Correction demandee** : Fixer une seule nomenclature (recommandation : catalogue / donnees / ddl, cohérente avec le reste du document en français) et une seule affectation (le pool dédié au DDL), dans 10 §3.1 qui porte déjà le tableau le plus complet. Corriger le principe 5 de 02 et les tableaux de 01 §10.3 et 03 §5.2, qui doivent devenir des renvois.

---

### Contradiction C30 [majeur]
**Chapitres impliques** : 02-catalogue.md, 05-permissions.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 05-permissions.md

LES VUES ENREGISTRÉES EXISTENT ET N'EXISTENT PAS. 01 §1 définit « Vue » comme un objet de catalogue, et 02 en donne le DDL (_basedb.view_def, avec kind, spec jsonb, uq_view_name_live) puis précise « Les vues personnelles sont hors périmètre v1 ». 06 §4.6 traite le cas « filtre ou tri d'une vue enregistrée → vue marquée invalide » et la cascade logique des vues. 07 §7.2 liste 'view' parmi les object_kind de structure_revision. 05 §9 décide l'inverse : « Les vues enregistrées ne sont pas au périmètre v1. Ni vue SQL, ni présentation enregistrée : le catalogue ne connaît que bases, tables, champs, applications et enregistrements. » 10 §1.5 place l'état de grille (colonnes visibles, largeurs, tri local) dans Zustand, donc côté client, sans persistance.

**Correction demandee** : Trancher : soit view_def reste au périmètre v1 et 05 §9 est corrigé avec le régime de permission d'une vue enregistrée (qui n'est qu'une présentation, donc suit la table), soit view_def sort du DDL de 02, des cascades de 06 §4.6 et de l'énumération de 07 §7.2.

---

### Contradiction C32 [majeur]
**Chapitres impliques** : 04-types-de-champs.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

_updated_at : now() OU clock_timestamp() ? 04 §10 « Exigences adressées au moteur DDL » : « Le trigger emploie clock_timestamp(), jamais now(). now() renvoie l'heure de début de transaction : un UPDATE de masse … estamperait des millions de lignes à l'heure où il a commencé. » 08 §3.2 et §6.5 en font une condition de la reprise incrémentale : « renseigné par déclencheur avec clock_timestamp(), jamais avec now() ni par le code applicatif … donc strictement croissant par ligne ». 10 §3.5 définit la fonction avec now() : « set_updated_at() … positionne NEW."_updated_at" = now() et ne lit rien d'autre ». Avec now(), le filigrane de reprise de 08 §6.5 et l'index de synchronisation de 04 §10 cessent d'être corrects.

**Correction demandee** : Corriger 10 §3.5 (et la ligne correspondante des décisions retenues) pour employer clock_timestamp(), et faire du corps de set_updated_at() une définition unique au même endroit que uuid_generate_v7().

---

### Contradiction C33 [majeur]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 05-permissions.md

AUTHENTIFICATION DE L'INTERFACE : COOKIE DIRECT OU JETON D'ACCÈS COURT. 05 §2.1 décrit une session portée par un cookie « HttpOnly, Secure, SameSite=Lax, chemin racine », avec contrôle d'Origin sur toute requête mutante (ORIGINE_REFUSEE). 10 §1.5 décrit la même chose : « apps/api pose un cookie de session httpOnly, Secure, SameSite=Lax … Un composant serveur Next.js qui appelle l'API retransmet le cookie de la requête entrante ». 08 §2.2 décide l'inverse : « le cookie de session n'est accepté que par les routes d'authentification. Le front échange son cookie contre un jeton d'accès de 15 minutes, porté en Authorization: Bearer sur tous les appels /api/v1 », avec cookie en SameSite=Strict et en-tête X-Basedb-Csrf. Les trois chapitres décrivent deux mécanismes incompatibles, et 05 §2.1 comme 10 §1.5 ignorent l'existence du jeton d'accès de 15 minutes.

**Correction demandee** : Trancher dans 08 §2.2 (l'argumentation CSRF y est la plus solide) et propager : corriger l'attribut SameSite et le mode d'appel dans 05 §2.1 et 10 §1.5, et décrire la route d'échange et la durée du jeton d'accès dans le chapitre qui possédera l'authentification (voir le trou correspondant).

---

### Contradiction C34 [majeur]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LES LETTRES DE DÉRIVE DE RÉCONCILIATION SE TÉLESCOPENT. 02 définit sept classes A, A′, B, C, C′, D, E, F, G (D = nom réservé sans objet physique, E = CHECK de liste, F = COMMENT ON, G = index de FK du catalogue). 03 §11.2 en définit seize, A à P, avec des sens différents (D = index invalide, E = ON DELETE divergent, F = nullabilité, G = type physique). 06 §7 « ajoute trois classes de dérive » E, F, G avec un troisième sens (E = alias, F = relégation, G = liens). 07 §6.3 introduit encore « la dérive D » pour la carte figée des déclencheurs. 10 §3.4.4 introduit sa propre « Dérive D » (index indisvalid) et §7.5 exige un post-test sur « les dérives A, B et C de 02, plus la dérive D du §3.4.4 » — soit un mélange de deux nomenclatures. Un rapport de réconciliation nommant « dérive E » serait inexploitable.

**Correction demandee** : Constituer un catalogue unique des classes de dérive, numérotées par chapitre d'origine (par exemple CAT-A…, DDL-A…, CYCLE-A…, HIST-A…) ou renumérotées d'un bout à l'autre, dans le chapitre 02 qui porte la réconciliation de référence, et corriger les renvois de 03 §11.2, 06 §7, 07 §6.3 et 10 §3.4.4/§7.5/§8.5.

---

### Contradiction C35 [majeur]
**Chapitres impliques** : 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

TROIS MÉCANISMES D'IDEMPOTENCE, DANS TROIS ENDROITS. 08 §3.3 : table « b_<tenantId>_<base>._idempotency » dans le schéma de données, contrainte d'unicité (token_id, cle), états en_cours/termine, rétention 24 h, avec cinq codes IDEMPOTENCE_*. 09 §6.3 : « Le noyau mémorise le couple (jeton, outil, empreinte des paramètres normalisés) → réponse rendue, dans _basedb.cle_idempotence, avec une durée de vie de 24 heures », code CLE_IDEMPOTENCE_REUTILISEE. 10 §4.5 : « persistée dans une colonne à contrainte d'unicité de _basedb.migration », fenêtre de 10 minutes, code MIGRATION_EN_COURS. Aucun des trois n'est décrit dans 02, et 08 place de surcroît une table système dans un schéma utilisateur b_*, ce que la réconciliation de 01 §11.4 et 02 (dérives C/D) signalerait comme un objet physique inconnu du registre.

**Correction demandee** : Unifier en un seul mécanisme et un seul emplacement, décrit dans 02 : une table d'idempotence pour les opérations de données (avec la portée acteur retenue) et la colonne d'unicité de migration pour les opérations de structure. Si une table doit vivre dans un schéma b_*, l'inscrire explicitement au registre des noms physiques et l'exclure des dérives.

---

### Contradiction C37 [mineur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

EXEMPLES DE tenantId NON CONFORMES. 01 §5 fixe « exactement 7 caractères, toujours 't' + 6 » et pose la règle de lecture par position, avec une note explicite : « Les exemples illustratifs b_t4z56f_crm n'en comptent que 6 ; ils doivent se lire b_t4z56fq_crm. La règle prévaut sur l'exemple ». Or 02 emploie encore « b_t4z56f_crm » dans l'argumentaire du registre physical_object, et 10 l'emploie quatre fois dans du SQL d'exemple (§3.4.2, §9.1, §9.7). 09 question ouverte 6 signale précisément ce point et demande l'alignement des sections 01, 02, 03, 04 et 08.

**Correction demandee** : Remplacer toutes les occurrences de b_t4z56f_ par b_t4z56fq_ dans 02 et 10, et fermer la question ouverte 6 de 09.

---

### Doublon D2
RÉCONCILIATION CATALOGUE ↔ pg_catalog — spécifiée cinq fois : 01 §11.4 (registre vs pg_namespace/pg_class/pg_attribute/pg_constraint), 02 « Réconciliation » (sept classes, régime REPEATABLE READ), 03 §11 (seize classes, réconciliation de forme), 06 §7 (trois classes de plus), 07 §6.3 (carte des déclencheurs), 10 §9.5 (mode dégradé et trois issues). AUTORITÉ : 02 pour le régime d'exécution, le catalogue des classes et les requêtes ; les autres chapitres n'ajoutent que leurs classes propres, dans la numérotation de 02, et 10 §9.5 garde les issues de réparation.

---

### Doublon D3
POSE D'UN CHAMP LIEN — le plan complet est écrit quatre fois : 03 §9.4 (chemin prudent en trois temps), 04 §4.1 (chemins a et b), 10 §3.4.5 (six étapes numérotées), 06 §6 (restauration). AUTORITÉ : 03 pour le plan, l'ordre et les verrous ; 04 pour la projection, le type, les contraintes et les pré-contrôles ; 10 se réduit à un renvoi. Les trois versions divergent aujourd'hui sur la clause ON DELETE émise et sur l'usage de NOT VALID.

---

### Doublon D6
COLONNE D'AFFICHAGE — spécifiée six fois : 02 (contraintes déclaratives, règles de service), 04 §5 (types éligibles, cas limites), 06 §4.5 c (bascule), 07 §4.3 (exigence de colonne stockée), 09 §4.3 (projection), 10 §7.5 (tests). AUTORITÉ : 02 pour la contrainte et la désignation par défaut, 04 §5 pour les types éligibles et les cas limites. Les autres doivent renvoyer, pas redécider.

---

### Doublon D9
POOLS ET PARAMÈTRES DE CONNEXION — le tableau est donné trois fois avec des valeurs différentes : 01 §10.3 (lock_timeout 1s/5s, statement_timeout 30s/300s), 03 §5.2 (écarts par étape), 10 §3.1 (tailles, files, délais d'acquisition, 20s/5s). AUTORITÉ : 10 §3.1, qui porte le dimensionnement et le contrôle de préflux ; 01 §10.3 conserve les seuls paramètres sémantiques (search_path, TimeZone, DateStyle, IntervalStyle) ; 03 §5.2 conserve les seuls écarts par étape.

---

### Doublon D10
ÉCRITURES DE MASSE ET SEUILS — spécifiés deux fois avec deux jeux de seuils : 04 §1.10 (seuil_lots 1 000 000, seuil_reecriture_annoncee 100 000, ANALYZE final) et 07 §5 (history.bulk_threshold 500 lignes cumulées, plafond dur 100 000, bulk_operation). AUTORITÉ : 07 pour le volume d'historique, 04 pour le DDL et la réécriture de table. Les deux doivent se citer.

---

### Doublon D11
TRADUCTION DES SQLSTATE — donnée cinq fois, avec cinq jeux de codes : 03 §5.4, 05 §5.5, 08 §7.3, 09 §14.4, 10 §8.2. AUTORITÉ : 10 §8.2, qui pose « un seul endroit de traduction : l'exécuteur de requêtes du noyau ». Les quatre autres doivent devenir des renvois, ce qui résoudra du même coup la contradiction sur les codes de relation.

---

### Doublon D14
IDEMPOTENCE — trois fois : 08 §3.3, 09 §6.3, 10 §4.5. AUTORITÉ : 10 §4.5 pour les opérations de structure, 08 §3.3 pour les opérations de données, 09 renvoie aux deux.

---

### Reference cassee R2
C:\data\dev\basedb\docs\architecture\01-conventions-nommage.md §9.1 : « La fonction appelée par ces triggers est unique et partagée, écrite en dur dans _basedb (section 02) : il n'y a jamais une fonction par table ». 02 ne définit aucune fonction de déclencheur ; seul 07 §1.3 définit _basedb.tg_capture_v1() et seul 10 §3.5 définit set_updated_at(), dans BASEDB_UTIL_SCHEMA et non dans _basedb.

---

### Reference cassee R4
C:\data\dev\basedb\docs\architecture\07-historique.md §11.1 point 2 : « tg_<table>__systeme (section 03) honore les valeurs fournies de _id, _created_at et _created_by quand basedb.restauration = 'on' … C'est une exigence adressée à la section 03 ». 03 ne décrit ni le corps ni le comportement de ce déclencheur, et 10 §3.5 définit set_updated_at() sans aucune notion de mode restauration.

---

### Reference cassee R5
C:\data\dev\basedb\docs\architecture\02-catalogue.md, table webhook_delivery : « son détail relève de “API REST, OpenAPI, webhooks, jetons d'intégration” ». C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §10.6 : « webhook_delivery est partitionnée par mois (section “Schéma du catalogue _basedb”) ». Renvoi circulaire : la table n'a de DDL dans aucun des deux, et 08 §10.6 emploie des colonnes (partition_key, statut, prochaine_tentative_a) que 02 ne connaît pas.

---

### Reference cassee R14
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §7.5 et §7.8 : « le harnais exécute les requêtes de dérive A, B et C de “Schéma du catalogue _basedb”, plus la dérive D du §3.4.4 ». 02 définit A, A′, B, C, C′, D, E, F, G, où D désigne autre chose que la dérive D de 10 §3.4.4, et 03, 06 et 07 emploient encore d'autres jeux de lettres. Le critère de sortie de phase 2 « Post-test de dérive A, B, C, D à zéro » n'est donc pas interprétable.

---

### Reference cassee R15
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §3.5 : « Le slug basedb est par ailleurs ajouté aux noms de base réservés de “Conventions de nommage” ». 01 §4 décide l'inverse : « Aucun contrôle de mot réservé, de préfixe pg_ ni de nom de schéma réservé ne s'applique au slug de base », et la liste de 01 §4 ne contient pas basedb.

---

### Reference cassee R16
C:\data\dev\basedb\docs\architecture\03-moteur-ddl-migrations.md §1.3 : uuid_generate_v7() et set_updated_at() « sont des objets du produit, créés et maintenus par les migrations système de _basedb » et leur absence est « la dérive M ». Ni 02 (qui possède les migrations de catalogue) ni aucun autre chapitre ne livre le DDL de set_updated_at() dans le schéma que 03 désigne ; seul 10 §3.5 en donne un corps, avec now() au lieu de clock_timestamp().

---

### Trou de couverture T1 — L'interface utilisateur (grille, édition en ligne, vue détail, éditeur de schéma)
Le cadrage consacre une rubrique entière à l'UI : « React avec shadcn/ui. Grille de données, édition en ligne, vue détail d'un enregistrement, éditeur de schéma. Aucune donnée mockée ou en dur : tout passe par l'API réelle, y compris les états vides et les erreurs. » Aucun chapitre ne la traite. 10 §1.5 couvre uniquement la structure du paquet apps/web (arborescence, Zustand pour l'état d'interface, trois contrôles d'absence de données simulées) et déclare lui-même : « Aucun autre chapitre du document ne couvre l'interface ; ce qui suit fixe donc sa structure et ses règles de dépendance, pas son ergonomie. » Ne sont spécifiés nulle part : le comportement de la grille (colonnes, largeurs, gel, pagination visuelle, sélection multiple), l'édition en ligne (validation optimiste, conflit 412 CONFLIT_VERSION, champs en lecture seule, formules), la vue détail, l'éditeur de schéma (création de table, de champ, choix du type, désignation de la colonne d'affichage), les états vides, les états d'erreur, ni la restitution des états intermédiaires que 03 introduit (champ « obligatoire, mise en place en cours », base en mode dégradé, migration en cours).

**Ou le traiter** : Un chapitre 11 « Interface » dédié, ou une extension substantielle de 10 §1.5. À défaut, le document ne permet pas de démarrer la phase 3 côté front.

---

### Trou de couverture T3 — Intégration des fournisseurs d'IA (OpenAI, Anthropic, Mistral)
Le cadrage demande : « Intégration OpenAI, Anthropic et Mistral. Modèle configurable au niveau instance, surchargeable par tenant. Clés stockées côté serveur, jamais exposées au front. » Seules les briques périphériques existent : 02 définit _basedb.secret (clé 'ai.openai.api_key', chiffrement, key_version) et la résolution instance/tenant, 05 §8 fait de la surcharge au niveau tenant une opération réservée et interdit la relecture des clés, 10 §6.3 pose le chiffrement AES-256-GCM/HKDF et « aucun appel à un fournisseur d'IA ne part du navigateur », 10 §6.2 fait du modèle d'IA la seule surcharge par tenant. Manquent entièrement : à quoi sert l'IA dans le produit (aucun cas d'usage n'est nommé), quelle surface l'appelle, l'abstraction multi-fournisseurs, la liste des modèles admissibles et sa validation, les quotas et le coût, le traitement des erreurs et des délais du fournisseur, la journalisation des appels, et le fait que 05 §1.1 pose que « l'IA n'est pas un sujet mais est porteuse de l'autorité d'un sujet » sans dire par quel chemin.

**Ou le traiter** : Une section dédiée, soit dans un chapitre 12 « IA », soit en annexe du chapitre 10, qui possède déjà les secrets et la configuration. 10 §10 exclut d'ailleurs explicitement « l'intégration des fournisseurs d'IA » de la phase 2 sans dire qui la porte.

---

### Trou de couverture T4 — Authentification par mot de passe et OAuth
Le cadrage tient en une ligne — « Mot de passe et OAuth » — et le sujet est orphelin. 02 donne la table auth_identity (provider 'password' | 'oidc:<slug>', password_hash argon2id, uq_identity_one_password_per_user) et c'est tout. 05 §2.1/§2.2 décrit la session et l'élévation par « ré-authentification (mot de passe ou WebAuthn) », §12 l'amorçage et le secret d'amorçage. 08 §1.4 place /auth/* « hors périmètre de ce chapitre ». 10 §1.2 met « OAuth et mots de passe » dans apps/api et §10 les exclut du noyau de phase 2. Résultat : personne ne spécifie la configuration des fournisseurs OIDC (table, découverte, clientId/secret, scopes, redirection), le rattachement d'une identité OAuth à un compte existant, la création de compte à la première connexion, la politique de mot de passe, la réinitialisation, le verrouillage après échecs, la vérification d'adresse, ni le canal de courriel dont dépendent 05 §2.2 (notification de changement de rôle) et 05 question ouverte 3.

**Ou le traiter** : Un chapitre dédié, ou une section de 05, qui possède déjà la session, l'élévation et l'amorçage. Le paramètre « fournisseur OAuth » apparaît dans 10 §6.2 sans table de configuration correspondante dans 02.

---

### Trou de couverture T5 — La première tranche verticale attendue en fin de phase 3
Le cadrage la décrit précisément : « une base, une table, quatre types de colonnes, la grille, la doc générée, l'API en lecture-écriture, le MCP en lecture ». Aucun chapitre ne la décrit comme un tout. 10 §7.8 point 8 définit un critère de sortie de phase 2 voisin mais différent (« une base, une table, les quatre types de colonnes de la tranche verticale, créées et peuplées exclusivement par les opérations du noyau, sans API ni interface ») et ne nomme pas les quatre types. 09 §2.4 identifie « le MCP en lecture » au lot 1 de six outils. Rien ne dit quels sont les quatre types de colonnes, ce que « la grille » doit savoir faire à ce stade, ce que « la doc générée » recouvre (OpenAPI seul, ou documentation lisible), ni quels critères de sortie de phase 3 en découlent.

**Ou le traiter** : Chapitre 00, rubrique « Méthode de réalisation », en nommant les quatre types et en donnant des critères de sortie de phase 3 symétriques de ceux de 10 §7.8.


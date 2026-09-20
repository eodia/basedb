# Constats de relecture croisee concernant 03-moteur-ddl-migrations.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

### Contradiction C1 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

DEUX REGISTRES DE NOMS PHYSIQUES CONCURRENTS. Le chapitre 01 §6.3 définit « _basedb.nom_physique » avec les colonnes portee_id, portee_nature, nom, objet_id, objet_nature, etat (actif/relegue/retire/alias/purge), version_slug, et pose comme invariant : « Elle est le seul détenteur du nom physique. Les tables d'objets du catalogue référencent leur nom par clé étrangère et ne dupliquent jamais la chaîne. » Le chapitre 02 définit à la place « _basedb.physical_object » (schema_name, rel_name, object_kind, owner_kind, owner_id, released_at) ET stocke les noms en clair dans des colonnes texte (base.schema_name, table_def.physical_name, field.physical_name) — exactement la duplication que 01 interdit. Les chapitres 03 (§5.4, §6.1), 04 (§1.2, §11.1), 06 (§1.1) et 07 (§1.2) citent tous « _basedb.nom_physique », qui n'existe pas dans le DDL de 02. Le chapitre 06 §4.1 écrit même « UPDATE _basedb.field SET physical_name_id = $nouvelle_ligne_de_registre », colonne absente de 02.

**Correction demandee** : Trancher pour un registre unique et une seule représentation. Recommandation : conserver la table registre de 01 (elle porte les cinq états et l'historique des noms, indispensables à la purge, à la restauration et aux alias), lui donner son DDL dans le chapitre 02 sous un nom unique, et supprimer de 02 les colonnes physical_name/schema_name au profit d'une FK vers le registre (avec une vue de confort pour la lisibilité). Reporter dans 02 les contraintes CHECK d'alphabet et d'octets, et y ajouter la vue _basedb.v_nom_physique_qualifie que 01 §11.4 réclame.

---

### Contradiction C2 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

MOTIFS DES NOMS DÉRIVÉS INCOMPATIBLES — DIRECTEMENT SUR LES RELATIONS. 01 §9.1 fixe « fk_<table>__<colonne> » → fk_factures__clients_id, « ix_<table>__<colonne> », « uq_<table>__<colonne> », « ck_<table>__<colonne>__<regle> », « pk_<table> », avec répartition de budget par composant (§9.6). 02 « Budget de longueur des noms physiques » fixe au contraire « fk_<field.name>_<id12> » → fk_client_id_018f3c2a91b4, « ix_<field.name>_<id12> », « uq_<field.name>_<id12> », « ck_<field.name>_<id12> », « nn_<field.name>_<id12> », en argumentant que « Le désambiguateur est placé avant la partie variable, jamais après ». 03, 04 et 09 emploient systématiquement les motifs de 01 (fk_factures__clients_id). 08 §0 I5 cite une troisième forme encore : « fk_factures__client_id__clients ». Les deux conventions sont mutuellement exclusives et le budget d'octets de chacune est calculé sur l'autre hypothèse.

**Correction demandee** : Retenir les motifs de 01 §9.1 (ils sont normatifs, lisibles dans un message d'erreur PostgreSQL, et déjà repris par 03, 04, 06, 07 et 09) et réécrire la section « Budget de longueur des noms physiques » de 02 pour s'y conformer, en remplaçant le désambiguateur <id12> par la boucle de suffixe et la répartition de budget du §9.6. Corriger l'occurrence « fk_factures__client_id__clients » de 08 §0.

---

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

### Contradiction C13 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 05-permissions.md, 06-cycle-de-vie.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

REGISTRE DES CODES D'ERREUR INCOHÉRENT, ET PARTICULIÈREMENT SUR LES RELATIONS. Même condition, codes différents : refus de supprimer une table référencée → TABLE_REFERENCED (02), TABLE_REFERENCEE (03 §16, 06 §10, 10 §8.1), LIEN_TABLE_REFERENCEE (04 §12), SUPPRESSION_TABLE_REFUSEE_REFERENCE (05 §14). Valeurs orphelines à la pose d'une FK → VALEURS_LIEES_INVALIDES (03, 06, 10), LIEN_VALEURS_ORPHELINES (04), LIEN_DONNEES_INCOMPATIBLES (05). Écriture d'un lien vers une cible inexistante → LIEN_CIBLE_INTROUVABLE (04, 08), VALEUR_LIEN_INEXISTANTE (05), VALEUR_LIEN_INVALIDE (09), VALEUR_LIEE_INTROUVABLE (10). Suppression d'une ligne référencée → SUPPRESSION_REFUSEE_REFERENCE (05), ENREGISTREMENT_REFERENCE (08), LIGNE_REFERENCEE (03, 10). Doublons → VALEURS_DUPLIQUEES (03), UNICITE_DOUBLONS (04), VALEUR_DUPLIQUEE (05, 08, 10), VALEUR_DEJA_UTILISEE (09). S'ajoute un conflit de langue : 05 §7.1 pose comme règle pour tout le document « Tous les codes d'erreur sont des identifiants machine en français », 10 §8.1 la confirme, mais 02 emploie PG_VERSION_TOO_OLD, DB_ENCODING_NOT_UTF8, DB_NOT_OWNED, PHYSICAL_NAME_TAKEN, TABLE_REFERENCED, DISPLAY_FIELD_IN_USE, BASE_NOT_EMPTY, FIELD_CONFIG_MISSING. Enfin le même refus d'encodage porte deux codes : ENCODAGE_NON_SUPPORTE (01) et DB_ENCODING_NOT_UTF8 (02).

**Correction demandee** : Constituer dans @basedb/contracts un registre unique des codes, publié en annexe du chapitre 00, et n'autoriser chaque chapitre qu'à y ajouter, jamais à renommer. Appliquer la règle de 05 §7.1 (français, majuscules ASCII) en corrigeant les huit codes anglais de 02, et fusionner les cinq familles de doublons ci-dessus en un code par condition.

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

### Contradiction C28 [majeur]
**Chapitres impliques** : 03-moteur-ddl-migrations.md, 04-types-de-champs.md
**Chapitre designe pour porter la correction** : 03-moteur-ddl-migrations.md

MATRICE DE CONVERSION DES TYPES CONTRADICTOIRE, Y COMPRIS SUR LE TYPE LIEN. 03 §8.2 : « → lien : interdit sans exception. Fabriquer une FK à partir de valeurs textuelles suppose de résoudre des identifiants : c'est un import de données, pas une opération de structure », et « formule : ni convertible, ni cible de conversion ». 04 §8 autorise les deux : ligne « Texte → Lien : par _id seul » (avec le chemin (b) du §4.1 et le pré-contrôle d'orphelins), et ligne « Formule → Texte/Nombre/Booléen/Date/Date-heure : ✔ matérialise », décrit comme « la sortie de secours quand une formule devient trop contrainte ». 03 §8.1 impose en outre que la conversion conserve « le même libellé et le même nom physique — la ligne de registre n'est pas touchée », tandis que 04 §8 étape 3 crée « un champ du type cible, avec un nom physique neuf alloué par le registre » et étape 6 « Le nom physique reste le nouveau ».

**Correction demandee** : Fusionner les deux matrices en une seule, dans 04 §8 (qui possède les expressions de conversion et pg_input_is_valid), et supprimer la matrice de 03 §8.2 au profit d'un renvoi. Trancher explicitement le sort du nom physique lors d'une conversion, en cohérence avec la règle « un nom n'est jamais réattribué » de 01 §6.3.

---

### Contradiction C29 [majeur]
**Chapitres impliques** : 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md
**Chapitre designe pour porter la correction** : 03-moteur-ddl-migrations.md

PLAFOND D'ATTRIBUTS PAR TABLE : TROIS COUPLES DE SEUILS. 03 §3.3 : « Colonnes physiques occupées par table | 400, avertissement à 250 », code TROP_DE_COLONNES. 04 §1.13 : « L'écran de schéma alerte à 1 200, et le moteur refuse toute opération consommant un attribut à 1 500 », code TABLE_ATTRIBUTS_EPUISES. 06 §8.1 : « un seuil d'alerte à 1000 puis un plafond dur à 1400 », code TABLE_SATUREE, plus un avertissement à 25 colonnes reléguées. Trois seuils et trois codes pour la même limite PostgreSQL de 1 600 attributs.

**Correction demandee** : Retenir un seul couple de seuils et un seul code, dans 04 §1.13 (qui porte l'analyse la plus complète du cycle de vie des attributs), et remplacer les tableaux de 03 §3.3 et 06 §8.1 par un renvoi. Le seuil de 400 colonnes de 03 doit soit disparaître, soit être requalifié en borne de plan et non de table.

---

### Contradiction C34 [majeur]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LES LETTRES DE DÉRIVE DE RÉCONCILIATION SE TÉLESCOPENT. 02 définit sept classes A, A′, B, C, C′, D, E, F, G (D = nom réservé sans objet physique, E = CHECK de liste, F = COMMENT ON, G = index de FK du catalogue). 03 §11.2 en définit seize, A à P, avec des sens différents (D = index invalide, E = ON DELETE divergent, F = nullabilité, G = type physique). 06 §7 « ajoute trois classes de dérive » E, F, G avec un troisième sens (E = alias, F = relégation, G = liens). 07 §6.3 introduit encore « la dérive D » pour la carte figée des déclencheurs. 10 §3.4.4 introduit sa propre « Dérive D » (index indisvalid) et §7.5 exige un post-test sur « les dérives A, B et C de 02, plus la dérive D du §3.4.4 » — soit un mélange de deux nomenclatures. Un rapport de réconciliation nommant « dérive E » serait inexploitable.

**Correction demandee** : Constituer un catalogue unique des classes de dérive, numérotées par chapitre d'origine (par exemple CAT-A…, DDL-A…, CYCLE-A…, HIST-A…) ou renumérotées d'un bout à l'autre, dans le chapitre 02 qui porte la réconciliation de référence, et corriger les renvois de 03 §11.2, 06 §7, 07 §6.3 et 10 §3.4.4/§7.5/§8.5.

---

### Contradiction C38 [mineur]
**Chapitres impliques** : 03-moteur-ddl-migrations.md, 07-historique.md, 02-catalogue.md
**Chapitre designe pour porter la correction** : 07-historique.md

RÉTENTION DES LIGNES DE MIGRATION. 03 §13.5 : « Lignes migration | jamais purgées : elles portent la rejouabilité et l'historique des structures ». 07 §9.4 : « history.structure_retention_months | 60 | migration, et par ricochet structure_revision et migration_execution », et §7.3 fixe un ordre de purge se terminant par « migration — les migrations en dernier ». Si les lignes de migration sont purgées à 60 mois, la rejouabilité de 03 §4.6 (« appliquer, dans l'ordre de sequence, les up_sql des migrations appliquee d'une base … reconstruit exactement la structure physique courante ») cesse d'être vraie au-delà de cinq ans.

**Correction demandee** : Trancher dans 03 §13.5, qui porte la propriété de rejouabilité, et corriger 07 §9.4 : soit les lignes de migration ne sont jamais purgées et seules structure_revision et migration_execution le sont, soit la rejouabilité est bornée dans le temps et 03 §4.6 doit le dire.

---

### Doublon D2
RÉCONCILIATION CATALOGUE ↔ pg_catalog — spécifiée cinq fois : 01 §11.4 (registre vs pg_namespace/pg_class/pg_attribute/pg_constraint), 02 « Réconciliation » (sept classes, régime REPEATABLE READ), 03 §11 (seize classes, réconciliation de forme), 06 §7 (trois classes de plus), 07 §6.3 (carte des déclencheurs), 10 §9.5 (mode dégradé et trois issues). AUTORITÉ : 02 pour le régime d'exécution, le catalogue des classes et les requêtes ; les autres chapitres n'ajoutent que leurs classes propres, dans la numérotation de 02, et 10 §9.5 garde les issues de réparation.

---

### Doublon D3
POSE D'UN CHAMP LIEN — le plan complet est écrit quatre fois : 03 §9.4 (chemin prudent en trois temps), 04 §4.1 (chemins a et b), 10 §3.4.5 (six étapes numérotées), 06 §6 (restauration). AUTORITÉ : 03 pour le plan, l'ordre et les verrous ; 04 pour la projection, le type, les contraintes et les pré-contrôles ; 10 se réduit à un renvoi. Les trois versions divergent aujourd'hui sur la clause ON DELETE émise et sur l'usage de NOT VALID.

---

### Doublon D4
REFUS DE SUPPRIMER UNE TABLE RÉFÉRENCÉE — spécifié cinq fois avec cinq charges utiles et quatre codes : 02 (ck_link_target_live, TABLE_REFERENCED), 03 §9.2 (JSON complet, TABLE_REFERENCEE), 04 §4.6 (LIEN_TABLE_REFERENCEE), 05 §5.5 (SUPPRESSION_TABLE_REFUSEE_REFERENCE), 06 §4.5 a (trigger + message). AUTORITÉ : 03 §9.2 pour la charge utile et le message, 02 pour la garantie déclarative, 05 pour le filtrage par permissions. Un seul code.

---

### Doublon D9
POOLS ET PARAMÈTRES DE CONNEXION — le tableau est donné trois fois avec des valeurs différentes : 01 §10.3 (lock_timeout 1s/5s, statement_timeout 30s/300s), 03 §5.2 (écarts par étape), 10 §3.1 (tailles, files, délais d'acquisition, 20s/5s). AUTORITÉ : 10 §3.1, qui porte le dimensionnement et le contrôle de préflux ; 01 §10.3 conserve les seuls paramètres sémantiques (search_path, TimeZone, DateStyle, IntervalStyle) ; 03 §5.2 conserve les seuls écarts par étape.

---

### Doublon D11
TRADUCTION DES SQLSTATE — donnée cinq fois, avec cinq jeux de codes : 03 §5.4, 05 §5.5, 08 §7.3, 09 §14.4, 10 §8.2. AUTORITÉ : 10 §8.2, qui pose « un seul endroit de traduction : l'exécuteur de requêtes du noyau ». Les quatre autres doivent devenir des renvois, ce qui résoudra du même coup la contradiction sur les codes de relation.

---

### Doublon D12
SUPPRESSION LOGIQUE D'UN CHAMP — la liste des objets à défaire est donnée trois fois : 03 §7.2 (tableau NOT NULL / FK / CHECK / index unique / DEFAULT), 04 §1.11 (huit étapes normatives), 06 §4.1 (bloc SQL de l'étape 2). Elles divergent sur le DEFAULT (03 le conserve, 04 et 06 le retirent) et sur l'index de lien (04 le supprime dans la transaction, 06 en CONCURRENTLY hors transaction). AUTORITÉ : 04 §1.11, qui fixe l'empreinte physique d'un champ ; 03 et 06 renvoient.

---

### Doublon D13
BUDGET D'ATTRIBUTS ET COLONNES RELÉGUÉES — trois fois : 03 §3.3, 04 §1.13, 06 §8.1, avec trois couples de seuils et trois codes. AUTORITÉ : 04 §1.13.

---

### Reference cassee R3
C:\data\dev\basedb\docs\architecture\07-historique.md §16 : « Deux codes utilisés par cette section sont définis ailleurs : VERROU_INDISPONIBLE (section 01) et ID_IMMUABLE (section 03). » Le code ID_IMMUABLE n'apparaît pas dans le §16 de 03, ni ailleurs dans le document.

---

### Reference cassee R4
C:\data\dev\basedb\docs\architecture\07-historique.md §11.1 point 2 : « tg_<table>__systeme (section 03) honore les valeurs fournies de _id, _created_at et _created_by quand basedb.restauration = 'on' … C'est une exigence adressée à la section 03 ». 03 ne décrit ni le corps ni le comportement de ce déclencheur, et 10 §3.5 définit set_updated_at() sans aucune notion de mode restauration.

---

### Reference cassee R8
C:\data\dev\basedb\docs\architecture\09-serveur-mcp.md §1.4 réclame à 02 : _basedb.cle_idempotence, champ.expose_aux_agents, base.mcp_actif, api_token.surfaces_autorisees, authz_version, et à 03 une « table de correspondance versionnée des phrases d'effet par version majeure de PostgreSQL ». Aucun de ces objets n'existe dans 02 ni dans 03.

---

### Reference cassee R9
C:\data\dev\basedb\docs\architecture\03-moteur-ddl-migrations.md §15 « Ce que le moteur exige du catalogue » : base.migration_en_cours_id, executor_id, lease_until, état de dérive, migration.planner_version / attempts / scheduled_for / pg_sqlstate / pg_message / pg_detail / failed_statement_n / etape / duration_ms / pg_backend_pid, field.required_state / unique_state / check_state / superseded_by_field_id, field_link_config.fk_state / fk_index_state / validate_attempts / fk_next_attempt_at, et l'état pending/active de toute définition. Aucune de ces colonnes n'est dans le DDL de 02.

---

### Reference cassee R12
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §15.6 « Contrats attendus des autres sections » réclame permission_version (02, 05), les droits d'instance integration.manage et tenant.admin (05), la fonction immuable basedb_norm et les extensions unaccent et pg_trgm (03), et l'index (<colonne_lien>, _id DESC) (03, 04). Aucun n'existe : 05 pose une liste fermée de sept verbes, 03 déclare qu'aucune extension n'est installée, 04 §1.8 nomme la fonction _basedb.fold_v1 et 04 §4.1 l'index ("c","_id") sans DESC.

---

### Reference cassee R14
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §7.5 et §7.8 : « le harnais exécute les requêtes de dérive A, B et C de “Schéma du catalogue _basedb”, plus la dérive D du §3.4.4 ». 02 définit A, A′, B, C, C′, D, E, F, G, où D désigne autre chose que la dérive D de 10 §3.4.4, et 03, 06 et 07 emploient encore d'autres jeux de lettres. Le critère de sortie de phase 2 « Post-test de dérive A, B, C, D à zéro » n'est donc pas interprétable.

---

### Reference cassee R16
C:\data\dev\basedb\docs\architecture\03-moteur-ddl-migrations.md §1.3 : uuid_generate_v7() et set_updated_at() « sont des objets du produit, créés et maintenus par les migrations système de _basedb » et leur absence est « la dérive M ». Ni 02 (qui possède les migrations de catalogue) ni aucun autre chapitre ne livre le DDL de set_updated_at() dans le schéma que 03 désigne ; seul 10 §3.5 en donne un corps, avec now() au lieu de clock_timestamp().


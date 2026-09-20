# Constats de relecture croisee concernant 01-conventions-nommage.md

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

### Contradiction C3 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 07-historique.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

BUDGETS DE LONGUEUR CONTRADICTOIRES. 01 §3.4 fixe : slug de base 53 octets, nom de table 48, nom de champ 48, nom dérivé 63, et tous les calculs de 01, 04 et 07 en dépendent (07 §1.2 : « avec le budget de 48 octets des tables, l'assemblage naïf ferait 3 + 48 + 18 = 69 octets »). 02 fixe : base.name 35 (`^[a-z][a-z0-9_]{0,34}$`), table_def.name 29 (`{0,28}`), field.name 35, avec contraintes CHECK en dur dans le DDL. Les contraintes de 02 rejetteraient purement et simplement les noms produits par l'algorithme de 01, dont l'exemple normatif de bout en bout « liste_des_contrats_de_prevoyance_collective_sous » (48 octets).

**Correction demandee** : Aligner sur 01 §3.4 (53/48/48) et recalculer dans 02 les budgets de pierre tombale et de colonne de lien avec les motifs de 01 §9.5 et §9.6, ou, si 29 octets pour une table est réellement voulu, le porter dans 01 §3.4 et refaire toute la table de budgets de 01 ainsi que l'exemple de bout en bout du §12. Une seule des deux tables de budgets doit survivre.

---

### Contradiction C5 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

VERSION MINIMALE DE POSTGRESQL : QUATRE RÉPONSES. 01 question ouverte 1 : « Aucune règle de ce chapitre n'exige mieux que PostgreSQL 14 ». 02 : « PostgreSQL 15 minimum », avec refus de démarrage PG_VERSION_TOO_OLD, motivé par UNIQUE NULLS NOT DISTINCT. 06 : « Décision : PostgreSQL 15 est le minimum requis par cette section », motivé par security_invoker. 03 §1.1 : « basedb exige PostgreSQL ≥ 16 », code VERSION_POSTGRES_INSUFFISANTE. 04 : « PostgreSQL 16 », motivé par pg_input_is_valid. 08 §13.3 : « fixe la version minimale de PostgreSQL à 16 » (EXPLAIN GENERIC_PLAN). 10 §9.1 : « PostgreSQL 16 ou plus ». Deux codes d'erreur distincts existent pour le même refus de démarrage.

**Correction demandee** : Fixer PostgreSQL 16 dans le chapitre 00 et dans 10 §9.1 (c'est le plancher effectif : 03, 04 et 08 en dépendent techniquement), supprimer la question ouverte 1 de 01, corriger 02 et 06, et ne conserver qu'un seul code (VERSION_POSTGRES_INSUFFISANTE).

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

### Contradiction C37 [mineur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

EXEMPLES DE tenantId NON CONFORMES. 01 §5 fixe « exactement 7 caractères, toujours 't' + 6 » et pose la règle de lecture par position, avec une note explicite : « Les exemples illustratifs b_t4z56f_crm n'en comptent que 6 ; ils doivent se lire b_t4z56fq_crm. La règle prévaut sur l'exemple ». Or 02 emploie encore « b_t4z56f_crm » dans l'argumentaire du registre physical_object, et 10 l'emploie quatre fois dans du SQL d'exemple (§3.4.2, §9.1, §9.7). 09 question ouverte 6 signale précisément ce point et demande l'alignement des sections 01, 02, 03, 04 et 08.

**Correction demandee** : Remplacer toutes les occurrences de b_t4z56f_ par b_t4z56fq_ dans 02 et 10, et fermer la question ouverte 6 de 09.

---

### Doublon D1
REGISTRE DES NOMS PHYSIQUES — spécifié deux fois et de façon incompatible : 01 §6.3 (_basedb.nom_physique, cinq états, transitions) et 02 « Registre des noms physiques » (_basedb.physical_object). AUTORITÉ : 01 pour les règles (états, transitions, portées d'unicité, invariant de non-duplication), 02 pour le DDL unique. Supprimer la table concurrente.

---

### Doublon D2
RÉCONCILIATION CATALOGUE ↔ pg_catalog — spécifiée cinq fois : 01 §11.4 (registre vs pg_namespace/pg_class/pg_attribute/pg_constraint), 02 « Réconciliation » (sept classes, régime REPEATABLE READ), 03 §11 (seize classes, réconciliation de forme), 06 §7 (trois classes de plus), 07 §6.3 (carte des déclencheurs), 10 §9.5 (mode dégradé et trois issues). AUTORITÉ : 02 pour le régime d'exécution, le catalogue des classes et les requêtes ; les autres chapitres n'ajoutent que leurs classes propres, dans la numérotation de 02, et 10 §9.5 garde les issues de réparation.

---

### Doublon D9
POOLS ET PARAMÈTRES DE CONNEXION — le tableau est donné trois fois avec des valeurs différentes : 01 §10.3 (lock_timeout 1s/5s, statement_timeout 30s/300s), 03 §5.2 (écarts par étape), 10 §3.1 (tailles, files, délais d'acquisition, 20s/5s). AUTORITÉ : 10 §3.1, qui porte le dimensionnement et le contrôle de préflux ; 01 §10.3 conserve les seuls paramètres sémantiques (search_path, TimeZone, DateStyle, IntervalStyle) ; 03 §5.2 conserve les seuls écarts par étape.

---

### Reference cassee R1
C:\data\dev\basedb\docs\architecture\01-conventions-nommage.md §11.4 : « La section 02 fournit la vue _basedb.v_nom_physique_qualifie (schema_nom, objet_nom, objet_nature, etat, objet_id) », et les deux requêtes de réconciliation du §11.4 s'en servent. Cette vue n'existe nulle part dans 02, qui n'a d'ailleurs pas la table nom_physique sur laquelle elle serait bâtie.

---

### Reference cassee R2
C:\data\dev\basedb\docs\architecture\01-conventions-nommage.md §9.1 : « La fonction appelée par ces triggers est unique et partagée, écrite en dur dans _basedb (section 02) : il n'y a jamais une fonction par table ». 02 ne définit aucune fonction de déclencheur ; seul 07 §1.3 définit _basedb.tg_capture_v1() et seul 10 §3.5 définit set_updated_at(), dans BASEDB_UTIL_SCHEMA et non dans _basedb.

---

### Reference cassee R3
C:\data\dev\basedb\docs\architecture\07-historique.md §16 : « Deux codes utilisés par cette section sont définis ailleurs : VERROU_INDISPONIBLE (section 01) et ID_IMMUABLE (section 03). » Le code ID_IMMUABLE n'apparaît pas dans le §16 de 03, ni ailleurs dans le document.

---

### Reference cassee R13
C:\data\dev\basedb\docs\architecture\06-cycle-de-vie.md §3.2 « Extension demandée au chapitre Conventions de nommage » : étendre la transition de registre retire → alias aux noms de portée schéma, nécessaire aux alias de renommage de table. 01 §6.3 restreint explicitement cette transition aux seuls noms de schéma (« elle ne concerne que les noms de schéma »). 06 question ouverte 1 le signale sans que 01 ait été modifié.

---

### Reference cassee R15
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §3.5 : « Le slug basedb est par ailleurs ajouté aux noms de base réservés de “Conventions de nommage” ». 01 §4 décide l'inverse : « Aucun contrôle de mot réservé, de préfixe pg_ ni de nom de schéma réservé ne s'applique au slug de base », et la liste de 01 §4 ne contient pas basedb.


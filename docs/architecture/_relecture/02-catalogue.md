# Constats de relecture croisee concernant 02-catalogue.md

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

### Contradiction C4 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md
**Chapitre designe pour porter la correction** : 04-types-de-champs.md

DEUX CONVENTIONS DE NOMMAGE DU CATALOGUE, EN DEUX LANGUES. 02 nomme ses tables et colonnes en anglais : field, table_def, field_link_config, target_table_id, on_delete, is_required, is_unique, display_field_id, select_option, field_formula_dependency, field_text_config.max_length/is_rich/sanitizer_profile, field_datetime_config.timezone_mode. 04 §11.1 récapitule « ce que cette section attend du catalogue » intégralement en français : champ.est_obligatoire, champ.est_unique, champ_lien.table_cible_id, champ_lien.cascade_accordee_par, champ_texte.max_longueur, champ_temporel.avec_heure, champ_liste.contrainte_enum_id, champ_liste_option, champ_formule_dependance, table.champ_affichage_id, ck_lien_cascade_autorisee, ck_lien_set_null_nullable, idx_lien_cible. 06 mélange les deux (_basedb.field et _basedb.tache_differee, _basedb.acces_sql_direct). 03 §16 questions ouvertes et 06 question ouverte 2 signalent tous deux le problème sans le trancher. La contrainte 02 s'appelle ck_link_cascade_granted, 04 l'appelle ck_lien_cascade_autorisee et 05 §5.7 ck_link_cascade_authorized : trois noms pour la même contrainte.

**Correction demandee** : Trancher une convention unique dans le chapitre 02, qui fait autorité sur le catalogue, et réécrire les récapitulatifs de 04 §11.1, 06 et 07 avec les noms retenus. Recommandation : anglais snake_case, comme 02 le pose déjà (« table_def et non table, app_user et non user »), les libellés français restant côté produit. Ajouter une table de correspondance dans le chapitre 00 pour la période de transition.

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

### Contradiction C10 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 06-cycle-de-vie.md

RELATIONS — LA COLONNE D'AFFICHAGE : QUATRE COMPORTEMENTS INCOMPATIBLES À LA SUPPRESSION DU CHAMP DÉSIGNÉ. 02 « Colonne d'affichage » : display_field_id est nullable, « NULL est un état valide », et « Supprimer logiquement le champ d'affichage est refusé, pas compensé » → DISPLAY_FIELD_IN_USE, avec rejet explicite de l'alternative : « Alternative rejetée : un déclencheur rebasculant silencieusement la désignation vers le champ suivant ». 04 §1.11 étape 8 et §5 : « Champ d'affichage supprimé ou converti → bascule vers le candidat suivant selon la même règle ». 06 §4.5 c : « La désignation étant obligatoire, elle n'est jamais mise à NULL : le trigger du catalogue rebascule vers le candidat suivant … et, s'il n'en existe aucun, vers _id. Aucun refus. » 10 §7.5 : « La désignation d'affichage vaut _id dès la création : elle n'est jamais nulle » et « Bascule automatique et journalisée sur _id, jamais d'état sans désignation ». 07 §4.3 exige au contraire explicitement qu'« une table peut n'avoir aucune colonne d'affichage désignée ». La contrainte fk_display_field de 02 (is_live dans la clé) rend la bascule de 06/10 impossible sans déclencheur, que 02 interdit.

**Correction demandee** : Trancher dans 02 (autorité sur le catalogue) : soit le refus + NULL valide, soit la bascule automatique + jamais nulle. Recommandation : retenir le refus explicite de 02 — il est cohérent avec « mieux vaut un refus explicite qu'un effet silencieux » posé par le cadrage sur les relations, et une bascule change sans prévenir ce que voient tous les consommateurs de tous les liens. Puis corriger 04 §1.11/§5, 06 §4.5 c et 10 §7.5.

---

### Contradiction C11 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 04-types-de-champs.md, 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 05-permissions.md

RELATIONS — CE QUE VOIT UN LECTEUR DONT LA TABLE CIBLE EST ILLISIBLE : QUATRE RÉPONSES. 02 « Colonne d'affichage » : « Même règle si le lecteur n'a pas le droit de lire la table cible : le lien se réduit à son identifiant, sans erreur ». 04 §4.7 : « display vaut null … Le lien lui-même reste visible : l'identifiant n'est pas une donnée sensible en soi ». 05 §5.1 : « L'API renvoie une valeur opaque, pas l'identifiant natif : {"client_id": "lnk_7Qb2…"}, HMAC-SHA256(clé d'instance, tenant_id ‖ id de la table cible ‖ _id) tronquée à 132 bits », avec filtre et tri réduits à IS NULL / IS NOT NULL. 08 §5.5 : « Pas de read sur la table cible → {"id":null,"display":null,"masked":true} ; quand la table cible n'est pas lisible du tout, l'identifiant est masqué par défaut ». 09 §4.3 : « link: null, expandable: false » mais l'identifiant reste dans la ligne. Les quatre produisent quatre charges utiles JSON différentes pour le même cas, et 05 seul introduit un espace d'identifiants opaques qui n'existe nulle part ailleurs (ni dans le catalogue, ni dans OpenAPI, ni dans le MCP).

**Correction demandee** : Trancher dans 05 (autorité sur la non-divulgation) et écrire une seule forme de réponse, reprise mot pour mot par 02, 04, 08 §5.5 et 09 §4.3. Recommandation : la forme de 08 ({id: null, display: null, masked: true}), qui ferme la fuite d'horodatage UUIDv7 sans introduire un second espace d'identifiants ; si la valeur opaque de 05 est conservée, elle doit être spécifiée dans 02 (clé d'instance, stabilité, non-résolution) et décrite dans OpenAPI par 08.

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

### Contradiction C19 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 06-cycle-de-vie.md
**Chapitre designe pour porter la correction** : 06-cycle-de-vie.md

LA PURGE SUPPRIME-T-ELLE LA LIGNE DE CATALOGUE ? 02 « Suppression logique, purge de premier et de second niveau » : « Décision : la purge ne supprime jamais la ligne de catalogue. Elle exécute le DROP physique et renseigne purged_at ; la ligne devient une pierre tombale », avec rejet argumenté de l'alternative et une épuration de second niveau séparée après 12 mois. 06 §5.4 : « Les lignes de catalogue sont supprimées après renseignement de purged_at ; les lignes de registre survivent », et §5.3 « chacune supprimant les lignes de catalogue et émettant les DROP TABLE correspondants ». Les index partiels WHERE purged_at IS NULL de 02, la référence audit_log.object_id et la dérive de réconciliation dépendent de la pierre tombale.

**Correction demandee** : Aligner 06 §5.3 et §5.4 sur la décision de 02 : la purge renseigne purged_at et conserve la ligne ; seule l'épuration de second niveau détruit la ligne, après la rétention catalog.tombstone_retention.

---

### Contradiction C20 [majeur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

RELATIONS — NOM DE LA COLONNE DE CLÉ ÉTRANGÈRE. 01 §9.3 : « <table_cible> désigne le nom physique de la table cible tel qu'il figure au registre, sans transformation : une table clients donne clients_id », et pour un second lien vers la même cible « le moteur bascule sur <slug du libellé du champ>_id » (client_livre_id), dérogation assumée et signalée. 04 §4.4 et 09 §4.2 reprennent clients_id et client_livre_id. 02 « Nom d'un champ lien » impose au contraire un suffixe numérique : « avec un suffixe numérique (_2, _3…) si ce nom est déjà pris », porté par ck_field_link_name, et donne l'exemple « name = 'client_id' » (cible au singulier). 08 et 10 emploient systématiquement client_id (08 §4.5, §5.6, §8.2 ; 10 §3.4.2, §8.1). Le nom de la colonne étant un contrat SQL public et apparaissant dans toutes les charges utiles, la divergence est visible de bout en bout.

**Correction demandee** : Retenir la règle de 01 §9.3 (première occurrence <table_cible>_id, suivantes <slug du libellé>_id), corriger 02 pour que ck_field_link_name accepte les deux formes, et harmoniser tous les exemples de 08 et 10 sur clients_id. Trancher au passage la question ouverte 2 de 01.

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

### Contradiction C31 [majeur]
**Chapitres impliques** : 02-catalogue.md, 05-permissions.md, 08-api-rest-webhooks.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

UN UTILISATEUR APPARTIENT-IL À UN OU PLUSIEURS TENANTS ? 02 modélise une appartenance multiple : table _basedb.tenant_member (tenant_id, user_id) avec clé primaire composite, et app_user sans colonne tenant_id. 05 §13 pose l'inverse comme règle de cloisonnement : « Un utilisateur appartient à exactement un tenant. Le contexte d'acteur porte donc toujours un tenant_id, figé à la création de la session, sans choix ni bascule », et §15 réclame à 02 « app_user : tenant_id NOT NULL ». L'étape 2 de l'algorithme de décision de 05 §3.2, présentée comme « inconditionnelle », repose entièrement sur cette hypothèse.

**Correction demandee** : Ajouter app_user.tenant_id NOT NULL au DDL de 02 et décider du sort de tenant_member (la supprimer, ou la conserver en la déclarant hors usage v1), en cohérence avec le reste des ajouts réclamés par 05 §15.

---

### Contradiction C34 [majeur]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LES LETTRES DE DÉRIVE DE RÉCONCILIATION SE TÉLESCOPENT. 02 définit sept classes A, A′, B, C, C′, D, E, F, G (D = nom réservé sans objet physique, E = CHECK de liste, F = COMMENT ON, G = index de FK du catalogue). 03 §11.2 en définit seize, A à P, avec des sens différents (D = index invalide, E = ON DELETE divergent, F = nullabilité, G = type physique). 06 §7 « ajoute trois classes de dérive » E, F, G avec un troisième sens (E = alias, F = relégation, G = liens). 07 §6.3 introduit encore « la dérive D » pour la carte figée des déclencheurs. 10 §3.4.4 introduit sa propre « Dérive D » (index indisvalid) et §7.5 exige un post-test sur « les dérives A, B et C de 02, plus la dérive D du §3.4.4 » — soit un mélange de deux nomenclatures. Un rapport de réconciliation nommant « dérive E » serait inexploitable.

**Correction demandee** : Constituer un catalogue unique des classes de dérive, numérotées par chapitre d'origine (par exemple CAT-A…, DDL-A…, CYCLE-A…, HIST-A…) ou renumérotées d'un bout à l'autre, dans le chapitre 02 qui porte la réconciliation de référence, et corriger les renvois de 03 §11.2, 06 §7, 07 §6.3 et 10 §3.4.4/§7.5/§8.5.

---

### Contradiction C36 [majeur]
**Chapitres impliques** : 02-catalogue.md, 08-api-rest-webhooks.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

webhook_delivery : DEUX FORMES INCOMPATIBLES, ET AUCUN DDL. 02 décrit la table ainsi : « webhook_delivery (une ligne par tentative, avec payload jsonb, status, attempt, response_code, error) est partitionnée par mois … son détail relève de “API REST, OpenAPI, webhooks, jetons d'intégration” ». 08 §10.1 décide l'inverse : le drain « crée dans _basedb.webhook_delivery une ligne par abonnement concerné, contenant une référence (base_id, outbox_id), le rôle de projection, la clé de partition d'ordre et l'état — jamais le corps », et §10.4 : « webhook_delivery ne conserve que la référence … Sans cela, un lot de 1 000 modifications sur une table à documents écrirait plusieurs gigaoctets dans le catalogue ». 08 §10.6 emploie de surcroît des colonnes non décrites (partition_key, statut IN ('en_attente','en_vol'), prochaine_tentative_a) et renvoie pour le partitionnement à 02, qui renvoie à 08 : la table n'a de DDL nulle part.

**Correction demandee** : Écrire le DDL complet de webhook_delivery dans 02, dans la forme retenue par 08 (référence, pas de corps), avec partition_key, statut, prochaine_tentative_a, attempts et le partitionnement mensuel ; corriger la phrase de 02 qui mentionne payload jsonb.

---

### Contradiction C37 [mineur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

EXEMPLES DE tenantId NON CONFORMES. 01 §5 fixe « exactement 7 caractères, toujours 't' + 6 » et pose la règle de lecture par position, avec une note explicite : « Les exemples illustratifs b_t4z56f_crm n'en comptent que 6 ; ils doivent se lire b_t4z56fq_crm. La règle prévaut sur l'exemple ». Or 02 emploie encore « b_t4z56f_crm » dans l'argumentaire du registre physical_object, et 10 l'emploie quatre fois dans du SQL d'exemple (§3.4.2, §9.1, §9.7). 09 question ouverte 6 signale précisément ce point et demande l'alignement des sections 01, 02, 03, 04 et 08.

**Correction demandee** : Remplacer toutes les occurrences de b_t4z56f_ par b_t4z56fq_ dans 02 et 10, et fermer la question ouverte 6 de 09.

---

### Contradiction C38 [mineur]
**Chapitres impliques** : 03-moteur-ddl-migrations.md, 07-historique.md, 02-catalogue.md
**Chapitre designe pour porter la correction** : 07-historique.md

RÉTENTION DES LIGNES DE MIGRATION. 03 §13.5 : « Lignes migration | jamais purgées : elles portent la rejouabilité et l'historique des structures ». 07 §9.4 : « history.structure_retention_months | 60 | migration, et par ricochet structure_revision et migration_execution », et §7.3 fixe un ordre de purge se terminant par « migration — les migrations en dernier ». Si les lignes de migration sont purgées à 60 mois, la rejouabilité de 03 §4.6 (« appliquer, dans l'ordre de sequence, les up_sql des migrations appliquee d'une base … reconstruit exactement la structure physique courante ») cesse d'être vraie au-delà de cinq ans.

**Correction demandee** : Trancher dans 03 §13.5, qui porte la propriété de rejouabilité, et corriger 07 §9.4 : soit les lignes de migration ne sont jamais purgées et seules structure_revision et migration_execution le sont, soit la rejouabilité est bornée dans le temps et 03 §4.6 doit le dire.

---

### Doublon D1
REGISTRE DES NOMS PHYSIQUES — spécifié deux fois et de façon incompatible : 01 §6.3 (_basedb.nom_physique, cinq états, transitions) et 02 « Registre des noms physiques » (_basedb.physical_object). AUTORITÉ : 01 pour les règles (états, transitions, portées d'unicité, invariant de non-duplication), 02 pour le DDL unique. Supprimer la table concurrente.

---

### Doublon D2
RÉCONCILIATION CATALOGUE ↔ pg_catalog — spécifiée cinq fois : 01 §11.4 (registre vs pg_namespace/pg_class/pg_attribute/pg_constraint), 02 « Réconciliation » (sept classes, régime REPEATABLE READ), 03 §11 (seize classes, réconciliation de forme), 06 §7 (trois classes de plus), 07 §6.3 (carte des déclencheurs), 10 §9.5 (mode dégradé et trois issues). AUTORITÉ : 02 pour le régime d'exécution, le catalogue des classes et les requêtes ; les autres chapitres n'ajoutent que leurs classes propres, dans la numérotation de 02, et 10 §9.5 garde les issues de réparation.

---

### Doublon D4
REFUS DE SUPPRIMER UNE TABLE RÉFÉRENCÉE — spécifié cinq fois avec cinq charges utiles et quatre codes : 02 (ck_link_target_live, TABLE_REFERENCED), 03 §9.2 (JSON complet, TABLE_REFERENCEE), 04 §4.6 (LIEN_TABLE_REFERENCEE), 05 §5.5 (SUPPRESSION_TABLE_REFUSEE_REFERENCE), 06 §4.5 a (trigger + message). AUTORITÉ : 03 §9.2 pour la charge utile et le message, 02 pour la garantie déclarative, 05 pour le filtrage par permissions. Un seul code.

---

### Doublon D5
LIENS INVERSES — spécifiés quatre fois : 02 « Liens inverses, sans table ni configuration » (requête SQL de référence), 04 §6 (bornage 20 blocs / 50 lignes / 500+), 08 §5.6 (route, 25 groupes, count 1 000, preview 3), 09 §4.2 (bloc inverse_links + how_to_list). AUTORITÉ : 02 pour la requête catalogue, 04 pour le bornage sémantique, 08 pour le contrat HTTP. Les bornages de 04 et 08 doivent être fusionnés, pas juxtaposés.

---

### Doublon D6
COLONNE D'AFFICHAGE — spécifiée six fois : 02 (contraintes déclaratives, règles de service), 04 §5 (types éligibles, cas limites), 06 §4.5 c (bascule), 07 §4.3 (exigence de colonne stockée), 09 §4.3 (projection), 10 §7.5 (tests). AUTORITÉ : 02 pour la contrainte et la désignation par défaut, 04 §5 pour les types éligibles et les cas limites. Les autres doivent renvoyer, pas redécider.

---

### Reference cassee R1
C:\data\dev\basedb\docs\architecture\01-conventions-nommage.md §11.4 : « La section 02 fournit la vue _basedb.v_nom_physique_qualifie (schema_nom, objet_nom, objet_nature, etat, objet_id) », et les deux requêtes de réconciliation du §11.4 s'en servent. Cette vue n'existe nulle part dans 02, qui n'a d'ailleurs pas la table nom_physique sur laquelle elle serait bâtie.

---

### Reference cassee R2
C:\data\dev\basedb\docs\architecture\01-conventions-nommage.md §9.1 : « La fonction appelée par ces triggers est unique et partagée, écrite en dur dans _basedb (section 02) : il n'y a jamais une fonction par table ». 02 ne définit aucune fonction de déclencheur ; seul 07 §1.3 définit _basedb.tg_capture_v1() et seul 10 §3.5 définit set_updated_at(), dans BASEDB_UTIL_SCHEMA et non dans _basedb.

---

### Reference cassee R5
C:\data\dev\basedb\docs\architecture\02-catalogue.md, table webhook_delivery : « son détail relève de “API REST, OpenAPI, webhooks, jetons d'intégration” ». C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §10.6 : « webhook_delivery est partitionnée par mois (section “Schéma du catalogue _basedb”) ». Renvoi circulaire : la table n'a de DDL dans aucun des deux, et 08 §10.6 emploie des colonnes (partition_key, statut, prochaine_tentative_a) que 02 ne connaît pas.

---

### Reference cassee R8
C:\data\dev\basedb\docs\architecture\09-serveur-mcp.md §1.4 réclame à 02 : _basedb.cle_idempotence, champ.expose_aux_agents, base.mcp_actif, api_token.surfaces_autorisees, authz_version, et à 03 une « table de correspondance versionnée des phrases d'effet par version majeure de PostgreSQL ». Aucun de ces objets n'existe dans 02 ni dans 03.

---

### Reference cassee R9
C:\data\dev\basedb\docs\architecture\03-moteur-ddl-migrations.md §15 « Ce que le moteur exige du catalogue » : base.migration_en_cours_id, executor_id, lease_until, état de dérive, migration.planner_version / attempts / scheduled_for / pg_sqlstate / pg_message / pg_detail / failed_statement_n / etape / duration_ms / pg_backend_pid, field.required_state / unique_state / check_state / superseded_by_field_id, field_link_config.fk_state / fk_index_state / validate_attempts / fk_next_attempt_at, et l'état pending/active de toute définition. Aucune de ces colonnes n'est dans le DDL de 02.

---

### Reference cassee R10
C:\data\dev\basedb\docs\architecture\05-permissions.md §15 réclame à 02 les tables session, confirmation_challenge, webhook_outbox, table_constraint, table_constraint_member et les colonnes app_user.tenant_id / disabled_at / must_change_password / bootstrap_secret_*, webhook.role_id, tenant.authz_version, field_link_config.cascade_granted_by / cascade_granted_at / cascade_audit_id. Aucune n'existe dans 02, qui modélise l'autorisation de cascade par une table cascade_grant et une FK cascade_grant_id — mécanisme différent.

---

### Reference cassee R11
C:\data\dev\basedb\docs\architecture\04-types-de-champs.md §11.1 « Du catalogue _basedb » énumère quatorze objets en français (champ, champ_type, champ_texte, champ_nombre, champ_temporel, champ_liste, champ_liste_option, champ_lien, champ_booleen, champ_formule, champ_formule_dependance, table.champ_affichage_id, _basedb.nom_physique, _basedb.fold_v1) dont aucun ne porte le nom employé par 02.

---

### Reference cassee R12
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §15.6 « Contrats attendus des autres sections » réclame permission_version (02, 05), les droits d'instance integration.manage et tenant.admin (05), la fonction immuable basedb_norm et les extensions unaccent et pg_trgm (03), et l'index (<colonne_lien>, _id DESC) (03, 04). Aucun n'existe : 05 pose une liste fermée de sept verbes, 03 déclare qu'aucune extension n'est installée, 04 §1.8 nomme la fonction _basedb.fold_v1 et 04 §4.1 l'index ("c","_id") sans DESC.

---

### Reference cassee R14
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §7.5 et §7.8 : « le harnais exécute les requêtes de dérive A, B et C de “Schéma du catalogue _basedb”, plus la dérive D du §3.4.4 ». 02 définit A, A′, B, C, C′, D, E, F, G, où D désigne autre chose que la dérive D de 10 §3.4.4, et 03, 06 et 07 emploient encore d'autres jeux de lettres. Le critère de sortie de phase 2 « Post-test de dérive A, B, C, D à zéro » n'est donc pas interprétable.

---

### Reference cassee R16
C:\data\dev\basedb\docs\architecture\03-moteur-ddl-migrations.md §1.3 : uuid_generate_v7() et set_updated_at() « sont des objets du produit, créés et maintenus par les migrations système de _basedb » et leur absence est « la dérive M ». Ni 02 (qui possède les migrations de catalogue) ni aucun autre chapitre ne livre le DDL de set_updated_at() dans le schéma que 03 désigne ; seul 10 §3.5 en donne un corps, avec now() au lieu de clock_timestamp().

---

### Trou de couverture T4 — Authentification par mot de passe et OAuth
Le cadrage tient en une ligne — « Mot de passe et OAuth » — et le sujet est orphelin. 02 donne la table auth_identity (provider 'password' | 'oidc:<slug>', password_hash argon2id, uq_identity_one_password_per_user) et c'est tout. 05 §2.1/§2.2 décrit la session et l'élévation par « ré-authentification (mot de passe ou WebAuthn) », §12 l'amorçage et le secret d'amorçage. 08 §1.4 place /auth/* « hors périmètre de ce chapitre ». 10 §1.2 met « OAuth et mots de passe » dans apps/api et §10 les exclut du noyau de phase 2. Résultat : personne ne spécifie la configuration des fournisseurs OIDC (table, découverte, clientId/secret, scopes, redirection), le rattachement d'une identité OAuth à un compte existant, la création de compte à la première connexion, la politique de mot de passe, la réinitialisation, le verrouillage après échecs, la vérification d'adresse, ni le canal de courriel dont dépendent 05 §2.2 (notification de changement de rôle) et 05 question ouverte 3.

**Ou le traiter** : Un chapitre dédié, ou une section de 05, qui possède déjà la session, l'élévation et l'amorçage. Le paramètre « fournisseur OAuth » apparaît dans 10 §6.2 sans table de configuration correspondante dans 02.

---

### Trou de couverture T8 — Les tables du catalogue réclamées par 05 et jamais définies
05 §15 « Ajouts demandés au catalogue » liste des objets qui n'existent nulle part dans 02 : la table session (id, user_id, tenant_id, created_at, last_seen_at, absolute_expires_at, revoked_at, elevated_until, empreinte du jeton), confirmation_challenge, webhook_outbox, webhook.role_id NOT NULL, app_user.disabled_at / must_change_password / bootstrap_secret_*, tenant.authz_version, et surtout table_constraint + table_constraint_member, dont dépend entièrement la « clôture des contraintes croisées » de 05 §4.1 — mécanisme présenté comme indispensable pour empêcher la lecture d'un champ masqué par dichotomie sur un CHECK multi-colonnes.

**Ou le traiter** : Chapitre 02, en intégrant le §15 de 05 au DDL. table_constraint est le plus structurant : sans lui, aucun chapitre ne sait quelles colonnes participent à une contrainte composite.

---

### Trou de couverture T9 — Les colonnes de configuration de champ réclamées par 04 et 09
04 §11.1 attend du catalogue champ.est_triable, champ.est_recherchable, champ_booleen.cote_indexe, champ_liste.contrainte_enum_id, champ_temporel.avec_heure, champ_formule.arbre et expression_saisie. 02 n'en définit aucun, et rejette même explicitement l'un d'eux : « Alternative rejetée : une colonne with_time boolean, qui autorise la combinaison absurde kind = 'date' + with_time = true » — alors que 04 §2.5 écrit « champ_temporel.avec_heure = false ». 09 §1.4 et §12.2 attendent de leur côté champ.expose_aux_agents, base.mcp_actif et api_token.surfaces_autorisees, également absents. Sans ces colonnes, ni l'indexation de 04 §1.2 ni le marquage de non-exposition aux agents de 09 §12.2 — présenté comme « la seule mesure qui borne réellement le pire cas » — ne sont réalisables.

**Ou le traiter** : Chapitre 02, section « Configuration par type : satellites 1:1 », après arbitrage de la convention de nommage.


# Constats de relecture croisee concernant 04-types-de-champs.md

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

### Contradiction C15 [bloquant]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 04-types-de-champs.md
**Chapitre designe pour porter la correction** : 05-permissions.md

RELATIONS — ON DELETE CASCADE : QUI EXÉCUTE, ET QUI CONFIRME. 05 §5.7 : autorisation nominative à la création du champ, élévation + jeton de confirmation, et surtout « À l'exécution … Aucun seuil bloquant : une confirmation supplémentaire à l'exécution, sans titulaire de droit clairement défini, serait soit décorative, soit un obstacle arbitraire sur une opération déjà réservée et confirmée ». 08 §8.3 impose exactement cette confirmation à l'exécution : « Règle 1 — la cascade est exécutée par l'application, pas par PostgreSQL », suppression niveau par niveau, droit delete exigé sur chaque table atteinte, décompte exact, en-tête X-Basedb-Confirm-Cascade obligatoire égal au décompte serveur, plafond de 5 000 lignes (CASCADE_TROP_LARGE) et profondeur 5. 04 §4.2 et 03 §9.7 supposent au contraire que la cascade est exécutée par PostgreSQL. Cette divergence casse aussi 07 §4.1, qui détermine cause = 'cascade' par pg_trigger_depth() > 1 : avec la cascade applicative de 08, la profondeur vaut 1 et toutes les lignes cascadées seraient historisées en 'direct'.

**Correction demandee** : Trancher dans 05 §5.7 après arbitrage avec 08. Si la cascade applicative est retenue (elle seule permet la charge utile de webhook par ligne exigée par le cadrage), il faut : lever l'interdiction de 05 sur la confirmation à l'exécution, ajouter CASCADE_TROP_LARGE / CASCADE_PROFONDEUR au registre de 05, et remplacer dans 07 §4.1 le critère pg_trigger_depth() par une variable de session posée par le noyau.

---

### Contradiction C16 [bloquant]
**Chapitres impliques** : 10-architecture-logicielle.md, 04-types-de-champs.md, 07-historique.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

UN SCHÉMA b_* NE PEUT PAS RÉFÉRENCER _basedb — SAUF QUE DEUX CHAPITRES L'EXIGENT. 10 §3.5 pose l'interdit : « Aucun objet d'un schéma b_* (vue, fonction, déclencheur) ne référence _basedb », avec « une seule exception, nommée » : uuid_generate_v7() et set_updated_at(), tous deux dans BASEDB_UTIL_SCHEMA et qui « ne lisent rien ». Or 04 §1.8 pose des index d'expression sur les tables utilisateur bâtis sur _basedb.fold_v1() et l'opclass _basedb.gin_trgm_ops, et 07 §1.2 pose sur chaque table utilisateur quatre déclencheurs appelant _basedb.tg_capture_v1() qui écrit dans _basedb.record_revision. L'un des trois chapitres doit céder, et l'interdit de 10 est la clé de la séparation physique future annoncée par le cadrage.

**Correction demandee** : Reformuler l'interdit de 10 §3.5 en fonction de l'arbitrage sur la capture (contradiction sur l'historique ci-dessus) : soit l'exception est élargie et nommée exhaustivement (fonctions partagées immuables + fonction de capture), soit fold_v1 et la fonction de capture migrent dans BASEDB_UTIL_SCHEMA, qui suit les données. Dans les deux cas, écrire ce que devient la dépendance le jour de la séparation physique.

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

### Contradiction C22 [majeur]
**Chapitres impliques** : 04-types-de-champs.md, 08-api-rest-webhooks.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

ORDRE DES VALEURS NULLES AU TRI, ET CLÉ DE CURSEUR. 04 §1.9 : « L'ordre des NULL est celui de PostgreSQL (NULLS LAST en ascendant, NULLS FIRST en descendant), et non “toujours en bas” : c'est la seule convention qu'un index (col, _id) sert dans les deux sens … Forcer NULLS LAST en descendant rendrait l'index inutilisable dans ce sens », avec un prédicat de curseur en deux branches. 08 §6.1 : « NULLS LAST est imposé quelle que soit la direction, en préfixant la clé par l'expression booléenne (<colonne> IS NULL) ASC », et le SQL du §4.5 émet effectivement ORDER BY ("f"."date_emission" IS NULL) ASC. Les deux produisent des ordres différents en descendant, des index différents et des curseurs incompatibles — y compris pour le tri par valeur d'affichage d'un lien, spécifié dans les deux chapitres.

**Correction demandee** : Trancher dans 04 §1.9 (autorité sur l'indexation et le tri) et réécrire 08 §6.1 et le SQL du §4.5 en conséquence, en vérifiant que les index exigés par 08 §13.5 et 04 §1.2 restent les mêmes.

---

### Contradiction C23 [majeur]
**Chapitres impliques** : 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

TROIS VOCABULAIRES D'OPÉRATEURS DE FILTRE, POUR UNE MÊME COUCHE DE FILTRAGE. 04 §9 (« liste de référence … c'est lui que la spécification OpenAPI et la description MCP dérivent ») : egal, egal_insensible, different, contient, commence_par, finit_par, dans, est_vide, superieur, superieur_egal, inferieur, inferieur_egal, entre, avant, apres. 08 §4.2 : eq, ne, gt, gte, lt, lte, between, in, nin, co, nco, sw, ew, null, nnull, has. 09 §5.1 : eq, neq, gt, gte, lt, lte, contains, starts_with, in, is_null. Aucun des trois n'est un sous-ensemble des deux autres (08 a nin/nco/ew/has que les autres n'ont pas ; 09 a neq là où 08 a ne ; 04 a egal_insensible et finit_par sans équivalent en 09). 08 introduit en outre l'opérateur has sur « select avec is_multiple », alors que 04 §3 gèle est_multiple à false et que 02 déclare « Aucune colonne is_multiple n'existe ».

**Correction demandee** : Faire de 04 §9 la table normative, comme il le revendique, et y ajouter la colonne « nom exposé par l'API/MCP » avec un seul jeu d'identifiants. Réécrire 08 §4.2 et 09 §5.1 comme des renvois, et supprimer l'opérateur has tant que le choix multiple est hors périmètre v1.

---

### Contradiction C25 [majeur]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 07-historique.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

EXTENSIONS POSTGRESQL : AUCUNE, OU TROIS. 03 §1.2 : « Aucune extension n'est requise, et le moteur n'en installe aucune », avec tableau de rejet (uuid-ossp, pgcrypto, pg_stat_statements). 10 §9.1 : « Aucune extension n'est requise ». 02 emploie gen_random_uuid() du cœur. Mais 04 §1.8 installe pg_trgm (« CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA _basedb ») et en fait un prérequis du filtre « contient » indexé, plus la collation ICU und-x-icu dont l'absence est un refus de démarrage (PREREQUIS_ICU_ABSENT). 08 §13.5 exige pg_trgm ET unaccent (« L'installation de unaccent et pg_trgm est une dépendance d'installation »), question ouverte 4 reconnaissant que le rôle peut ne pas en avoir le droit. 07 §3.2 construit _basedb.uuid_v7() « sur clock_timestamp() et gen_random_bytes() de pgcrypto — extension de confiance ».

**Correction demandee** : Trancher dans 10 §9.1 (autorité sur les hypothèses d'environnement) la liste close des extensions et collations exigées, avec le comportement de repli documenté quand elles manquent. Puis corriger 03 §1.2 pour qu'il cesse d'affirmer « aucune », et supprimer la dépendance à pgcrypto de 07 §3.2 (gen_random_uuid est dans le cœur depuis PG13).

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

### Contradiction C32 [majeur]
**Chapitres impliques** : 04-types-de-champs.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

_updated_at : now() OU clock_timestamp() ? 04 §10 « Exigences adressées au moteur DDL » : « Le trigger emploie clock_timestamp(), jamais now(). now() renvoie l'heure de début de transaction : un UPDATE de masse … estamperait des millions de lignes à l'heure où il a commencé. » 08 §3.2 et §6.5 en font une condition de la reprise incrémentale : « renseigné par déclencheur avec clock_timestamp(), jamais avec now() ni par le code applicatif … donc strictement croissant par ligne ». 10 §3.5 définit la fonction avec now() : « set_updated_at() … positionne NEW."_updated_at" = now() et ne lit rien d'autre ». Avec now(), le filigrane de reprise de 08 §6.5 et l'index de synchronisation de 04 §10 cessent d'être corrects.

**Correction demandee** : Corriger 10 §3.5 (et la ligne correspondante des décisions retenues) pour employer clock_timestamp(), et faire du corps de set_updated_at() une définition unique au même endroit que uuid_generate_v7().

---

### Doublon D3
POSE D'UN CHAMP LIEN — le plan complet est écrit quatre fois : 03 §9.4 (chemin prudent en trois temps), 04 §4.1 (chemins a et b), 10 §3.4.5 (six étapes numérotées), 06 §6 (restauration). AUTORITÉ : 03 pour le plan, l'ordre et les verrous ; 04 pour la projection, le type, les contraintes et les pré-contrôles ; 10 se réduit à un renvoi. Les trois versions divergent aujourd'hui sur la clause ON DELETE émise et sur l'usage de NOT VALID.

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

### Doublon D7
EXPANSION DES LIENS — spécifiée trois fois : 04 §4.7 (borne de huit champs lien par lecture de liste), 08 §5.1–5.5 (profondeur 1, 5 champs, 8 tables cibles, section included dédupliquée, ?links=id), 09 §5.1 (expand max 3, expand_fields max 5). Les bornes ne coïncident pas. AUTORITÉ : 08, qui porte le contrat de réponse ; 04 doit se réduire au coût SQL de la résolution de display.

---

### Doublon D8
PAGINATION PAR CURSEUR — spécifiée trois fois : 04 §1.9 (deux branches, clause de collation, ordre des nuls), 08 §6.2–6.3 (curseur chiffré AEAD, contenu du payload, AAD), 09 §11.3 (curseur signé). AUTORITÉ : 08 pour le format, le chiffrement et l'invalidation ; 04 pour le prédicat SQL et la collation ; 09 se réduit à un renvoi. Noter que 09 dit « signé » là où 08 dit « chiffré, pas seulement signé ».

---

### Doublon D10
ÉCRITURES DE MASSE ET SEUILS — spécifiés deux fois avec deux jeux de seuils : 04 §1.10 (seuil_lots 1 000 000, seuil_reecriture_annoncee 100 000, ANALYZE final) et 07 §5 (history.bulk_threshold 500 lignes cumulées, plafond dur 100 000, bulk_operation). AUTORITÉ : 07 pour le volume d'historique, 04 pour le DDL et la réécriture de table. Les deux doivent se citer.

---

### Doublon D12
SUPPRESSION LOGIQUE D'UN CHAMP — la liste des objets à défaire est donnée trois fois : 03 §7.2 (tableau NOT NULL / FK / CHECK / index unique / DEFAULT), 04 §1.11 (huit étapes normatives), 06 §4.1 (bloc SQL de l'étape 2). Elles divergent sur le DEFAULT (03 le conserve, 04 et 06 le retirent) et sur l'index de lien (04 le supprime dans la transaction, 06 en CONCURRENTLY hors transaction). AUTORITÉ : 04 §1.11, qui fixe l'empreinte physique d'un champ ; 03 et 06 renvoient.

---

### Doublon D13
BUDGET D'ATTRIBUTS ET COLONNES RELÉGUÉES — trois fois : 03 §3.3, 04 §1.13, 06 §8.1, avec trois couples de seuils et trois codes. AUTORITÉ : 04 §1.13.

---

### Reference cassee R11
C:\data\dev\basedb\docs\architecture\04-types-de-champs.md §11.1 « Du catalogue _basedb » énumère quatorze objets en français (champ, champ_type, champ_texte, champ_nombre, champ_temporel, champ_liste, champ_liste_option, champ_lien, champ_booleen, champ_formule, champ_formule_dependance, table.champ_affichage_id, _basedb.nom_physique, _basedb.fold_v1) dont aucun ne porte le nom employé par 02.

---

### Reference cassee R12
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §15.6 « Contrats attendus des autres sections » réclame permission_version (02, 05), les droits d'instance integration.manage et tenant.admin (05), la fonction immuable basedb_norm et les extensions unaccent et pg_trgm (03), et l'index (<colonne_lien>, _id DESC) (03, 04). Aucun n'existe : 05 pose une liste fermée de sept verbes, 03 déclare qu'aucune extension n'est installée, 04 §1.8 nomme la fonction _basedb.fold_v1 et 04 §4.1 l'index ("c","_id") sans DESC.

---

### Trou de couverture T2 — Conséquences UI des relations, explicitement demandées par le cadrage
Le cadrage exige trois comportements d'interface : la cellule d'un champ lien affiche la valeur d'affichage et non l'identifiant, un clic ouvre le détail de la ligne cible, et la vue détail liste en retour les lignes qui la référencent. Les trois sont mentionnés en passant mais n'ont pas de spécification : 04 §4.7 décrit la charge utile {id, display} et 04 §6 le bornage des liens inverses (20 blocs, 50 lignes, compteur plafonné à 500+), 08 §5.6 décrit la route /referenced_by (25 groupes, count plafonné à 1 000, preview de 3 lignes), 05 §5.3 décrit le filtrage à trois niveaux, 05 §5.1 mentionne « une pastille neutre “enregistrement lié”, non cliquable ». Personne ne dit ce que la cellule affiche quand display vaut null, ce que fait le clic (navigation, panneau latéral, modale), comment se présente le sélecteur de ligne cible (qui s'appuie pourtant sur lookup_records côté MCP), ni comment l'UI réconcilie les trois bornages différents de 04 §6 et 08 §5.6 (20 blocs contre 25 groupes, 50 lignes contre pagination, 500+ contre 1 000).

**Ou le traiter** : Chapitre UI, en renvoyant à 04 §4.7/§5/§6 pour la sémantique et à 08 §5.6 pour le contrat HTTP — après avoir aligné les deux bornages.


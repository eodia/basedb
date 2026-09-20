# Constats de relecture croisee concernant 06-cycle-de-vie.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

### Contradiction C1 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

DEUX REGISTRES DE NOMS PHYSIQUES CONCURRENTS. Le chapitre 01 §6.3 définit « _basedb.nom_physique » avec les colonnes portee_id, portee_nature, nom, objet_id, objet_nature, etat (actif/relegue/retire/alias/purge), version_slug, et pose comme invariant : « Elle est le seul détenteur du nom physique. Les tables d'objets du catalogue référencent leur nom par clé étrangère et ne dupliquent jamais la chaîne. » Le chapitre 02 définit à la place « _basedb.physical_object » (schema_name, rel_name, object_kind, owner_kind, owner_id, released_at) ET stocke les noms en clair dans des colonnes texte (base.schema_name, table_def.physical_name, field.physical_name) — exactement la duplication que 01 interdit. Les chapitres 03 (§5.4, §6.1), 04 (§1.2, §11.1), 06 (§1.1) et 07 (§1.2) citent tous « _basedb.nom_physique », qui n'existe pas dans le DDL de 02. Le chapitre 06 §4.1 écrit même « UPDATE _basedb.field SET physical_name_id = $nouvelle_ligne_de_registre », colonne absente de 02.

**Correction demandee** : Trancher pour un registre unique et une seule représentation. Recommandation : conserver la table registre de 01 (elle porte les cinq états et l'historique des noms, indispensables à la purge, à la restauration et aux alias), lui donner son DDL dans le chapitre 02 sous un nom unique, et supprimer de 02 les colonnes physical_name/schema_name au profit d'une FK vers le registre (avec une vue de confort pour la lisibilité). Reporter dans 02 les contraintes CHECK d'alphabet et d'octets, et y ajouter la vue _basedb.v_nom_physique_qualifie que 01 §11.4 réclame.

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

### Contradiction C13 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 05-permissions.md, 06-cycle-de-vie.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

REGISTRE DES CODES D'ERREUR INCOHÉRENT, ET PARTICULIÈREMENT SUR LES RELATIONS. Même condition, codes différents : refus de supprimer une table référencée → TABLE_REFERENCED (02), TABLE_REFERENCEE (03 §16, 06 §10, 10 §8.1), LIEN_TABLE_REFERENCEE (04 §12), SUPPRESSION_TABLE_REFUSEE_REFERENCE (05 §14). Valeurs orphelines à la pose d'une FK → VALEURS_LIEES_INVALIDES (03, 06, 10), LIEN_VALEURS_ORPHELINES (04), LIEN_DONNEES_INCOMPATIBLES (05). Écriture d'un lien vers une cible inexistante → LIEN_CIBLE_INTROUVABLE (04, 08), VALEUR_LIEN_INEXISTANTE (05), VALEUR_LIEN_INVALIDE (09), VALEUR_LIEE_INTROUVABLE (10). Suppression d'une ligne référencée → SUPPRESSION_REFUSEE_REFERENCE (05), ENREGISTREMENT_REFERENCE (08), LIGNE_REFERENCEE (03, 10). Doublons → VALEURS_DUPLIQUEES (03), UNICITE_DOUBLONS (04), VALEUR_DUPLIQUEE (05, 08, 10), VALEUR_DEJA_UTILISEE (09). S'ajoute un conflit de langue : 05 §7.1 pose comme règle pour tout le document « Tous les codes d'erreur sont des identifiants machine en français », 10 §8.1 la confirme, mais 02 emploie PG_VERSION_TOO_OLD, DB_ENCODING_NOT_UTF8, DB_NOT_OWNED, PHYSICAL_NAME_TAKEN, TABLE_REFERENCED, DISPLAY_FIELD_IN_USE, BASE_NOT_EMPTY, FIELD_CONFIG_MISSING. Enfin le même refus d'encodage porte deux codes : ENCODAGE_NON_SUPPORTE (01) et DB_ENCODING_NOT_UTF8 (02).

**Correction demandee** : Constituer dans @basedb/contracts un registre unique des codes, publié en annexe du chapitre 00, et n'autoriser chaque chapitre qu'à y ajouter, jamais à renommer. Appliquer la règle de 05 §7.1 (français, majuscules ASCII) en corrigeant les huit codes anglais de 02, et fusionner les cinq familles de doublons ci-dessus en un code par condition.

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

### Contradiction C26 [majeur]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

VERROUS CONSULTATIFS : hashtext() EST À LA FOIS IMPOSÉ ET INTERDIT. 01 §6.4 fixe la clé : « SELECT pg_advisory_xact_lock(1650552165, hashtext(<portee_id>::text)) ». 03 §5.1 et §14.3, 06 §2.4 et 07 §7.1 la reprennent telle quelle. 02 décide l'inverse dans ses décisions retenues : « Verrous consultatifs à constantes écrites en dur | hashtext() n'est pas documentée et a déjà changé d'algorithme | Alternative écartée : pg_advisory_lock(hashtext('basedb.catalog')) », et emploie « ('x' || right($base_id::text, 8))::bit(32)::int ». 10 §9.2 étape 4 emploie pourtant exactement la forme que 02 rejette : « pg_advisory_lock(hashtext('basedb.catalog')) ». S'ajoutent trois espaces de clés distincts (1650552165 en 01/03/06, 1734112001 en 02, 1650552166 en 07, 7460410000000001 en 02) sans registre commun.

**Correction demandee** : Créer dans 02 un registre unique des classes de verrous consultatifs (constante, dérivation de la seconde clé, portée, durée) et y renvoyer depuis 01 §6.4, 03 §5.1, 06 §2.4, 07 §7.1 et 10 §9.2. Trancher au passage la question ouverte 1 de 03 (hashtext contre clé entière stockée au catalogue).

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

### Doublon D2
RÉCONCILIATION CATALOGUE ↔ pg_catalog — spécifiée cinq fois : 01 §11.4 (registre vs pg_namespace/pg_class/pg_attribute/pg_constraint), 02 « Réconciliation » (sept classes, régime REPEATABLE READ), 03 §11 (seize classes, réconciliation de forme), 06 §7 (trois classes de plus), 07 §6.3 (carte des déclencheurs), 10 §9.5 (mode dégradé et trois issues). AUTORITÉ : 02 pour le régime d'exécution, le catalogue des classes et les requêtes ; les autres chapitres n'ajoutent que leurs classes propres, dans la numérotation de 02, et 10 §9.5 garde les issues de réparation.

---

### Doublon D3
POSE D'UN CHAMP LIEN — le plan complet est écrit quatre fois : 03 §9.4 (chemin prudent en trois temps), 04 §4.1 (chemins a et b), 10 §3.4.5 (six étapes numérotées), 06 §6 (restauration). AUTORITÉ : 03 pour le plan, l'ordre et les verrous ; 04 pour la projection, le type, les contraintes et les pré-contrôles ; 10 se réduit à un renvoi. Les trois versions divergent aujourd'hui sur la clause ON DELETE émise et sur l'usage de NOT VALID.

---

### Doublon D4
REFUS DE SUPPRIMER UNE TABLE RÉFÉRENCÉE — spécifié cinq fois avec cinq charges utiles et quatre codes : 02 (ck_link_target_live, TABLE_REFERENCED), 03 §9.2 (JSON complet, TABLE_REFERENCEE), 04 §4.6 (LIEN_TABLE_REFERENCEE), 05 §5.5 (SUPPRESSION_TABLE_REFUSEE_REFERENCE), 06 §4.5 a (trigger + message). AUTORITÉ : 03 §9.2 pour la charge utile et le message, 02 pour la garantie déclarative, 05 pour le filtrage par permissions. Un seul code.

---

### Doublon D6
COLONNE D'AFFICHAGE — spécifiée six fois : 02 (contraintes déclaratives, règles de service), 04 §5 (types éligibles, cas limites), 06 §4.5 c (bascule), 07 §4.3 (exigence de colonne stockée), 09 §4.3 (projection), 10 §7.5 (tests). AUTORITÉ : 02 pour la contrainte et la désignation par défaut, 04 §5 pour les types éligibles et les cas limites. Les autres doivent renvoyer, pas redécider.

---

### Doublon D12
SUPPRESSION LOGIQUE D'UN CHAMP — la liste des objets à défaire est donnée trois fois : 03 §7.2 (tableau NOT NULL / FK / CHECK / index unique / DEFAULT), 04 §1.11 (huit étapes normatives), 06 §4.1 (bloc SQL de l'étape 2). Elles divergent sur le DEFAULT (03 le conserve, 04 et 06 le retirent) et sur l'index de lien (04 le supprime dans la transaction, 06 en CONCURRENTLY hors transaction). AUTORITÉ : 04 §1.11, qui fixe l'empreinte physique d'un champ ; 03 et 06 renvoient.

---

### Doublon D13
BUDGET D'ATTRIBUTS ET COLONNES RELÉGUÉES — trois fois : 03 §3.3, 04 §1.13, 06 §8.1, avec trois couples de seuils et trois codes. AUTORITÉ : 04 §1.13.

---

### Reference cassee R13
C:\data\dev\basedb\docs\architecture\06-cycle-de-vie.md §3.2 « Extension demandée au chapitre Conventions de nommage » : étendre la transition de registre retire → alias aux noms de portée schéma, nécessaire aux alias de renommage de table. 01 §6.3 restreint explicitement cette transition aux seuls noms de schéma (« elle ne concerne que les noms de schéma »). 06 question ouverte 1 le signale sans que 01 ait été modifié.

---

### Reference cassee R14
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §7.5 et §7.8 : « le harnais exécute les requêtes de dérive A, B et C de “Schéma du catalogue _basedb”, plus la dérive D du §3.4.4 ». 02 définit A, A′, B, C, C′, D, E, F, G, où D désigne autre chose que la dérive D de 10 §3.4.4, et 03, 06 et 07 emploient encore d'autres jeux de lettres. Le critère de sortie de phase 2 « Post-test de dérive A, B, C, D à zéro » n'est donc pas interprétable.


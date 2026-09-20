# Constats de relecture croisee concernant 07-historique.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

### Contradiction C1 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

DEUX REGISTRES DE NOMS PHYSIQUES CONCURRENTS. Le chapitre 01 §6.3 définit « _basedb.nom_physique » avec les colonnes portee_id, portee_nature, nom, objet_id, objet_nature, etat (actif/relegue/retire/alias/purge), version_slug, et pose comme invariant : « Elle est le seul détenteur du nom physique. Les tables d'objets du catalogue référencent leur nom par clé étrangère et ne dupliquent jamais la chaîne. » Le chapitre 02 définit à la place « _basedb.physical_object » (schema_name, rel_name, object_kind, owner_kind, owner_id, released_at) ET stocke les noms en clair dans des colonnes texte (base.schema_name, table_def.physical_name, field.physical_name) — exactement la duplication que 01 interdit. Les chapitres 03 (§5.4, §6.1), 04 (§1.2, §11.1), 06 (§1.1) et 07 (§1.2) citent tous « _basedb.nom_physique », qui n'existe pas dans le DDL de 02. Le chapitre 06 §4.1 écrit même « UPDATE _basedb.field SET physical_name_id = $nouvelle_ligne_de_registre », colonne absente de 02.

**Correction demandee** : Trancher pour un registre unique et une seule représentation. Recommandation : conserver la table registre de 01 (elle porte les cinq états et l'historique des noms, indispensables à la purge, à la restauration et aux alias), lui donner son DDL dans le chapitre 02 sous un nom unique, et supprimer de 02 les colonnes physical_name/schema_name au profit d'une FK vers le registre (avec une vue de confort pour la lisibilité). Reporter dans 02 les contraintes CHECK d'alphabet et d'octets, et y ajouter la vue _basedb.v_nom_physique_qualifie que 01 §11.4 réclame.

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

### Contradiction C6 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 06-cycle-de-vie.md, 07-historique.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LA FONCTION uuid_generate_v7() VIT DANS CINQ ENDROITS DIFFÉRENTS. 02 : « CREATE FUNCTION public.uuid_generate_v7() … Installée par défaut dans public, délibérément hors de _basedb et des schémas b_* », schéma effectif relu dans setting('ddl.uuid_function_schema'), corps en LANGUAGE sql BEGIN ATOMIC. 03 §1.3 : « <util>.uuid_generate_v7() » dans BASEDB_UTIL_SCHEMA, corps en plpgsql. 04 §10 : « DEFAULT _basedb.uuid_generate_v7() … La fonction vit dans _basedb, comme toutes les fonctions partagées ». 06 : « <BASEDB_UTIL_SCHEMA>.uuid_generate_v7() ». 07 §3.2 : « _basedb.uuid_v7() », nom différent, construite sur pgcrypto. 10 §6.1/§9.1 : BASEDB_UTIL_SCHEMA, « public par défaut », figé par témoin. Or ce nom est écrit dans le DEFAULT de la colonne _id de TOUTES les tables utilisateur : le changer après coup exige un ALTER de toutes les tables (10 §6.4 le dit explicitement).

**Correction demandee** : Trancher une seule fois dans le chapitre 02 : un nom (uuid_generate_v7), un schéma (BASEDB_UTIL_SCHEMA, valeur par défaut à arbitrer entre public et _basedb), un corps de référence. Corriger 03 §1.3, 04 §10, 06 et 07 §3.2 pour y renvoyer sans le redéfinir. Le même arbitrage vaut pour set_updated_at().

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

### Contradiction C12 [bloquant]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 07-historique.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

WEBHOOKS — MASQUE DE CHAMP : AMPUTATION INTERDITE CONTRE AMPUTATION OBLIGATOIRE. 05 §4.4 règle 2 : « Le rôle du webhook doit avoir un masque de lecture complet sur chaque table abonnée. Si un seul champ de la table lui est masqué, la création ou la modification est refusée, code WEBHOOK_MASQUE_PARTIEL (422) … La seule dégradation possible est donc la désactivation du webhook, jamais l'amputation silencieuse. » 08 §10.3 fait exactement l'inverse : « La charge utile est projetée avec les permissions effectives de ce rôle … Un champ non lisible pour ce rôle est absent de before, de after et de changed », et §10.4 tronque encore les champs de plus de 64 Kio. 07 §10.1 écrit pour sa part la ligne complète (before_row / after_row) sans aucune notion de rôle ni de masque. Le cadrage exige une charge utile complète : les trois interprétations en tirent trois régimes différents.

**Correction demandee** : Trancher dans 05 §4.4, puis réécrire 08 §10.3 en conséquence. Si le masque complet est exigé (recommandé, c'est l'argument du cadrage « éviter un aller-retour au consommateur »), 08 §10.3 se réduit à « le rôle a par construction un masque complet ; sinon le webhook est désactivé », et 07 §10.1 doit dire quel masque la capture applique.

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

### Doublon D6
COLONNE D'AFFICHAGE — spécifiée six fois : 02 (contraintes déclaratives, règles de service), 04 §5 (types éligibles, cas limites), 06 §4.5 c (bascule), 07 §4.3 (exigence de colonne stockée), 09 §4.3 (projection), 10 §7.5 (tests). AUTORITÉ : 02 pour la contrainte et la désignation par défaut, 04 §5 pour les types éligibles et les cas limites. Les autres doivent renvoyer, pas redécider.

---

### Doublon D10
ÉCRITURES DE MASSE ET SEUILS — spécifiés deux fois avec deux jeux de seuils : 04 §1.10 (seuil_lots 1 000 000, seuil_reecriture_annoncee 100 000, ANALYZE final) et 07 §5 (history.bulk_threshold 500 lignes cumulées, plafond dur 100 000, bulk_operation). AUTORITÉ : 07 pour le volume d'historique, 04 pour le DDL et la réécriture de table. Les deux doivent se citer.

---

### Reference cassee R2
C:\data\dev\basedb\docs\architecture\01-conventions-nommage.md §9.1 : « La fonction appelée par ces triggers est unique et partagée, écrite en dur dans _basedb (section 02) : il n'y a jamais une fonction par table ». 02 ne définit aucune fonction de déclencheur ; seul 07 §1.3 définit _basedb.tg_capture_v1() et seul 10 §3.5 définit set_updated_at(), dans BASEDB_UTIL_SCHEMA et non dans _basedb.

---

### Reference cassee R3
C:\data\dev\basedb\docs\architecture\07-historique.md §16 : « Deux codes utilisés par cette section sont définis ailleurs : VERROU_INDISPONIBLE (section 01) et ID_IMMUABLE (section 03). » Le code ID_IMMUABLE n'apparaît pas dans le §16 de 03, ni ailleurs dans le document.

---

### Reference cassee R4
C:\data\dev\basedb\docs\architecture\07-historique.md §11.1 point 2 : « tg_<table>__systeme (section 03) honore les valeurs fournies de _id, _created_at et _created_by quand basedb.restauration = 'on' … C'est une exigence adressée à la section 03 ». 03 ne décrit ni le corps ni le comportement de ce déclencheur, et 10 §3.5 définit set_updated_at() sans aucune notion de mode restauration.

---

### Reference cassee R6
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §6.5 : « La source est le journal de suppression de la section “Historique des données et des structures” ». 07 ne définit aucun journal de suppression exposant deleted_at, deleted_by, cause et un horizon de rétention.

---

### Reference cassee R14
C:\data\dev\basedb\docs\architecture\10-architecture-logicielle.md §7.5 et §7.8 : « le harnais exécute les requêtes de dérive A, B et C de “Schéma du catalogue _basedb”, plus la dérive D du §3.4.4 ». 02 définit A, A′, B, C, C′, D, E, F, G, où D désigne autre chose que la dérive D de 10 §3.4.4, et 03, 06 et 07 emploient encore d'autres jeux de lettres. Le critère de sortie de phase 2 « Post-test de dérive A, B, C, D à zéro » n'est donc pas interprétable.

---

### Trou de couverture T6 — Journal de suppression des enregistrements (pierres tombales de lignes)
08 §6.5 fait de la route GET /data/{base}/{table}/deleted?since= le seul chemin de reprise après panne d'un consommateur, avec une charge utile {_id, deleted_at, deleted_by, cause}, un meta.horizon, une pagination (deleted_at, _id) et une rétention « au moins 90 jours », en déclarant : « La source est le journal de suppression de la section Historique ; ce chapitre n'en définit que l'exposition HTTP. » Or 07 ne définit aucun journal de suppression de ce genre : il a record_revision avec op = 'delete', dont la clé de pagination est (occurred_at, id), dont la rétention est de 24 mois, et qui ne porte ni deleted_at ni horizon. 08 §10.7 et §17.2 font dépendre toute la procédure de resynchronisation des webhooks de cette route.

**Ou le traiter** : Chapitre 07, en ajoutant explicitement l'index et la vue de lecture correspondants, ou en renonçant à la route et en la remplaçant par une lecture paginée de record_revision filtrée sur op='delete'.


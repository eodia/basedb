# Constats de relecture croisee concernant 09-serveur-mcp.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

### Contradiction C2 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

MOTIFS DES NOMS DÉRIVÉS INCOMPATIBLES — DIRECTEMENT SUR LES RELATIONS. 01 §9.1 fixe « fk_<table>__<colonne> » → fk_factures__clients_id, « ix_<table>__<colonne> », « uq_<table>__<colonne> », « ck_<table>__<colonne>__<regle> », « pk_<table> », avec répartition de budget par composant (§9.6). 02 « Budget de longueur des noms physiques » fixe au contraire « fk_<field.name>_<id12> » → fk_client_id_018f3c2a91b4, « ix_<field.name>_<id12> », « uq_<field.name>_<id12> », « ck_<field.name>_<id12> », « nn_<field.name>_<id12> », en argumentant que « Le désambiguateur est placé avant la partie variable, jamais après ». 03, 04 et 09 emploient systématiquement les motifs de 01 (fk_factures__clients_id). 08 §0 I5 cite une troisième forme encore : « fk_factures__client_id__clients ». Les deux conventions sont mutuellement exclusives et le budget d'octets de chacune est calculé sur l'autre hypothèse.

**Correction demandee** : Retenir les motifs de 01 §9.1 (ils sont normatifs, lisibles dans un message d'erreur PostgreSQL, et déjà repris par 03, 04, 06, 07 et 09) et réécrire la section « Budget de longueur des noms physiques » de 02 pour s'y conformer, en remplaçant le désambiguateur <id12> par la boucle de suffixe et la répartition de budget du §9.6. Corriger l'occurrence « fk_factures__client_id__clients » de 08 §0.

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

### Contradiction C17 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 09-serveur-mcp.md, 10-architecture-logicielle.md, 07-historique.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

LA TABLE _basedb.migration NE PEUT PAS ÊTRE IMPLÉMENTÉE EN L'ÉTAT. 02 : status CHECK IN ('proposed','applying','applied','failed','reverted'), sequence bigint NOT NULL, up_sql text NOT NULL, origin, checksum, catalog_diff, error_sample. 03 §4.2 exige « up_sql n'est pas un bloc de texte : c'est un tableau ordonné d'énoncés, en JSON », §4.4 exige sequence « nullable tant que la migration n'est pas passée en en_cours », et §14.3/§16 emploient les statuts en_cours, appliquee, echouee, interrompue. 03 §15 réclame en outre planner_version, executor_id, lease_until, attempts, scheduled_for, pg_sqlstate, pg_message, pg_detail, failed_statement_n, etape, duration_ms, pg_backend_pid. 09 §7.2 emploie les statuts anglais de 02 plus un état superseded absent des deux, et 09 §7.2 dit que « le CHECK de _basedb.migration.status défini en section 02 ne comporte pas d'état expiré ». 07 §7.1 ajoute encore une table migration_execution avec outcome IN ('running','success','failed','cancelled','unknown'). 10 §3.4.2 emploie en_cours/appliquee/echouee/interrompue. Quatre vocabulaires d'états pour une même colonne.

**Correction demandee** : Réécrire la table migration dans 02 en intégrant le §15 de 03 : un seul vocabulaire d'états (choisir le français de 03/10 ou l'anglais de 02, cohérent avec l'arbitrage de langue du catalogue), sequence nullable avec l'index unique partiel correspondant, up_sql en jsonb, et les colonnes de bail, de diagnostic et de planificateur. Ajouter les états superseded et, si retenu, expired.

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

### Contradiction C23 [majeur]
**Chapitres impliques** : 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

TROIS VOCABULAIRES D'OPÉRATEURS DE FILTRE, POUR UNE MÊME COUCHE DE FILTRAGE. 04 §9 (« liste de référence … c'est lui que la spécification OpenAPI et la description MCP dérivent ») : egal, egal_insensible, different, contient, commence_par, finit_par, dans, est_vide, superieur, superieur_egal, inferieur, inferieur_egal, entre, avant, apres. 08 §4.2 : eq, ne, gt, gte, lt, lte, between, in, nin, co, nco, sw, ew, null, nnull, has. 09 §5.1 : eq, neq, gt, gte, lt, lte, contains, starts_with, in, is_null. Aucun des trois n'est un sous-ensemble des deux autres (08 a nin/nco/ew/has que les autres n'ont pas ; 09 a neq là où 08 a ne ; 04 a egal_insensible et finit_par sans équivalent en 09). 08 introduit en outre l'opérateur has sur « select avec is_multiple », alors que 04 §3 gèle est_multiple à false et que 02 déclare « Aucune colonne is_multiple n'existe ».

**Correction demandee** : Faire de 04 §9 la table normative, comme il le revendique, et y ajouter la colonne « nom exposé par l'API/MCP » avec un seul jeu d'identifiants. Réécrire 08 §4.2 et 09 §5.1 comme des renvois, et supprimer l'opérateur has tant que le choix multiple est hors périmètre v1.

---

### Contradiction C24 [majeur]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

NOMS DES VERBES DE PERMISSION ET COMPTEUR D'INVALIDATION. 05 §1.3 pose une « liste fermée » de sept actions, celles du CHECK de _basedb.permission : read, create, update, delete, manage_schema, manage_permissions, manage_tokens, et §1.5 ajoute des « opérations réservées » qui ne sont pas des verbes. 08 §1.4 et §11.1 exigent au contraire deux droits inconnus de 05 et de 02 : « integration.manage et tenant.admin sont des droits d'instance », et 08 §15.6 les réclame à 05 ; 08 question ouverte 1 reconnaît que « ni l'un ni l'autre n'est acté par le cadrage ». De même, le compteur d'invalidation des droits s'appelle permission_version en 08 (§2.5, dans l'ETag d'OpenAPI et dans l'AAD du curseur) et authz_version en 05 §15 et 09 §9.5 — 09 §1.4 le réclamant explicitement à 02.

**Correction demandee** : Étendre le CHECK de _basedb.permission en 02 et la liste de 05 §1.3 si un droit d'administration des intégrations est nécessaire, ou réécrire 08 pour employer manage_tokens. Retenir un seul nom de compteur (recommandation : authz_version, déjà demandé par 05 et 09) et le définir une fois dans 02.

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

### Doublon D11
TRADUCTION DES SQLSTATE — donnée cinq fois, avec cinq jeux de codes : 03 §5.4, 05 §5.5, 08 §7.3, 09 §14.4, 10 §8.2. AUTORITÉ : 10 §8.2, qui pose « un seul endroit de traduction : l'exécuteur de requêtes du noyau ». Les quatre autres doivent devenir des renvois, ce qui résoudra du même coup la contradiction sur les codes de relation.

---

### Doublon D14
IDEMPOTENCE — trois fois : 08 §3.3, 09 §6.3, 10 §4.5. AUTORITÉ : 10 §4.5 pour les opérations de structure, 08 §3.3 pour les opérations de données, 09 renvoie aux deux.

---

### Reference cassee R7
C:\data\dev\basedb\docs\architecture\09-serveur-mcp.md §1.2 : le point de terminaison POST /mcp « est décrit à la main dans “API REST, OpenAPI, webhooks, jetons d'intégration” comme point de terminaison de transport, au même titre que les routes d'authentification ». Ni /mcp ni aucune route /auth/* ne figurent au plan d'URL de 08 §1.4.

---

### Reference cassee R8
C:\data\dev\basedb\docs\architecture\09-serveur-mcp.md §1.4 réclame à 02 : _basedb.cle_idempotence, champ.expose_aux_agents, base.mcp_actif, api_token.surfaces_autorisees, authz_version, et à 03 une « table de correspondance versionnée des phrases d'effet par version majeure de PostgreSQL ». Aucun de ces objets n'existe dans 02 ni dans 03.


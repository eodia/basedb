# Constats de relecture croisee concernant 08-api-rest-webhooks.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

### Contradiction C2 [bloquant]
**Chapitres impliques** : 01-conventions-nommage.md, 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

MOTIFS DES NOMS DÉRIVÉS INCOMPATIBLES — DIRECTEMENT SUR LES RELATIONS. 01 §9.1 fixe « fk_<table>__<colonne> » → fk_factures__clients_id, « ix_<table>__<colonne> », « uq_<table>__<colonne> », « ck_<table>__<colonne>__<regle> », « pk_<table> », avec répartition de budget par composant (§9.6). 02 « Budget de longueur des noms physiques » fixe au contraire « fk_<field.name>_<id12> » → fk_client_id_018f3c2a91b4, « ix_<field.name>_<id12> », « uq_<field.name>_<id12> », « ck_<field.name>_<id12> », « nn_<field.name>_<id12> », en argumentant que « Le désambiguateur est placé avant la partie variable, jamais après ». 03, 04 et 09 emploient systématiquement les motifs de 01 (fk_factures__clients_id). 08 §0 I5 cite une troisième forme encore : « fk_factures__client_id__clients ». Les deux conventions sont mutuellement exclusives et le budget d'octets de chacune est calculé sur l'autre hypothèse.

**Correction demandee** : Retenir les motifs de 01 §9.1 (ils sont normatifs, lisibles dans un message d'erreur PostgreSQL, et déjà repris par 03, 04, 06, 07 et 09) et réécrire la section « Budget de longueur des noms physiques » de 02 pour s'y conformer, en remplaçant le désambiguateur <id12> par la boucle de suffixe et la répartition de budget du §9.6. Corriger l'occurrence « fk_factures__client_id__clients » de 08 §0.

---

### Contradiction C9 [bloquant]
**Chapitres impliques** : 05-permissions.md, 07-historique.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

QUATRE ARCHITECTURES CONCURRENTES POUR L'HISTORIQUE ET LA BOÎTE D'ENVOI DES WEBHOOKS. (a) 07 §1.1 : capture par déclencheurs PostgreSQL AFTER … FOR EACH STATEMENT, écriture dans _basedb.record_revision et _basedb.change_event, dans la transaction de la donnée, sur le pool donnees — « jamais par écriture applicative » ; §4.5 : « si l'historique échoue, la donnée échoue ». (b) 08 §10.1 : « Deux pools, c'est deux connexions, donc deux transactions : écrire la livraison directement dans _basedb.webhook_delivery dans la transaction qui écrit la donnée est impossible » → boîte d'envoi « b_<tenantId>_<base>._outbox » dans le schéma de données, alimentée par déclencheur, drainée ensuite vers _basedb où sont écrits audit_log ET l'historique (tableau §10.1 : « Historique des données | _basedb | non — produit par le drain »). (c) 10 §3.3 : un troisième schéma « _basedb_local » colocalisé avec les données, portant record_history, domain_event, audit_buffer, écrits applicativement par le noyau, relayés toutes les 5 s vers _basedb. (d) 05 §4.4 : « _basedb.webhook_outbox », capturé sous le contexte système webhook.capture avec le masque du rôle du webhook. Les quatre se contredisent sur le lieu, le nom des tables, le mécanisme de capture (déclencheur vs applicatif), l'atomicité et la latence.

**Correction demandee** : Arbitrage structurant à porter dans le chapitre 00 puis à propager. Recommandation : retenir la capture par déclencheur (c'est la seule qui tienne la promesse « écriture SQL directe » du cadrage, argument décisif de 07 §1.1 et repris par 08 §10.1) et un lieu unique. Puis réécrire entièrement 10 §3.3 (supprimer _basedb_local ou en faire le nom retenu), 08 §10.1 et 05 §4.4 pour renvoyer à 07 sans redéfinir. Une seule table de boîte d'envoi, un seul nom pour la table d'historique.

---

### Contradiction C11 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 04-types-de-champs.md, 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 05-permissions.md

RELATIONS — CE QUE VOIT UN LECTEUR DONT LA TABLE CIBLE EST ILLISIBLE : QUATRE RÉPONSES. 02 « Colonne d'affichage » : « Même règle si le lecteur n'a pas le droit de lire la table cible : le lien se réduit à son identifiant, sans erreur ». 04 §4.7 : « display vaut null … Le lien lui-même reste visible : l'identifiant n'est pas une donnée sensible en soi ». 05 §5.1 : « L'API renvoie une valeur opaque, pas l'identifiant natif : {"client_id": "lnk_7Qb2…"}, HMAC-SHA256(clé d'instance, tenant_id ‖ id de la table cible ‖ _id) tronquée à 132 bits », avec filtre et tri réduits à IS NULL / IS NOT NULL. 08 §5.5 : « Pas de read sur la table cible → {"id":null,"display":null,"masked":true} ; quand la table cible n'est pas lisible du tout, l'identifiant est masqué par défaut ». 09 §4.3 : « link: null, expandable: false » mais l'identifiant reste dans la ligne. Les quatre produisent quatre charges utiles JSON différentes pour le même cas, et 05 seul introduit un espace d'identifiants opaques qui n'existe nulle part ailleurs (ni dans le catalogue, ni dans OpenAPI, ni dans le MCP).

**Correction demandee** : Trancher dans 05 (autorité sur la non-divulgation) et écrire une seule forme de réponse, reprise mot pour mot par 02, 04, 08 §5.5 et 09 §4.3. Recommandation : la forme de 08 ({id: null, display: null, masked: true}), qui ferme la fuite d'horodatage UUIDv7 sans introduire un second espace d'identifiants ; si la valeur opaque de 05 est conservée, elle doit être spécifiée dans 02 (clé d'instance, stabilité, non-résolution) et décrite dans OpenAPI par 08.

---

### Contradiction C12 [bloquant]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 07-historique.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

WEBHOOKS — MASQUE DE CHAMP : AMPUTATION INTERDITE CONTRE AMPUTATION OBLIGATOIRE. 05 §4.4 règle 2 : « Le rôle du webhook doit avoir un masque de lecture complet sur chaque table abonnée. Si un seul champ de la table lui est masqué, la création ou la modification est refusée, code WEBHOOK_MASQUE_PARTIEL (422) … La seule dégradation possible est donc la désactivation du webhook, jamais l'amputation silencieuse. » 08 §10.3 fait exactement l'inverse : « La charge utile est projetée avec les permissions effectives de ce rôle … Un champ non lisible pour ce rôle est absent de before, de after et de changed », et §10.4 tronque encore les champs de plus de 64 Kio. 07 §10.1 écrit pour sa part la ligne complète (before_row / after_row) sans aucune notion de rôle ni de masque. Le cadrage exige une charge utile complète : les trois interprétations en tirent trois régimes différents.

**Correction demandee** : Trancher dans 05 §4.4, puis réécrire 08 §10.3 en conséquence. Si le masque complet est exigé (recommandé, c'est l'argument du cadrage « éviter un aller-retour au consommateur »), 08 §10.3 se réduit à « le rôle a par construction un masque complet ; sinon le webhook est désactivé », et 07 §10.1 doit dire quel masque la capture applique.

---

### Contradiction C13 [bloquant]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 05-permissions.md, 06-cycle-de-vie.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

REGISTRE DES CODES D'ERREUR INCOHÉRENT, ET PARTICULIÈREMENT SUR LES RELATIONS. Même condition, codes différents : refus de supprimer une table référencée → TABLE_REFERENCED (02), TABLE_REFERENCEE (03 §16, 06 §10, 10 §8.1), LIEN_TABLE_REFERENCEE (04 §12), SUPPRESSION_TABLE_REFUSEE_REFERENCE (05 §14). Valeurs orphelines à la pose d'une FK → VALEURS_LIEES_INVALIDES (03, 06, 10), LIEN_VALEURS_ORPHELINES (04), LIEN_DONNEES_INCOMPATIBLES (05). Écriture d'un lien vers une cible inexistante → LIEN_CIBLE_INTROUVABLE (04, 08), VALEUR_LIEN_INEXISTANTE (05), VALEUR_LIEN_INVALIDE (09), VALEUR_LIEE_INTROUVABLE (10). Suppression d'une ligne référencée → SUPPRESSION_REFUSEE_REFERENCE (05), ENREGISTREMENT_REFERENCE (08), LIGNE_REFERENCEE (03, 10). Doublons → VALEURS_DUPLIQUEES (03), UNICITE_DOUBLONS (04), VALEUR_DUPLIQUEE (05, 08, 10), VALEUR_DEJA_UTILISEE (09). S'ajoute un conflit de langue : 05 §7.1 pose comme règle pour tout le document « Tous les codes d'erreur sont des identifiants machine en français », 10 §8.1 la confirme, mais 02 emploie PG_VERSION_TOO_OLD, DB_ENCODING_NOT_UTF8, DB_NOT_OWNED, PHYSICAL_NAME_TAKEN, TABLE_REFERENCED, DISPLAY_FIELD_IN_USE, BASE_NOT_EMPTY, FIELD_CONFIG_MISSING. Enfin le même refus d'encodage porte deux codes : ENCODAGE_NON_SUPPORTE (01) et DB_ENCODING_NOT_UTF8 (02).

**Correction demandee** : Constituer dans @basedb/contracts un registre unique des codes, publié en annexe du chapitre 00, et n'autoriser chaque chapitre qu'à y ajouter, jamais à renommer. Appliquer la règle de 05 §7.1 (français, majuscules ASCII) en corrigeant les huit codes anglais de 02, et fusionner les cinq familles de doublons ci-dessus en un code par condition.

---

### Contradiction C14 [bloquant]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

COLONNES SYSTÈME : TOUJOURS LISIBLES CONTRE SOUMISES AUX PERMISSIONS DE CHAMP. 05 §4.2, écrit « noir sur blanc parce que plusieurs mécanismes en dépendent » : « _id, _created_at, _updated_at, _created_by et _updated_by sont toujours lisibles dès que read est accordé sur la table, jamais inscriptibles, et ne peuvent pas porter de field_permission », et §7.3 assume l'oracle résiduel. 08 §4.3 décide l'inverse : « un rôle dont au moins un champ est masqué sur cette table ne lit ni _updated_at, ni _updated_by, ni _created_by … sauf si l'administrateur lui accorde explicitement l'option audit_visible sur la table », et en tire (§14, ligne _updated_at) « Fermé par défaut ». L'option audit_visible n'existe nulle part ailleurs (ni dans 02, ni dans 05). Conséquence : selon le chapitre lu, la reprise incrémentale de 08 §6.5 fonctionne ou est impossible pour tout rôle à champ masqué.

**Correction demandee** : Trancher dans 05 §4.2 (autorité sur les permissions). Si l'option audit_visible est retenue, la définir dans 05 §1.3 et l'ajouter au catalogue en 02 ; sinon supprimer le paragraphe correspondant de 08 §4.3, la ligne _updated_at du tableau §14 et la limite 3 des risques de 08.

---

### Contradiction C15 [bloquant]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md, 04-types-de-champs.md
**Chapitre designe pour porter la correction** : 05-permissions.md

RELATIONS — ON DELETE CASCADE : QUI EXÉCUTE, ET QUI CONFIRME. 05 §5.7 : autorisation nominative à la création du champ, élévation + jeton de confirmation, et surtout « À l'exécution … Aucun seuil bloquant : une confirmation supplémentaire à l'exécution, sans titulaire de droit clairement défini, serait soit décorative, soit un obstacle arbitraire sur une opération déjà réservée et confirmée ». 08 §8.3 impose exactement cette confirmation à l'exécution : « Règle 1 — la cascade est exécutée par l'application, pas par PostgreSQL », suppression niveau par niveau, droit delete exigé sur chaque table atteinte, décompte exact, en-tête X-Basedb-Confirm-Cascade obligatoire égal au décompte serveur, plafond de 5 000 lignes (CASCADE_TROP_LARGE) et profondeur 5. 04 §4.2 et 03 §9.7 supposent au contraire que la cascade est exécutée par PostgreSQL. Cette divergence casse aussi 07 §4.1, qui détermine cause = 'cascade' par pg_trigger_depth() > 1 : avec la cascade applicative de 08, la profondeur vaut 1 et toutes les lignes cascadées seraient historisées en 'direct'.

**Correction demandee** : Trancher dans 05 §5.7 après arbitrage avec 08. Si la cascade applicative est retenue (elle seule permet la charge utile de webhook par ligne exigée par le cadrage), il faut : lever l'interdiction de 05 sur la confirmation à l'exécution, ajouter CASCADE_TROP_LARGE / CASCADE_PROFONDEUR au registre de 05, et remplacer dans 07 §4.1 le critère pg_trigger_depth() par une variable de session posée par le noyau.

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

### Contradiction C24 [majeur]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

NOMS DES VERBES DE PERMISSION ET COMPTEUR D'INVALIDATION. 05 §1.3 pose une « liste fermée » de sept actions, celles du CHECK de _basedb.permission : read, create, update, delete, manage_schema, manage_permissions, manage_tokens, et §1.5 ajoute des « opérations réservées » qui ne sont pas des verbes. 08 §1.4 et §11.1 exigent au contraire deux droits inconnus de 05 et de 02 : « integration.manage et tenant.admin sont des droits d'instance », et 08 §15.6 les réclame à 05 ; 08 question ouverte 1 reconnaît que « ni l'un ni l'autre n'est acté par le cadrage ». De même, le compteur d'invalidation des droits s'appelle permission_version en 08 (§2.5, dans l'ETag d'OpenAPI et dans l'AAD du curseur) et authz_version en 05 §15 et 09 §9.5 — 09 §1.4 le réclamant explicitement à 02.

**Correction demandee** : Étendre le CHECK de _basedb.permission en 02 et la liste de 05 §1.3 si un droit d'administration des intégrations est nécessaire, ou réécrire 08 pour employer manage_tokens. Retenir un seul nom de compteur (recommandation : authz_version, déjà demandé par 05 et 09) et le définir une fois dans 02.

---

### Contradiction C25 [majeur]
**Chapitres impliques** : 02-catalogue.md, 03-moteur-ddl-migrations.md, 04-types-de-champs.md, 07-historique.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 10-architecture-logicielle.md

EXTENSIONS POSTGRESQL : AUCUNE, OU TROIS. 03 §1.2 : « Aucune extension n'est requise, et le moteur n'en installe aucune », avec tableau de rejet (uuid-ossp, pgcrypto, pg_stat_statements). 10 §9.1 : « Aucune extension n'est requise ». 02 emploie gen_random_uuid() du cœur. Mais 04 §1.8 installe pg_trgm (« CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA _basedb ») et en fait un prérequis du filtre « contient » indexé, plus la collation ICU und-x-icu dont l'absence est un refus de démarrage (PREREQUIS_ICU_ABSENT). 08 §13.5 exige pg_trgm ET unaccent (« L'installation de unaccent et pg_trgm est une dépendance d'installation »), question ouverte 4 reconnaissant que le rôle peut ne pas en avoir le droit. 07 §3.2 construit _basedb.uuid_v7() « sur clock_timestamp() et gen_random_bytes() de pgcrypto — extension de confiance ».

**Correction demandee** : Trancher dans 10 §9.1 (autorité sur les hypothèses d'environnement) la liste close des extensions et collations exigées, avec le comportement de repli documenté quand elles manquent. Puis corriger 03 §1.2 pour qu'il cesse d'affirmer « aucune », et supprimer la dépendance à pgcrypto de 07 §3.2 (gen_random_uuid est dans le cœur depuis PG13).

---

### Contradiction C31 [majeur]
**Chapitres impliques** : 02-catalogue.md, 05-permissions.md, 08-api-rest-webhooks.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

UN UTILISATEUR APPARTIENT-IL À UN OU PLUSIEURS TENANTS ? 02 modélise une appartenance multiple : table _basedb.tenant_member (tenant_id, user_id) avec clé primaire composite, et app_user sans colonne tenant_id. 05 §13 pose l'inverse comme règle de cloisonnement : « Un utilisateur appartient à exactement un tenant. Le contexte d'acteur porte donc toujours un tenant_id, figé à la création de la session, sans choix ni bascule », et §15 réclame à 02 « app_user : tenant_id NOT NULL ». L'étape 2 de l'algorithme de décision de 05 §3.2, présentée comme « inconditionnelle », repose entièrement sur cette hypothèse.

**Correction demandee** : Ajouter app_user.tenant_id NOT NULL au DDL de 02 et décider du sort de tenant_member (la supprimer, ou la conserver en la déclarant hors usage v1), en cohérence avec le reste des ajouts réclamés par 05 §15.

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

### Contradiction C35 [majeur]
**Chapitres impliques** : 08-api-rest-webhooks.md, 09-serveur-mcp.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

TROIS MÉCANISMES D'IDEMPOTENCE, DANS TROIS ENDROITS. 08 §3.3 : table « b_<tenantId>_<base>._idempotency » dans le schéma de données, contrainte d'unicité (token_id, cle), états en_cours/termine, rétention 24 h, avec cinq codes IDEMPOTENCE_*. 09 §6.3 : « Le noyau mémorise le couple (jeton, outil, empreinte des paramètres normalisés) → réponse rendue, dans _basedb.cle_idempotence, avec une durée de vie de 24 heures », code CLE_IDEMPOTENCE_REUTILISEE. 10 §4.5 : « persistée dans une colonne à contrainte d'unicité de _basedb.migration », fenêtre de 10 minutes, code MIGRATION_EN_COURS. Aucun des trois n'est décrit dans 02, et 08 place de surcroît une table système dans un schéma utilisateur b_*, ce que la réconciliation de 01 §11.4 et 02 (dérives C/D) signalerait comme un objet physique inconnu du registre.

**Correction demandee** : Unifier en un seul mécanisme et un seul emplacement, décrit dans 02 : une table d'idempotence pour les opérations de données (avec la portée acteur retenue) et la colonne d'unicité de migration pour les opérations de structure. Si une table doit vivre dans un schéma b_*, l'inscrire explicitement au registre des noms physiques et l'exclure des dérives.

---

### Contradiction C36 [majeur]
**Chapitres impliques** : 02-catalogue.md, 08-api-rest-webhooks.md
**Chapitre designe pour porter la correction** : 02-catalogue.md

webhook_delivery : DEUX FORMES INCOMPATIBLES, ET AUCUN DDL. 02 décrit la table ainsi : « webhook_delivery (une ligne par tentative, avec payload jsonb, status, attempt, response_code, error) est partitionnée par mois … son détail relève de “API REST, OpenAPI, webhooks, jetons d'intégration” ». 08 §10.1 décide l'inverse : le drain « crée dans _basedb.webhook_delivery une ligne par abonnement concerné, contenant une référence (base_id, outbox_id), le rôle de projection, la clé de partition d'ordre et l'état — jamais le corps », et §10.4 : « webhook_delivery ne conserve que la référence … Sans cela, un lot de 1 000 modifications sur une table à documents écrirait plusieurs gigaoctets dans le catalogue ». 08 §10.6 emploie de surcroît des colonnes non décrites (partition_key, statut IN ('en_attente','en_vol'), prochaine_tentative_a) et renvoie pour le partitionnement à 02, qui renvoie à 08 : la table n'a de DDL nulle part.

**Correction demandee** : Écrire le DDL complet de webhook_delivery dans 02, dans la forme retenue par 08 (référence, pas de corps), avec partition_key, statut, prochaine_tentative_a, attempts et le partitionnement mensuel ; corriger la phrase de 02 qui mentionne payload jsonb.

---

### Doublon D5
LIENS INVERSES — spécifiés quatre fois : 02 « Liens inverses, sans table ni configuration » (requête SQL de référence), 04 §6 (bornage 20 blocs / 50 lignes / 500+), 08 §5.6 (route, 25 groupes, count 1 000, preview 3), 09 §4.2 (bloc inverse_links + how_to_list). AUTORITÉ : 02 pour la requête catalogue, 04 pour le bornage sémantique, 08 pour le contrat HTTP. Les bornages de 04 et 08 doivent être fusionnés, pas juxtaposés.

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

### Reference cassee R5
C:\data\dev\basedb\docs\architecture\02-catalogue.md, table webhook_delivery : « son détail relève de “API REST, OpenAPI, webhooks, jetons d'intégration” ». C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §10.6 : « webhook_delivery est partitionnée par mois (section “Schéma du catalogue _basedb”) ». Renvoi circulaire : la table n'a de DDL dans aucun des deux, et 08 §10.6 emploie des colonnes (partition_key, statut, prochaine_tentative_a) que 02 ne connaît pas.

---

### Reference cassee R6
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §6.5 : « La source est le journal de suppression de la section “Historique des données et des structures” ». 07 ne définit aucun journal de suppression exposant deleted_at, deleted_by, cause et un horizon de rétention.

---

### Reference cassee R7
C:\data\dev\basedb\docs\architecture\09-serveur-mcp.md §1.2 : le point de terminaison POST /mcp « est décrit à la main dans “API REST, OpenAPI, webhooks, jetons d'intégration” comme point de terminaison de transport, au même titre que les routes d'authentification ». Ni /mcp ni aucune route /auth/* ne figurent au plan d'URL de 08 §1.4.

---

### Reference cassee R12
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §15.6 « Contrats attendus des autres sections » réclame permission_version (02, 05), les droits d'instance integration.manage et tenant.admin (05), la fonction immuable basedb_norm et les extensions unaccent et pg_trgm (03), et l'index (<colonne_lien>, _id DESC) (03, 04). Aucun n'existe : 05 pose une liste fermée de sept verbes, 03 déclare qu'aucune extension n'est installée, 04 §1.8 nomme la fonction _basedb.fold_v1 et 04 §4.1 l'index ("c","_id") sans DESC.

---

### Trou de couverture T2 — Conséquences UI des relations, explicitement demandées par le cadrage
Le cadrage exige trois comportements d'interface : la cellule d'un champ lien affiche la valeur d'affichage et non l'identifiant, un clic ouvre le détail de la ligne cible, et la vue détail liste en retour les lignes qui la référencent. Les trois sont mentionnés en passant mais n'ont pas de spécification : 04 §4.7 décrit la charge utile {id, display} et 04 §6 le bornage des liens inverses (20 blocs, 50 lignes, compteur plafonné à 500+), 08 §5.6 décrit la route /referenced_by (25 groupes, count plafonné à 1 000, preview de 3 lignes), 05 §5.3 décrit le filtrage à trois niveaux, 05 §5.1 mentionne « une pastille neutre “enregistrement lié”, non cliquable ». Personne ne dit ce que la cellule affiche quand display vaut null, ce que fait le clic (navigation, panneau latéral, modale), comment se présente le sélecteur de ligne cible (qui s'appuie pourtant sur lookup_records côté MCP), ni comment l'UI réconcilie les trois bornages différents de 04 §6 et 08 §5.6 (20 blocs contre 25 groupes, 50 lignes contre pagination, 500+ contre 1 000).

**Ou le traiter** : Chapitre UI, en renvoyant à 04 §4.7/§5/§6 pour la sémantique et à 08 §5.6 pour le contrat HTTP — après avoir aligné les deux bornages.

---

### Trou de couverture T7 — Restriction de lignes (predicat_lignes)
08 en fait un paramètre non nullable du constructeur SQL (invariant I2), l'émet dans chaque requête sous la forme du marqueur /*predicat_lignes:<table>*/, en fait un test de non-régression obligatoire (§17.1 point 1) et l'inscrit dans le contrat attendu de 05 (§2.4, §15.6). 05 ne connaît aucune restriction de ligne et dit l'inverse : « En v1, il n'existe pas de permission au niveau ligne : “lignes visibles” égale “toutes les lignes d'une table visible” » (§5.3). 08 question ouverte 2 le reconnaît. Le décideur de 05 §6.1 ne renvoie pas de prédicat de lignes dans sa signature.

**Ou le traiter** : 05 §6.1 : ajouter le champ à la signature du décideur avec la valeur constante TRUE en v1, ou retirer l'invariant I2 de 08 et le marqueur de test. Sans arbitrage, le test §17.1 point 1 de 08 ne peut pas être écrit.

---

### Trou de couverture T10 — Export de données
05 §4.3 traite l'export comme un chemin de lecture ordinaire (« même masque, en-tête CSV limité aux champs lisibles, revérification par lots ») et 05 §3.5 borne la réduction de droits en cours d'export à 10 000 lignes. 08 décide l'inverse dans ses décisions retenues : « Aucun point d'entrée d'export | Un flux illimité percerait le plafond que toutes les autres règles construisent | Alternative écartée : export NDJSON », et aucune route d'export ne figure au plan d'URL du §1.4. 06 §5.2 décrit un export CSV, mais c'est l'export préalable à une purge, réservé à l'administration. Le besoin utilisateur d'exporter une grille n'est traité nulle part.

**Ou le traiter** : 08 §1.4 s'il existe, ou 05 §4.3 si l'export disparaît. Dans les deux cas, corriger celui des deux qui cède.

---

### Trou de couverture T11 — Le point de terminaison /mcp et les routes d'authentification
09 §1.2 écrit : « Ce point de terminaison (POST /mcp) … est décrit à la main dans “API REST, OpenAPI, webhooks, jetons d'intégration” comme point de terminaison de transport, au même titre que les routes d'authentification. » Le plan d'URL de 08 §1.4 ne contient ni /mcp, ni aucune route /auth/*, et 08 §2.2 se contente de dire que /auth/* est « hors périmètre de ce chapitre ». Les deux surfaces les plus sensibles du produit — ouverture de session et transport MCP — ne sont donc décrites par aucun chapitre.

**Ou le traiter** : 08 §1.4, en ajoutant une section « points de terminaison hors catalogue » listant /auth/*, /mcp et /healthz, /readyz.

---

### Trou de couverture T12 — Documentation générée à destination des humains
Le cadrage exige que « les relations apparaissent dans la documentation générée » et que la doc soit « générée depuis le catalogue, à jour par construction ». Le document ne connaît qu'OpenAPI (08 §9), et de nombreux chapitres renvoient à une « documentation générée » qui n'a pas de propriétaire : 04 §1.12 (tableau des écarts entre écriture API et écriture SQL directe), 04 §10 (valeur de recouvrement de synchronisation), 03 §9.7 (correspondance restrict → NO ACTION), 04 §4.4 (cycles réflexifs), 06 (avertissements sur les alias). Aucun chapitre ne dit ce qu'est ce document, où il est servi, ni comment il est produit.

**Ou le traiter** : 08 §9, en distinguant la sérialisation OpenAPI et la documentation lisible, toutes deux issues de la même projection.


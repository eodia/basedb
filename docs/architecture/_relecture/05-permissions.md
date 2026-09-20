# Constats de relecture croisee concernant 05-permissions.md

Ce fichier liste tout ce que la relecture croisee du document complet a releve et qui touche ce
chapitre, soit parce qu il est designe pour porter la correction, soit parce qu il est implique
dans la contradiction. Traite chaque point.

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

### Contradiction C24 [majeur]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 09-serveur-mcp.md
**Chapitre designe pour porter la correction** : 08-api-rest-webhooks.md

NOMS DES VERBES DE PERMISSION ET COMPTEUR D'INVALIDATION. 05 §1.3 pose une « liste fermée » de sept actions, celles du CHECK de _basedb.permission : read, create, update, delete, manage_schema, manage_permissions, manage_tokens, et §1.5 ajoute des « opérations réservées » qui ne sont pas des verbes. 08 §1.4 et §11.1 exigent au contraire deux droits inconnus de 05 et de 02 : « integration.manage et tenant.admin sont des droits d'instance », et 08 §15.6 les réclame à 05 ; 08 question ouverte 1 reconnaît que « ni l'un ni l'autre n'est acté par le cadrage ». De même, le compteur d'invalidation des droits s'appelle permission_version en 08 (§2.5, dans l'ETag d'OpenAPI et dans l'AAD du curseur) et authz_version en 05 §15 et 09 §9.5 — 09 §1.4 le réclamant explicitement à 02.

**Correction demandee** : Étendre le CHECK de _basedb.permission en 02 et la liste de 05 §1.3 si un droit d'administration des intégrations est nécessaire, ou réécrire 08 pour employer manage_tokens. Retenir un seul nom de compteur (recommandation : authz_version, déjà demandé par 05 et 09) et le définir une fois dans 02.

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

### Contradiction C33 [majeur]
**Chapitres impliques** : 05-permissions.md, 08-api-rest-webhooks.md, 10-architecture-logicielle.md
**Chapitre designe pour porter la correction** : 05-permissions.md

AUTHENTIFICATION DE L'INTERFACE : COOKIE DIRECT OU JETON D'ACCÈS COURT. 05 §2.1 décrit une session portée par un cookie « HttpOnly, Secure, SameSite=Lax, chemin racine », avec contrôle d'Origin sur toute requête mutante (ORIGINE_REFUSEE). 10 §1.5 décrit la même chose : « apps/api pose un cookie de session httpOnly, Secure, SameSite=Lax … Un composant serveur Next.js qui appelle l'API retransmet le cookie de la requête entrante ». 08 §2.2 décide l'inverse : « le cookie de session n'est accepté que par les routes d'authentification. Le front échange son cookie contre un jeton d'accès de 15 minutes, porté en Authorization: Bearer sur tous les appels /api/v1 », avec cookie en SameSite=Strict et en-tête X-Basedb-Csrf. Les trois chapitres décrivent deux mécanismes incompatibles, et 05 §2.1 comme 10 §1.5 ignorent l'existence du jeton d'accès de 15 minutes.

**Correction demandee** : Trancher dans 08 §2.2 (l'argumentation CSRF y est la plus solide) et propager : corriger l'attribut SameSite et le mode d'appel dans 05 §2.1 et 10 §1.5, et décrire la route d'échange et la durée du jeton d'accès dans le chapitre qui possédera l'authentification (voir le trou correspondant).

---

### Doublon D4
REFUS DE SUPPRIMER UNE TABLE RÉFÉRENCÉE — spécifié cinq fois avec cinq charges utiles et quatre codes : 02 (ck_link_target_live, TABLE_REFERENCED), 03 §9.2 (JSON complet, TABLE_REFERENCEE), 04 §4.6 (LIEN_TABLE_REFERENCEE), 05 §5.5 (SUPPRESSION_TABLE_REFUSEE_REFERENCE), 06 §4.5 a (trigger + message). AUTORITÉ : 03 §9.2 pour la charge utile et le message, 02 pour la garantie déclarative, 05 pour le filtrage par permissions. Un seul code.

---

### Doublon D11
TRADUCTION DES SQLSTATE — donnée cinq fois, avec cinq jeux de codes : 03 §5.4, 05 §5.5, 08 §7.3, 09 §14.4, 10 §8.2. AUTORITÉ : 10 §8.2, qui pose « un seul endroit de traduction : l'exécuteur de requêtes du noyau ». Les quatre autres doivent devenir des renvois, ce qui résoudra du même coup la contradiction sur les codes de relation.

---

### Reference cassee R10
C:\data\dev\basedb\docs\architecture\05-permissions.md §15 réclame à 02 les tables session, confirmation_challenge, webhook_outbox, table_constraint, table_constraint_member et les colonnes app_user.tenant_id / disabled_at / must_change_password / bootstrap_secret_*, webhook.role_id, tenant.authz_version, field_link_config.cascade_granted_by / cascade_granted_at / cascade_audit_id. Aucune n'existe dans 02, qui modélise l'autorisation de cascade par une table cascade_grant et une FK cascade_grant_id — mécanisme différent.

---

### Reference cassee R12
C:\data\dev\basedb\docs\architecture\08-api-rest-webhooks.md §15.6 « Contrats attendus des autres sections » réclame permission_version (02, 05), les droits d'instance integration.manage et tenant.admin (05), la fonction immuable basedb_norm et les extensions unaccent et pg_trgm (03), et l'index (<colonne_lien>, _id DESC) (03, 04). Aucun n'existe : 05 pose une liste fermée de sept verbes, 03 déclare qu'aucune extension n'est installée, 04 §1.8 nomme la fonction _basedb.fold_v1 et 04 §4.1 l'index ("c","_id") sans DESC.

---

### Trou de couverture T4 — Authentification par mot de passe et OAuth
Le cadrage tient en une ligne — « Mot de passe et OAuth » — et le sujet est orphelin. 02 donne la table auth_identity (provider 'password' | 'oidc:<slug>', password_hash argon2id, uq_identity_one_password_per_user) et c'est tout. 05 §2.1/§2.2 décrit la session et l'élévation par « ré-authentification (mot de passe ou WebAuthn) », §12 l'amorçage et le secret d'amorçage. 08 §1.4 place /auth/* « hors périmètre de ce chapitre ». 10 §1.2 met « OAuth et mots de passe » dans apps/api et §10 les exclut du noyau de phase 2. Résultat : personne ne spécifie la configuration des fournisseurs OIDC (table, découverte, clientId/secret, scopes, redirection), le rattachement d'une identité OAuth à un compte existant, la création de compte à la première connexion, la politique de mot de passe, la réinitialisation, le verrouillage après échecs, la vérification d'adresse, ni le canal de courriel dont dépendent 05 §2.2 (notification de changement de rôle) et 05 question ouverte 3.

**Ou le traiter** : Un chapitre dédié, ou une section de 05, qui possède déjà la session, l'élévation et l'amorçage. Le paramètre « fournisseur OAuth » apparaît dans 10 §6.2 sans table de configuration correspondante dans 02.

---

### Trou de couverture T7 — Restriction de lignes (predicat_lignes)
08 en fait un paramètre non nullable du constructeur SQL (invariant I2), l'émet dans chaque requête sous la forme du marqueur /*predicat_lignes:<table>*/, en fait un test de non-régression obligatoire (§17.1 point 1) et l'inscrit dans le contrat attendu de 05 (§2.4, §15.6). 05 ne connaît aucune restriction de ligne et dit l'inverse : « En v1, il n'existe pas de permission au niveau ligne : “lignes visibles” égale “toutes les lignes d'une table visible” » (§5.3). 08 question ouverte 2 le reconnaît. Le décideur de 05 §6.1 ne renvoie pas de prédicat de lignes dans sa signature.

**Ou le traiter** : 05 §6.1 : ajouter le champ à la signature du décideur avec la valeur constante TRUE en v1, ou retirer l'invariant I2 de 08 et le marqueur de test. Sans arbitrage, le test §17.1 point 1 de 08 ne peut pas être écrit.

---

### Trou de couverture T8 — Les tables du catalogue réclamées par 05 et jamais définies
05 §15 « Ajouts demandés au catalogue » liste des objets qui n'existent nulle part dans 02 : la table session (id, user_id, tenant_id, created_at, last_seen_at, absolute_expires_at, revoked_at, elevated_until, empreinte du jeton), confirmation_challenge, webhook_outbox, webhook.role_id NOT NULL, app_user.disabled_at / must_change_password / bootstrap_secret_*, tenant.authz_version, et surtout table_constraint + table_constraint_member, dont dépend entièrement la « clôture des contraintes croisées » de 05 §4.1 — mécanisme présenté comme indispensable pour empêcher la lecture d'un champ masqué par dichotomie sur un CHECK multi-colonnes.

**Ou le traiter** : Chapitre 02, en intégrant le §15 de 05 au DDL. table_constraint est le plus structurant : sans lui, aucun chapitre ne sait quelles colonnes participent à une contrainte composite.

---

### Trou de couverture T10 — Export de données
05 §4.3 traite l'export comme un chemin de lecture ordinaire (« même masque, en-tête CSV limité aux champs lisibles, revérification par lots ») et 05 §3.5 borne la réduction de droits en cours d'export à 10 000 lignes. 08 décide l'inverse dans ses décisions retenues : « Aucun point d'entrée d'export | Un flux illimité percerait le plafond que toutes les autres règles construisent | Alternative écartée : export NDJSON », et aucune route d'export ne figure au plan d'URL du §1.4. 06 §5.2 décrit un export CSV, mais c'est l'export préalable à une purge, réservé à l'administration. Le besoin utilisateur d'exporter une grille n'est traité nulle part.

**Ou le traiter** : 08 §1.4 s'il existe, ou 05 §4.3 si l'export disparaît. Dans les deux cas, corriger celui des deux qui cède.


# 08. API REST, OpenAPI, webhooks et jetons d'intégration

## Rôle de ce chapitre

Ce chapitre spécifie la surface HTTP de basedb : plan d'URL, authentification des appelants, opérations sur les enregistrements, grammaire de filtrage, expansion des liens, pagination par curseur, forme des réponses et des erreurs, projection du catalogue en OpenAPI et en documentation lisible, livraison des webhooks, jetons d'intégration, garde-fous de coût, modèle de menace et exploitation courante.

Il ne redéfinit pas ce qui appartient aux autres chapitres, cités par leur titre là où l'API dépend d'eux : nommage et slugification, tables du catalogue, émission du DDL et migrations, projection des types et opérateurs de filtre, résolution des droits, alias et suppression logique, capture et historique, surface MCP, ouverture de session, pools et traduction des SQLSTATE. Le §15.6 énumère les contrats qu'il en exige.

---

## 0. Invariants

Six invariants gouvernent tout ce qui suit. Chacun se traduit par une signature de constructeur, un test de non-régression nommé au §17, ou les deux. Toute règle énoncée plus bas n'en est qu'une conséquence.

**I1 — L'API est une projection du catalogue.** Il n'existe aucun point de code où une table est servie sans que sa description vienne du cache de catalogue. La spécification OpenAPI, la documentation lisible, `/meta`, le routeur et le constructeur de requêtes lisent la **même structure en mémoire**. La justesse de la documentation n'est pas maintenue, elle est impossible à perdre.

**I2 — Aucune requête de données n'est construite sans droits.** Le constructeur de requêtes n'expose aucune manière de produire un `FROM` sur une table de données sans avoir reçu le résultat de décision (`verdict`, `champs_lisibles`, `champs_inscriptibles`, `champs_effacables`, `predicat_lignes`) issu du point d'application unique (§2.4) — paramètre **non nullable**, sans valeur par défaut, sans surcharge, sans mode « interne ». Conformément à A20, `predicat_lignes` existe dès la v1 et vaut constamment vrai ; il est émis quand même. Cela vaut pour la requête principale, les `EXISTS` de filtre, les requêtes de lot d'expansion, les comptages de liens inverses, les jointures de tri, les décomptes de cascade et tout `EXPLAIN`.

**I3 — Un champ non lisible est inaccessible, pas seulement invisible.** Il est refusé comme opérande de `filter`, `sort`, `expand`, `fields`, de projection et de clé de curseur, avec exactement le code et le message d'un champ inexistant. Le masquage porté par la seule projection n'est pas un masquage.

**I4 — Aucune valeur observable ne varie du seul fait qu'un élément invisible a changé.** Corps, en-têtes, codes HTTP, validateurs de concurrence, compteurs et durées de réponse sont calculés sur la projection visible par l'appelant. Les écarts assumés sont énumérés au §14 ; ce qui n'y figure pas est un défaut.

**I5 — Aucune chaîne provenant de PostgreSQL ou du moteur DDL n'atteint un corps de réponse.** Les noms physiques (`b_t4z56fq_crm.factures`, `ix_factures__clients_id`, `fk_factures__clients_id`, `zz_supprime_20260314_salaire`) ne sortent jamais. Seuls sortent des codes du registre unique (A23) et des noms logiques dont la visibilité a été vérifiée pour l'appelant (§7.3).

**I6 — Aucune écriture de données ne réussit sans sa trace, et aucune trace n'existe sans son écriture.** La garantie est structurelle et n'appartient pas à ce chapitre : conformément à A10, révisions et événements sortants sont capturés par déclencheur dans la transaction qui écrit la donnée, vers les tampons de `_basedb_local`, puis drainés vers `_basedb`. L'API ne possède aucune boîte d'envoi propre, n'écrit aucun événement applicativement, et ne suppose nulle part une transaction couvrant deux pools. Ce chapitre décrit ce qui commence **après** le drain : la livraison HTTP.

---

## 1. Plan d'URL, versionnement et résolution

### 1.1 Noms logiques ou identifiants opaques

**Les chemins utilisent les noms logiques (`name`), et acceptent un `uuid` du catalogue partout où un nom est attendu.**

La désambiguïsation est structurelle et gratuite : un nom logique satisfait l'alphabet B du chapitre 01, un UUID canonique contient des tirets. Aucune collision n'est possible, aucun préfixe de discrimination n'est nécessaire.

La promesse du produit est qu'un intégrateur écrive `/data/crm/factures` sans consulter une table de correspondance, exactement comme il écrit `"b_t4z56fq_crm"."factures"` en SQL ; accepter l'`uuid` couvre le besoin inverse, celui d'une intégration qui doit survivre à un renommage. *Alternative rejetée* : chemins par `uuid` uniquement — stables mais opaques, on paierait une lisibilité quotidienne pour un événement rare.

### 1.2 Le tenant est dans le chemin

`/api/v1/{tenantRef}/…`, où `{tenantRef}` est la référence de tenant à 7 caractères (`t4z56fq`, `_basedb.tenant.ref`). Le cadrage impose que la forme complète du nommage soit en place dès le départ pour ne jamais renommer en production ; la même règle vaut pour les URL, qu'aucune migration ne devra réécrire chez les consommateurs. Un acteur porté sur un autre tenant reçoit `404`, jamais `403`.

### 1.3 Ordre de résolution, et indiscernabilité des absences

L'ordre est imposé, parce qu'il détermine ce qui fuit :

1. Validation de forme du chemin. Échec : `404 RESOURCE_NOT_FOUND`.
2. Résolution du tenant, de la base, de la table, du champ dans le cache de catalogue.
3. Authentification de l'acteur (§2).
4. Résolution des droits effectifs (§2.4).
5. Décision : `404` si la ressource n'existe pas **ou** n'est pas visible ; `403` seulement si elle est visible et que seule l'action est refusée.

**Propriété exigée : la réponse à une ressource invisible est indiscernable de la réponse à une ressource inexistante, en corps, en en-têtes et en durée.** Les deux `404` empruntent un chemin de sortie unique, qui applique un plancher de 25 ms (configurable, mesuré depuis la réception de la requête). Sans lui, un tenant existant — qui déclenche une résolution de catalogue et un chargement de cache — se distingue d'un tenant inexistant, arrêté à la validation de forme, par plusieurs millisecondes mesurables.

### 1.4 Plan complet

Toutes les routes sont préfixées de `/api/v1/{tenantRef}`. La colonne « droit exigé » emploie les sept verbes du `CHECK` de `_basedb.permission` : `read`, `create`, `update`, `delete`, `manage_schema`, `manage_permissions`, `manage_tokens`. Il n'existe aucun autre verbe.

| Méthode | Chemin | Rôle | Droit exigé | Acteurs admis |
|---|---|---|---|---|
| `GET` | `/meta/bases` | Bases visibles par l'appelant | — | session, jeton |
| `GET` | `/meta/bases/{base}` | Description projetée : tables, champs, types, liens | — | session, jeton |
| `GET` | `/meta/bases/{base}/openapi.json` | Sérialisation OpenAPI 3.1 de la même projection (§9.2) | — | session, jeton |
| `GET` | `/meta/bases/{base}/doc` | Documentation lisible de la même projection (§9.4) | — | session, jeton |
| `GET` `POST` | `/data/{base}/{table}` | Liste ; création unitaire | `read` / `create` | session, jeton |
| `POST` | `/data/{base}/{table}/batch` | Lot (§3.5) | selon opérations | session, jeton |
| `GET` `PATCH` `PUT` `DELETE` | `/data/{base}/{table}/{id}` | Enregistrement | `read` / `update` / `delete` | session, jeton |
| `GET` | `/data/{base}/{table}/deleted` | Journal de suppression, pour reprise (§6.5) | `read` | session, jeton |
| `GET` | `/data/{base}/{table}/{id}/referenced_by` | Résumé des liens inverses (§5.6) | `read` | session, jeton |
| `GET` | `/data/{base}/{table}/{id}/referenced_by/{source_table}.{field}` | Liste paginée d'un groupe inverse | `read` source + cible | session, jeton |
| `GET` | `/data/{base}/{table}/{id}/history` | Historique de l'enregistrement (§7.7) | `read` | session, jeton |
| `GET` `POST` | `/admin/tokens` | Jetons d'intégration (§11) | `manage_tokens` | **session seule** |
| `DELETE` | `/admin/tokens/{id}` | Révocation immédiate | `manage_tokens` | **session seule** |
| `POST` | `/admin/tokens/{id}/rotate` | Rotation avec grâce (§11.4) | `manage_tokens` | **session seule** |
| `GET` `POST` | `/admin/webhooks` | Abonnements | `manage_tokens` | **session seule** |
| `PATCH` `DELETE` | `/admin/webhooks/{id}` | Modification, suppression | `manage_tokens` | **session seule** |
| `POST` | `/admin/webhooks/{id}/activate` | Réactivation après désactivation (§10.7) | `manage_tokens` | **session seule** |
| `GET` | `/admin/webhooks/{id}/deliveries` | File et états (§10.9) | `manage_tokens` | **session seule** |
| `GET` | `/admin/webhooks/{id}/deliveries/{delivery}` | Inspection reprojetée (§10.9) | `manage_tokens` + droits de données du lecteur | **session seule** |
| `POST` | `/admin/webhooks/{id}/deliveries/{delivery}/replay` | Rejeu ciblé | `manage_tokens` | **session seule** |
| `POST` | `/admin/webhooks/{id}/deliveries/abandon` | Abandon d'une file (portée explicite) | `manage_tokens` | **session seule** |

`manage_tokens` couvre les deux formes d'intégration, jetons et webhooks : ce sont les deux manières d'ouvrir une porte vers l'extérieur avec les droits d'un rôle. Il est indépendant des droits sur les données. Les opérations dont le titulaire est l'administrateur d'instance (`_basedb.app_user.is_instance_admin`) — gestion des tenants, réglages d'instance — n'appartiennent pas à cette surface.

**Aucune route d'export (A21).** Un flux illimité percerait le plafond que toutes les autres règles construisent ; l'extraction de volume se fait par la pagination par curseur (§6), bornée et soumise aux mêmes permissions.

Les segments littéraux `/data/`, `/meta/` et `/admin/` séparent l'espace de noms des tables de celui du produit : sans eux, une table nommée `openapi` ou `tokens` créerait une ambiguïté de routage qu'aucune règle de slugification ne prévient. *Alternative rejetée* : réserver des noms de tables — cela déplace une contrainte technique sur l'utilisateur.

**Versionnement** : `v1` est figé, toute évolution y est additive, et une rupture ouvre `/api/v2` servi en parallèle. Pas de versionnement par en-tête : invisible dans les journaux, dans un `curl` et dans un nœud n8n.

### 1.5 Points de terminaison hors catalogue

Trois surfaces ne sont pas des projections du catalogue et ne portent donc ni `{tenantRef}`, ni préfixe `/api/v1`. Elles sont énumérées ici pour que le plan d'URL du produit soit complet en un seul endroit ; leur contenu appartient aux chapitres nommés.

| Chemin | Rôle | Authentification | Contenu spécifié par |
|---|---|---|---|
| `/auth/*` | Ouverture et fermeture de session, échange du cookie contre un jeton d'accès, renouvellement, élévation | Cookie de session, ou identifiants | « Authentification » |
| `POST /mcp` | Transport du serveur MCP, une seule route, corps JSON-RPC | `Authorization: Bearer`, jeton dont `allowed_surfaces` contient `mcp` | « Serveur MCP » |
| `GET /healthz`, `GET /readyz` | Vivacité et préparation du processus (§15.1) | anonyme | ce chapitre |

Règles communes, quel que soit le chapitre propriétaire : `Content-Type: application/json` sans exception, en-têtes de sécurité du §2.3, seau de débit par adresse IP du §13.1, aucune fuite de nom physique (I5). `/auth/*` est la seule surface qui accepte le cookie de session ; `/mcp` traverse le même point d'application des droits que `/data/*` ; `/healthz` et `/readyz` ne révèlent ni version, ni nom d'hôte, ni détail de dépendance.

### 1.6 Alias de compatibilité après renommage physique

Après un renommage physique (« Cycle de vie »), l'ancien nom reste résolu tant que l'alias existe. **La résolution est transparente : l'API sert la ressource cible avec un `200` ordinaire, jamais une redirection.**

Deux raisons décident : un `308` sur `POST`, `PATCH` ou `DELETE` n'est suivi que par les clients configurés pour cela — `curl` sans `-L` ne suit pas, un script maison non plus —, donc au moment précis où l'alias doit protéger les consommateurs, leurs écritures cesseraient silencieusement d'avoir lieu ; et une redirection émise au routage précède la résolution des droits, révélant à un appelant sans aucun droit qu'un renommage a eu lieu, et vers quoi.

L'ancien nom n'est donc résolu **qu'après** l'étape 4 du §1.3 : si la ressource cible n'est pas visible, la réponse est le `404` ordinaire et le compteur d'alias n'est pas incrémenté. La réponse servie par un alias porte `Deprecation: true`, `Sunset: <date prévue de suppression>` et `Link: <url canonique>; rel="successor-version"`. Renommer un **libellé** ne change aucune URL, puisque l'URL porte le `name`.

**Comptage des accès sans ligne chaude.** Un alias est emprunté par les intégrations non migrées, donc par le trafic le plus dense ; un `UPDATE` par appel sur une ligne unique de `_basedb` sérialiserait toute l'API sur un verrou, dans l'autre pool de surcroît. L'accès est agrégé en mémoire par processus et écrit **au plus une fois par minute et par alias**, dans `_basedb.db_schema.app_last_access_at` et `app_access_count` ; un compteur à la minute près suffit à décider d'une suppression d'alias, dont la condition est fixée par « Cycle de vie ».

---

## 2. Authentification, acteurs et point d'application des droits

### 2.1 Deux classes d'acteur, deux surfaces

| Classe | Porteur | Surface accessible | Durée |
|---|---|---|---|
| `session` | Jeton d'accès court en `Authorization: Bearer`, obtenu par échange du cookie de session sur `/auth/*` | `/meta/*`, `/data/*`, `/admin/*` | 15 min, renouvelable |
| `token` | Jeton d'intégration en `Authorization: Bearer` (`_basedb.api_token`) | `/meta/*`, `/data/*` si `allowed_surfaces` contient `rest` ; `/mcp` s'il contient `mcp` | jusqu'à 365 jours (§11.3) |

Le serveur MCP est un troisième point d'entrée sur le même noyau : il traverse le même point d'application des droits (§2.4) et n'est pas décrit ici.

### 2.2 La session n'authentifie jamais directement `/api/v1`

**Décision : le cookie de session n'est accepté que par `/auth/*`. Le front échange son cookie contre un jeton d'accès de 15 minutes, porté en `Authorization: Bearer` sur tous les appels `/api/v1`.**

Raison : une API dont les écritures sont authentifiées par cookie est vulnérable au CSRF, et CORS n'y change rien — CORS n'empêche pas l'**émission** d'une requête, seulement la **lecture** de sa réponse. Un formulaire hostile qui poste vers `/api/v1/t4z56fq/data/crm/factures` avec un corps `text/plain` contenant du JSON produit une requête « simple », non préalablement contrôlée, envoyée avec le cookie — et l'attaquant n'a pas besoin de lire la réponse pour avoir créé la ligne, ou mille suppressions par `/batch`. Un en-tête `Authorization` ne part jamais tout seul : il n'existe pas de requête CSRF qui le porte.

Conséquences, toutes exigées :

- le cookie de session est `Secure`, `HttpOnly`, `SameSite=Strict`, et la route d'échange exige un en-tête `X-Basedb-Csrf` comparé à un jeton lié à la session ;
- **toute requête `/api/v1` portant un corps dont le `Content-Type` n'est pas `application/json` est rejetée avant routage** : `415 CONTENT_TYPE_INVALID`. Cela supprime à lui seul la classe des requêtes CSRF « simples » ;
- **un jeton d'intégration présenté depuis un navigateur est refusé** : si la requête porte un en-tête `Origin` et que l'acteur est de classe `token`, la réponse est `401 AUTHENTICATION_REQUIRED`. Un jeton d'intégration n'a rien à faire dans du code front ;
- un jeton présenté ailleurs que dans `Authorization: Bearer` — notamment `?token=` — provoque `401`, la **révocation automatique** du jeton et une entrée de journal de sécurité : une valeur passée en chaîne de requête est déjà dans les journaux d'accès de tous les intermédiaires ;
- la désactivation d'un compte (`app_user.disabled_at`) invalide les sessions au plus tard au renouvellement du jeton d'accès, donc en 15 minutes, et immédiatement pour les droits (§2.5).

### 2.3 Origine et en-têtes de sécurité

Le CORS n'autorise que l'origine du front, avec `Access-Control-Allow-Credentials: false` sur `/api/v1` (les appels y portent un `Authorization`, pas un cookie). n8n appelle côté serveur : aucun CORS ne le concerne.

Toute réponse de l'API porte :

| En-tête | Valeur | Raison |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Un texte long riche ne doit jamais être interprété comme du HTML par le navigateur |
| `Referrer-Policy` | `no-referrer` | Le filtre et le curseur voyagent dans l'URL ; sans cela ils partent en `Referer` vers tout lien externe |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; sandbox` | L'API ne sert que du JSON |
| `Cache-Control` | `private, no-store` sur `/data/*` et `/admin/*` | Une grille contient des données personnelles ; un proxy d'entreprise ne doit pas les conserver |
| `Vary` | `Authorization, Origin, Accept-Encoding` | La réponse dépend entièrement de l'acteur |

`Content-Type` est **toujours** `application/json`, y compris sur les pages d'erreur du cadre HTTP : aucune réponse `text/html` n'est émise, pas même un `404` de routage ou un `500` non capturé.

### 2.4 Point d'application unique : le contrat

Tous les accès — API REST, serveur MCP, interface, émetteur de webhooks, génération OpenAPI — traversent une fonction unique de résolution des droits, spécifiée par « Modèle de permissions ». Son résultat de décision, pour un couple (acteur, ressource), reprend les composantes fixées par ce chapitre :

```
autorisation(acteur, base, table, action) -> {
    verdict              : AUTORISE, INVISIBLE ou INTERDIT,
    champs_lisibles      : ensemble de field_id,
    champs_inscriptibles : ensemble de field_id,
    champs_effacables    : ensemble de field_id,
    predicat_lignes      : fragment SQL paramétré, constamment vrai en v1 (A20),
    authz_version        : entier (§2.5)
}
```

Deux règles d'implémentation, vérifiables :

1. **Le constructeur de requêtes exige ce résultat.** Il n'accepte pas `null`, n'a pas de surcharge sans droits, et aucune table de données n'entre dans un `FROM`, un `JOIN`, un `EXISTS`, un `ANY` ou un `EXPLAIN` sans que le prédicat de lignes et la liste de colonnes correspondants aient été fournis pour **cette** table. C'est ce que A20 rend écrivable : la surface est figée dès maintenant, l'implémentation d'une restriction de ligne viendra sans toucher au constructeur.
2. **Les droits sont résolus une seule fois par requête HTTP**, et l'`authz_version` utilisée est consignée dans la trace d'audit. Un lot de 1 000 opérations, une expansion, un `referenced_by` et le calcul d'OpenAPI partagent le même instantané : une révocation survenue pendant la requête ne produit pas une réponse à moitié filtrée. Elle devient effective à la requête suivante, dans la borne du §2.5.

### 2.5 Fraîcheur des droits

Les permissions sont servies depuis un cache par processus, dont la clé contient `_basedb.tenant.authz_version` — compteur monotone incrémenté par toute écriture de permission, de rôle, d'affectation ou de jeton. Il n'existe aucun autre compteur d'autorisation dans le produit. `NOTIFY basedb_authz` diffuse l'incrément à tous les processus, et le TTL du cache est **plafonné à 30 secondes** même si la notification est perdue — connexion `LISTEN` coupée, processus redémarré, mutualiseur intercalé. `authz_version` entre dans l'`ETag` des documents de `/meta/*` (§9.2) et dans l'AAD du curseur (§6.2).

**Garantie écrite, et testée : une révocation de droit est effective en au plus 30 secondes sur tous les processus, API REST, serveur MCP et émetteur de webhooks compris.** Sans ce compteur, le seul canal d'invalidation serait `catalog_version`, qu'aucune révocation ne modifie : un salarié retiré d'un rôle conserverait son accès pour une durée non bornée.

---

## 3. Opérations sur les enregistrements

### 3.1 Unitaire

| Opération | Méthode | Sémantique |
|---|---|---|
| Liste | `GET /data/{base}/{table}` | `filter`, `sort`, `fields`, `expand`, `links`, `limit`, `cursor`, `count` (§4 à §6) |
| Lecture | `GET …/{id}` | `fields`, `expand`, `links` acceptés ; `ETag` positionné |
| Création | `POST /data/{base}/{table}` | Corps = objet de champs ; `_id` fourni par l'appelant accepté sous condition (§3.2) |
| Modification partielle | `PATCH …/{id}` | Clé absente = inchangée ; clé à `null` = mise à `NULL` |
| Remplacement | `PUT …/{id}` | Clé absente = remise à la valeur par défaut, ou `NULL` ; `422 REQUIRED_FIELD_MISSING` si le champ est obligatoire et sans défaut |
| Suppression | `DELETE …/{id}` | `204`, ou `409` (§8) |

La distinction `PATCH` / `PUT` n'est pas cosmétique : sans `PUT`, un client qui synchronise un miroir ne peut pas exprimer « cet enregistrement vaut exactement ceci ».

**Exception unique à la sémantique de remplacement, décrite en OpenAPI :** `PUT` ne réinitialise que les champs que l'appelant peut **lire et écrire** ; un champ qu'il ne peut pas lire est laissé inchangé, de même qu'un champ lien dont la table cible est masquée (§5.5). Sans cette règle, un client qui relit puis réécrit une ligne effacerait les valeurs qu'il n'a jamais vues — et l'effacement lui apprendrait qu'elles existaient.

### 3.2 Concurrence optimiste

**L'`ETag` est l'empreinte SHA-256 de la projection visible par l'appelant** : `_id` suivi des valeurs des champs qu'il peut lire, sérialisées sous une forme canonique figée. Il n'est **pas** dérivé de `_updated_at`.

Raison, et c'est l'invariant I4 : un `ETag` dérivé de `_updated_at` ferait d'une écriture sur un champ masqué un `412` observable, confirmant la modification invisible sans même relire la ligne. Avec une empreinte de projection, une écriture concurrente sur un champ masqué ne produit aucun `412`, et il n'y a pas de perte de mise à jour : les deux écritures portent sur des ensembles de colonnes disjoints.

- `PATCH`, `PUT` et `DELETE` acceptent `If-Match`. Divergence : `412 VERSION_CONFLICT`.
- La comparaison est une comparaison d'octets de l'`ETag`, jamais une reconstruction de date.
- Sans `If-Match`, l'écriture passe en dernier-écrivain-gagne. L'interface envoie systématiquement `If-Match` ; les intégrations choisissent.
- `_updated_at` est toujours lisible (A18) et sert de filigrane de reprise incrémentale (§6.5) ; il est tenu par `_basedb_local.set_updated_at()` avec `clock_timestamp()`, jamais avec `now()` ni par le code applicatif. Avec `now()` — l'heure de début de transaction — deux transactions concurrentes sur la même ligne peuvent produire des `_updated_at` en ordre inverse de leur validation ; le verrou de ligne sérialise les écritures, donc `clock_timestamp()` est strictement croissant par ligne, ce qui est exactement la propriété dont la reprise a besoin.

**`_id` fourni par l'appelant** : accepté (UUIDv7) **uniquement si l'appelant détient `read` sur la table**. Sinon, `422 VALIDATION_FAILED` avec un message invariant — et non une acceptation silencieuse du corps amputé de la clé, qui laisserait le client croire qu'il a choisi l'identifiant. Raison : un `_id` choisi est un oracle d'existence par collision de clé primaire pour un rôle qui ne peut pas lire (§7.4). La déduplication d'un producteur sans droit de lecture reste assurée par `Idempotency-Key`.

### 3.3 Idempotence

`POST` et `POST /batch` acceptent `Idempotency-Key` (chaîne libre, ≤ 255 octets). C'est la seule protection contre le doublon quand un réessai réseau suit un `COMMIT` réussi dont la réponse s'est perdue — situation que n8n produit régulièrement.

**Un seul mécanisme, un seul emplacement : `_basedb.idempotency_key`**, partagée avec le serveur MCP. Aucune table système ne vit dans un schéma `b_*` : elle serait inconnue du registre des noms physiques et signalée comme dérive à chaque réconciliation. Les opérations de **structure** n'y passent pas : leur idempotence est celle de `_basedb.migration`.

Côté REST, `key` porte la clé fournie, `tool` la route appelée, `params_hash` l'empreinte SHA-256 du corps normalisé, `claim_id` l'identifiant de la revendication, `response` la réponse mémorisée et son code HTTP, `expires_at` la rétention de 24 h. Le moment de l'écriture est la moitié du mécanisme :

1. **Avant tout travail**, la ligne est insérée sur le pool `catalogue` avec `response` à `NULL`, un bail daté et un `claim_id` fraîchement alloué : c'est la revendication, et l'unicité de `key` dans la portée de l'acteur sérialise deux réessais concurrents.
2. **La même transaction crée la ligne de `_basedb.bulk_operation` dont l'`id` est ce `claim_id`**, avec sa politique : `op`, `source = 'rest'`, `detail_written`, `expected_row_count`. Ce n'est pas un détail d'implémentation. Le drain lit la politique de l'opération dans la ligne de `bulk_operation` désignée par le `bulk_id` (chapitre 07 §5.3) ; une revendication qui poserait `basedb.bulk_id` sans avoir créé cette ligne livrerait au drain **un identifiant sans ligne de politique**, qui retomberait sur le régime des opérations détectées — une politique qui n'est pas celle demandée, et un regroupement sans en-tête dans l'écran d'historique. Les deux écritures partagent la transaction : soit la revendication et sa ligne de politique existent ensemble, soit ni l'une ni l'autre.
3. La transaction métier s'exécute sur le pool `donnees`, en posant `basedb.bulk_id` à ce `claim_id`, que la capture reporte dans la révision.
4. La ligne de revendication est complétée avec la réponse et le code HTTP, et `finished_at` est écrit sur la ligne de `bulk_operation`.

| Situation | Réponse |
|---|---|
| Même clé, même empreinte, `response` renseignée | La réponse mémorisée, en-tête `Idempotent-Replay: true` |
| Même clé, empreinte de corps différente | `409 IDEMPOTENCY_CONFLICT` |
| Même clé, bail valide, `response` nulle | `409 IDEMPOTENCY_IN_PROGRESS`, `Retry-After: 1` |
| Même clé, bail expiré, aucune révision portant ce `bulk_id` | La ligne est réclamée et la requête exécutée : le processus précédent est mort avant d'écrire |
| Même clé, bail expiré, révisions portant ce `bulk_id` | `409 IDEMPOTENCY_INTERRUPTED`, avec la liste des enregistrements écrits |
| Même clé, `authz_version` différente | `409 IDEMPOTENCY_STALE` — la réponse mémorisée ne peut pas être rejouée vers un appelant dont les droits ont changé |

Les étapes 1, 2 et 4 sont sur le pool `catalogue`, l'étape 3 sur le pool `donnees` : ce n'est pas la même transaction, et aucune règle du document ne prétend le contraire. C'est le `bulk_id` reporté par la capture qui ferme la fenêtre — après expiration du bail, l'état réel de l'écriture se lit dans l'historique, pas dans un pari. Sans l'étape 1 *avant* le travail, deux réessais concurrents produiraient deux créations, exactement ce que le mécanisme existe pour empêcher.

### 3.4 Valeurs d'écriture des champs lien

En écriture, un champ lien accepte un `uuid` nu, `null`, ou l'objet `{"id": "<uuid>"}`. En lecture il est **toujours** rendu comme `{"id": …, "display": …}` (§5.2). L'asymétrie est assumée et décrite explicitement en OpenAPI par deux schémas distincts (`FactureWrite`, `FactureRead`).

### 3.5 Lot

```
POST /api/v1/t4z56fq/data/crm/factures/batch
{ "atomic": true,
  "operations": [
    {"op":"create","data":{"numero":"F-2026-001","clients_id":"0195…"}},
    {"op":"update","id":"0195…","if_match":"…","data":{"statut":"paye"}},
    {"op":"delete","id":"0195…"} ] }
```

**`atomic: true` (défaut)** : une seule transaction, aucun point de reprise. Tout réussit ou rien n'est appliqué. La réponse d'échec est `422` ou `409` selon la cause et porte **toutes** les erreurs détectables, pas seulement la première : les opérations sont d'abord validées intégralement (types, champs obligatoires, existence des cibles de lien par un `SELECT … WHERE _id = ANY($1)` unique portant le prédicat de lignes de la cible), puis exécutées. Une erreur qui n'apparaît qu'à l'exécution — violation d'unicité concurrente — annule tout et est rapportée seule, avec son index.

**`atomic: false`** : le lot est **découpé en tranches de 50 opérations, chacune exécutée dans sa propre transaction**. Une opération en échec n'annule que sa propre écriture, les autres sont conservées. Réponse `200` avec un tableau `results` aligné sur `operations`.

*Alternative rejetée* : un `SAVEPOINT` par opération dans une transaction unique. Au-delà de 64 sous-transactions, l'instantané du backend passe en état « suboverflowed » et **tous** les autres backends doivent consulter la SLRU `pg_subtrans` pour chaque test de visibilité de ligne : quelques lots concurrents suffisent à effondrer l'instance entière, y compris des requêtes sans rapport, avec des attentes que rien ne rattache au lot fautif. Le découpage en tranches donne la même sémantique et la même réponse.

```json
{ "atomic": false,
  "results": [
    {"index":0,"status":"created","id":"0195…"},
    {"index":1,"status":"error","error":{"code":"LINK_TARGET_NOT_FOUND","field":"clients_id"}},
    {"index":2,"status":"deleted"} ],
  "summary": {"created":1,"updated":0,"deleted":1,"failed":1} }
```

Le code HTTP est `200` dès lors que le lot a été traité : un `207` ou un `4xx` global ferait échouer le nœud n8n entier alors que 999 lignes sur 1 000 sont passées, et `207 Multi-Status` est mal supporté par les clients HTTP génériques.

**Bornes** : 1 000 opérations ou 8 Mio par lot (`413 BATCH_TOO_LARGE`). Un lot `atomic: true` de 1 000 lignes tient un verrou sur chacune : la limite est aussi une limite de durée, et le budget de 30 s du §13.4 s'y applique.

**Restrictions de contenu :**

- une opération `delete` portant sur une ligne dont la suppression cascaderait est refusée dans un lot : `422 BATCH_CASCADE_FORBIDDEN`. La cascade exige une confirmation nominative (§8.3), qui n'a pas de sens répétée mille fois ;
- les refus `ROW_REFERENCED` d'un lot ne portent **jamais** `has_hidden_references` (§8.2) ;
- un lot consomme **N jetons de débit**, pas un (§13.1).

### 3.6 Bornes d'entrée

Elles s'appliquent avant l'analyse du corps, et leur dépassement est décidé au fil de la lecture du flux, jamais après avoir tout mis en mémoire.

| Borne | Valeur | Code |
|---|---|---|
| Corps d'une requête unitaire | 1 Mio | `413 BODY_TOO_LARGE` |
| Corps d'un lot | 8 Mio | `413 BATCH_TOO_LARGE` |
| Profondeur d'imbrication JSON | 8 | `400 REQUEST_INVALID` |
| Clés par objet JSON | 500 | `400 REQUEST_INVALID` |
| Longueur d'une valeur de chaîne | la limite du champ (« Types de champs »), 1 Mio à défaut | `422 VALIDATION_FAILED` |
| Longueur de l'URL complète | 8 Kio | `414` puis `400 REQUEST_INVALID` |
| Nombre de paramètres de requête | 32 | `400 REQUEST_INVALID` |
| Paramètre `filter` | 4 096 octets | `400 FILTER_TOO_LONG` |

---

## 4. Filtrage

### 4.1 Grammaire

**Décision : une grammaire infixe textuelle unique, dans le seul paramètre `filter`**, lisible dans un journal, dans une barre d'adresse et dans un champ de nœud n8n, écrivable à la main. *Alternative rejetée* : du JSON encodé dans l'URL — illisible, et son assemblage côté client pousse à la concaténation de chaînes.

```ebnf
expr      = or_expr
or_expr   = and_expr , { "or" , and_expr }
and_expr  = unary   , { "and" , unary }
unary     = [ "not" ] , primary
primary   = "(" , expr , ")" | predicate
predicate = path , op , [ value ]
path      = ident , [ "." , ident ]        (* profondeur 1, uniquement <link_field>.<target_field> *)
ident     = /^_?[a-z][a-z0-9_]{0,62}$/     (* alphabet B du chapitre 01 *)
value     = number | string | boolean | date | "[" , value , { "," , value } , "]"
string    = '"' , { char | '\"' | '\\' } , '"'
```

L'underscore initial facultatif est **indispensable** : sans lui, la grammaire interdirait `sort=_id` — le tri de départage imposé partout — et `filter=_updated_at gte …`, seul moyen de reprendre une synchronisation après une panne de consommateur (§6.5).

Colonnes système exposées au filtre et au tri (A18 : elles sont lisibles dès que `read` est accordé sur la table) :

| Colonne | Type | Opérateurs | Remarque |
|---|---|---|---|
| `_id` | uuid | ceux du type Lien, plus les comparaisons d'ordre | Immuable ; tri de départage et tri par défaut |
| `_created_at`, `_updated_at` | date-heure | ceux du type Date-heure | `_updated_at` est le filigrane de reprise |
| `_created_by`, `_updated_by` | uuid | `eq`, `ne`, `in`, `is_null` | Identifiants d'utilisateur, jamais expansés en v1 |

Les mots-clés `and`, `or`, `not` sont insensibles à la casse ; `and` est prioritaire sur `or` ; les parenthèses font foi. L'URL est encodée normalement (`%20`, `%22`) : aucune syntaxe d'échappement maison.

### 4.2 Opérateurs

**La liste de référence des opérateurs par type est le récapitulatif normatif de « Types de champs et projection vers PostgreSQL ».** Ce chapitre ne la duplique pas et n'y ajoute rien : les identifiants qu'il expose dans `filter` sont exactement ceux de ce tableau — `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`, `gt`, `gte`, `lt`, `lte`, `between` — et la spécification OpenAPI comme la description MCP les dérivent de la même source. Un opérateur appliqué à un type qui ne le déclare pas renvoie `400 FILTER_OPERATOR_INVALID`.

Trois précisions propres à la surface HTTP : la négation passe par l'opérateur unaire `not` de la grammaire, et non par des opérateurs jumeaux (`not (statut in ["paye","annule"])`), un second jeu d'opérateurs négatifs doublant la table normative pour aucun gain d'expressivité ; `between` prend une liste de deux éléments, bornes incluses ; les comparaisons insensibles à la casse et aux accents passent par `_basedb_local.fold_v1()`, appliquée à l'identique à l'opérande et au paramètre, ce qui rend un index B-tree ordinaire inutilisable pour `contains` — d'où le garde-fou du §13.3 et les index du §13.5.

### 4.3 Un champ non lisible est un champ inexistant

**Invariant I3, appliqué sans exception à tout identifiant apparaissant dans `filter`, `sort`, `expand`, `fields` ou une projection :** l'identifiant est résolu dans le cache de catalogue, **puis** soumis au même contrôle `read` que s'il était projeté. Un champ non lisible renvoie `400 FILTER_FIELD_UNKNOWN` ou `400 SORT_FIELD_UNKNOWN`, **strictement le même code, le même message et le même corps** qu'un champ inexistant.

Sans cette règle, le masquage de champ n'est qu'une décoration. Un lecteur autorisé sur `employes` dont le champ `salaire` est masqué émettrait `filter=salaire gte 50000`, puis 25000, 37500… et lirait par dichotomie la valeur exacte de chaque salaire en n'observant que la présence de la ligne dans `data`. Même attaque avec `contains` sur un champ texte masqué, avec `is_null`, et avec `sort=salaire`, qui livre l'ordre complet de la colonne masquée et, par la clé de reprise, la valeur exacte de la dernière ligne servie.

**Les cinq colonnes système échappent à cette règle (A18)** : `_id`, `_created_at`, `_updated_at`, `_created_by` et `_updated_by` sont lisibles dès que `read` est accordé sur la table, ne sont jamais inscriptibles et ne peuvent pas porter de permission de champ. Elles restent donc filtrables et triables par tout lecteur, y compris un rôle à champs masqués — dont la reprise incrémentale du §6.5 fonctionne sans exception. L'oracle résiduel que porte `_updated_at` — savoir qu'une ligne a changé sans savoir en quoi — est rappelé au §14 ; il coûte moins cher qu'une reprise impossible pour tout rôle ayant un seul champ masqué.

### 4.4 Filtrage sur un champ lien

Trois formes, syntaxiquement distinctes :

- `clients_id eq "0195…"` — filtre sur l'identifiant de la cible, servi par l'index de lien du §13.5 ;
- `clients_id.raison_sociale contains "dupont"` — filtre sur un champ de la table cible, profondeur 1 uniquement ;
- `clients_id.display contains "dupont"` — `display` est un identifiant réservé qui désigne la colonne d'affichage de la cible. Il permet d'écrire un filtre sans connaître la structure de la cible. Si la table cible n'a pas de colonne d'affichage — état valide, `display_field_id` étant nullable (A15) —, `400 FILTER_DISPLAY_UNAVAILABLE`.

Un chemin `clients_id.x` exige `read` sur la **table cible** et sur le champ `x` ; à défaut, `FILTER_FIELD_UNKNOWN`, le même code que pour un champ inexistant. Quand la table cible n'est pas lisible du tout, le champ lien ne supporte que `is_null` et sa négation (A16). Et, invariant I2, l'`EXISTS` engendré **porte le prédicat de lignes de la table cible** : sans lui, un lecteur autorisé sur `factures` mais pas sur les lignes de `clients` reconstruirait par dichotomie la raison sociale de clients invisibles en n'observant que le nombre de factures renvoyées, sans qu'aucune ligne de `clients` ne soit rendue, donc sans aucune alarme.

### 4.5 Traduction en SQL

Quatre règles, sans exception :

1. **Un identifiant du filtre n'est jamais concaténé.** Il est résolu dans le cache de catalogue vers une ligne de champ, et c'est le nom physique — issu de `_basedb.physical_name` et revalidé contre l'alphabet B avant quoting — qui est émis. Un identifiant non résolu arrête l'analyse : aucune chaîne de l'appelant n'atteint le constructeur SQL.
2. **Toute valeur est un paramètre lié**, avec cast explicite au type de la colonne (`$1::numeric`, `$2::timestamptz`). Un cast qui échoue est intercepté avant émission et rendu en `400 FILTER_VALUE_INVALID`, jamais en `22P02` serveur.
3. **Les métacaractères `LIKE` sont échappés** dans la valeur (`%`, `_`, `\`) et la clause porte `ESCAPE '\'`. Sans cela, `contains "100%"` devient un balayage involontaire.
4. **Chaque table qui entre dans la requête apporte son prédicat de lignes et sa liste de colonnes lisibles** (I2), y compris à l'intérieur d'un `EXISTS`.

Un prédicat sur un chemin de lien est traduit par un `EXISTS` corrélé, pas par une jointure : la jointure dupliquerait les lignes sources et se combinerait faussement avec `or`.

```
GET /api/v1/t4z56fq/data/crm/factures
  ?filter=(statut eq "paye" and montant gte 1000)
          or clients_id.raison_sociale contains "dupont"
  &sort=-date_emission,numero&expand=clients_id&limit=50
```

```sql
-- Colonnes : projection autorisee de "factures" pour ce role,
-- colonnes systeme comprises (A18).
SELECT "f"."_id","f"."numero","f"."statut","f"."montant","f"."date_emission",
       "f"."clients_id","f"."_created_at","f"."_updated_at",
       "f"."_created_by","f"."_updated_by"
FROM "b_t4z56fq_crm"."factures" AS "f"
WHERE
  -- (1) predicat de lignes de "factures" pour l'acteur ; constamment vrai en v1 (A20).
  --     Toujours emis, jamais omis.
  ( /*predicat_lignes:factures*/ TRUE )
  -- (2) filtre de l'appelant
  AND ( ("f"."statut" = $1 AND "f"."montant" >= $2::numeric)
        OR EXISTS ( SELECT 1
                    FROM "b_t4z56fq_crm"."clients" AS "c"
                    WHERE "c"."_id" = "f"."clients_id"
                      -- predicat de lignes de la table CIBLE (§4.4)
                      AND ( /*predicat_lignes:clients*/ TRUE )
                      AND _basedb_local.fold_v1("c"."raison_sociale")
                          LIKE '%' || _basedb_local.fold_v1($3) || '%' ESCAPE '\' ) )
  -- (3) reprise du curseur : branche « borne non nulle », sens descendant.
  --     L'ordre des nuls est celui de PostgreSQL (« Types de champs »).
  AND ( "f"."date_emission" < $4::date
     OR ("f"."date_emission" = $4::date AND "f"."numero" COLLATE "und-x-icu" > $5)
     OR ("f"."date_emission" = $4::date AND "f"."numero" COLLATE "und-x-icu" = $5
         AND "f"."_id" > $6::uuid) )
ORDER BY "f"."date_emission" DESC,
         "f"."numero" COLLATE "und-x-icu" ASC,
         "f"."_id" ASC
LIMIT 51;
```

Le marqueur `/*predicat_lignes:<table>*/` est obligatoire dans le SQL émis, y compris quand le prédicat est constant : c'est lui que le test du §17.1 recherche dans chaque instruction envoyée au pool `donnees`, et une instruction qui en est dépourvue fait échouer la suite. C'est cette obligation que A20 rend tenable : sans prédicat dans la signature, le marqueur n'aurait rien à désigner. `LIMIT 51` pour 50 demandés : la 51ᵉ ligne, jamais renvoyée, décide s'il existe une page suivante sans compter.

### 4.6 Limites de complexité

| Limite | Valeur | Code |
|---|---|---|
| Longueur du paramètre `filter` | 4 096 octets | `FILTER_TOO_LONG` |
| Prédicats | 32 | `FILTER_TOO_COMPLEX` |
| Profondeur de parenthèses | 8 | `FILTER_TOO_COMPLEX` |
| Éléments d'un `in` | 200 | `FILTER_TOO_COMPLEX` |
| Chemins de lien distincts | 4 | `FILTER_TOO_COMPLEX` |

Ces bornes sont vérifiées **pendant** l'analyse, pas après : un analyseur à descente récursive sans compteur de profondeur est un déni de service par débordement de pile.

---

## 5. Expansion des liens et liens inverses

### 5.1 Syntaxe, et le coût de `display`

`?expand=<champ>[,<champ>…]`, chaque champ pouvant porter une projection : `?expand=clients_id(raison_sociale,ville),commerciaux_id`.

`?fields=<champ>[,<champ>…]` restreint la projection de la table principale ; `_id` y est toujours ajouté implicitement.

**`?links=display|id`** décide si la valeur d'affichage des champs lien est résolue. `display` est la valeur par défaut, parce que l'interface en a besoin sur chaque cellule. `links=id` supprime **entièrement** les requêtes de résolution et renvoie `{"id": …}` seul.

Ce paramètre n'est pas un confort : sans lui, une table à 8 champs lien émet 9 requêtes SQL par page, **même quand l'appelant ne veut que des identifiants** — c'est-à-dire pour toute synchronisation et la plupart des appels n8n. Le surcoût n'est pas du calcul mais des allers-retours ; sous charge, c'est la saturation du pool `donnees` qui arrive en premier. La documentation et OpenAPI recommandent `links=id` pour les intégrations.

**Profondeur d'expansion : 1, sans exception.** `expand=clients_id.societe_mere_id` est refusé (`EXPAND_TOO_DEEP`). Le coût d'une expansion de rang *k* est le produit des cardinalités et devient imprévisible dès *k = 2* ; les cycles réflexifs, que « Types de champs » n'interdit pas, rendraient la borne infinie et imposeraient une détection de graphe à chaque requête ; enfin, un appelant qui a besoin du deuxième niveau dispose des identifiants du premier et émet un second appel avec `filter=_id in [...]`, ce qui fait deux requêtes au total, pas *N*. *Alternative rejetée* : profondeur 2 plafonnée — toute la machinerie de détection de cycle pour un gain marginal.

**Bornes** : 5 champs expansés par requête ; 8 tables cibles résolues au total, expansées ou non (`EXPAND_TOO_WIDE`, avec la suggestion `links=id` dans `details`) ; `limit` plafonné à 100 dès qu'`expand` est présent ; 500 identifiants distincts par table cible et par page. Ce sont les bornes du contrat de réponse, et les seules ; « Types de champs » n'en fixe pas d'autres et se limite au coût SQL de la résolution de `display`.

### 5.2 Forme de la réponse : section annexe dédupliquée

**L'objet lié n'est pas imbriqué dans la ligne. Il est renvoyé dans une section `included`, indexée par nom de table puis par identifiant.**

```json
{ "data": [
    { "_id":"0195a…","numero":"F-2026-001","montant":"1240.00",
      "clients_id":{"id":"0195c…","display":"Dupont SA"} } ],
  "included": {
    "clients": { "0195c…": {"_id":"0195c…","raison_sociale":"Dupont SA",
                            "ville":"Lyon","siret":"…"} } },
  "meta": {"next_cursor":"v1.aB3…","has_more":true} }
```

Trois raisons. **La déduplication** : 100 factures pointant 3 clients transportent 3 objets, pas 100. **La stabilité du schéma** : la forme de `clients_id` est `{id, display}` que `expand` soit présent ou non, donc un seul schéma OpenAPI par table. **La séparation des permissions** : la projection des champs de la cible obéit aux droits sur *cette* table, et la garder hors de la ligne source évite qu'un même objet JSON mélange deux jeux de droits. *Alternative rejetée* : imbrication in situ — plus naturelle à lire, mais duplique les objets, change le type d'une clé selon un paramètre de requête, et rend OpenAPI ambivalent.

### 5.3 Champs renvoyés par défaut

**Tous les champs lisibles de la ligne cible**, comme une lecture directe : la colonne d'affichage étant déjà dans la ligne source sans expansion, une expansion qui ne renverrait qu'`id` + `display` n'apporterait rien. La projection `expand=clients_id(ville)` restreint aux champs nommés ; `_id` et la colonne d'affichage y sont toujours ajoutés implicitement.

### 5.4 SQL généré : requête par lot d'identifiants

**Une requête supplémentaire par table cible distincte, jamais une jointure, et jamais une requête par ligne.**

1. Exécuter la requête principale et matérialiser la page (au plus `limit` lignes).
2. Si `links=display` : pour chaque champ lien de la table — expansé ou non — collecter les identifiants non nuls de la page, groupés par table cible ; deux champs pointant `clients` partagent un seul ensemble. Si `links=id` : passer directement à l'étape 5.
3. Écarter les tables cibles sur lesquelles l'appelant n'a pas `read` : aucune requête n'est émise pour elles.
4. Pour chaque table cible restante, émettre une requête sur `_id = ANY($1::uuid[])`, projetant la colonne d'affichage plus, si la table est expansée, les champs demandés, **et portant le prédicat de lignes de la table cible**.
5. Reconstituer `included` et les valeurs `display`.

```sql
SELECT "c"."_id", "c"."raison_sociale" AS "_display", "c"."ville", "c"."siret"
FROM "b_t4z56fq_crm"."clients" AS "c"
WHERE "c"."_id" = ANY($1::uuid[])
  AND ( /*predicat_lignes:clients*/ TRUE );
```

**Absence de N+1, démontrée** : le nombre de requêtes vaut `1 + T`, où `T` est le nombre de tables cibles **lisibles** distinctes référencées par les champs lien de la table source — une propriété du *schéma*, indépendante du nombre de lignes de la page. Chaque requête de lot est un parcours de la clé primaire de la cible, donc `O(k log n)` pour `k` identifiants distincts. Le facteur `T` n'est pas gratuit : c'est ce que `links=id` supprime, ce que le budget du §13.2 compte et ce que la métrique du §16.1 surveille.

*Alternative rejetée* : `LEFT JOIN` unique. Elle renvoie la ligne cible autant de fois qu'elle est référencée, complique le calcul de la clé de curseur, et interdit d'appliquer à la cible une projection distincte de celle de la source.

### 5.5 Permissions, et ce que révèle un identifiant

Forme unique de réponse pour un lien dont la cible est illisible, conformément à A16 et reprise mot pour mot par les chapitres 02, 04, 05 et 09 :

```json
{ "clients_id": { "id": null, "display": null, "masked": true } }
```

| Situation | Réponse |
|---|---|
| Pas de `read` sur la table cible | `{"id":null,"display":null,"masked":true}` ; aucune requête de lot ; aucune entrée dans `included` ; **aucune erreur** même si `expand` nomme ce champ |
| `read` sur la table, ligne cible invisible | `{"id":"0195c…","display":null}` ; pas d'entrée dans `included` |
| Colonne d'affichage masquée pour ce lecteur, ou table cible sans colonne d'affichage | `{"id":"0195c…","display":null}` |
| Champ lien lui-même masqué | La clé disparaît entièrement de la ligne |

Le premier cas mérite sa justification : **un identifiant n'est pas opaque**. Les `_id` sont des UUIDv7, dont les 48 premiers bits sont l'horodatage de création en millisecondes et dont l'ordre est monotone. Exposer le `clients_id` d'une table `clients` entièrement invisible révèle l'existence de chaque ligne cible, son instant de création à la milliseconde et son rang : un commercial sans accès à `clients` reconstituerait le rythme d'acquisition des autres équipes et, par proximité d'horodatage, corrélerait des lignes de tables différentes créées par un même processus, reconstruisant une partie du graphe métier sans lire une seule ligne. L'identifiant est donc masqué, sans option contraire, le filtre et le tri sur ce champ se réduisent à « renseigné » et « non renseigné » (§4.4, §6.1), et il n'existe aucun espace d'identifiants opaques de substitution.

Quand seule la **ligne** est invisible, l'identifiant est conservé — l'appelant lit une colonne de sa propre table — et la fuite d'horodatage est documentée au §14. Le marqueur `masked` est ce qui permet à `PUT` de ne pas effacer la valeur (§3.1) et à OpenAPI de décrire `id` comme toujours nul (§9.3).

`included` est calculé **page par page**. Deux pages successives peuvent contenir le même client ; dédupliquer entre pages imposerait un état serveur.

### 5.6 Liens inverses

**Un sous-chemin dédié, pas un paramètre d'expansion.** Un lien inverse a une cardinalité non bornée — une ligne de `clients` peut être référencée par un million de factures —, et l'inclure dans `expand` mettrait une liste paginée à l'intérieur d'une ligne d'une autre liste paginée. Ce n'est pas non plus une requête filtrée ordinaire : l'appelant devrait connaître d'avance la liste des tables sources, qui est ce que le catalogue sait et lui pas.

`GET /data/crm/clients/{id}/referenced_by` renvoie le **résumé** dont la vue détail a besoin en un appel :

```json
{ "data": [
   { "source": {"table":"factures","field":"clients_id","label":"Factures · Client"},
     "count": 500, "count_is_capped": true,
     "preview": [ {"id":"0195a…","display":"F-2026-001"},
                  {"id":"0195b…","display":"F-2026-002"} ],
     "href": "/api/v1/t4z56fq/data/crm/clients/0195c…/referenced_by/factures.clients_id" } ] }
```

- Les groupes sont déduits de la configuration des champs lien par la requête de liens inverses de « Schéma du catalogue `_basedb` », servie par l'index de `field_link_config` sur la table cible. **Aucune configuration.** Un groupe dont la table source est invisible n'apparaît pas du tout : ni groupe, ni compteur, ni mention.
- **Bornage unique, commun à la sémantique et au contrat HTTP** : au plus **20 groupes** par réponse, au-delà `meta.warning = "REFERENCED_BY_TRUNCATED"` et `meta.has_more` ; `count` plafonné à **500**, rendu avec `count_is_capped: true` plutôt que par un nombre rond mensonger ; `preview` de **3 lignes** triées par `_id` décroissant ; la liste paginée d'un groupe suit les bornes ordinaires de `limit` (défaut 50).
- Le comptage **porte le prédicat de lignes de la table source** :

```sql
SELECT count(*) FROM (
  SELECT 1 FROM "b_t4z56fq_crm"."factures" AS "f"
  WHERE "f"."clients_id" = $1
    AND ( /*predicat_lignes:factures*/ TRUE )
  LIMIT 501 ) "x";
```

  Servi par l'index `ix_factures__clients_id` sur `("clients_id","_id")` (§13.5), le coût est borné quelle que soit la volumétrie, et l'aperçu est obtenu par parcours arrière du même index, sans tri.

`GET …/referenced_by/factures.clients_id` est une liste ordinaire : mêmes paramètres et même curseur que `GET /data/crm/factures`, avec le prédicat `"clients_id" = $1` ajouté et non contournable, en plus du prédicat de lignes.

---

## 6. Tri, pagination et reprise

### 6.1 Tri et bornes de page

`?sort=date_emission,-numero` — préfixe `-` pour décroissant, 3 champs au maximum. **`_id ASC` est toujours ajouté en dernier**, sans être dupliqué si l'appelant l'a déjà nommé : sans cette clé de départage, deux lignes de même date reçoivent un ordre non déterministe et la pagination boucle ou saute des lignes. En l'absence de `sort`, le tri est `_id ASC`.

| Paramètre | Défaut | Plafond | Hors bornes |
|---|---|---|---|
| `limit` | 50 | 200, ramené à 100 si `expand` est présent | `400 REQUEST_INVALID` |
| `limit=0` | — | — | `400 REQUEST_INVALID` |

L'écrêtage silencieux est refusé : qui demande 500 et en reçoit 200 sans le savoir croit avoir atteint la fin de la collection.

**Champs nullables : l'ordre des `NULL` est celui de PostgreSQL** — `NULLS LAST` en ascendant, `NULLS FIRST` en descendant — et le prédicat de reprise s'écrit **en deux branches**, selon que la borne du curseur est nulle ou non. La règle et le SQL des deux branches appartiennent à « Types de champs et projection vers PostgreSQL » ; ce chapitre s'y conforme sans la réénoncer. L'essentiel pour le contrat HTTP : c'est la seule convention qu'un index `(colonne, _id)` sert dans les deux sens, donc la seule qui tienne la promesse de coût constant du §6.3, et le curseur transporte pour cela un drapeau de nullité en plus de la valeur de clé. Forcer `NULLS LAST` en descendant rendrait l'index inutilisable dans ce sens, et le plafond du §13.3 se déclencherait sur des grilles ordinaires.

La clause `COLLATE "und-x-icu"` figure dans le prédicat de reprise partout où elle figure dans l'`ORDER BY` : sans elle, la comparaison emploierait la collation de la base d'accueil, qui classe casse, accents et ponctuation autrement, et la pagination sauterait ou répéterait des lignes.

**Tri sur un champ lien** : le tri porte sur la **colonne d'affichage de la table cible**, par un `LEFT JOIN` — il doit se faire en SQL et ne peut pas être servi par la requête de lot. La jointure **porte le prédicat de lignes de la cible**, faute de quoi la valeur d'affichage d'une ligne cible invisible entrerait dans l'ordre puis dans la clé de curseur. Trois conséquences :

- si la table cible n'est pas lisible, si elle n'a pas de colonne d'affichage, ou si le lecteur ne peut pas la lire, le tri est **refusé** (`400 SORT_UNAVAILABLE`) plutôt que de retomber en silence sur l'`uuid`, qui produirait un ordre apparemment aléatoire. Pour un lien masqué (A16), seuls « renseigné » et « non renseigné » restent triables ;
- la colonne d'affichage de la cible n'est servie par aucun index dans ce sens : le garde-fou de volume de « Types de champs » et le garde-fou de coût du §13.3 s'appliquent tous deux, et sur une grosse table le tri est refusé avec le repli proposé ;
- **stabilité** : si la valeur d'affichage d'une ligne cible change entre deux pages, les lignes sources concernées se déplacent et peuvent être vues deux fois ou manquées. C'est inhérent à un tri sur une donnée mutable d'une autre table, et aucun curseur ne le corrige. Le départage par `_id` garantit en revanche qu'aucune boucle infinie ne se produit.

### 6.2 Curseur : chiffré et authentifié

**Le curseur est chiffré, pas seulement signé** : `"v1." + base64url(nonce || AEAD(clé_instance, payload, aad))`, en XChaCha20-Poly1305 (ou AES-256-GCM), nonce aléatoire inclus, étiquette d'authentification vérifiée en temps constant.

La clé d'instance est lue dans la variable d'environnement `BASEDB_ENCRYPTION_KEY` (A25) et porte un numéro de version permettant la rotation ; ce numéro voyage en clair en tête du curseur, comme `_basedb.secret.key_version` pour les secrets stockés. Elle **ne vit pas dans la base**, ce qui impose de la sauvegarder séparément (§15.5).

Un HMAC apporte l'intégrité, pas la confidentialité : le contenu d'un curseur signé reste lisible par simple décodage base64. Or le curseur **transporte des valeurs de données** — raison sociale, montant, date, et, si le tri porte sur un champ lien, la valeur d'affichage d'une ligne d'une **autre** table — et il circule dans une URL : journaux du serveur et du répartiteur, historique de navigateur, définition d'un nœud n8n exportée et versionnée. Une personne ayant accès aux journaux d'accès HTTP obtiendrait des données métier sans aucun droit applicatif. **Le curseur est opaque parce qu'il est chiffré.**

Contenu du `payload` :

| Champ | Rôle |
|---|---|
| `v` | version du format de curseur |
| `t` | identifiant de la table |
| `q` | empreinte SHA-256 de la requête normalisée : filtre, tri, expansion, projection, `links` |
| `s` | empreinte des champs utilisés et de leurs types, lue dans le cache de catalogue |
| `k` | tuple des valeurs de clé de la dernière ligne servie, avec le drapeau de nullité (§6.1) |

L'**AAD** contient l'identifiant de l'acteur, l'identifiant de la session ou du jeton, `t`, `q` et `authz_version`. Un curseur présenté par un autre acteur, ou après un changement de droits, échoue au déchiffrement et renvoie `400 CURSOR_INVALID`. Sans cela, un curseur transmis d'un utilisateur à un autre resterait valide et ferait franchir au second des valeurs de reprise issues de lignes qu'il n'a jamais vues.

**Le curseur est lié à sa requête.** `q` est vérifié : réutiliser un curseur avec un filtre différent renvoie `CURSOR_INVALID`, au lieu de produire une page silencieusement fausse.

**Invalidation après changement de structure.** `s` porte l'empreinte des seuls champs que la requête utilise, avec leur type — pas `catalog_version`. Une migration sur une autre table, ou l'ajout d'un champ non utilisé, ne casse aucun curseur en cours. La suppression logique ou le changement de type d'un champ de tri ou de filtre produit `409 CURSOR_STALE` avec `{"retry_from_start": true}`. *Alternative rejetée* : invalider sur `catalog_version` — plus simple, mais casse toutes les paginations de toute la base à chaque ajout de colonne.

**Le format est figé pour la durée de vie de `/api/v1`**, ce qui rend le déploiement progressif sûr sans coordination : toute évolution y est additive, les champs inconnus sont ignorés par un processus plus ancien, et ni l'AAD ni l'algorithme ne changent. *Alternative rejetée* : plafonner la version émise à la version minimale déployée — coûteux et fragile pour un besoin qu'un format figé supprime.

### 6.3 Correction au-delà de 100 000 lignes

La condition de reprise est un OU lexicographique sur la clé (§4.5), non un `OFFSET`. Le plan est un parcours d'index à partir d'une position, puis `limit + 1` lignes lues : coût `O(log n + limit)`, **constant d'une page à l'autre**. Un `OFFSET 500000` lit et jette 500 000 lignes. **Le paramètre `offset` n'existe pas et n'existera pas** : c'est la seule manière de garantir la promesse du cadrage, et cela évite qu'un intégrateur découvre la dégradation en production.

Stabilité sous écritures concurrentes : une ligne insérée avant la position courante n'est jamais vue (comportement attendu d'un curseur, pas d'un instantané) ; une ligne insérée après l'est ; une ligne supprimée après avoir été servie reste dans la page déjà rendue. Aucune ligne n'est dupliquée ni sautée tant que ses valeurs de clé ne changent pas — une modification qui change une valeur de clé de tri peut faire apparaître deux fois la ligne. Les clients qui synchronisent un miroir trient sur `_id` seul, qui est immuable, ou sur `_updated_at,_id` (§6.5).

### 6.4 Total

**Absent par défaut.** `?count=estimate` ou `?count=exact` le demandent explicitement.

- `estimate` : produit par `EXPLAIN (FORMAT JSON, GENERIC_PLAN)` de la requête **complète, prédicat de lignes inclus**, en lisant `Plan Rows` de la sortie du filtre, jamais du parcours de table. `pg_class.reltuples` n'est utilisé **que** si le prédicat de lignes est constamment vrai et qu'aucun filtre n'est posé. Sans cette règle, un lecteur qui ne voit que ses 12 lignes de `prospects` apprendrait que la table en contient 1 840 000.
- `exact` : `count(*)` plafonné à 100 000 par une sous-requête `LIMIT 100001` ; au-delà, `count_is_capped: true`. L'estimation est plafonnée au même seuil, pour ne pas devenir un canal continu d'observation de la volumétrie.
- Absent : `meta.has_more` suffit à afficher un bouton « page suivante ».

Un `count(*)` exact impose un balayage complet à chaque page ; c'est la cause la plus banale d'une grille lente sur 500 000 lignes. Le rendre explicite met le coût du côté de qui le demande.

### 6.5 Reprise incrémentale et journal de suppression

Toute l'intégration décrite dans ce chapitre — miroir, n8n, webhooks au moins une fois — dépend d'un chemin de reprise après la première panne de consommateur. Il est spécifié ici, et il est le seul.

**Modifications depuis un filigrane :**

```
GET /data/crm/factures?sort=_updated_at,_id
   &filter=_updated_at gte "2026-09-18T13:59:30Z"
   &links=id&limit=200
```

Le filigrane est l'instant de **début** de la passe précédente, diminué d'une marge couvrant la durée maximale d'une transaction d'écriture (30 s, §13.4) plus la dérive d'horloge admise. Sans cette marge, une transaction ouverte avant le filigrane et validée après produit une ligne définitivement sautée ; les doublons produits par la marge sont sans conséquence pour un consommateur idempotent.

`_updated_at` est tenu par déclencheur avec `clock_timestamp()` (§3.2), donc strictement croissant par ligne et juste quelle que soit l'origine de l'écriture, y compris un `UPDATE` en psql. Il est lisible par tout lecteur de la table (A18) : cette reprise est ouverte à tous les rôles, y compris ceux dont un champ est masqué.

**Suppressions :** une ligne supprimée n'apparaît dans aucune liste ; un consommateur ne peut pas distinguer « supprimée » de « jamais vue ». D'où :

```
GET /data/crm/factures/deleted?since=2026-09-18T13:59:30Z&limit=200
```

```json
{ "data": [ {"_id":"0195a…","deleted_at":"2026-09-18T14:02:11.004Z",
             "deleted_by":"0195u…","cause":"cascade"} ],
  "meta": {"next_cursor":"v1.…","has_more":false,
           "horizon":"2024-09-18T00:00:00Z"} }
```

- La source est le **journal de suppression des enregistrements** de « Historique des données et des structures », alimenté par la capture par déclencheur (A10) ; `cause` vaut `direct` ou `cascade` selon `is_cascade`, que la capture renseigne par `pg_trigger_depth() > 1` (A14). Ce chapitre n'en définit que l'exposition HTTP, la pagination `(deleted_at, _id)` et la sémantique de `horizon`.
- `meta.horizon` est l'instant le plus ancien couvert par la rétention de l'historique des enregistrements — 24 mois par défaut (A24). Un `since` antérieur renvoie `409 RESUME_BEYOND_HORIZON` : le consommateur sait qu'il est au-delà du point de non-retour et doit repartir d'une lecture complète, plutôt que de croire à tort qu'il n'y a rien eu.
- La route exige `read` sur la table et un prédicat de lignes constamment vrai : la visibilité d'une ligne supprimée ne peut plus être évaluée. La condition est satisfaite par construction en v1 (A20) ; elle est écrite pour que l'implémentation d'une restriction de ligne ne l'ouvre pas par inadvertance.

---

## 7. Forme des réponses et frontière d'erreur

### 7.1 Enveloppe

**Enveloppe partout**, y compris sur la lecture unitaire : `{ "data": …, "included": {…}, "meta": {…} }`, `data` étant un tableau pour une collection et un objet pour une ressource. L'uniformité est due à `expand`, qui s'applique aussi à l'unitaire : sans enveloppe, `included` n'aurait nulle part où aller. Une erreur remplace `data` par `error`.

### 7.2 Représentation par type

| Type basedb | JSON en lecture | Remarque |
|---|---|---|
| Texte court, texte long | `string` | Voir §7.6 pour le HTML riche |
| Nombre | `string` décimale, **sans exception** | `{"montant":"1240.00"}` ; OpenAPI déclare `type: string, format: decimal` |
| Booléen | `true` / `false` / `null` | |
| Date | `"2026-09-18"` | |
| Date-heure | `"2026-09-18T14:03:00.000Z"` | Toujours UTC, RFC 3339 — le contrat de connexion fixe `TimeZone = UTC` |
| Liste de choix | `string` | Valeur stockée, pas le libellé d'option |
| Lien | `{"id":"0195…","display":"Dupont SA"}`, ou `{"id":null,"display":null,"masked":true}` | §5.5 |
| Formule | selon le type de résultat, nombre compris | |

**Le nombre est toujours une chaîne**, y compris pour un `numeric(10,2)` de montant. La règle est celle de « Types de champs », commune à toutes les surfaces : `JSON.parse` d'un consommateur JavaScript convertit en IEEE 754 double et détruit silencieusement toute valeur au-delà de 2⁵³ ou toute échelle dépassant quinze chiffres significatifs. En **entrée**, un nombre JSON et une chaîne sont tous deux acceptés. *Alternative rejetée* : un seuil de précision au-delà duquel on bascule en chaîne — il ferait dépendre le type JSON d'un champ de sa définition, donc deux représentations d'une même donnée selon la table, et une bascule silencieuse le jour où la précision change.

### 7.3 Frontière d'erreur

```json
{ "error": { "code":"LINK_TARGET_NOT_FOUND",
             "message":"La valeur du champ « Client » ne correspond à aucun enregistrement.",
             "details": {"field":"clients_id","field_label":"Client"},
             "request_id":"0195f…" } }
```

`code` est stable et machine, pris dans le registre unique (A23) ; `message` est humain, en français, jamais analysé ; `details` est typé par code.

**La traduction des SQLSTATE PostgreSQL en codes du registre a un seul lieu** : l'exécuteur de requêtes du noyau, spécifié par « Architecture logicielle ». Ce chapitre fixe ce que la frontière HTTP garantit **après** elle, en trois règles qui déclinent l'invariant I5.

1. **Liste blanche fermée.** Seuls les codes du tableau du §18 et ceux des registres des autres chapitres traversent, chacun avec un schéma de `details` fixe. Un code qui n'y figure pas est journalisé et remplacé par une erreur générique.
2. **Projection des identifiants.** Tout message issu de PostgreSQL ou du moteur DDL passe par une projection qui remplace chaque identifiant physique par le nom **logique** correspondant, résolu par `_basedb.physical_name`, et seulement si la ressource est visible pour l'appelant. Si un identifiant ne peut pas être projeté, la traduction **échoue** et la réponse devient générique (`400 REQUEST_INVALID` ou `500`) avec le seul `request_id` ; le détail n'existe que dans le journal serveur.
3. **Aucune chaîne de PostgreSQL n'est concaténée dans un corps de réponse.** Les messages sont construits à partir de gabarits et de noms logiques, jamais par interpolation d'un `message`, `detail` ou `hint` du serveur.

Sans cette frontière, un appelant provoque volontairement une erreur pour se faire nommer des objets invisibles : un nom de contrainte révèle la table cible que le §9.3 s'interdit de nommer, une colonne `zz_supprime_20260314_salaire` révèle l'existence et la date de suppression d'un champ retiré, un nom de schéma révèle le tenant et la base.

### 7.4 Codes HTTP

| Situation | HTTP | Code |
|---|---|---|
| Authentification absente, ou porteur refusé par la route | `401` | `AUTHENTICATION_REQUIRED` |
| Jeton inconnu, ou présenté hors de ses surfaces autorisées | `401` | `TOKEN_INVALID` |
| Jeton connu, date d'expiration dépassée | `401` | `TOKEN_EXPIRED` |
| Jeton connu, révoqué ; la session MCP est close | `401` | `TOKEN_REVOKED` |
| Ressource inexistante **ou invisible** | `404` | `RESOURCE_NOT_FOUND` |
| Action non autorisée sur une ressource visible | `403` | `ACTION_FORBIDDEN` |
| Rôle demandé non délégable | `403` | `ROLE_NOT_DELEGABLE` |
| Corps ou paramètre mal formé | `400` | `REQUEST_INVALID`, `FILTER_*`, `CURSOR_INVALID` |
| Type de contenu refusé | `415` | `CONTENT_TYPE_INVALID` |
| Corps trop grand | `413` | `BODY_TOO_LARGE` / `BATCH_TOO_LARGE` |
| Validation métier | `422` | `VALIDATION_FAILED` + `details.violations[]` |
| Unicité violée, l'appelant lisant la table et le champ | `409` | `DUPLICATE_VALUE` |
| Unicité violée touchant un champ masqué | `409` | `CONFLICT` |
| Unicité violée sans droit de lecture sur la table | `422` | `VALIDATION_FAILED` |
| Clé étrangère introuvable à l'écriture | `409` | `LINK_TARGET_NOT_FOUND` |
| Suppression refusée par la clause `NO ACTION` émise pour `restrict` (A13) | `409` | `ROW_REFERENCED` |
| Cascade non confirmée / trop large / cyclique | `409` | `CASCADE_CONFIRMATION_REQUIRED` / `CASCADE_TOO_LARGE` / `CASCADE_TOO_DEEP` |
| `If-Match` divergent | `412` | `VERSION_CONFLICT` |
| Sérialisation ou interblocage après réessai unique | `409` | `WRITE_CONFLICT` |
| Idempotence | `409` | `IDEMPOTENCY_*` |
| Curseur périmé par une migration | `409` | `CURSOR_STALE` |
| Reprise au-delà de l'horizon | `409` | `RESUME_BEYOND_HORIZON` |
| Quota de débit ou de concurrence | `429` | `RATE_LIMIT_EXCEEDED` / `CONCURRENCY_LIMIT_EXCEEDED` |
| Requête jugée trop coûteuse | `400` | `QUERY_TOO_EXPENSIVE` |
| Table en migration, dérive de catalogue, `_basedb` indisponible | `503` | `TABLE_MIGRATING` / `CATALOG_DRIFT_DETECTED` / `SERVICE_UNAVAILABLE` |
| Délai serveur dépassé | `504` | `TIMEOUT_EXCEEDED` |

La confusion volontaire `404` pour « inexistant » et « invisible » est la traduction HTTP du principe « un accès non autorisé renvoie une absence » du cadrage. `403` n'est utilisé que lorsque la **ressource** est visible et que seule l'**action** est refusée.

**Les trois codes de jeton sont distincts, et c'est une exception explicite à ce principe.** L'absence plutôt que l'erreur porte sur l'existence des **ressources**, non sur l'état d'un secret que l'appelant détient déjà et présente lui-même : `TOKEN_INVALID` pour un jeton inconnu ou présenté hors de ses surfaces autorisées, `TOKEN_EXPIRED` pour un jeton connu dont la date d'expiration est dépassée, `TOKEN_REVOKED` pour un jeton connu révoqué. Le porteur légitime apprend ainsi s'il doit renouveler son jeton ou s'adresser à un administrateur ; l'oracle résiduel est sans valeur pour un attaquant, les 256 bits d'aléa du §11.3 mettant la devinette par force brute hors de portée.

**L'unicité est un oracle, et elle est traitée comme tel.** Un rôle possédant `create` mais pas `read` sur `employes` — cas banal d'un formulaire public ou d'une intégration d'ingestion — reconstruirait l'annuaire complet en postant des adresses et en lisant le code de retour. D'où, symétriquement au traitement de la clé étrangère (§8.1), la grille à trois cas du modèle de permissions : avec `read` sur la table **et** champ lisible, `409 DUPLICATE_VALUE` et `details = {field, field_label}`, **ni la valeur en conflit ni l'identifiant de la ligne existante** n'étant jamais renvoyés ; avec `read` sur la table mais champ masqué, `409 CONFLICT` anonyme, sans nom de champ ni `details` ; sans `read` sur la table, `422 VALIDATION_FAILED` avec un message invariant et **sans `details`**. Une collision sur un `_id` fourni suit la même règle, et chaque `409` d'unicité — `DUPLICATE_VALUE` comme `CONFLICT` — est compté dans le seau des réponses révélatrices (§13.1).

### 7.5 En-têtes

**Acceptés en requête** : `Authorization`, `Content-Type`, `If-Match`, `If-None-Match`, `Idempotency-Key`, `X-Basedb-Csrf` (routes d'authentification), `X-Basedb-Confirm-Cascade` (§8.3), `X-Correlation-Id`.

**Émis en réponse** : `X-Request-Id`, `ETag`, `Deprecation` / `Sunset` / `Link` (alias), `Idempotent-Replay`, `Retry-After` (sur `429` et `503`), `X-RateLimit-Limit` / `-Remaining` / `-Reset`, et les en-têtes de sécurité du §2.3.

**`X-Request-Id` est toujours généré par le serveur** (UUIDv7) et n'est jamais lu depuis la requête : accepter une valeur de l'appelant permettrait de noyer une opération dans le bruit, d'imputer une trace à un autre utilisateur, ou d'injecter des sauts de ligne qui forgent de fausses lignes dans un agrégateur de journaux. Une valeur du client est acceptée dans `X-Correlation-Id`, validée contre `^[A-Za-z0-9._-]{1,64}$`, stockée à part et jamais utilisée comme identité de la trace d'audit. **`X-RateLimit-*` ne reflète que le seau de l'acteur** (§13.1).

### 7.6 HTML riche et libellés

Le texte long riche est assaini côté serveur **avant stockage** (« Types de champs »). Cette mesure ne suffit pas : la promesse du produit est que les données soient exploitables directement en SQL, donc tout `INSERT`/`UPDATE` émis par un script ou un administrateur contourne l'assainisseur, et le stock écrit avant la correction d'une faille reste empoisonné.

Décisions :

1. **L'API ne réassainit pas à la lecture.** Le coût CPU serait proportionnel au volume servi, sur le chemin le plus chaud de l'API, pour un défaut qui se corrige une fois. À la place : le champ est décrit en OpenAPI avec `x-basedb-unsafe-html: true`, **le contrat est que tout consommateur assainit au rendu**, et l'interface passe obligatoirement par un assainisseur.
2. **Une reprise de stock est fournie** : une tâche d'administration réassainit en masse les colonnes riches d'une table, alimentée par le catalogue, exécutée après toute correction de l'assainisseur.
3. **Les réponses de l'API ne peuvent pas exécuter de script** : `Content-Type: application/json` sans exception, `nosniff`, CSP `default-src 'none'; sandbox` (§2.3).
4. **Les libellés du catalogue sont échappés** à la génération OpenAPI, dans la documentation lisible et dans les messages d'erreur. Injecté tel quel dans `title`/`description` d'une spécification rendue par une interface qui interprète Markdown et une partie du HTML, `Client <img src=x onerror=…>` exécute son script chez le lecteur de la documentation. La neutralisation est testée (§17.1).

### 7.7 Historique d'un enregistrement

`GET /data/{base}/{table}/{id}/history` : la forme de la réponse est définie par « Historique des données et des structures ». Ce chapitre impose l'application du point d'application unique sur cette route :

- la route exige `read` sur la table et la visibilité de la ligne ;
- **chaque valeur historique est projetée avec les droits de champ actuels du lecteur**, pas avec ceux du moment de l'écriture. Un champ masqué aujourd'hui — ou masqué depuis toujours — ne ressort jamais par l'historique, ni dans la valeur avant, ni dans la valeur après, ni dans la liste des champs modifiés ;
- une entrée dont tous les champs modifiés sont masqués pour le lecteur **n'apparaît pas** : sa seule présence révélerait qu'un champ invisible a changé, et à quel instant (I4) ;
- les champs lien d'une entrée historique suivent les règles du §5.5.

---

## 8. Suppression, références et cascade

### 8.1 Écriture d'un identifiant de lien inexistant

Détectée **avant** l'écriture par un `SELECT _id FROM <cible> WHERE _id = ANY($1) AND (/*predicat_lignes:<cible>*/ TRUE)`. Réponse `409 LINK_TARGET_NOT_FOUND`, `details = {field, field_label}`.

Le message **nomme le champ, jamais la table cible** : le champ appartient à la table que l'appelant écrit, la table cible non nécessairement. Point capital : **« n'existe pas » et « existe mais m'est invisible » donnent exactement le même code et le même message**, sans quoi l'écriture deviendrait un oracle d'existence sur une table protégée. La valeur fautive n'est renvoyée (dans `details.value`) que si la table cible est lisible, l'appelant ayant alors pu la vérifier lui-même.

La contrainte PostgreSQL reste la garantie ultime : si une course fait échouer l'écriture malgré la vérification préalable, le `23503` est traduit vers le même code via le nom de contrainte, jamais remonté brut.

### 8.2 Suppression d'une ligne encore référencée

**Le `DELETE` est tenté d'abord**, et les comptages de diagnostic ne sont exécutés qu'à réception du `23503`. L'ordre inverse rendrait le chemin le plus fréquent — la ligne n'est référencée par rien — le plus coûteux : sur une table visée par 20 champs référençants, chaque suppression exécuterait 20 comptages avant d'essayer. Il serait en outre sujet à une course. La contrainte est l'autorité ; le comptage n'est qu'un diagnostic.

Conformément à A13, la clause réellement émise pour la valeur `restrict` du catalogue est `ON DELETE NO ACTION`, qui refuse exactement les mêmes suppressions que `RESTRICT` mais vérifie en fin d'instruction : une suppression en lot qui retire dans la même instruction une ligne et celles qui la référencent réussit, au lieu d'échouer sans raison métier.

Exception unique : si au moins un champ lien visant cette table porte `on_delete = cascade`, le décompte est calculé **avant** toute suppression (§8.3).

```json
{ "error": { "code":"ROW_REFERENCED",
    "message":"Cet enregistrement est référencé par d'autres enregistrements.",
    "details": {
      "referenced_by":[ {"table":"factures","field":"clients_id",
                         "label":"Factures · Client","count":12,
                         "href":"/api/v1/t4z56fq/data/crm/clients/0195c…/referenced_by/factures.clients_id"} ],
      "has_hidden_references": true } } }
```

Les groupes portant sur une table source invisible sont **omis**, et remplacés par le seul booléen `has_hidden_references`.

Le compromis, écrit sans l'enjoliver : **c'est une fuite d'un bit par ligne, obtenue par une opération qui échoue donc ne laisse aucune trace métier, et par conséquent répétable.** Un utilisateur autorisé à supprimer dans `clients` sans aucun droit sur `factures` reconstruirait ligne par ligne l'indicateur « ce client a au moins une facture ». Elle est acceptée parce qu'un refus sans cause apparente est indébogable, et **parce qu'elle est bornée et détectable** :

- `has_hidden_references` n'est **jamais** renvoyé dans les résultats d'un lot (§3.5), ce qui supprime l'amplification par mille en une requête ;
- chaque refus `ROW_REFERENCED` est compté dans le seau des réponses révélatrices (§13.1) ;
- le dépassement du seuil de ce seau produit un événement de journal de sécurité (§16.2).

*Alternative rejetée* : interdire les opérations `delete` en lot dès que la table possède un référent invisible pour l'appelant — l'interdiction elle-même révélerait l'existence de ce référent.

### 8.3 Cascade

**La cascade est exécutée par PostgreSQL** (A14). Quand un champ lien est configuré en cascade, la clause `ON DELETE CASCADE` est réellement émise en base, et une suppression faite directement en SQL cascade donc comme une suppression faite par l'API : c'est la contrepartie de la promesse « vraies tables exploitables en SQL ». L'application n'implémente aucune cascade applicative, ne supprime pas niveau par niveau, et n'a aucun code de parcours à maintenir.

Les lignes supprimées en chaîne sont néanmoins **historisées et produisent un événement par ligne**, parce que la capture est faite par déclencheur (A10) : les déclencheurs voient les suppressions cascadées, et `pg_trigger_depth() > 1` les distingue des suppressions directes en renseignant `is_cascade`. Le consommateur d'un miroir voit ainsi chaque suppression sans recalculer une fermeture transitive dont il n'a pas le graphe.

L'autorisation d'un champ lien en cascade est nominative et réservée à la configuration (« Modèle de permissions » ; le catalogue conserve qui l'a accordée dans `field_link_config.cascade_grant_id`). Ce qui est encadré **ici**, c'est l'exécution, faute de quoi un opérateur autorisé à supprimer une ligne de `clients` et n'ayant aucun droit sur `factures` détruirait des milliers de factures qu'il ne peut ni lire ni lister, recevrait `204`, et n'aurait aucune trace de ce qu'il a détruit.

Procédure, avant d'émettre le `DELETE` :

1. Parcourir la configuration des champs lien en largeur depuis la table racine, en suivant les seules arêtes `on_delete = cascade`, pour établir la liste des tables atteintes. **Détection de cycle** et **profondeur maximale 5** ; au-delà, `409 CASCADE_TOO_DEEP`. Le contrôle porte sur le parcours du décompte, pas sur l'exécution : PostgreSQL traite les cycles sans notre aide.
2. Pour chaque table atteinte, exiger le droit `delete` de l'appelant. S'il manque sur **une seule** table, la réponse est `404 RESOURCE_NOT_FOUND` sur la ressource racine, conformément au principe d'absence — l'appelant n'apprend pas qu'une table invisible s'oppose à sa suppression.
3. Compter exactement les lignes atteintes, par table, **sans plafond** (le plafond de 500 du §5.6 sert l'affichage, pas la décision). Total supérieur à 5 000 : `409 CASCADE_TOO_LARGE`, aucune suppression, renvoi vers une opération d'administration.
4. Exiger la confirmation : l'en-tête `X-Basedb-Confirm-Cascade: <total annoncé>` doit être présent et **égal au décompte serveur**. Absent ou divergent : `409 CASCADE_CONFIRMATION_REQUIRED`, avec `details.total` et `details.per_table` limité aux tables que l'appelant peut lire. Un client naïf ne produit pas cet en-tête par hasard ; un client qui l'a produit a vu le décompte.
5. Émettre le `DELETE` de la seule ligne racine, dans une transaction qui pose `basedb.actor_id` et `basedb.bulk_id` : la cascade PostgreSQL fait le reste, et la capture produit une révision et un événement par ligne réellement supprimée, rattachés au même `bulk_id`.
6. Écrire une entrée d'audit unique portant l'acteur, la racine, le décompte par table et ce `bulk_id`.

Le décompte de l'étape 3 peut différer du nombre réel de lignes supprimées si des lignes sont insérées entre-temps. C'est la contrepartie assumée d'une cascade exécutée par PostgreSQL : verrouiller toute la fermeture transitive pour rendre le décompte exact tiendrait des milliers de verrous pendant la lecture de la confirmation par un humain. L'audit et les événements portent, eux, le nombre réellement supprimé.

Les opérations `delete` déclenchant une cascade sont interdites en lot (`422 BATCH_CASCADE_FORBIDDEN`, §3.5). **Conséquence de verrouillage** : 5 000 lignes supprimées tiennent 5 000 verrous de ligne pendant toute la transaction et bloquent toute écriture concurrente sur ces lignes. La borne de 5 000 est autant une borne de durée qu'une borne de sémantique, et le budget de transaction de 30 s du §13.4 s'y applique.

---

## 9. Métadonnées, OpenAPI et documentation lisible

### 9.1 Une seule projection, trois sérialisations

**`/meta/bases/{base}`, `/meta/bases/{base}/openapi.json` et `/meta/bases/{base}/doc` sont produits par la même fonction de projection, à partir du même cache de catalogue et du même jeu de permissions effectives** — trois sérialisations du même arbre.

C'est une exigence de sécurité, pas d'élégance : une spécification OpenAPI soigneusement filtrée, flanquée d'une route voisine qui rend la liste complète des tables, le nom de la cible de chaque champ lien et les colonnes d'affichage, ne filtre rien du tout. C'est aussi la seule façon de tenir l'exigence du cadrage — une documentation « générée depuis le catalogue, à jour par construction » : il n'existe aucun document maintenu à la main dont la mise à jour pourrait être oubliée.

**Une base apparaît dans `/meta/bases` si et seulement si l'appelant détient `read` sur au moins une de ses tables** ; sinon elle n'existe pas pour lui et `/meta/bases/{base}` répond `404`. `/meta/*` est soumis à l'authentification comme le reste, compte dans le seau de débit de l'acteur, et son coût est plafonné par §9.2 : c'est la première cible d'une reconnaissance, elle n'a aucune raison d'être moins protégée que `/data/*`.

### 9.2 Production, cache et validation

**Produites à la demande, en mémoire, depuis le cache de catalogue. Jamais stockées en base, jamais régénérées par un travail de fond.** Une spécification stockée est une spécification qui diverge : le jour où la génération échoue ou où une migration oublie de la rafraîchir, l'API et son contrat se contredisent.

- `ETag` = SHA-256 de (`base.catalog_version`, `tenant.authz_version`, empreinte des permissions effectives de l'appelant, **version applicative**). Sans la version applicative, pendant un déploiement progressif, un processus servirait un `304` pour un document que l'autre version aurait généré différemment.
- `Cache-Control: private, max-age=0, must-revalidate` et `Vary: Authorization, Accept-Encoding`. **Pas `no-store` :** il interdirait au client de conserver la réponse, donc le validateur, donc d'émettre `If-None-Match` — le `304` annoncé ne se produirait jamais. L'empreinte des permissions entre dans l'`ETag` pour qu'une copie conservée par un autre acteur ne puisse jamais être validée.
- Le document sérialisé est mémorisé dans un cache LRU **borné par processus** (64 entrées), indexé par la clé d'`ETag`, purgé sur `NOTIFY basedb_catalog` et `NOTIFY basedb_authz`. Sans lui, un simple rechargement de page reconstruit un document qui, pour 500 tables, se compte en mégaoctets (§16.4).
- Au-delà de 2 Mio sérialisés, la génération est refusée et `?tables=<liste>` devient obligatoire (`400 REQUEST_INVALID`, `details.hint`). Le `304` sur `If-None-Match` est servi sans reconstruire.

### 9.3 Ce que voit chaque lecteur

**Deux utilisateurs voient deux descriptions différentes, et c'est la règle, pas un effet de bord.** Cela vaut identiquement pour les trois sérialisations.

| Droit du lecteur | Effet |
|---|---|
| Pas de `read` sur une table | Aucun chemin, aucun schéma, aucune mention. La table n'existe pas |
| `read` sans `create`/`update`/`delete` | Seuls les `GET` sont décrits |
| Champ non lisible | Absent des schémas, absent de l'`enum` de `sort`, `fields`, `expand` et des chemins de filtre |
| Champ lisible non écrivable | `readOnly: true` dans le schéma d'écriture |
| Colonnes système | Toujours décrites en lecture, toujours `readOnly` (A18) |

Conséquence opérationnelle : la spécification n'est **jamais** un document public. Elle n'est pas servie sans authentification, n'est pas publiée dans un dépôt, et l'interface qui propose de la télécharger avertit qu'elle correspond aux droits de la session courante.

**Les relations y apparaissent**, comme l'exige le cadrage :

- le schéma de lecture d'un champ lien est `{id: string|null (uuid), display: string|null, masked?: boolean}`, avec `x-basedb-link: {target_table, target_display_field, on_delete, is_required}` ;
- si la table cible est lisible, `x-basedb-link.target_schema` porte un `$ref` vers son schéma, le champ figure dans l'`enum` du paramètre `expand`, et la réponse de liste décrit `included` avec la propriété nommée d'après la table cible ;
- si elle ne l'est pas, le champ reste décrit — il fait partie de la table que le lecteur peut lire — mais `x-basedb-link` est réduit à `{on_delete, is_required}`, sans aucun nom de table cible, le champ **n'apparaît pas** dans l'`enum` de `expand`, et `id` est décrit comme toujours nul avec `masked: true`, exactement dans la forme du §5.5 ;
- le chemin `…/{id}/referenced_by` n'est décrit que si au moins un groupe inverse est visible ;
- les libellés injectés dans `title` et `description` sont échappés (§7.6).

### 9.4 Documentation lisible

`GET /meta/bases/{base}/doc` sert la **documentation lisible par un humain**, dans la même enveloppe JSON que le reste de l'API — un arbre de sections en Markdown assaini, que l'interface rend et qu'un intégrateur peut lire tel quel. Elle est distincte de la sérialisation OpenAPI, contrat machine destiné à un générateur de client, mais issue de la **même projection** (§9.1) et filtrée par les **mêmes droits** (§9.3).

Deux documents et non un seul, parce que les deux publics ne demandent pas la même chose : un générateur de client veut des schémas, des `enum` et des codes de retour ; un intégrateur humain veut savoir ce qu'est un champ lien, pourquoi une suppression est refusée et ce qui l'attend s'il écrit en SQL direct. Fusionner reviendrait à noyer le contrat machine sous de la prose, ou à renvoyer l'humain vers une spécification qu'il ne sait pas lire.

Contenu, par base et par table :

| Section | Source |
|---|---|
| Tables et champs visibles, types, obligation, unicité, valeurs d'option | Projection du catalogue |
| **Relations** : cible de chaque champ lien, colonne d'affichage, comportement `on_delete`, liens inverses attendus | `field_link_config`, `display_field_id` |
| Correspondance entre le comportement déclaré `restrict` et la clause `NO ACTION` réellement émise (A13) | « Moteur DDL » |
| Écarts entre une écriture par l'API et une écriture en SQL direct : normalisations appliquées, contrôles qui ne sont pas des contraintes | « Types de champs » |
| Cycles réflexifs non contrôlés, et ce qu'ils impliquent | « Types de champs » |
| Alias de compatibilité actifs sur la base, avec leur date de fin annoncée | « Cycle de vie » |
| Valeur de recouvrement à appliquer au filigrane de reprise (§6.5) | Ce chapitre |

Le cadrage exige que les relations apparaissent dans la documentation générée : c'est la deuxième ligne de ce tableau, et elle n'est pas optionnelle. Aucune de ces sections n'est rédigée à la main : chacune est une projection, ce qui garantit qu'elle ne peut pas devenir fausse, et interdit d'y ajouter un contenu que le catalogue ne porte pas.

---

## 10. Webhooks

### 10.1 D'où viennent les événements

La capture n'appartient pas à ce chapitre. Conformément à A10, un déclencheur posé sur chaque table de données écrit, **dans la transaction métier**, une ligne dans `_basedb_local.change_event_buffer` pour toute table abonnée ; un processus de drain la transfère dans `_basedb.change_event`. Le mécanisme, les déclencheurs, `_basedb_local.capture_v1()` et la garantie d'atomicité sont normatifs dans « Historique des données et des structures ». Il n'existe **aucune boîte d'envoi dans un schéma de données**, aucun schéma technique alimenté applicativement et aucune table `webhook_outbox`.

Ce chapitre commence à la sortie du drain. Pour chaque ligne de `change_event` et chaque abonnement concerné (`_basedb.webhook_subscription`, croisement table × événement), le drain crée une ligne dans `_basedb.webhook_delivery` portant `event_id`, `role_id`, `partition_key`, `status`, `attempts` et `next_attempt_at` — **jamais le corps**, recalculé depuis `change_event` à l'émission.

Conséquence assumée : la livraison est **asynchrone**, de l'ordre de la seconde après le `COMMIT`, alors que l'écriture métier ne peut pas réussir sans que sa capture ait réussi (I6). Une écriture faite directement en psql produit donc un webhook exactement comme un `POST` de l'API : c'est ce que A10 achète, et c'est la propriété qui rend l'intégration digne de confiance.

**Si `_basedb` est indisponible alors que le pool `donnees` répond**, les écritures continuent d'être acceptées, leur trace étant garantie par les tampons de `_basedb_local`, drainés au rétablissement. Les routes qui **dépendent** de `_basedb` pour décider — authentification et droits hors cache, `/admin/*`, `/history`, `/deleted` — répondent `503 SERVICE_UNAVAILABLE` avec `Retry-After`. Si le cache de droits est périmé au-delà de son TTL de 30 s et que `_basedb` reste injoignable, **toutes** les écritures passent en `503` : jamais d'écriture métier sans droits vérifiés.

### 10.2 Événements et charge utile

Trois événements, en correspondance exacte avec `webhook_subscription.event` : `record.created` (`create`), `record.updated` (`update`), `record.deleted` (`delete`). Aucun événement de structure en v1 : un consommateur qui suit les changements de schéma dispose d'OpenAPI et de `catalog_version`, et un flux d'événements de structure sans ordre garanti vis-à-vis des événements de données serait pire que rien.

**Le corps est toujours un tableau d'événements**, même pour un seul — forme unique, aucun cas particulier côté consommateur, et possibilité de grouper (§10.4).

```json
{ "events": [
  { "id": "0195e…",
    "type": "record.updated",
    "occurred_at": "2026-09-18T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "crm", "table": "factures",
    "record_id": "0195a…",
    "actor": {"kind":"token"},
    "cause": {"kind":"direct"},
    "before": {"_id":"0195a…","numero":"F-2026-001","statut":"brouillon",
               "montant":"1240.00","clients_id":{"id":"0195c…","display":"Dupont SA"}},
    "after":  {"_id":"0195a…","numero":"F-2026-001","statut":"paye",
               "montant":"1240.00","clients_id":{"id":"0195c…","display":"Dupont SA"}},
    "changed": ["statut"] } ] }
```

`before` est `null` sur `record.created`, `after` est `null` sur `record.deleted`. Le cadrage exige la ligne avant et la ligne après **complètes** pour éviter un aller-retour : `changed` est un ajout de confort, jamais une substitution.

**`actor` est réduit à `{kind}` par défaut**, repris de `change_event.actor_kind` — `user`, `token`, `mcp`, `sql_direct`. L'identité interne et l'étiquette du jeton ne sont incluses que si l'abonnement porte l'option `include_actor_identity`, réservée à un administrateur : la charge utile part vers un système tiers, et une étiquette libre contient en pratique un nom de personne, de client ou d'hôte interne.

**Champs lien** : forme `{id, display}`, comme partout, la valeur d'affichage étant résolue **à l'émission** et non à l'écriture ; elle peut donc différer si la ligne cible a changé entre-temps, à la seconde près. Pas d'expansion complète dans un webhook : le volume serait imprévisible.

**Suppressions en chaîne** : un événement `record.deleted` par ligne réellement supprimée, chacun portant `cause: {"kind":"cascade","origin":{"table":"clients","id":"0195c…"}}` et le `bulk_id` commun. La capture par déclencheur voit les lignes cascadées et les marque par `pg_trigger_depth() > 1` (A14) : c'est elle, et non un parcours applicatif, qui rend cette promesse tenable.

### 10.3 Masque de lecture complet exigé

**Le rôle porté par un webhook doit avoir un masque de lecture complet sur chaque table abonnée (A19).** Concrètement :

1. **À la création et à la modification d'un abonnement**, le rôle doit détenir `read` sur la table abonnée, sur **tous** ses champs, et sur la table cible de chacun de ses champs lien — un lien masqué produirait la forme `{"id":null,"display":null,"masked":true}`, c'est-à-dire une charge utile amputée. Si un seul champ lui est masqué, la requête est refusée : `422 WEBHOOK_MASK_INCOMPLETE`, avec la liste des champs manquants limitée à ceux que l'appelant peut lui-même voir.
2. **Si un masquage survient après coup** — une permission de champ ajoutée, un champ ajouté à la table sans être accordé au rôle, un droit retiré sur une table cible —, le webhook est **désactivé** : `is_active = false`, `disabled_reason = 'field_masked'`, entrée d'audit, administrateur notifié. Les livraisons en file passent en `abandoned`. La réactivation passe par `POST /admin/webhooks/{id}/activate`, qui revérifie le masque et déclenche la procédure de resynchronisation du §10.7.
3. **La charge utile n'est donc jamais projetée** : elle porte la ligne complète, telle que la capture l'a enregistrée. Il n'existe aucun chemin de code qui retire un champ d'un `before`, d'un `after` ou de `changed`.

La raison est celle du cadrage : la charge utile est complète précisément pour éviter un aller-retour au consommateur. Un consommateur qui reçoit une ligne incomplète sans le savoir écrit un miroir faux, et personne ne s'en aperçoit — c'est strictement pire qu'un consommateur désactivé, qui, lui, se voit. **La seule dégradation possible est donc le refus ou la désactivation, jamais l'amputation silencieuse.**

Le `role_id` reste obligatoire et soumis à la non-élévation du §11.2 : il décide **si** le webhook a le droit de voir la table, pas **quoi** il en voit. Son emploi se réduit à un contrôle binaire, refait à chaque émission.

### 10.4 Taille et groupement

Une table à texte long riche produit des événements de la taille de la donnée, doublés par `before` + `after`, multipliés par le groupement et par le nombre d'abonnés. D'où :

- **le corps d'une livraison groupée est plafonné à 1 Mio**, avec au plus 50 événements du même abonnement ; le groupement s'adapte à ce plafond avant l'envoi ;
- **un événement seul n'est jamais tronqué**, même s'il dépasse 1 Mio : il part dans une livraison qui ne contient que lui. Tronquer un champ contredirait A19 aussi sûrement qu'un masque, un consommateur ne pouvant pas distinguer un champ vidé par la troncature d'un champ réellement vidé ;
- le corps n'est stocké qu'une fois, dans `change_event` ; `webhook_delivery` ne porte que la référence, sans quoi un lot de 1 000 modifications sur une table à documents écrirait plusieurs gigaoctets dans le catalogue ;
- un `413` reçu du consommateur est **non rejouable** (§10.7) mais notifié à l'administrateur avec la taille émise, dont il a besoin pour relever la limite de son point d'arrivée.

Un lot de 1 000 créations produit 1 000 événements : **aucune coalescence**, sans quoi le miroir du consommateur devient faux. Le groupement divise par 50 le nombre d'appels HTTP sans changer la sémantique — c'est la raison pour laquelle le corps est toujours un tableau. Purges et migrations n'émettent aucun événement de données.

### 10.5 Signature

`X-Basedb-Signature: t=1758204180,v1=<hex>`, où `v1 = HMAC-SHA256(secret, "<t>." + corps brut)`, recalculé par le consommateur sur les **octets bruts** reçus, avant toute désérialisation. Tolérance d'horloge : 5 minutes. La livraison étant **au moins une fois**, la déduplication se fait sur `X-Basedb-Delivery-Id` ou sur `events[].id`.

Signer exige le secret **en clair** : un condensat ne le permet pas. Le secret est donc **chiffré au repos** dans `_basedb.webhook.signing_secret_encrypted`, avec la clé d'instance lue dans `BASEDB_ENCRYPTION_KEY` (A25), `signing_key_version` portant la version pour la rotation. Cette clé est une dépendance de restauration (§15.5).

### 10.6 Ordre et file

**Ordre garanti par `(webhook, table, record_id)`**, pas globalement — c'est le contenu de `webhook_delivery.partition_key`. Un ordre global imposerait un consommateur unique et une tête de file bloquante : un consommateur lent bloquerait tout le tenant. L'ordre par enregistrement est exactement ce dont un miroir a besoin.

La sélection impose un FIFO strict par clé :

```sql
SELECT DISTINCT ON ("d"."partition_key") "d".*
FROM "_basedb"."webhook_delivery" AS "d"
WHERE "d"."status" = 'pending'
  AND ("d"."next_attempt_at" IS NULL OR "d"."next_attempt_at" <= now())
  AND NOT EXISTS (
        SELECT 1 FROM "_basedb"."webhook_delivery" AS "p"
        WHERE "p"."partition_key" = "d"."partition_key"
          AND "p"."status" IN ('pending','in_flight')
          AND ("p"."created_at", "p"."id") < ("d"."created_at", "d"."id") )
ORDER BY "d"."partition_key", "d"."created_at", "d"."id"
FOR UPDATE SKIP LOCKED
LIMIT 50;
```

`SKIP LOCKED` seul ne suffit pas : il ne saute que les lignes verrouillées **à cet instant**, et une livraison en attente de réessai n'est pas verrouillée entre deux tentatives. Avec un retrait exponentiel allant jusqu'à 24 h, rien n'empêcherait l'émetteur de prendre l'événement *n+1* d'un enregistrement pendant que l'événement *n* attend — l'ordre serait violé exactement dans le cas qui le rend nécessaire, celui d'un consommateur intermittent. Le garde `NOT EXISTS` impose l'ordre même avec plusieurs processus émetteurs, et il est servi par `idx_delivery_due`.

**Conséquence assumée : blocage de tête par enregistrement.** Tant qu'un événement échoue, les suivants du même enregistrement attendent, jusqu'à 24 h, et leurs valeurs `display` vieillissent. Au-delà de **6 h d'âge pour la plus vieille livraison en attente d'un abonnement**, celui-ci est déclaré désynchronisé (§10.7). Un `NOTIFY basedb_webhook` réveille l'émetteur ; `webhook_delivery` est partitionnée par mois sur `created_at`.

### 10.7 Réessais, désactivation, resynchronisation

Réessais sur `5xx`, `408`, `429` et erreur réseau. **Pas de réessai** sur les autres `4xx`, y compris `413` : un `400` persistant est un bug du consommateur, le rejouer huit fois ne le corrige pas. Retrait exponentiel avec gigue ±20 % : 10 s, 30 s, 2 min, 10 min, 1 h, 6 h, 24 h, 24 h ; `Retry-After` est respecté s'il est plus long. Après 8 échecs, la livraison passe en `failed`. Les états sont ceux du catalogue : `pending`, `in_flight`, `delivered`, `failed`, `abandoned`, avec la cause dans `error_code`.

**Désactivation** : après 50 livraisons consécutives en échec, ou 24 h sans aucun succès, l'abonnement passe `is_active = false` avec `disabled_reason = 'failures'`, audit écrit et administrateur notifié. Une désactivation demandée porte `'manual'`, une désactivation pour masque incomplet `'field_masked'` (§10.3).

**Resynchronisation.** Un consommateur indisponible 24 h laisse des milliers de livraisons en échec. **Le rejeu partiel est refusé** : ne rejouer que les cent dernières laisserait le miroir faux sans que personne ne le sache. À la réactivation, un **unique** événement `webhook.resync_required` est émis, portant la fenêtre perdue (`{"from": …, "to": …, "tables": […], "lost_deliveries": 8412}`) ; les livraisons antérieures à la fenêtre passent en `abandoned` ; l'état reste visible dans l'écran d'administration jusqu'à acquittement explicite.

Le consommateur répare avec les deux routes du §6.5 : les modifications par `_updated_at`, les suppressions par `/deleted?since=`. Le seuil objectif est l'**âge** de la plus vieille livraison en attente (6 h), pas un compte d'échecs, qui ne dit rien du volume perdu.

### 10.8 Cible réseau : filtrage, TLS, mode développement

**Le filtrage d'adresses fonctionne par autorisation, pas par interdiction.** Une liste de plages interdites est toujours incomplète : `[::ffff:169.254.169.254]` et `[::ffff:127.0.0.1]` n'appartiennent ni à `::1` ni à `fc00::/7` et se connectent pourtant en IPv4 sur la boucle locale ou le service de métadonnées ; `0.0.0.0` est un alias de la boucle locale sur Linux ; `100.64.0.0/10` (CGNAT), `192.0.0.0/24`, `198.18.0.0/15` et `64:ff9b::/96` (NAT64) mènent au réseau de l'hébergeur.

Règles, toutes exigées :

1. **N'accepter qu'une adresse « global unicast » publiquement routable**, hors de toute plage réservée IANA, toute adresse IPv4 mappée en IPv6 étant **normalisée avant test**.
2. **Valider l'intégralité de la réponse DNS** (tous les enregistrements A et AAAA) et refuser si une seule adresse est interdite — pas seulement celle retenue.
3. **Refuser toute URL portant un `userinfo`**, tout port autre que 443 (et 80 uniquement si le déploiement l'active explicitement), et tout nom résolvant dans le domaine de résolution interne.
4. **Aucune redirection suivie**, et connexion établie sur l'adresse IP validée avec `Host` et SNI explicites, ce qui neutralise le réancrage DNS entre la validation et la connexion.
5. **Validation complète de la chaîne TLS, sans option de désactivation, et aucun repli en clair** : une livraison contient des lignes complètes, elle ne part pas vers un point d'arrivée non authentifié.
6. Délai de connexion 5 s, délai total 10 s, corps de réponse lu au plus 8 Kio puis ignoré ; **URL revalidée à chaque tentative**.
7. **Le mode développement ne relâche que l'obligation HTTPS, jamais le filtrage d'adresses**, et il est refusé si l'environnement déclare une production.

**Ce que voit le créateur de l'abonnement.** Le webhook ne doit pas devenir un scanner du réseau interne. L'état exposé se limite à `status` et à un `error_code` ternaire — livrée, échec temporaire, échec permanent — auquel s'ajoute `WEBHOOK_TARGET_REJECTED` quand le filtre d'adresses a bloqué, **sans dire pourquoi**. Le code HTTP du point d'arrivée est exposé, le créateur en ayant besoin pour déboguer son propre service, mais **ni le détail réseau (DNS, connexion, TLS), ni la latence** ne le sont : c'est le détail réseau et la latence qui font le scanner, pas un `502` renvoyé par un service que l'on administre soi-même.

### 10.9 Exploitation de la file

Sans outillage, tout incident de webhook se règle en SQL à la main dans `_basedb`, sans traçabilité ni contrôle de permission. Les routes du §1.4 couvrent :

| Besoin | Route | Règle |
|---|---|---|
| Voir la file | `GET /admin/webhooks/{id}/deliveries?status=&since=` | États, âge, tentatives, code HTTP du consommateur |
| Inspecter une livraison | `GET …/deliveries/{delivery}` | Le corps est **recalculé** depuis `change_event` et **projeté selon les droits du lecteur**, pas selon ceux de l'abonné. Un diagnosticien ne lit jamais un champ qu'il n'a pas le droit de lire dans la table d'origine |
| Rejouer | `POST …/deliveries/{delivery}/replay` | Masque du rôle **courant** revérifié (§10.3) ; abandon si le rôle n'a plus le masque complet ; entrée d'audit |
| Abandonner une file | `POST …/deliveries/abandon` | Portée explicite obligatoire (`record_id`, `table`, ou fenêtre temporelle) ; entrée d'audit ; jamais implicite |
| Réactiver | `POST /admin/webhooks/{id}/activate` | Revérifie le masque, puis déclenche la resynchronisation du §10.7 |

L'inspection est le seul endroit du produit où une charge utile de webhook est projetée : c'est une lecture par un humain, soumise à ses propres droits, et non la livraison, complète par construction (A19). Toutes ces routes exigent `manage_tokens`, sont réservées aux sessions et sont journalisées dans l'audit.

---

## 11. Jetons d'intégration et administration

### 11.1 Qui peut administrer les intégrations

**`/admin/tokens` et `/admin/webhooks` exigent `manage_tokens`**, l'un des sept verbes du catalogue. Il est distinct de tout droit sur les données : détenir `create` sur une table ne donne aucun accès à l'administration des intégrations.

**`/admin/*` est interdit aux acteurs de classe `token`** : un appel dont l'acteur est un jeton reçoit `404`, conformément au principe d'absence. Sans cette règle, un jeton compromis se rotationnerait indéfiniment, créerait d'autres jetons pour survivre à sa propre révocation, ou créerait un webhook vers un serveur contrôlé pour exfiltrer en continu toutes les lignes. L'administration des intégrations est réservée aux sessions, et exige une **ré-authentification récente** (moins de 15 minutes, `session.elevated_until`) pour la création, la rotation et la révocation.

### 11.2 Non-élévation

**`role_id` n'est acceptable que si l'ensemble des permissions effectives du rôle demandé est inclus dans celui de l'appelant.** Sinon `403 ROLE_NOT_DELEGABLE`, avec `details.missing` limité aux droits que l'appelant peut lui-même voir. Sans cette règle, un utilisateur possédant le moindre accès à `/admin/tokens` crée un jeton portant le rôle administrateur et obtient en une requête tous les droits de l'instance : le contrôle de permission n'est pas franchi, il est contourné en amont, à la création de l'identité.

**La vérification est refaite à chaque usage du jeton** : l'autorisation effective d'un jeton est l'intersection des permissions de son rôle et de celles de son créateur au moment de l'appel. Une réduction ultérieure des droits du créateur réduit donc le jeton, et sa désactivation le neutralise. La même règle s'applique au `role_id` d'un webhook (§10.3).

### 11.3 Format, stockage, portée, expiration

**Format** : `bdb_<prefix8>_<43 caractères base62>`, où les 43 caractères encodent 256 bits d'un générateur cryptographique. `<prefix8>` est stocké en clair dans `api_token.token_prefix` pour l'affichage. Le préfixe `bdb_` rend le jeton reconnaissable par les analyseurs de secrets des dépôts Git.

**Stockage** : SHA-256 du jeton complet dans `token_hash` ; le secret n'est jamais écrit, et n'apparaît que dans la réponse `201` de création. SHA-256 et non argon2id, délibérément : le jeton porte 256 bits d'aléa et n'est pas devinable par force brute, alors qu'argon2id ajouterait une centaine de millisecondes à **chaque** appel. Les mots de passe, eux, restent en argon2id.

**Portée** : `role_id` obligatoire — la portée par table et par champ est celle du rôle, ce qui évite deux modèles de permission concurrents —, `base_id` facultatif, et `allowed_surfaces` qui restreint aux surfaces `rest` et `mcp`. Le jeton est lié à un tenant ; il reçoit `404` partout ailleurs. Un jeton dont l'empreinte n'est connue d'aucune ligne d'`api_token`, ou présenté hors de ses `allowed_surfaces`, est refusé par `401 TOKEN_INVALID` ; la date d'expiration dépassée rend `401 TOKEN_EXPIRED` et la révocation `401 TOKEN_REVOKED` (§7.4). **Expiration** obligatoire (`expires_at NOT NULL`), défaut 90 jours, maximum 365.

### 11.4 Révocation et rotation

**Révocation** immédiate : `revoked_at` posé, `NOTIFY basedb_token_revoked` vide le cache d'authentification des processus, dont le TTL est de toute façon plafonné à 30 s.

**Rotation** : `POST /admin/tokens/{id}/rotate` crée un **nouveau** jeton de même rôle, même portée et mêmes surfaces, et raccourcit la vie de l'ancien. Trois garde-fous : refus si l'ancien jeton est révoqué ou expiré, la rotation ne **ressuscitant** pas un jeton mort ; la grâce ne peut qu'abréger (`expires_at = least(expires_at, now() + grace)`, 24 h par défaut, 7 jours au maximum) ; la fenêtre de recouvrement est visible comme deux jetons actifs, ce qui évite une colonne supplémentaire.

### 11.5 Journalisation d'usage

`api_token.last_used_at` est mis à jour au plus **une fois toutes les cinq minutes par jeton**, en agrégation mémoire, hors de la transaction applicative, et n'est indexée nulle part — c'est le régime des colonnes d'usage du catalogue. Un `UPDATE` par appel sur une ligne chaude crée une file de verrous, interdit la mise à jour HOT, et se ferait dans l'autre pool.

Les écritures et les opérations de schéma produisent une entrée d'audit ; les lectures alimentent un compteur agrégé par jeton et par heure. Journaliser chaque `GET` ferait de l'audit la plus grosse table de l'instance. Les refus de sécurité sont tracés ailleurs (§14.1).

---

## 12. Compatibilité n8n

n8n fonctionne sans nœud spécifique, et chaque propriété nécessaire est vraie par construction dans ce qui précède : authentification `Authorization: Bearer` du nœud HTTP Request ; `application/json` en requête et en réponse, sans multipart ni forme propriétaire ; codes HTTP fidèles, `Retry-After` respecté sur `429` et `5xx` ; pagination par `meta.next_cursor` et `meta.has_more`, atteignables par `{{$response.body.meta.next_cursor}}` ; filtres et tri écrits dans un champ texte (§4) ; webhooks reçus tels quels par le nœud Webhook, la signature se vérifiant dans un nœud Code ; corps de webhook de forme constante, `events[]` même à un seul élément, donc aucune branche conditionnelle ; `Idempotency-Key` contre les réexécutions de workflow ; reprise après panne par `filter=_updated_at gte …` et `/deleted?since=` (§6.5), avec `links=id` recommandé pour ces passes ; découverte par `GET /meta/bases`.

Deux points à connaître de l'intégrateur : les nombres arrivent en chaînes décimales (§7.2), donc un nœud Code qui fait de l'arithmétique convertit explicitement — c'est le prix de ne jamais perdre silencieusement de la précision ; et aucun CORS n'est requis, n8n appelant côté serveur.

---

## 13. Débit, coût et concurrence

### 13.1 Limitation de débit sur PostgreSQL seul

Conformément à A4, il n'existe **aucune brique d'infrastructure en dehors de la base** : pas de Redis, pas de magasin de compteurs partagé. Cela a une conséquence directe sur la limitation de débit, et elle est écrite ici plutôt qu'ignorée.

**Décision : les seaux à jetons vivent en mémoire de chaque processus, calibrés à `quota ÷ nombre d'instances déclarées`, et rien n'est écrit en base sur le chemin de la requête.** Un compteur en base exigerait un `UPDATE` par requête sur une ligne par acteur, dans `_basedb`, c'est-à-dire sur l'autre pool : une ligne chaude, une file de verrous, et la limitation de débit devenue le goulot de l'API qu'elle protège.

**Le décompte se fait en opérations, pas en requêtes.** Un lot de *N* opérations consomme *N* jetons et est refusé d'emblée (`429 RATE_LIMIT_EXCEEDED`) si le seau n'en contient pas *N*. Sans cela, `POST /batch` multiplierait le quota par 1 000, soit 60 000 écritures et autant d'interrogations d'oracle par minute.

| Portée | Lecture | Écriture | Rafale |
|---|---|---|---|
| Acteur (jeton ou session) | 600 op/min | 60 op/min | 100 |
| Tenant | 3 000 op/min | 300 op/min | 500 |
| **Adresse IP sans acteur authentifié** | 60 req/min | — | 10 |
| **Réponses révélatrices, par acteur** | 60/min | — | 20 |

Le troisième seau est indispensable : sans lui, un appelant sans acteur n'est limité par rien, ce qui laisse libre cours au sondage d'existence de tenants et de bases, au bourrage d'identifiants sur `/auth/*` et à la saturation du pool. Il applique une pénalité exponentielle après une série de `401`/`404`.

Le quatrième compte séparément les réponses d'échec révélatrices — `404` sur ressource, `409 DUPLICATE_VALUE`, `409 CONFLICT`, `409 LINK_TARGET_NOT_FOUND`, `409 ROW_REFERENCED`, `400 FILTER_FIELD_UNKNOWN` : c'est la seule défense réaliste contre les oracles qui subsistent par conception, et ce qui rend la fuite du §8.2 « détectable » plutôt que seulement « acceptée ». Son dépassement produit un événement dans le **journal de sécurité**, qui vit en base (§14.1) : la détection doit survivre à un redémarrage, le compteur non.

**L'approximation avec plusieurs instances.** Avec *p* processus et un seau de `quota ÷ p` chacun, un appelant dont les requêtes atteignent toutes le même processus est limité à `quota ÷ p`, et un appelant qui les répartit parfaitement atteint `quota`. Les deux erreurs sont réelles. Elles sont ramenées à un écart négligeable par une exigence posée au déploiement : **le répartiteur distribue par affinité d'acteur** (hachage sur le porteur de l'en-tête `Authorization`, ou sur l'adresse IP à défaut). Un acteur voit alors presque toujours le même processus, et la dérive ne se produit qu'en fenêtre de redéploiement ou au changement de la taille du parc. Sans affinité, la limite reste correcte à un facteur *p* près : elle protège d'un abus massif, pas d'un abus fin.

Les compteurs sont **volatils par construction** — un redéploiement les remet à zéro — et **aucune décision de facturation ni de sécurité ne doit en dépendre**. Le nombre d'instances est une valeur de configuration, pas une découverte dynamique : le déduire d'un registre de processus recréerait la dépendance externe que A4 supprime.

**Limite de concurrence, distincte du débit** : 8 requêtes simultanées par acteur, 64 par tenant, appliquées par processus selon la même règle de division. Un seau à jetons limite le *débit*, pas le *parallélisme* : 100 requêtes lentes simultanées d'un seul jeton saturent le pool `donnees` sans jamais approcher 600 requêtes par minute. Au-delà, une file d'attente de 2 s, puis `429 CONCURRENCY_LIMIT_EXCEEDED`.

**`X-RateLimit-*` ne reflète que le seau de l'acteur.** Exposer le seau de tenant permettrait à tout porteur du plus petit jeton d'observer le volume d'activité de toute l'organisation : heures d'activité, pics nocturnes, jours de fermeture. Un dépassement du seau de tenant renvoie `429 RATE_LIMIT_EXCEEDED` avec `Retry-After` seul, sans compteur ni limite.

### 13.2 Budget de complexité

Évalué avant exécution, plafond 100 points :

| Poste | Points |
|---|---|
| Prédicat de filtre | 1 |
| Prédicat sur un chemin de lien | 3 |
| **Table cible résolue pour `display`, expansée ou non** | 2 |
| Champ expansé | 5 |
| Tri sur un champ lien | 10 |
| Tri sur un champ non indexé | 5 |
| `count=exact` | 20 |

Le troisième poste rend le garde-fou sensible au multiplicateur le plus systématique de l'API (§5.4) : sans lui, une table à 8 champs lien paie 9 requêtes SQL par page sans que rien ne le compte. Dépassement : `400 QUERY_TOO_EXPENSIVE`, avec `details.budget` ventilé et `details.hint` suggérant `links=id` ou une projection — un message qui dit quoi retirer.

### 13.3 Filtre ou tri non indexé sur une grosse table

Le déclencheur ne peut pas être `pg_class.reltuples` seul : `reltuples` vaut `-1` tant que la relation n'a jamais été analysée, et reste périmé entre deux passages d'autovacuum — une table remplie par import ou par SQL direct, précisément le cas où le garde-fou est indispensable, ne franchirait jamais le seuil.

Règles :

1. Le seuil porte sur l'**estimation après prédicat de lignes** (§6.4), jamais sur la taille physique : sinon, en observant quelles tables déclenchent le refus, un lecteur classe toutes les tables de la base par ordre de grandeur, y compris celles dont il ne voit presque rien.
2. `reltuples < 0` est traité comme **inconnu** et déclenche l'analyse de coût, recoupée avec `pg_relation_size`, toujours juste et sans dépendance aux statistiques. Un `ANALYZE` est exigé en fin de migration et après tout import en masse.
3. L'analyse utilise **`EXPLAIN (FORMAT JSON, GENERIC_PLAN)`**, disponible depuis PostgreSQL 16, qui est le plancher du produit (A1) : une requête paramétrée ne s'analyse pas telle quelle autrement.
4. Le garde-fou **démarre en mode observation** — journalisé et compté, non bloquant — et n'est activé qu'après examen des mesures. Un refus fondé sur un coût estimé dépend des statistiques et du planificateur : la même requête peut passer en recette et échouer en production.
5. `details` porte le coût estimé, le seuil appliqué, l'origine de la décision et `suggested_index = {table, field, kind}`, pour qu'un refus soit démontrable a posteriori au support.

Le garde-fou de **volume** sur les tris non indexables — ordre métier d'une liste de choix, valeur d'affichage d'une cible de lien — appartient à « Types de champs » et s'applique en amont, avec son propre repli. Les deux se cumulent : l'un borne ce qui n'est structurellement pas indexable, l'autre ce qui pourrait l'être et ne l'est pas.

*Alternative rejetée* : laisser passer et compter sur `statement_timeout` — le délai arrive **après** avoir consommé le disque et la mémoire, et sous concurrence il sature le pool `donnees` avant de rendre la main.

### 13.4 Délais, et pourquoi pas `statement_timeout` sur la connexion

Un pool réutilise ses connexions : un réglage de session posé pour une écriture resterait actif pour la lecture suivante, et tout réglage de session est perdu ou mal placé dès qu'un mutualiseur en mode transaction s'intercale. D'où :

- **toute requête ouvre une transaction explicite** et pose `SET LOCAL statement_timeout` et `SET LOCAL lock_timeout` ; les variables d'identité `basedb.actor_id`, `basedb.actor_kind` et `basedb.bulk_id` y sont posées par `set_config(…, true)`, valeur en paramètre lié (« Historique des données et des structures ») ;
- **un budget de délai par requête HTTP** : 15 s en lecture, 30 s en écriture, décompté entre les instructions successives, le reliquat étant posé comme `statement_timeout` de chacune. Sans budget, une requête de liste émettant `1 + T` instructions atteindrait 60 s réelles avec T = 5, alors que le client, le répartiteur et n8n ont abandonné bien avant, tandis que la connexion et les verrous continuent de travailler pour personne ;
- **l'annulation est propagée** dès que le client a fermé la connexion, et `idle_in_transaction_session_timeout` de 60 s sert de filet ;
- le `504 TIMEOUT_EXCEEDED` est journalisé avec le SQL **paramétré** et le plan (§14.3).

### 13.5 Index exigés

PostgreSQL ne crée **aucun** index sur la colonne référençante d'une clé étrangère. Or le coût borné du filtre par identifiant (§4.4), du comptage plafonné et de l'aperçu des liens inverses (§5.6), de la pagination d'un groupe inverse et de la vérification de la clause `NO ACTION` en dépendent tous.

L'index existe : « Conventions de nommage » et « Types de champs » imposent `ix_<table>__<colonne>` sur `("<colonne>", "_id")` pour tout champ lien, remplacé par `uq_<table>__<colonne>` si le champ est unique. Ce chapitre n'ajoute rien à cette exigence, mais il en dépend : le second terme `_id` n'est pas décoratif. Sans lui, l'aperçu « les 3 plus récentes » du §5.6 ferait trier toutes les lignes référençantes à chaque ouverture d'une fiche client ; avec lui, l'aperçu est un parcours arrière du même index.

**Index suggérés par `QUERY_TOO_EXPENSIVE`** : btree sur la colonne avec sa collation pour `eq`, `in`, les comparaisons d'ordre et le tri ; btree `text_pattern_ops` sur `_basedb_local.fold_v1(<colonne>)` pour `starts_with` ; GIN trigramme sur la même expression pour `contains` et `ends_with`.

Deux contraintes de mise en œuvre, qui interdisent le « clic depuis une réponse d'erreur » naïf :

1. `unaccent` est `STABLE`, pas `IMMUTABLE`, donc inutilisable dans une expression d'index. La normalisation passe par `_basedb_local.fold_v1()`, fonction enveloppe déclarée immuable, utilisée à l'identique dans les filtres (§4.5) et dans les index. `pg_trgm`, `unaccent` et les collations ICU sont des **prérequis d'installation vérifiés au démarrage** (A3), pas des options : il n'existe pas de chemin de repli sans eux.
2. La création passe par le **moteur de migration**, qui emploie `CREATE INDEX CONCURRENTLY` hors transaction et supprime un index resté invalide après échec (A11). Un `CREATE INDEX` ordinaire bloque les écritures pendant toute sa durée : l'éditeur de schéma déclenche une migration, pas un DDL direct.

---

## 14. Modèle de menace : canaux observables

Chaque canal par lequel un appelant peut apprendre quelque chose est listé, avec la décision prise. Ce qui n'y figure pas est un défaut, pas une tolérance. « Fermé » signifie que le canal ne porte plus d'information ; « assumé » qu'il en porte, avec sa contre-mesure ; « journalisé » qu'il alimente le journal de sécurité.

| Canal observable | Ce qu'il révélerait | Décision |
|---|---|---|
| Code HTTP `404` vs `403` | Existence d'une ressource invisible | **Fermé** : `404` unifié, `403` réservé aux ressources visibles (§1.3) |
| Durée de réponse d'un `404` | Existence d'un tenant, d'une base, d'une table | **Fermé** : chemin de sortie unique, plancher de 25 ms (§1.3) |
| `ETag`, et `412` sur `If-Match` | Modification d'un champ masqué, en passif et en actif | **Fermé** : empreinte de la projection visible (§3.2) |
| `_updated_at`, `_updated_by` | Instant d'une modification invisible, sans son contenu | **Assumé (A18)** : colonnes système toujours lisibles ; c'est le prix d'une reprise incrémentale ouverte à tous les rôles (§4.3) |
| `filter` / `sort` sur un champ masqué | Valeur exacte par dichotomie | **Fermé** : champ non lisible = champ inexistant (§4.3) |
| `EXISTS` d'un filtre sur chemin de lien | Contenu d'une table cible invisible | **Fermé** : prédicat de lignes de la cible dans l'`EXISTS` (§4.4) |
| Contenu d'un curseur, ou curseur d'autrui réutilisé | Valeurs de données dans les journaux ; position issue de lignes jamais vues | **Fermé** : chiffrement AEAD, clé hors base, acteur et `authz_version` dans l'AAD (§6.2) |
| `count=estimate`, `reltuples`, seuil de `QUERY_TOO_EXPENSIVE` | Volumétrie et ordre de grandeur de chaque table | **Fermé** : estimation après prédicat de lignes, plafonnée (§6.4, §13.3) |
| `409 DUPLICATE_VALUE` | Existence d'une valeur, d'une ligne | **Assumé si `read` et champ lisible**, sans la valeur en conflit ; `409 CONFLICT` anonyme si le champ est masqué ; `422` générique sans droit de lecture ; **journalisé** (§7.4) |
| `409 LINK_TARGET_NOT_FOUND` | Existence d'une ligne cible invisible | **Fermé** : même code pour « inexistant » et « invisible » (§8.1) |
| `has_hidden_references` | Un bit **par ligne**, énumérable | **Assumé, borné et journalisé** : jamais en lot, compté au seau révélateur (§8.2) |
| Identifiant d'un lien vers une table invisible | Existence, instant de création à la ms, rang de création (UUIDv7) | **Fermé** : forme unique `{id:null, display:null, masked:true}`, sans option contraire (A16, §5.5) |
| Identifiant d'un lien vers une **ligne** invisible, présence d'une entrée dans `included` | Idem, sur une table par ailleurs lisible ; visibilité d'une ligne cible | **Assumé et documenté** : équivalent à une lecture directe de la cible (§5.5) |
| Présence d'un groupe dans `referenced_by` | Existence d'une table source | **Fermé** : groupe omis si la table source est invisible (§5.6) |
| Décompte de cascade | Volumétrie de tables invisibles | **Fermé** : `404` si un droit `delete` manque sur une table atteinte ; `details.per_table` limité aux tables lisibles (§8.3) |
| Contenu d'OpenAPI, de `/meta/*` et de la documentation lisible | Structure complète, cibles de lien | **Fermé** : projection unique, filtrée par droits (§9.1, §9.3) |
| Message d'erreur PostgreSQL | Noms physiques, contraintes, colonnes reléguées | **Fermé** : liste blanche + projection par le registre + aucune chaîne concaténée (§7.3) |
| `X-RateLimit-Remaining` | Activité de tout le tenant | **Fermé** : seul le seau de l'acteur est exposé (§13.1) |
| Charge utile d'un webhook | Champ masqué pour le rôle de l'abonnement | **Sans objet** : masque complet exigé, sinon abonnement refusé ou désactivé (A19, §10.3) |
| `actor` d'un webhook | Identité interne, nom d'hôte | **Fermé par défaut** : `{kind}` seul, option administrateur (§10.2) |
| Erreur réseau et latence d'un webhook | Cartographie du réseau interne | **Fermé** : `error_code` ternaire + `WEBHOOK_TARGET_REJECTED`, détail au journal d'instance (§10.8) |
| Entrée d'historique dont tous les champs sont masqués | Existence d'une modification invisible | **Fermé** : entrée omise (§7.7) |
| Journaux d'accès HTTP | Curseur, filtre, jeton | **Fermé** : chaîne de requête non journalisée sur `/data/*`, en-têtes sensibles jamais journalisés (§14.3) |

### 14.1 Journal de sécurité

Distinct de l'audit, parce que l'audit trace ce qui a **réussi** et que la détection d'une énumération se lit dans ce qui a **échoué**. Y entrent : `401`, `403`, `404` d'invisibilité, dépassements du seau révélateur et de débit, `ROLE_NOT_DELEGABLE`, jetons présentés hors `Authorization`, `CASCADE_*`, URL de webhook refusées par le filtre d'adresses. Chaque entrée porte l'acteur (ou l'adresse IP), la route **sans chaîne de requête**, le code, l'horodatage et le `request_id` ; jamais les corps, les valeurs de filtre ni les curseurs. Rétention 180 jours (A24), avec alerte sur le dépassement du seau révélateur et sur une série de `401` depuis une même adresse.

### 14.2 Fenêtre de cohérence des droits

Les droits sont résolus une fois par requête HTTP (§2.4) ; une révocation survenue pendant un lot de 1 000 opérations n'est pas appliquée en cours de lot. Elle l'est à la requête suivante, dans la borne de 30 s du §2.5. Une pagination de 200 pages traverse donc potentiellement une révocation : la page suivante échoue alors au déchiffrement du curseur (`authz_version` dans l'AAD) et renvoie `CURSOR_INVALID`, ce qui est le comportement voulu. Une réponse mémorisée par `Idempotency-Key` n'est rejouée que si l'`authz_version` concorde (`IDEMPOTENCY_STALE` sinon, §3.3).

### 14.3 Ce qui n'est jamais journalisé

- Les en-têtes `Authorization`, `Cookie`, `X-Basedb-Csrf`, `X-Basedb-Signature`.
- La chaîne de requête des routes `/data/*`, qui porte `filter` et `cursor`.
- Les valeurs liées d'une requête SQL : **seul le SQL paramétré est journalisé**, les valeurs étant remplacées par leur type et leur longueur. Une recherche `email contains "…"` ou un filtre sur un nom de patient est une donnée personnelle ; la déverser dans les journaux d'exploitation en ferait une copie non contrôlée.
- Les corps de requête et de réponse.

Les journaux techniques (SQL paramétré, plans, délais dépassés) ont une rétention de 30 jours et un accès réservé à l'exploitation de l'instance.

---

## 15. Exploitation

### 15.1 Santé et préparation

| Route | Vérifie | Effet |
|---|---|---|
| `/healthz` | Le processus répond | `200` tant que le processus vit |
| `/readyz` | Cache de catalogue chargé, pool `donnees` joignable, pool `catalogue` joignable, canal `LISTEN` établi | `503` sinon |

`/readyz` **échoue tant que le cache de catalogue n'est pas chargé**. Sans cela, un processus fraîchement démarré répondrait `404` sur toutes les tables, ce qui est indistinguable d'un refus de permission — un incident invisible pendant un déploiement. Ni l'une ni l'autre ne renvoie de corps détaillé : une page d'état qui nomme les dépendances est une carte offerte.

### 15.2 Migrations DDL en cours

Pendant qu'une étape de migration détient un verrou `ACCESS EXCLUSIVE`, les requêtes de l'API sur la table s'empilent derrière la demande de verrou puis échouent en `504` : une migration de 30 s ne produit pas une lenteur mais une **indisponibilité totale** de la table, et le pool `donnees` se remplit de connexions bloquées, ce qui dégrade aussi les tables saines. D'où :

- le catalogue porte l'état de structure par base et par table (`base.structure_state`, `table_def.definition_state`), publié aux processus API par `NOTIFY basedb_catalog` ;
- pendant une étape exclusive, l'API répond `503 TABLE_MIGRATING` avec `Retry-After`, plutôt que de laisser s'accumuler des requêtes vouées au `504` ;
- les étapes non bloquantes d'une migration en plusieurs temps (A11) — `ADD CONSTRAINT … NOT VALID`, `VALIDATE CONSTRAINT`, `CREATE INDEX CONCURRENTLY` — **ne ferment pas la table** : l'API continue de servir, ce qui est la raison d'être de ce découpage ;
- exigence symétrique : **la durée d'une transaction d'écriture de l'API est bornée à 30 s** (§13.4), pour qu'un lot ne puisse pas retarder une migration au-delà de quelques secondes.

### 15.3 Déploiement progressif

Deux versions servent le même trafic derrière le même répartiteur : le **format de curseur est figé** (§6.2), la **version applicative entre dans l'`ETag`** des documents de `/meta/*` (§9.2), chaque ligne capturée porte un `format_version` que le drain refuse de dépasser s'il ne le connaît pas plutôt que de perdre l'événement, et `/readyz` empêche le répartiteur d'envoyer du trafic à un processus non prêt. L'affinité d'acteur du §13.1 est rompue pendant la bascule : la limitation de débit est plus permissive quelques minutes, ce qui est attendu.

### 15.4 Dérive entre catalogue et base physique

Le produit encourage l'accès SQL direct : un `ALTER TABLE` fait à la main, une étape de migration interrompue ou un cache périmé produisent des `42703`, `42P01` ou `23502` qui, non prévus, remonteraient en `500` brut.

- Ces SQLSTATE sont traduits en **`503 CATALOG_DRIFT_DETECTED`** avec `Retry-After`, **précédés d'un rechargement forcé du cache et d'un unique réessai transparent**.
- Le cache de catalogue est invalidé par `NOTIFY basedb_catalog` et son **TTL est plafonné à 60 s** ; le plafond s'applique même si la notification est perdue.
- La **réconciliation** entre le registre, le catalogue et `pg_catalog` appartient aux chapitres 01 et 02, avec leurs classes de dérive nommées. Ce chapitre n'en définit que la conséquence côté API : **la table concernée passe en lecture seule tant qu'un écart bloquant subsiste** — servir une écriture sur une structure que le catalogue décrit faussement est pire que refuser.

### 15.5 Restauration et reprise

Une restauration remet en service des états périmés : la file d'envoi rejouerait des livraisons obsolètes vers des consommateurs de production, les clés d'idempotence rejoueraient des réponses anciennes, les jetons révoqués redeviendraient valides. **Procédure exigée, avant d'ouvrir le trafic :**

1. Passer en `abandoned` toutes les livraisons antérieures au point de restauration ; émettre `webhook.resync_required` (§10.7) au lieu de rejouer.
2. Purger `_basedb.idempotency_key` et les tampons de `_basedb_local` non drainés antérieurs au point de restauration.
3. Révoquer les jetons dont la révocation est postérieure au point de restauration (liste conservée hors base par l'exploitation, ou reconstruite depuis le journal d'audit archivé).
4. Vérifier que `BASEDB_ENCRYPTION_KEY` porte la clé d'origine et ses versions antérieures (A25). Elle vit **hors de la base** et n'est donc pas dans le `pg_dump` : si elle n'a pas été sauvegardée séparément, les secrets de signature sont illisibles, les webhooks signent faux — un échec qui ne se manifeste que chez le consommateur — et tous les curseurs en circulation deviennent invalides. C'est l'élément de sauvegarde le plus facile à oublier.
5. Relancer la réconciliation (§15.4) et un `ANALYZE` global.

### 15.6 Contrats attendus des autres chapitres

| Contrat | Chapitre |
|---|---|
| `_basedb.tenant.authz_version`, incrémentée à toute écriture d'autorisation ; `NOTIFY basedb_authz` | Schéma du catalogue, Modèle de permissions |
| Décideur renvoyant le résultat de décision (`verdict`, `champs_lisibles`, `champs_inscriptibles`, `champs_effacables`, `predicat_lignes`, `authz_version`), prédicat constamment vrai en v1 (A20) | Modèle de permissions |
| Capture par déclencheur, `basedb.actor_id` / `basedb.actor_kind` / `basedb.bulk_id`, `is_cascade` par `pg_trigger_depth()` | Historique des données et des structures |
| Journal de suppression des enregistrements exposant `deleted_at`, `deleted_by`, la cause et un horizon de rétention | Historique des données et des structures |
| `_basedb_local.set_updated_at()` employant `clock_timestamp()`, jamais `now()` | Architecture logicielle |
| `_basedb_local.fold_v1()` immuable, employée à l'identique dans les filtres et les index | Types de champs |
| `ix_<table>__<colonne>` sur `("<colonne>","_id")` créé avec chaque champ lien | Moteur DDL, Types de champs |
| `ANALYZE` en fin de migration et après import en masse ; `lock_timeout` court avec réessais ; état de structure publié par `NOTIFY basedb_catalog` | Moteur DDL |
| Traduction unique des SQLSTATE vers le registre des codes | Architecture logicielle |
| Routes `/auth/*`, échange du cookie contre un jeton d'accès de 15 minutes, `session.elevated_until` | Authentification |
| Point de terminaison `POST /mcp` et vérification de `allowed_surfaces` | Serveur MCP |

---

## 16. Observabilité, rétention, volumétrie

### 16.1 Métriques et seuils

| Métrique | Seuil d'alerte |
|---|---|
| Âge de la plus vieille livraison en attente, par abonnement | 6 h → resynchronisation (§10.7) |
| Profondeur de file par abonnement | > 10 000 |
| Abonnements désactivés automatiquement | > 0 sur 24 h |
| Latence du drain, du `COMMIT` à l'écriture de `change_event` | p95 > 5 s |
| Taux de `429`, `QUERY_TOO_EXPENSIVE`, `504` par tenant | > 1 % des requêtes |
| Latence p50 / p95 / p99 par route | p95 > 500 ms en lecture |
| Occupation des pools `catalogue` et `donnees`, temps d'attente d'une connexion | > 80 %, ou > 100 ms d'attente |
| **Requêtes SQL émises par requête HTTP** (le `1 + T` du §5.4) | p95 > 4 |
| Taux de `CURSOR_STALE` | > 0,1 % |
| Écart de réconciliation catalogue / base physique | > 0 |
| Borne supérieure de la dernière partition − `now()` | < 30 jours |
| Lignes reçues par la partition `DEFAULT` | > 0 |

### 16.2 Journaux

Trois journaux distincts : l'**audit** (`_basedb.audit_log`, ce qui a réussi, 24 mois), le **journal de sécurité** (§14.1, 180 jours), les **journaux techniques** (§14.3, 30 jours, hors base).

### 16.3 Rétention de ce que ce chapitre introduit

Les rétentions applicables aux traces et aux journaux sont celles de A24, déclarées une fois dans `_basedb.retention_policy` et toutes configurables. Ce chapitre ne fixe que les délais d'expiration qui lui sont propres ; pour le reste, il nomme le mode de purge.

| Objet | Où | Rétention | Purge |
|---|---|---|---|
| `_basedb.change_event` | `_basedb`, partitionnée par mois | 7 jours | détachement puis suppression de partition |
| `_basedb.webhook_delivery` | `_basedb`, partitionnée par mois | 90 jours | détachement, archivage optionnel, suppression |
| Journal de sécurité | `_basedb` | 180 jours | tâche quotidienne |

Délais d'expiration propres à ce chapitre, hors `retention_policy` :

| Objet | Où | Délai | Purge |
|---|---|---|---|
| `_basedb.idempotency_key` | `_basedb` | 24 h (`expires_at`) | tâche horaire |
| Compteurs horaires d'usage de jeton | `_basedb` | 90 jours | tâche quotidienne |
| Journaux techniques | hors base | 30 jours | rotation |

**Partitions.** Elles sont créées jusqu'à M+2 par la tâche de maintenance du catalogue, une partition `DEFAULT` servant de filet avec alerte si elle reçoit une ligne : sans cela, l'absence de la partition du mois suivant fait échouer une insertion à minuit le 1er du mois. « Détachée » n'est pas « supprimée » : le cycle complet est détachement, archivage optionnel, suppression.

### 16.4 Volumétrie aux ordres de grandeur du cadrage

Pour 10⁶ écritures par mois, 3 abonnements actifs, 500 tables par base et une ligne métier moyenne de 1 Kio : `change_event` pèse ≈ 600 Mio en régime permanent (2,5 Gio/mois, rétention 7 jours) ; `webhook_delivery` ≈ 2,7 Gio (3 × 10⁶ lignes/mois × ≈ 300 octets de référence × 3 mois) ; un document OpenAPI de 500 tables × 20 champs ≈ 6 Mio, ce qui rend `?tables=` obligatoire (§9.2) ; le cache de catalogue ≈ 10 Mio par base, borné par un LRU ; et 100 requêtes HTTP/s avec T = 3 produisent 400 requêtes SQL/s, ramenées à 100 avec `links=id`.

Ces chiffres justifient trois décisions prises plus haut : le corps des événements n'est stocké qu'une fois, le cache des documents de `/meta/*` est borné et le document filtrable, et `links=id` est recommandé aux intégrations.

---

## 17. Tests exigés

### 17.1 Non-régression de sécurité

1. **Marque de prédicat.** Toute instruction émise sur le pool `donnees` est interceptée en test et doit contenir le marqueur `/*predicat_lignes:<table>*/` pour chaque table qu'elle nomme ; sinon la suite échoue. Couvre la requête principale, les `EXISTS`, les requêtes de lot, les comptages inverses, les jointures de tri, les décomptes de cascade et les `EXPLAIN`. Le test est écrivable parce que A20 fait exister le prédicat dans la signature.
2. **Champ masqué indistinguable d'un champ inexistant.** Pour chaque champ masqué, un filtre, un tri, une expansion et une projection le nommant doivent renvoyer **exactement** la réponse obtenue avec un nom de champ inventé : même code, même corps, mêmes en-têtes.
3. **Colonnes système toujours lisibles.** Un rôle ayant un champ masqué lit `_id`, `_created_at`, `_updated_at`, `_created_by`, `_updated_by`, trie et filtre dessus, et mène une reprise incrémentale complète (§6.5).
4. **Égalité des trois sérialisations.** Pour chaque rôle d'essai, l'ensemble (tables, champs, cibles de lien) décrit par `/meta/bases/{base}`, par `openapi.json` et par `/doc` est rigoureusement égal. Tout écart fait échouer la suite. La documentation lisible doit en particulier décrire chaque relation visible.
5. **Conformité des lignes au schéma.** Pour chaque table de la base de démonstration, une ligne réellement lue par l'API est validée contre le schéma généré, nombres en chaîne compris.
6. **Corpus SQLSTATE et libellé hostile.** Un corpus d'erreurs rejouées (23503, 23505, 23502, 23514, 22001, 42703, 42P01, 53300, 57014) ne doit jamais faire apparaître une chaîne présente dans `pg_class`/`pg_constraint` et absente des noms logiques visibles ; un libellé contenant du HTML et du Markdown, relu via OpenAPI, `/meta`, `/doc` et un message d'erreur, doit ressortir neutralisé.
7. **Invariance de l'`ETag`.** Une écriture portant uniquement sur un champ masqué ne change ni l'`ETag` servi au lecteur restreint, ni le résultat de son `If-Match`.
8. **Indiscernabilité temporelle.** La distribution des durées de réponse des `404` d'absence et des `404` d'invisibilité est statistiquement indistinguable.
9. **Non-élévation.** Un acteur ne peut créer ni jeton ni webhook portant un rôle dont les permissions ne sont pas incluses dans les siennes ; la vérification est rejouée après réduction des droits du créateur.
10. **Lien masqué.** Pour une table cible non lisible, la réponse porte exactement `{"id":null,"display":null,"masked":true}` dans `/data/*`, dans un webhook, dans une entrée d'historique et dans la description OpenAPI ; aucun `uuid` de cible n'apparaît nulle part.

### 17.2 Comportement sous panne

11. **Arrêt brutal entre le `COMMIT` et l'émission** : l'événement doit être présent dans le tampon de capture au redémarrage, drainé sans doublon, et livré.
12. **Consommateur fautif** : lenteur, `5xx`, `429` avec `Retry-After`, coupure en cours de corps, `413`, certificat invalide, redirection — chacun avec le comportement attendu du §10.7.
13. **FIFO par enregistrement** : deux événements du même enregistrement, le premier en échec ; le second ne doit pas partir avant lui.
14. **Filtre d'adresses** : `[::ffff:127.0.0.1]`, `0.0.0.0`, `169.254.169.254`, un nom résolvant vers plusieurs adresses dont une privée, une URL avec `userinfo` — tous refusés.
15. **Masque incomplet** : un champ ajouté à une table abonnée sans être accordé au rôle du webhook doit désactiver l'abonnement avec `disabled_reason = 'field_masked'` avant toute livraison ; aucune charge utile incomplète ne doit être émise.
16. **Cascade** : la suppression d'une ligne racine par `DELETE` unique doit produire un événement `record.deleted` par ligne réellement supprimée, toutes portant `cause.kind = "cascade"` et le même `bulk_id` ; le même `DELETE` exécuté en psql doit produire les mêmes événements.
17. **Idempotence concurrente** : deux requêtes simultanées de même clé produisent une création et un `409 IDEMPOTENCY_IN_PROGRESS` ; après expiration du bail, la présence d'une révision portant le `bulk_id` doit produire `IDEMPOTENCY_INTERRUPTED` et non une seconde création.
18. **`_basedb` indisponible** : les écritures de données continuent, `/admin/*`, `/history` et `/deleted` répondent `503`, et rien n'est perdu au rétablissement.
19. **Restauration** : aucune livraison antérieure au point de restauration n'est émise ; un curseur antérieur est refusé si la clé d'instance a changé.

### 17.3 Performance et déterminisme

20. **Jeu de données à 10⁶ lignes** : la page 1 et la page 10 000 doivent avoir des temps comparables (§6.3), dans les deux sens de tri et avec des valeurs nulles dans la clé.
21. **Requêtes SQL par requête HTTP** : mesurées et comparées à `1 + T`, avec et sans `links=id`.
22. **Non-régression des plans** : un basculement de parcours d'index vers balayage séquentiel sur une requête type fait échouer la suite.
23. **Lot non atomique** : 1 000 opérations ne doivent produire aucune sous-transaction.

---

## 18. Codes d'erreur définis par ce chapitre

Ces codes sont en anglais et en majuscules ASCII (A2), à raison d'un par condition, et versés au registre unique `_basedb.error_code` (A23). Les codes définis par un autre chapitre sont référencés, jamais redéfinis ni renommés : `AUTHENTICATION_REQUIRED`, `TOKEN_INVALID`, `RESOURCE_NOT_FOUND`, `ACTION_FORBIDDEN`, `CONFLICT` et `WEBHOOK_MASK_INCOMPLETE` appartiennent au chapitre 05 et ne sont rappelés ci-dessous que pour donner la surface HTTP complète.

| Code | Déclencheur | HTTP |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | Authentification absente, ou porteur refusé par la route | `401` |
| `TOKEN_INVALID` | Jeton inconnu, ou présenté hors de ses surfaces autorisées | `401` |
| `TOKEN_EXPIRED` | Jeton connu, date d'expiration dépassée | `401` |
| `TOKEN_REVOKED` | Jeton connu, révoqué ; la session MCP est close | `401` |
| `RESOURCE_NOT_FOUND` | Ressource inexistante **ou** invisible | `404` |
| `ACTION_FORBIDDEN` | Ressource visible, action refusée | `403` |
| `ROLE_NOT_DELEGABLE` | Rôle demandé non inclus dans les droits de l'appelant | `403` |
| `REQUEST_INVALID` | Corps, paramètre, bornes d'entrée | `400` |
| `CONTENT_TYPE_INVALID` | Corps non `application/json` | `415` |
| `BODY_TOO_LARGE`, `BATCH_TOO_LARGE` | Bornes d'entrée (§3.6) | `413` |
| `VALIDATION_FAILED`, `REQUIRED_FIELD_MISSING` | Validation métier | `422` |
| `DUPLICATE_VALUE` | Unicité violée, **si `read` sur la table** et champ lisible ; `CONFLICT` anonyme si le champ est masqué, `VALIDATION_FAILED` sans droit de lecture (§7.4) | `409` |
| `LINK_TARGET_NOT_FOUND` | Identifiant de lien inexistant **ou** invisible | `409` |
| `ROW_REFERENCED` | Suppression refusée par la clause `NO ACTION` (A13) | `409` |
| `CASCADE_CONFIRMATION_REQUIRED` | En-tête de confirmation absent ou divergent | `409` |
| `CASCADE_TOO_LARGE` | Décompte de cascade supérieur à 5 000 lignes | `409` |
| `CASCADE_TOO_DEEP` | Cycle détecté ou profondeur supérieure à 5 au décompte | `409` |
| `BATCH_CASCADE_FORBIDDEN` | `delete` déclenchant une cascade dans un lot | `422` |
| `VERSION_CONFLICT` | `If-Match` divergent | `412` |
| `WRITE_CONFLICT` | Sérialisation ou interblocage après réessai | `409` |
| `IDEMPOTENCY_CONFLICT` | Même clé, corps différent | `409` |
| `IDEMPOTENCY_IN_PROGRESS` | Même clé, revendication sous bail valide | `409` |
| `IDEMPOTENCY_INTERRUPTED` | Bail expiré, écriture métier partiellement constatée | `409` |
| `IDEMPOTENCY_STALE` | `authz_version` modifiée depuis la réponse mémorisée | `409` |
| `FILTER_TOO_LONG`, `FILTER_TOO_COMPLEX`, `FILTER_FIELD_UNKNOWN`, `FILTER_OPERATOR_INVALID`, `FILTER_VALUE_INVALID`, `FILTER_DISPLAY_UNAVAILABLE` | Analyse du filtre | `400` |
| `EXPAND_TOO_DEEP`, `EXPAND_TOO_WIDE` | Expansion | `400` |
| `SORT_UNAVAILABLE`, `SORT_FIELD_UNKNOWN` | Tri | `400` |
| `CURSOR_INVALID` | Déchiffrement, acteur, ou requête divergente | `400` |
| `CURSOR_STALE` | Structure de tri ou de filtre modifiée | `409` |
| `RESUME_BEYOND_HORIZON` | `since` antérieur à la rétention de l'historique | `409` |
| `RATE_LIMIT_EXCEEDED` | Seau à jetons | `429` |
| `CONCURRENCY_LIMIT_EXCEEDED` | Requêtes simultanées | `429` |
| `QUERY_TOO_EXPENSIVE` | Budget de complexité ou plan estimé | `400` |
| `WEBHOOK_MASK_INCOMPLETE` | Rôle d'un webhook sans masque de lecture complet (A19) | `422` |
| `WEBHOOK_TARGET_REJECTED` | URL de livraison refusée par le filtre d'adresses | — (état de livraison) |
| `TABLE_MIGRATING` | Étape de migration exclusive en cours sur la table | `503` |
| `CATALOG_DRIFT_DETECTED` | SQLSTATE de structure inattendu, écart de réconciliation | `503` |
| `SERVICE_UNAVAILABLE` | `_basedb` injoignable, ressources épuisées | `503` |
| `TIMEOUT_EXCEEDED` | Budget de délai épuisé | `504` |

`FILTER_FIELD_UNKNOWN` et `SORT_FIELD_UNKNOWN` recouvrent **volontairement** deux causes — champ inexistant et champ non lisible — et ne doivent jamais être scindés.

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Chemins par nom logique, `uuid` accepté partout | Lisibilité quotidienne d'un intégrateur ; l'`uuid` couvre la survie au renommage | Chemins par `uuid` seul |
| Tenant dans le chemin dès la v1 | Aucune URL à réécrire chez les consommateurs plus tard | Tenant déduit du jeton |
| `manage_tokens` pour jetons **et** webhooks | Deux formes d'une même chose : ouvrir une porte avec les droits d'un rôle ; aucun huitième verbe à créer | Un droit d'instance dédié |
| Alias servi de façon transparente en `200` | Un `308` n'est pas suivi par les clients d'écriture ; une redirection au routage révèle le renommage | `308 Permanent Redirect` |
| Session jamais authentifiée par cookie sur `/api/v1` | Supprime la classe CSRF ; CORS ne protège pas l'émission | Cookie + jeton anti-CSRF seul |
| Quadruplet de droits non nullable en entrée du constructeur SQL, prédicat de lignes émis même constant | Le point d'application unique doit être structurel ; le marqueur rend le test écrivable (A20) | Convention de revue |
| Champ non lisible = champ inexistant pour `filter`/`sort`/`expand` | Sans quoi le masquage est décoratif et la valeur se lit par dichotomie | Masquage par la seule projection |
| Colonnes système toujours lisibles (A18) | Une reprise incrémentale impossible pour tout rôle à champ masqué coûte plus cher que l'oracle résiduel | Les soumettre aux permissions de champ |
| `ETag` = empreinte de la projection visible | Aucune valeur observable ne varie du fait d'un champ invisible | `ETag` dérivé de `_updated_at` |
| Idempotence unique, dans `_basedb.idempotency_key`, revendiquée avant le travail | Une table système dans un schéma `b_*` serait une dérive ; un enregistrement écrit après le `COMMIT` ne protège de rien | Table `_idempotency` dans le schéma de données |
| Opérateurs de filtre repris du récapitulatif de « Types de champs », négation par `not` | Un seul jeu d'identifiants pour l'API, le MCP et OpenAPI | Vocabulaire propre à la surface HTTP |
| Nombres sérialisés en chaîne décimale, sans seuil | `JSON.parse` détruit silencieusement au-delà de 2⁵³ ; une règle conditionnelle donne deux représentations d'une même donnée | Nombre JSON natif sous un seuil de précision |
| Ordre des nuls de PostgreSQL, prédicat de curseur en deux branches | Seule convention qu'un index `(colonne, _id)` sert dans les deux sens | `NULLS LAST` forcé |
| Lot non atomique découpé en tranches de 50 transactions | 1 000 `SAVEPOINT` font basculer l'instance en « suboverflowed » | Un `SAVEPOINT` par opération |
| `EXISTS` corrélé pour les filtres de lien, avec prédicat de la cible | La jointure duplique les lignes et fausse `or` ; le prédicat ferme l'oracle par dichotomie | Jointure |
| Curseur chiffré (AEAD), format figé, clé lue dans `BASEDB_ENCRYPTION_KEY` | Un HMAC n'apporte pas la confidentialité ; une clé en base tombe avec la sauvegarde | Curseur signé, clé stockée en base |
| Pas d'`offset`, jamais | Seule garantie du coût constant au-delà de 100 000 lignes | `offset` plafonné |
| Aucun point d'entrée d'export (A21) | Un flux illimité percerait le plafond que toutes les autres règles construisent | Export NDJSON |
| `included` dédupliqué, hors de la ligne | Déduplication, schéma stable, séparation des jeux de droits | Imbrication in situ |
| `?links=id\|display` | Supprime le facteur `1 + T` imposé à toutes les intégrations | Résolution systématique |
| Forme unique `{id:null, display:null, masked:true}` (A16) | Un UUIDv7 révèle l'instant et le rang de création ; un second espace d'identifiants n'existe nulle part | Exposer l'identifiant, ou une valeur opaque |
| Liens inverses par sous-chemin, 20 groupes, `count` plafonné à 500, aperçu de 3 | Cardinalité non bornée ; un seul bornage partagé avec la sémantique | `expand` inverse, ou deux bornages juxtaposés |
| Estimation de volumétrie après prédicat de lignes | `reltuples` est la volumétrie physique, hors droits | `reltuples` direct |
| Cascade exécutée par PostgreSQL (A14), décompte et confirmation conservés | Une écriture SQL directe doit cascader comme l'API ; la capture par déclencheur voit les lignes cascadées | Cascade applicative niveau par niveau |
| Masque de lecture complet exigé pour un webhook (A19) | Un consommateur qui reçoit une ligne incomplète sans le savoir est pire qu'un consommateur désactivé | Charge utile projetée par le rôle |
| Événement jamais tronqué, corps groupé plafonné | Tronquer un champ contredit la charge utile complète aussi sûrement qu'un masque | Troncature au-delà de 64 Kio |
| Corps d'événement stocké une seule fois dans `change_event` | Évite la duplication par abonné et les gigaoctets dans le catalogue | Corps recopié par livraison |
| FIFO strict par `(webhook, table, record_id)` avec garde `NOT EXISTS` | `SKIP LOCKED` seul viole l'ordre entre deux tentatives | `SKIP LOCKED` seul |
| Resynchronisation explicite plutôt que rejeu partiel | Rejouer 100 livraisons sur 8 000 laisse un miroir faux en silence | Rejeu des 100 dernières |
| Filtrage SSRF par autorisation des adresses routables | Toute liste d'interdiction est incomplète (IPv4 mappée, CGNAT, NAT64) | Liste de plages interdites |
| `/admin/*` interdit aux jetons, non-élévation revérifiée à chaque usage | Empêche l'escalade verticale et la persistance d'un jeton compromis | Vérification à la seule création |
| Débit compté en opérations, seaux en mémoire calibrés, affinité d'acteur au répartiteur (A4) | Aucun magasin externe ; un compteur en base serait une ligne chaude dans l'autre pool | Redis, ou compteur en base |
| `SET LOCAL` + budget de délai par requête HTTP | Un réglage de session survit dans le pool et se perd derrière un mutualiseur | `statement_timeout` de session |
| Trois sérialisations d'une projection unique, documentation lisible comprise | Une route voisine non filtrée annule tout le filtrage ; la doc est juste par construction | Documentation rédigée à part |
| Assainissement HTML à l'écriture + contrat de rendu | Le coût à la lecture est payé sur chaque requête pour un défaut qui se corrige une fois | Réassainir chaque réponse |

## Risques et limites connues

1. **Fuite d'un bit par ligne sur `has_hidden_references`** (§8.2) : énumérable ligne par ligne par un utilisateur ayant `delete` sur la table parente. Bornée (jamais en lot), comptée et alertée, mais réelle.
2. **Identifiant d'une ligne cible invisible sur une table par ailleurs lisible** (§5.5) : l'UUIDv7 révèle l'instant de création à la milliseconde et le rang de création. Assumé ; fermer ce canal exigerait des identifiants opaques non ordonnés, décision qui n'appartient pas à ce chapitre.
3. **`_updated_at` est un oracle de modification** (§4.3) : un rôle à champs masqués sait qu'une ligne a changé, sans savoir en quoi. C'est la contrepartie assumée de A18, et le prix d'une reprise incrémentale ouverte à tous les rôles.
4. **Blocage de tête par enregistrement** dans la file de webhooks (§10.6) : un événement en échec retarde les suivants du même enregistrement jusqu'à 24 h, et leurs valeurs `display` vieillissent.
5. **Un webhook est désactivé par un simple ajout de champ** (§10.3) : créer un champ sur une table abonnée sans l'accorder au rôle du webhook suspend la livraison jusqu'à correction. C'est le comportement voulu, mais il est surprenant et doit être signalé dans l'éditeur de schéma.
6. **Tri sur un champ lien non stable** (§6.1) : si la valeur d'affichage change entre deux pages, une ligne peut être vue deux fois ou manquée. Aucun curseur ne corrige un tri sur une donnée mutable d'une autre table.
7. **Décompte de cascade approximatif sous concurrence** (§8.3) : des lignes insérées entre le décompte et le `DELETE` sont supprimées sans avoir été comptées. L'audit et les événements portent le nombre réel.
8. **Événements de structure absents en v1** (§10.2), et **livraison asynchrone** (§10.1) : l'audit, l'historique et les livraisons accusent un retard de l'ordre de la seconde après le `COMMIT`.
9. **`change_event` contient des données métier en clair** : une donnée personnelle supprimée de la table métier y survit jusqu'à 7 jours, y compris les lignes détruites par cascade dont la valeur avant est le dernier exemplaire existant. Le chiffrement au repos de l'instance est la seule protection à ce niveau.
10. **La limitation de débit est approximative avec plusieurs instances** (§13.1, A4) : correcte à un facteur près du nombre de processus sans affinité de répartition, et perturbée quelques minutes à chaque redéploiement. Le garde-fou de coût, lui, dépend des statistiques : un refus `QUERY_TOO_EXPENSIVE` peut apparaître ou disparaître après un `ANALYZE`.
11. **Le HTML riche est servi non réassaini** (§7.6) : la sécurité du rendu repose sur le contrat côté consommateur.
12. **La fenêtre d'idempotence n'est pas transactionnelle** (§3.3) : la revendication et l'écriture métier vivent sur deux pools. Le `bulk_id` reporté par la capture permet de constater l'état réel après expiration du bail, mais la réponse exacte de la requête interrompue n'est pas reconstituable.

## Questions ouvertes

1. **Événements de structure** (`schema.changed`) : reportés à une version ultérieure ; à confirmer qu'aucun consommateur de la première tranche n'en a besoin, et à spécifier alors l'ordre garanti vis-à-vis des événements de données.
2. **Forme de service de la documentation lisible** (§9.4) : elle est servie en JSON structuré, l'interface se chargeant du rendu. Faut-il en outre une sortie HTML statique téléchargeable, avec le risque qu'une copie conservée hors ligne devienne fausse et qu'elle porte les droits du téléchargeur sans le dire ?

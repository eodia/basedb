# 05 — Modèle de permissions

## Rôle de ce chapitre

Ce chapitre définit **qui a le droit de faire quoi**, comment cette question reçoit une réponse, et par quel mécanisme aucune surface du produit ne peut y échapper. Il s'appuie littéralement sur les tables `_basedb.app_user`, `_basedb.session`, `_basedb.confirmation_challenge`, `_basedb.role`, `_basedb.role_member`, `_basedb.permission`, `_basedb.field_permission`, `_basedb.api_token`, `_basedb.webhook`, `_basedb.application`, `_basedb.application_table`, `_basedb.view_def`, `_basedb.table_constraint`, `_basedb.table_constraint_member`, `_basedb.field_formula_dependency`, `_basedb.field_link_config`, `_basedb.cascade_grant`, `_basedb.secret`, `_basedb.setting` et `_basedb.audit_log`, dont le DDL est donné par « 02 — Schéma du catalogue `_basedb` », qui fait autorité sur le catalogue. Il n'en suppose aucune autre.

Le contexte d'exécution impose une contrainte qu'il faut regarder en face : **toutes les requêtes du produit passent par un rôle PostgreSQL unique, propriétaire de la base.** PostgreSQL n'offre donc aucune seconde ligne de défense — ni `GRANT` par utilisateur, ni RLS exploitable, le propriétaire la contournant. La sécurité d'accès des surfaces est intégralement applicative. C'est pourquoi ce chapitre consacre l'essentiel de son propos non pas au modèle — qui est simple — mais aux conditions qui rendent son contournement détectable ou impossible.

Une exception, et une seule surface : le **SQL écrit dans l'interface** (§9). La console de qui gère une base tourne sur un rôle restreint à son schéma ; le SQL de tout autre lecteur, sur un rôle PostgreSQL propre à la personne, dont les `GRANT` colonne par colonne sont le verdict du décideur — là, et là seulement, PostgreSQL tient une seconde ligne.

---

## 0. Frontière du modèle

Le RBAC décrit ici gouverne **les surfaces du produit** : interface, API REST, serveur MCP, émission de webhooks, appels aux fournisseurs d'IA. Il ne gouverne pas un accès SQL direct à la base.

Ce n'est pas une faille, c'est le cadrage : les données vivent dans de vraies tables PostgreSQL exploitables directement en SQL. Quiconque ouvre une session `psql` sur la base d'accueil lit tout, y compris les colonnes masquées par `field_permission`, sans jamais traverser le point d'application. Les schémas d'alias de compatibilité créés au renommage physique — voir « 06 — Cycle de vie » — s'adressent précisément à ces consommateurs et ne sont pas davantage gouvernés par le masque de champs.

Trois conséquences opposables :

1. Les droits d'un consommateur SQL direct sont des `GRANT` PostgreSQL posés par l'exploitant sur les schémas `b_<tenantId>_<base>`, **hors périmètre v1**. Le produit ne les pose pas et ne s'y fie pas.
2. **Une restriction au niveau champ protège contre les surfaces du produit, jamais contre quiconque détient un accès SQL à la base.** L'éditeur de permissions affiche cette phrase, textuellement, dans l'écran de masquage d'un champ.
3. Partout où ce document écrit « aucun accès ne peut y échapper », il faut lire « **aucun accès par une surface du produit** ». Aucune formulation plus large n'est tenable.

---

## 1. Sujets, verbes, portées, rôles

### 1.1 Les trois sujets, et les porteurs d'autorité

| Sujet | `audit_log.actor_kind` | Identité | Rôles |
|---|---|---|---|
| Utilisateur | `user` | `app_user.id`, via `_basedb.session` (§2.1) | `role_member` |
| Jeton d'intégration | `token` | `api_token.id`, via en-tête `Authorization` | un rôle unique (`api_token.role_id`), borné par son créateur (§2.3) |
| Processus interne | `system` | aucune identité extérieure | aucun rôle : contexte nommé, borné à un tenant (§6.4) |

**Le serveur MCP n'est pas un sujet.** Il ne possède ni identité ni droits propres : une session MCP porte une session utilisateur ou un jeton, et agit avec les droits du sujet porté. Le MCP est une *surface*, au même titre que l'API REST — il est journalisé avec `audit_log.surface = 'mcp'` et l'`actor_kind` du sujet porté. La valeur `mcp` de `actor_kind`, prévue par le catalogue, n'est émise par aucun chemin de la v1. Cela évite un compte de service invisible dans le tableau des permissions, et fait que révoquer l'utilisateur révoque son accès MCP.

**L'IA n'est pas un sujet non plus, mais elle est porteuse de l'autorité d'un sujet.** Une requête adressée à un fournisseur lit les données *à travers la décision de l'utilisateur*, en amont de l'appel au modèle ; le modèle n'accède jamais à la base, et une injection de prompt n'élève donc aucun privilège de son côté. **Ce n'est pas le risque.** Le risque est le député confus : un agent qui agit avec l'autorité de l'utilisateur sans son intention. Trois règles en découlent, opposables au serveur MCP comme à l'assistant intégré à l'interface :

1. **Toute donnée lue via une surface d'agent est non fiable.** Une valeur de cellule, un libellé de champ, un nom de table peuvent contenir des instructions ; ils ne sont jamais interprétés comme telles par le noyau, qui ne reçoit de l'agent que des appels d'outils typés.
2. **Aucune écriture privilégiée n'est réalisable depuis une surface d'agent** : le filtre de surface (§1.2) retire les verbes concernés, et les opérations réservées exigent un jeton de confirmation qu'un agent ne peut pas fabriquer (§2.2).
3. **Les portées utilisables par un agent sont celles que l'humain a explicitement désignées à l'ouverture de session** (base, ou liste de tables) ; hors de ces portées, la décision vaut `INVISIBLE` même si le sujet porté détient le droit. Le contrat d'ouverture de session relève de « 09 — Serveur MCP » ; l'exigence est posée ici.

### 1.2 La surface restreint, elle n'accorde jamais

Après la décision, un filtre soustractif dépendant de la surface est appliqué :

| Surface (`audit_log.surface`) | Verbes et opérations retirés |
|---|---|
| `ui`, `rest` | aucun |
| `mcp` | `delete`, `manage_permissions`, `manage_tokens` ; `manage_schema` dégradé en **proposition de migration** ; **approbation d'une migration**, **délivrance et usage d'un jeton de confirmation**, et toute opération réservée (§1.5) |
| `webhook` (émission) | tout sauf `read` |
| `system` | aucun verbe retiré, mais le contexte est nommé, borné à un tenant et à une liste blanche de tâches (§6.4) |

Un jeton ne joint que les surfaces énumérées par `api_token.allowed_surfaces` (`rest`, `mcp`) ; une présentation sur une autre surface est traitée comme un jeton inconnu : `TOKEN_INVALID` (401).

C'est la traduction formelle de « le MCP passe par la même couche de permissions » et de « opérations destructrices exclues ou soumises à confirmation humaine » : une seule règle de composition, pas un contrôle particulier dans le serveur MCP. En particulier, une session MCP ne peut **jamais** approuver la migration qu'elle vient de proposer : le double temps proposition → relecture humaine est structurel, pas déclaratif.

### 1.3 Les verbes : liste fermée

La v1 s'en tient strictement aux sept actions du `CHECK` de `_basedb.permission`. Aucun verbe n'est ajouté, et aucun droit d'instance nommé ne vient s'y greffer ; tout le reste est obtenu par la combinaison **verbe × portée**.

| Verbe | Sur une table | Sur une base | Sur un tenant |
|---|---|---|---|
| `read` | lire les enregistrements et le schéma de la table | idem pour toutes ses tables | idem pour toutes ses bases |
| `create` | insérer un enregistrement | idem | idem |
| `update` | modifier un enregistrement | idem | idem |
| `delete` | supprimer un enregistrement | idem | idem |
| `manage_schema` | modifier la table et ses champs ; **créer une table** si accordé à la base | + créer et supprimer logiquement tables, applications et vues enregistrées | + **créer une base** |
| `manage_permissions` | — (sans objet) | gérer et **consulter** rôles et permissions de portée ≤ base | + gérer les utilisateurs du tenant |
| `manage_tokens` | — | jetons et webhooks portant sur cette base | jetons de portée tenant |

L'administration des intégrations — jetons, webhooks — est `manage_tokens` ; l'administration d'un tenant est l'appartenance au rôle système `tenant_admin` (§1.5). Aucune autre nomenclature n'existe.

### 1.4 Les portées

`instance ⊃ tenant ⊃ base ⊃ {application, table} ⊃ champ`

- **instance** : hors RBAC, portée par `app_user.is_instance_admin`. Objets d'instance, identifiés au catalogue par `tenant_id IS NULL` : réglages d'instance, modèle et clés d'IA par défaut, migrations du catalogue, création de tenants.
- **tenant, base, application, table** : les quatre valeurs de `permission.scope_kind`, matérialisées par `scope_base_id`, `scope_application_id` et `scope_table_id`.
- **champ** : `field_permission`, qui n'accorde rien et ne fait que restreindre (§4).

Une autorisation accordée à une portée s'applique à tous ses descendants. Une table appartenant à plusieurs applications est couverte par une autorisation sur **chacune** d'elles. L'appartenance est évaluée à la décision, pas figée : ajouter une table à une application accorde immédiatement l'accès à ceux qui ont un droit sur l'application — l'écran d'édition d'application le dit explicitement avant validation.

### 1.5 Rôles, modèles de rôle, opérations réservées

`role_member` ne porte pas de portée : **un rôle est un paquet nommé de couples (portée, action)**. Il s'ensuit que « Éditeur » n'est pas un rôle réutilisable tel quel, mais un **modèle** que l'écran de partage matérialise en un rôle réel portant les lignes `permission` à la portée choisie, nommé `<modele>_<nom de la portée>` (`editor_ventes`), avec `is_system = false`.

| Modèle | `read` | `create` | `update` | `delete` | `manage_schema` | `manage_permissions` | `manage_tokens` | Réservées |
|---|---|---|---|---|---|---|---|---|
| `tenant_admin` *(système, portée tenant, un par tenant)* | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `builder` (Concepteur) | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — |
| `editor` (Éditeur) | ✔ | ✔ | ✔ | ✔ | — | — | — | — |
| `contributor` (Contributeur) | ✔ | ✔ | ✔ | — | — | — | — | — |
| `reader` (Lecteur) | ✔ | — | — | — | — | — | — | — |

**Les rôles personnalisés existent en v1** : un rôle personnalisé n'est qu'un jeu de lignes `permission` différent. Ce qui n'existe pas en v1, c'est la création d'un **verbe**. Seul `tenant_admin` porte `is_system = true` ; son appartenance n'est modifiable que par un membre de `tenant_admin` ou un administrateur d'instance — `manage_permissions` ne suffit jamais à s'y ajouter.

**Les opérations réservées** ne sont pas des verbes. Leur prédicat est `is_instance_admin = true` OU appartenance au rôle système `tenant_admin` du tenant propriétaire, et elles exigent toutes une élévation temporaire (§2.2). Elles ne peuvent donc pas être déléguées par erreur via `manage_permissions`. La liste close en v1 :

- renommage physique d'une base, d'une table ou d'un champ ;
- purge d'un objet en suppression logique ;
- concession d'un `ON DELETE CASCADE` sur un champ lien (§5.7) ;
- suppression d'un tenant ;
- surcharge du modèle d'IA et de la clé de fournisseur au niveau tenant (§8) ;
- consultation de `audit_log` et de l'historique brut (§8, §10).

*Alternative écartée* : ajouter des verbes `purge`, `rename_physical`, `cascade` — plus explicite, mais cela rend délégable ce qui doit rester exceptionnel, et impose de modifier le `CHECK` du catalogue.

**Règle de non-escalade, sans exception :** un acteur ne peut accorder que des permissions qu'il détient lui-même, à une portée qu'il couvre. Elle s'applique à `role_member`, à `permission`, à `field_permission`, à `api_token.role_id` et à `webhook.role_id`. Refus `PRIVILEGE_ESCALATION`.

---

## 2. Porteurs d'autorité : session, élévation, jeton

### 2.1 La session utilisateur

L'authentification, le transport du cookie, l'échange contre un jeton d'accès court et le cycle de vie complet de `_basedb.session` appartiennent à « 13 — Authentification ». Ce chapitre n'en retient que ce dont la décision dépend, et qui lui est opposable :

| Propriété | Décision |
|---|---|
| Tenant | `session.tenant_id` est **figé à la création**, recopié depuis `app_user.tenant_id`. Un utilisateur appartient à exactement un tenant ; il n'existe ni sélecteur ni bascule (§13). La clé étrangère composite du catalogue rend une session hors tenant impossible. |
| Validité | `revoked_at IS NULL` et `absolute_expires_at > maintenant`, comparés à l'horloge du serveur **à chaque décision** (§11). |
| Élévation | `session.elevated_until > maintenant` (§2.2). |
| Appels de données | Le cookie de session n'est accepté que par les routes d'authentification ; les surfaces `ui` et `rest` portent un jeton d'accès court en `Authorization`. Le cookie est `HttpOnly`, `Secure`, `SameSite=Strict`, et la protection contre les requêtes forgées est portée par le noyau, jamais par l'interface. Refus `ORIGIN_REJECTED` (403). Les modalités exactes relèvent de « 08 — API REST, OpenAPI, webhooks, jetons d'intégration » et de « 13 — Authentification ». |
| Appels depuis l'application elle-même | Aucun attribut de cookie ne protège d'une charge exécutée *dans* l'application. C'est la raison d'être de §2.2. |

### 2.2 Élévation temporaire et jeton de confirmation

Une session valide ne suffit pas à tout. Les opérations suivantes exigent `session.elevated_until > maintenant`, état obtenu par une ré-authentification valable **5 minutes** et vérifié **par le point d'application**, jamais par l'interface :

- toute écriture sur `role`, `role_member`, `permission`, `field_permission` ;
- création, modification et révocation d'un `api_token` ;
- création et modification d'un `webhook` ;
- toute opération réservée (§1.5).

Pour les opérations réservées, l'élévation ne suffit pas non plus : un **jeton de confirmation** est requis, opaque, à usage unique, valable 5 minutes, lié à l'acteur, à l'objet visé et à la nature de l'opération, matérialisé par une ligne `_basedb.confirmation_challenge` (`actor_user_id`, `session_id`, `operation`, `target_kind`, `target_id`, `challenge_hash`, `expires_at`, `consumed_at`). Il est délivré **uniquement** aux surfaces `ui` et `rest` sur une session élevée (§1.2) : c'est la seule chose qu'un agent ne peut pas fabriquer, et c'est ce qui rend « soumis à confirmation humaine » vérifiable plutôt que déclaratif.

Raison d'être : le cadrage prévoit un texte long « HTML riche assaini côté serveur », et un assainisseur finit toujours par céder. Sans élévation, une seule ouverture de fiche par un `tenant_admin` suffirait à ce qu'une charge déposée par un `contributor` s'ajoute à un rôle puissant puis fabrique un jeton ; avec elle, la charge obtient `ELEVATION_REQUIRED` (403) et l'incident est journalisé.

**Notification.** Tout changement d'appartenance à un rôle, toute création de jeton et toute modification de webhook déclenchent une notification au sujet concerné et à tous les `tenant_admin` du tenant, plus une entrée `audit_log` dédiée. Une escalade réussie doit être bruyante.

### 2.3 Les jetons d'intégration

| Règle | Décision |
|---|---|
| Rôle | Exactement un (`api_token.role_id`), du même tenant par contrainte de catalogue, soumis à la non-escalade : à la création comme à toute modification, l'ensemble des couples (portée, action) du rôle visé doit être inclus dans les capacités effectives du créateur, sinon `PRIVILEGE_ESCALATION`. |
| Bornage permanent | `capacites(jeton) = capacites(api_token.role_id) ∩ capacites(api_token.created_by)`, **recalculée à chaque décision**. Un jeton dont le créateur est désactivé, retiré d'un rôle ou sorti du tenant devient inerte sans action sur le jeton. C'est ce qui ferme l'élargissement différé : ajouter une ligne `permission` au rôle porté n'élargit le jeton que dans la limite des droits de son porteur. |
| Verbes interdits | Un rôle porté par un jeton ne peut contenir ni `manage_schema`, ni `manage_permissions`, ni `manage_tokens`. Refus `TOKEN_PRIVILEGE_REFUSED`. Sans cette règle, un jeton fuité dans un dépôt Git ou un journal d'automatisation vaudrait un compte concepteur, hors de tout écran de confirmation. |
| `delete` | **Autorisé**, s'il figure explicitement dans le rôle. L'interdire pousserait les intégrateurs vers un compte utilisateur partagé, qui est pire. |
| Portée | `api_token.tenant_id` obligatoire ; `api_token.base_id` facultatif — s'il est renseigné, toute cible hors de cette base est `INVISIBLE`. |
| Surfaces | `api_token.allowed_surfaces`, sous-ensemble non vide de `{rest, mcp}` (§1.2). |
| Expiration | *Décision révisée* : `expires_at` est **nul par défaut** — le jeton vit jusqu'à sa révocation. Une durée donnée à la création va de 1 à 365 jours, sinon refus `TOKEN_EXPIRY_REQUIRED` ; l'échéance posée est comparée à l'horloge du serveur à chaque décision. Ce qui borne un jeton sans échéance est ailleurs : une seule base, jamais `delete` ni `manage_*`, inerte dès que son créateur est désactivé, dernière utilisation affichée, révocable à tout moment. |
| Secret | Seule l'empreinte `token_hash` est stockée. La valeur en clair n'est affichée qu'une fois, à la création ; `token_prefix` sert à l'identifier ensuite. La comparaison d'empreinte est faite en temps constant. |

---

## 3. Résolution d'une décision

### 3.1 La séquence obligatoire d'une requête

L'ordre suivant est normatif. Il est ce qui rend vraie la règle « absence plutôt qu'erreur » sur les chemins d'écriture, et il est vérifié par le test de §6.2 point 3.

1. **Contrôles indépendants de la cible** : taille maximale du corps, bonne formation du JSON, limitation de débit. Ce sont les seuls contrôles autorisés avant l'étape 3, parce qu'aucun ne dépend de l'existence ni de la forme de la cible.
2. **Authentification** : construction du contexte d'acteur, ou `401`.
3. **Décision** sur la cible (§3.2) → verdict, `champs_lisibles`, `champs_inscriptibles`, `champs_effacables`, `predicat_lignes`.
4. **Réduction de la charge utile au masque**, dans cet ordre : tout champ inconnu du catalogue ou non lisible → `FIELD_UNKNOWN` ; toute valeur strictement identique à la valeur servie en lecture est **élidée** (elle ne produit aucune écriture, donc aucune décision) ; tout champ restant hors de `champs_inscriptibles` → `FIELD_NOT_WRITABLE`, sauf s'il appartient à `champs_effacables` et que la valeur est littéralement `NULL`.
5. **Validation syntaxique et métier** : types, longueurs, obligatoires, formules, formats. Le composant de validation **reçoit la décision en entrée** et n'est jamais monté comme intergiciel en amont du transport.
6. **Exécution** du SQL, colonnes énumérées depuis le masque, `predicat_lignes` émis dans la clause `WHERE`.
7. **Projection de la réponse** avec le masque de lecture, y compris pour les clauses `RETURNING`.

Sans cet ordre, un schéma de validation engendré depuis le catalogue et posé à la lisière du transport transforme toute table invisible en oracle : une création avec un corps vide répondrait « champ requis manquant » là où une table inexistante répond `404`, livrant au passage la liste des champs obligatoires, leurs types et leurs longueurs. Même règle pour le format d'un identifiant dans le chemin : un identifiant mal formé sur une cible invisible répond `RESOURCE_NOT_FOUND`, jamais une erreur de format.

### 3.2 L'algorithme

Entrée : un contexte d'acteur, une action, une cible désignée par sa **clé de catalogue** — la résolution nom → identifiant a déjà eu lieu, en mémoire, et un nom inconnu produit exactement la même réponse qu'une cible invisible (§7.2).

1. Pas de contexte d'acteur → `401`. L'absence d'authentification n'est jamais déguisée en absence de ressource : un client doit pouvoir se reconnecter.
2. **Cloisonnement.** Si la cible porte un `tenant_id` différent de celui du contexte → `INVISIBLE`. Sans exception, y compris pour un administrateur d'instance. Les objets d'instance (`tenant_id IS NULL`) relèvent de l'étape 3.
3. `is_instance_admin` → verdict `AUTORISE`, masque complet, **à l'intérieur du tenant du contexte** ; plus l'accès aux objets d'instance. Les opérations réservées restent soumises à leur élévation et à leur confirmation propres, et la décision est journalisée.
4. **Portée du jeton** : si l'acteur est un jeton avec `api_token.base_id` non nul et que la cible n'appartient pas à cette base → `INVISIBLE`. Jeton inconnu ou présenté sur une surface absente de `allowed_surfaces` → `401 TOKEN_INVALID` ; jeton connu et expiré → `401 TOKEN_EXPIRED` ; jeton connu et révoqué → `401 TOKEN_REVOKED` (§7.1).
5. Collecter les rôles : `role_member` pour un utilisateur ; `api_token.role_id` pour un jeton, intersecté avec les capacités de `api_token.created_by` (§2.3).
6. Pour **chaque rôle** `r`, calculer `capacites(r, cible)` = union des `permission.action` dont la portée couvre la cible.
7. `capacites = ⋃ᵣ capacites(r, cible)`, puis soustraction du filtre de surface (§1.2), puis soustraction des portées non désignées si la surface est un agent (§1.1).
8. Calculer le masque de champs (§4.1) et `predicat_lignes` (§6.1).
9. Verdict : `read ∉ capacites` → `INVISIBLE` ; sinon, si `champs_lisibles` **privé des colonnes système** est vide → `INVISIBLE` ; sinon `action ∉ capacites` → `INTERDIT` ; sinon `AUTORISE`.

Deux invariants portés par cette numérotation :

- **`INTERDIT` n'est jamais renvoyé pour une cible que l'acteur ne peut pas lire** — c'est ce qui rend la règle « absence plutôt qu'erreur » vérifiable en un coup d'œil (§7).
- **Il n'existe aucun chemin qui franchisse une frontière de tenant dans une même décision.** L'administrateur d'instance n'est pas une exception à l'étape 2 : il est un acteur du tenant de son contexte. Sans cette numérotation, la garde d'exécution de §13 refuserait en `TENANT_ISOLATION_VIOLATED` une opération que le décideur vient d'autoriser, et le test de surfaces devrait être écrit avec une exemption qui le viderait de son sens.

Le cas « table visible, aucun champ lisible » est atteignable par des règles de champ couvrant tous les champs, ou par la clôture des formules (§4.1). Le rendre `INVISIBLE` est la seule issue cohérente : à l'inverse, le constructeur SQL devrait émettre une liste de colonnes vide — SQL invalide, donc `500`, donc canal distinct — ou se rabattre sur `*`, c'est-à-dire violer l'invariant de §6.2 ; et une liste de *n* objets vides divulgue la cardinalité et l'activité d'une table qu'on voulait cacher.

### 3.3 Additivité, et le piège qu'elle tend

Le cumul de rôles est une **union**, sans règle `deny`, conformément au catalogue. Deux exemples :

- Alice est `reader_crm` (`read` @ base CRM) et `editor_ventes` (CRUD @ application Ventes). Elle lit toute la base CRM et n'écrit que dans les tables listées dans Ventes. Aucun conflit : les portées se composent.
- Bob est `rh` (`read` @ base, sans règle de champ) et `support` (`read` @ base, avec `field_permission(salaire) = hidden`). **Bob voit `salaire`.** L'union l'emporte.

Ce second cas est le piège, et il est assumé plutôt que corrigé. *Alternative écartée* : « la règle la plus restrictive gagne », qui ferait qu'ajouter un rôle *retire* un accès — comportement non local, impossible à diagnostiquer. La contrepartie est une obligation d'outillage, non négociable : **l'écran des permissions affiche le masque effectif d'un sujet donné sur une table donnée, et signale, pour chaque champ masqué par un rôle, les rôles par lesquels il reste lisible.** Le droit requis pour l'ouvrir est `manage_permissions` sur la portée de la table examinée (§8) : cet écran est l'organigramme des droits, il ne suit pas la visibilité de la table.

### 3.4 Configurations refusées à l'écriture

Certaines combinaisons ne sont pas résolues à la décision : elles sont **interdites au moment où on les enregistre**, ce qui supprime tout un pan de cas limites.

| Configuration | Code |
|---|---|
| `create`, `update` ou `delete` accordé sans `read` à une portée couvrante | `PERMISSION_INCONSISTENT` |
| Rôle porté par un jeton contenant `manage_schema`, `manage_permissions` ou `manage_tokens` | `TOKEN_PRIVILEGE_REFUSED` |
| `api_token` créé avec une durée hors de 1 à 365 jours | `TOKEN_EXPIRY_REQUIRED` |
| `field_permission` sur un champ d'une table hors de la portée du rôle | `PERMISSION_OUT_OF_SCOPE` |
| Accorder plus que ce qu'on détient — `permission`, `role_member`, `api_token.role_id`, `webhook.role_id` | `PRIVILEGE_ESCALATION` |
| Webhook dont le rôle n'a pas un masque de lecture **complet** sur une table abonnée | `WEBHOOK_MASK_INCOMPLETE` |

Le premier point mérite sa justification : une table qu'on peut modifier sans la lire est un oracle d'existence, et l'interface ne sait pas la rendre. *Alternative écartée* : autoriser l'écriture aveugle pour des formulaires publics — reporté en v2, sous la forme d'un mécanisme de soumission publique hors RBAC.

### 3.5 Coût borné d'une décision

Une décision non bornée est à la fois un canal temporel — §7.2 s'appuie sur l'idée que toutes les décisions coûtent pareil — et un levier de déni de service authentifié. Le coût est donc borné par construction :

1. L'instantané d'autorisation d'un sujet (§11) est **aplati à sa construction** : une table associant chaque portée à son ensemble d'actions, et une table associant chaque champ à son niveau, la clôture des formules et des contraintes déjà propagée.
2. Une décision est alors un nombre fixe de consultations : instance, tenant, base, applications contenant la table, table. Aucune récursion, aucune requête.
3. Bornes dures, refusées à l'écriture au-delà : 64 rôles par sujet, 512 lignes `permission` par rôle, 64 applications contenant une même table. La profondeur de dépendance des formules est bornée par « 04 — Types de champs et projection vers PostgreSQL ».
4. **Changement de droits concurrent.** La décision est prise une fois en début de requête et vaut pour toute sa durée. Pour une lecture longue — pagination interne d'une expansion groupée, parcours d'un flux de modifications —, l'instantané est revérifié tous les 10 000 enregistrements : si le masque a rétréci, la réponse est interrompue avec `MASK_REDUCED_MID_READ` (409) plutôt que poursuivie sous un droit révoqué. Une réduction de droits pendant une lecture en cours est donc bornée à 10 000 lignes, et le cas est assumé, pas ignoré.

---

## 4. Restrictions au niveau champ

### 4.1 Calcul du masque

Pour chaque champ `f` et chaque rôle `r` :

- niveau implicite : `write` si `update ∈ capacites(r)`, sinon `read` si `read ∈ capacites(r)`, sinon `hidden` ;
- une ligne `field_permission(r, f)` **remplace** ce niveau implicite pour ce rôle ;
- `niveau(f) = max_r niveau_r(f)` sur l'échelle `hidden < read < write` ;
- **clôture des formules** : si `f` est une formule et qu'une de ses dépendances, directes ou transitives via `_basedb.field_formula_dependency`, vaut `hidden`, alors `niveau(f) := hidden` ;
- **clôture des contraintes croisées** : si `f` participe, via `_basedb.table_constraint_member`, à une contrainte `kind = 'unique'` ou `kind = 'check'` comptant plus d'un membre, et qu'un autre membre vaut `hidden` pour cet acteur, alors `f` est retiré de `champs_inscriptibles`.

`champs_lisibles = {f : niveau ≥ read}` ∪ colonnes système ; `champs_inscriptibles = {f : niveau = write}` privé des colonnes système, des formules stockées et des champs lien dont la cible est illisible ; `champs_effacables` = les champs lien dont la cible est illisible, non obligatoires, et dont le niveau serait `write` sans cette exclusion (§5.1).

La **clôture des formules** est une décision nette : sans elle, masquer un champ se contourne en trois clics par la création d'une formule `salaire * 1`. Coût assumé : une formule dépendant d'un champ largement masqué devient invisible pour beaucoup ; l'éditeur de schéma avertit au moment de la créer. *Alternative écartée* : une dérogation « cette formule est publique bien que ses entrées ne le soient pas » — reportée en v2, avec déclaration auditée.

La **clôture des contraintes croisées** en est la généralisation exacte. Sans elle, une table `employe` portant `CHECK (prime <= salaire)`, où l'acteur écrit `prime` sans lire `salaire`, livre `salaire` par dichotomie en une dizaine d'écritures : c'est la distinction succès/échec qui fuit, quel que soit le message d'erreur. Elle est calculable parce que le catalogue porte la composition de toute contrainte nommée. L'éditeur de permissions avertit lorsqu'on masque un champ participant à une contrainte multi-colonnes, en nommant les champs qui deviennent non inscriptibles.

### 4.2 Les colonnes système

Conformément à A18, et sans exception :

> **`_id`, `_created_at`, `_updated_at`, `_created_by` et `_updated_by` sont lisibles dès que `read` est accordé sur la table, ne sont jamais inscriptibles, et ne peuvent pas porter de `field_permission`.**

Aucune option, aucun réglage, aucune portée ne modifie cette règle : il n'existe pas de mode où un rôle lisant une table cesse de lire ses colonnes système parce qu'un de ses champs est masqué. Elles ne portent pas de ligne `field_permission` parce qu'elles ne portent pas de ligne `field` — « 01 — Conventions de nommage, slugification, identifiants » les décrit comme créées par le moteur et invisibles dans l'éditeur de schéma. Le curseur de pagination repose sur `_id`, le tri par `_updated_at` est une fonction de base de la grille, et un consommateur incrémental ne peut pas reprendre sans elles.

Conséquence assumée, énoncée en §7.3 : `_updated_at` et `_updated_by` révèlent qu'une ligne a été modifiée, quand et par qui, y compris lorsque la modification ne portait que sur des champs masqués. L'éditeur de permissions affiche cet avertissement au moment où l'on masque un champ. **Cet oracle résiduel est retenu en connaissance de cause** : le fermer imposerait de calculer à chaque lecture et par ligne quels champs ont changé, rendrait la colonne inutilisable pour le tri, et coûterait plus cher que ce qu'il protège.

### 4.3 Conséquences, opération par opération

| Opération | Comportement |
|---|---|
| **Projection** | Le SQL généré énumère les colonnes lisibles. Une colonne masquée ne quitte jamais la base. |
| **Filtre** sur un champ masqué | Refus `FIELD_UNKNOWN` (422), identique à une faute de frappe. Jamais ignoré silencieusement : ignorer un filtre renvoie *plus* de lignes que demandé et fausse la pagination. |
| **Tri** sur un champ masqué | Même refus, même code. |
| **Agrégat** sur un champ masqué | Refus. `count(*)` reste autorisé sur une table visible : il ne révèle qu'une cardinalité déjà accessible par la pagination. |
| **Champ requis non inscriptible à la création** | La création est refusée d'emblée par la décision, code `CREATE_IMPOSSIBLE`, avec la liste des seuls champs **visibles** en cause. Si tous les champs bloquants sont invisibles, la liste est vide et un incident est journalisé : la configuration est contradictoire et relève de l'administrateur. |
| **Extraction de volume** | Il n'existe aucun point d'entrée d'export (A21). L'extraction passe par la pagination par curseur, bornée, paginée et soumise à la même décision que toute lecture. |
| **Webhooks** | Voir §4.4. |
| **Historique** | Les révisions sont filtrées **avec les droits actuels du lecteur**, jamais avec ceux de l'auteur au moment de l'écriture. Les valeurs avant/après d'un champ masqué sont retirées du différentiel, et **une révision dont le différentiel visible est vide est omise de la liste** — sinon la liste devient un oracle d'activité sur les colonnes masquées. Cela suppose que « 07 — Historique des données et des structures » conserve l'association valeur ↔ champ du catalogue, ce que fait `record_revision_field`, et non un différentiel textuel : un masquage postérieur doit pouvoir retirer une valeur déjà écrite (§10.3). |

### 4.4 Les webhooks

Trois règles de configuration, qui remplacent toute projection après coup.

1. **Le webhook porte son propre rôle.** `webhook.role_id` est obligatoire et soumis à la non-escalade (§1.5). `webhook.created_by` sert à la traçabilité, jamais à la décision.
2. **Le rôle du webhook doit avoir un masque de lecture complet sur chaque table abonnée (A19).** Si un seul champ de la table lui est masqué, la création ou la modification de l'abonnement est refusée, code `WEBHOOK_MASK_INCOMPLETE` (422), avec la liste des champs en cause. Le cadrage exige une charge utile complète — ligne avant, ligne après — pour éviter un aller-retour au consommateur : une charge amputée sans que rien ne le signale est pire qu'un refus, puisque le consommateur ne sait même pas qu'il lui manque quelque chose. **La seule dégradation possible est la désactivation du webhook, jamais l'amputation silencieuse.** Aucune surface n'a la faculté de projeter une charge utile partielle.
3. **Toute modification d'un webhook — URL, en-têtes, abonnements, rôle — exige `manage_tokens` sur la portée, une élévation (§2.2), et revalide intégralement les règles 1 et 2 avec les droits du modificateur.** `webhook.updated_by` est réattribué et un changement d'URL est journalisé comme événement de sécurité, avec alerte. Sans cette règle, `manage_tokens` suffirait à détourner un webhook créé par quelqu'un de plus puissant, ou à s'abonner à une table qu'on ne peut pas lire : ce serait un droit de lecture universel sur la base.

**Chemin d'émission.** Il est celui d'A10, et ce chapitre ne le redéfinit pas : la capture est faite par déclencheur dans la transaction d'écriture vers `_basedb_local.change_event_buffer`, drainée vers `_basedb.change_event` ; « 07 — Historique des données et des structures » est normatif. Ce chapitre y ajoute trois obligations :

1. **La capture ne connaît aucun rôle et n'applique aucun masque** : l'image écrite dans `change_event` est complète. C'est la conséquence directe d'A10 — un déclencheur voit aussi les écritures SQL directes, qui n'ont pas d'acteur applicatif — et c'est cohérent avec la règle 2, qui garantit qu'aucun abonné ne lit moins que la ligne entière.
2. **`_basedb.webhook_delivery` ne porte que la référence** (`event_id`), le rôle de projection (`role_id`), la clé d'ordonnancement et l'état. Le corps est recalculé depuis `change_event` **à l'émission**, et projeté avec le masque du rôle tel qu'il est à cet instant. Le masque reste donc une condition de la projection, y compris sur le seul chemin qui sorte vers l'extérieur.
3. **Si ce masque n'est plus complet à l'émission**, ou si le rôle a perdu `read` sur la table, le webhook passe `is_active = false` avec `disabled_reason = 'field_masked'`, ses livraisons en attente passent `abandoned`, et une alerte est émise. Aucune charge partielle n'est jamais expédiée.

Un cas de test dédié couvre exactement cela : retirer un champ au rôle d'un webhook et vérifier qu'aucune charge utile n'est émise ensuite, et non qu'elle est émise amputée.

---

## 5. Les relations

Une relation traverse la frontière de deux tables, donc celle de deux décisions. Chaque cas reçoit ici une réponse unique. Un champ lien ne franchit jamais une frontière de base : cette restriction et son code `LINK_CROSS_DATABASE` sont posés par « 01 — Conventions de nommage, slugification, identifiants » et rendus structurels par la clé étrangère `fk_link_target` du catalogue.

### 5.1 L'acteur voit la table A, pas la table cible B

Forme de réponse unique, conforme à A16 et identique dans le catalogue, l'API et le MCP :

```json
{ "client_id": { "id": null, "display": null, "masked": true } }
```

- **L'identifiant est masqué, pas renvoyé en clair.** Un `_id` est un UUIDv7 : il porte un horodatage, qui révélerait la date de création d'une ligne d'une table que le lecteur n'a pas le droit de voir, l'ordre chronologique des créations de B et leur volume par jour. Il n'existe **aucun espace d'identifiants opaques** en remplacement : ni au catalogue, ni dans OpenAPI, ni dans le MCP.
- **Pourquoi pas non plus retirer la colonne.** La retirer reviendrait à masquer une colonne de A sans qu'aucune règle ne l'ait demandé, et casserait le cycle lecture → modification → écriture : un remplacement complet de la ligne effacerait le lien. L'administrateur qui veut réellement masquer ce champ pose un `field_permission = hidden` ; c'est explicite et visible dans l'écran des permissions.
- **Écriture.** Le champ est hors de `champs_inscriptibles`, code `FIELD_NOT_WRITABLE` (403 — le champ est visible, le refus ne révèle donc rien de neuf). Raison : écrire une valeur de lien provoque, selon que l'identifiant existe ou non dans B, un succès ou une violation de clé étrangère — soit un oracle d'existence parfait sur les lignes de B. **Deux exceptions, toutes deux portées par la décision et non par l'appelant :**
  - renvoyer l'objet masqué tel qu'il a été servi en lecture est un **non-changement**, élidé à l'étape 4 de §3.1 ;
  - mettre le champ à `NULL` est autorisé si le champ n'est pas obligatoire : il appartient alors à `champs_effacables`. Effacer un lien ne demande aucune connaissance de B.
- **Filtre et tri.** Seuls « renseigné » et « non renseigné » sont acceptés. Toute autre comparaison, et tout tri, sont refusés `FILTER_NOT_SUPPORTED` (422) : une égalité exigerait une valeur d'identifiant que le lecteur n'a pas, et un tri restituerait l'ordre de création des lignes de B. Le filtre ou le tri sur la valeur d'affichage de la cible est refusé `FIELD_UNKNOWN`, car c'est une lecture de B.
- **Interface** : une pastille neutre « enregistrement lié », non cliquable. Le clic n'ouvre rien : l'ouverture de la ligne cible est une lecture de B.
- **Description de schéma** (OpenAPI, MCP, éditeur) : le champ est décrit de type lien avec `"target": null` et `"expandable": false`. L'identité de B n'est pas divulguée.

### 5.2 Valeur d'affichage lisible par certains, pas par d'autres

La valeur d'affichage est une lecture de la table cible : elle est soumise aux permissions de B, champ par champ. Si l'acteur ne peut pas lire B, ou ne peut pas lire le champ désigné par `table_def.display_field_id`, la réponse porte `"display": null`.

**Pourquoi ce n'est pas une fuite exploitable** : `null` ne transporte aucune information sur le contenu de la cible. Pour un tiers qui observerait la réponse, les trois causes possibles — aucune colonne d'affichage désignée (état valide par A15), colonne nulle sur la ligne visée, colonne illisible — sont indistinguables. La désignation est une propriété de la table, la visibilité une propriété du lecteur, et les deux ne se confondent jamais.

**Cas de la colonne d'affichage formule.** Une colonne d'affichage est souvent une concaténation, donc une formule, donc sujette à la clôture de §4.1 : elle peut valoir `hidden` pour un lecteur qui lit pourtant la table cible. Le comportement est le même — `"display": null` —, et l'éditeur de schéma avertit au moment de désigner comme colonne d'affichage une formule, ou tout champ portant au moins une règle `field_permission`, en nommant les rôles pour lesquels l'affichage sera vide.

### 5.3 Liens inverses

La vue détail liste les lignes qui référencent l'enregistrement courant, déduites de `field_link_config`. Le filtrage se fait à trois niveaux, dans cet ordre :

1. **Table source invisible → aucune section.** Pas de section vide, pas de mention « 1 table masquée ». La table n'existe pas pour ce lecteur.
2. **Champ lien masqué pour ce lecteur → aucune section**, même si la table source est visible.
3. **Lignes** : listées via le point d'application unique comme une liste ordinaire sur la table source, avec son masque de champs et sa colonne d'affichage.

Le compteur affiché est celui des lignes visibles. Jamais de « (+3 masqués) ». En v1 il n'existe pas de permission au niveau ligne (A20) : `predicat_lignes` vaut constamment vrai, et « lignes visibles » égale « toutes les lignes d'une table visible ». Le chemin passe malgré tout par le point d'application unique et par ce prédicat, de sorte que l'arrivée des filtres par ligne ne demandera aucune réécriture.

### 5.4 Expansion d'un lien

L'expansion d'un champ lien est une **lecture de B**, évaluée par le même point d'application, avec `action = read` sur la table cible, puis projection par le masque de champs de B. **Elle ne renvoie jamais plus qu'une lecture directe de la ligne cible.**

Si la cible est invisible, l'expansion **n'est pas dégradée silencieusement** : elle est refusée avec `EXPAND_UNAVAILABLE` (422), le même code que pour un champ qui n'est pas de type lien. Renvoyer discrètement l'objet masqué ferait croire au client qu'il a obtenu la donnée.

La profondeur maximale, le regroupement des requêtes et l'articulation avec le plafond de taille de page relèvent de « 08 — API REST, OpenAPI, webhooks, jetons d'intégration ». Ce chapitre n'en exige qu'une chose : chaque niveau d'expansion est une décision complète, et la revérification par lots de §3.5 s'applique aux lots d'expansion comme aux pages.

### 5.5 Ce que les refus divulguent

**Aucun message PostgreSQL brut ne franchit le point d'application, sur aucune surface.** La correspondance `SQLSTATE` → code d'erreur est unique et appartient à l'exécuteur de requêtes du noyau, décrit par « 10 — Architecture logicielle : monorepo, noyau, pools, tests ». Ce chapitre n'en fixe que la **règle de divulgation**, qui s'y applique :

| Situation | Règle |
|---|---|
| Violation d'unicité, `read` accordé sur la table et tous les champs de la contrainte lisibles | `DUPLICATE_VALUE` (409), nommant le champ — la valeur venait du client |
| Violation d'unicité, `read` accordé sur la table mais l'un des champs de la contrainte masqué | `CONFLICT` (409), sans nom de champ ni valeur. Le cas est rare : la clôture des contraintes croisées (§4.1) retire d'abord le champ de `champs_inscriptibles` |
| Violation d'unicité, `read` refusé sur la table où elle est constatée | `VALIDATION_FAILED` (422), anonyme — ni unicité, ni champ, ni existence d'une ligne en conflit |
| Violation de `CHECK`, de non-nullité, de longueur, de domaine ou de format, champs lisibles | `VALUE_REJECTED` (422), nommant le ou les champs |
| Violation de `CHECK` touchant un champ masqué | `CONFLICT` (409), réponse anonyme |
| `SQLSTATE` non cartographié | `INTERNAL_ERROR` (500) avec un `request_id` ; le texte d'origine ne va qu'au journal serveur |

**La violation d'unicité a trois cas, et trois seulement.** Le discriminant est la décision de lecture, évaluée dans cet ordre : `read` refusé sur la table → `VALIDATION_FAILED` (422), anonyme, car un `409` annonçant un conflit dirait qu'une ligne existe dans une table que l'acteur ne peut pas lire ; `read` accordé mais l'un des champs de la contrainte masqué → `CONFLICT` (409), sans nom de champ ni valeur ; `read` accordé et tous les champs de la contrainte lisibles → `DUPLICATE_VALUE` (409), nommant le champ, la valeur ayant été fournie par le client. Aucun autre code ne répond à une violation d'unicité, sur aucune surface : l'API REST et le serveur MCP reprennent cette grille sans la redécliner.

Le nom d'une contrainte PostgreSQL n'apparaît jamais dans une réponse : il porte le nom de la table et de la colonne (`uq_<table>__<colonne>`, `ck_<table>__<colonne>__<regle>`), donc de l'information sur des objets que le lecteur peut ne pas voir.

Trois cas de clé étrangère, traités nommément :

- **Écriture d'un lien vers une cible inexistante** : le champ est identifié via `field_link_config.fk_constraint_id`. Ce cas n'est atteignable que par un acteur ayant `read` sur B (§5.1), donc la réponse peut nommer le champ : `LINK_TARGET_NOT_FOUND` (422).
- **Suppression d'une ligne encore référencée** (`ON DELETE NO ACTION`, A13) : `ROW_REFERENCED` (409), contenant **uniquement** les tables et champs référençants visibles par l'acteur. Jamais le nom de contrainte, jamais le nom d'une table invisible, jamais un compteur « et 2 autres ». Si la liste visible est vide, le message reste générique. Traité en §7.3 comme un masquage impossible.
- **Création d'une contrainte de lien sur des données existantes** : `LINK_ORPHAN_VALUES` (422), portant les `_id` des lignes fautives de la table source, plafonnés à un échantillon de 50 avec le compte total. La divulgation est licite : l'acteur détient `manage_schema` sur la source et sur la cible (§5.6), donc `read` sur les deux. La requête de collecte s'exécute sous le `statement_timeout` du pool `ddl` ; un dépassement renvoie le même code, sans échantillon.

**Suppression logique d'une table encore référencée** : le refus est structurel — il vient du `CHECK ck_link_target_live` du catalogue — et son code est `TABLE_REFERENCED` (409). La charge utile et le message appartiennent à « 03 — Moteur DDL et stratégie de migration » ; ce chapitre n'en fixe que le filtrage : la liste des tables et champs référençants est restreinte à ceux que l'acteur peut voir, et se réduit à un message générique si elle est vide. Le refus est journalisé, et il est levé lorsque tous les champs lien référençants ont été supprimés logiquement.

### 5.6 Qui peut créer un lien

Créer une clé étrangère vers B modifie le contrat de B : ses lignes deviennent indéboulonnables tant qu'elles sont référencées, et la validation initiale la verrouille brièvement. **Décision : il faut `manage_schema` sur A *et* sur B.**

En pratique `manage_schema` est accordé à la portée base, si bien que le cas courant — concevoir deux tables de la même base — n'est pas affecté. L'exigence ne mord que dans le cas qu'elle vise : un concepteur d'application qui pointerait vers la table d'une autre application et gèlerait la suppression de ses lignes. *Alternative écartée* : `read` sur B suffit — bon marché, mais laisse n'importe quel concepteur imposer une contrainte permanente à une table dont il n'est pas responsable.

Si B est invisible, elle n'apparaît pas dans le sélecteur de cible, et désigner son identifiant par l'API renvoie `RESOURCE_NOT_FOUND` (404), indistinct d'un identifiant inexistant.

### 5.7 `ON DELETE CASCADE`

Conformément à A14, **la clause `ON DELETE CASCADE` est réellement émise et la suppression en chaîne est celle de PostgreSQL.** L'application n'implémente aucune cascade applicative. Le cadrage demande un rôle admin et une confirmation : le dispositif les pose aux deux moments où ils ont un sens, la concession du droit de cascader et l'exécution d'une suppression qui cascade.

**Concession — qui.** `is_instance_admin`, ou membre du rôle système `tenant_admin` du tenant propriétaire de la base. Opération réservée, donc non délégable par `manage_permissions` (§1.5) et soumise à élévation (§2.2). Aucun jeton, aucune session MCP : le filtre de surface retire au MCP les opérations réservées et la délivrance du jeton de confirmation.

**Concession — comment.** En deux temps :

1. La demande sans jeton de confirmation renvoie `CONFIRMATION_REQUIRED` (409) avec un rapport d'impact restreint à ce qui éclaire la décision : table cible, table source et champ ; nombre de lignes de la source dont le lien est non nul ; chaîne des cascades traversant d'autres liens `cascade`, avec la liste des tables atteintes ; refus définitif `CASCADE_CYCLE` (422) si la chaîne boucle.
2. La même demande accompagnée du jeton de confirmation. Le moteur écrit une ligne `_basedb.cascade_grant` — `granted_by`, `granted_at`, `challenge_id`, `confirmation_text` — et la référence depuis `field_link_config.cascade_grant_id` ; le `CHECK ck_link_cascade_granted` interdit d'enregistrer `on_delete = 'cascade'` sans elle. Ce contrôle garantit la **cohérence du catalogue**, pas l'absence de cascade en base : la garantie réelle est en §6.5.

**Aucun chemin détourné par la migration.** Une migration proposée — par le MCP ou par tout autre chemin — dont le contenu comporte un `ON DELETE CASCADE` est **refusée à la génération**, code `CASCADE_NOT_IN_MIGRATION` (422). La concession passe exclusivement par le chemin ci-dessus, sur le champ, et jamais par l'approbation d'une migration — laquelle ne demande que `manage_schema` et rouvrirait donc au simple concepteur ce que ce paragraphe ferme.

**Exécution — décompte et confirmation.** Une suppression d'enregistrement visant une table vers laquelle le catalogue déclare au moins un lien `cascade` actif suit une procédure en deux temps, distincte de la concession :

1. Le noyau calcule, par table atteinte, le nombre de lignes que la cascade détruira, en parcourant la chaîne de `field_link_config`. Ce décompte est renvoyé avec `CASCADE_CONFIRMATION_REQUIRED` (409). Au-delà de 5 000 lignes atteintes au total — seuil configurable —, la suppression est refusée : `CASCADE_TOO_LARGE` (409), aucune suppression, renvoi vers une opération d'administration (chapitre 08 §8.3).
2. La même demande, accompagnée du décompte confirmé, exécute la suppression. Si le décompte serveur a changé entre les deux temps, la réponse est de nouveau `CASCADE_CONFIRMATION_REQUIRED` avec la nouvelle valeur. Le décompte final est journalisé dans `audit_log`, dans la transaction du `DELETE`.

Le chemin de suppression ordinaire n'est pas grevé : la procédure ne s'enclenche que si le catalogue déclare une cascade entrante. **La suppression en chaîne elle-même reste celle de PostgreSQL** : aucun droit n'est revérifié table par table pendant la cascade, ce qu'on ne pourrait faire sans la réimplémenter. C'est la contrepartie assumée d'A14, et c'est pourquoi la concession est une opération réservée. Les lignes ainsi détruites sont historisées et produisent des événements, la capture par déclencheur (A10) les marquant `is_cascade`.

**Journalisation.** Une ligne `audit_log` `action = 'link.on_delete.cascade.grant'`, `object_kind = 'field'`, dont la charge utile contient le rapport d'impact, l'identifiant de la ligne `cascade_grant`, le `request_id` et l'IP.

---

## 6. Le point d'application unique

### 6.1 Position et signature

Le point d'application est un composant du **noyau**, situé entre les adaptateurs de transport (REST, MCP, interface, émission de webhooks, IA) et la couche d'accès aux données. Sa décision est une valeur unique, dont voici les cinq composantes :

| Composante | Contenu |
|---|---|
| `verdict` | `AUTORISE`, `INVISIBLE` ou `INTERDIT` |
| `champs_lisibles` | ensemble de clés de catalogue |
| `champs_inscriptibles` | ensemble de clés de catalogue |
| `champs_effacables` | ensemble de clés de catalogue, inclus dans `champs_lisibles` privé de `champs_inscriptibles` |
| `predicat_lignes` | prédicat SQL appliqué à toute lecture ou écriture de lignes ; **constamment vrai en v1** (A20) |
| `raison` | code stable, destiné au journal, jamais au client |

Le point d'application ne lit jamais la base pendant une décision : il travaille sur deux caches mémoire (§11). Il ne renvoie pas un booléen, parce qu'une décision « oui, mais sur ces colonnes » ne peut pas être reconstituée ailleurs sans dupliquer la logique. `champs_effacables` existe pour la même raison : sans lui, l'adaptateur REST devrait retester « est-ce un lien à cible illisible et la valeur est-elle nulle ? », c'est-à-dire porter une règle d'autorisation hors du point d'application.

**`predicat_lignes` est non nullable et toujours émis.** Il n'existe pas de permission au niveau ligne en v1 : sa valeur est constamment vrai. Mais le constructeur de requêtes le reçoit et l'émet dans chaque requête, ce qui fige la surface nécessaire sans rien implémenter et rend écrivable le test de non-régression garantissant qu'aucune requête ne se construit hors du point d'application unique.

### 6.2 Ce qui rend le contournement impossible depuis une surface du produit

Quatre mécanismes, dont trois sont vérifiables automatiquement. Leur portée est celle du §0 : les surfaces du produit, et elles seules.

1. **Un seul module détient les pools.** Ses points d'entrée exigent un contexte autorisé, valeur que seul le point d'application sait produire. Une règle de dépendance du monorepo, vérifiée en intégration continue, interdit à tout paquet autre que celui de l'accès aux données d'importer le client PostgreSQL. Une violation casse la compilation du dépôt, pas la revue de code.
2. **Le constructeur SQL n'émet que des colonnes du masque, et toujours le prédicat de lignes.** L'invariant est formulé côté données, pas côté syntaxe : *toute expression du SQL émis ne référence que des colonnes nommées appartenant au masque de l'opération*. Cela interdit par construction les constructeurs de ligne entière. Formes bannies, chacune couverte par un cas de test : `*`, `t.*`, `RETURNING *`, `to_jsonb(t)`, `row_to_json(t)`, `jsonb_agg(t)`, sélection d'un type composite, `COPY <table> TO`. Un contrôle qui chercherait la chaîne `SELECT *` laisserait passer les six dernières, dont l'une est la forme naturelle du chemin le plus exposé, l'expansion groupée. Deux précisions : la clause `RETURNING` est projetée avec le masque de **lecture**, jamais avec celui d'écriture ; et une liste de colonnes vide est refusée comme une erreur de programmation — incident, compteur, aucune dégradation — puisque le verdict aurait dû être `INVISIBLE` (§3.2 étape 9).
3. **Test de couverture des surfaces.** Un test énumère les routes de la spécification OpenAPI — elle-même engendrée par le catalogue — et la liste des outils MCP, puis appelle chacune avec : un acteur sans aucun rôle ; un acteur d'un autre tenant ; un corps invalide sur une cible invisible ; un acteur dont le masque vient d'être réduit. Toute route ne répondant pas `401` ou `404` dans les trois premiers cas échoue. Une route ajoutée sans décision ne peut donc pas être livrée. Un second test vérifie que chaque requête émise porte le prédicat de lignes.
4. **Détection à l'exécution.** Le module d'accès aux données incrémente un compteur `acces_sans_decision` si une requête lui parvient avec un contexte système hors de la liste blanche des tâches, et refuse. Le compteur est exporté en métrique : ce n'est pas une intention, c'est une alarme.

### 6.3 La connexion unique et propriétaire

Le rôle PostgreSQL utilisé a tous les droits : **le serveur ne défend rien**. Ce qui compense, et qui doit être tenu :

- `search_path = ''`, qualification explicite du schéma et paramètres posés dans le paquet de démarrage de la connexion, conformément à « 01 — Conventions de nommage, slugification, identifiants » §10.3. Aucun détournement d'objet.
- Aucune chaîne utilisateur concaténée dans du SQL ; valeurs toujours en paramètres liés ; identifiants issus du registre `_basedb.physical_name` et revalidés avant quoting.
- `statement_timeout` et `idle_in_transaction_session_timeout` posés sur les trois pools : une requête ne peut pas immobiliser une connexion partagée.
- **Le pool `donnees` ne référence jamais `_basedb`.** Règle de construction, vérifiée par un test qui inspecte le SQL émis : tout nom de schéma d'une requête du pool `donnees` doit correspondre à `^b_t[2-9a-km-np-z]{6}_`. Symétriquement, le pool `catalogue` ne référence que `_basedb`. Conséquence : un défaut dans une requête de données ne peut pas atteindre les tables de permissions. Seul le pool `ddl` touche les deux, et c'est sa raison d'être.
- Aucune dépendance à des rôles PostgreSQL par utilisateur, conformément au cadrage.

### 6.4 Les contextes système

Purge planifiée, réconciliation catalogue ↔ `pg_catalog`, drain des tampons de capture, émission des webhooks, recalcul de formules : ces tâches ne peuvent pas porter un utilisateur. Elles n'ignorent pas le point d'application, elles en franchissent une porte **nommée** : un contexte système construit avec un motif explicite, restreint à une liste blanche de tâches, jamais atteignable depuis un adaptateur de transport (§6.2 point 1), et systématiquement journalisé avec `actor_kind = 'system'` et `surface = 'system'`.

**Aucun contexte système n'existe sans tenant.** Chaque tâche de fond s'exécute tenant par tenant, avec un contexte portant `tenant_id` et un motif nommé ; une tâche couvrant l'instance itère sur les tenants et **reconstruit un contexte par itération**. La garde de cloisonnement (§13) s'y applique identiquement, et le compteur `cloisonnement_viole` est exporté pour les contextes système comme pour les autres. Sans cette règle, la garde serait désactivée exactement sur les seuls chemins qui parcourent plusieurs tenants — c'est-à-dire là où un `WHERE` oublié, une erreur d'itération ou une reprise sur incident mélangent les données de deux clients sans qu'aucun contrôle ne le voie.

Pour les rares opérations réellement hors tenant — migrations du catalogue —, la garde est **inversée** : le schéma cible doit être `_basedb`, et rien d'autre.

### 6.5 La réconciliation comme contrôle de sécurité

« 02 — Schéma du catalogue `_basedb` » définit la réconciliation catalogue ↔ `pg_catalog`, ses classes de dérive `CAT-*` et son régime d'exécution. Ce chapitre lui ajoute un rôle qu'il seul peut lui donner : **c'est le seul contrôle capable de détecter que la base ne ressemble plus à ce que le décideur croit.** Trois classes sont des incidents de sécurité, pas de cohérence :

| Classe | Pourquoi c'est un incident de sécurité |
|---|---|
| `CAT-COL1` — colonne physique sans champ de catalogue | Elle est hors de tout masque : aucun `field_permission` ne peut la viser, et elle ne peut pas être exclue d'une projection qui ne la connaît pas. |
| `CAT-FK2` — clé étrangère divergente, notamment sur `confdeltype` | Une cascade réelle déclarée `restrict` au catalogue détruit silencieusement des lignes, et le décompte de §5.7, qui s'appuie sur le catalogue, ne voit rien venir. |
| `CAT-NAME` — objet physique sans nom au registre | Le catalogue n'est plus la source de vérité, donc la décision porte sur autre chose que la base. |

C'est la raison pour laquelle la réconciliation s'exécute **après chaque migration**, et pas seulement au démarrage et à la demande. Sur une cascade non autorisée détectée, la contrainte est ramenée à l'action déclarée au catalogue, l'incident est journalisé en alerte de premier niveau, et les opérations de structure de la base concernée sont suspendues jusqu'à arbitrage humain (`base.structure_state = 'frozen'`).

**Ce qu'aucun contrôle ne peut promettre.** Le rôle applicatif est propriétaire de la base : il peut désactiver un déclencheur, supprimer une contrainte ou en recréer une sous le même nom. Contraintes et déclencheurs posés par le produit protègent d'une **erreur** — un script de migration maladroit, un correctif SQL mal relu. Contre un acte délibéré, le filet réel est ici : la réconciliation, l'alerte et la trace.

---

## 7. Absence plutôt qu'erreur

### 7.1 Correspondance exacte

| Cas | HTTP | Corps |
|---|---|---|
| Ressource inexistante | `404` | `{"error":{"code":"RESOURCE_NOT_FOUND","request_id":"…"}}` |
| Ressource existante mais invisible | `404` | **identique, octet pour octet** |
| Ressource visible, action interdite | `403` | `{"error":{"code":"ACTION_FORBIDDEN","action":"delete","request_id":"…"}}` |
| Non authentifié : aucun contexte d'acteur, ou porteur refusé par la route, sur toute surface | `401` | `{"error":{"code":"AUTHENTICATION_REQUIRED"}}` |
| Session expirée ou révoquée | `401` | `{"error":{"code":"SESSION_EXPIRED"}}` |
| Jeton inconnu, ou présenté hors de ses surfaces autorisées | `401` | `{"error":{"code":"TOKEN_INVALID"}}` |
| Jeton connu, date d'expiration dépassée | `401` | `{"error":{"code":"TOKEN_EXPIRED"}}` |
| Jeton connu, révoqué | `401` | `{"error":{"code":"TOKEN_REVOKED"}}` |
| Jeton hors de sa portée de base | `404` | comme une ressource inexistante |
| Session valide mais non élevée | `403` | `{"error":{"code":"ELEVATION_REQUIRED"}}` |
| Champ invisible dans une charge utile en écriture | `422` | `{"error":{"code":"FIELD_UNKNOWN","field":"<tel que fourni>"}}` — identique à une faute de frappe |
| Champ visible mais non inscriptible | `403` | `{"error":{"code":"FIELD_NOT_WRITABLE","field":"salaire"}}` |

L'invariant qui rend l'ensemble cohérent : **`403` n'est émis que si la décision de lecture sur la cible vaut `AUTORISE`.** Tout le reste est `404`.

**Exception décidée : l'état d'un jeton est dit à son porteur.** La règle « absence plutôt qu'erreur » protège l'**existence des ressources** — une table, une ligne, un rôle, un utilisateur que l'acteur n'a pas le droit de voir. Elle ne porte pas sur l'état d'un secret que l'appelant détient déjà et présente lui-même. `TOKEN_INVALID`, `TOKEN_EXPIRED` et `TOKEN_REVOKED` sont donc **trois codes distincts**, tous en `401` : ils ne révèlent rien qu'un porteur légitime ne doive savoir, et lui disent la seule chose utile — renouveler son jeton, ou s'adresser à un administrateur. Les confondre transformerait chaque expiration ordinaire en incident à diagnostiquer à l'aveugle. L'oracle résiduel — apprendre qu'un jeton présenté a existé — suppose d'avoir déjà deviné le secret, ce qui est hors de portée : il est sans valeur pour un attaquant. La distinction s'arrête là : aucune des trois réponses ne nomme le propriétaire du jeton, sa portée ni ses dates, et le cas « jeton hors de sa portée de base » reste un `404`, parce qu'il porte, lui, sur l'existence d'une ressource.

Conformément à A2 et A23, les codes d'erreur sont des identifiants machine **en anglais, en majuscules ASCII avec tirets bas**, inscrits au registre unique `_basedb.error_code`. Un chapitre peut y ajouter un code ; aucun ne peut en renommer un. Les libellés affichés dans l'interface et les messages destinés aux humains restent en français : un code d'erreur est un identifiant machine, pas un message.

### 7.2 Canaux auxiliaires à neutraliser

- **Temps de réponse.** Aucun rembourrage artificiel : c'est coûteux et défait par la moyenne. À la place, la cause est supprimée. Le catalogue d'un tenant est **chargé intégralement** à la première décision le concernant, et la résolution nom → identifiant se fait exclusivement en mémoire, sur un dictionnaire contenant aussi bien les objets visibles que les invisibles. Un échec de résolution et un refus de visibilité coûtent alors la même chose : pour toute cible du catalogue, le `404` d'inexistence comme le `404` d'invisibilité sortent sans toucher la base. Pour une cible de type **enregistrement**, la décision sur la table précède toujours la requête ; l'écart résiduel ne distingue donc jamais qu'« existe / n'existe pas » à l'intérieur d'une table que l'acteur peut déjà énumérer, ce qui n'ajoute aucune information. Dernier résidu traité : la comparaison d'empreinte de jeton se fait en temps constant après la recherche d'index.
- **Violations de contrainte** : voir §5.5. Le nom de contrainte PostgreSQL n'apparaît jamais.
- **Compteurs.** La liste ne renvoie pas de total par défaut. Si un comptage exact est offert par l'API — c'est « 08 — API REST, OpenAPI, webhooks, jetons d'intégration » qui en décide —, il passe par la même décision et le même masque.
- **Identifiants devinables.** Aucun entier séquentiel n'est exposé par les surfaces. Un `_id` est un UUIDv7, donc ordonné dans le temps : il divulgue un instant de création, déjà exposé par `_created_at` **dans une table que le lecteur peut lire**. C'est précisément pourquoi un lien vers une table illisible est servi masqué (§5.1). Le `tenantId` ne vaut que 2³⁰ : **ce n'est pas un secret** et rien ne doit en dépendre.
- **Spécification et outillage.** La spécification OpenAPI servie à un acteur ne contient que les bases, tables et champs qu'il voit ; même règle pour la liste des outils MCP et pour la documentation lisible générée. Une spécification globale serait un oracle de schéma complet. Clé de cache : **(`tenant_id`, jeu de rôles, `is_instance_admin`, `base.catalog_version`, `tenant.authz_version`)**, avec une durée de vie de 30 secondes, celle de l'instantané d'autorisation. Une clé fondée sur la seule `catalog_version` laisserait la spécification décrire indéfiniment une table dont l'accès vient d'être retiré. Un cas de test couvre la séquence révocation → relecture de la spécification. Chaque lecture de schéma est journalisée avec `audit_log.action = 'schema.read'`.
- **Limitation de débit** par acteur, afin qu'un oracle résiduel ne soit pas exploitable à l'échelle. Avec plusieurs instances applicatives, elle est approximative (A4).

### 7.3 Ce qu'on ne peut pas masquer

Quatre cas, assumés et documentés plutôt que dissimulés.

1. **Le refus pour cause de référence**, sur une ligne comme sur une table. Refuser une suppression révèle nécessairement qu'il existe, quelque part, au moins une référence. Atténuation : ni où, ni quoi, ni combien. Le refus est journalisé.
2. **La violation d'unicité.** Une contrainte d'unicité est par nature un oracle d'existence de valeur. Atténuations : réponse anonyme quand un champ de la contrainte est masqué (§5.5), retrait des champs concernés de `champs_inscriptibles` quand la contrainte est composite (§4.1), et avertissement de l'éditeur de permissions quand on masque un champ portant une contrainte d'unicité.
3. **La cardinalité d'une table visible.** `count(*)` et la pagination la révèlent ; c'est cohérent, puisque la table est visible.
4. **L'activité portée par les colonnes système.** `_updated_at` et `_updated_by` révèlent qu'une ligne a été modifiée, quand et par qui, même si la modification ne portait que sur des champs masqués (§4.2, A18). Atténuation : avertissement explicite de l'éditeur de permissions au moment du masquage. Cet oracle est le prix explicitement payé pour que la reprise incrémentale d'un consommateur reste possible quel que soit son masque.

---

## 8. Permissions de structure et d'administration

| Opération | Exigence |
|---|---|
| Créer ou supprimer un projet (vide) | `manage_schema` @ tenant (§15.1) |
| Créer une base | `manage_schema` @ projet (§15.1) |
| Créer une table, une application, une vue enregistrée | `manage_schema` @ base |
| Créer ou modifier un champ, désigner la colonne d'affichage | `manage_schema` @ table |
| Créer un champ lien, choisir `restrict` ou `set_null` | `manage_schema` @ source **et** @ cible |
| Choisir `cascade` | opération réservée + élévation + confirmation (§5.7) |
| Renommer un **libellé** | `manage_schema` @ objet |
| **Renommer physiquement** | opération réservée, après l'écran des consommateurs (voir « 06 — Cycle de vie ») |
| Supprimer logiquement une base, une table, un champ, une vue | `manage_schema` @ portée parente |
| **Purger** | opération réservée. Les conditions temporelles et l'ordonnancement sont fixés par « 06 — Cycle de vie » ; ce chapitre ne statue que sur le droit requis |
| Approuver une migration proposée | `manage_schema` @ base, session élevée, **et jeton de confirmation** délivré depuis `ui` ou `rest` (§2.2). L'auto-approbation est permise : l'objet du double temps est la relecture humaine, pas la séparation des tâches |
| Gérer les jetons ; créer ou modifier un webhook | `manage_tokens` @ portée, élévation, non-escalade sur le rôle porté, plus les règles de §4.4 |
| Gérer les utilisateurs du tenant, les rôles, les permissions | `manage_permissions` @ tenant (utilisateurs) ou @ portée visée, élévation, règle de non-escalade ; en pratique, les membres du groupe « Administrateurs » (§15.2) |
| **Consulter** utilisateurs, rôles, membres, lignes `permission` et `field_permission`, et l'écran de masque effectif de §3.3 | `manage_permissions` @ portée examinée |
| **Consulter** jetons et webhooks — métadonnées, portée, préfixe, jamais le secret | `manage_tokens` @ portée |
| **Consulter** `audit_log` et l'historique brut | opération réservée : `is_instance_admin` ou `tenant_admin`, filtré par tenant, la consultation étant elle-même journalisée |
| Réglages d'instance, migrations de catalogue, modèle et clés d'IA par défaut de l'instance | `is_instance_admin` |
| Surcharger le modèle d'IA (clé `ai.model` de `_basedb.setting`, portée tenant) et fournir une clé au niveau tenant | opération réservée : `tenant_admin` du tenant ou `is_instance_admin` |

Trois précisions :

- **Les objets du catalogue suivent la même règle « absence plutôt qu'erreur » que les données.** Un rôle, un jeton, un webhook ou un utilisateur que l'acteur n'a pas le droit de consulter répond `RESOURCE_NOT_FOUND` (404). Sans ces lignes, un simple `contributor` obtiendrait la liste nominative des comptes, la cartographie des rôles sensibles et, via `audit_log`, des valeurs avant/après de champs qu'il ne peut pas lire dans la table.
- **La clé d'un fournisseur d'IA, à quelque niveau qu'elle soit posée, vit dans `_basedb.secret` et n'est jamais relue par une surface** : seuls son empreinte et ses quatre derniers caractères sont renvoyés. Elle est en écriture seule dans l'API et absente de l'OpenAPI généré. Le réglage correspondant de `_basedb.setting` porte `is_secret = true` et ne contient pas la valeur.
- **Aucun chemin de structure n'échappe au double temps selon la surface.** Un jeton ne peut pas porter `manage_schema` (§2.3), donc le DDL direct par l'API REST est nécessairement le fait d'un utilisateur authentifié dont la session est traçable. C'est ce qui rend cohérente l'exigence de confirmation humaine sur l'approbation d'une migration : sans la règle sur les jetons, un jeton fuité appliquerait du DDL par la porte de service pendant qu'on garde la porte d'entrée.

---

## 9. Applications et vues enregistrées

Une **application** est un regroupement nommé de tables d'une même base (`_basedb.application`, `_basedb.application_table`), sans existence physique. Son unique rôle fonctionnel est d'être une **portée de permission intermédiaire entre la base et la table**, et une unité de partage : on partage « l'application Ventes » avec une équipe, pas quatorze tables une par une.

Quatre règles :

1. Une application n'appartient qu'à une base, garanti structurellement par le `base_id` partagé de `application_table`. Un lien vers une table d'une autre application de la même base reste possible (§5.6).
2. Une table peut appartenir à zéro, une ou plusieurs applications ; sans application, elle n'est joignable que par une autorisation de portée base ou table.
3. **Une application accorde, elle ne restreint jamais.** Ce n'est pas un bac à sable : un acteur ayant `read` @ base lit la table quelles que soient les applications. *Alternative écartée* : faire de l'application une restriction — deux sémantiques opposées sur la même hiérarchie rendraient la résolution imprévisible.
4. L'appartenance est évaluée à la décision. Ajouter une table à une application accorde immédiatement les droits correspondants ; l'écran d'édition liste les rôles concernés avant validation.

**Les vues enregistrées (`_basedb.view_def`) sont une présentation, pas une portée.** Elles existent en v1, ne portent aucune permission propre et **suivent intégralement le régime de leur table** : voir une vue suppose `read` sur sa table ; la créer, la modifier ou la supprimer logiquement suppose `manage_schema` @ base ; il n'existe ni propriétaire, ni vue personnelle. Deux conséquences :

- une vue ne peut rien montrer de plus que la table : son tri, ses filtres et son ordre de colonnes sont appliqués **après** le masque, et une colonne masquée pour le lecteur est retirée de la présentation sans que la vue devienne invalide pour autant ;
- un filtre ou un tri portant sur un champ masqué pour le lecteur est refusé comme partout ailleurs (`FIELD_UNKNOWN`), et l'invalidation d'une vue dont un champ référencé a disparu (`view_def.is_invalid`) relève de « 06 — Cycle de vie ».

**Un formulaire partagé (chapitre 15) n'est pas une exception à ce régime, il le délègue.** Quelqu'un qui n'a aucun droit sur la table peut y répondre, mais la ligne s'écrit sur l'autorité de la personne qui a publié le partage : la décision `create` est rejouée pour elle à chaque réponse, le masque d'écriture restreint aux questions du formulaire, et un publiant qui perd ce droit suspend ses formulaires avec lui. La personne qui répond ne lit rien de la table — pas même la ligne qu'elle vient d'écrire —, et l'acteur `form` d'une réponse publique ne porte aucun droit propre.

**Le SQL de l'interface ne contourne plus le masque, sauf pour qui gère la base.** Qui détient `manage_schema` sur une base garde la console (chapitre 09 §1, exception assumée) : il peut déjà en changer les colonnes. Tout autre lecteur exécute son SQL sur un rôle PostgreSQL **qui lui est propre**, en lecture seule, dont les `GRANT` sont posés avant chaque appel à partir de la décision `read` rendue ici, champ par champ : `SELECT` sur les colonnes lisibles des tables lisibles, `USAGE` sur le seul schéma de la base, rien d'autre. C'est la seconde ligne de défense que l'introduction de ce chapitre disait absente — PostgreSQL applique lui-même le masque —, pour cette surface-là.

**Une vue SQL (`_basedb.sql_view`) n'est pas une portée non plus.** Elle est créée `security_invoker` : PostgreSQL vérifie, à chaque lecture, les droits du lecteur sur les tables et les colonnes qu'elle lit, si bien qu'elle ne peut rien montrer que ses tables ne montreraient. Elle ne lit que sa propre base, ce qui est vérifié sur `pg_depend` à la création. Une **requête enregistrée** (`_basedb.saved_query`) ne porte que son texte : la partager ne transmet rien des droits de son auteur.

---

## 10. Journalisation, conservation, secrets

### 10.1 Ce qui n'entre jamais dans un journal

> **Aucune valeur provenant de `_basedb.secret` ni d'un réglage marqué `is_secret` n'entre dans `audit_log`, dans l'historique, dans une charge utile de webhook ni dans un message d'erreur.** Seules l'empreinte et les quatre derniers caractères sont conservés.

Cela vise nommément les clés des fournisseurs d'IA, les secrets de jetons, le secret de signature des webhooks, les empreintes de session et les secrets d'amorçage. Sans cette règle, modifier un réglage d'instance produirait une entrée avec valeur avant/après, donc la clé en clair dans une table sauvegardée et répliquée. La clé d'instance elle-même est hors base (A25).

### 10.2 Conservation

Les durées sont déclarées une seule fois, dans `_basedb.retention_policy` (A24), et ce chapitre n'en fixe aucune. Il pose deux règles qui lui sont propres :

- **Les colonnes de traçabilité contextuelle** — `ip`, en-têtes d'agent, empreintes — sont effacées au terme de la rétention du journal de sécurité, **la ligne d'audit survivant** : c'est la décision d'administration qu'il faut conserver, pas l'adresse de qui l'a prise.
- **Les décisions d'administration** — rôles, permissions, jetons, webhooks, opérations réservées, migrations — ne sont pas purgées : elles portent la reconstitution de qui a accordé quoi.

### 10.3 Le masquage n'est pas rétroactif

Masquer un champ aujourd'hui ne retire pas la valeur écrite hier dans l'historique ni dans `audit_log`. La conséquence est traitée par la lecture, pas par le stockage : l'historique est **filtré au moment de la lecture** avec le masque du lecteur (§4.3), ce qui suppose que le stockage conserve l'association valeur ↔ champ du catalogue plutôt qu'un différentiel textuel. Les charges utiles archivées dans `audit_log` qui contiennent des valeurs de colonnes suivent la même règle ; c'est l'une des raisons pour lesquelles la consultation de `audit_log` est une opération réservée (§8) et non un droit délégable.

---

## 11. Cache des décisions et révocation

| Élément | Durée | Invalidation |
|---|---|---|
| Schéma d'une base (tables, champs, satellites, liens, contraintes) | jusqu'à invalidation, **revalidé toutes les 30 à 60 s** | `base.catalog_version` + `NOTIFY basedb_catalog` |
| Instantané d'autorisation d'un sujet : rôles, lignes `permission`, `field_permission`, **valeurs** `expires_at` et `revoked_at` | **30 s** | `NOTIFY basedb_authz` portant le sujet touché ; `tenant.authz_version` |
| **Décision individuelle** | **jamais mise en cache** | sans objet |

`tenant.authz_version` est **le seul compteur d'invalidation des droits du produit** : il n'en existe aucun autre, sous aucun autre nom, et il sert aussi bien au cache d'autorisation qu'à la clé de cache de la spécification OpenAPI (§7.2).

Une décision n'est pas mémorisée : elle est recalculée à chaque appel à partir des deux caches, en mémoire, sans requête. On évite ainsi une troisième surface d'invalidation, la plus difficile à raisonner, pour un gain nul — le calcul est une suite bornée de consultations (§3.5).

**L'instantané met en cache des valeurs, jamais un booléen « valide ».** `expires_at` et `revoked_at` sont comparés à l'horloge du serveur **à chaque décision** : un jeton ou une session expirés cessent d'être acceptés à la seconde près. La borne de 30 secondes ne s'applique qu'à ce qui n'est pas connu d'avance : une révocation, un retrait de rôle, une désactivation.

**Revalidation du cache de schéma.** Un processus qui manque un `NOTIFY` — reconnexion, file saturée, redémarrage — conserverait sinon un schéma périmé indéfiniment et continuerait de projeter un champ supprimé logiquement. Une lecture par processus et par minute des couples `(id, catalog_version)` des bases du tenant suffit à détecter la divergence ; seules les bases dont la version a bougé sont rechargées.

Toute écriture sur `role`, `role_member`, `permission`, `field_permission`, `api_token`, `webhook`, `session` ou `app_user` émet le `NOTIFY` **dans la même transaction** et incrémente `tenant.authz_version` : la notification ne part donc qu'à la validation, jamais sur un travail annulé, et un processus qui a manqué une notification le détecte par comparaison de ce compteur monotone.

**Pire cas de propagation d'une révocation : 30 secondes ; cas courant : moins de 100 ms.** Pour une compromission avérée, la conduite à tenir est écrite : révoquer le jeton ou la session, et si l'urgence l'exige, désactiver le compte (`app_user.disabled_at`) — la borne de 30 secondes reste, et elle est assumée en v1.

---

## 12. Amorçage et dernier administrateur

L'amorçage complet — création du premier compte, secret d'amorçage, première connexion — appartient à « 13 — Authentification », qui s'appuie sur `app_user.must_change_password` et sur le triplet `bootstrap_secret_hash` / `bootstrap_secret_expires_at` / `bootstrap_secret_consumed_at` du catalogue. Ce chapitre n'en retient que ce qui touche l'autorité :

- **Aucun compte par défaut, aucun mot de passe par défaut.** Le premier compte créé porte `is_instance_admin = true`, et le tenant par défaut créé dans la foulée porte son rôle système `tenant_admin`, dont ce compte est le premier membre.
- **Dernier administrateur.** Supprimer, désactiver ou rétrograder le dernier `is_instance_admin` vivant est refusé, code `LAST_INSTANCE_ADMIN`. Le contrôle est porté par un déclencheur du catalogue, et non par le service : il protège d'un correctif SQL maladroit — pas d'un opérateur décidé à le désactiver, ce que le rôle propriétaire autorise (§6.5). Le déclencheur prend d'abord un verrou consultatif de la classe `catalog_migration`, portée instance, sinon deux rétrogradations concurrentes voient chacune un administrateur restant et laissent zéro. Même règle, même forme, code `LAST_TENANT_ADMIN`, pour le dernier membre d'un `tenant_admin`.
- **Sortie de secours.** Si l'instance se retrouve tout de même sans administrateur (restauration, intervention manuelle), une commande d'exploitation disposant d'un accès direct à la base promeut un utilisateur et écrit une entrée `audit_log` avec `actor_kind = 'system'`. Elle existe, elle est documentée, et elle laisse une trace.

---

## 13. Cloisonnement multi-tenant

**Ce qui est en place dès la v1**, sans exception :

- **Un utilisateur appartient à exactement un tenant** (`app_user.tenant_id NOT NULL`). Le contexte d'acteur porte donc toujours un `tenant_id`, figé à la création de la session, sans choix ni bascule. Un jeton porte le sien (`api_token.tenant_id`). Un contexte système aussi (§6.4). Il n'existe aucune table d'appartenance multiple.
- L'étape 2 de l'algorithme compare le tenant de la cible à celui du contexte **avant toute autre considération**, y compris pour un administrateur d'instance. Elle coûte une ligne et c'est cette ligne qui deviendra la frontière réelle.
- Le nommage porte déjà le `tenantId` : **aucun schéma de production n'aura jamais à être renommé.**
- Une garde à l'exécution : tout nom de schéma d'une requête du pool `donnees` doit commencer par `b_<tenantId du contexte>_`. Une requête qui viserait un autre schéma est un incident fatal `TENANT_ISOLATION_VIOLATED` — transaction annulée, alerte, compteur de métrique. C'est le contrôle qui transforme une hypothèse en propriété observable. Sur le pool `catalogue`, la garde est inversée : le schéma doit être `_basedb`.

**Branché plus tard, sans toucher au nommage** : l'appartenance d'un utilisateur à plusieurs tenants et la sélection d'un tenant de session ; un pool de connexions par tenant ; le déplacement des schémas d'un tenant vers une autre base PostgreSQL ; des clés de chiffrement par tenant pour `_basedb.secret` ; le partage inter-tenants, dont l'absence est ce qui rend l'étape 2 inconditionnelle.

Le cadrage demande le **nommage** dès maintenant, pas la fonctionnalité multi-tenant. Un sélecteur de tenant en v1 serait un écran, une portée de session mutable et un effet sur le cache d'autorisation comme sur les jetons, pour un besoin déclaré inexistant.

---

## 14. Codes d'erreur définis par ce chapitre

Conformément à A2 et A23, ces codes sont en anglais, en majuscules ASCII, inscrits au registre `_basedb.error_code` avec `origin = '05'`. Ils font partie du contrat public de l'API REST et du serveur MCP : ils peuvent être ajoutés, jamais renommés ni resémantisés sans changement de version d'API.

| Code | Déclencheur | HTTP |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | aucun contexte d'acteur, ou porteur refusé par la route, sur toute surface | 401 |
| `SESSION_EXPIRED` | session expirée ou révoquée | 401 |
| `TOKEN_INVALID` | jeton inconnu, ou présenté hors de `allowed_surfaces` | 401 |
| `ORIGIN_REJECTED` | requête mutante sans origine déclarée exploitable | 403 |
| `ELEVATION_REQUIRED` | opération exigeant une ré-authentification récente | 403 |
| `RESOURCE_NOT_FOUND` | cible inexistante **ou** invisible, y compris objet de catalogue | 404 |
| `ACTION_FORBIDDEN` | cible lisible, action non accordée | 403 |
| `FIELD_UNKNOWN` | champ inexistant, masqué, ou filtre/tri sur un champ masqué | 422 |
| `FIELD_NOT_WRITABLE` | champ visible, non inscriptible (dont lien à cible illisible hors effacement) | 403 |
| `CREATE_IMPOSSIBLE` | champ obligatoire non inscriptible par l'acteur | 403 |
| `EXPAND_UNAVAILABLE` | expansion d'un champ non expansible ou à cible invisible | 422 |
| `FILTER_NOT_SUPPORTED` | opérateur autre que « renseigné »/« non renseigné », ou tri, sur un lien à cible illisible | 422 |
| `CONFLICT` | violation d'unicité ou de `CHECK` touchant un champ masqué ; réponse anonyme | 409 |
| `VALUE_REJECTED` | valeur refusée par une contrainte dont tous les champs sont lisibles | 422 |
| `CONFIRMATION_REQUIRED` | opération réservée sans jeton de confirmation | 409 |
| `CASCADE_CYCLE` | chaîne de cascades bouclante | 422 |
| `CASCADE_NOT_IN_MIGRATION` | `ON DELETE CASCADE` présent dans une migration proposée | 422 |
| `PERMISSION_INCONSISTENT` | écriture accordée sans lecture | 422 |
| `PERMISSION_OUT_OF_SCOPE` | règle de champ hors de la portée du rôle | 422 |
| `PRIVILEGE_ESCALATION` | accorder plus que ce qu'on détient ; rôle de jeton ou de webhook hors des capacités du créateur ; ajout à un rôle système | 403 |
| `TOKEN_PRIVILEGE_REFUSED` | rôle de jeton portant `manage_schema`, `manage_permissions` ou `manage_tokens` | 422 |
| `TOKEN_EXPIRY_REQUIRED` | Durée de vie d'un jeton donnée hors de 1 à 365 jours (l'absence de durée vaut « sans échéance ») | 422 |
| `WEBHOOK_MASK_INCOMPLETE` | rôle de webhook sans masque de lecture complet sur une table abonnée | 422 |
| `MASK_REDUCED_MID_READ` | droits réduits pendant une lecture longue | 409 |
| `LAST_TENANT_ADMIN` | retrait du dernier membre d'un `tenant_admin` | 409 |
| `EMAIL_TAKEN` | création d'un compte à une adresse déjà portée dans le tenant (§15.5) | 409 |
| `GROUP_SYSTEM_IMMUTABLE` | renommage ou suppression d'un groupe système, retrait d'un membre de « Tous les utilisateurs », niveau posé sur « Administrateurs » (§15.2) | 409 |
| `TENANT_ISOLATION_VIOLATED` | requête visant le schéma d'un autre tenant | incident, 500 générique |
| `INTERNAL_ERROR` | `SQLSTATE` non cartographié | 500 |

Repris tels quels, définis ailleurs : `LINK_CROSS_DATABASE` (chapitre 01) ; `TABLE_REFERENCED`, `DISPLAY_FIELD_IN_USE`, `LAST_INSTANCE_ADMIN`, `PROJECT_NOT_EMPTY` (chapitre 02) ; `ADMIN_REQUIRED` (chapitre 06) ; `TOKEN_EXPIRED`, `TOKEN_REVOKED` (chapitre 08 ; leur emploi est fixé en §7.1) ; `LINK_TARGET_NOT_FOUND`, `LINK_ORPHAN_VALUES`, `ROW_REFERENCED`, `DUPLICATE_VALUE`, `VALIDATION_FAILED` (registre unique, A23).

---

## 15. Projets, groupes et niveaux d'accès

Le modèle des sections précédentes — sept verbes, rôles additifs, portées emboîtées — reste le seul qui décide. Cette section fixe la façon dont il est **présenté et administré** : au-dessus de la base, une portée *projet* ; des *groupes* de personnes auxquels on accorde des droits ; quatre *niveaux* qui regroupent les verbes. Le parti pris : on accorde à un groupe un niveau sur un nœud de l'arborescence, et ce niveau descend.

### 15.1 Le projet, portée au-dessus de la base

L'arborescence devient **tenant ⊃ projet ⊃ base ⊃ table**. Le projet est une ligne de `_basedb.project` sans existence physique (chapitre 02) : il ne nomme aucun schéma, et une base garde son schéma quel que soit le projet qui la porte. Il est l'unité de navigation de l'interface — on choisit un projet, on y crée des bases, et dans chaque base des tables — et une portée de permission : `permission.scope_kind = 'project'`, avec `scope_project_id`.

Le décideur n'a qu'un cas de plus. À l'étape de correspondance de portée, une permission de portée projet s'applique à toute cible dont le `projectId` est ce projet : le projet lui-même, chacune de ses bases, chacune de leurs tables. Aucun autre chemin de décision n'est ajouté ; `decide` reste le point d'application unique (§6).

| Opération | Exigence |
|---|---|
| Créer un projet | toute personne connectée — jamais un jeton ; elle en reçoit « Gestion » |
| Renommer un projet, changer sa description | `manage_schema` @ projet |
| Supprimer un projet | `manage_schema` @ projet, projet **vide** (`PROJECT_NOT_EMPTY` sinon) |
| Créer une base dans un projet | `manage_schema` @ projet |
| Créer une table dans une base | `manage_schema` @ base (ou au-dessus) |

**Un projet ne se supprime que vide.** Ses bases sont de vrais schémas portant de vraies lignes ; chacune se supprime par son propre plan (chapitre 06), jamais emportée par un regroupement qui n'a pas d'existence physique. Les lignes `permission` qui visent le projet disparaissent avec lui : une portée que plus personne ne peut atteindre survivrait sinon comme un fantôme dans l'écran des permissions. Une base supprimée dont le projet a disparu entre-temps est restaurée dans le premier projet du tenant.

**Visibilité.** Un projet apparaît à qui détient un droit sur lui (accordé sur lui ou sur le tenant) ou voit au moins une de ses bases ; une base apparaît à qui lit une de ses tables ou détient `read` sur elle. Un projet que personne n'a ouvert et où rien n'est visible est **absent**, pas vide — la règle de §7, un niveau plus haut. Corollaire : un refus sur une base ou un projet que l'acteur voit à travers une table lisible répond `ADMIN_REQUIRED`, pas `RESOURCE_NOT_FOUND` — l'objet existe pour lui, le taire serait mentir sans rien protéger.

**Chacun ses projets.** Toute personne crée les siens, et en reçoit le niveau « Gestion » sur son rôle personnel (§15.8) : qui crée un projet le gère, et le partage. Le nom d'un projet est unique parmi les projets **de la personne qui l'a créé**, pas dans le tenant : un nom déjà pris par un projet que l'on ne voit pas ne doit ni bloquer ni révéler qu'il existe.

L'amorçage crée un projet « Projet principal » ; une base créée sans projet désigné (route antérieure aux projets) y est rangée.

### 15.2 Groupes

Un **groupe** est un rôle (`role.kind = 'group'`) dont les membres sont des personnes (`role_member`). L'administration accorde les droits aux groupes ; ce qu'un gestionnaire partage à une personne va sur son **rôle personnel** (§15.8). Deux groupes existent dans chaque tenant et ne peuvent être ni renommés ni supprimés (`GROUP_SYSTEM_IMMUTABLE`) :

- **« Administrateurs »** (`tenant_admin`) porte les sept verbes sur le tenant. Ses membres voient tous les projets, et ce sont eux qui administrent comptes, groupes, permissions et projets. Il n'apparaît dans la grille qu'en lecture seule : un administrateur sans droits serait une contradiction que l'écran ne sait pas exprimer. Le retrait ou la désactivation de son dernier membre actif est refusé (`LAST_TENANT_ADMIN`, §12).
- **« Tous les utilisateurs »** (`all_users`) contient chaque compte du tenant, d'office ; son appartenance ne se modifie pas. **Il ne reçoit rien par défaut** : les droits étant additifs (§3.3), ce qui lui est accordé, personne ne peut en être privé. Pour réserver un accès, on l'accorde à un groupe dédié.

### 15.3 Les quatre niveaux

| Niveau | Verbes | Ce que l'on peut faire |
|---|---|---|
| Aucun accès | — | rien : le nœud est invisible (§7) |
| Lecture | `read` | lire les lignes |
| Édition | `read`, `create`, `update`, `delete` | créer, modifier, supprimer des lignes |
| Gestion | Édition + `manage_schema`, `manage_tokens` | changer la structure, créer des jetons d'intégration |

Un niveau n'est pas une notion du catalogue : il est écrit comme autant de lignes `permission` que de verbes, et relu comme **le plus haut niveau dont tous les verbes sont présents**. `manage_permissions` n'entre dans aucun niveau : administrer les droits du tenant reste l'affaire du groupe « Administrateurs ». Partager un projet ou une base, en revanche, relève du niveau « Gestion » sur cet objet (§15.8). Tout niveau non nul contient `read` — c'est ce qui rend visibles les objets sur lesquels on agit ; une ligne `manage_schema` sans `read`, qu'on ne pourrait poser qu'à la main, ne montre rien.

### 15.4 Héritage et « Granulaire »

Un niveau posé sur un nœud vaut pour tout ce qui est dessous, **y compris ce qui sera créé plus tard** : « Lecture » sur un projet lit la table ajoutée demain dans une de ses bases. Poser un niveau sur un nœud suit trois règles, dans l'ordre :

1. **Explosion.** Si un ancêtre accorde plus que le niveau choisi, son octroi est redescendu sur chacun de ses enfants, pour que le nœud visé puisse être abaissé seul.
2. **Affectation.** Le nœud reçoit le niveau ; ses descendants perdent leurs octrois propres — un niveau choisi sur une base est celui de chacune de ses tables.
3. **Élagage.** Un octroi qui n'accorde pas plus que ce que donnent déjà ses ancêtres est supprimé comme redondant.

La grille montre pour chaque nœud le niveau effectif du groupe, marqué **hérité** lorsqu'il vient d'un ancêtre, et **Granulaire** lorsque les enfants du nœud n'ont pas tous ce qu'il a lui-même. Conséquence assumée : après une explosion, une table créée dans la base « granulaire » n'hérite de rien, puisque chaque table y a été réglée pour elle-même.

Chaque changement s'applique immédiatement, dans une transaction qui réécrit les lignes `permission` du groupe sur le projet concerné, écrit une entrée `audit_log` (`permission.set`) et fait avancer `tenant.authz_version` : toute décision en cache tombe (§11). Il n'y a pas de brouillon à enregistrer — et donc pas de brouillon oublié.

### 15.5 Comptes utilisateurs

Chacun peut aussi **créer son propre compte**, tant que l'administration le permet (« 13 — Authentification », §8) : il ne voit alors que ses projets et ce qu'on lui partage. Un administrateur crée un compte avec une adresse (unique dans le tenant sans égard à la casse, `EMAIL_TAKEN`), un nom affiché et ses groupes. basedb n'envoyant pas de courrier en v1, le compte reçoit un **mot de passe temporaire** tiré dans un alphabet sans caractères ambigus, montré une seule fois à l'administrateur qui le transmet, et `app_user.must_change_password = true` : l'interface n'ouvre rien d'autre tant que la personne n'a pas choisi le sien (« 13 — Authentification »). La réinitialisation suit le même chemin et ferme les sessions ouvertes.

Un compte se **désactive**, il ne se supprime pas : ses sessions et ses jetons cessent immédiatement, ses écritures restent signées de son nom, et il peut être réactivé. Un administrateur ne peut pas désactiver son propre compte (`ACTION_FORBIDDEN`).

### 15.6 Élévation et non-divulgation

- **Toute écriture d'administration** — compte, groupe, appartenance, niveau — exige une session élevée depuis moins de cinq minutes (§2.2) et répond `ELEVATION_REQUIRED` sinon. L'interface demande alors le mot de passe et rejoue l'action : on n'est pas prévenu à l'avance, on est interrompu au moment où c'est nécessaire, une fois par tranche de cinq minutes.
- **Les listes de comptes, de groupes et la grille** ne sont lisibles que par les administrateurs. À tout autre acteur, ces routes répondent `RESOURCE_NOT_FOUND` (§8) : la liste nominative des comptes n'est pas une chose qu'un non-administrateur apprend exister.
- **L'annuaire** (`/meta/users`, qui nomme les personnes d'un champ « Personne » ou d'une mention) ne montre à chacun que lui-même et les personnes avec qui il partage un projet — qui détiennent un accès dans un projet où il en détient un. Les administrateurs y voient tout le monde. N'importe qui pouvant créer un compte, l'annuaire du tenant n'est pas une liste à livrer au premier inscrit.
- Un **contexte système** (`actor.kind = 'system'`, §6.4) détient tous les verbes dans son tenant : les tâches de fond n'ont pas de groupe.

### 15.7 Ce que ce modèle ne fait pas

- Pas de niveau « bloqué » ni de filtrage de lignes par groupe : `predicat_lignes` reste constamment vrai en v1 (§6), et l'union des rôles interdit tout `deny`.
- Pas de permissions de champ dans la grille elle-même : la grille s'arrête aux tables, et « Champs », sur chaque ligne de table, ouvre l'écran de §3.3 qui règle `field_permission` groupe par groupe.
- Pas de délégation par les groupes : un membre de groupe ne peut pas accorder à un autre ce qu'il a ; seul le groupe « Administrateurs » administre les groupes et la grille. Le partage de §15.8 est la seule délégation, bornée à ce que l'on gère.

### 15.8 Partager un projet ou une base

Qui a **« Gestion »** sur un projet ou une base le partage, sans élévation — c'est le geste quotidien d'une équipe, pas l'administration du tenant :

- **inviter** une personne à un niveau (Lecture, Édition, Gestion) : un **lien** à usage unique, valable sept jours (`_basedb.invitation`, secret scellé comme celui d'un formulaire partagé, remontré à qui gère tant qu'il attend). La personne l'ouvre, se connecte ou crée son compte — même quand la création de comptes est fermée —, et reçoit l'accès ; jamais moins que ce qu'elle avait déjà ;
- voir **qui a accès** — personnes et groupes —, **changer** le niveau d'une personne ou le **retirer** ; jamais le sien, ce qui pourrait laisser un projet sans gestionnaire ;
- **annuler** une invitation en attente.

Ce qui est partagé à une personne va sur son **rôle personnel** (`role.kind = 'person'`, son seul membre, jamais listé parmi les groupes) : le décideur, qui ne connaît que des rôles, n'a rien de plus à savoir. Le partage ne dépasse jamais sa portée : le gestionnaire d'une base partage cette base, pas son projet, et un accès qui vient du projet ne se change que depuis le partage du projet (`ACTION_FORBIDDEN`, raison `herite`). Aucun niveau n'excède « Gestion », que détient qui partage. Au moment d'accepter, l'auteur de l'invitation doit **toujours** gérer la portée : une invitation faite par quelqu'un qui a perdu ce droit ne donne plus rien. On ne partage qu'à qui l'on invite : l'annuaire du tenant n'est pas une liste où choisir des inconnus.

---

## État de la mise en œuvre (v1)

**Règles de champ.** L'écran exigé par §3.3 existe, sous la grille de §15 : chaque ligne de
table y porte « Champs », qui ouvre la matrice champs × groupes ayant accès à la table. Une
cellule vaut « Selon le niveau », « Lecture seule » ou « Masqué » — les lignes
`field_permission` `read` et `hidden` ; « selon le niveau » est l'absence de ligne. Une
règle posée pour un groupe qui n'atteint pas la table est refusée (`PERMISSION_OUT_OF_SCOPE`),
une règle sur les Administrateurs aussi (`GROUP_SYSTEM_IMMUTABLE`), et toute écriture exige
une session élevée (§15.6). Le second volet de l'écran répond à la question de §3.3 pour une
personne choisie : le niveau effectif de chaque champ, calculé par le décideur lui-même, les
groupes par lesquels il reste lisible et ceux dont la règle est ainsi contournée.

**Calcul du masque.** Le décideur applique §4.1 à la lettre : pour chaque rôle lisant la
table, le niveau d'un champ est sa règle quand il en a une, sinon `write` si le rôle crée
ou modifie des lignes et `read` sinon ; le niveau du champ est le plus haut sur les rôles.
Une première version prenait l'union des verbes puis soustrayait les champs restreints par
**tous** les rôles lecteurs : un champ rendu « lecture seule » par le seul groupe qui écrit
redevenait modifiable dès qu'un autre groupe de la personne lisait la table. Corrigé, avec
son test.

**Pas encore faits.** Les clôtures de §4.1 — formules et contraintes croisées — n'ont pas
d'objet tant que ces deux constructions n'existent pas dans le produit ; l'avertissement de
l'éditeur de permissions qui les accompagne non plus.


## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Le RBAC ne gouverne que les surfaces du produit ; l'accès SQL direct est hors périmètre et affiché comme tel | Promettre une protection qu'on ne tient pas est pire que l'absence de protection | Prétendre à une impossibilité générale de contournement |
| Cloisonnement tenant évalué avant `is_instance_admin` | Sans cela, la garde d'exécution refuse ce que le décideur autorise, et le test de surfaces doit être exempté | Admin d'instance au-dessus du cloisonnement |
| Liste de sept verbes fermée ; les opérations dangereuses sont des opérations réservées ; aucun droit d'instance nommé | Non délégables par `manage_permissions`, et le `CHECK` du catalogue reste stable | Verbes `purge`, `rename_physical`, `cascade` ; droits `integration.manage` et `tenant.admin` |
| Union des rôles, sans `deny` | Ajouter un rôle ne doit jamais retirer un accès | « La plus restrictive gagne » |
| `capacites(jeton) = rôle ∩ créateur`, recalculée à chaque décision | Ferme la fabrication d'un jeton plus puissant que soi et l'élargissement différé par modification du rôle | Vérification d'inclusion à la seule création |
| Un rôle porté par un jeton ne peut pas porter `manage_schema` | Un jeton fuité ne doit pas valoir un compte concepteur ; rend cohérente la confirmation humaine sur les migrations | Laisser le DDL par jeton, ou interdire aussi `delete` |
| Trois codes distincts pour l'état d'un jeton — `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, tous en 401 | « Absence plutôt qu'erreur » protège l'existence des ressources, pas l'état d'un secret que l'appelant présente lui-même ; le porteur doit savoir s'il renouvelle son jeton ou s'adresse à un administrateur, et deviner un jeton reste hors de portée | Code unique `TOKEN_INVALID` couvrant les trois causes |
| Le filtre de surface retire au MCP l'approbation de migration et la confirmation | Un agent ne doit pas proposer puis approuver dans le même enchaînement : c'est le député confus | Se fier à `actor_kind = 'user'`, satisfait par une session MCP portée par un humain |
| Élévation temporaire de 5 minutes sur les opérations privilégiées, vérifiée par le noyau | Une charge exécutée dans l'application ne doit pas suffire à s'ajouter à un rôle | S'en remettre à l'assainisseur HTML |
| Colonnes système toujours lisibles dès que `read` est accordé, jamais inscriptibles, non masquables (A18) | La reprise incrémentale d'un consommateur doit rester possible quel que soit son masque ; le curseur et le tri en dépendent | Option de visibilité d'audit par table, ou fermeture par défaut dès qu'un champ est masqué |
| Webhook porteur de son propre rôle, masque de lecture complet exigé, revalidé à toute modification (A19) | Le cadrage veut une charge utile complète ; un consommateur amputé sans le savoir est pire qu'un consommateur désactivé | Projection de la charge utile avec les permissions effectives du rôle |
| Capture par déclencheur sans masque, projection à l'émission depuis `change_event` (A10) | Le masque reste une condition de la projection sur le seul chemin sortant, sans dupliquer les images de lignes | Boîte d'envoi propre au chapitre, contexte système à masque complet puis filtrage en mémoire |
| Clôture des formules et des contraintes croisées, sur `field_formula_dependency` et `table_constraint_member` | Sans elles, une formule `salaire * 1` ou un `CHECK (prime <= salaire)` restitue un champ masqué | Dérogation déclarée par champ |
| Table visible sans aucun champ lisible → `INVISIBLE` | Sinon le constructeur SQL doit émettre zéro colonne ou `*`, et *n* objets vides divulguent l'activité | Repli sur `_id` |
| Lien dont la cible est illisible : `{"id": null, "display": null, "masked": true}` (A16) | Ferme la fuite d'horodatage de l'UUIDv7 sans créer un second espace d'identifiants absent du catalogue, d'OpenAPI et du MCP | Identifiant natif, retrait de la colonne, ou valeur opaque calculée par HMAC |
| Quatrième ensemble `champs_effacables` dans la décision | L'exception « NULL autorisé » doit vivre dans la décision, pas dans l'adaptateur REST | Re-tester le cas dans le transport, ou supprimer l'exception |
| `predicat_lignes` dans la décision, constamment vrai en v1, toujours émis (A20) | Fige la surface sans rien implémenter et rend écrivable le test qui garantit le point d'application unique | Pas de prédicat, ou permission de ligne réelle en v1 |
| Invariant du constructeur SQL formulé côté données, avec liste close de formes bannies | `to_jsonb(t)` et `RETURNING *` projettent une ligne entière sans écrire `*` | Contrôle syntaxique sur la chaîne `SELECT *` |
| Séquence normative authentification → décision → réduction au masque → validation → exécution | Un validateur monté en amont transforme toute table invisible en oracle de schéma | Validation à la lisière du transport |
| Aucun point d'entrée d'export ; l'extraction passe par la pagination par curseur (A21) | Un flux illimité percerait le plafond que toutes les autres règles construisent | Export traité comme un chemin de lecture ordinaire |
| Clé de cache de la spécification incluant le tenant, `is_instance_admin` et `authz_version`, durée de vie 30 s | Une révocation doit fermer la spécification aussi vite que les données | Clé sur (rôles, `catalog_version`) sans durée de vie |
| `tenant.authz_version` est l'unique compteur d'invalidation des droits | Deux noms pour le même compteur divergent dès la première écriture | Compteur distinct côté API |
| Aucun contexte système sans tenant ; garde inversée sur le pool `catalogue` | Le cloisonnement doit valoir d'abord là où plusieurs tenants sont parcourus | Exempter les tâches de fond |
| La réconciliation catalogue ↔ `pg_catalog` est un contrôle de sécurité exécuté après chaque migration | Seul contrôle capable de voir que la base ne ressemble plus à ce que le décideur croit | Se fier au `CHECK` de catalogue et au déclencheur du dernier administrateur |
| Cascade : concession réservée, confirmée et tracée par `cascade_grant` ; décompte et confirmation à l'exécution ; chaîne exécutée par PostgreSQL (A14) | Le cadrage demande un rôle admin et une confirmation ; « vraies tables SQL » impose que la clause soit réellement émise | Cascade applicative niveau par niveau, ou absence de confirmation à l'exécution |
| Traduction des `SQLSTATE` renvoyée au noyau ; ce chapitre ne fixe que la règle de divulgation | Une table de correspondance écrite cinq fois diverge cinq fois | Cartographie complète répétée ici |
| Un utilisateur appartient à exactement un tenant en v1 | Le cadrage demande le nommage, pas la fonctionnalité multi-tenant | Sélecteur de tenant par session |
| Codes d'erreur en anglais, registre unique `_basedb.error_code` (A2, A23) | Un registre bilingue diverge dès le chapitre suivant | Codes machine en français |
| Les vues enregistrées existent en v1 et suivent le régime de leur table ; pas de vue SQL | Une présentation n'a pas de droits propres ; une vue SQL exposerait des colonnes non gouvernables par `field_permission` | Sortir `view_def` du périmètre v1, ou lui donner ses permissions |
| Délai avant purge renvoyé à « 06 — Cycle de vie », rétentions à `retention_policy` | Une valeur fixée à deux endroits diverge | Imposer les durées ici |
| Portée *projet* au-dessus de la base, sans existence physique (§15.1) | Naviguer et accorder par regroupement sans renommer aucun schéma | Base de bases, ou schéma par projet |
| Droits accordés à des groupes, quatre niveaux fermés écrits comme des lignes `permission` (§15.3) | L'administrateur raisonne en « qui peut lire ou modifier quoi », le décideur continue de raisonner en verbes | Nouvelle table de niveaux, ou grille verbe par verbe |
| « Granulaire » par explosion de l'octroi parent (§15.4) | Abaisser un seul enfant sans introduire de `deny` | Refus explicite sur l'enfant |
| Mot de passe temporaire montré une fois et changement obligatoire (§15.5) | Aucun courrier en v1, et l'administrateur ne doit pas connaître un mot de passe en usage | Mot de passe choisi par l'administrateur |
| Changements de la grille appliqués immédiatement, sous élévation (§15.4, §15.6) | Un brouillon non enregistré est un droit que l'on croit posé | Brouillon à valider |

---

## Risques et limites connues

1. **Le masque de champs ne protège pas d'un accès SQL direct** (§0). C'est une propriété voulue du produit, pas un défaut, mais elle limite la valeur de sécurité de `field_permission` à ce que voient les surfaces. Un exploitant qui héberge une donnée réellement sensible doit poser des `GRANT` PostgreSQL, hors périmètre v1.
2. **Le modèle additif rend le masquage fragile à l'ajout d'un rôle.** Un champ masqué par un rôle reste lisible par un autre. L'écran de masque effectif est la contrepartie obligatoire ; sans lui, le modèle est correct et inutilisable.
3. **Aucun contrôle posé en base ne résiste au rôle propriétaire.** Contraintes et déclencheurs protègent d'une erreur, jamais d'un opérateur décidé. Le filet réel est la réconciliation, l'alerte et la trace (§6.5), qui sont détectives, pas préventives.
4. **Révocation bornée à 30 secondes.** Assumé en v1. Une révocation instantanée demanderait un compteur d'époque par sujet consulté à chaque requête, donc une lecture de catalogue par requête — l'inverse de la propriété de §7.2 sur les temps de réponse.
5. **Trois oracles résiduels documentés** : refus pour cause de référence, violation d'unicité, cardinalité et activité d'une table visible via `_updated_at` (§7.3). Aucun n'est fermable sans casser une fonction attendue ; le troisième est explicitement retenu par A18.
6. **La clôture des formules et des contraintes croisées peut surprendre.** Masquer un champ rend invisibles des formules et non inscriptibles des champs apparemment sans rapport. Les avertissements de l'éditeur de permissions sont la seule atténuation, et ils doivent être écrits avec soin.
7. **Une réduction de droits pendant une lecture longue est bornée à 10 000 lignes** (§3.5), pas à zéro. Une pagination de 100 000 lignes commencée juste avant une révocation livre jusqu'à un lot sous l'ancien droit.
8. **Pendant une cascade, aucun droit n'est revérifié table par table** (§5.7). La chaîne est exécutée par PostgreSQL ; le décompte et la confirmation précèdent l'exécution, ils ne l'accompagnent pas. C'est la contrepartie d'A14, et c'est ce qui justifie que la concession soit une opération réservée.
9. **`_basedb.change_event` contient des images complètes de lignes hors des schémas `b_*`.** Aucune route ne l'expose et ses lignes sont purgées à 7 jours, mais toute sauvegarde ou réplication du schéma `_basedb` doit en tenir compte.

---

## Questions ouvertes

1. **Compteur d'époque de session par utilisateur** : faut-il ajouter à `app_user` un compteur consulté à chaque requête pour obtenir une révocation véritablement instantanée en cas de compromission ? Le coût est une lecture par requête, en contradiction avec la propriété de temps constant de §7.2.
2. **Ré-authentification forte des opérations réservées** : l'élévation de §2.2 accepte le mot de passe, et c'est la seule preuve possible en v1 — le chapitre 13 §9 place le deuxième facteur et WebAuthn hors périmètre, en annonçant que l'élévation les acceptera comme preuve le jour venu. Ce chapitre ne suppose donc aucun facteur enrôlé. Ce qui reste à trancher est pour ce jour-là : le second facteur devra-t-il être exigé sur **toutes** les opérations réservées, ou seulement sur celles des administrateurs d'instance — et son enrôlement devra-t-il alors être rendu obligatoire pour ces derniers ?
3. **Notifications de sécurité** : la notification envoyée à chaque changement de rôle et création de jeton (§2.2) suppose un canal configuré à l'instance, dont la définition relève de « 13 — Authentification ». Faut-il refuser ces opérations lorsqu'aucun canal n'est configuré, ou se contenter de la trace `audit_log` ?
4. **Seuil de confirmation renforcée d'une cascade** : 5 000 lignes atteintes est une valeur par défaut ; faut-il la rendre configurable par tenant, ou la laisser à l'instance ?

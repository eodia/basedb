# 13 — Authentification

Ce chapitre spécifie comment un humain prouve son identité à basedb, comment cette
preuve devient une session, et comment une session devient temporairement élevée.
Il ne dit rien des droits qui en découlent.

## 1. Frontière

| Sujet | Chapitre normatif |
|---|---|
| Qui a le droit de faire quoi : rôles, verbes, portées, point d'application | « Modèle de permissions » |
| Tables `app_user`, `auth_identity`, `session`, `confirmation_challenge`, `setting`, `secret` | « Schéma du catalogue `_basedb` » |
| Jetons d'intégration (`api_token`), surface HTTP `/api/v1`, seaux à jetons | « API REST, OpenAPI, webhooks, jetons d'intégration » |
| Preuve d'identité, forme des sessions, élévation, amorçage, plan d'URL `/auth/*` | **ce chapitre** |

Trois conséquences opposables.

**Ce chapitre produit un acteur, il n'en déduit aucun droit.** L'authentification
répond « cette requête est portée par `app_user.id = X`, dans le tenant `T`, sur la
surface `ui` ou `rest`, avec ou sans élévation ». Le point d'application décide seul de
la suite.

**Les jetons d'intégration ne sont pas des sessions.** Un `api_token` est une identité
machine créée par un humain et bornée par les capacités de son créateur ; il n'a ni mot
de passe, ni fournisseur d'identité, ni élévation possible. Aucune route `/auth/*` ne
l'accepte : sa présentation y produit `401 AUTHENTICATION_REQUIRED`. Symétriquement, un
jeton d'accès de session n'est jamais délivré à une intégration.

**`/auth/*` est hors `/api/v1`.** Ces routes ne portent pas de référence de tenant dans
leur chemin, ne figurent pas dans la spécification OpenAPI, et sont les seules à
accepter le cookie de session.

## 2. Authentification par mot de passe

### 2.1 Stockage

Une identité mot de passe est une ligne `_basedb.auth_identity` avec
`provider = 'password'`, `subject` = l'adresse électronique normalisée, et
`password_hash` non nul. Un utilisateur en a au plus une
(`uq_identity_one_password_per_user`).

L'algorithme est **argon2id**, sans alternative : 64 Mio de mémoire, 3 passes,
parallélisme 1, sel aléatoire de 16 octets, empreinte de 32 octets. La valeur stockée
est la chaîne PHC complète, paramètres inclus, précédée de la version de clé
d'instance ; un changement de paramètres n'invalide donc rien et déclenche un
recalcul silencieux à la connexion suivante.

Le mot de passe est normalisé en NFKC, puis **poivré** avant hachage : la valeur
soumise à argon2id est `HMAC-SHA256(poivre, mot de passe)`, le poivre étant dérivé par
séparation de domaine de la clé d'instance `BASEDB_ENCRYPTION_KEY` (A25) et ne
résidant jamais en base. Une copie du volume, un `pg_dump` ou une sauvegarde égarée ne
suffisent donc pas à monter une attaque par dictionnaire. Pendant une rotation,
l'ancienne version de clé reste acceptée en vérification et la ligne est recalculée à
la connexion suivante.

### 2.2 Politique

| Règle | Valeur | Raison |
|---|---|---|
| Longueur | 8 caractères minimum, 256 maximum | Seule mesure à l'effet démontré ; au-delà, déni de service par coût de hachage |
| Composition imposée | **aucune** | Elles produisent `Motdepasse2024!`, pas de l'entropie |
| Expiration périodique | **aucune** | Elle produit l'incrémentation d'un chiffre final |
| Liste de refus | liste locale livrée avec le produit, extensible par l'exploitant | A4 : aucun appel à un service tiers de réputation |
| Similarité | refus si le mot de passe contient l'adresse, sa partie locale ou le nom affiché | — |
| Réutilisation | non contrôlée, aucun historique conservé | Des empreintes anciennes agrandissent la surface volée sans réduire le risque courant |

Tout refus est `422 PASSWORD_POLICY_VIOLATION` avec son motif : il s'adresse à quelqu'un
qui a déjà prouvé son identité, il n'y a rien à ne pas divulguer.

### 2.3 Changement et réinitialisation

**Changement** (`POST /auth/password/change`) : session valide, mot de passe courant
exigé, nouveau mot de passe soumis à la politique. Effets, dans une seule
transaction : `password_hash` remplacé, `must_change_password` remis à faux,
`failed_attempts` et `locked_until` remis à zéro, **toutes les sessions de
l'utilisateur révoquées** avec `revoked_reason = 'password_changed'`, et une session
neuve émise pour l'appelant. Un courriel de notification part vers l'adresse du
compte.

**Réinitialisation** : le défi est porté par `_basedb.confirmation_challenge` avec
`operation = 'password.reset'`, `target_kind = 'app_user'`, `target_id` =
l'utilisateur, `session_id` nul, `challenge_hash` = SHA-256 d'un secret de 256 bits,
`expires_at` = 30 minutes. Aucune table nouvelle : cette table porte déjà exactement
la sémantique « secret à usage unique, lié à un acteur et à un objet, expirant ».

1. `POST /auth/password/reset/request` avec une adresse : réponse **toujours** `202`,
   immédiate, sans attendre l'envoi.
2. Si et seulement si l'adresse correspond à un compte vivant disposant d'une identité
   `password`, les défis ouverts du même utilisateur sont consommés, un défi neuf est
   créé et un courriel part avec un lien portant le secret. Un compte désactivé,
   inexistant, ou dont la seule identité est un fournisseur OIDC ne reçoit **rien** :
   créer un mot de passe par courriel contournerait le fournisseur que le tenant a
   choisi.
3. `POST /auth/password/reset/confirm` consomme le défi, applique la politique, et
   produit les mêmes effets qu'un changement, révocation globale comprise.

**Le canal est le courriel, par SMTP configuré par l'exploitant.** Pas d'autre en v1 :
ni SMS, ni question secrète, ni code hors bande. Sans SMTP configuré, l'étape 1 répond
`202` et rien ne part ; la voie de secours est la commande d'exploitation du §7.

### 2.4 Verrouillage

`auth_identity` porte un compteur d'échecs consécutifs, `failed_attempts`, et une date
de fin de verrouillage, `locked_until`, toutes deux données par « Schéma du catalogue
`_basedb` ». Au dixième échec consécutif, `locked_until` est posé à 15 minutes,
puis 30, 60, 240 minutes et enfin 24 heures pour les verrouillages suivants sans succès
intercalé. Une authentification réussie remet le compteur à zéro. Le titulaire reçoit un
courriel, au plus un par fenêtre.

Ce verrouillage est **exact**, parce qu'il est une mise à jour de ligne, là où les seaux
à jetons de « API REST, OpenAPI, webhooks, jetons d'intégration » sont approximatifs
avec plusieurs instances applicatives (A4). La défense contre le bourrage d'identifiants
ciblé ne repose donc pas sur eux.

### 2.5 Non-divulgation

**Aucune réponse d'authentification ne permet de distinguer un compte inexistant d'un
compte existant.** Règle unique, sans exception :

- échec de connexion, quelle qu'en soit la cause — adresse inconnue, mot de passe faux,
  compte désactivé, verrouillé ou supprimé logiquement — : `401 CREDENTIALS_INVALID`,
  même corps, même message ;
- si l'adresse ne correspond à aucune identité `password`, un hachage argon2id
  **factice** est exécuté contre une empreinte constante, avec les mêmes paramètres :
  sans cela, la durée de réponse serait l'oracle que le code d'erreur évite ;
- la demande de réinitialisation répond `202` dans tous les cas (§2.3) ;
- le verrouillage n'est jamais annoncé : l'apprendre, c'est apprendre que le compte
  existe ;
- aucune route `/auth/*` n'expose, avant authentification, la référence du tenant, le
  nom affiché ou les fournisseurs liés à une adresse.

L'interface affiche invariablement : « Identifiants incorrects, ou compte
indisponible. »

## 3. OAuth / OIDC

### 3.1 Périmètre

**OpenID Connect uniquement, avec découverte** (`/.well-known/openid-configuration`) :
trois préréglages livrés — Google Workspace, Microsoft Entra ID, Keycloak — plus un
fournisseur OIDC générique. OAuth 2.0 sans couche OIDC, dont GitHub est le cas typique,
est **hors v1** : sans jeton d'identité signé, la validation se réduit à un appel de
profil non lié cryptographiquement à l'échange, et chaque fournisseur exige son propre
code.

### 3.2 Configuration

Un fournisseur est déclaré **au niveau instance**, dans `_basedb.setting` sous les clés
`auth.oidc.<slug>.*` (découverte, identifiant client, portées, provisionnement, domaines
acceptés), son secret client vivant dans `_basedb.secret` sous
`auth.oidc.<slug>.client_secret`, chiffré par la clé d'instance (A25). Un tenant peut
**restreindre** la liste aux fournisseurs qu'il accepte, par une ligne `setting` de
portée `tenant` ; il ne peut pas en déclarer un. Résolution en deux temps comme tout
réglage.

Raison de l'asymétrie : choisir un fournisseur, c'est choisir qui signe les identités de
ses utilisateurs — donc le pouvoir de s'en fabriquer. La déclaration est un acte
d'exploitant.

`auth_identity.provider` vaut `'oidc:<slug>'` et `subject` la revendication `sub` du
fournisseur, **jamais l'adresse électronique** : le `sub` est stable, l'adresse ne
l'est pas.

### 3.3 Flux retenu

**Code d'autorisation avec PKCE `S256`, client confidentiel**, `response_mode=query`,
`nonce` obligatoire. Les flux implicite et hybride sont exclus : ils font transiter un
jeton d'identité par l'URL, donc par l'historique du navigateur, le `Referer` et les
journaux des intermédiaires. PKCE s'ajoute au secret client parce qu'il neutralise
l'interception du code au retour, que le secret ne protège pas.

L'état de l'échange — `state`, `nonce`, vérificateur PKCE, adresse de retour interne —
voyage dans un cookie `__Host-basedb_oidc`, `HttpOnly`, `Secure`, `SameSite=Lax`,
scellé par la clé d'instance, valable 10 minutes. `Lax` est ici nécessaire et
suffisant : le retour du fournisseur est une navigation `GET` de premier niveau. Aucun
stockage serveur, donc aucune table (A4).

### 3.4 Validation du jeton reçu

Refus `401 OIDC_TOKEN_INVALID` si l'un des contrôles échoue, sans détail :

1. signature vérifiée contre le JWKS du fournisseur, récupéré par découverte, mis en
   cache et rafraîchi sur `kid` inconnu au plus une fois par minute ; algorithmes
   asymétriques seuls, `none` et les algorithmes symétriques refusés ;
2. `iss` identique à l'émetteur découvert ; `aud` contenant l'identifiant client ;
   `azp` égal à l'identifiant client s'il est présent ;
3. `exp` non dépassé, `iat` dans une fenêtre de 120 secondes de tolérance d'horloge ;
4. `nonce` égal à celui du cookie d'échange ; `state` idem, comparé en temps constant ;
5. `sub` présent et non vide ; `email` présent et `email_verified` vrai, sauf si le
   fournisseur est déclaré de confiance sur son domaine.

`userinfo` n'est interrogé que si `email` manque du jeton d'identité. Le jeton d'accès
du fournisseur n'est ni stocké ni réutilisé, et aucun jeton de rafraîchissement n'est
demandé : basedb n'appelle aucune API du fournisseur.

### 3.5 Association, première connexion, provisionnement

**Le rattachement se fait par `sub`, jamais par adresse.** Séquence :

1. Une ligne `auth_identity` existe pour `('oidc:<slug>', sub)` → session ouverte pour
   son `user_id`. L'adresse du compte est mise à jour si elle a changé chez le
   fournisseur et que la nouvelle adresse est libre dans le tenant.
2. Sinon, si l'adresse correspond à un compte vivant du tenant **sans identité pour ce
   fournisseur** → refus `409 OIDC_ACCOUNT_LINK_REQUIRED`. **Aucune association
   automatique par adresse** : un fournisseur qui laisse revendiquer une adresse qu'il
   ne vérifie pas transformerait sinon toute connexion OIDC en prise de contrôle d'un
   compte à mot de passe. L'association se fait dans l'autre sens — session ouverte au
   mot de passe, puis `POST /auth/oidc/{slug}/link`, qui exige une session **élevée**.
3. Sinon, aucun compte ne correspond : le provisionnement décide.

**Le provisionnement automatique est désactivé par défaut.** Le réglage
`auth.oidc.<slug>.provisioning` vaut `off` (défaut) ou `domains` avec une liste
explicite de domaines d'adresse ; hors de ces cas, `403 PROVISIONING_REFUSED` et aucun
compte n'est créé. Quand il est actif, le compte créé l'est **sans aucune appartenance
à un rôle** : il ouvre une session, ne voit rien, et attend qu'un administrateur lui en
accorde un. Les droits ne se distribuent pas depuis l'annuaire d'un tiers.

Divulgation résiduelle, assumée : ces deux codes apprennent à l'appelant si l'adresse
qu'il vient de prouver chez le fournisseur possède un compte basedb. Il a déjà démontré
le contrôle de cette adresse ; la règle du §2.5 ne porte donc pas ici.

## 4. Sessions

### 4.1 Forme et transport

Une session est une ligne `_basedb.session`. Son jeton est 256 bits d'un générateur
cryptographique, en base64url, préfixé `bds_` ; seule son empreinte SHA-256 est stockée
(`session.token_hash`), et la comparaison est faite en temps constant. Il voyage dans un
cookie `__Host-basedb_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, chemin racine,
**accepté par les seules routes `/auth/*`**.

Les appels `/api/v1` sont authentifiés par un **jeton d'accès** en
`Authorization: Bearer`, obtenu par `POST /auth/session/access` contre le cookie et
l'en-tête `X-Basedb-Csrf`, comme l'exige « API REST, OpenAPI, webhooks, jetons
d'intégration ». Ce jeton est préfixé `bda_` et **dérivé de la session**, non stocké :

```
bda_ + base64url( session_id ‖ expire_le ‖ HMAC(clé d'instance, session_id ‖ expire_le ‖ session.token_hash) )
```

Il ne demande donc ni colonne ni table supplémentaire, et il porte sa liaison à la
session : **faire tourner `session.token_hash` invalide instantanément tous les jetons
d'accès émis**, ce qui donne la révocation globale sans rien à parcourir.

Sa durée de 15 minutes est une **durée de renouvellement, pas une fenêtre de validité
non vérifiée** : chaque requête relit l'instantané de la session — `revoked_at`,
`absolute_expires_at`, `disabled_at` — dont « Modèle de permissions » borne la
fraîcheur à 30 secondes et compare les dates à l'horloge du serveur à chaque décision.
Une révocation prend effet en 30 secondes au pire, jamais en 15 minutes.

### 4.2 Durées, renouvellement, concurrence

| Propriété | Valeur |
|---|---|
| Inactivité | 12 heures sans requête (`last_seen_at`, écriture bridée à cinq minutes) |
| Durée absolue | 30 jours, non prolongeable : ré-authentification complète au terme |
| Jeton d'accès | 15 minutes, renouvelable tant que la session vit |
| Rotation du jeton de session | à chaque authentification, à chaque élévation, à chaque changement de mot de passe ; l'ancien est révoqué dans la même transaction |
| Sessions concurrentes | autorisées, plafonnées à 10 sessions vivantes par utilisateur ; au-delà, la plus ancienne est révoquée avec `revoked_reason = 'session_cap'` |

Le plafond borne une table petite et chaude, et rend la liste des sessions lisible d'un
coup d'œil à son titulaire.

### 4.3 Révocation

| Déclencheur | Portée |
|---|---|
| `DELETE /auth/session` | la session courante |
| `DELETE /auth/sessions/{id}` | une session du titulaire, ou de n'importe qui pour un administrateur de tenant |
| `DELETE /auth/sessions` | toutes les sessions du titulaire, courante comprise |
| Changement ou réinitialisation de mot de passe | toutes les sessions de l'utilisateur |
| Désactivation (`disabled_at`) ou suppression logique du compte | toutes les sessions de l'utilisateur |
| Dissociation d'une identité OIDC | toutes les sessions ouvertes par ce fournisseur |

Toute révocation pose `revoked_at` et `revoked_reason`, émet `NOTIFY basedb_authz` dans
la même transaction et incrémente `tenant.authz_version`. `GET /auth/sessions` liste les
sessions vivantes du porteur — création, dernière activité, adresse IP, agent
utilisateur tronqué — et rend la révocation unitaire utilisable.

## 5. Élévation

L'élévation est l'unique mécanisme par lequel une session devient temporairement capable
des écritures de permission, de jeton et de webhook, et des opérations réservées
énumérées par « Modèle de permissions ». Ce chapitre en spécifie l'obtention ; celui-là
en spécifie l'exigence.

| Question | Décision |
|---|---|
| Déclenchement | `POST /auth/elevate`, à l'initiative du client, avant l'opération |
| Preuve | Mot de passe courant ; pour un compte sans identité `password`, un aller-retour OIDC neuf avec `prompt=login` et `max_age=0`, dont l'`auth_time` doit être postérieur à la demande |
| Durée | 5 minutes, `session.elevated_until` |
| Portée | **La session, non l'objet** : un état de session, vérifié par le point d'application, qui ne vise ni table ni base |
| Prolongation | Aucune : une nouvelle preuve est exigée, jamais un glissement à l'usage |
| Surfaces | `ui` et `rest` seulement ; le filtre de surface retire déjà les opérations réservées à une session MCP |
| Révocation | Expiration ; `DELETE /auth/elevation` ; déconnexion ; changement de mot de passe ; désactivation du compte ; changement d'appartenance à un rôle du porteur ; révocation de la session |

**L'élévation ne suffit pas aux opérations réservées** : celles-ci exigent en outre un
jeton de confirmation à usage unique, lié à l'acteur, à l'objet et à la nature de
l'opération, porté par `_basedb.confirmation_challenge` et délivré selon « Modèle de
permissions » — le renommage physique, la purge et la concession d'un
`ON DELETE CASCADE` (A14) en sont les trois usages structurants.

Toute élévation, réussie ou refusée, produit une entrée `audit_log` ; la rotation du
jeton de session qui l'accompagne invalide les jetons d'accès en cours. Une élévation
n'est jamais silencieuse.

## 6. Routes

Toutes sous `/auth/`, sans référence de tenant, hors OpenAPI. `401` générique signifie
`AUTHENTICATION_REQUIRED` ou `SESSION_EXPIRED`.

| Route | Méthode | Porteur | Réponses |
|---|---|---|---|
| `/auth/password/login` | POST | — | `200` (cookie + jeton CSRF), `401 CREDENTIALS_INVALID`, `429` |
| `/auth/password/change` | POST | cookie | `204`, `401 CREDENTIALS_INVALID`, `422 PASSWORD_POLICY_VIOLATION` |
| `/auth/password/reset/request` | POST | — | `202` **toujours**, `429` |
| `/auth/password/reset/confirm` | POST | — | `200`, `400 RESET_TOKEN_INVALID`, `422 PASSWORD_POLICY_VIOLATION` |
| `/auth/oidc/providers` | GET | — | `200` : fournisseurs actifs, rien qui dépende d'une adresse |
| `/auth/oidc/{slug}/start` | GET | — | `302` vers le fournisseur, `404 OIDC_PROVIDER_UNKNOWN` |
| `/auth/oidc/{slug}/callback` | GET | cookie d'échange | `302`, `400 OIDC_STATE_INVALID`, `401 OIDC_TOKEN_INVALID`, `403 PROVISIONING_REFUSED`, `409 OIDC_ACCOUNT_LINK_REQUIRED` |
| `/auth/oidc/{slug}/link` | POST / DELETE | cookie **élevé** | `204`, `403 ELEVATION_REQUIRED` ; la dissociation est refusée sur la dernière identité |
| `/auth/session/access` | POST | cookie + `X-Basedb-Csrf` | `200` : jeton d'accès et échéance, `401` |
| `/auth/session` | DELETE | cookie | `204` |
| `/auth/sessions` | GET / DELETE | cookie | `200` ; `204` (révocation globale) |
| `/auth/sessions/{id}` | DELETE | cookie | `204`, `404` |
| `/auth/elevate` | POST | cookie | `200` : échéance d'élévation, `401 CREDENTIALS_INVALID` |
| `/auth/elevation` | DELETE | cookie | `204` |
| `/auth/bootstrap` | POST | secret d'amorçage | `200`, `401 BOOTSTRAP_SECRET_INVALID`, `404` si clos |
| `/auth/me` | GET | cookie ou jeton d'accès | `200` : identité, tenant, locale, fuseau, élévation restante |

**Limitation de débit et protection par identité sont deux mécanismes distincts, et
un seul des deux est exact.** Conformément à A4 et au §13.1 de « API REST, OpenAPI,
webhooks, jetons d'intégration », les seaux à jetons vivent **en mémoire de chaque
processus applicatif** : aucun compteur de débit n'est tenu en base. Aux
seaux du chapitre 08 s'ajoute un seul seau propre à `/auth/*`, au-delà duquel `429`
avec `Retry-After` :

| Seau | Limite | Nature |
|---|---|---|
| Par adresse IP, sur les routes sans porteur (`login`, `reset/request`, `callback`, `bootstrap`) | 10 tentatives par minute, pénalité exponentielle après une série d'échecs | En mémoire de processus, **approximative** avec plusieurs instances (A4), ramenée par l'affinité d'adresse au répartiteur |

**La protection contre le bourrage d'identifiants ne repose pas sur ce seau**, qui ne
voit qu'un processus et qu'une origine. Elle repose sur le verrouillage du §2.4 :
`auth_identity.failed_attempts` et `auth_identity.locked_until` sont des colonnes de
catalogue, écrites dans la transaction de la tentative, donc **persistantes, partagées
par toutes les instances et exactes**. C'est ce qui tient contre le bourrage distribué,
où chaque tentative vient d'une adresse différente : le compteur suit l'identité visée,
pas l'origine. **Aucune table de compteur par identité n'est créée** : les deux colonnes
existantes suffisent, et une table de compteurs par fenêtre glissante remettrait une
écriture en base sur le chemin de chaque tentative, ce que le §13.1 du chapitre 08
interdit. Il n'y a pas de contradiction : `/auth/*` n'est pas un chemin de lecture de
données à fort débit, et une tentative de connexion écrit déjà — création de session
au succès, compteur d'échecs à l'échec — sur une ligne dont l'identité visée est la
seule cliente.

`login` et `elevate` sont des tentatives d'authentification et alimentent toutes deux ce
verrouillage. `reset/request` n'en alimente aucun — il n'authentifie rien, et le lier à
une identité offrirait un moyen de verrouiller le compte d'autrui — : il n'est retenu
que par le seau d'adresse, compté **avant** la recherche du compte, sinon le coût de la
réponse serait un oracle.

Un dépassement sur `/auth/*`, comme un verrouillage, produit une entrée de
`_basedb.security_log` (rétention 180 jours, A24). Ces `429` ne portent ni
`X-RateLimit-Remaining` ni compteur : ils indiqueraient combien de tentatives restent.

## 7. Amorçage et perte du dernier administrateur

« Modèle de permissions » fixe la règle : aucun compte par défaut, aucun mot de passe
par défaut, et un secret d'amorçage dont seule l'empreinte est stockée, expirant en 30
minutes. Ce chapitre en donne le chemin.

1. Au premier démarrage, si `_basedb.app_user` ne contient aucun utilisateur réel,
   l'assistant d'installation crée en une transaction le tenant, ses rôles système et le
   premier `app_user` (`is_instance_admin = true`, `must_change_password = true`), et
   renseigne `bootstrap_secret_hash` / `bootstrap_secret_expires_at`.
2. `POST /auth/bootstrap` accepte le secret et un mot de passe conforme à la politique.
   Il crée l'identité `password`, renseigne `bootstrap_secret_consumed_at`, remet
   `must_change_password` à faux, ouvre une session et écrit `audit_log`
   `bootstrap.consumed`.
3. Une fois le secret consommé, ou l'échéance passée, la route répond `404` : l'amorçage
   n'existe plus. Une consommation tardive déclenche une alerte d'exploitation.

**Perte du dernier administrateur.** Le catalogue refuse par déclencheur la
désactivation, la suppression ou la rétrogradation du dernier administrateur vivant
(`LAST_INSTANCE_ADMIN`) : le produit ne peut pas créer cette situation. Si elle survient
tout de même — restauration partielle, correctif SQL appliqué avec le rôle propriétaire
— la sortie de secours est **une commande d'exploitation exécutée sur l'hôte**, exigeant
l'accès direct à la base et la clé d'instance. Elle promeut un utilisateur désigné,
force `must_change_password`, révoque ses sessions et écrit une entrée `audit_log` avec
`actor_kind = 'system'`. Aucune route HTTP ne l'expose : une porte de secours joignable
depuis Internet est une porte dérobée.

Si l'accès direct à la base est lui aussi perdu, il ne reste que la restauration depuis
sauvegarde, `BASEDB_ENCRYPTION_KEY` comprise (A25) : sans elle, les mots de passe
poivrés ne sont pas vérifiables et les secrets ne sont pas déchiffrables.

## 8. Hors v1

Décidé, et écrit ici pour qu'aucun autre chapitre ne le suppose présent :

**En v1** : mot de passe, OIDC avec découverte en code + PKCE, sessions, élévation,
amorçage. Rien d'autre.

| Hors v1 | Raison |
|---|---|
| Deuxième facteur TOTP | Ajout additif : une valeur de `provider` de plus et une table satellite, sans réécriture de ce chapitre |
| WebAuthn, clés d'accès | Même raison ; l'élévation les acceptera comme preuve le jour venu |
| SAML 2.0 | Modèle de confiance, format et outillage disjoints d'OIDC, pour un recouvrement fonctionnel total avec lui |
| LDAP, Active Directory en liaison directe | Un annuaire se branche par son fournisseur OIDC, qui existe chez tous les éditeurs concernés |
| SCIM, désactivation pilotée par l'annuaire | Dépend du provisionnement automatique, désactivé par défaut (§3.5) |
| Lien de connexion par courriel, connexion sans mot de passe | Ferait du courriel un facteur permanent, pas seulement un canal de secours |
| Appareils de confiance, exemption de ré-authentification | Affaiblit l'élévation, dernière barrière contre une charge exécutée dans l'application |
| Listes blanches d'adresses IP | Relève du proxy inverse de l'exploitant |

## 9. Codes d'erreur définis par ce chapitre

En anglais, en majuscules ASCII (A2), versés au registre unique (A23).

| Code | Déclencheur | HTTP |
|---|---|---|
| `CREDENTIALS_INVALID` | Tout échec d'authentification par mot de passe (§2.5) | 401 |
| `PASSWORD_POLICY_VIOLATION` | Mot de passe refusé par la politique (§2.2) | 422 |
| `RESET_TOKEN_INVALID` | Défi de réinitialisation inconnu, expiré ou consommé | 400 |
| `OIDC_PROVIDER_UNKNOWN` | `slug` non déclaré, ou non accepté par le tenant | 404 |
| `OIDC_STATE_INVALID` | `state`, `nonce` ou cookie d'échange absent, expiré ou discordant | 400 |
| `OIDC_TOKEN_INVALID` | Jeton d'identité en échec sur l'un des contrôles du §3.4 | 401 |
| `OIDC_ACCOUNT_LINK_REQUIRED` | Adresse déjà portée par un compte sans identité pour ce fournisseur | 409 |
| `PROVISIONING_REFUSED` | Aucun compte correspondant, provisionnement inactif | 403 |
| `BOOTSTRAP_SECRET_INVALID` | Secret d'amorçage faux ou expiré | 401 |

`LAST_INSTANCE_ADMIN` vient de « Schéma du catalogue `_basedb` ».
`AUTHENTICATION_REQUIRED`, `SESSION_EXPIRED` et `ELEVATION_REQUIRED` sont définis
par « Modèle de permissions » ; ils ne sont rappelés ici que pour la lisibilité
des routes d'authentification. Les codes de dépassement de débit sont ceux de
« API REST, OpenAPI, webhooks, jetons d'intégration » ; ceux du contrôle
d'origine appartiennent à « Modèle de permissions ».

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| argon2id poivré par la clé d'instance | Une base volée sans `BASEDB_ENCRYPTION_KEY` ne se casse pas hors ligne | argon2id seul ; bcrypt |
| Longueur 8 minimum, aucune composition imposée, aucune expiration, liste de refus locale | Composition et expiration produisent des mots de passe prévisibles ; A4 interdit un service tiers de réputation | Politique à classes de caractères ; appel externe |
| Message d'échec unique et hachage factice sur compte inconnu | Un code distinct ou une durée distincte sont le même oracle | Message explicite « compte inconnu » |
| Réinitialisation portée par `confirmation_challenge`, verrouillage porté par `auth_identity` | Sémantique déjà présente ; verrouillage exact malgré plusieurs instances (A4) | Table de jetons dédiée ; verrouillage par seau à jetons |
| OIDC seul, avec découverte, code + PKCE `S256`, état en cookie scellé | Un jeton signé lie l'identité à l'échange ; pas de jeton dans l'URL, pas de stockage serveur | OAuth 2.0 nu ; flux implicite ; état en base |
| Fournisseurs déclarés par l'instance, restreints par le tenant | Déclarer un fournisseur, c'est choisir qui signe les identités | Configuration par tenant |
| Aucune association automatique par adresse | Un fournisseur laxiste vaudrait sinon prise de contrôle de compte | Fusion silencieuse sur `email_verified` |
| Provisionnement désactivé par défaut, sans rôle à la création | Les droits ne se distribuent pas depuis l'annuaire d'un tiers | Création automatique avec rôle par défaut |
| Jeton d'accès dérivé de `session.token_hash` par HMAC, instantané relu à chaque requête | Révocation globale par rotation, effet en 30 s, sans table ni parcours | JWT autoporteur non révocable ; confiance jusqu'à l'échéance |
| 10 sessions vivantes par utilisateur | Borne une table chaude et rend l'écran de révocation lisible | Sessions illimitées |
| Élévation de 5 min, portée session, non prolongeable | Une élévation glissante ne se termine jamais | Élévation par objet ; prolongation à l'usage |
| Sortie de secours par commande locale seulement | Une récupération joignable depuis Internet est une porte dérobée | Route HTTP de récupération |
| 2FA, WebAuthn, SAML, LDAP, SCIM hors v1 | Recouvrement fonctionnel avec OIDC, ou ajout additif ultérieur | Les inscrire en v1 |

## Risques et limites connues

- **Le courriel est le point faible de la réinitialisation** : qui contrôle la boîte
  contrôle le compte à mot de passe. Un tenant qui ne l'accepte pas passe par OIDC et
  retire l'identité `password` de ses comptes.
- **L'absence de second facteur en v1** rend un mot de passe volé immédiatement
  utilisable, l'élévation exigeant le même secret. Le verrouillage limite l'exploitation
  massive, pas l'usage ciblé d'un identifiant déjà connu.
- **La fenêtre de révocation de 30 secondes**, héritée du cache d'autorisation : une
  session révoquée peut servir une dernière requête pendant cet intervalle.
- **La limitation par adresse IP est approximative** avec plusieurs instances (A4) ; la
  protection exacte est le verrouillage par identité du §2.4. Une attaque lente et
  distribuée sous le seuil du seau d'adresse et sous celui des dix échecs consécutifs
  reste possible, et c'est le journal de sécurité, non le blocage, qui la rend visible.
- **Le poivre lie l'authentification à une variable d'environnement.** La perdre rend
  tous les mots de passe invérifiables.
- **La rotation du jeton de session à l'élévation invalide les jetons d'accès en
  cours** : un client qui élève pendant un traitement long doit en reprendre un.
- **Un fournisseur OIDC compromis ouvre tous les comptes qui lui sont liés.** Le refus
  d'association automatique ne protège que les comptes non liés.

## Questions ouvertes

- Le plafond de 10 sessions vivantes n'a pas été confronté à un usage réel mêlant
  poste fixe, portable, téléphone et onglets de navigation privée ; il pourrait devoir
  être relevé ou rendu configurable par instance.
- Le retrait d'un fournisseur OIDC de la configuration d'instance laisse sans moyen de
  connexion les comptes provisionnés qui n'ont jamais eu de mot de passe. Faut-il
  refuser le retrait tant que de tels comptes existent, ou leur ouvrir une
  réinitialisation de mot de passe malgré la règle du §2.3 ?
- Le format du lien de réinitialisation reçu par courriel dépend de l'adresse publique
  du front, que l'interface et l'exploitation n'ont pas encore figée.

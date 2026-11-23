# Notes de la réécriture Rust

Écarts, décisions et surprises du code Node, au fil des lots. Ajoutez vos entrées sous le lot qui les a trouvées.

## La bascule (Node supprimé)

Les lots ci-dessous ont été écrits pendant la cohabitation : Rust servait ce qu'il savait et relayait le reste à Node. Ce qu'ils disent du relais, de `RUST_PORT`, de `BASEDB_RUST_BACKGROUND=1` ou de « ce qui reste à Node » décrit cette période. À la bascule :

- **Plus de relais.** `basedb_base::relay`, `API_UPSTREAM` et la couche `capture` sont retirés. Une route inconnue, ou une méthode non servie sur un chemin connu (`method_not_allowed_fallback`), répond le 404 de Node : `{"code":"NOT_FOUND",…}` (`basedb_base::app::not_found`). Les derniers cas relayés sont natifs ou refusés :
  - OIDC start, callback et `POST link` : natifs (`admin/src/oidc.rs`, testés contre un fournisseur simulé) ;
  - `POST /auth/introspect` en multipart : lu comme Hono (`multipart_field`) ;
  - `/api/v1/dev/account` : monté par le démarrage qui vient de créer l'administrateur avec `BASEDB_DEV_LOGIN=1` ;
  - les corps que Node lisait en `TypeError` (options, liens, champ d'affichage) : refusés comme invalides ;
  - un modèle avec automatisations : construit, `basedb-server` installe toujours le créateur ;
  - la file des courriels lit les pièces jointes dans le stockage, disque ou S3 (`records::storage`).
- **Le démarrage** (`server/src/socle.rs`) fait ce que faisait `apps/api/src/server.ts` : migration ou vérification du catalogue, `seedErrorCodes`, partitions mensuelles d'`audit_log` et `security_log` (au démarrage puis chaque jour), `reclaimStaleMigrations`, amorçage (`BASEDB_BOOTSTRAP`, `BASEDB_ADMIN_PASSWORD`).
- **Les tâches de fond sont allumées par défaut** (`BASEDB_RUST_BACKGROUND=0` pour les éteindre).
- **Ports et variables** : `PORT` (8787 par défaut, 3000 dans l'image) et `BASEDB_HOST` remplacent `RUST_PORT` et `RUST_HOST` ; `BASEDB_MCP_PORT=8788` en développement.
- **Les migrations sont embarquées** dans le binaire (`base/build.rs`) ; `CATALOG_MIGRATIONS_DIR` ne sert plus qu'à en lire d'autres. `APPLICATION_VERSION` est `CARGO_PKG_VERSION`. La garantie « une installation mise à jour = une installation neuve » est `server/tests/catalog_migrations.rs`.
- **Le frontal de l'image** (`server/src/front.rs`) remplace Caddy et `docker/image/start.mjs` : adresse du visiteur (`X-Forwarded-For` gardé seulement d'un mandataire du réseau privé), gzip, `/insights` relayé vers insights avec `BASEDB_INSIGHTS=1`. Sous-commandes `healthcheck` et `create-database`.
- **Le banc de parité** (`bench/`), qui comparait Rust à Node côte à côte, est retiré : il a rempli son office avant la bascule. Les notes ci-dessous qui le citent racontent ce qu'il a vérifié ; il reste dans l'historique git, avec le dernier état Node (`ecd79eeda5869f86104044eed51ffc68650e2d37`).

## Phase 0 — le socle

### Décisions

- **Port.** `RUST_PORT` vaut 8788 par défaut, comme le prévoit le plan. En développement, 8788 est pris par le serveur MCP de basedb (`BASEDB_MCP_PORT`). Le banc vise donc 8790 (`RUST_URL`).
- **Pas de `SET ROLE`.** Node n'en fait pas : les pools se connectent avec le rôle de `DATABASE_URL`, et l'acteur ne vit que dans les réglages `basedb.*` (`set_config(…, true)`), posés au début de chaque transaction. Rust fait exactement pareil (`tx::set_session_context`). Le plan évoquait des rôles : il n'y en a pas à reproduire.
- **Les jetons d'accès ne sont pas des JWT jose.** Ce sont des jetons HMAC maison (`auth/session.ts`), adossés à la session : rotation, révocation et élévation les invalident. Ils sont portés à l'identique (`auth::session::mint_access_token` / `access_token_valid`) et vérifiés croisés par le banc (Node vers Rust et Rust vers Node).
- **Les erreurs n'ont pas de message localisé côté serveur.** Le corps est `{"code","details","request_id"}`, et c'est le web qui traduit le code (catalogues `apps/web/src/locales`). `contracts` porte les locales (`match_locale`, `accepted_languages`) pour la langue d'écran (`/auth/me`, `/auth/demo`) et pour les courriels à venir. Il ne fabrique pas de message d'erreur.
- **Ce que la migration du catalogue laisse à Node.** Rust applique les migrations exactement comme `catalog-migrations.ts` :
  - même table `_basedb.catalog_migration` ;
  - même somme de contrôle (sha256 après CRLF→LF) ;
  - même verrou consultatif ;
  - même adoption « antérieure à 0.2.0 » ;
  - mêmes refus (`CATALOG_CHECKSUM_MISMATCH`, version future…) ;
  - mêmes messages.

  En revanche, `seedErrorCodes`, `ensureJournalPartitions`, `reclaimStaleMigrations` et l'amorçage (`BASEDB_BOOTSTRAP`) restent à Node tant qu'il tourne. Ils iront dans `server` (tâches de fond) quand Node partira.
- **`/api/v1/dev/account` reste relayée.** Node ne la monte que si CE processus a amorcé l'instance (`developmentEmail`). Rust n'amorce jamais, donc la route n'est montée que si `AppState::development_email` est renseigné, ce qui n'arrive pas encore.
- **Le relais.**
  - **Sur une route native** : le corps est tamponné (128 Mio au plus, sinon `BODY_TOO_LARGE`), parce qu'un gestionnaire peut rendre `relay::relay()` après avoir regardé la requête.
  - **Sur une route inconnue** (le fallback) : tout passe en flux.
  - **Dans les deux cas** :
    - les en-têtes hop-by-hop sont retirés ;
    - la réponse de Node est rendue telle quelle, sans CORS ni `x-request-id` ajoutés une seconde fois ;
    - l'`x-request-id` de Rust est transmis à Node, pour un seul identifiant par requête.

    Si Node est injoignable : `SERVICE_UNAVAILABLE` `{reason:'api_node_injoignable'}`.
- **Les caches sont par processus**, comme dans Node :
  - le limiteur de tentatives (10 par minute et par adresse) ;
  - le cache de vérification des jetons `bdb_*`.

  Tant que les deux serveurs tournent, chacun a le sien. Le compteur de verrouillage du compte (`auth_identity.failed_attempts`, tous les 10 échecs) est en base, donc partagé.
- **Les mots de passe.** argon2id avec les mêmes paramètres et le même poivre (HMAC de `BASEDB_ENCRYPTION_KEY`). Le calcul part dans `spawn_blocking`. En debug, `argon2` et `blake2` sont optimisés (`[profile.dev.package.*]`) : sinon, 2,7 s par connexion.
- **Le courriel.** Le transport SMTP passe par lettre, avec la même sémantique que `mail/transport.ts` : `secure`, `helo`, adresse `Nom <adresse>`. Avec `BASEDB_DEV_MAIL=1`, le courriel est journalisé au lieu d'être envoyé. Les gabarits localisés (`core/src/mail`) ne sont pas portés : ils iront dans `admin`, avec `/auth/password/reset/request`.
- **Les points d'extension.**
  - `listener::Listener` (LISTEN/NOTIFY, reconnexion) est prêt, mais pas encore branché : invalidations de cache et collaboration viendront avec les domaines.
  - `rbac::rows::set_row_rule_compiler` attend le compilateur de règles de lignes de `records`. Sans lui, une règle de ligne refuse : fail-closed.
- **Les tests.** `testing::test_app` complète la configuration avec celle de la pile de développement (`start-basedb.mjs` : `:55432`, clé de développement). Le `.env` du dépôt est vide.
- **Une transaction abandonnée ne retourne jamais ouverte au pool** (`tx::TxGuard`). Un gestionnaire dont le futur est lâché en cours de transaction (client parti, navigation du navigateur, délai, panique) rendait sa connexion au pool encore DANS la transaction : `RecyclingMethod::Fast` ne le voit pas. Le `BEGIN ISOLATION LEVEL REPEATABLE READ` suivant (l'instantané du catalogue) échouait alors en 25001 « SET TRANSACTION ISOLATION LEVEL must be called before any query », d'où un 500 sur `GET /meta/projects` et toute route qui lit l'instantané. `with_transaction` arme désormais un `TxGuard` après `BEGIN` : lâché armé, il envoie `ROLLBACK` depuis une tâche qui garde la connexion, qui ne rejoint le pool que propre. Test : `crates/catalog/tests/transactions.rs`. **À reprendre côté `admin`** : `signup.rs` (`bare_transaction`) et `outbox.rs` ouvrent un `BEGIN` à la main, sans garde.

### Surprises de Node (reproduites telles quelles)

- `POST /auth/session/access` sans en-tête CSRF, ou avec un CSRF faux, répond **401 `AUTHENTICATION_REQUIRED`**, pas 403. C'est la seule route qui demande le CSRF.
- `POST /auth/password/login` :
  - avec un corps JSON `null` : **500 `INTERNAL_ERROR`** (`TypeError` en déstructurant `null`) ;
  - avec un JSON invalide : 401 `CREDENTIALS_INVALID`.
- Une méthode non servie sur un chemin connu (`PUT /auth/me`) répond **404**, pas 405 : Hono n'a pas de 405. En Rust, `method_not_allowed_fallback` relaie à Node, qui répond son 404.
- `DELETE /auth/sessions/{id}` :
  - pour une session inconnue, ou celle d'un autre : 404 ;
  - pour un identifiant qui n'est pas un UUID : **422**, la traduction PostgreSQL de `22P02`.
- Il n'y a pas de `/api/v1/{tenant}/me` : la route d'identité (`whoAmI`) est `GET /auth/me`. `/api/v1/{tenant}/me/notifications` et `/me/tokens` appartiennent aux domaines.
- Le CORS de Hono :
  - ajoute `access-control-allow-credentials` et `access-control-expose-headers` **aussi au pré-vol** ;
  - ajoute `Vary: Origin` après le gestionnaire ;
  - laisse les en-têtes CORS sur les réponses d'erreur (`onError`).
- Les cookies sont effacés par `Max-Age=0; Path=/; Secure`, sans `HttpOnly` ni `SameSite`.
- Chaque connexion crée une session, et chaque utilisateur en a 10 au plus : les plus anciennes sont révoquées (`session_cap`). Lancer le banc plusieurs fois de suite ferme donc les vieilles sessions de développement d'admin et de lecteur, y compris celle de votre navigateur.

### Routes `/auth/*` laissées à Node (crate `admin`)

Les routes suivantes restent relayées pour l'instant :

- `PATCH /auth/me` et `PUT /auth/me/email` ;
- `GET /auth/identities` ;
- `POST /auth/password/reset/request` ;
- `/auth/oidc/*` (providers, start, callback, link) ;
- `/auth/signup`, `/auth/invitation` et `/auth/bootstrap`.

Elles dépendent du profil, des courriels localisés, de la découverte OIDC (PKCE, cookie d'échange scellé) et de l'inscription. Ce sont les domaines du crate `admin`, selon le plan.

> Mise à jour (crate `admin`) : toutes sont désormais natives, sauf `GET /auth/oidc/{slug}/start`, `GET …/callback` et `POST …/link`. Voir ci-dessous.

## Crate `admin`

### Ce qui reste relayé, et pourquoi

- **OIDC start, callback et `POST link`.** Découverte, JWKS, PKCE, cookie d'échange scellé, création de compte au retour. Sans fournisseur de test, la parité ne se vérifie pas. `GET /auth/oidc/providers` et `DELETE /auth/oidc/{slug}/link` sont natifs.
- **`POST /api/insights/reader`.** Il faut `provisionReader`/`readerReaches` de `sql/reader.ts` (partagé avec la console SQL) et `sqlViewSummaries` (vues SQL).

Les tables synchronisées (`…/admin/bases/{base}/synced-tables`, 6 routes) sont natives (`synced.rs`, `sync_sources.rs`, lignes écrites par `basedb_records::sync_rows`) : voir « Crate records ».

### Décisions

- **`PUT …/admin/access/tables/{table}/rows`** est natif (`rows.rs`, `set_row_rule`). La règle est validée par `rbac::rows::compile_row_rule`, le compilateur de `records` (enregistré par `basedb_records::router`). Le DDL de `sql/row-security.ts` (`ENABLE`/`DISABLE ROW LEVEL SECURITY`, politique de la console) est porté dans `rows.rs`, joué dans une transaction du pool DDL après celle du catalogue, comme Node. Vérifié par `bench/scenarios/records.json`.
- **`/meta/users`** est servi par `admin` (`members.rs`). À regrouper avec `catalog`.
- **La file des courriels.** Les pièces jointes sont lues dans le stockage des fichiers, disque ou S3 (`basedb_records::storage`) ; jusqu'à la bascule, celles d'un stockage S3 restaient à Node. Le texte de `last_error` diffère (erreurs de `lettre` contre `SmtpError` de Node) ; le statut, les tentatives et le report sont les mêmes. En développement, le courrier journalisé (`BASEDB_DEV_MAIL=1` ou sans SMTP) n'envoie rien. Vérifié : 4 courriels insérés, 4 envoyés en une passe.
- **Tâches de fond.** Désactivées sauf `BASEDB_RUST_BACKGROUND=1` (voir le README pour la cohabitation avec Node).

### Banc `admin.json`

- 140 étapes, admin et lecteur. Objets jetables nommés avec `{{run}}` : groupes, comptes `essai-…@exemple.test` (désactivés en fin de banc), jetons, intégrations.
- Résultat : **140/140 identiques**, stable sur trois passes.
- La base de données est partagée. Les réponses qui listent tous les groupes (`GET/POST …/access`, `PUT …/access/fields/{field}`) contiennent les groupes jetables des deux serveurs, à des états différents : ces étapes ne comparent que le statut. Les lectures par personne (`mask`, `rows/effective`) comparent tout.
- À la première passe, quelques `SERVICE_UNAVAILABLE` (503) passagers sont apparus des deux côtés, puis plus jamais. Cause probable : des connexions du pool fermées par le serveur, que deadpool ne détecte qu'à l'usage. Node aurait le même échec isolé.

### Surprises de Node (admin)

- Un corps JSON `null` donne un 500 `TypeError` à la première lecture de champ. C'est reproduit.
- Hono prend la première valeur d'un paramètre de requête répété.
- L'équivalent du `anyHost` des intégrations Slack est `BASEDB_WEBHOOK_DEV=1`.

## Crate `catalog`

Le catalogue est porté de `packages/core/src/catalog/**` et des routes de `app.ts` qui le servent. Le fichier de chaque module Rust porte le nom du fichier TS dont il vient. Les tests unitaires TS correspondants sont repris en `#[cfg(test)]`.

### Natif

- **Méta** : `GET meta/bases`, `meta/bases/{base}`, `openapi.json`, `doc`. Projection selon les droits, cache par `catalog_version`, ETag faible et `304`.
- **Projets** : `GET meta/projects`, `POST`, `PATCH` et `DELETE` `admin/projects`.
- **Structure sans plan de migration** :
  - `POST admin/bases`, sans `template` ;
  - `PATCH admin/bases/{base}` ;
  - `POST …/tables`, avec les champs simples, en une transaction DDL ;
  - `PATCH …/tables/{table}` : libellé, description, apparence ;
  - `PATCH …/fields/{field}` : libellé et description seulement ;
  - `PUT …/fields/order`.
- **Vues enregistrées, questions, requêtes enregistrées** (avec les en-têtes de dépréciation), **boutons** (sans `press`), **vues SQL** (CRUD, ordre, dépendances).
- **Lectures du cycle de vie** : bases supprimées, tables supprimées, historique de structure, liste des migrations.
- **Moteur de migration en plusieurs étapes** (`engine.rs`, `deletion.rs`, `purge.rs`, `routes_engine.rs`), porté d'un bloc : suppression de base, de table et de champ, restauration, aperçus de suppression, reprise (`POST admin/migrations/{id}/resume`), exports et purge. Mêmes lignes `catalog_migration` (`proposed` → `approved` → `applying` → `applied`/`failed`), mêmes étapes rejouables, mêmes renommages physiques et alias. Une migration interrompue par Node se reprend en Rust, et inversement.
- **Champs** (`fields.rs`, `field_config.rs`, `computed_fields.rs`, `select_options.rs`, `routes_fields.rs`) : ajout de champs de tous les types (calculés, cumuls, boutons, fichiers, texte riche), liens (trois étapes hors transaction, comme Node), options, obligatoire, unicité, colonne d'affichage, `PATCH` d'un champ avec `format`, `default` ou `formula`.
- **Environnements** (`environments.rs`, `env_rows.rs`, `routes_environments.rs`) : liste, création (fourche), renommage, suppression, comparaison, plan, application, décompte, comparaison et synchronisation des lignes.
- **Console SQL** (`sql_console.rs`, `wire.rs`) : `POST sql/{base}` et `GET sql/{base}/views/{view}`. Le rôle `basedb_console` pour qui gère la structure, sinon le rôle LOGIN `basedb_reader_<id>`, provisionné colonne par colonne, avec les politiques de lignes. Les requêtes passent par un client du protocole PostgreSQL écrit pour l'occasion (`wire.rs`) : il rend les types et les valeurs comme node-postgres, et l'étiquette de chaque instruction.
- **`POST /api/insights/reader`** (`insights_reader.rs`) : jeton d'insights, contexte du lecteur, `provision_reader`, portée et résumés des vues SQL. Le relais du crate `admin` est retiré.
- **Modèles** (`template_catalog.rs`, `template_check.rs`, `template_i18n.rs`, `targets.rs`, `template_apply.rs`, `routes_templates.rs`) : galerie et modèle par langue, import et suppression des modèles de l'instance, catalogue du site (récupéré par le réseau, avec cache et adresses vérifiées), validateur des contrats, `POST admin/bases` avec `template` (clé ou modèle en ligne), en JSON ou en flux `application/x-ndjson`.

### Ce qui reste relayé, et pourquoi

- **IA et documents** : plus relayés. `POST admin/templates/draft`, `…/fields/{field}/ai…` et `…/documents…` sont des routes du crate `ai`. Un champ avec `ai` (`POST …/fields`), un modèle avec des champs IA et la copie des champs IA d'un environnement passent par les crochets `ai_hooks.rs`, que `basedb_ai::router` installe (voir « Crate `ai` »). Sans le crate `ai`, ces cas sont relayés comme avant.
- **Modèle avec automatisations** (`needs_node`) : les automatisations reviennent au crate `automations`. Le modèle est entièrement relayé, jamais construit à moitié.
- **`POST …/buttons/{button}/press`** : il exécute une automatisation (crate `automations`).
- **Corps que Node lit en `TypeError`** : une liste d'options avec une entrée `null` ou un libellé ni texte ni `null`, un lien dont `required` n'est pas booléen ou `on_delete` n'est pas une valeur connue, un `field` d'affichage non textuel. Node y répond par un 500 dont le message dépend de V8 : la requête est relayée entière.

### Décisions

- **`TxGuard` dans `base/src/tx.rs`** : si le futur d'un handler est abandonné, par exemple parce que le client se déconnecte, la connexion revient au pool en pleine transaction. La requête suivante échouait alors avec « SET TRANSACTION ISOLATION LEVEL must be called before any query » (`GET meta/projects` en 500). La garde lance un `ROLLBACK` au `Drop` et jette la connexion. Ce cas est couvert par `crates/catalog/tests/transactions.rs`. `signup.rs` (`bare_transaction`) et `outbox.rs` du crate `admin` passent aussi par la garde.
- **`write_audit`** (base) : le `object_id` est converti comme le fait Node.
- **Émission DDL** : `operations.rs` reprend `emit.ts` à l'octet près : types, `CHECK` url, e-mail et texte riche, cinq déclencheurs, commentaires. Un script de comparaison a vidé les deux bases créées par le banc : lignes du catalogue, colonnes et commentaires, contraintes, déclencheurs. Elles étaient identiques.
- **Noms physiques** : `allocate_name` prend le même verrou consultatif et écrit le même registre `physical_name` que Node.
- **Sens des requêtes** : une requête relayée l'est entière, avant toute écriture. Une même requête n'est jamais traitée à moitié par chaque serveur.
- **Crochets vers `records`** : le catalogue ne dépend pas de `records`. `main.rs` installe l'assainisseur du texte riche (`set_rich_text_sanitizer`), la vidange du tampon d'historique (`set_history_drainer`) et les écritures de lignes des modèles (`set_template_row_writers`, qui appellent `basedb_records::write`).
- **Connexions de la console SQL** : une connexion par appel (`wire.rs`), là où Node garde un pool par schéma. La latence est un peu plus forte, les réponses sont identiques.
- **Clippy** : `#![allow(clippy::result_large_err)]` dans le crate, comme `records`. Les avertissements du crate `admin` (emprunts inutiles dans `signup.rs`, trop d'arguments, éléments après le module de test dans `profile.rs`) existaient avant ce lot et n'ont pas été touchés.

### Banc `catalog.json`

Le banc compte 360 étapes : admin, lecteur, anonyme et refus (400, 401, 403, 404, 409, 422). Résultat : **360/360 identiques**. Les écritures créent une base, des tables, des champs, des vues, des questions, des requêtes, des boutons et des vues SQL, nommés avec `{{run}}`, chaque serveur de son côté. La base de l'exécution est supprimée à la fin par `DELETE`, relayé vers Node. Le scénario couvre `GET meta/projects`, qui a révélé la fuite de transaction.

### Bancs `catalog-2` à `catalog-7`

Chaque banc crée ses propres bases (`{{run}}`), compare les réponses, puis l'état en base après les écritures : lignes du catalogue, colonnes, contraintes, déclencheurs, lignes de données. Admin, lecteur, sans jeton, et les refus.

| Banc | Étapes | Contenu |
|---|---|---|
| `catalog-2` | 73 | Moteur de migration : suppressions de base, de table et de champ, aperçus, restauration, reprise, environnements (liste, création, renommage, suppression). |
| `catalog-3` | 37 | Exports et purge. |
| `catalog-4` | 81 | Console SQL (console et lecteur, droits de colonnes, règles de lignes, vues SQL) et `/api/insights/reader`. |
| `catalog-5` | 143 | Champs : tous les types, liens, options, obligatoire, unicité, affichage, `format`, `default`, `formula`, champs calculés et cumuls. |
| `catalog-6` | 117 | Environnements : fourche, comparaison, plan, application, décompte et synchronisation des lignes. |
| `catalog-7` | 162 | Modèles : galerie par langue, import, suppression, `POST admin/bases` avec `template` en JSON et en flux, échecs (base jetée), les dix modèles livrés appliqués en ligne et comparés. |

Résultat, sur deux exécutions complètes : **973/973 identiques** (`catalog` compris).

### Surprises de Node (catalogue, reproduites)

- **Droits et cache** :
  - un rôle sans permission est projeté comme un rôle `null` ;
  - les ETag ne sont comparables qu'à `authz_version` égale ;
  - `requireSeesBase` ne vérifie pas le tenant ;
  - `listMigrations` ne vérifie aucun droit ;
  - n'importe quel utilisateur peut faire `POST admin/projects` ;
  - un lecteur peut créer des questions personnelles.
- **Requêtes mal formées** :
  - un corps JSON mal formé ou `null` donne 500 ;
  - un `PATCH` de projet avec un libellé non textuel donne 500 ;
  - pour une vue SQL, un `name` `null` ou non textuel donne 500, après les autres vérifications ; un corps tableau aussi ;
  - `limit` fractionnaire ou `before` invalide sur l'historique de structure : 422 `VALUE_INVALID`.
- **Comportements étranges** :
  - les en-têtes de dépréciation des requêtes enregistrées sont aussi posés sur les erreurs ;
  - la position d'une vue personnelle compte dans la numérotation des vues de la table ;
  - un lecteur qui lit une vue fondée sur une autre vue reçoit 404.
- **`createTable`** :
  - renvoie la couleur et l'icône brutes, sans normalisation ;
  - ne coupe pas les espaces du libellé (`label_key`, lui, est coupé) ;
  - accepte un libellé de table en double, faute de vérification de conflit ;
  - passe `required` tel quel à PostgreSQL : `'yes'` vaut vrai, `'oui'` donne 422 `VALUE_INVALID`, et le `NOT NULL` suit la vérité JavaScript ;
  - à la création, un champ calculé donne `champ_calcule_apres_creation` ; les autres types hors liste donnent `champ_apres_creation`.
- **Champs** : un `PATCH` dont la description est trop longue a déjà écrit le libellé, parce que Node fait deux transactions.
- **Ajout de champ** : un `kind` inconnu donne 409 (pas 400) ; `required` sur un numéro automatique donne `REQUEST_INVALID` ; les dates de `default` acceptent le sous-ensemble ISO que lit `Date.parse` (sans fuseau : heure locale).
- **Console SQL** :
  - un `interval` est rendu `{}` (l'objet de node-postgres sérialisé) ; un `date[]` est rendu à minuit local, en ISO UTC ;
  - deux colonnes de même nom deviennent `nom`, `nom__1`… ;
  - un `limit` fractionnaire est tronqué ;
  - le curseur décale l'instruction (enveloppe `DECLARE … CURSOR`) : les positions d'erreur rendues sont celles de Node, décalées de 41 ;
  - un jeton d'insights qui porte `crit` est refusé.
- **Modèles** :
  - le message d'erreur d'analyse du JSON du site ne se reproduit pas à l'octet (V8) : ce cas n'est pas au banc ;
  - un flux interrompu donne l'erreur `terminated`, comme `fetch` de Node ;
  - les messages coupés le sont en unités UTF-16 (`message.slice`), demi-paires comprises ;
  - les nombres suivent `JSON.stringify` (`1` et non `1.0`) ;
  - `BASEDB_TEMPLATES_DIR` remplace le dossier des modèles livrés ;
  - le premier champ est créé sans ses options ; les champs calculés aussi, puis configurés ;
  - le compteur des champs IA dégradés augmente pour chaque champ IA sans consentement ;
  - quand tous les champs d'un tour de calcul échouent, la dernière erreur est levée ;
  - un échec de `setRequired` range le champ dans `not_required`, sans erreur ;
  - une référence `@x` est lue par `ref.slice(1)` ; `$moi` ne vaut que pour les champs utilisateur ;
  - un formulaire sans titre prend le libellé de la vue ;
  - sur erreur, la base est supprimée et l'erreur porte `details.template = {step, base, discarded}` ; dans le flux, c'est la dernière ligne.
- **Environnements et migrations** : reproduits tels que Node les écrit (ordre des étapes du plan, notes, noms relégués `…__del_<stamp>`, alias), vérifiés par la comparaison de l'état en base.

## Crate `records`

### Natif

Tout le domaine, sauf `…/documents` (crate `ai`). Par module :

- **Lecture** — `list.rs`, `filter.rs`, `cursor.rs`, `sealing.rs`, `expand.rs`, `display.rs`, `computed.rs`, `variables.rs`, `pg.rs` :
  - `GET …/data/{base}/{table}` et `GET …/{id}` : `filter` (grammaire de `records/filter.ts`, mêmes codes `FILTER_*`), `sort` (collation `und-x-icu`, `_id` en dernier), `limit` (`Number(q)`, donc `NaN` possible), `after` (curseur scellé), `count=exact` plafonné à 100 000, `expand`, `links=id`, champs calculés (formules par `basedb_catalog::formula`, recherches, cumuls, comptes), variables des textes (`variables=raw`), liens signés des fichiers ;
  - `…/deleted` (corbeille des lignes), `…/aggregate` (`aggregate.rs`), `…/{id}/referenced_by`, `…/export` (`export.rs` : CSV, JSON, xlsx).
- **Écritures** — `write.rs`, `values.rs`, `entities.rs`, `html.rs` : `POST`, `PATCH`, `DELETE`, `POST …/batch` (une seule sorte d'opération par lot, tout ou rien), clés d'idempotence (`base::idempotency`), valeurs par type, liens dans les deux sens, texte riche assaini (`html.rs` : port des réglages de `sanitize-html` utilisés), en-tête de transaction, `basedb_live`.
- **Historique** — `drain.rs` (vidange du tampon `history_buffer` en révisions, boucle de fond toutes les 2 s et sur `basedb_drain`), `history.rs` : historique d'une ligne et d'une base, `undo`, `revert`, `restore`.
- **Fichiers et géo** — `files.rs`, `storage.rs` (disque `BASEDB_FILES_DIR`, ou S3 signé SigV4), `geo.rs` (géocodeur Nominatim avec cache, recherche).
- **Formulaires et vues publiques** — `forms.rs`, `quiz.rs` : `/api/v1/forms/{token}` (+ `check`, quiz notés), `/api/v1/views/{token}` (+ `rows`, `calendar.ics`), partage des vues (`…/views/{view}/share`, `regenerate`).
- **Collaboration** — `collab.rs`, `notifications.rs` : commentaires, mentions, notifications (`/me/notifications`, `read`), présence, pointeur, flux en direct `GET …/events` (SSE sur `base::listener`, 10 flux au plus par personne).
- **Analyses** — `analytics.rs` : `POST …/query/{base}`, questions enregistrées ou données entières, `constraints`.
- **Tables synchronisées** — `sync_rows.rs` : `apply` (miroir, ajout, remplacement, instantané) écrit les lignes d'une source ; les routes sont dans `admin` (`synced.rs`, `sync_sources.rs`).
- **Sécurité** : droits de table, masques de colonnes, règles de lignes (via `rbac`), même ordre de contrôles que Node. `basedb_records::router` installe `rbac::rows::set_row_rule_compiler(filter::compile_row_rule)` ; le même compilateur valide les règles de `PUT …/access/tables/{table}/rows` (crate `admin`).

### Ce qui reste relayé, et pourquoi

- **`GET …/data/{base}/{table}/documents`** : les documents relèvent du crate `ai`.
- Sans clé d'instance (`BASEDB_ENCRYPTION_KEY`), les routes qui scellent ou descellent relaient à Node.

### Pour les crates `automations`, `ai`, `mcp`

- **Lire** : `basedb_records::{list_records, ListOptions, ListResult}`, avec les mêmes droits que la route (transaction du pool `Data`, contexte de la personne).
- **Écrire** : `write::{create_records, update_records, delete_rows}`. Ils posent l'historique et `basedb_live` comme la route. Les runs d'automatisation et les livraisons de webhooks sont mis en file par la vidange de l'historique (`drain::queue_triggered` et `webhook_delivery`, dans la transaction de la vidange) : le crate `automations` n'a qu'à prendre les runs en file (`_basedb.automation_run`).
- **Temps réel** : `notifications::{emit_live, can_read_table}`, et le hub des flux de `collab` (`LiveHub`).
- **Analyses et exports** : `analytics::run_question`, `export::export_response`.
- **Tables synchronisées** : `sync_rows::apply` ; `basedb_admin::synced::{sync_table, sync_due}`.
- **Règles de lignes** : sans `basedb_records::router` appelé au démarrage (`basedb-server` le fait), une règle compile en `FALSE` : 0 ligne visible. `rbac::rows::compile_row_rule(filter, fields)` valide une règle sans l'appliquer.
- **Tâches de fond** : `basedb_records::start_background` (vidange de l'historique), seulement avec `BASEDB_RUST_BACKGROUND=1`.

### Bancs

| Banc | Étapes | Couvre |
|---|---|---|
| `records.json` | 195 | Lectures de la base de démo (filtres, tris, curseurs, décomptes, liens, champs calculés, admin et lecteur), erreurs, règles de lignes posées et levées, notifications. |
| `records-2.json` | 136 | Écritures, lots, idempotence, liens, validations, état en base après écriture. |
| `records-3.json` | 200 | `deleted`, `aggregate`, `referenced_by`, historique, annulation, `revert`, `restore`. |
| `records-4.json` | 104 | Envoi et lecture des fichiers, liens signés, géo. |
| `records-5.json` | 200 | Formulaires publics, quiz, vues partagées, `calendar.ics`, partage. |
| `records-6.json` | 121 | Commentaires, mentions, notifications, présence, `events`. |
| `records-7.json` | 283 | Analyses (`query`). |
| `records-8.json` | 116 | Exports. |
| `records-9.json` | 158 | Tables synchronisées : aperçu, création dans chaque mode, refus `TABLE_SYNCED`, synchronisations quand la source change, modification, arrêt. |
| `bench/live.mjs` | — | Ouvre un flux SSE sur chaque serveur, écrit, compare les événements reçus. |

- Résultat : tous identiques, sur deux passes chacun.
- Chaque banc travaille dans une base jetable (`{{run}}`), purgée en fin de banc. `next_cursor` est ignoré (le sceau contient un aléa) : les pages suivantes sont comparées à la place.
- **`records-9`** demande ses propres serveurs : le Node de développement n'a pas `BASEDB_WEBHOOK_DEV=1` et refuse les sources locales (`adresse_refusee`). Lancer :
  - `node bench/sync-source.mjs` (sources sur :8796, versions comptées par chemin) ;
  - un second Node (`node apps/api/dist/server.js`, `PORT=8798`, `BASEDB_WEBHOOK_DEV=1`, `BASEDB_DEV_LOGIN=1`) ;
  - Rust (`RUST_PORT=8797`, `BASEDB_WEBHOOK_DEV=1`), les deux avec une adresse d'insights injoignable (`BASEDB_INSIGHTS_URL=http://localhost:1`) ;
  - puis `NODE_URL=http://localhost:8798 RUST_URL=http://localhost:8797 node bench/parity.mjs records-9`.
- **La tâche de fond des tables synchronisées** (`BASEDB_RUST_BACKGROUND=1`) est vérifiée à part : une table rendue due est synchronisée par Rust à la minute suivante. Le Node de développement a sa propre boucle sur la même base, sans `BASEDB_WEBHOOK_DEV` : les deux se disputent une table due.

### Surprises de Node (reproduites)

- **Corps et paramètres** :
  - un corps JSON `null` donne un 500 `TypeError` presque partout (écritures, `undo`, formulaires, analyses, commentaires, tables synchronisées) ; le corps est lu avant le contexte ;
  - première valeur d'un paramètre de requête répété ;
  - `BODY_TOO_LARGE`, le corps du géocodeur, le JSON des commentaires et la limite du pointeur sont contrôlés avant l'authentification.
- **Lecture** :
  - `GET …/{id}` : la forme de l'identifiant est vérifiée après `dataContext` et avant la résolution de la table ;
  - `limit=abc` donne `NaN` ; `meta.count` vaut `null` quand il n'est pas demandé ; l'erreur `links=id` avec `expand` tombe après les requêtes ;
  - `deleted?since=1` donne un 500 ;
  - `referenced_by` rend ses dates par `Date.toString` ;
  - le lexique des filtres refuse un mot nu non ASCII ;
  - le curseur des notifications : deux parties séparées par `|`, une date que `Date.parse` lit, sinon `CURSOR_INVALID`.
- **Types PostgreSQL** :
  - les tableaux `_date`, `_timestamp`, `_timestamptz` deviennent des chaînes ISO locales ;
  - `timestamp` sans fuseau est lu en heure locale ; `infinity` devient `null` ; un `interval` devient `{}` ;
  - un texte court d'une recherche qui a exactement la forme d'un instant ISO est rendu comme un instant.
- **Écritures et historique** :
  - restaurer une ligne supprimée qui porte une formule stockée donne un 500 ;
  - les lignes d'un lot créées dans la même milliseconde n'ont pas d'ordre garanti.
- **Fichiers** : le 404 d'un fichier laisse voir la clé de stockage.
- **Formulaires et vues** : `active: null` donne `REQUEST_INVALID` ; `closes_at: 5` donne un 500 ; le jeton de partage vaut `''` quand il ne se descelle pas ; le calendrier ignore les tris.
- **Collaboration** : le 11ᵉ flux donne 429.
- **Analyses** : `Date.UTC` lit les années 0 à 99 comme 19xx ; un filtre sur une formule donne un 500 des deux côtés.
- **Exports** : `format=CSV` donne 400, `headers=` vide aussi ; un champ masqué au lecteur donne `FILTER_FIELD_UNKNOWN` ; `POST` donne 404 ; le texte riche sort en HTML brut.
- **Tables synchronisées** :
  - les réglages sont validés après la lecture de la source : un mode faux avec une bonne source donne 400, une source qui échoue donne d'abord 502 ;
  - un lecteur reçoit 404 (la base lui est invisible) ;
  - une date-heure en place est comparée par `String(Date)`, qui perd les millisecondes : un instant stocké avec des millisecondes compte comme « mis à jour » à chaque passe (`sync_rows::same`) ;
  - une date-heure impossible roule selon V8 (30 février → 2 mars) ; un mois impossible dans un CSV (`2024-13-01`) donne un 500 `RangeError` ;
  - un nombre `NaN` d'une vue partagée devient `null` ;
  - `next_sync_at` et `last_synced_at` sont rendus par `::text` de PostgreSQL (`2026-… +00`).

### Écarts connus

- Le curseur des notifications refuse des formes que V8 lit (`Jan 2 2026`…) : Node ne les produit jamais.
- Les longueurs de `MENTION` diffèrent dans des cas limites UTF-16.
- Un élément `null` dans un tableau d'un type par défaut fait échouer l'export de Node ; Rust l'écrit vide.
- Le xlsx est compressé autrement : même contenu, octets différents.
- Le géocodeur n'est comparé que sur son cache : Nominatim n'est pas appelé par les bancs.
- S3 n'est vérifié que par le test de signature SigV4 (`storage.rs`), sans seau réel.
- Tables synchronisées :
  - le repli de date-heure des questions d'insights est approché ;
  - des noms de fuseaux connus seulement d'ICU (`SystemV/AST4`, `US/Pacific-New`) peuvent être refusés par `chrono-tz` ;
  - contre une adresse d'insights injoignable, l'aperçu prend environ 2,4 s en Rust contre 20 ms en Node (délais de connexion différents, même réponse).

## Crate `ai`

### Natif

- **Fournisseurs** (`provider.rs`) : OpenAI, Anthropic, Mistral et compatible OpenAI (Azure, Ollama, passerelles), avec les réglages d'instance (`ai.enabled`, `ai.provider`, `ai.model`) puis les variables `BASEDB_AI_*`, et les mêmes requêtes que Node pour chaque fournisseur. Viennent ensuite le consentement par base, le quota par tenant et par heure (`_basedb.ai_call`, partagée avec Node, donc un seul compteur pour les deux serveurs) et le journal des appels.
- **Routes** (`routes.rs`, `copilot.rs`, `drafts.rs`, `schedule.rs`, `template_draft.rs`) :
  - formule (`expression`) et structure ;
  - copilote de base : tours, actions proposées, lecture des données selon `readData`, pièces jointes, tour de correction ;
  - aperçu de planification et brouillon de modèle. Les consignes système ont été copiées de Node dans `prompts/`, qui est désormais leur source.
- **Pièces jointes** (`attachments.rs`, `pdf/`) : texte, CSV, JSON, documents Office (docx, xlsx, pptx), images, et PDF lus par un lecteur natif qui suit pdf.js (`unpdf`) : `lopdf` pour les objets et les flux, puis contenu des pages, polices et encodages (`ToUnicode`, liste de glyphes Adobe, CMap des polices composites ; tables de `pdf/tables.rs` reprises d'insights). Mêmes plafonds et mêmes codes que `core/src/ai/attachments.ts`.
- **Champs IA** (`fields.rs`) : état, réglage, arrêt, `run`.
- **Documents** (`documents/`) :
  - modèles : liste, création, modification, suppression ;
  - rendu PDF natif : `spec.rs` valide, `render.rs` et `layout.rs` composent, `writer.rs` écrit le PDF ;
  - polices : `fonts.rs` (Noto de `BASEDB_PDF_FONTS`, faces du système, ou Helvetica et Times du PDF avec les métriques de pdfkit `afm.json`) ;
  - nombres et dates par langue : `intl.rs` (`intl.json`).

  `bench/gen-afm.mjs` et `bench/gen-intl.mjs` régénèrent `afm.json` et `intl.json` depuis Node.
- **Crochets du catalogue** (`catalog_hooks.rs`) : `basedb_ai::router` installe `basedb_catalog::ai_hooks`, qui couvre :
  - un champ avec `ai` à la création ;
  - un modèle avec des champs IA consentis ;
  - la copie des champs IA d'un environnement.

  Le catalogue reste indépendant du crate `ai`.
- **Clippy** : `#![allow(clippy::result_large_err)]` dans le crate, comme `catalog` et `records`.
- **Tâches de fond** (`worker.rs`, `basedb_ai::start_background`, seulement avec `BASEDB_RUST_BACKGROUND=1`, et sans `BASEDB_AI_WORKER=0`) :
  - **le travailleur des champs IA**, copie de `startAiWorker` (`core/src/ai/field.ts`). Une passe toutes les 10 s, la suivante 10 s après la fin de la précédente (`setTimeout`), la première 10 s après le démarrage. Par passe : 20 champs au plus, 8 cellules par champ, les champs les moins récemment passés d'abord (`last_run_at NULLS FIRST`). On y retrouve le même bail de 5 min sur `field_ai_config.lease_until`, toujours rendu ; les mêmes erreurs qui arrêtent le champ (`AI_DISABLED`, `AI_NOT_CONFIGURED`, `AI_QUOTA_EXCEEDED`, `AI_PROVIDER_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`), avec une pause de 10 min pour le quota et de 5 min sinon ; le même recul par ligne illisible, `min(2^n min, 6 h)` ; les mêmes balayages planifiés (`next_sweep_at`, `sweep_after`) ; les mêmes écritures (acteur système, `_updated_by` à l'identifiant zéro, `change_event`), et le même quota `field_compute` avec son journal `ai_call` ;
  - **les partitions mensuelles de `_basedb.ai_call`** (ce mois et les deux suivants, le même DDL que `ensureJournalPartitions`), au démarrage puis chaque jour. `audit_log` et `security_log`, `seedErrorCodes` et `reclaimStaleMigrations` restent au socle (voir « Phase 0 »).

  Rien d'autre ne tourne en fond ou au démarrage dans `core/src/ai` ni dans `core/src/documents` : les caches des polices et des formats, et le disjoncteur, vivent en mémoire.
- **Mode démo** : `provider::transport` refuse d'abord par `AI_DISABLED {reason: "demo"}`, comme `demoTransport` de Node. Les routes, le travailleur et l'étape IA des automatisations y passent tous.

### Ce qui reste relayé, et pourquoi

- **`POST …/ai/bases/{base}/automation-copilot`** : porté par le crate `automations` (`copilot.rs`), sur `basedb_ai::copilot`.
- **Un modèle avec automatisations** : natif, le crate `automations` installe le créateur (`set_template_automation_creator`).
- **Une méthode que Node ne déclare pas** sur les chemins des documents : repart à Node (`fallback(to_node)`).

### Banc du travailleur (`bench/ai-worker.mjs`)

Le script lance lui-même le fournisseur simulé (:8797), un Node avec son travailleur (:8800), un Rust avec `BASEDB_RUST_BACKGROUND=1` (:8801) et un Rust sans tâches de fond pour préparer les bases (:8802). Il les arrête à la fin et supprime ses bases.

1. **Chaque travailleur seul**, sur sa propre base de 10 lignes. Les champs IA couvrent le texte, le nombre, l'interrupteur, le choix, une date toujours illisible, un balayage cron rendu dû, et une panne du fournisseur (`http500`). Le script attend que tout soit stable. Il compare alors l'état de `field_ai_config`, les cellules, le journal `ai_call`, les `change_event` du système et les requêtes reçues par le modèle (comparées en multiensemble).
2. **Quota** : le quota `field_compute` est réglé pour laisser trois appels. On attend `computed_count` 3 et `AI_QUOTA_EXCEEDED` des deux côtés.
3. **Les deux ensemble** sur une même base : les cellules, les compteurs et les changements doivent être ceux d'un travailleur seul. Les appels se partagent entre les deux (par exemple 45 et 33).

Résultat : **identique sur deux passes**.

- **Les lignes illisibles** peuvent être demandées une fois par chaque travailleur quand les deux tournent ensemble. Le recul vit en mémoire, propre à chaque processus, comme dans Node. Le banc compare donc, à l'étape 3, les cellules et les compteurs, pas le nombre d'appels.
- **Les travailleurs de `:8787`** et des autres agents passent aussi. Sans fournisseur, ils s'arrêtent sur `AI_DISABLED` et ne laissent qu'un bail bref. Le test d'intégration `tests/worker.rs` reprend donc la passe quand le champ est pris.

### Banc `ai.json`

Les réponses du modèle varient d'un appel à l'autre. Les deux serveurs prennent donc pour fournisseur `bench/mock-llm.mjs` (port 8799, compatible OpenAI, aucune donnée ne sort). Une directive `[mock:<nom>]` choisit la réponse, et `http400`, `http429` et `http500` simulent les pannes. `node bench/mock-llm.mjs --diff` compare les requêtes envoyées par Node et par Rust : consignes et charges utiles identiques.

Le banc tourne contre une seconde instance Node (`:8797`), jamais contre `:8787` :

```powershell
$env:BASEDB_AI_PROVIDER='openai_compatible'; $env:BASEDB_AI_MODEL='mock'; $env:BASEDB_AI_BASE_URL='http://localhost:8799/v1'
$env:BASEDB_AI_QUOTA='100000'; $env:BASEDB_AI_FIELD_QUOTA='100000'   # le quota est compté en base, pour les deux serveurs
```

Le banc compte 245 étapes, en admin et en lecteur (droit de lecture donné par un groupe créé puis supprimé). Il crée sa propre base et la supprime à la fin. Il couvre :

- consentement et quotas ;
- formule, structure, copilote : actions, `readData`, pièces jointes, correction, pannes du fournisseur ;
- pièces jointes de chaque type, dont des PDF ;
- aperçu de planification et brouillon de modèle ;
- champs IA : création, réglage, `run`, arrêt ;
- modèles avec champs IA, environnements ;
- documents : modèles, aperçu, rendu, refus de définition (`REQUEST_INVALID` et sa raison).

Résultat : **245/245 identiques sur deux passes**.

- **Les PDF** (`raw: "pdf"` dans `parity.mjs`) sont comparés par le nombre de pages et par le texte extrait, sans les blancs, jamais par les octets. pdfkit écrit du PDF 1.3 et Rust du 1.7. Les polices sont intégrées en CFF (`FontFile3`), et le texte est mis en forme par rustybuzz plutôt que fontkit.
- **Le travailleur de Node** remplit les cellules `if_empty` pendant le banc. Le banc remplit donc les cellules par des étapes `run` explicites. Il ignore aussi, sur les lectures d'état IA que le travailleur touche, les clés `computed_count`, `pending`, `queued`, `sweeping`, `last_run_at`, `last_error` et `last_error_at`.

### Surprises de Node (reproduites)

- L'ordre des clés du copilote suit celui de JavaScript (`js_order`).
- Le tour de correction avale les erreurs du fournisseur, sauf le dépassement de quota.
- Une réponse vide devient « Je n’ai rien à proposer. ».
- `run` sur un corps qui n'est pas du JSON le lit comme `{}`.
- `aiInputOf` est évalué après la résolution de la table.
- Un champ IA de modèle se dégrade sur `AI_DISABLED`, `AI_NOT_CONFIGURED` ou `AI_CONSENT_REQUIRED` (`ai_hooks::AI_UNAVAILABLE`).
- Documents :
  - `GET …/{id}/documents/preview` est lu comme le modèle nommé « preview » ;
  - les corps des modèles ne sont pas bornés (images intégrées) ;
  - `decode()` de la mise en page décode deux fois les entités HTML ;
  - `Intl` traite `-0` à part ;
  - `upper()` suit les règles du turc et de l'azéri ;
  - `safeName.slice(0, 120)` peut couper une paire de substitution UTF-16.
- Travailleur :
  - le recul des lignes illisibles et la pause d'un champ vivent en mémoire, perdus au redémarrage ;
  - une erreur inattendue sur un champ le met en pause 5 min, et la passe continue avec les champs suivants ;
  - les partitions de `ai_call` ne sont créées qu'à la migration, donc un Node lancé depuis plus de deux mois n'a plus de partition (pas de partition `DEFAULT`). Rust les crée en plus chaque jour, ce qui ne change rien quand elles existent déjà.

### Écarts connus

- **Le lecteur PDF des pièces jointes** ne réordonne pas le texte bidirectionnel (hébreu, arabe). Il ne tire pas l'encodage d'une police CFF ou TrueType intégrée sans `ToUnicode`. Il ne lit aucune CMap prédéfinie autre qu'`Identity` (pdf.js, sans `cMapUrl` dans `unpdf`, n'en lit pas non plus).
- **Les PDF produits** ont le même texte et le même nombre de pages, mais pas les mêmes octets (voir le banc).
- **Les messages d'erreur JSON du modèle** sont ceux de serde, et non ceux de V8.

### Pour les crates `automations` et `mcp`

- **`automations`** : pour l'étape « document », `basedb_ai::documents::render::render_document` ; pour l'étape « IA », `basedb_ai::provider` (configuration, `invoke`, quota, journal) avec la consigne `prompts/STEP_SYSTEM.txt`. `provider::transport` porte déjà le refus du mode démo. Les étapes IA des automatisations et les champs IA partagent le quota de fond (`BASEDB_AI_FIELD_QUOTA`, usages `field_compute` et `automation` de `ai_call`) : journaliser l'étape en `automation`. Le copilote d'automatisation (`automation-copilot`) est porté dans ce crate, en reprenant `copilot.rs`.
- **`mcp`** : réutiliser les fonctions publiques de `copilot`, `fields` et `documents`, jamais les recopier.

## Crate `automations`

### Natif

- **Définitions** (`defs.rs`, `validate.rs`) : déclencheurs (ligne créée, modifiée, supprimée ; planification ; date ; formulaire ; bouton ; webhook entrant ; manuel), conditions, étapes, mêmes messages de validation que `core/src/automations`.
- **Routes** (`routes.rs`, `catalog.rs`, `requests.rs`) : liste, création, modification, suppression, exécutions, `run` manuel, `press` des boutons, webhook entrant `/api/v1/hooks/{secret}` (JSON ou formulaire). Une exécution demandée est mise en file avec le même plafond horaire que Node (`RUNS_PER_HOUR`).
- **Moteur** (`engine.rs`, `render.rs`) : la copie de `runAutomations` (`engine.ts`). Étapes : `create_record`, `update_record`, `delete_record`, `find_record`, `aggregate`, `run_automation`, `document`, `notify`, `ai`, `email`, `slack`, `webhook`, et les blocs `for_each`, `attempt`, `branch`, `wait`. Les écritures passent par `basedb_records::write`, les lectures par `list_records`. L'étape IA passe par `basedb_ai::provider` (consigne `STEP_SYSTEM.txt`, quota de fond, journal `automation`), l'étape document par `basedb_ai::documents::render::render_document`. Les adresses sortantes (webhook, Slack) sont vérifiées par `catalog::targets::check_target`.
- **Webhooks sortants** (`webhooks.rs`) : CRUD, livraisons, envoi. Corps `{"events":[…]}`, en-têtes `x-basedb-signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "t.corps")>`, `x-basedb-delivery-id`, `x-basedb-webhook-id`, `user-agent: basedb-webhook/1` : identiques à Node.
- **Propositions** (`proposals.rs`) : liste, approbation (application des changements), refus, expiration.
- **Copilote d'automatisation** (`copilot.rs`) : sur `basedb_ai::copilot` et `basedb_ai::provider`.
- **Modèles** : `router()` installe `basedb_catalog::template_apply::set_template_automation_creator`. Un modèle avec automatisations est alors construit en natif.
- **Bibliothèque de l'agent** (`agent/`) : `describe`, `records`, `files`, `audit`, `view`. Elle n'a pas de route HTTP : Node ne l'expose que par MCP (voir plus bas).
- **Tâches de fond** (`start_background`, avec `BASEDB_RUST_BACKGROUND=1`) : le moteur et l'envoi des webhooks, une passe toutes les 2 s chacun.

### Ce qui reste relayé, et pourquoi

Rien. Slack est envoyé en natif, mais aucun banc ne l'exerce : on n'appelle jamais `hooks.slack.com`.

### Verrous : Node et Rust sur la même base

Mêmes instructions que Node :

- une exécution est prise par `UPDATE … WHERE id IN (… FOR UPDATE SKIP LOCKED)` ;
- une planification est mise en file sous `FOR UPDATE SKIP LOCKED`, avec « aucune déjà en attente » ;
- une automatisation de date est tenue sous bail de 5 min ;
- une livraison est prise sous `SKIP LOCKED`, puis marquée `in_flight`.

Aucun des deux ne prend un travail que l'autre tient (vérifié par la phase « ensemble » du banc moteur).

### Bancs

- **Routes** (`bench/scenarios/automations.json`, 145 étapes, admin et lecteur) : CRUD et erreurs de validation, exécutions, `run`, `press`, webhook entrant, webhooks sortants (session élevée), propositions (créées par MCP : option `"server":"mcp"` de `parity.mjs`), copilote, modèle avec automatisations. Les deux serveurs prennent le fournisseur simulé `bench/mock-llm.mjs` et `BASEDB_WEBHOOK_ALLOW=example.com`, car cette machine n'a pas de DNS : un nom approuvé n'est pas résolu. Résultat : **145/145 identiques sur deux passes**. `node bench/mock-llm.mjs --diff` : 81 appels de chaque côté, identiques.
- **Moteur** (`bench/automations-engine.mjs`) : un Node de mise en place crée, dans une base PostgreSQL neuve `basedb_cmp_node_*`, une base « Moteur » avec huit automatisations, deux webhooks (dont un qui échoue une fois par livraison) et un bouton. La base PostgreSQL est copiée (`TEMPLATE`) pour Rust et pour la phase « ensemble ». Chaque serveur ne voit donc que sa copie : le Node de développement (`:8787`) fait tourner son moteur sur toute la base de développement, et ne la touche pas. Événements : création, modification, suppression de lignes, `press`, `run` manuel, webhook entrant en JSON et en formulaire. Après chacun, le script attend le calme. Il compare enfin, triés et masqués :
  - les lignes, les exécutions et leur journal, les livraisons, les courriels, les notifications, les appels IA ;
  - les requêtes reçues par un puits HTTP local, signatures vérifiées ;
  - les requêtes reçues par le modèle simulé.

  Résultat : **Node seul et Rust seul identiques sur deux passes** (14 exécutions, 15 livraisons, 26 requêtes au puits). **Phase ensemble identique** : les deux moteurs ont envoyé des requêtes, et aucune n'a été faite deux fois.

### Surprises de Node (reproduites)

- `sameDates` est toujours faux.
- Le chemin `dig` lit `length` sur une chaîne ou une liste.
- Le répartiteur des webhooks compte toute erreur comme `WEBHOOK_TARGET_REJECTED`.
- L'adresse d'un webhook est résolue à l'enregistrement (`cible_refusee` sans DNS). À la création sans élévation, l'adresse est vérifiée avant l'élévation.
- Un corps qui n'est pas du JSON à la création d'une automatisation ou au copilote donne 500.
- `run` manuel par un lecteur : 202. `run` d'une automatisation désactivée ou inconnue : 409.
- Un `run` manuel d'une automatisation de bouton est journalisé `button`.
- `press` avec un filtre qui ne trouve aucune ligne : 400 `aucune_ligne`.
- Un modèle avec une automatisation invalide : 422.
- Copilote : remplaçant `comparable`, suppression par `shift_remove` (ordre des clés de JavaScript), une étape qui n'est pas un objet est lue comme `{}`.
- Agent :
  - `describe_base` relit `application_table` sans `ORDER BY` ;
  - le plafond de décompte de 50 000 est reproduit ;
  - la création renvoie `String(_id)` ;
  - pièce jointe : un `filename*` mal formé retombe sur `filename`, et un délai de lecture du corps est une erreur interne.
- Notifications : le courriel attend 10 min (`not_before`).

### Écarts connus

- Les propositions mal formées donnent `REQUEST_INVALID`, là où Node échoue en 500.
- `AppError::new` change un code inconnu en `INTERNAL_ERROR`.
- Rust ouvre ses transactions par `with_transaction`, là où Node écrit `BEGIN` à la main.
- Les en-têtes par défaut des requêtes sortantes diffèrent : undici envoie `sec-fetch-mode`, reqwest non. Le banc moteur s'en sert pour savoir qui a envoyé.
- Le créateur des modèles est un `OnceLock`, posé au premier appel de `router()`.

### Pour le crate `mcp`

- **Décrire** : `agent::describe::{agent_list_bases, agent_describe_base, agent_describe_table, agent_who_am_i, notice}`.
- **Lignes** : `agent::records::{agent_list_records, agent_get_record, agent_lookup_records, agent_create_record, agent_update_record, agent_delete_record, agent_restore_record, agent_error, require_write, read_back, write_result, bounds}`. Elles prennent `(pools, ctx, instance_key, …, idempotency_key: Option<&str>)`. Les clés d'idempotence viennent de `basedb_base::idempotency`.
- **Fichiers** : `agent::files::agent_attach_file(st, ctx, &AgentAttachRequest)`.
- **Journal** : `agent::audit::{record_agent_call, params_shape, value_digest}`.
- **Propositions** : les fonctions publiques de `proposals`.
- **Protocole MCP** : `initialize` renvoie `mcp-session-id`, et tout en-tête `Origin` est refusé.

## Crate `mcp`

Port de `apps/mcp` (≈ 3 000 lignes) : `app.ts` → `routes.rs`, `sessions.ts` → `sessions.rs`, `tools.ts` → `tools.rs` (et `catalog.json`), `validate.ts` → `validate.rs`, `shape.ts` → `shape.rs`, `errors.ts` → `errors.rs`. Aucune logique métier dans le crate : les outils appellent `basedb_automations::agent::{describe, records, files, audit}`, `basedb_automations::proposals`, et le client insights de `basedb_admin` (jeton `whoami`, appels signés). `basedb_ai` est dans le graphe, mais aucun outil ne l'appelle aujourd'hui.

### Comment Rust sert MCP

- **Sur le port de `basedb-server`** : `crates/server` fusionne `basedb_mcp::router` (`GET`, `POST`, `DELETE /mcp`) **hors** de `app::build`. `/mcp` n'a donc ni CORS, ni garde démo, ni le `x-request-id` repris de l'API : il a le sien, que le client ne choisit jamais, comme le processus Node. Avec `BASEDB_WEB_DIR`, le crate `web` envoie `/mcp` (avec ou sans le chemin de base) au même routeur.
- **Sur un port à lui** (`BASEDB_MCP_PORT`) : `basedb_mcp::standalone` sert `/mcp` et `/healthz` (`{"status":"ok"}`), comme `server.ts`. C'est le même état : mêmes sessions, même quota, que le client passe par l'un ou l'autre port.
- **État en mémoire** (`McpState`, `st.ext`) : sessions, quota, et des pools à part : `statement_timeout` 5 s et `lock_timeout` 1 s, comme `server.ts`. Le pool DDL garde ses réglages.
- **Pas de flux serveur** : comme Node, `GET /mcp` répond 405 (`Allow: POST, DELETE`) et chaque réponse revient en JSON sur le `POST` qui l'a demandée. Aucune découverte OAuth : l'authentification se fait par jeton d'intégration (`Authorization: Bearer bdb_…`, surface `mcp`).

### Bascule (ce qui reste à changer pour supprimer le processus Node MCP)

- **`docker/image/start.mjs`** : supprimer le bloc `run('mcp', 'node', ['dist/server.js'], …)` (≈ l. 605). Ensuite, au choix :
  - poser `BASEDB_MCP_PORT=8788` sur `basedb-server`, et Caddy reste tel quel. `RUST_PORT` doit alors différer de 8788, son défaut ;
  - ou faire pointer le `handle @mcp` de Caddy (`uri strip_prefix ${path}`, `reverse_proxy`, `flush_interval -1`, ≈ l. 173) vers le port de `basedb-server`. C'est le plus simple : plus de second port.
- **`docker/image/Caddyfile`** (≈ l. 29) : même choix pour `handle /mcp*`.
- **Dockerfile** : ne plus construire (`tsc -b … apps/mcp`) ni copier `apps/mcp/dist`.
- **Le développement** (`pnpm start`, `scripts/start.mjs`) lance encore Node MCP sur 8788 : à retirer quand Rust remplace l'API.
- **`__BASEDB_MCP__`** et `BASEDB_MCP` ne changent pas (`${basePath}/mcp`) : l'adresse publique reste la même.
- **Le catalogue des outils** : `catalog.json` a été écrit par `bench/mcp-catalog.mjs` depuis `apps/mcp/dist`. Une fois Node supprimé, il devient la source et se modifie à la main.

### Bizarreries de Node reproduites

- **Outil inconnu, méthode inconnue** : erreur JSON-RPC (-32602, -32601) en HTTP **200**. Une notification ou une réponse du client reçoit 202 sans corps, après le contrôle de session.
- **Ordre des contrôles** :
  1. `Origin` : 403 `AUTHENTICATION_REQUIRED` ;
  2. type de contenu : 415 ;
  3. taille : `content-length` déclaré, puis corps lu au-delà de 16 Mio : 413. `Number(content-length)` illisible laisse passer ;
  4. JSON : -32700 ;
  5. lot : -32600 ;
  6. `jsonrpc: "2.0"` ;
  7. jeton, **vérifié à chaque message** : 401 avec le code de base (`TOKEN_INVALID` sans jeton). Un jeton refusé ferme ses sessions ;
  8. **quota, pris avant la vérification de session** : 240/min, rafale de 60, 429 avec `retry_after` ;
  9. session : sans en-tête 400, inconnue 404, version de protocole différente 400 ;
  10. requêtes en vol : 4 par session.
- **Sessions** : liées au condensat sha256 du secret, jamais au secret lui-même. 16 par jeton (la moins récemment vue part), 30 min d'inactivité.
- **Versions de protocole** : `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`. Une version bien formée mais inconnue donne la plus récente. Une version mal formée donne 400 `PARAMETER_INVALID` (`invalid_params: ["protocolVersion"]`).
- **Les budgets de `whoami`** : `AGENT_WRITE_BUDGETS` (`rows_written_per_hour` 500, `rows_written_per_table_per_hour` 200), puis le quota (`calls_per_minute`, `burst`) et `concurrent_requests`, dans cet ordre de clés.
- **Audit** : une ligne par appel d'outil, avec le contexte de la connexion et les arguments complets (`params_shape`, `value_digest`). Un nom réservé est audité avec `{}`. L'échec de l'audit ne fait jamais échouer l'appel.
- **`environment`** : l'argument est refusé par `only` sur un outil sans base. Sinon on prend, dans l'ordre : `?environment=`, puis `x-basedb-environment`, puis celui de la base.
- **Insights** :
  - les échecs de `insights_create_dashboard` portent `{code, …details}` ;
  - l'URL publique perd sa barre finale ;
  - `insights_run_question` lit chaque cellule comme `row[i] ?? null` en JavaScript : une ligne en chaîne donne ses unités UTF-16, une ligne objet donne la clé `"i"`, une ligne `null` est une réponse malformée.
- **`resources/read`** : un `%` mal formé dans l'URI répond 500 `text/plain` « Internal Server Error », comme le `decodeURIComponent` non rattrapé de Node.

### Écarts connus (non reproduits)

- **JSON hors limites** : un nombre hors de portée (`1e400`) donne `Infinity` pour `JSON.parse`, mais une erreur d'analyse (-32700) pour serde. Même cas pour une profondeur supérieure à 128 et pour une demi-paire de substitution échappée seule.
- **`/mcp/`** (barre finale) : Node répond son propre 404. Rust laisse la requête aux autres routes, donc au relais ou au 404 de l'application.
- **`/healthz`** n'est celui de MCP que sur `BASEDB_MCP_PORT`. Sur le port principal, c'est celui de l'API.
- **Cache des jetons** : une révocation faite par l'API Node n'est vue par Rust qu'à l'expiration de son cache. Le processus Node MCP avait déjà ce défaut face à l'API Node. Une révocation native (crate `admin`, même processus) vide le cache aussitôt.

### Banc de parité

`node rust-server\bench\mcp-parity.mjs [-v]`, depuis la racine. Il faut que l'API Node (:8787) et PostgreSQL tournent, et que `target-mcp\debug\basedb-server.exe` et `apps/mcp/dist` soient construits.

- **Serveurs lancés par le banc** : Node MCP sur :8804, Rust sur :8803 avec `BASEDB_MCP_PORT=8805`, et un insights simulé sur :8806, qui enregistre les requêtes reçues et les claims du JWT.
- **Mise en place**, par l'API Node :
  - une connexion admin et une connexion lecteur, élevées ;
  - une base jetable par serveur (Clients avec texte riche, liste, fichier, image ; Commandes avec un lien) ;
  - un groupe donnant `manage` au lecteur ;
  - huit jetons par base : complet, écriture, lecture, REST seul, révoqué, occupé, quota, lecteur ;
  - un jeton de lecture sur `demo_atelier_lumen`.
- **Phases** :
  - protocole ;
  - outils de lecture ;
  - écriture, avec idempotence, suppression et restauration ;
  - fichiers ;
  - propositions : approbation et refus par l'API ;
  - lecteur et base de démonstration ;
  - insights : joignable, puis serveurs relancés avec insights injoignable, puis absent ;
  - quota et requêtes en vol ;
  - port séparé ;
  - lignes `audit_log` et `security_log` par jeton.
- **Normalisation** : identifiants, dates, préfixes de jetons, curseurs chiffrés (`<cursor>`, la page suivante est comparée), `request_id`.
- **Nettoyage** : jetons révoqués, groupe et bases supprimés, déconnexions, serveurs arrêtés, même en cas d'échec.
- **Résultat** : 295 comparaisons, **0 écart, deux passes complètes**.

## Crate `web` — l'interface sans Node

### Décisions

- **Un gabarit par route, rempli par Rust.** `next build` avec `output: 'export'` (`BASEDB_WEB_STATIC=1`) refuse `force-dynamic` et ne connaît ni le lecteur ni les jetons. Le layout statique (`StaticShell`, `app/layout.tsx`) écrit `<html lang="__basedb_locale__">` et un `<script id="__basedb_runtime__" type="application/json">{"description":"…"}</script>`. Rust remplace la langue et met à la place du script `<meta name="description">` (traduite) puis le script du layout de Next : mêmes valeurs, même échappement de `<`. Les routes à jeton et `[...address]` sont exportées une fois avec le jeton `__shell__` (`generateStaticParams`) ; `useRouteToken()` (`lib/route-token.ts`) lit alors le jeton dans l'adresse, encodé comme Next le donne. Hors build statique, rien ne change : `force-dynamic` devient `await connection()`, au même effet.
- **La description n'est pas une métadonnée Next dans le gabarit.** React 19 hydrate les `<meta>` comme ressources repérées par leur `content` : une description changée côté serveur ferait ajouter un doublon. Une `<meta>` brute dans `<head>`, que React ignore à l'hydratation, n'en a pas.
- **Le marqueur `/__basedb_base_path__`** est celui de l'image : l'export est le même pour tout chemin, Rust le remplace en mémoire au démarrage (`withPath` de `start.mjs`, forme échappée puis simple). Les pages sont servies avec ou sans le préfixe, comme le routeur Caddy de l'image ; l'API reçue sous le préfixe le perd avant le routeur.
- **Les charges RSC** (`…/x.txt`, `…/__next.*/…txt`) d'une adresse non exportée reçoivent celles du gabarit. L'interface ne navigue pas par le routeur de Next (ni `next/link` ni `useRouter`) : la navigation vérifiée ne demande aucun document ni aucune charge.
- **Pas de fichiers précompressés** : la compression reste au proxy (Caddy `encode zstd gzip` dans l'image). Pas d'ETag : les fichiers de `/_next/static/` sont nommés par leur contenu (cache immuable), les pages sont `no-store`, le reste (`favicon.ico`, `brand/`, `geo/`) `public, max-age=0` comme Next.
- **`BASEDB_WEB_DIR` absente : rien ne change.** Pas de dossier par défaut deviné : un serveur Rust de développement ne se met pas à servir l'interface parce qu'un export traîne dans `apps/web`.

### Écarts volontaires avec Next

- **`?lang` redirige vers une adresse relative** (`Location: /chemin?reste`), chemin de base compris. `proxy.ts` construisait une URL absolue depuis `x-forwarded-host` ; Next la ramenait en relatif pour son propre hôte (vérifié sur :3200). Mais `nextUrl.pathname` n'a pas le `basePath` : sous `/basedb`, Next renvoyait vers `/bases/x` sans le préfixe. Rust garde le chemin reçu. Le cookie est identique (`basedb-locale=xx; Path=/; Expires=…; Max-Age=31536000; SameSite=lax`).
- **Redirections toujours locales** : un chemin `//hôte` devient `/hôte`.
- **`/insights`** : en développement, `next dev` relaie encore `/insights` vers insights (`rewrites`, inchangés). L'export n'a pas de relais : sous Rust, `/insights` reçoit le gabarit de l'interface. Dans l'image, Caddy route `/insights` avant l'interface ; un serveur Rust seul devra relayer insights lui-même ou rester derrière Caddy.

### Bascule de l'image Docker (phase suivante, rien n'est changé ici)

- **Dockerfile.** La cible `web` construit `pnpm --filter @basedb/web build:static` au lieu du build `standalone` (`BASEDB_WEB_STANDALONE=1`), et copie `apps/web/out-static` dans l'image (par exemple `/app/web`). Plus de `node_modules` ni de `.next/standalone` pour l'interface.
- **`start.mjs`.** Plus de processus Next sur `127.0.0.1:3001`, plus de `placeInterface()` pour basedb : Rust remplace le marqueur en mémoire. `basedb-server` reçoit `BASEDB_WEB_DIR=/app/web`, `BASEDB_BASE_PATH`, et `BASEDB_API` / `BASEDB_MCP` aux défauts de `interfaceEnv()` (`${basePath}/`, `${basePath}/mcp`). insights garde son propre `placeInterface`.
- **Caddy.** Le `handle` final (l'interface) pointe vers `basedb-server` au lieu de `:3001` ; `routerUnder` perd ses réécritures `@root` / `@bare` vers le préfixe, puisque Rust accepte les deux formes. Tant que l'API reste à Node, l'ordre ne change pas : `/api`, `/auth`, `/healthz` vers l'API, `/mcp` vers MCP, insights avant le reste. Quand Rust servira tout, Caddy ne garde qu'insights et la compression.
- **`docker-publish.yml`** et les tests de l'image : vérifier une page profonde, `?lang=`, l'en-tête de `/v/…` et un chemin de base.

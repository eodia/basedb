# basedb-server : le back-end de basedb en Rust

Ce dossier contient le back-end de basedb, en Rust (axum + tokio + tokio-postgres) : l'API REST, le serveur MCP, les tâches de fond, les migrations du catalogue et le service de l'interface exportée. Il a remplacé le back-end Node (`apps/api`, `apps/mcp`, `packages/core`), supprimé à la bascule ; le dernier état de Node est le commit `ecd79eeda5869f86104044eed51ffc68650e2d37` (`ecd79ee`). Le web (`apps/web`), le site (`www`) et les paquets TypeScript côté client (`contracts`, `naming`, `sdk`, `n8n-nodes-basedb`, `templates`) restent en TypeScript ; Node ne sert plus qu'à les construire.

```
navigateur ──► basedb-server :3000 (image) / :8787 (dév.) ──► PostgreSQL (catalogue _basedb, bases b_*)
                 │  /api, /auth, /healthz, /mcp      : routes natives
                 │  le reste                         : l'interface exportée (BASEDB_WEB_DIR)
                 └─ /insights (BASEDB_INSIGHTS=1)    : relayé vers insights (:4200 serveur, :3100 interface)
```

> Port : `PORT`, **8787** par défaut (`BASEDB_HOST` pour l'adresse, `0.0.0.0`). L'image écoute sur 3000. `/mcp` est servi sur ce port, et sur un second si `BASEDB_MCP_PORT` est posée (8788 en développement). Une route qui n'existe pas répond le 404 de Node (`NOT_FOUND`) : il n'y a plus de relais.

## Développer

Prérequis : Rust stable par `rustup`. Sous Windows, `stable-x86_64-pc-windows-msvc` (Visual Studio Build Tools), ou `stable-x86_64-pc-windows-gnu` avec MinGW-w64 dans le `PATH` — la chaîne de ce dépôt (`.cargo/config.toml` : `linker = "gcc"`). Sous Linux et macOS, la chaîne par défaut.

```bash
corepack pnpm dev          # PostgreSQL jetable, basedb-server (cargo, debug) :8787 + MCP :8788, next dev :3200
corepack pnpm test:server  # cargo test --workspace (intégration : un PostgreSQL dans DATABASE_URL ou .env)
cargo clippy --workspace --all-targets
```

`scripts/start.mjs` compile par cargo (`BASEDB_CARGO_PROFILE=release` pour le profil optimisé, `BASEDB_CARGO_TOOLCHAIN` pour nommer une chaîne). Les migrations du catalogue (`packages/catalog-schema/migrations`) sont **embarquées dans le binaire** à la compilation (`crates/base/build.rs`) : un binaire seul suffit, et une nouvelle migration demande de recompiler. `APPLICATION_VERSION` est la version de `[workspace.package]` de `Cargo.toml`, vérifiée par `docker-publish.yml` à la publication.

Sous-commandes : `basedb-server healthcheck` (la sonde de l'image : `GET /healthz` sur `PORT`) ; `basedb-server create-database <url> <url-admin>` (crée la base d'`url` si elle manque — celle d'insights, dans l'image `basedb-insights`).

Seul sur son port, `basedb-server` fait aussi ce que faisait Caddy dans l'ancienne image (`crates/server/src/front.rs`) : l'adresse du visiteur (un mandataire du réseau privé garde son `X-Forwarded-For`, tout autre est remplacé par son adresse), la compression gzip des réponses entières, et `/insights`.

## La sécurité ne change pas

- **Mêmes rôles, mêmes réglages de session** : les pools `catalog`, `data` et `ddl` (`base::db`) reprennent le contrat de connexion de `runtime/pool.ts` (`application_name`, `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `search_path`, fuseau UTC). Comme Node, **aucun `SET ROLE`** : l'acteur n'existe que dans les réglages `basedb.actor_kind`, `basedb.actor_id`, `basedb.surface`, `basedb.request_id` et `basedb.token_id` (`set_config(…, true)`), posés par `tx::with_transaction` dans chaque transaction. Les politiques RLS et les déclencheurs d'audit du catalogue les lisent.
- **Mêmes secrets, compatibles dans les deux sens** :
  - argon2id, avec les mêmes paramètres et le même poivre dérivé de `BASEDB_ENCRYPTION_KEY` (un hachage Node se vérifie en Rust, et l'inverse) ;
  - le cookie `__Host-basedb_session`, le CSRF `x-basedb-csrf` (HMAC du jeton de session) ;
  - les jetons d'accès (HMAC maison de Node, pas des JWT) et les jetons d'intégration `bdb_*`.

  Le banc de parité l'a vérifié : un jeton émis par Node est accepté par Rust et l'inverse, et un cookie émis par Rust ouvre une session Node.
- **Une seule traduction des erreurs** : `AppError` porte un code du registre (`contracts::errors`, 241 codes, statut HTTP compris). La réponse a le corps exact de `app.onError` (chapitre 08 §6) : `{"code","details","request_id"}`. Les SQLSTATE PostgreSQL sont traduits comme `errors/pg.ts`.
- **Décisions de droits** : `rbac::decide` est un port fidèle de `rbac/decide.ts`, tests compris. `rbac::loader` et `rbac::require` lisent les mêmes tables.
- **Ce qui est identique à Node** :
  - CORS : avec `BASEDB_ORIGINS` absent, seules les origines `localhost` et `127.0.0.1` sont autorisées, comme dans `app.ts` ;
  - `x-request-id` ;
  - la limite de 10 tentatives par minute et par adresse sur `/auth/*` ;
  - le garde du mode démo ;
  - le verrouillage du compte, tous les 10 échecs.

## Le workspace

| Crate | Rôle |
|---|---|
| `crates/contracts` (`basedb_contracts`) | Port de `packages/contracts` et `packages/naming`. Contenu :<br>• les types partagés ;<br>• le registre des codes d'erreur (code, condition, statut HTTP), généré par `tools/gen-contracts.mjs` ;<br>• les locales (`LOCALES`, `is_locale`, `accepted_languages`, `match_locale`) ;<br>• les noms physiques (`slug`, `tenant`, mots réservés, budgets d'octets). |
| `crates/base` (`basedb_base`) | Le socle, sans métier. Modules :<br>• `config` : mêmes variables que `server.ts`, avec `.env` et `.env.local` ;<br>• `state` (`AppState`, `Shared`, `st.ext::<T>()`) ;<br>• `db` : pools deadpool-postgres et `Exec` ;<br>• `tx` : `RequestContext`, `with_transaction` ;<br>• `error` ;<br>• `layers` : CORS, request-id, démo ;<br>• `rate_limit` ;<br>• `auth` : mots de passe, sessions, jetons d'accès et d'intégration, introspection, routes `/auth/*` ;<br>• `rbac` ;<br>• `audit` ;<br>• `idempotency` ;<br>• `migrate` : migrations du catalogue ;<br>• `listener` : LISTEN/NOTIFY ;<br>• `mailer` : SMTP avec lettre, et un courrier de développement journalisé ;<br>• `testing`. |
| `crates/catalog` (`basedb_catalog`) | Le catalogue : projection et cache, méta, OpenAPI et documentation, projets, bases et tables (création, libellés, descriptions, apparence), ordre des champs, vues enregistrées, questions et requêtes, boutons, vues SQL, historique de structure, corbeille, nommage et allocation des noms physiques, émission DDL ; moteur de migration en plusieurs étapes (suppressions, restaurations, purge, reprise) ; ajout et configuration des champs, champs calculés ; environnements ; console SQL et lecteur d'insights ; modèles (les automatisations d'un modèle sont créées par le crate `automations`, les champs IA par le crate `ai`). Voir `NOTES.md`, « Crate catalog ». |
| `crates/records` (`basedb_records`) | Porté, parité vérifiée contre Node avant la bascule :<br>• lecture des lignes (filtres, tris, curseurs, décompte, liens, champs calculés, variables, fichiers signés), `deleted`, `aggregate`, `referenced_by` ;<br>• écritures, lots, clés d'idempotence, historique, annulation, restauration ;<br>• fichiers (disque et S3), géo ;<br>• formulaires et vues publiques, partage des vues ;<br>• commentaires, mentions, notifications, présence, flux en direct (SSE) ;<br>• analyses (`query`), exports ;<br>• compilateur des règles de lignes (`rbac::rows`) ;<br>• écritures des tables synchronisées (`sync_rows`).<br>`…/documents` est servi par le crate `ai`. Voir `NOTES.md`, « Crate records ». |
| `crates/admin` (`basedb_admin`) | Porté, parité vérifiée contre Node avant la bascule :<br>• `admin` : comptes, groupes, droits, règles de colonnes et de lignes, jetons, inscription, partage ;<br>• routes `/auth/*` restantes : profil, adresse, identités, fournisseurs, détachement OIDC, demande de réinitialisation, inscription, invitation, amorçage ;<br>• `integrations` (Slack) ;<br>• `insights` : état, lien, recherche, source poussée ;<br>• `mail` : file, textes des notifications en 20 langues, envoi ;<br>• tables synchronisées (`synced.rs`, `sync_sources.rs`) : CSV, ICS, vue partagée, question d'insights, avec les écritures de `records::sync_rows` ;<br>• tâches de fond.<br>• OIDC : départ, retour, liaison (`oidc.rs`). |
| `crates/automations` (`basedb_automations`) | Porté, parité vérifiée contre Node avant la bascule :<br>• automatisations : définitions, validation, liste, création, modification, suppression, exécutions, `run` manuel, webhooks entrants (`/api/v1/hooks/{secret}`), `press` des boutons ;<br>• moteur d'exécution (`engine.rs`) : déclencheurs, conditions, étapes (lignes, courriel, notification, webhook, Slack, IA, document, agrégat, recherche, branche, boucle, sous-automatisation), reprises, journal ;<br>• webhooks sortants : CRUD, livraisons, signature HMAC identique à Node ;<br>• propositions : liste, approbation, refus ;<br>• bibliothèque de l'agent (`agent/`) pour le crate `mcp` ;<br>• copilote d'automatisation (sur `basedb_ai::copilot`) ;<br>• créateur des automatisations des modèles (`template_apply`).<br>Aucun relais. Voir `NOTES.md`, « Crate automations ». |
| `crates/ai` (`basedb_ai`) | Porté, parité vérifiée contre Node avant la bascule :<br>• fournisseurs (OpenAI, Anthropic, Mistral, compatible OpenAI, réglages d'instance et variables `BASEDB_AI_*`), consentement, quotas ;<br>• copilote de base, formule, structure, brouillon de modèle, aperçu de planification ;<br>• pièces jointes, avec un lecteur PDF natif (`pdf/`) ;<br>• champs IA (état, réglage, arrêt, `run`) ;<br>• documents : modèles et rendu PDF natif (`documents/`, polices `BASEDB_PDF_FONTS`) ;<br>• champs IA du catalogue (champ avec `ai`, modèles, environnements) par les crochets `basedb_catalog::ai_hooks`.<br>• travailleur de fond des champs IA (`worker.rs`, avec `BASEDB_RUST_BACKGROUND=1`).<br>Le copilote d'automatisation est servi par le crate `automations`, sur `basedb_ai::copilot`. |
| `crates/mcp` (`basedb_mcp`) | Porté, parité vérifiée contre Node avant la bascule : le serveur MCP de `apps/mcp` (Streamable HTTP, JSON-RPC, réponses JSON sans flux serveur) :<br>• protocole : `initialize` et `mcp-session-id`, versions, notifications, `ping`, refus d'`Origin`, tailles, quota et requêtes en vol ;<br>• les 21 outils (`catalog.json`, déclarations reprises telles quelles de Node), sur la bibliothèque de l'agent de `automations` et le client insights de `admin` ;<br>• ressources (`basedb://…`), journal d'audit et de sécurité.<br>Servi par `basedb-server` sur `/mcp` de son port, et sur un port à lui avec `BASEDB_MCP_PORT`. Voir `NOTES.md`, « Crate mcp ». |
| `crates/web` (`basedb_web`) | L'interface sans Node à l'exécution : sert l'export statique d'`apps/web` (`BASEDB_WEB_DIR`) et fait par requête ce que faisait le serveur de Next. Voir [L'interface sans Node](#linterface-sans-node). Ne dépend que de `contracts`. |
| `crates/server` (bin `basedb-server`) | Rôles :<br>• migre ou vérifie le catalogue ;<br>• assemble les routeurs des domaines ;<br>• amorce l'instance (`socle.rs`) : codes d'erreur, partitions des journaux, migrations abandonnées, premier administrateur ;<br>• lance les tâches de fond ;<br>• fait le frontal (`front.rs`) : adresse du visiteur, gzip, `/insights` ;<br>• sert l'interface quand `BASEDB_WEB_DIR` est posée (crate `web`). |

Graphe des dépendances (acyclique) :

```
contracts ← base ← catalog ← records ← automations ← mcp ← server
                           ↖ admin ←───────────────┘   (admin dépend aussi de records)
                             records ← ai ←────────┘
```

Un crate ne dépend jamais d'un crate au-dessus de lui. Si deux domaines ont besoin du même service, il descend dans `base`.

## Ce qui est natif aujourd'hui

| Route | Natif | Notes |
|---|---|---|
| `GET /healthz` | ✅ | |
| `GET /api/v1/codes` | ✅ | Le registre des erreurs. |
| `POST /auth/password/login` | ✅ | Comportements repris :<br>• limiteur par adresse ;<br>• adresse normalisée ;<br>• mot de passe du compte de démo ;<br>• verrouillage tous les 10 échecs. |
| `POST /auth/password/change` | ✅ | Ferme les autres sessions, plante une session neuve. |
| `POST /auth/session/access` | ✅ | Seule route qui exige `x-basedb-csrf`. |
| `POST /auth/introspect` | ✅ | JSON, formulaire `x-www-form-urlencoded` et `multipart/form-data`. |
| `DELETE /auth/session` | ✅ | |
| `GET, DELETE /auth/sessions` | ✅ | |
| `DELETE /auth/sessions/{id}` | ✅ | |
| `GET /auth/me` | ✅ | Cookie ou jeton d'accès. C'est la route d'identité (`whoAmI`). Il n'existe pas de `/api/v1/{tenant}/me`. |
| `POST /auth/elevate` | ✅ | Rotation de la session. |
| `DELETE /auth/elevation` | ✅ | |
| `GET /auth/password/reset` | ✅ | |
| `POST /auth/password/reset/confirm` | ✅ | |
| `GET /auth/demo` | ✅ | Seulement si la démo est configurée. Sinon, 404 (`NOT_FOUND`), comme Node. |
| `GET /api/v1/dev/account` | ✅ | Seulement au démarrage qui vient de créer l'administrateur avec `BASEDB_DEV_LOGIN=1` (`developmentEmail` de Node). |
| `PATCH /auth/me`, `PUT /auth/me/email`, `GET /auth/identities` | ✅ | Crate `admin` (`profile.rs`) : profil, changement d'adresse (courriel de confirmation mis en file). |
| `POST /auth/password/reset/request` | ✅ | Crate `admin` : courriel localisé mis en file (`_basedb.mail_outbox`). |
| `GET /auth/oidc/providers`, `DELETE /auth/oidc/{slug}/link` | ✅ | Crate `admin` : liste des fournisseurs, détachement d'une identité (session élevée, jamais la dernière). |
| `GET, POST /auth/signup`, `POST /auth/invitation`, `GET, POST /auth/bootstrap` | ✅ | Crate `admin` (`signup.rs`) : inscription, aperçu d'invitation, premier compte. |
| `GET /auth/oidc/{slug}/start`, `GET /auth/oidc/{slug}/callback`, `POST /auth/oidc/{slug}/link` | ✅ | `oidc.rs` : découverte, JWKS, PKCE, cookie d'échange scellé. Testé contre un fournisseur simulé ; sans fournisseur réel, la parité avec Node n'a pas été mesurée. |
| `/api/v1/{tenant}/admin/users…`, `…/groups…`, `…/access`, `…/access/tables/{table}/fields`, `…/access/fields/{field}`, `…/access/tables/{table}/mask` | ✅ | Crate `admin` : comptes, groupes et membres, droits, règles de colonnes. |
| `GET …/admin/access/tables/{table}/rows`, `GET …/rows/effective` | ✅ | Crate `admin` (`rows.rs`). Le décompte effectif compile les règles par `rbac::rows` : le compilateur de filtres est enregistré par `records`. |
| `PUT …/admin/access/tables/{table}/rows` | ✅ | Crate `admin` (`rows.rs`) : règle validée par le compilateur de `records`, puis `ENABLE`/`DISABLE ROW LEVEL SECURITY` (`sql/row-security.ts`). |
| `…/admin/signup`, `…/admin/tokens…`, `GET /api/v1/{tenant}/me/tokens`, `GET /api/v1/{tenant}/meta/users` | ✅ | Crate `admin`. `/meta/users` est à regrouper plus tard avec `catalog`. |
| `…/admin/bases/{base}/integrations…` (GET, POST, DELETE, POST `test`) | ✅ | Crate `admin` : intégrations Slack (adresse vérifiée ; `BASEDB_WEBHOOK_DEV=1` comme `anyHost`). |
| `…/admin/bases/{base}/synced-tables…` (6 routes) | ✅ | Crate `admin` (`synced.rs`, `sync_sources.rs`) : aperçu, création (tables et champs par `basedb_catalog`), modification, arrêt, `run` ; lignes écrites par `basedb_records::sync_rows::apply`. Les tables dues sont synchronisées chaque minute par les tâches de fond (`BASEDB_RUST_BACKGROUND=1`). |
| `GET /api/v1/{tenant}/insights`, `POST …/insights/link`, `GET …/insights/search` | ✅ | Crate `admin` : état, lien SSO, recherche. |
| `POST /api/insights/reader` | ✅ | Crate `catalog` (`insights_reader.rs`) : jeton d'insights vérifié, rôle LOGIN du lecteur provisionné (`sql_console`), portée et résumés des vues SQL. |
| `/api/v1/{tenant}/sharing/{kind}/{id}…`, `/api/v1/{tenant}/invitations…` | ✅ | Crate `admin` (`sharing.rs`) : partage, invitations, acceptation. |
| `GET /api/v1/{tenant}/me/notifications`, `POST …/read` | ✅ | Crate `records` (`notifications.rs`). |
| `GET …/data/{base}/{table}`, `GET …/data/{base}/{table}/{id}` | ✅ | Crate `records` : filtres, tris, curseur scellé, `count=exact` (plafond 100 000), `expand`, `links=id`, champs calculés, variables, liens signés des fichiers ; droits de table, masques de colonnes, règles de lignes. `…/deleted`, `…/aggregate`, `…/export` (CSV, JSON, xlsx) et `…/{id}/referenced_by` sont natifs ; `…/documents` est servi par le crate `ai`. |
| `POST …/data/{base}/{table}`, `PATCH, DELETE …/{id}`, `POST …/batch` | ✅ | Crate `records` (`write.rs`, `values.rs`, `entities.rs`) : valeurs par type, liens, clés d'idempotence, en-tête de transaction, historique (`drain.rs`), `basedb_live`. |
| `GET …/{id}/history`, `GET …/meta/bases/{base}/history`, `POST …/history/undo`, `POST …/history/{revision}/revert`, `…/restore` | ✅ | Crate `records` (`history.rs`, `drain.rs`). |
| `POST …/files/{base}/{table}/{field}`, `GET …/files/{id}/{name}` | ✅ | Crate `records` (`files.rs`, `storage.rs`) : disque (`BASEDB_FILES_DIR`) ou S3 (SigV4). |
| `POST …/geo/geocode`, `GET …/geo/search` | ✅ | Crate `records` (`geo.rs`). |
| `GET, POST /api/v1/forms/{token}`, `POST …/check`, `GET /api/v1/views/{token}`, `…/rows`, `…/calendar.ics`, `…/views/{view}/share` (+ `regenerate`) | ✅ | Crate `records` (`forms.rs`, `quiz.rs`). Les pages `/f/…` et `/v/…` sont servies par l'interface. |
| `…/data/{base}/{table}/{id}/comments`, `PATCH, DELETE …/comments/{comment}`, `POST …/presence`, `…/presence/pointer`, `GET …/events` (SSE) | ✅ | Crate `records` (`collab.rs`) : mentions, notifications, flux en direct sur `base::listener`. |
| `POST …/query/{base}` | ✅ | Crate `records` (`analytics.rs`) : questions enregistrées ou données entières. |
| `GET …/meta/bases`, `GET …/meta/bases/{base}`, `…/openapi.json`, `…/doc` | ✅ | Crate `catalog` (`serve.rs`) : projection selon les droits, ETag et `304`, cache par version du catalogue. |
| `GET …/meta/projects`, `POST …/admin/projects`, `PATCH, DELETE …/admin/projects/{id}` | ✅ | Crate `catalog` (`projects.rs`). |
| `POST …/admin/bases` | ✅ | Crate `catalog` (`operations.rs`) : base vide, schéma alloué. Avec `template` (clé ou modèle en ligne, réponse JSON ou flux `application/x-ndjson`) : `routes_templates.rs` et `template_apply.rs`. Les automatisations du modèle sont créées par le crate `automations`, les champs IA (avec `ai_consent`) par le crate `ai`. |
| `PATCH …/admin/bases/{base}` | ✅ | Libellé, description, apparence de la base et de ses environnements ; `pg_notify('basedb_catalog')`. |
| `POST …/admin/bases/{base}/tables`, `PATCH …/tables/{table}` | ✅ | Table et champs simples en une transaction DDL : colonnes, `CHECK` url/e-mail, cinq déclencheurs, commentaires. |
| `PATCH …/tables/{table}/fields/{field}` | ✅ | Libellé, description, `format`, `default`, `formula` (moteur des champs et des champs calculés). |
| `PUT …/tables/{table}/fields/order` | ✅ | |
| `GET …/meta/bases/{base}/tables/{table}/views`, `POST, PUT order, PATCH, DELETE …/admin/…/views…` | ✅ | Vues enregistrées. |
| `…/meta/bases/{base}/questions…`, `…/admin/bases/{base}/questions…` | ✅ | Questions (lecture, création, modification, suppression). |
| `…/meta/bases/{base}/queries…`, `…/admin/bases/{base}/queries…`, `GET …/query-groups` | ✅ | Requêtes enregistrées, avec les en-têtes `Deprecation` et `Link`. |
| `GET, POST …/data/{base}/{table}/buttons`, `PATCH, DELETE …/buttons/{button}` | ✅ | Crate `catalog`. `POST …/buttons/{button}/press` : crate `automations`. |
| `GET …/meta/bases/{base}/sql-views…`, `POST, PUT order, PATCH, DELETE …/admin/bases/{base}/sql-views…` | ✅ | Vues SQL : définition vérifiée sous le rôle lecteur, dépendances, détachement et rattachement. |
| `GET …/admin/bases/deleted`, `GET …/deleted-tables`, `GET …/structure-history`, `GET …/migrations` | ✅ | Corbeille, historique de structure, liste des migrations. |
| `DELETE …/admin/bases/{base}`, `…/tables/{table}`, `…/fields/{field}`, `POST …/bases/{base}/restore`, aperçus `GET …/tables/{table}/deletion` et `…/fields/{field}/deletion`, `POST …/admin/migrations/{id}/resume`, `POST …/admin/purge`, `…/purge/exports` | ✅ | Moteur de migration en plusieurs étapes (`engine.rs`, `lifecycle.rs`, `deletion.rs`, `purge.rs`) : mêmes lignes `catalog_migration`, même reprise après interruption. |
| `POST …/tables/{table}/fields`, `…/links`, `…/display`, `PUT …/fields/{field}/options`, `POST …/fields/{field}/required`, `…/unique` | ✅ | `fields.rs`, `field_config.rs`, `computed_fields.rs`, `select_options.rs`. Un champ avec `ai` passe par le crate `ai` (`ai_hooks`). Refusés comme invalides : une liste d'options que Node lisait en `TypeError`, un lien dont `required` ou `on_delete` n'est pas lisible, un `field` d'affichage non textuel. |
| `POST …/ai/bases/{base}/expression`, `…/structure`, `…/copilot`, `POST …/ai/attachments`, `POST …/ai/schedule/preview`, `POST …/admin/templates/draft` | ✅ | Crate `ai` (`routes.rs`, `copilot.rs`, `drafts.rs`, `attachments.rs`, `schedule.rs`, `template_draft.rs`). `POST …/ai/bases/{base}/automation-copilot` : crate `automations` (`copilot.rs`). |
| `GET, PUT, DELETE …/fields/{field}/ai`, `POST …/fields/{field}/ai/run` | ✅ | Crate `ai` (`fields.rs`). Le remplissage en tâche de fond : `worker.rs` (`BASEDB_RUST_BACKGROUND=1`). |
| `GET …/data/{base}/{table}/documents`, `GET …/{id}/documents/{template}`, `GET, POST …/{id}/documents/preview`, `POST …/admin/bases/{base}/tables/{table}/documents`, `PATCH, DELETE …/documents/{id}` | ✅ | Crate `ai` (`documents/`) : modèles, rendu PDF natif (polices du PDF ou Noto de `BASEDB_PDF_FONTS`). Une autre méthode sur ces chemins : 404 (`NOT_FOUND`). |
| `…/admin/bases/{base}/environments…` (10 routes) | ✅ | `environments.rs`, `env_rows.rs`, `routes_environments.rs` : différence, plan, application, synchronisation des lignes. La copie des champs IA avec consentement passe par le crate `ai` (`ai_hooks`). |
| `POST …/sql/{base}`, `GET …/sql/{base}/views/{view}` | ✅ | `sql_console.rs` : rôle `basedb_console` ou rôle LOGIN du lecteur, protocole PostgreSQL propre (`wire.rs`, une connexion par appel), curseur, sécurité des lignes. |
| `GET …/meta/templates`, `GET …/meta/templates/{key}`, `POST …/admin/templates`, `DELETE …/admin/templates/{key}` | ✅ | `template_catalog.rs` (modèles livrés, de l'instance et du site, avec cache), `template_check.rs` (validateur des contrats), `template_i18n.rs`, `targets.rs`. `POST …/admin/templates/draft` : crate `ai`. |
| `GET, POST …/admin/bases/{base}/automations`, `PATCH, DELETE …/automations/{id}`, `GET …/automations/{id}/runs` | ✅ | Crate `automations` (`routes.rs`, `catalog.rs`, `validate.rs`, `defs.rs`). |
| `POST /api/v1/{tenant}/automations/{id}/run`, `POST …/data/{base}/{table}/buttons/{button}/press` | ✅ | Crate `automations` : exécution mise en file (`requests.rs`, plafond horaire), exécutée par le moteur. |
| `POST /api/v1/hooks/{secret}` | ✅ | Crate `automations` : webhook entrant (JSON ou formulaire). |
| `GET, POST …/admin/webhooks`, `PATCH, DELETE …/admin/webhooks/{id}`, `GET …/webhooks/{id}/deliveries` | ✅ | Crate `automations` (`webhooks.rs`) : adresse vérifiée par `catalog::targets::check_target` (`BASEDB_WEBHOOK_ALLOW`, `BASEDB_WEBHOOK_DEV`), session élevée. |
| `GET …/admin/proposals`, `POST …/proposals/{id}/approve`, `…/reject` | ✅ | Crate `automations` (`proposals.rs`). |
| `POST …/ai/bases/{base}/automation-copilot` | ✅ | Crate `automations` (`copilot.rs`), sur `basedb_ai::copilot` et `basedb_ai::provider`. |
| `GET, POST, DELETE /mcp` (et `/healthz` sur `BASEDB_MCP_PORT`) | ✅ | Crate `mcp` : le serveur MCP des agents (jetons d'intégration), hors des couches de l'API (ni CORS ni garde démo). Remplace le processus Node `apps/mcp`. |
| tout le reste | 404 | Le corps `NOT_FOUND` de Node (`basedb_base::app::not_found`). |

**Tâches de démarrage** (`crates/server/src/socle.rs`, celles de `apps/api/src/server.ts`) : le catalogue est migré (`BASEDB_MIGRATE=1`) ou vérifié, et le démarrage refusé quand il est en retard, avec les mêmes messages ; puis `seedErrorCodes` (le registre dans `_basedb.error_code`), `ensureJournalPartitions` (`audit_log` et `security_log`, ce mois et les deux suivants, au démarrage puis chaque jour), `reclaimStaleMigrations` (les migrations de bases abandonnées par un processus arrêté) et l'amorçage (`BASEDB_BOOTSTRAP`, premier administrateur d'une instance vide, ou mot de passe réappliqué).

Les tâches de fond sont **allumées par défaut** ; `BASEDB_RUST_BACKGROUND=0` les éteint (une seconde instance qui ne ferait que servir, par exemple). Toutes prennent leur travail sous bail ou `FOR UPDATE SKIP LOCKED` : deux instances qui les font tourner ne font rien deux fois.

**Tâches de fond de l'administration** (`basedb_admin::start_background`) :

- l'envoi des courriels en file (`_basedb.mail_outbox`), toutes les 5 s ;
- leur purge, toutes les 600 s ;
- la source basedb dans insights (`PUT /api/v1/host/source`), toutes les 60 s.

Un courriel est pris sous bail (`FOR UPDATE SKIP LOCKED`). La purge et la source sont idempotentes. Les droits de lecture sont posés sous le même verrou consultatif (`basedb.reader-grants`). Seul effet visible : les notifications d'une personne dues au même instant peuvent partir en deux courriels au lieu d'un. Les pièces jointes sont lues dans le stockage des fichiers, disque ou S3.

**Tâches de fond de l'IA** (`basedb_ai::start_background`, sauf `BASEDB_AI_WORKER=0`, comme Node) :

- le travailleur des champs IA (`startAiWorker` de `core/src/ai/field.ts`), une passe toutes les 10 s : remplissage `if_empty`, balayages planifiés (cron), reprise des erreurs, quotas, journal `ai_call`. Il prend les champs sous bail (`field_ai_config.lease_until`), donc deux travailleurs cohabitent sans calculer deux fois le même champ au même moment ;
- les partitions mensuelles de `_basedb.ai_call` (ce mois et les deux suivants), au démarrage puis chaque jour. Node ne les crée qu'à la migration.

Aucune autre tâche de fond ou de démarrage dans `core/src/ai` ni dans `core/src/documents`. Leurs caches (polices, formats, disjoncteur) vivent en mémoire.

**Tâches de fond des automatisations** (`basedb_automations::start_background`) :

- le moteur (`engine.rs`, `runAutomations` de `core/src/automations/engine.ts`), une passe toutes les 2 s, jamais deux à la fois : planifications et dates dues mises en file, puis la file `_basedb.automation_run` prise par lots de 10, chaque exécution sous l'autorité de son propriétaire, avec les reprises du webhook (2, 5 puis 10 s) et le budget de 120 s ;
- l'envoi des webhooks sortants (`webhooks.rs`, `dispatchWebhooks`), toutes les 2 s : recul de 10 s, 30 s, 2 min, 10 min… à ±20 %, webhook désactivé après 50 échecs.

Les déclencheurs « ligne » sont mis en file par la vidange de l'historique (crate `records`, `drain.rs`). Deux instances ne font rien deux fois : une exécution est prise par `FOR UPDATE SKIP LOCKED`, une planification mise en file sous le même verrou (« aucune déjà en attente »), une date tenue sous bail de 5 min, une livraison prise sous `SKIP LOCKED` puis marquée `in_flight`. Le banc de parité l'a vérifié avant la bascule.

## Construire et lancer

`corepack pnpm dev` (`scripts/start.mjs`) le fait pour vous. À la main :

```powershell
$env:PATH = "$env:LOCALAPPDATA\mingw64\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"   # chaîne gnu
cd C:\Data\Dev\basedb\rust-server
cargo build --release
cd ..                                      # .env et .env.local sont lus à la racine du dépôt
$env:DATABASE_URL = 'postgres://postgres:basedb@localhost:55432/postgres'
$env:BASEDB_ENCRYPTION_KEY = 'developpement-seulement-ne-pas-utiliser-en-production'
$env:BASEDB_MIGRATE = '1'; $env:BASEDB_DEV_MAIL = '1'; $env:BASEDB_MCP_PORT = '8788'
.\rust-server\target\release\basedb-server.exe
```

Au démarrage :

```
Catalogue à jour (version 25).
Serveur MCP sur http://0.0.0.0:8788/mcp
basedb-server 0.8.2 écoute sur http://0.0.0.0:8787
```

En debug, argon2 et blake2 sont compilés optimisés (`[profile.dev.package.*]`). Sans cela, une connexion prend 2,7 s au lieu de 0,1 s.

### Variables d'environnement

Ce sont celles de l'ancienne API Node (`.env.example` les documente), lues dans le processus puis dans `.env` et `.env.local` à la racine du dépôt. **Une variable vide compte comme absente.**

| Variable | Défaut | Rôle |
|---|---|---|
| `DATABASE_URL` | — (obligatoire) | PostgreSQL. |
| `BASEDB_ADMIN_EMAIL`, `BASEDB_ADMIN_PASSWORD`, `BASEDB_BOOTSTRAP`, `BASEDB_DEV_LOGIN` | — | L'amorçage (`socle.rs`). |
| `BASEDB_ENCRYPTION_KEY` | — | Poivre des mots de passe, clé HMAC des sessions et des jetons, secrets chiffrés. Sans elle, les routes d'authentification répondent `INTERNAL_ERROR`, comme Node. |
| `PORT` / `BASEDB_HOST` | `8787` / `0.0.0.0` | Écoute de `basedb-server` (3000 dans l'image). Remplacent `RUST_PORT` et `RUST_HOST`. |
| `BASEDB_MCP_PORT` | — | Le serveur MCP sur un port à lui aussi (`/mcp`, `/healthz`), comme le processus Node. Absente : `/mcp` seulement sur `PORT`. Doit différer de `PORT`. |
| `CATALOG_MIGRATIONS_DIR` | — | Des migrations lues sur disque au lieu de celles embarquées dans le binaire (`crates/base/build.rs`). |
| `BASEDB_MIGRATE` | — | `1` : migre le catalogue au démarrage. Sinon, vérifie et refuse s'il est en retard. |
| `BASEDB_ORIGINS` | — | Origines CORS séparées par des virgules. Absente : `localhost` et `127.0.0.1` seulement. |
| `BASEDB_PUBLIC_URL`, `BASEDB_BASE_PATH` | — | URL publique, préfixe. |
| `BASEDB_TENANT` | `t4z56fq` | Tenant des routes d'avant session. |
| `BASEDB_DEMO`, `BASEDB_DEMO_ACCOUNTS`, `BASEDB_DEMO_PASSWORD` | — | Mode démo : comptes partagés, garde des écritures. |
| `BASEDB_SMTP_*`, `BASEDB_MAIL_FROM`, `BASEDB_DEV_MAIL` | — | Envoi des courriels. `BASEDB_DEV_MAIL=1` : courrier de développement journalisé. |
| `BASEDB_GEOCODER_URL`, `BASEDB_FILES_DIR`, `BASEDB_FILES_MAX_MB`, `BASEDB_INSIGHTS_*` | — | Géocodage, fichiers, insights. |
| `BASEDB_INSIGHTS`, `BASEDB_INSIGHTS_HOST` | —, `insights` | `1` : `/insights` relayé vers l'hôte nommé (serveur :4200, interface :3100), `BASEDB_INSIGHTS_URL` et `BASEDB_INSIGHTS_PUBLIC_URL` déduites (`front.rs`). |
| `BASEDB_TEMPLATES_DIR` | `packages/templates` | Le catalogue et les traductions des modèles. |
| `BASEDB_AI_PROVIDER`, `BASEDB_AI_MODEL`, `BASEDB_AI_BASE_URL`, `BASEDB_AI_API_KEY`, `BASEDB_AI_HEADERS`, `BASEDB_AI_PROVIDER_SSL_VERIFY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY` | — | Fournisseur du modèle (crate `ai`), comme `core/src/ai`. |
| `BASEDB_AI_QUOTA`, `BASEDB_AI_FIELD_QUOTA` | `120`, `300` | Appels par tenant et par heure (comptés dans `_basedb.ai_call`). |
| `BASEDB_PDF_FONTS` | — | Dossier des polices Noto des documents PDF. Absente : Noto du système, puis Arial (Windows, macOS), sinon Helvetica et Times propres au PDF, dans le même ordre que `documents/fonts.ts`. |
| `BASEDB_RUST_BACKGROUND` | `1` | `0` : n'allume aucune tâche de fond (courriels, purge, source insights, travailleur IA, automatisations, webhooks, synchronisations, partitions). |
| `BASEDB_AI_WORKER` | — | `0` : n'allume pas le travailleur des champs IA, comme Node. |
| `BASEDB_WEB_DIR` | — | L'export statique de l'interface (`apps/web/out-static` une fois construit ; `/app/web` dans l'image). Absente : aucune interface servie (en développement, c'est `next dev`). Posée mais sans `index.html` : refus de démarrer. |
| `BASEDB_API`, `BASEDB_MCP`, `BASEDB_MAP_TILES`, `BASEDB_MAP_ATTRIBUTION` | `<chemin de base>/`, `<chemin de base>/mcp`, tuiles et attribution OpenStreetMap | Avec `BASEDB_WEB_DIR` : ce que le layout de Next écrivait dans la page (`app/layout.tsx`). Une valeur qui commence par `/` désigne l'origine de la page. |

### L'interface sans Node

Node ne sert plus qu'à **construire** l'interface :

```powershell
corepack pnpm --filter @basedb/web build:static   # BASEDB_WEB_STATIC=1 next build → apps/web/out-static
$env:BASEDB_WEB_DIR = 'C:\Data\Dev\basedb\apps\web\out-static'
.\rust-server\target\release\basedb-server.exe   # l'API à la même origine, sous BASEDB_BASE_PATH
```

L'export est écrit dans `apps/web/out-static` (`BASEDB_WEB_STATIC_DIR` pour un autre dossier) : `next dev` et sa `.next/dev` ne sont pas touchés. L'image Docker est construite ainsi. Le crate `web` charge l'export en mémoire au démarrage (≈ 6 Mo hors traductions) puis, pour chaque requête :

- **l'API d'abord** : `/api`, `/auth`, `/healthz`, `/mcp`, avec ou sans le chemin de base (retiré), et toute méthode autre que `GET`/`HEAD`, vont au routeur de l'application ;
- **le chemin de base** (`BASEDB_BASE_PATH`) : le marqueur `/__basedb_base_path__` est remplacé en mémoire, comme l'ancienne image le faisait sur disque ; les pages sont servies avec ou sans le préfixe ;
- **les pages dynamiques** : `/f/<jeton>`, `/v/<jeton>`, `/invitation/<jeton>` reçoivent le gabarit de leur route, tout autre chemin celui de `[...address]` (export construit avec le jeton `__shell__`, `lib/static-shell.ts`) ;
- **la page remplie pour son lecteur** : `<html lang>`, la description traduite, `window.__BASEDB_API__`, `__BASEDB_MCP__`, `__BASEDB_TILES__` et `window.__BASEDB_I18N__` (langue du cookie `basedb-locale`, sinon `Accept-Language` ; messages lus dans `out-static/_basedb/locales/`, jamais servis) ;
- **`?lang=xx`** : cookie `basedb-locale` posé si la langue est l'une des nôtres, 303 vers la même adresse sans le paramètre ;
- **`/v/<jeton>`** : `Content-Security-Policy: frame-ancestors 'none'` sauf `?embed=1` ;
- **en-têtes** : `/_next/static/*` en cache immuable d'un an, HTML et charges RSC (`.txt`) en `no-store`, types de contenu par extension ; un `/_next/…` absent répond la page 404 de l'export, en 404 ; une barre finale est redirigée (308), comme Next.

## Vérifications

Les résultats ci-dessous ont été obtenus avant la bascule, les deux serveurs côte à côte, par un banc de parité (`bench/`) retiré depuis : il reste dans l'historique git.

| Vérification | Résultat |
|---|---|
| `cargo build` (debug et `--release`) | sans avertissement |
| `cargo test --workspace` | **108 tests** :<br>• `contracts` : 28 ;<br>• `base` : 75 unitaires et 4 d'intégration sur la base de développement ;<br>• `server` : 1. |
| `node bench/parity.mjs socle` (Node :8787 et Rust :8790) | **61/61 identiques**, en debug comme en release. |
| `cargo test -p basedb-ai` ; `node bench/parity.mjs ai` (Node :8797 et Rust, fournisseur `bench/mock-llm.mjs`) | **45 tests** (43 unitaires, 2 d'intégration sur la base de développement, dont le travailleur) ; **245/245 identiques** sur deux passes. Clippy sans avertissement pour `ai`. |
| `node bench/ai-worker.mjs` (fournisseur simulé :8797, Node :8800, Rust :8801 et :8802, lancés par le script) | Travailleur des champs IA : cellules, états, journal, changements et requêtes au modèle **identiques** entre Node seul et Rust seul, quota identique, et les deux ensemble donnent le résultat d'un travailleur seul. Deux passes. |
| `cargo test -p basedb-web` | **11 tests** : API prioritaire (avec et sans chemin de base), gabarits par route, en-têtes et cache, 404, chemin de base, page remplie (cookie, `Accept-Language`, échappement), `?lang`, règle de cadre. |
| `cargo test -p basedb-mcp` ; `node rust-server\bench\mcp-parity.mjs` (Node MCP :8804, Rust :8803 et :8805, insights simulé :8806, lancés par le script) | **14 tests** (12 unitaires, 2 d'intégration : refus du protocole, session d'un jeton créé puis révoqué). **295/295 identiques** sur deux passes : protocole, 21 outils, fichiers, propositions, lecteur, insights (joignable, injoignable, absent), quota, port séparé, lignes d'audit et de sécurité. Clippy sans avertissement pour `mcp`. |
| Interface statique servie par Rust (Edge, Playwright) | Connexion, `/bases/demo_atelier_lumen/tables/clients` puis rechargement : identique à `next dev` ; navigation sans rechargement de document ; `?lang=en` : page en anglais, cookie posé ; `/v/<x>` : en-tête CSP, absent avec `?embed=1` ; sous `/basedb` : page et API servies. |

Les tests unitaires de `base` comprennent les points suivants :

- les migrations réelles chargées et comparées à `sealed.json` ;
- `APPLICATION_VERSION` (la version du workspace) au moins égale au dernier scellé ;
- les tests de `rbac/decide` portés ;
- le CSRF, les jetons, les cookies, le CORS, le limiteur, la normalisation des adresses et des environnements.

Les tests d'intégration (`crates/base/tests/socle.rs`) vérifient les points suivants :

- connexion, puis jeton, puis `/auth/me` ;
- les refus ;
- la déconnexion ;
- une transaction qui porte bien le contexte de l'appelant.

Ces tests s'ignorent d'eux-mêmes quand la base est absente.

Le scénario du socle couvrait :

- `healthz` et `codes` ;
- la connexion : bonne, mauvaise, adresse inconnue, champs manquants ou non textuels, corps `null`, JSON invalide, adresse en majuscules ;
- le jeton d'accès : sans cookie, sans CSRF, CSRF faux, émis ;
- `/auth/me` par cookie et par jeton, pour admin et lecteur ;
- les jetons croisés : émis par Node et présentés à Rust, et l'inverse ;
- les jetons et cookies illisibles ou inconnus, le schéma Basic ;
- les sessions : liste, révocation d'une session inconnue, identifiant invalide ;
- l'élévation et son abandon ;
- le changement et la réinitialisation du mot de passe ;
- l'introspection ;
- le 404 : route inconnue, méthode non servie ;
- le CORS : pré-vol et réponses, origine locale et étrangère ;
- `x-request-id` repris ;
- la déconnexion ;
- la limite de 11 échecs, qui donne 429 et `retry-after`.

Les temps de réponse, en release, sont du même ordre que Node : une connexion prend 135 ms contre 119 ms (argon2), une route simple 5 à 15 ms.

## Contribuer (conventions des domaines)

### Ajouter un routeur

Chaque crate de domaine expose `pub fn router(st: &Shared) -> Router<Shared>`. `crates/server/src/main.rs` les fusionne déjà tous.

Il suffit d'y déclarer ses routes :

```rust
pub fn router(_st: &Shared) -> Router<Shared> {
    Router::new().route("/api/v1/{tenant}/meta/bases", get(list_bases))
}
```

Points à connaître :

- **Une route déclarée est servie par Rust pour la méthode déclarée.** Une autre méthode sur le même chemin répond le 404 de Node (`method_not_allowed_fallback`). Deux crates qui déclarent la même méthode sur le même chemin font échouer le test `domains_merge_without_conflict`.
- **Un état propre au domaine** : `st.ext::<MonEtat>()`, où `MonEtat: Default + Send + Sync`.

### Authentifier, ouvrir un contexte, une transaction

```rust
async fn list_bases(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap,
                    uri: Uri, Path(tenant): Path<String>) -> ApiResult {
    // Jeton d'accès ou jeton d'intégration bdb_ (+ X-Basedb-Environment / ?environment=) :
    let ctx = basedb_base::auth::data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let rows = with_transaction(&st.pools, PoolName::Data, &ctx, TxOptions::read_only(), |tx| async move {
        tx.rows("SELECT id::text, name FROM _basedb.base WHERE tenant_id = $1::text::uuid", &[&tenant_id]).await
    }).await?;
    Ok(json_ok(json!({ "data": … })))
}
```

- `ApiResult = Result<Response, AppError>`. L'erreur est rendue par la couche `request_id` avec le bon `request_id`.
- Les fonctions d'authentification :
  - `auth::data_context` : routes `/api/v1`, jeton d'accès ou `bdb_*` ;
  - `auth::bearer_context` : jeton d'accès seulement ;
  - `auth::cookie_holder` : routes `/auth/*` à cookie ;
  - `auth::open_token_context` : MCP.
- Le pool : `PoolName::Catalog` (lecture du catalogue hors contexte), `Data` (données, avec contexte) ou `Ddl` (structure). `with_transaction` ouvre `BEGIN ISOLATION LEVEL …`, pose le contexte, valide et rejoue les sérialisations (`retries`).
- **Paramètres SQL** : tokio-postgres est strict sur les types.
  - Passez les UUID en texte (`$1::text::uuid`) et lisez-les en texte (`id::text`).
  - Lisez les `smallint` en `i16`, ou castez (`::int`).
  - Les erreurs SQL passent par `Exec::query_op` / `execute_op` avec un `SqlOp`. Elles sont traduites comme `errors/pg.ts`.
- **Droits** :
  - `rbac::require::require_action(&tx, &ctx, Action::Read, target, details)` ;
  - `require_on_table(&tx, &ctx, action, table_id)` ;
  - `rbac::decide::decide` si vous avez déjà les droits (`load_grants`).

  Le crate `records` doit installer le compilateur de règles de lignes au démarrage : `rbac::rows::set_row_rule_compiler`.
- **Audit** : `audit::write_audit(&tx, &ctx, &AuditEntry::new("base.create", "base").…)`.
- **Idempotence** (MCP, agent) : `idempotency::claim_idempotency`, puis `complete_idempotency` ou `release_idempotency`.

### Lever une erreur

```rust
return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(id)));
```

Le code doit exister dans le registre, sinon le test du registre échoue. Le statut HTTP vient du registre. `AppError::internal(e)` donne une erreur 500 avec sa cause, journalisée mais jamais renvoyée.

### Tester

```rust
#[tokio::test]
async fn lists_bases() {
    let Some(app) = basedb_base::testing::test_app(basedb_catalog::router).await else { return };
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;
    let (status, body) = app.get(&format!("/api/v1/{}/meta/bases", admin.tenant), &admin).await;
    assert_eq!(status, 200, "{body}");
}
```

`test_app` monte l'application complète sur la base de développement (`:55432`, réglages de `start-basedb.mjs` à défaut de l'environnement). Une route qu'aucun crate monté ne sert répond 404, comme en vrai.

### Services du catalogue pour les autres crates

`basedb_catalog` expose ce dont `records`, `automations`, `ai` et `mcp` auront besoin. Ne réécrivez pas ces services :

- **Projection** (`projection`) : `snapshot(pools, ctx)` lit le catalogue (REPEATABLE READ, en cache par `catalog_version`) ; `project(...)` le filtre par droits. Puis `resolve_base`, `resolve_table` → `ResolvedTable`, `resolve_field` → `ResolvedField`, et `list_visible_bases`, `project_base`. `ProjectedBase`, `ProjectedTable` et `ProjectedField` décrivent une base, ses tables et ses champs : type, format, défaut, options, lien, calcul.
- **Cache** (`cache`) : `read_versions`, `VersionedCache`, `clear_caches`, `etag_for`.
- **Méta servie** (`serve`, `meta`, `openapi`, `documentation`) : `serve_meta`, `to_meta`, `to_openapi`, `to_documentation`.
- **Nommage** (`naming`, `allocation`) : `quote_identifier`, `qualify`, `quote_literal`, `slugify`, les noms dérivés (`primary_key_name`, `trigger_name`, `check_constraint_name`…), `allocate_name` (registre `physical_name`, verrou consultatif).
- **Structure** (`operations`, `structure`) : `create_base`, `create_table`, `update_table`, `set_table_description`, `set_field_label`, `set_field_description`, `reorder_fields`, `add_pattern_check`. Émission DDL : `sql_create_table`, `sql_table_triggers`, `sql_comment_on_*`, `pg_type_of`, `url_check`, `email_check`, `rich_text_check`. `in_structure` est le `BEGIN … COMMIT` sans contexte de `inStructure` (vues SQL).
- **Formules** (`formula`) : `parse_formula`, `resolve_formula`, `emit_formula`, `render_formula`.
- **Lecteur SQL** (`reader`) : `reader_reach` et `reader_reaches`, la portée du rôle lecteur. C'est ce qu'attend `POST /api/insights/reader`.
- **Vues SQL** (`sql_views`) : `sql_view_summaries`, `detach_sql_views`, `reattach_sql_views`, `purge_sql_view_statements` (pour les migrations qui touchent une colonne lue).
- **Moteur de migration** (`engine`, `deletion`, `purge`) : `engine::{propose, approve, apply, run}` (une `Proposal` → lignes `catalog_migration`, reprise), `deletion::{delete_base, delete_table, delete_field, restore_base, preview_table_deletion, preview_field_deletion}`, `purge::{export_for_purge, purge}`.
- **Champs** (`fields`, `field_config`, `computed_fields`, `select_options`) : `add_field`, `create_link_field`, `set_field_required`, `set_field_unique`, `set_display_column`, `set_field_format`, `set_field_default`, `set_formula`, `set_select_options`. C'est ce qu'attendent les tables synchronisées (`synced-tables`).
- **Environnements** (`environments`, `env_rows`) : `compare_environments`, `load_plan`/`plan_structure`, `apply_planned`, `compare_rows`, `sync_rows`, `count_rows`.
- **Console SQL** (`sql_console`, `insights_reader`) : `run_sql`, `read_sql_view`, `provision_reader`, `role_of`, `password_of`, `enable_row_security` ; `verify_insights_token`, `insights_reader`.
- **Modèles** (`template_catalog`, `template_check`, `template_apply`) : `list_templates`, `get_template`, `import_template`, `delete_template`, `check_template`, `apply_template` (avec un rappel par étape), `needs_node`.
- **Adresses sortantes** (`targets`) : `check_target(raw, &TargetPolicy)` refuse les adresses privées sauf liste de confiance. Réutilisable par les automatisations et les webhooks.
- **Crochets posés par `main.rs`** : `field_config::set_rich_text_sanitizer` (assainisseur de `records`), `env_rows::set_history_drainer` et `template_apply::set_template_row_writers` (écritures de lignes de `records`). Le catalogue ne dépend pas de `records` : sans `set_template_row_writers`, un modèle avec des lignes échoue en 500 ; sans `set_history_drainer`, la synchronisation des lignes ne vide pas d'abord le tampon d'historique.
- **Services de `records`** (pour `automations`, `ai`, `mcp`) : voir `NOTES.md`, « Crate records », « Pour les crates `automations`, `ai`, `mcp` ».
- **Le reste** : `views` (`readable_fields`, `project_view_spec`), `questions` (`can_read_table`, `require_sees_base`), `buttons::read_one`, `migrations` (`read_migration`, `to_migration`), `lifecycle` (`assert_manage_schema`, `is_administration`), `description` (`normalize_description`, `comment_text`), `http` (`look_of_body`, `normalize_look`, `label_key`).

## Limites et points d'attention

Voir `NOTES.md` : écarts, surprises de Node, décisions.

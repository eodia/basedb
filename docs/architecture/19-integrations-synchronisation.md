# 19 — Intégrations et tables synchronisées

## Rôle de ce chapitre

Une base ne vit pas seule : on veut prévenir une équipe dans Slack, voir ses échéances
dans Google Agenda, et tenir à jour, sans copier-coller, une table qui reflète un
fichier publié ailleurs, un agenda ou la vue d'une autre base. Ce chapitre fixe ces
trois portes, et ce qui les tient fermées au reste.

Principes :

- **des protocoles publics, pas de jeton de service** : un webhook entrant pour Slack,
  le format iCalendar pour les agendas, HTTPS pour les sources ; aucune application
  OAuth à enregistrer chez un tiers, aucun jeton d'accès à un compte Google ou Slack
  conservé par basedb ;
- **les secrets scellés** : une adresse qui vaut autorisation — un webhook Slack, l'adresse
  secrète d'un agenda — est scellée par la clé d'instance (A25) et ne se relit jamais en
  clair par l'API ;
- **aucune adresse privée** : toute adresse appelée par le serveur obéit aux règles des
  webhooks (chapitre 08 §10.3 : `https`, hôte public, pas de redirection suivie).

---

## 1. Slack

Une **connexion** Slack appartient à une base (`_basedb.integration`, chapitre 02) : un
nom et l'adresse d'un *webhook entrant* Slack (`https://hooks.slack.com/…`), créée dans
Slack pour un canal. Seules les adresses de `hooks.slack.com` sont acceptées : le serveur
n'envoie rien ailleurs par ce chemin.

- Construire, tester, supprimer une connexion demande `manage_schema` sur la base, en
  session ; l'API ne rend jamais l'adresse, seulement sa fin (`…/Xy7Q`).
- « Tester » envoie un message au canal et dit ce que Slack a répondu.
- Une automatisation (chapitre 17) gagne l'action **`slack`** : une connexion de la base et
  un message, qui peut citer la ligne (`{{champ}}`). Une réponse autre que `2xx` fait
  échouer l'action (`AUTOMATION_WEBHOOK_FAILED`).

---

## 2. Google Agenda et les agendas iCalendar

### 2.1 Voir ses échéances dans un agenda

Une vue **calendrier** ou **chronologie** partagée publiquement (chapitre 15 §10) publie
aussi un flux iCalendar :

`GET /api/v1/views/{jeton}/calendar.ics`

Chaque ligne de la vue y est un événement : son titre, sa date — un jour entier pour un
champ `date`, une heure pour un `datetime` —, sa fin quand la vue en a une, et en
description les champs que montrent ses cartes. L'identifiant de l'événement est celui de
la ligne : un agenda qui s'abonne met à jour l'événement au lieu d'en créer un autre.
Google Agenda (« Autres agendas », « À partir de l'URL »), Outlook ou Apple Calendar
s'abonnent à cette adresse et la relisent à leur rythme.

Le flux lit sur l'autorité du publiant, exactement comme la page de la vue : mêmes champs,
mêmes lignes, même filtre, 1 000 événements au plus. Un partage réservé aux membres n'a
pas de flux (`VIEW_SHARE_RESTRICTED`) : un agenda qui s'abonne ne se connecte pas.

### 2.2 Importer un agenda

L'autre sens passe par une **table synchronisée** (§3) de source `ics` : l'adresse
secrète d'un agenda Google au format iCal (« Paramètres de l'agenda », « Adresse secrète
au format iCal ») ou tout flux iCalendar public. La table porte le titre, le début, la fin,
le lieu et la description de chaque événement.

---

## 3. Tables synchronisées

### 3.1 Ce qu'est une table synchronisée

Une table dont les lignes viennent d'une **source** extérieure et sont tenues à jour par
le serveur (`_basedb.table_sync`, chapitre 02) :

| Source | Adresse | Colonnes | Clé d'une ligne |
|---|---|---|---|
| `csv` | un fichier CSV publié en `https` (un export, une feuille de calcul publiée) | celles de la première ligne, typées par leur contenu : nombre, date, texte | la colonne `id` si elle existe, sinon la première |
| `ics` | un flux iCalendar (§2.2) | Titre, Début, Fin, Lieu, Description | l'`UID` de l'événement |
| `basedb` | le lien d'une vue partagée d'un basedb, celui-ci ou un autre (chapitre 15 §10) | les champs de la vue | l'identifiant de la ligne |

La table est créée avec ses colonnes et un champ **Clé de synchronisation** ; ses lignes
sont ensuite **créées, modifiées et supprimées** à chaque synchronisation pour ressembler
à la source : une ligne dont la clé a disparu de la source disparaît de la table.

### 3.2 Lecture seule

Les lignes d'une table synchronisée ne s'écrivent pas à la main : créer, modifier ou
supprimer une ligne est refusé (`TABLE_SYNCED`, `409`) — sinon la synchronisation suivante
effacerait l'écriture sans prévenir. Le méta le dit d'avance : la table y porte
`synced: true`, ses seules actions sont `read` et tous ses champs y sont en lecture seule,
quels que soient les droits du lecteur. On la lit, la filtre, la cite dans une relation, une
recherche, un tableau de bord ou une automatisation comme toute autre table. Arrêter la
synchronisation en fait une table ordinaire, avec ses lignes.

### 3.3 Le rythme, et quand la source ne répond pas

La synchronisation a lieu toutes les *n* minutes (15 au moins, 1 440 au plus), et à la
demande (« Synchroniser maintenant »). Elle est faite par le serveur, sous une identité
système, et historisée comme telle. Bornes : 5 Mo et 10 000 lignes par source, 10 secondes
pour répondre.

Une source injoignable ou illisible n'efface rien : la table garde ses lignes, l'échec est
noté (`SYNC_SOURCE_FAILED`, avec la raison) et montré, et la tentative suivante a lieu à
l'échéance suivante. Une colonne apparue dans la source après la création n'est pas
ajoutée ; une colonne disparue laisse son champ vide.

### 3.4 Qui peut quoi

Créer, régler, lancer ou arrêter une synchronisation demande `manage_schema` sur la
base, en session. L'adresse de la source est scellée et ne se relit pas ; l'écran montre
son hôte.

---

## 4. Routes

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` `POST` | `/admin/bases/{base}/integrations` | connexions Slack de la base ; en ajouter une `{label, url}` | `manage_schema` | session seule |
| `DELETE` | `/admin/bases/{base}/integrations/{id}` | la supprimer | `manage_schema` | session seule |
| `POST` | `/admin/bases/{base}/integrations/{id}/test` | envoyer un message d'essai | `manage_schema` | session seule |
| `GET` | `/views/{jeton}/calendar.ics` | flux iCalendar d'une vue calendrier ou chronologie partagée publiquement | — (le jeton) | aucun |
| `GET` `POST` | `/admin/bases/{base}/synced-tables` | tables synchronisées de la base, leur état ; en créer une `{label, source: {kind, url}, interval_minutes}` | `manage_schema` | session seule |
| `PATCH` `DELETE` | `/admin/bases/{base}/synced-tables/{table}` | régler le rythme ; arrêter la synchronisation | `manage_schema` | session seule |
| `POST` | `/admin/bases/{base}/synced-tables/{table}/run` | synchroniser maintenant | `manage_schema` | session seule |

Les routes d'insights sont au §5.4.

---

## 5. insights — analyses et tableaux de bord

insights, l'outil d'analyses (questions, tableaux de bord, SQL sur Trino), vit à côté de
basedb : un autre serveur, sa propre base, servi sous `/insights` dans l'image qui
l'embarque. basedb le relie par trois variables qui vont ensemble — `BASEDB_INSIGHTS_URL`
(son API, telle que le serveur la joint), `BASEDB_INSIGHTS_PUBLIC_URL` (son adresse dans le
navigateur), `BASEDB_INSIGHTS_SECRET` (le secret partagé, 32 caractères au moins) — et une
quatrième, facultative, `BASEDB_INSIGHTS_DATABASE_URL` (§5.3). Sans elles, l'interface dit
qu'insights n'est pas branché et ses routes répondent `INSIGHTS_UNAVAILABLE` (503).

Avec docker compose, insights est installé par défaut, en service à part : son image publiée
`eodia/insights:${INSIGHTS_VERSION}` — passer à une nouvelle version, c'est changer ce
numéro —, Trino à côté, son catalogue une base `insights` sur le service `db` (créée par
le service `insights-db`). `basedb-server` relaie lui-même `/insights` vers ce service
(`BASEDB_INSIGHTS=1`, `BASEDB_INSIGHTS_HOST`, `insights` par défaut : son serveur sur 4200 —
API, MCP —, son interface sur 3100 ; rust-server/crates/server/src/front.rs) ; l'image
d'insights (0.7.0 au moins), construite une fois pour toutes les adresses, écrit au démarrage le chemin
`INSIGHTS_BASE_PATH` à la place du marqueur que porte son interface
(insights/docker/base-path.mjs), comme `basedb-server` le fait pour `BASEDB_BASE_PATH`. Le secret
partagé est alors à fixer des deux côtés (`BASEDB_INSIGHTS_SECRET`, son
`HOST_SSO_SECRET`). La cible `basedb-insights` garde l'autre forme : insights dans le
conteneur de basedb, l'image bâtie sur `eodia/insights:${INSIGHTS_VERSION}`
(docker/image/start.mjs démarre les trois processus). `BASEDB_INSIGHTS=0` le laisse de côté :
ses trois services (`scale`) ne lancent aucun conteneur, et l'interface de basedb, qui lit
`GET …/insights` (apps/web/src/lib/insights.ts), cache ses tableaux de bord — menu, palette
de commandes, adresse `/tableaux-de-bord`, source « question d'insights » des tables
synchronisées.

En développement, `pnpm start` (scripts/start.mjs) fait de même sans image : quand le dépôt
d'insights est à côté (`../insights`, ou `BASEDB_INSIGHTS_DIR`) et installé, il démarre ses
services Docker (catalogue, Trino), son API et son interface, donne les trois variables à
basedb, et l'interface de basedb relaie `/insights` vers elles (apps/web/next.config.ts,
`BASEDB_INSIGHTS_WEB` et `BASEDB_INSIGHTS_API`) — une seule adresse, une seule connexion.
`BASEDB_INSIGHTS=0`, ou un `BASEDB_INSIGHTS_URL` déjà donné, l'en dispense. Si les serveurs
de développement d'insights tournent déjà, celui-ci construit dans `.next-basedb` et prend
un autre port que 4100 : Trino continue d'interroger l'API sur 4100, qui partage le
catalogue et le secret (`HOST_SSO_SECRET` du `.env` d'insights).

Pour insights, basedb est une **application hôte** : insights n'a rien de propre à basedb.
Il connaît une application qui connecte ses utilisateurs, l'intègre dans un cadre, décide
des droits d'une source et la lui donne — ses variables `HOST_*`, posées par compose,
l'image et `pnpm start` : `HOST_SSO_SECRET` (le secret partagé), `HOST_SSO_ISSUER=basedb`,
`HOST_ACCESS_URL` (la route `reader` de basedb, §5.4) et `HOST_PUBLIC_URL` (l'adresse de
basedb, seule autorisée à afficher insights dans un cadre).

### 5.1 Une même personne

basedb fait entrer la personne dans insights : un JWT d'**une minute** (HS256, le secret
partagé, `iss=basedb`, `aud=insights`, `sub` = son identifiant, son courriel et son nom),
porté par l'adresse `{BASEDB_INSIGHTS_PUBLIC_URL}/api/auth/host?token=…&next=…`, ouvre la
session d'insights puis la page `next`. Les appels que basedb fait à l'API d'insights au nom
de quelqu'un (la recherche de questions et de tableaux de bord) portent un jeton de cinq
minutes du même genre.

### 5.2 Intégré à basedb

La section « Tableaux de bord » montre insights **dans** la page de basedb, dans un cadre.
L'adresse demandée à basedb porte alors `embedded=1` — insights retire son propre en-tête et
sa navigation —, `theme` (`light` ou `dark`) et `lang` (la langue de l'interface). Ensuite,
le cadre et la page se parlent par `postMessage`, chacun vérifiant l'origine de l'autre
(côté basedb : l'origine de `BASEDB_INSIGHTS_PUBLIC_URL`, et le message doit venir du cadre) :

| Sens | Message | Effet |
|---|---|---|
| insights → basedb | `{source: 'insights', type: 'location', path}` | la page où est insights : la barre de la section la suit, « Ouvrir dans un nouvel onglet » l'ouvre |
| basedb → insights | `{source: 'host', type: 'navigate', path}` | aller à une page sans recharger le cadre |
| basedb → insights | `{source: 'host', type: 'theme', theme}` | suivre le thème de basedb quand il change |
| insights → basedb | `{source: 'insights', type: 'copilot', open, available}` | l'état du copilote d'insights : basedb affiche son bouton « Demander au Copilot » quand `available` |
| basedb → insights | `{source: 'host', type: 'copilot', open}` | ouvrir ou fermer le copilote d'insights (le bouton, Ctrl+J) |

Tant qu'insights n'a rien dit, basedb change l'adresse du cadre plutôt que de lui écrire. La
barre propose « Tableaux de bord et questions » (`/browse`, la page d'arrivée), puis les pages
de la base ouverte : « Données » (`/data?catalog=basedb&schema={schéma}`), une question sur
elle (`/question/new?catalog=basedb&schema={schéma}`), du SQL sur elle
(`/sql?catalog=basedb&schema={schéma}`), et l'assistant.
Au premier message d'insights sur son copilote, basedb lui transmet le sien (ouvert ou
fermé) ; ensuite il suit insights. Dans l'image, insights reprend l'IA de basedb
(`BASEDB_AI_*`) sauf si `INSIGHTS_AI_PROVIDER` est donné. L'onglet ouvert à part n'est pas
intégré.

### 5.3 Les droits de basedb dans Trino

Trino lit les bases de basedb directement dans PostgreSQL, **avec les droits de la personne
qui interroge**, appliqués par PostgreSQL lui-même — pas recopiés dans insights :

- basedb **pose lui-même sa source** dans insights : au démarrage de l'API, puis chaque
  minute, il appelle `PUT /api/v1/host/source` d'insights (un JWT de service, `iss=basedb`,
  `aud=insights`, `scope=source`, une minute) avec `{catalog: 'basedb', name, description,
  host, port, database, ssl, user, password, schemas: [{schema, label}]}`. insights crée ou
  met à jour la source et son catalogue Trino `basedb`, en accès délégué ; rien ne change
  quand rien n'a changé. Un échec (insights pas encore démarré) est dit une fois, puis
  réessayé à la minute suivante ;
- le catalogue de Trino est déclaré avec le **rôle de service** `basedb_insights` : `LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION`, `CONNECT` sur la
  base de données, `USAGE` sur le schéma de chaque base et **aucun `SELECT`** : il liste la
  structure, il ne lit rien. Son mot de passe est dérivé de la clé d'instance
  (HMAC, `basedb/insights-service/v1`) ; chaque pose de la source le repose, ajoute
  `USAGE` aux bases nouvelles, le retire des schémas qui n'en sont plus et retire tout
  droit sur une relation ;
- chaque requête d'une personne porte, en « extra credentials » de Trino
  (`user-credential-name` et `password-credential-name` du catalogue), l'utilisateur et le
  mot de passe de **son rôle de lecture** `basedb_reader_<id>` (chapitre 11 §1.7), qu'insights
  obtient de basedb (`reader`) et garde au plus `ttl_seconds` (300 s). Ses colonnes, ses
  lignes (les règles de lignes, chapitre 05), rien d'autre.

Ce rôle porte **toute la portée de la personne** : chaque base de son tenant qu'elle lit,
chaque table et vue SQL qu'elle lit, colonne par colonne. Il est posé en une transaction,
sous le verrou `basedb.reader-grants`, par les deux chemins qui s'en servent — `reader`
pour insights et le SQL en lecture de basedb (qui n'y ajoute que ses vues temporaires,
pour la base interrogée). Les deux calculent la même chose : aucun ne défait ce que l'autre
a posé, et le rôle ne tient jamais plus que la portée courante. Un droit retiré disparaît à
la provision suivante : au plus cinq minutes plus tard dans insights, à l'instruction
suivante dans basedb.

`BASEDB_INSIGHTS_DATABASE_URL` est l'adresse de la base telle que **Trino** la joint
(`postgresql://hôte:port/base`, `?sslmode=require` pour TLS), **sans identifiants** : basedb
les donne. Vide, c'est celle de `DATABASE_URL`, sans ses identifiants.

### 5.4 Routes

L'appel d'insights (`HOST_ACCESS_URL`) vient de son **serveur**, jamais d'un navigateur : un JWT
qu'insights signe (HS256, le secret partagé, `iss=insights`, `aud=basedb`, une expiration à
deux minutes au plus — et, s'il porte `iat`, émis il y a deux minutes au plus) dans
`Authorization: Bearer`, hors de `/api/v1/{tenant}` : sans tenant dans le chemin. Les réponses ne se gardent pas
(`Cache-Control: no-store`). Un jeton absent, mal signé ou trop long : `AUTHENTICATION_REQUIRED`
(401).

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` | `/insights` | insights est-il branché, son adresse publique | — | toute personne |
| `POST` | `/insights/link` | l'adresse qui fait entrer la personne dans insights `{next, embedded?, theme?, lang?}` | — | toute personne |
| `GET` | `/insights/search` | les questions et tableaux de bord d'insights que la personne lit, par nom | ses droits dans insights | toute personne |
| `POST` | `/api/insights/reader` | le rôle de lecture de la personne (`sub`), posé pour toutes ses bases : `{user, password, ttl_seconds, schemas: [{schema, label, tables: {table: [colonnes]}}]}` ; `RESOURCE_NOT_FOUND` (404) pour une personne inconnue, désactivée ou supprimée | — (le JWT) | insights |

---

## Décisions retenues

- **Webhooks entrants et iCalendar plutôt qu'OAuth** : ils suffisent à ce qu'on attend
  — poster dans un canal, s'abonner à un agenda, importer un agenda — sans que basedb
  détienne un accès à un compte tiers, ni ne dépende de la validation d'une application
  par Google ou Slack.
- **Une table synchronisée est en lecture seule** : une écriture locale qu'une
  synchronisation écrase en silence serait pire qu'un refus.
- **La source d'une autre base passe par une vue partagée** : c'est la porte que son
  propriétaire a ouverte, avec les champs et les lignes qu'il a choisis, et qu'il peut
  refermer.
- **insights lit avec le rôle de la personne, pas avec un compte de service** : les droits
  de basedb — colonnes masquées, règles de lignes — sont ceux que PostgreSQL applique déjà
  au SQL de basedb ; les recopier dans insights en ferait deux versions à tenir d'accord.
  Le rôle de service ne fait que lister.
- **Une seule portée pour le rôle de lecture, toutes bases comprises** : le SQL de basedb
  et insights le provisionnent de la même façon. Un rôle posé base par base aurait vu
  chaque chemin retirer ce que l'autre venait d'accorder.

## Risques et limites connues

- Un agenda qui s'abonne relit le flux à son rythme (plusieurs heures chez Google) : une
  échéance modifiée n'y apparaît pas tout de suite.
- La synchronisation compare toute la source à chaque fois : elle est faite pour des
  sources de quelques milliers de lignes, pas pour un entrepôt.
- Une table synchronisée n'accepte pas de champ saisi à la main à côté des colonnes de la
  source en v1.
- Un droit retiré vaut dans insights au plus cinq minutes de plus (`ttl_seconds`), le temps
  qu'il redemande les identifiants de la personne.
- Le SQL en lecture de basedb peut nommer une autre base que la personne lit
  (`schéma.table`) : avec ses droits sur elle, ni plus ni moins.

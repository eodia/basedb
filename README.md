# basedb

Un équivalent de Baserow ou Airtable, auto-hébergeable, dont les données vivent dans
**de vraies tables PostgreSQL exploitables directement en SQL**.

Pas d'EAV, pas de `JSONB` fourre-tout, pas de `field_1837` : une base utilisateur est
un schéma PostgreSQL, une table est une table, un champ est une colonne typée et
nommée en clair. Vous pouvez ouvrir `psql` et lire vos données sans passer par le
produit.

> **Langues.** Le code — identifiants, types, commentaires — est en anglais. Le français
> est réservé aux textes affichés à l'utilisateur, au document d'architecture, et à
> quelques valeurs normatives que le chapitre 01 fixe et qui atterrissent dans la base
> (`champ_<6>`, `zz_supprime_`).

## Essayer

Prérequis : Node 22 ou plus, Docker, et `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

La commande choisit des ports libres, démarre PostgreSQL 16, applique le catalogue,
amorce un administrateur, puis lance l'API, le serveur MCP (sur le port 8788 s'il est
libre) et l'interface. L'écran récupère lui-même l'identifiant d'acteur ; il n'y a rien à
recopier. `Ctrl+C` arrête tout, conteneur compris.

### Déployer avec Docker

Le `Dockerfile` à la racine produit une image par processus (`--target api`, `mcp`, `web`) et
le `docker-compose.yml` assemble la pile complète — PostgreSQL 16, l'API, le serveur MCP,
l'interface, et en option un proxy Caddy qui sert le tout en HTTPS sur un seul domaine
(`docker/Caddyfile`).

```bash
cp .env.example .env          # POSTGRES_PASSWORD et BASEDB_ENCRYPTION_KEY, obligatoires
docker compose up -d --build
docker compose logs api       # le mot de passe de l'administrateur, affiché une fois
```

L'interface répond sur http://localhost:3000, l'API sur :8787, le MCP sur :8788/mcp, tous
publiés sur `127.0.0.1` seulement ; `docker compose --profile https up -d` avec `BASEDB_DOMAIN`
les sert sur un domaine. Chaque variable est décrite dans [`.env.example`](.env.example) — une
valeur vide y vaut « non défini ». Le catalogue et l'administrateur ne sont créés qu'au premier
démarrage : un conteneur qui redémarre retrouve les siens.

Le site public et la documentation d'utilisation sont dans [`www/`](www/) (Astro et
Starlight).

### Projets, comptes et droits

Tout s'organise par **projet** : le sélecteur en haut de la barre latérale change de
projet ou en crée un (administrateurs), et la barre liste les bases du projet, chacune
avec ses tables. On crée une base avec « + », une table depuis le menu « ⋯ » de sa base.

Les administrateurs trouvent en bas de la barre **Utilisateurs et groupes** et
**Permissions**. Un compte se crée avec un mot de passe temporaire, montré une seule fois
et à changer à la première connexion. Les droits s'accordent à des **groupes**, sur le
modèle de Metabase : un niveau — Aucun accès, Lecture, Édition, Gestion — posé sur un
projet, une base ou une table, qui descend sur tout ce qui est dessous (chapitre 05 §15).
Chaque changement demande de confirmer son mot de passe si la dernière confirmation date
de plus de cinq minutes.

### Brancher un programme ou un agent (API REST, MCP)

Dans l'interface, menu « ⋯ » d'une base dans la barre latérale → **Jetons API et MCP…** : on
y crée un jeton d'intégration limité à cette base, en lecture seule par défaut, après avoir
confirmé son mot de passe. Le même jeton sert à l'**API REST** (un programme) et au **MCP**
(un agent) — les deux accès sont cochés par défaut. Il lit, crée et modifie s'il a été créé
en écriture, ne supprime jamais, et n'a jamais plus de droits que la personne qui l'a créé.
Il n'est affiché qu'une fois ; il se place dans une variable d'environnement, jamais dans
une configuration :

```bash
# Un programme : le jeton dans l'en-tête Authorization
curl http://localhost:8787/api/v1/<tenant>/data/<base>/<table> -H "Authorization: Bearer $BASEDB_TOKEN"

# Un agent : le relais lit le jeton dans la variable nommée par --token-env
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js --url http://localhost:8788/mcp --token-env BASEDB_TOKEN
```

Le relais stdio transporte les messages du client vers `POST /mcp`. Douze outils :
`whoami`, `list_bases`, `describe_base`, `describe_table`, `list_records`, `get_record`,
`lookup_records`, `create_record`, `update_record`, et trois pour **proposer** une
évolution de structure — `propose_create_table`, `propose_add_field`, `get_proposal`.
Aucune suppression, et aucune modification de structure directe : une proposition attend
dans la file « Propositions » de la base (menu « ⋯ »), où une personne qui gère la
structure l'approuve ou la refuse ; sans décision, elle expire au bout de 24 heures.

La page **Documentation API et MCP** de chaque base reprend tout cela pour la base ouverte :
les deux accès côte à côte, et pour chaque table les outils qui l’atteignent, les colonnes
invisibles pour un agent et les arguments d’un appel.

### Fichiers (champs Document et Image)

Les octets ne vont pas dans PostgreSQL. Par défaut, ils sont écrits dans `.basedb/files` à la
racine du dépôt (`BASEDB_FILES_DIR` pour un autre répertoire) : cela suffit pour un seul
hôte. Pour un stockage objet compatible S3 — AWS, Scaleway, OVH, Cloudflare R2, Garage,
SeaweedFS, ou un MinIO existant :

```bash
BASEDB_S3_BUCKET=basedb BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud \
BASEDB_S3_REGION=fr-par BASEDB_S3_ACCESS_KEY_ID=… BASEDB_S3_SECRET_ACCESS_KEY=… \
node apps/api/dist/server.js
```

`BASEDB_FILES_MAX_MB` borne la taille d'un fichier (25 Mo par défaut). L'API dit au
démarrage où vont les fichiers. Détails : [chapitre 04 §3 bis](docs/architecture/04-types-de-champs.md).

### Exports avant purge, webhooks en développement

Une purge écrit d'abord un export CSV et son manifeste dans `.basedb/exports`
(`BASEDB_EXPORT_DIR` pour un autre répertoire), sur l'hôte de l'API et jamais sur le serveur
PostgreSQL ; basedb n'efface jamais ces fichiers. Les webhooks ne partent que vers des
adresses HTTPS publiques ; `BASEDB_WEBHOOK_DEV=1` accepte HTTP et les adresses locales,
pour un récepteur sur le poste — en développement seulement. Détails :
[chapitre 06 §5](docs/architecture/06-cycle-de-vie.md) et
[chapitre 08 §10](docs/architecture/08-api-rest-webhooks.md).

### L'option IA d'un champ

L'IA n'est pas un type de champ mais une **option** : l'interrupteur **IA** du formulaire
d'un champ — texte court ou long, lien URL, nombre, liste de choix, booléen ou date — le
fait remplir par un modèle, à partir d'une consigne qui cite d'autres colonnes de la ligne
(`Résume {{Notes}} en une phrase`, `Catégorie de {{Description}}`) : dès que la ligne
existe, puis de nouveau chaque fois qu'une colonne citée change, et aussi selon un planning
si on le veut (cron, lu dans le fuseau de l'auteur, au plus toutes les 15 minutes). La
colonne garde son type : le modèle reçoit le format attendu, et une réponse où rien ne se
lit dans ce type (un nombre introuvable, un choix qui n'existe pas) est refusée plutôt
qu'écrite. L'option s'active à la création ou sur un champ existant, et se désactive : le
champ redevient modifiable à la main, ses valeurs gardées. Les valeurs citées partent chez
le fournisseur : l'activation demande un consentement explicite. Tant qu'aucun écran de réglage n'existe, le fournisseur se configure
par l'environnement de l'API — le plus simple, un fichier `.env` à la racine du dépôt (ignoré
par git), que `scripts/start.mjs` lit au démarrage :

```bash
BASEDB_AI_PROVIDER=mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…
```

`BASEDB_AI_PROVIDER` vaut `anthropic`, `openai` ou `mistral`. La clé se lit sous
`BASEDB_AI_API_KEY`, ou à défaut sous le nom usuel du fournisseur (`MISTRAL_API_KEY`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). Sans le lanceur : `node --env-file=.env
apps/api/dist/server.js`. `BASEDB_AI_FIELD_QUOTA` borne
les appels des champs calculés par l'IA par heure et par tenant (300 par défaut) ; `BASEDB_AI_WORKER=0`
coupe le calcul de fond dans un processus d'API (utile quand plusieurs partagent une base).
Détails : [chapitre 12 §1.5](docs/architecture/12-integration-ia.md) et
[chapitre 04 §7 bis](docs/architecture/04-types-de-champs.md).

### Copilot

Le bouton **Copilot** ouvre une conversation sur la base affichée : on demande un filtre,
une requête, des colonnes, une table, un jeu d'essai… Chaque proposition arrive comme une
carte (colonnes à cocher, aperçu des lignes, requête) et s'applique d'un clic, par les
mêmes routes que les formulaires. Par défaut seule la structure part chez le fournisseur ;
la case « Autoriser la lecture des données » lui permet, pour la conversation, de lire des
lignes (50 au plus par lecture, en SQL en lecture seule pour qui a la console) et de
répondre à partir d'elles — chaque lecture est listée sous sa réponse.
`BASEDB_AI_QUOTA` borne les appels interactifs par heure et par tenant (120 par défaut).
Détails : [chapitre 12 §1.6](docs/architecture/12-integration-ia.md).

Deux autres points d'entrée, sans interface :

```bash
node scripts/demo.mjs               # la tranche verticale en terminal
node scripts/naming-playground.mjs  # passe un libellé dans la chaîne de nommage
```

## Où en est le projet

La **phase 1** — le document d'architecture — est dans [docs/architecture](docs/architecture/).
Quinze chapitres, dont [00 — Décisions structurantes](docs/architecture/00-decisions-structurantes.md)
qui tient en trois pages et suffit à comprendre le reste.

La **phase 2** — le noyau — est en cours.

| Paquet | Rôle | État |
|---|---|---|
| `@basedb/naming` | Slugification, budgets d'octets, motifs de noms dérivés | fait |
| `@basedb/contracts` | Registre des 213 codes d'erreur, engendré depuis le document | fait |
| `@basedb/catalog-schema` | DDL du catalogue `_basedb`, extrait du chapitre 02 | fait |
| `@basedb/core` | Pools, transactions, allocation, moteur DDL, RBAC, enregistrements, filtres, liens | partiel |
| `apps/api` | API REST sur Hono | partiel |
| `apps/mcp` | Serveur MCP (`POST /mcp`) et relais stdio — lecture, écriture et propositions de structure : les trois lots du chapitre 09 | fait |
| `apps/web` | Interface Next.js — onglets, grille virtualisée, éditeur d'expressions, visionneuse de documentation | partiel |

Ce qui fonctionne : projets, bases et tables, CRUD, comptes et groupes, permissions par
niveaux sur les projets, les bases et les tables, et au champ près,
filtres et tri (treize opérateurs, grammaire du chapitre 08), et les **relations** —
vraies clés étrangères PostgreSQL, valeur d'affichage, filtres sur chemin de relation.
Un champ **Lien URL** garde une adresse web ou de courriel, complétée à la saisie
(`exemple.fr` → `https://exemple.fr`) et tenue par une contrainte en base ; un **texte
long** s'écrit en Markdown — un extrait dans la grille, le rendu au survol, un éditeur
ouvert sur la cellule. Un projet, comme une base ou une table, a son **apparence** :
couleur, pictogramme ou image.
S'y ajoutent la **pagination par curseur chiffré** (chapitre 08 §6.2 : le curseur
transporte des valeurs de données et circule dans une URL, donc il est chiffré et lié à
son lecteur), le comptage borné à la demande, la **machine à états des migrations** et
le **cycle de vie d'une base** — renommage de libellé, suppression logique par lots avec
relégation `zz_supprime_`, restauration. Rien n'est détruit : les tables gardent leurs
lignes et restent lisibles en SQL direct sous leur nom relégué — jusqu'à la **purge**,
réservée à l'administration, trente jours après la suppression et après un export CSV
vérifié. Le **nom physique** d'une base, d'une table ou d'un champ se renomme aussi, avec
un écran d'impact, et l'ancien nom d'une base ou d'une table reste servi par un **alias de
compatibilité** (une vue, modifiable) jusqu'à ce qu'un administrateur décide de le couper
à blanc puis de le supprimer.

Chaque écriture est **historisée** au chapitre 07 : capturée par des déclencheurs dans la
transaction même, SQL direct compris, puis versée dans des journaux immuables. L'historique
d'une ligne ou d'une base se consulte, une modification s'annule, une ligne supprimée se
restaure. Les **webhooks** (chapitre 08 §10) en partent : signés, ordonnés, réessayés.

Le catalogue sait aussi **à quoi sert** ce qu'il décrit : une base, une table et un champ
portent une **description** (texte brut, 1 000 caractères au plus, modifiable sans
migration), recopiée pour les tables et les champs dans le `COMMENT ON` que lit `psql`.
C'est elle qui donne son sens à la **documentation générée** — un document à trois
colonnes (navigation, article, « sur cette page »), avec pour chaque table ses points
d'accès, ses colonnes et des exemples en cURL et en JavaScript — et à la spécification
OpenAPI. C'est aussi ce qu'un agent lit dans `describe_table`.

Le **serveur MCP** du chapitre 09 expose les lots 1 et 2 : découverte du schéma, lecture,
résolution d'une valeur d'affichage, création et modification d'enregistrements. Il passe
par le même point d'application des permissions que l'API — un jeton y vaut les droits de
son rôle **intersectés** avec ceux de la personne qui l'a créé —, masque les champs
marqués `expose_to_agents = false` et les bases `mcp_enabled = false`, et journalise
chaque appel par la forme de ses paramètres, jamais par leurs valeurs. Un agent ne change
jamais la structure : il la **propose** (`propose_create_table`, `propose_add_field`), et
une personne approuve ou refuse dans la file « Propositions » de la base.

L'**intégration IA** du chapitre 12 est là, dans son périmètre exact et pas un pas plus
loin : deux usages, `structure_draft` et `expression_draft`, où le noyau décide et
l'adaptateur appelle. Ne sortent de l'instance que des libellés, des types et la phrase
saisie — aucune valeur de cellule, aucun identifiant.

Les permissions descendent jusqu'au **champ** : sous la grille des niveaux, « Champs »
masque une colonne à un groupe ou la rend non modifiable pour lui, et montre ce qu'une
personne donnée en voit réellement, et par quel groupe.

Une base peut avoir des **environnements** — production, recette, développement —
([chapitre 14](docs/architecture/14-environnements.md)) : chacun a son schéma, ses tables et
ses lignes, et tous partagent la **lignée** de la base, de ses tables et de ses champs. La
navigation montre une ligne par base et, à côté, un badge qui dit l'environnement ouvert et
permet d'en changer ; le formulaire de la base les ajoute (par copie de la structure), les
renomme et les supprime. « Comparer les environnements » met la structure de tous côte à
côte, prépare le plan de migration d'un environnement vers un autre — étape par étape, sans
jamais cocher d'office ce qui annulerait une modification plus récente de la cible — et
synchronise les lignes d'une table, par `_id`. Ce que la comparaison sait de qui a changé
quoi vient de l'**historique des structures** (`structure_revision`, chapitre 07 §8),
alimenté par déclencheur sur le catalogue et lisible dans l'onglet « Structure » de
l'historique.

Un formulaire ou un questionnaire se **partage** par un lien `/f/<jeton>`
([chapitre 15](docs/architecture/15-formulaires-partages.md)) : **public** — quiconque a le
lien répond, sans compte — ou réservé aux **membres connectés**, au besoin de certains
groupes. Répondre ne demande aucun droit sur la table : la ligne s'écrit sur l'autorité de
la personne qui a publié le partage, redécidée à chaque réponse et restreinte aux questions
du formulaire. L'historique attribue la réponse à la personne qui a répondu, ou au
formulaire lui-même quand il est public. Le dialogue « Partager » règle l'accès, la date
limite, le nombre maximal de réponses, et régénère le lien s'il a trop circulé ; les
relations, documents et images ne sont pas posés par un lien partagé.

Manquent encore : la restauration d'une table supprimée seule, l'épuration des pierres
tombales, les opérations en masse déclarées du chapitre 07 §5. Chaque chapitre concerné dit, dans sa section « État de la mise
en œuvre », ce qui est fait et où la v1 s'écarte du texte.

## Vérifier

```bash
corepack pnpm lint
corepack pnpm graph
corepack pnpm test:unit
corepack pnpm test:int
```

Les suites d'intégration démarrent un vrai PostgreSQL 16 par Testcontainers : elles
prouvent que le DDL s'applique sous un rôle **propriétaire de base et non superuser**,
conformément à la contrainte d'infrastructure du cadrage.

## Deux principes qui expliquent le reste

**Le catalogue est la source de vérité unique.** La documentation, l'API et le futur
serveur MCP en dérivent, jamais l'inverse. Le registre des codes d'erreur, le DDL du
catalogue et la fonction de pliage `fold_v1` sont d'ailleurs *engendrés* depuis le
document d'architecture, et un test échoue s'ils divergent.

**Un seul point d'application des permissions.** Le noyau n'expose pas de connexion, il
expose des opérations ; un adaptateur ne dispose d'aucun objet représentant une
connexion et ne peut donc pas contourner la décision d'autorisation. Un champ masqué
n'est pas filtré après coup : il n'est jamais lu, donc jamais transporté — la colonne
n'apparaît même pas dans le SQL émis.

## Licence

basedb est distribué sous licence [GNU Affero General Public License v3.0](LICENSE) ou
toute version ultérieure (`AGPL-3.0-or-later`). Si vous modifiez basedb et le mettez à
disposition d'utilisateurs à travers un réseau, vous devez leur donner accès au code source
de votre version modifiée.

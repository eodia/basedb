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

Le relais stdio transporte les messages du client vers `POST /mcp`. Neuf outils :
`whoami`, `list_bases`, `describe_base`, `describe_table`, `list_records`, `get_record`,
`lookup_records`, `create_record`, `update_record` — aucune suppression, aucune
modification de structure.

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

Deux autres points d'entrée, sans interface :

```bash
node scripts/demo.mjs               # la tranche verticale en terminal
node scripts/naming-playground.mjs  # passe un libellé dans la chaîne de nommage
```

## Où en est le projet

La **phase 1** — le document d'architecture — est dans [docs/architecture](docs/architecture/).
Quatorze chapitres, dont [00 — Décisions structurantes](docs/architecture/00-decisions-structurantes.md)
qui tient en trois pages et suffit à comprendre le reste.

La **phase 2** — le noyau — est en cours.

| Paquet | Rôle | État |
|---|---|---|
| `@basedb/naming` | Slugification, budgets d'octets, motifs de noms dérivés | fait |
| `@basedb/contracts` | Registre des 213 codes d'erreur, engendré depuis le document | fait |
| `@basedb/catalog-schema` | DDL du catalogue `_basedb`, extrait du chapitre 02 | fait |
| `@basedb/core` | Pools, transactions, allocation, moteur DDL, RBAC, enregistrements, filtres, liens | partiel |
| `apps/api` | API REST sur Hono | partiel |
| `apps/mcp` | Serveur MCP (`POST /mcp`) et relais stdio — lecture et écriture, lots 1 et 2 du chapitre 09 | partiel |
| `apps/web` | Interface Next.js — onglets, grille virtualisée, éditeur d'expressions, visionneuse de documentation | partiel |

Ce qui fonctionne : projets, bases et tables, CRUD, comptes et groupes, permissions par
niveaux sur les projets, les bases et les tables, et au champ près,
filtres et tri (treize opérateurs, grammaire du chapitre 08), et les **relations** —
vraies clés étrangères PostgreSQL, valeur d'affichage, filtres sur chemin de lien.
S'y ajoutent la **pagination par curseur chiffré** (chapitre 08 §6.2 : le curseur
transporte des valeurs de données et circule dans une URL, donc il est chiffré et lié à
son lecteur), le comptage borné à la demande, la **machine à états des migrations** et
le **cycle de vie d'une base** — renommage de libellé, suppression logique par lots avec
relégation `zz_supprime_`, restauration. Rien n'est détruit : les tables gardent leurs
lignes et restent lisibles en SQL direct sous leur nom relégué.

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
chaque appel par la forme de ses paramètres, jamais par leurs valeurs. Les propositions de
structure (lot 3) restent à faire.

L'**intégration IA** du chapitre 12 est là, dans son périmètre exact et pas un pas plus
loin : deux usages, `structure_draft` et `expression_draft`, où le noyau décide et
l'adaptateur appelle. Ne sortent de l'instance que des libellés, des types et la phrase
saisie — aucune valeur de cellule, aucun identifiant.

Manquent au noyau : l'historique, les webhooks, la purge et l'épuration, le renommage
physique et les alias de compatibilité. Manquent au produit : les propositions de
structure par MCP (lot 3), l'éditeur des permissions de champ.

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

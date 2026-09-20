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
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api
corepack pnpm start
```

La commande choisit des ports libres, démarre PostgreSQL 16, applique le catalogue,
amorce un administrateur, puis lance l'API et l'interface. L'écran récupère lui-même
l'identifiant d'acteur ; il n'y a rien à recopier. `Ctrl+C` arrête tout, conteneur
compris.

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
| `apps/web` | Interface Next.js — onglets, grille virtualisée, éditeur d'expressions | partiel |

Ce qui fonctionne : création de bases et de tables, CRUD, permissions au champ près,
filtres et tri (treize opérateurs, grammaire du chapitre 08), et les **relations** —
vraies clés étrangères PostgreSQL, valeur d'affichage, filtres sur chemin de lien.
S'y ajoutent la **pagination par curseur chiffré** (chapitre 08 §6.2 : le curseur
transporte des valeurs de données et circule dans une URL, donc il est chiffré et lié à
son lecteur), le comptage borné à la demande, la **machine à états des migrations** et
le **cycle de vie d'une base** — renommage de libellé, suppression logique par lots avec
relégation `zz_supprime_`, restauration. Rien n'est détruit : les tables gardent leurs
lignes et restent lisibles en SQL direct sous leur nom relégué.

L'**intégration IA** du chapitre 12 est là, dans son périmètre exact et pas un pas plus
loin : deux usages, `structure_draft` et `expression_draft`, où le noyau décide et
l'adaptateur appelle. Ne sortent de l'instance que des libellés, des types et la phrase
saisie — aucune valeur de cellule, aucun identifiant.

Manquent au noyau : l'historique, les webhooks, la purge et l'épuration, le renommage
physique et les alias de compatibilité. Manquent au produit : le serveur MCP, l'éditeur
de permissions.

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

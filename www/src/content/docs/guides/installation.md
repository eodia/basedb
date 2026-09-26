---
title: Installation
description: Installer basedb avec Docker Compose, ou lancer la pile de développement.
---

basedb se compose de trois processus — l’**API**, le **serveur MCP** et l’**interface** — et
d’une base **PostgreSQL 16**. Le dépôt fournit tout le nécessaire pour Docker.

## Avec Docker Compose (recommandé)

Prérequis : Docker avec Compose v2.

```bash
git clone https://github.com/eodia/basedb.git
cd basedb
cp .env.example .env
```

Ouvrez `.env` et renseignez les deux seules valeurs obligatoires :

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# générée une fois pour toutes : openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Puis démarrez :

```bash
docker compose up -d --build
docker compose logs api
```

Au premier démarrage, l’API crée le catalogue et le premier administrateur, puis **affiche son
mot de passe une seule fois** dans ses journaux :

```text
api-1  | Catalog applied (1 migration).
api-1  | Bootstrapped — admin@basedb.local
api-1  | Mot de passe administrateur (affiché une seule fois) : basedb-…
api-1  | basedb API on http://localhost:8787
```

Ouvrez [http://localhost:3000](http://localhost:3000) et connectez-vous avec
`admin@basedb.local` et ce mot de passe.

| Service | Adresse | Rôle |
|---|---|---|
| `web` | http://localhost:3000 | l’interface |
| `api` | http://localhost:8787 | API REST, connexion, travail de fond |
| `mcp` | http://localhost:8788/mcp | serveur MCP pour les agents |
| `db` | localhost:5432 | PostgreSQL, pour `psql` et vos outils |

Les ports sont publiés sur `127.0.0.1` seulement. Pour servir basedb sur un domaine, voir
[Domaine et HTTPS](/basedb/hebergement/https/).

:::caution[La clé d’instance]
`BASEDB_ENCRYPTION_KEY` signe les sessions et chiffre les secrets enregistrés (clés d’IA,
secrets de webhooks, liens de formulaires). La changer déconnecte tout le monde et rend ces
secrets illisibles. Générez-la une fois, sauvegardez-la avec la base.
:::

## Pour développer

Prérequis : Node 22 ou plus, Docker, et `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` choisit des ports libres, démarre un PostgreSQL 16 jetable, applique le catalogue,
amorce un administrateur (`admin@basedb.local` / `developpement-basedb`), puis lance l’API, le
serveur MCP et l’interface en mode développement. `Ctrl+C` arrête tout, conteneur compris.

## Et ensuite ?

- [Premiers pas](/basedb/guides/premiers-pas/) : une base, une table, une vue, un formulaire.
- [Variables d’environnement](/basedb/hebergement/variables/) : fichiers, IA, adresses.

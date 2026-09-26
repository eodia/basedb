---
title: Installation
description: Installer basedb avec Docker Compose, ou lancer la pile de développement.
---

basedb tient dans **une seule image Docker**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 et arm64) : l’**interface**, l’**API** et le **serveur MCP**, servis sur une seule
adresse. Elle a besoin d’une base **PostgreSQL 16**, que le `docker-compose.yml` fournit.

## Avec Docker Compose (recommandé)

Prérequis : Docker avec Compose v2. Deux fichiers suffisent, pas besoin du code :

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Ouvrez `.env` et renseignez les deux seules valeurs obligatoires :

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# générée une fois pour toutes : openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Puis démarrez :

```bash
docker compose up -d
```

Au premier démarrage, basedb crée le catalogue. Ouvrez ensuite
[http://localhost:3000](http://localhost:3000) : la première page vous demande de **créer le
compte administrateur**, avec votre nom, votre adresse et le mot de passe de votre choix, et
vous êtes connecté dans la foulée.

:::caution[La première visite crée l’administrateur]
Tant qu’aucun administrateur n’existe, la première personne qui ouvre l’interface le crée.
Créez-le **avant** de rendre l’instance joignable par d’autres — sur un domaine, ou avec un
port publié sur toutes les interfaces.
:::

Pour une installation sans intervention, nommez l’administrateur dans `.env` avec
`BASEDB_ADMIN_EMAIL` : basedb le crée au premier démarrage et affiche son mot de passe **une
seule fois** dans ses journaux (`docker compose logs basedb`), à moins que vous ne le fixiez
avec `BASEDB_ADMIN_PASSWORD`.

| Adresse | Rôle |
|---|---|
| http://localhost:3000 | l’interface |
| http://localhost:3000/api | l’API REST et sa documentation |
| http://localhost:3000/mcp | le serveur MCP, pour les agents |
| localhost:5432 | PostgreSQL, pour `psql` et vos outils |

Les ports sont publiés sur `127.0.0.1` seulement. Pour servir basedb sur un domaine, voir
[Domaine et HTTPS](/basedb/hebergement/https/).

## Avec votre propre PostgreSQL

L’image seule suffit, avec une base PostgreSQL 16 ou plus (rôle propriétaire de la base,
extensions `pg_trgm` et `unaccent` disponibles) :

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Gardez la clé générée : voir l’encadré ci-dessous.

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
amorce un administrateur de développement (`admin@basedb.local` / `developpement-basedb`,
adresse préremplie à la connexion), puis lance l’API, le serveur MCP et l’interface en mode
développement. `Ctrl+C` arrête tout, conteneur compris.

## Et ensuite ?

- [Premiers pas](/basedb/guides/premiers-pas/) : une base, une table, une vue, un formulaire.
- [Variables d’environnement](/basedb/hebergement/variables/) : fichiers, IA, adresses.

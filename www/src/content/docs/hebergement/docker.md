---
title: Docker Compose
description: L’image, les services, les volumes et l’exploitation courante.
---

basedb est publié en **une seule image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
pour amd64 et arm64. Le `docker-compose.yml` du dépôt l’assemble avec PostgreSQL. Toute la
configuration passe par un fichier `.env` (voir
[Variables d’environnement](/basedb/hebergement/variables/)).

## L’image

Elle contient les trois processus de basedb et les sert sur **un seul port, 3000** :

| Chemin | Processus |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | l’API REST, la connexion, le travail de fond |
| `/mcp` | le serveur MCP, pour les agents |
| tout le reste — `/`, `/f/…`, `/v/…` | l’interface |

Au démarrage, l’API passe la première : sur une base vide, elle applique le catalogue et crée le
premier administrateur ; aux démarrages suivants, les deux sont sans effet. Le serveur MCP démarre
dès qu’elle répond. Si l’un des processus s’arrête, le conteneur s’arrête entier, et la politique
de redémarrage le relance entier.

L’image tourne sous l’utilisateur `node`, sur Node 22, déclare une vérification de santé
(`/healthz`) et un volume, `/data`, pour les fichiers des champs Document et Image.

| Étiquette | Contenu |
|---|---|
| `latest` | la dernière version publiée |
| `0.6` | la dernière version 0.6.x |
| `0.6.1` | exactement cette version |

## Les services

| Service | Image | Port (sur 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (option) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Commandes utiles

```bash
docker compose up -d                # télécharger l’image et démarrer
docker compose logs -f basedb       # suivre basedb (mot de passe admin au 1er démarrage)
docker compose ps                   # état et santé des services
docker compose restart basedb       # redémarrer basedb
docker compose down                 # arrêter (les volumes restent)
```

Depuis un clone du dépôt, `docker compose up -d --build` construit l’image à partir du code
plutôt que de la télécharger.

## Derrière une passerelle, sous un chemin

Quand basedb est publié sous un chemin — `https://passerelle.example.com/basedb/` plutôt qu’à
la racine d’un domaine —, indiquez ce chemin :

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# ou, sans adresse publique :
BASEDB_BASE_PATH=/basedb
```

Tout passe alors sous `/basedb` : l’interface, `/basedb/api`, `/basedb/mcp`, les liens de
partage et ceux des courriels. La passerelle peut **garder le chemin** en transmettant la
requête ou le **retirer** : basedb accepte les deux. `BASEDB_BASE_PATH=/` force la racine.

L’image est la même pour toutes les adresses : le chemin est écrit dans l’interface au
démarrage du conteneur, et changer de chemin ne demande qu’un redémarrage.

## Changer les ports

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Une base PostgreSQL existante

Définissez `DATABASE_URL` : basedb s’y connecte au lieu du conteneur `db` (qui démarre quand même,
inutilisé — retirez-le d’un fichier `docker-compose.override.yml` si vous préférez). Il faut
PostgreSQL 16 ou plus, un rôle propriétaire de la base, et les extensions `pg_trgm` et `unaccent`
disponibles. L’image seule suffit alors — voir [Installation](/basedb/guides/installation/).

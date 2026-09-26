---
title: Docker Compose
description: Les images, les services, les volumes et l’exploitation courante.
---

Le dépôt fournit un `Dockerfile` à trois cibles et un `docker-compose.yml` qui assemble la pile
complète. Toute la configuration passe par un fichier `.env` (voir
[Variables d’environnement](/basedb/hebergement/variables/)).

## Les images

Un seul `Dockerfile`, une image par processus :

```bash
docker build --target api -t basedb-api .   # API REST, connexion, travail de fond
docker build --target mcp -t basedb-mcp .   # serveur MCP
docker build --target web -t basedb-web .   # l’interface (Next.js autonome)
```

Les images tournent sous l’utilisateur `node`, sur Node 22, et déclarent une vérification de
santé (`/healthz` pour l’API et le MCP).

## Les services

| Service | Image | Port (sur 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `api` | `basedb-api` | 8787 | `files` → `/data` |
| `mcp` | `basedb-mcp` | 8788 | — |
| `web` | `basedb-web` | 3000 | — |
| `proxy` (option) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

- L’**API** attend que PostgreSQL soit prêt ; au premier démarrage, elle applique le catalogue et
  crée le premier administrateur. Aux démarrages suivants, les deux sont sans effet : le
  conteneur redémarre sans rien rejouer.
- Le **MCP** attend l’API : c’est elle qui applique le catalogue.
- L’**interface** ne reçoit aucun secret : seulement les adresses de l’API et du MCP, lues à
  l’exécution — la même image sert n’importe quel domaine.

## Commandes utiles

```bash
docker compose up -d --build        # construire et démarrer
docker compose logs -f api          # suivre l’API (mot de passe admin au 1er démarrage)
docker compose ps                   # état et santé des services
docker compose restart api          # redémarrer un service
docker compose down                 # arrêter (les volumes restent)
```

## Changer les ports

```bash
BASEDB_WEB_PORT=3100
BASEDB_API_PORT=8790
BASEDB_MCP_PORT=8791
POSTGRES_PORT=5433
```

Les adresses vues par le navigateur suivent automatiquement (`BASEDB_API`, `BASEDB_MCP`), sauf si
vous les fixez vous-même.

## Une base PostgreSQL existante

Définissez `DATABASE_URL` : l’API et le MCP s’y connectent au lieu du conteneur `db` (qui
démarre quand même, inutilisé — retirez-le d’un fichier `docker-compose.override.yml` si vous
préférez). Il faut PostgreSQL 16 ou plus, un rôle propriétaire de la base, et les extensions
`pg_trgm` et `unaccent` disponibles.

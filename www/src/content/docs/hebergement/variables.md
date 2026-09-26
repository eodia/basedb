---
title: Variables d’environnement
description: Toutes les variables lues par basedb, et leur valeur par défaut.
---

Toutes se placent dans le fichier `.env`, à côté de `docker-compose.yml`, que `docker compose`
lit (le modèle complet et commenté est `.env.example`). Avec `docker run`, passez-les en `-e`. **Une valeur vide vaut « non défini ».**

## Obligatoires

| Variable | Rôle |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe du conteneur PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | clé d’instance : signe les sessions, chiffre les secrets. `openssl rand -base64 32`, une fois pour toutes |

## Base de données

| Variable | Défaut | Rôle |
|---|---|---|
| `POSTGRES_USER` | `basedb` | rôle PostgreSQL |
| `POSTGRES_DB` | `basedb` | base PostgreSQL |
| `POSTGRES_PORT` | `5432` | port publié sur 127.0.0.1 |
| `DATABASE_URL` | le conteneur `db` | une base PostgreSQL 16+ à vous |

## Premier démarrage

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | applique le catalogue sur une base vide |
| `BASEDB_BOOTSTRAP` | `1` | prépare le premier administrateur |
| `BASEDB_TENANT` | `t4z56fq` | référence du tenant, dans les URL de l’API |
| `BASEDB_ADMIN_EMAIL` | — | adresse du premier administrateur, créé au démarrage ; vide, la première personne qui ouvre l’interface le crée |
| `BASEDB_ADMIN_PASSWORD` | généré, affiché une fois | avec `BASEDB_ADMIN_EMAIL`, son mot de passe ; défini, il est réappliqué à l’administrateur à **chaque** démarrage : à retirer une fois connecté |

## Connexion avec Google, Microsoft… (OIDC)

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | les fournisseurs proposés, séparés par des virgules : `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | l’application enregistrée chez le fournisseur |
| `BASEDB_OIDC_<NOM>_ISSUER` | celui de `google`, `gitlab` | l’émetteur OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | selon le fournisseur | le nom du bouton, les portées demandées |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off` : une première connexion ne crée pas de compte |

Voir [Comptes et connexion](/basedb/hebergement/connexion/).

## Adresses

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_PORT` | `3000` | port publié sur 127.0.0.1 : l’interface, `/api` et `/mcp` |
| `BASEDB_VERSION` | `latest` | l’étiquette de l’image `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | adresse publique de basedb, pour le retour OIDC |
| `BASEDB_DOMAIN` | — | le domaine servi en HTTPS par le proxy Caddy |
| `BASEDB_ORIGINS` | — | d’autres sites dont les pages appellent l’API depuis le navigateur, séparés par des virgules ; inutile pour l’interface de basedb, servie à la même adresse |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | l’API et le MCP vus du navigateur ; à ne régler que pour la pile de développement (`pnpm start`) |

## Fichiers

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | taille maximale d’un fichier |
| `BASEDB_S3_BUCKET` | — | active le stockage S3 |
| `BASEDB_S3_ENDPOINT` | — | point d’accès S3 |
| `BASEDB_S3_REGION` | `us-east-1` | région |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | identifiants |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` pour l’adressage par hôte |

## Modèles de base

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | le catalogue du site public | d’où l’instance lit les modèles de sa galerie ; `off` pour n’en lire aucun (les modèles intégrés restent) — voir [Modèles](/basedb/fonctionnalites/modeles/) |

## Intelligence artificielle

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` ou `mistral` |
| `BASEDB_AI_MODEL` | — | le modèle |
| `BASEDB_AI_API_KEY` | — | la clé (sinon `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | appels interactifs par heure et par tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | calculs de champs IA par heure et par tenant |
| `BASEDB_AI_WORKER` | `1` | `0` : pas de calcul de fond dans ce processus |

## Développement seulement

| Variable | Rôle |
|---|---|
| `BASEDB_DEV_MAIL=1` | affiche les courriels dans les journaux au lieu de les envoyer |
| `BASEDB_WEBHOOK_DEV=1` | autorise les webhooks vers HTTP et les adresses locales |

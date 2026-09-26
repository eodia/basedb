---
title: Variables d’environnement
description: Toutes les variables lues par basedb, et leur valeur par défaut.
---

Toutes se placent dans le fichier `.env` à la racine du dépôt, que `docker compose` lit (le
modèle complet et commenté est `.env.example`). **Une valeur vide vaut « non défini ».**

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
| `BASEDB_BOOTSTRAP` | `1` | crée le tenant et le premier administrateur |
| `BASEDB_TENANT` | `t4z56fq` | référence du tenant, dans les URL de l’API |
| `BASEDB_ADMIN_EMAIL` | `admin@basedb.local` | adresse du premier administrateur |
| `BASEDB_ADMIN_PASSWORD` | généré, affiché une fois | réappliqué à **chaque** démarrage s’il est défini : à retirer une fois connecté |

## Adresses

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_API` | `http://localhost:8787` | l’API, vue du navigateur |
| `BASEDB_MCP` | `http://localhost:8788/mcp` | le MCP, affiché aux utilisateurs |
| `BASEDB_ORIGINS` | toute origine `http://localhost` | origines autorisées, séparées par des virgules — **obligatoire en production** |
| `BASEDB_PUBLIC_URL` | — | adresse publique de l’API, pour le retour OIDC |
| `BASEDB_DOMAIN` | — | le domaine servi par le proxy Caddy |
| `BASEDB_WEB_PORT`, `BASEDB_API_PORT`, `BASEDB_MCP_PORT` | 3000, 8787, 8788 | ports publiés |

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

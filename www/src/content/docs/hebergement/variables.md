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
| `BASEDB_BASE_PATH` | le chemin de `BASEDB_PUBLIC_URL` | le chemin sous lequel basedb est servi derrière une passerelle, `/basedb` pour `https://passerelle.example.com/basedb/` ; voir [Docker Compose](/basedb/hebergement/docker/#derrière-une-passerelle-sous-un-chemin) |
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

## Courriels

Sans serveur d’envoi, basedb n’envoie aucun courriel. Avec lui partent les notifications restées
dix minutes sans être lues (chacun choisit lesquelles dans **Paramètres › Notifications**), les
courriels de l’étape **Envoyer un courriel** des automatisations, et le lien d’un **mot de passe
oublié**. Les liens pointent vers `BASEDB_PUBLIC_URL` ; sans elle, un courriel n’en porte pas.

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | le serveur SMTP : celui de votre messagerie ou d’un service d’envoi |
| `BASEDB_SMTP_PORT` | `587` | `465` pour une connexion chiffrée d’emblée |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` sur le port 465) | `none` seulement pour un relais sur la même machine : sinon le mot de passe passerait en clair |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | l’identifiant du compte d’envoi, s’il en demande un |
| `BASEDB_MAIL_FROM` | — | obligatoire avec `BASEDB_SMTP_HOST` : l’expéditeur, `basedb <no-reply@exemple.fr>` |

Au démarrage, le journal dit ce qu’il en est : `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Un courriel que le serveur refuse est repris 1, 5, 30, 120 puis
360 minutes plus tard.

## Cartes et adresses

La vue **Carte** place une adresse grâce à un service de géocodage : celui d’OpenStreetMap
(Nominatim) par défaut, interrogé une fois par adresse, une requête par seconde au plus, chaque
réponse gardée. Le fond de carte est fait de **tuiles** que le navigateur de chaque lecteur
charge directement.

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | un autre service qui parle le même protocole (un Nominatim à vous) ; `off` : aucun, les adresses ne quittent pas l’instance et seules la latitude et la longitude placent les lignes |
| `BASEDB_MAP_TILES` | les tuiles d’OpenStreetMap | un autre serveur de tuiles, modèle `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | la mention que ce serveur demande, en bas à droite de la carte |

Au démarrage, le journal dit quel service est employé : `Géocodage : https://nominatim.openstreetmap.org.`

## Documents PDF

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_PDF_FONTS` | les polices Noto de l’image | un dossier à vous, monté dans le conteneur, qui tient `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, et pour le chinois, le japonais et le coréen `NotoSansCJK-Regular.ttc` et `-Bold.ttc` |

## Modèles de base

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | le catalogue du site public | d’où l’instance lit les modèles de sa galerie ; `off` pour n’en lire aucun (les modèles intégrés restent) — voir [Modèles](/basedb/fonctionnalites/modeles/) |

## Intelligence artificielle

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic`, `mistral` ou `openai_compatible` (Azure, une passerelle, un modèle local) |
| `BASEDB_AI_MODEL` | — | le modèle |
| `BASEDB_AI_API_KEY` | — | la clé (sinon `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) ; facultative pour `openai_compatible` |
| `BASEDB_AI_BASE_URL` | l’adresse du fournisseur | ce qui précède `/chat/completions` (`/messages` pour `anthropic`), paramètres compris ; obligatoire pour `openai_compatible` — voir [Intelligence artificielle](/basedb/fonctionnalites/ia/#azure-une-passerelle-un-modèle-local) |
| `BASEDB_AI_HEADERS` | — | des en-têtes ajoutés à chaque appel, en objet JSON : `{"api-key":"…"}` |
| `BASEDB_AI_QUOTA` | `120` | appels interactifs par heure et par tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | calculs de champs IA par heure et par tenant |
| `BASEDB_AI_WORKER` | `1` | `0` : pas de calcul de fond dans ce processus |

## Webhooks vers le réseau interne

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | vos serveurs internes, séparés par des virgules : un nom (`chat.intra.example.com`), un domaine et ses sous-domaines (`*.intra.example.com`), une adresse ou une plage (`10.12.0.0/16`) |

Webhooks, requêtes HTTP des automatisations et tables synchronisées ne partent que vers des
adresses publiques en HTTPS. Une cible de la liste est acceptée en plus, quels que soient son
adresse, son port et son schéma — HTTP compris. Une entrée illisible empêche le démarrage. Voir
[Webhooks](/basedb/integrations/webhooks/#cibles).

## Démo publique

Une instance ouverte à tous, comme [demo.basedb.eodia.com](https://demo.basedb.eodia.com) :
l’écran de connexion préremplit un compte partagé, le visiteur lit tout et modifie ce qui existe,
mais ne crée ni ne supprime rien — base, table, ligne, fichier, commentaire, compte, jeton,
lien —, et l’IA répond qu’elle ne fait pas partie de la démo. La console SQL n’y fait que lire.
Remettre la base en état chaque nuit reste à votre charge.

| Variable | Défaut | Rôle |
|---|---|---|
| `BASEDB_DEMO` | — | `1` : l’instance devient une démo publique |
| `BASEDB_DEMO_ACCOUNTS` | — | un compte par langue, séparés par des virgules : `fr=demo@demo.com,en=demo-en@demo.com` ; l’écran de connexion préremplit celui de sa langue, sinon l’anglais, sinon le premier, et propose les autres. Créez ces comptes, chacun avec son projet, avant d’activer la démo : elle refuse les créations à tous, administrateur compris |
| `BASEDB_DEMO_PASSWORD` | — | avec `BASEDB_DEMO_ACCOUNTS`, leur mot de passe, le même pour tous, publié avec eux |

Sans `BASEDB_DEMO_ACCOUNTS`, le compte partagé est l’administrateur que nomment
`BASEDB_ADMIN_EMAIL` et `BASEDB_ADMIN_PASSWORD`. Une adresse de la démo se connecte avec le mot de
passe publié, quoi qu’on tape : des essais faux ne la verrouillent pas pour tout le monde.

## Développement seulement

| Variable | Rôle |
|---|---|
| `BASEDB_DEV_MAIL=1` | affiche les courriels dans les journaux au lieu de les envoyer |
| `BASEDB_WEBHOOK_DEV=1` | autorise les webhooks vers HTTP et les adresses locales |

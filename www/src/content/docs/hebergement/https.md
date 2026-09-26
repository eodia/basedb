---
title: Domaine et HTTPS
description: Servir basedb sur un domaine, en HTTPS, derrière le proxy Caddy fourni.
---

En production, basedb doit être servi en **HTTPS** : ses cookies de session sont `Secure` et
préfixés `__Host-`, et un navigateur ne les accepte en HTTP que sur `localhost`.

Le `docker-compose.yml` fournit pour cela un proxy **Caddy**, qui obtient et renouvelle seul son
certificat Let’s Encrypt, et sert tout sur **un seul domaine** :

| Chemin | Service |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | l’API |
| `/mcp` | le serveur MCP |
| tout le reste — `/`, `/f/…` | l’interface |

## Mise en place

1. Faites pointer le DNS de votre domaine vers le serveur ; ouvrez les ports 80 et 443.
2. Dans `.env` :

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_API=https://basedb.example.com
   BASEDB_MCP=https://basedb.example.com/mcp
   BASEDB_ORIGINS=https://basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Démarrez avec le profil `https` :

   ```bash
   docker compose --profile https up -d --build
   ```

Les ports 3000, 8787 et 8788 restent publiés sur `127.0.0.1` seulement : tout le trafic
extérieur passe par Caddy.

## Pourquoi ces variables

- `BASEDB_ORIGINS` : l’API n’accepte d’appels de navigateur que depuis les origines listées.
  Sans elle, seul `localhost` l’est.
- `BASEDB_PUBLIC_URL` : l’adresse de retour d’une connexion OIDC, comparée caractère par
  caractère à celle enregistrée chez le fournisseur d’identité.
- Caddy pose lui-même `X-Forwarded-For` à partir de l’adresse réelle du visiteur : les limites de
  débit de l’API (connexion, formulaires partagés) comptent alors par visiteur.

## Un autre proxy

Nginx, Traefik ou un répartiteur de charge conviennent aussi : reproduisez le routage du
tableau ci-dessus (voir `docker/Caddyfile`), désactivez la mise en tampon sur `/mcp`, et assurez-vous
que le proxy **remplace** `X-Forwarded-For` plutôt que de le compléter.

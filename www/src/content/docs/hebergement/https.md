---
title: Domaine et HTTPS
description: Servir basedb sur un domaine, en HTTPS, derrière le proxy Caddy fourni.
---

En production, basedb doit être servi en **HTTPS** : ses cookies de session sont `Secure` et
préfixés `__Host-`, et un navigateur ne les accepte en HTTP que sur `localhost`.

L’image sert déjà tout sur une seule adresse — l’interface, l’API sous `/api`, le serveur MCP
sous `/mcp`. Il ne reste qu’à la placer derrière un proxy HTTPS : le `docker-compose.yml` en
fournit un, **Caddy**, qui obtient et renouvelle seul son certificat Let’s Encrypt.

## Mise en place

1. Faites pointer le DNS de votre domaine vers le serveur ; ouvrez les ports 80 et 443.
2. Dans `.env` :

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Démarrez avec le profil `https` :

   ```bash
   docker compose --profile https up -d
   ```

Le port 3000 reste publié sur `127.0.0.1` seulement : tout le trafic extérieur passe par Caddy.

## Pourquoi ces variables

- `BASEDB_DOMAIN` : le domaine pour lequel Caddy demande le certificat.
- `BASEDB_PUBLIC_URL` : l’adresse de retour d’une connexion OIDC, comparée caractère par
  caractère à celle enregistrée chez le fournisseur d’identité.
- Caddy pose `X-Forwarded-For` à partir de l’adresse réelle du visiteur, et basedb le garde quand
  il vient d’un réseau privé : les limites de débit de l’API (connexion, formulaires partagés)
  comptent alors par visiteur.

## Un autre proxy

Nginx, Traefik ou un répartiteur de charge conviennent aussi : envoyez **tout** le trafic du
domaine vers le port 3000 du conteneur, sans mise en tampon des réponses (le serveur MCP et le
temps réel diffusent leurs réponses au fil de l’eau), et assurez-vous que le proxy **remplace**
`X-Forwarded-For` plutôt que de le compléter.

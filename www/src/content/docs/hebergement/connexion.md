---
title: Comptes et connexion
description: Qui peut créer un compte, et se connecter avec Google, Microsoft ou le SSO de l’entreprise.
---

## Première connexion

Sur une instance neuve, la première page crée le **compte administrateur** : votre nom, votre
adresse, le mot de passe de votre choix. Créez-le avant de rendre l’instance joignable par
d’autres — sur un domaine, ou avec un port publié sur toutes les interfaces.

## Création de comptes

Par défaut, toute personne qui atteint l’instance peut **créer son compte**, puis ses propres
projets. Elle ne voit rien d’autre : les projets des autres lui arrivent par **invitation**.

Dans **Administration → Utilisateurs**, la carte « Création de comptes » :

- ferme la création de comptes : seules les personnes invitées peuvent alors en créer un ;
- ou la réserve à des domaines — `exemple.fr, autre.fr` n’admet que ces adresses.

## Inviter dans un projet ou une base

Qui a le niveau **Gestion** sur un projet ou une base le partage : menu du projet (ou de la
base) → **Partager…**, une adresse, un niveau — Lecture, Modification ou Gestion. basedb
produit un **lien d’invitation**, valable 7 jours, à envoyer à la personne comme vous le
souhaitez : elle se connecte, ou crée son compte, en l’ouvrant. Le même écran montre qui a
accès, change un niveau ou le retire, et garde les liens en attente pour les renvoyer.

Un gestionnaire ne donne jamais plus que ce qu’il gère : le gestionnaire d’une base la
partage, pas son projet.

## Se connecter avec Google, Microsoft…

basedb parle **OpenID Connect** : Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Chaque fournisseur déclaré ajoute un bouton « Continuer avec … » aux écrans de
connexion, de création de compte et d’invitation.

1. Définissez l’adresse publique de basedb dans `.env` :

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Chez le fournisseur, créez une application web ; son **adresse de retour** est
   `https://basedb.example.com/auth/oidc/<nom>/callback`, où `<nom>` est celui que vous lui
   donnez ci-dessous (`google`, `microsoft`…).

3. Déclarez-le dans `.env` :

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d` : au démarrage, basedb liste les fournisseurs retenus, et dit ce qui
   manque à ceux qu’il laisse de côté.

| Variable, pour le fournisseur `<NOM>` | Rôle |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | l’application enregistrée chez le fournisseur |
| `BASEDB_OIDC_<NOM>_ISSUER` | l’émetteur ; inutile pour `google` et `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | le nom sur le bouton — `Google`, `Microsoft` par défaut |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` par défaut |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off` : n’admet que les comptes existants |

Une **première connexion crée le compte** comme la création de comptes le permet : ouverte,
elle l’admet ; réservée à des domaines, seulement leurs adresses. Une adresse déjà portée par
un compte à mot de passe n’est jamais adoptée : sa titulaire se connecte avec son mot de
passe. Les secrets restent dans l’environnement : rien n’en est écrit dans la base.

:::note
GitHub n’est pas un fournisseur OpenID Connect : il ne peut pas servir ici.
:::

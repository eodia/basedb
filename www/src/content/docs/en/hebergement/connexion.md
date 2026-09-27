---
title: Accounts and sign-in
description: Who can create an account, and signing in with Google, Microsoft or your company’s SSO.
---

## First sign-in

On a new instance, the first page creates the **administrator account**: your name, your email
address, the password of your choice. Create it before making the instance reachable by
others — on a domain, or with a port published on all interfaces.

## Account creation

By default, anyone who reaches the instance can **create an account**, and then their own
projects. They see nothing else: other people’s projects come to them by **invitation**.

In **Administration → Users**, the “Account creation” card:

- closes account creation: only invited people can then create one;
- or restricts it to domains — `exemple.fr, autre.fr` only admits those addresses.

## Inviting people to a project or a base

Whoever has the **Manage** level on a project or a base can share it: the project’s (or the
base’s) menu → **Share…**, an email address, a level — Read, Edit or Manage. basedb produces an
**invitation link**, valid for 7 days, to send to the person however you like: they sign in, or
create their account, by opening it. The same screen shows who has access, changes a level or
removes it, and keeps pending links so they can be sent again.

A manager never gives more than what they manage: the manager of a base can share that base,
not its project.

## Signing in with Google, Microsoft…

basedb speaks **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Each declared provider adds a “Continue with …” button to the sign-in, account creation
and invitation screens.

1. Set basedb’s public address in `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. With the provider, create a web application; its **redirect address** is
   `https://basedb.example.com/auth/oidc/<nom>/callback`, where `<nom>` is the name you give it
   below (`google`, `microsoft`…).

3. Declare it in `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: at startup, basedb lists the providers it accepted, and says what is
   missing for the ones it left aside.

| Variable, for provider `<NOM>` | Role |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | the application registered with the provider |
| `BASEDB_OIDC_<NOM>_ISSUER` | the issuer; not needed for `google` and `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | the name on the button — `Google`, `Microsoft` by default |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` by default |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: only admits existing accounts |

A **first sign-in creates the account** as far as account creation allows: when open, it is
admitted; when restricted to domains, only their addresses are. An address already held by a
password account is never taken over: its owner signs in with their password. The secrets stay
in the environment: nothing of them is written to the database.

:::note
GitHub is not an OpenID Connect provider: it cannot be used here.
:::

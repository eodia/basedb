---
title: Účty a přihlášení
description: Kdo si může vytvořit účet a jak se přihlásit přes Google, Microsoft nebo firemní SSO.
---

## První přihlášení

Na nové instanci vytvoří první stránka **účet správce**: vaše jméno, e-mailová adresa a heslo
podle vlastní volby. Vytvořte ho dříve, než instanci zpřístupníte ostatním – na doméně nebo
s portem publikovaným na všech rozhraních.

## Vytváření účtů

Ve výchozím nastavení si každý, kdo se k instanci dostane, může **vytvořit účet** a pak
vlastní projekty. Nic jiného nevidí: projekty ostatních k němu přicházejí prostřednictvím
**pozvánky**.

V **Administrace → Uživatelé** karta „Vytváření účtů“:

- uzavře vytváření účtů: účet si pak mohou vytvořit jen pozvané osoby;
- nebo ho vyhradí pro určité domény – `exemple.fr, autre.fr` přijme jen adresy z těchto
  domén.

## Pozvání do projektu nebo databáze

Kdo má nad projektem nebo databází úroveň **Správa**, může je sdílet: nabídka projektu (nebo
databáze) → **Sdílet…**, adresa, úroveň – Čtení, Úpravy nebo Správa. basedb vytvoří **odkaz
s pozvánkou** platný 7 dní, který osobě pošlete, jak uznáte za vhodné: po jeho otevření se
přihlásí nebo si vytvoří účet. Na stejné obrazovce vidíte, kdo má přístup, můžete změnit nebo
odebrat úroveň a čekající odkazy se zde uchovávají, abyste je mohli poslat znovu.

Kdo něco spravuje, nikdy nedá víc, než sám spravuje: kdo spravuje databázi, sdílí ji, ale ne
její projekt.

## Přihlášení přes Google, Microsoft…

basedb podporuje **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Každý nastavený poskytovatel přidá tlačítko „Pokračovat přes …“ na obrazovky
přihlášení, vytvoření účtu a pozvánky.

1. Nastavte veřejnou adresu basedb v `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. U poskytovatele vytvořte webovou aplikaci; její **návratová adresa** je
   `https://basedb.example.com/auth/oidc/<nom>/callback`, kde `<nom>` je název, který mu
   dáte níže (`google`, `microsoft`…).

3. Deklarujte ho v `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: při spuštění basedb vypíše přijaté poskytovatele a u těch, které
   vynechá, uvede, co jim chybí.

| Proměnná pro poskytovatele `<NOM>` | Role |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | aplikace registrovaná u poskytovatele |
| `BASEDB_OIDC_<NOM>_ISSUER` | vydavatel; pro `google` a `gitlab` není potřeba |
| `BASEDB_OIDC_<NOM>_LABEL` | název na tlačítku – ve výchozím nastavení `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | ve výchozím nastavení `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: přijímá jen existující účty |

**První přihlášení vytvoří účet** tak, jak to vytváření účtů dovoluje: je-li otevřené, účet
vznikne; je-li vyhrazené pro domény, jen pro jejich adresy. Adresa, kterou už používá účet
s heslem, se nikdy nepřevezme: jeho majitel se přihlašuje svým heslem. Tajemství zůstávají
v prostředí: nic z nich se nezapisuje do databáze.

:::note
GitHub není poskytovatelem OpenID Connect: zde ho nelze použít.
:::

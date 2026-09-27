---
title: Conturi și conectare
description: Cine poate crea un cont și cum vă conectați cu Google, Microsoft sau cu SSO-ul companiei.
---

## Prima conectare

Pe o instanță nouă, prima pagină creează **contul de administrator**: numele, adresa
dumneavoastră și parola aleasă. Creați-l înainte de a face instanța accesibilă altora — pe un
domeniu sau cu un port publicat pe toate interfețele.

## Crearea conturilor

În mod implicit, orice persoană care ajunge la instanță își poate **crea contul**, apoi
propriile proiecte. Nu vede nimic altceva: proiectele altora îi parvin prin **invitație**.

În **Administrare → Utilizatori**, cardul „Crearea conturilor”:

- închide crearea de conturi: doar persoanele invitate își mai pot crea atunci unul;
- sau o rezervă unor domenii — `exemple.fr, autre.fr` admite doar aceste adrese.

## Invitarea într-un proiect sau într-o bază

Cine are nivelul **Gestionare** pe un proiect sau pe o bază îl poate partaja: meniul
proiectului (sau al bazei) → **Partajați…**, o adresă, un nivel — Citire, Editare sau
Gestionare. basedb generează un **link de invitație**, valabil 7 zile, pe care îl trimiteți
persoanei cum doriți: aceasta se conectează sau își creează contul deschizându-l. Același
ecran arată cine are acces, schimbă sau retrage un nivel și păstrează linkurile în așteptare
pentru a le retrimite.

Cine gestionează nu dă niciodată mai mult decât ce gestionează: cel care gestionează o bază o
partajează pe ea, nu proiectul ei.

## Conectarea cu Google, Microsoft…

basedb vorbește **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Fiecare furnizor declarat adaugă un buton „Continuați cu …” pe ecranele de conectare,
de creare a contului și de invitație.

1. Definiți adresa publică a basedb în `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. La furnizor, creați o aplicație web; **adresa ei de redirecționare** este
   `https://basedb.example.com/auth/oidc/<nom>/callback`, unde `<nom>` este numele pe care i-l
   dați mai jos (`google`, `microsoft`…).

3. Declarați-l în `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: la pornire, basedb listează furnizorii reținuți și spune ce le
   lipsește celor pe care îi lasă deoparte.

| Variabilă, pentru furnizorul `<NOM>` | Rol |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | aplicația înregistrată la furnizor |
| `BASEDB_OIDC_<NOM>_ISSUER` | emitentul; inutil pentru `google` și `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | numele de pe buton — `Google`, `Microsoft` în mod implicit |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` în mod implicit |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: admite doar conturile existente |

O **primă conectare creează contul** în măsura în care crearea de conturi o permite: deschisă,
îl admite; rezervată unor domenii, doar adresele acestora. O adresă folosită deja de un cont cu
parolă nu este niciodată preluată: titulara ei se conectează cu parola. Secretele rămân în
mediu: nimic din ele nu este scris în baza de date.

:::note
GitHub nu este un furnizor OpenID Connect: nu poate fi folosit aici.
:::

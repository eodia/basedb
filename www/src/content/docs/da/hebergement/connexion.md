---
title: Konti og login
description: Hvem der kan oprette en konto, og login med Google, Microsoft eller virksomhedens SSO.
---

## Første login

På en ny instans opretter den første side **administratorkontoen**: dit navn, din adresse og en
adgangskode efter eget valg. Opret den, før du gør instansen tilgængelig for andre — på et
domæne eller med en port, der er udgivet på alle netværksgrænseflader.

## Oprettelse af konti

Som standard kan alle, der kan nå instansen, **oprette deres egen konto** og derefter deres egne
projekter. De ser intet andet: andres projekter kommer til dem via **invitation**.

I **Administration → Brugere** kan kortet »Oprettelse af konti«:

- lukke for oprettelse af konti: kun inviterede personer kan så oprette en;
- eller forbeholde den bestemte domæner — `exemple.fr, autre.fr` tillader kun disse adresser.

## Invitér til et projekt eller en database

Den, der har niveauet **Administrere** på et projekt eller en database, deler det: projektets
(eller databasens) menu → **Del…**, en adresse, et niveau — Læse, Redigere eller Administrere.
basedb laver et **invitationslink**, der er gyldigt i 7 dage, og som du sender til personen, som
du vil: personen logger ind eller opretter sin konto ved at åbne det. Den samme skærm viser, hvem
der har adgang, ændrer eller fjerner et niveau og gemmer de ventende links, så de kan sendes
igen.

En administrator giver aldrig mere, end vedkommende selv administrerer: den, der administrerer
en database, deler databasen, ikke dens projekt.

## Log ind med Google, Microsoft …

basedb taler **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta … Hver konfigureret udbyder tilføjer en knap »Fortsæt med …« på skærmene til login,
kontooprettelse og invitation.

1. Angiv basedbs offentlige adresse i `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Opret en webapplikation hos udbyderen; dens **returadresse** er
   `https://basedb.example.com/auth/oidc/<nom>/callback`, hvor `<nom>` er det navn, du giver
   den nedenfor (`google`, `microsoft` …).

3. Konfigurér den i `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: ved start lister basedb de udbydere, der er taget i brug, og
   fortæller, hvad der mangler for dem, den springer over.

| Variabel for udbyderen `<NOM>` | Rolle |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | applikationen, der er registreret hos udbyderen |
| `BASEDB_OIDC_<NOM>_ISSUER` | udstederen; unødvendig for `google` og `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | navnet på knappen — `Google`, `Microsoft` som standard |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` som standard |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: tillader kun eksisterende konti |

Et **første login opretter kontoen**, i det omfang oprettelse af konti tillader det: er den åben,
tillades det; er den forbeholdt bestemte domæner, kun deres adresser. En adresse, der allerede
bruges af en konto med adgangskode, overtages aldrig: dens indehaver logger ind med sin
adgangskode. Hemmelighederne bliver i miljøet: intet af dem skrives i databasen.

:::note
GitHub er ikke en OpenID Connect-udbyder: den kan ikke bruges her.
:::

---
title: Konton och inloggning
description: Vem som kan skapa ett konto, och logga in med Google, Microsoft eller företagets SSO.
---

## Första inloggningen

På en ny instans skapar den första sidan **administratörskontot**: ditt namn, din adress och ett
lösenord du väljer. Skapa det innan du gör instansen nåbar för andra – på en domän, eller med en
port som är publicerad på alla gränssnitt.

## Skapa konton

Som standard kan alla som når instansen **skapa ett konto** och sedan egna projekt. De ser
ingenting annat: andras projekt når dem via **inbjudan**.

I **Administration → Användare** kan kortet ”Skapa konton”:

- stänga möjligheten att skapa konton: då kan bara inbjudna personer skapa ett;
- eller begränsa den till vissa domäner – `exemple.fr, autre.fr` godtar bara de adresserna.

## Bjuda in till ett projekt eller en databas

Den som har nivån **Hantera** på ett projekt eller en databas kan dela det: projektets (eller
databasens) meny → **Dela…**, en adress, en nivå – Läsa, Redigera eller Hantera. basedb skapar en
**inbjudningslänk**, giltig i 7 dagar, som du skickar till personen på valfritt sätt: hen loggar
in, eller skapar sitt konto, genom att öppna den. Samma skärm visar vem som har åtkomst, ändrar
en nivå eller tar bort den, och behåller väntande länkar så att de kan skickas igen.

Den som hanterar något kan aldrig ge mer än det hen hanterar: den som hanterar en databas kan
dela databasen, inte dess projekt.

## Logga in med Google, Microsoft …

basedb talar **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta … Varje angiven leverantör lägger till en knapp ”Fortsätt med …” på skärmarna för
inloggning, kontoskapande och inbjudan.

1. Ange basedbs offentliga adress i `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Skapa ett webbprogram hos leverantören; dess **återanropsadress** är
   `https://basedb.example.com/auth/oidc/<nom>/callback`, där `<nom>` är det namn du ger den
   nedan (`google`, `microsoft` …).

3. Ange den i `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: vid start listar basedb de leverantörer som har godtagits, och talar
   om vad som saknas för dem som har lämnats utanför.

| Variabel, för leverantören `<NOM>` | Roll |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | programmet som registrerats hos leverantören |
| `BASEDB_OIDC_<NOM>_ISSUER` | utfärdaren; behövs inte för `google` och `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | namnet på knappen – `Google`, `Microsoft` som standard |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` som standard |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: godtar bara befintliga konton |

En **första inloggning skapar kontot** i den mån kontoskapandet tillåter det: är det öppet
godtas det; är det begränsat till vissa domäner godtas bara deras adresser. En adress som redan
används av ett konto med lösenord tas aldrig över: dess innehavare loggar in med sitt lösenord.
Hemligheterna stannar i miljön: ingenting av dem skrivs till databasen.

:::note
GitHub är ingen OpenID Connect-leverantör: den kan inte användas här.
:::

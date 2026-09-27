---
title: Kontoer og innlogging
description: Hvem som kan opprette en konto, og innlogging med Google, Microsoft eller bedriftens SSO.
---

## Første innlogging

På en ny instans oppretter den første siden **administratorkontoen**: navnet ditt, e-postadressen din
og et passord du velger selv. Opprett den før du gjør instansen tilgjengelig for
andre – på et domene, eller med en port publisert på alle grensesnitt.

## Opprettelse av kontoer

Som standard kan alle som når instansen, **opprette sin egen konto**, og deretter sine egne
prosjekter. De ser ikke noe annet: andres prosjekter får de tilgang til via **invitasjon**.

I **Administrasjon → Brukere** kan kortet «Kontooppretting»:

- stenge for oppretting av kontoer: da kan bare inviterte personer opprette en;
- eller forbeholde den bestemte domener – `exemple.fr, autre.fr` tillater bare disse adressene.

## Inviter til et prosjekt eller en database

Den som har nivået **Administrere** på et prosjekt eller en database, kan dele det: prosjektets (eller
databasens) meny → **Del…**, en adresse, et nivå – Lese, Redigere eller Administrere. basedb
lager en **invitasjonslenke**, gyldig i 7 dager, som du sender til personen slik du
vil: vedkommende logger inn, eller oppretter en konto, ved å åpne den. Den samme skjermen viser hvem som har
tilgang, endrer eller fjerner et nivå, og tar vare på ventende lenker slik at de kan sendes på nytt.

En administrator gir aldri mer enn det vedkommende selv administrerer: den som administrerer en database, deler
den, ikke prosjektet.

## Logg inn med Google, Microsoft …

basedb snakker **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta … Hver leverandør som er satt opp, legger til en knapp «Fortsett med …» på skjermene for
innlogging, kontooppretting og invitasjon.

1. Angi den offentlige adressen til basedb i `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Hos leverandøren oppretter du en nettapplikasjon; **returadressen** er
   `https://basedb.example.com/auth/oidc/<nom>/callback`, der `<nom>` er navnet du gir den
   nedenfor (`google`, `microsoft` …).

3. Sett den opp i `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: ved oppstart lister basedb opp leverandørene som er tatt med, og sier hva
   som mangler for dem den utelater.

| Variabel, for leverandøren `<NOM>` | Rolle |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | applikasjonen som er registrert hos leverandøren |
| `BASEDB_OIDC_<NOM>_ISSUER` | utstederen; unødvendig for `google` og `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | navnet på knappen – `Google`, `Microsoft` som standard |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` som standard |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: tillater bare eksisterende kontoer |

En **første innlogging oppretter kontoen** slik kontoopprettingen tillater det: er den åpen,
godtas den; er den forbeholdt bestemte domener, bare adressene deres. En adresse som allerede brukes av
en konto med passord, blir aldri overtatt: eieren logger inn med passordet
sitt. Hemmelighetene blir værende i miljøet: ingenting av dem skrives til databasen.

:::note
GitHub er ikke en OpenID Connect-leverandør: den kan ikke brukes her.
:::

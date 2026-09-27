---
title: Accounts en inloggen
description: Wie een account kan aanmaken, en inloggen met Google, Microsoft of de SSO van het bedrijf.
---

## Eerste keer inloggen

Op een nieuwe instantie maakt de eerste pagina het **beheerdersaccount** aan: je naam, je
e-mailadres, een wachtwoord naar keuze. Maak het aan voordat je de instantie bereikbaar maakt voor
anderen — op een domein, of met een poort die op alle interfaces is gepubliceerd.

## Accounts aanmaken

Standaard kan iedereen die de instantie bereikt **een account aanmaken**, en daarna eigen
projecten. Die persoon ziet verder niets: de projecten van anderen komen binnen via een **uitnodiging**.

In **Beheer → Gebruikers** kan de kaart “Accounts aanmaken”:

- het aanmaken van accounts sluiten: alleen uitgenodigde personen kunnen er dan een aanmaken;
- of het voorbehouden aan bepaalde domeinen — `exemple.fr, autre.fr` laat alleen die adressen toe.

## Uitnodigen voor een project of een database

Wie het niveau **Beheren** heeft op een project of een database, kan het delen: menu van het project (of van de
database) → **Delen…**, een e-mailadres, een niveau — Lezen, Bewerken of Beheren. basedb
maakt een **uitnodigingslink** aan, 7 dagen geldig, die je naar de persoon stuurt zoals je
wilt: die persoon logt in, of maakt een account aan, door de link te openen. Hetzelfde scherm toont wie
toegang heeft, wijzigt of verwijdert een niveau, en bewaart openstaande links om ze opnieuw te versturen.

Een beheerder geeft nooit meer dan wat hij beheert: de beheerder van een database deelt die
database, niet het project ervan.

## Inloggen met Google, Microsoft…

basedb spreekt **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Elke ingestelde provider voegt een knop “Doorgaan met …” toe aan de schermen voor
inloggen, account aanmaken en uitnodiging.

1. Stel het openbare adres van basedb in `.env` in:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Maak bij de provider een webapplicatie aan; de **redirect-URL** ervan is
   `https://basedb.example.com/auth/oidc/<nom>/callback`, waarbij `<nom>` de naam is die je hem
   hieronder geeft (`google`, `microsoft`…).

3. Stel hem in `.env` in:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: bij het opstarten somt basedb de geaccepteerde providers op, en meldt wat er
   ontbreekt bij de providers die het links laat liggen.

| Variabele, voor provider `<NOM>` | Rol |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | de applicatie die bij de provider is geregistreerd |
| `BASEDB_OIDC_<NOM>_ISSUER` | de issuer; niet nodig voor `google` en `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | de naam op de knop — standaard `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | standaard `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: laat alleen bestaande accounts toe |

Bij de **eerste keer inloggen wordt het account aangemaakt** zoals de instelling voor accounts aanmaken toestaat: open,
dan wordt het toegelaten; voorbehouden aan domeinen, dan alleen hun adressen. Een adres dat al bij
een account met wachtwoord hoort, wordt nooit overgenomen: de eigenaar logt in met diens
wachtwoord. De geheimen blijven in de omgeving: er wordt niets van in de database geschreven.

:::note
GitHub is geen OpenID Connect-provider: het kan hier niet worden gebruikt.
:::

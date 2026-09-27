---
title: Slack, kalendere og synkroniserede tabeller
description: Giv en Slack-kanal besked, forbind en kalender, hold en tabel opdateret fra en CSV-fil, en kalender eller en anden database.
---

Skærmen **Integrationer** for en database åbnes fra profilmenuen nederst til venstre. Den kræver
niveauet **Administrere** og samler det, der forbinder databasen med resten af dine værktøjer.

![Skærmen Integrationer for en database](../../../../assets/screens/integrations.png)

## Slack

**Forbind en kanal**: opret i Slack en *indgående webhook* til den ønskede kanal, og indsæt
derefter dens adresse (`https://hooks.slack.com/…`, den eneste tilladte oprindelse). **Test**
sender en testbesked. Adressen krypteres, så snart den gemmes, og vises aldrig igen.

Den forbundne kanal er derefter en handling i [automatiseringerne](/basedb/da/fonctionnalites/automatisations/):
**Send til Slack** med en besked, der citerer rækken — »Ny negativ anmeldelse fra
{{Auteur}}: {{Avis}}«.

## Kalendere

To retninger, to metoder:

- **Se en visning i en kalender**: del en kalender- eller tidslinjevisning offentligt; dens
  delingsdialog giver adressen til et **iCalendar-feed**, som du kan abonnere på fra Google
  Kalender (»Andre kalendere« → »Fra webadresse«), Outlook eller Apple Kalender. Se
  [Delte visninger](/basedb/da/fonctionnalites/vues-partagees/#en-kalender-i-din-kalenderapp).
- **Importér en kalender**: opret en synkroniseret tabel med kilden »Kalender« og kalenderens
  hemmelige iCal-adresse.

## Synkroniserede tabeller

En synkroniseret tabel **holdes opdateret fra en kilde**: den kan læses, filtreres og vises i
visninger som alle andre, men kan ikke skrives i manuelt — et mærke »Synkroniseret« minder om
det, og API'et afviser enhver skrivning (`TABLE_SYNCED`).

| Kilde | Hvad tabellen bliver til |
|---|---|
| **CSV-fil online** | én kolonne pr. kolonne i filen, med en type afledt af indholdet: tal, dato eller tekst |
| **Kalender** (Google Kalender, iCalendar) | én begivenhed pr. række: titel, start, slut, sted, beskrivelse |
| **Delt visning fra en basedb** | rækkerne i en [delt visning](/basedb/da/fonctionnalites/vues-partagees/#en-kilde-til-andre-databaser) på denne instans eller en anden |

**Ny synkroniseret tabel** vælger kilden og intervallet — fra hvert 15. minut til én gang om
dagen; **Synkroniser** læser den igen med det samme. Hver gennemkørsel opretter, ændrer og
sletter det nødvendige, for at tabellen ligner kilden, ud fra et felt, der er markeret som
**Synkroniseringsnøgle**. Alle disse skrivninger går gennem historikken.

**Stop** synkroniseringen gør tabellen almindelig: dens rækker bliver, og der kan igen skrives i
dem manuelt.

## Begrænsninger

- En kilde læses inden for grænsen på 5 MB, 10 000 rækker og 10 sekunder.
- En kilde, der fejler, sletter intet: tabellen beholder sine rækker indtil næste gennemkørsel.
- En kolonne, der dukker op i kilden efter oprettelsen, tilføjes ikke.
- Slack forbindes via en indgående webhook, endnu ikke via en Slack-app.

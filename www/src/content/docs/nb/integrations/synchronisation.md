---
title: Slack, kalendere og synkroniserte tabeller
description: Varsle en Slack-kanal, koble til en kalender, hold en tabell oppdatert fra en CSV, en kalender eller en annen database.
---

Skjermen **Integrasjoner** for en database åpnes fra profilmenyen, nederst til venstre. Den
krever nivået **Administrere** og samler det som kobler databasen til resten av verktøyene dine.

![Integrasjoner-skjermen for en database](../../../../assets/screens/integrations.png)

## Slack

**Koble til en kanal**: i Slack oppretter du en *innkommende webhook* for ønsket kanal, og limer så inn
adressen (`https://hooks.slack.com/…`, den eneste godtatte opprinnelsen). **Test** sender en
testmelding. Adressen krypteres straks den lagres, og vises aldri igjen.

Den tilkoblede kanalen blir deretter en handling i [automatiseringene](/basedb/nb/fonctionnalites/automatisations/):
**Send til Slack**, med en melding som refererer til raden – «Ny negativ tilbakemelding fra
{{Auteur}}: {{Avis}}».

## Kalendere

To retninger, to måter:

- **Se en visning i en kalender**: del en kalender- eller tidslinjevisning offentlig; delingsdialogen
  gir adressen til en **iCalendar-strøm**, som du abonnerer på fra Google
  Kalender («Andre kalendere» → «Fra nettadresse»), Outlook eller Apple Calendar. Se
  [Delte visninger](/basedb/nb/fonctionnalites/vues-partagees/#en-kalender-i-kalenderappen-din).
- **Importer en kalender**: opprett en synkronisert tabell med kilden «Kalender» og kalenderens
  hemmelige iCal-adresse.

## Synkroniserte tabeller

En synkronisert tabell **holdes oppdatert fra en kilde**: den kan leses, filtreres og
vises i visninger som alle andre, men kan ikke skrives til for hånd – et merke
«Synkronisert» minner om det, og API-et avviser all skriving (`TABLE_SYNCED`).

| Kilde | Hva tabellen blir |
|---|---|
| **CSV-fil på nett** | én kolonne per kolonne i filen, typet ut fra innholdet: tall, dato eller tekst |
| **Kalender** (Google Kalender, iCalendar) | én hendelse per rad: tittel, start, slutt, sted, beskrivelse |
| **Delt visning fra en basedb** | radene i en [delt visning](/basedb/nb/fonctionnalites/vues-partagees/#en-kilde-for-andre-databaser), på denne instansen eller en annen |

**Ny synkronisert tabell** velger kilden og intervallet – fra hvert 15. minutt til én
gang om dagen; **Synkroniser** leser den på nytt med en gang. Hver runde oppretter, endrer og
sletter det som trengs for at tabellen skal ligne kilden, og orienterer seg etter et felt
**Synkroniseringsnøkkel**. All denne skrivingen går gjennom historikken.

**Stopp** synkroniseringen, så blir tabellen vanlig: radene blir værende, og kan skrives til
for hånd igjen.

## Begrensninger

- En kilde leses innenfor en grense på 5 MB, 10 000 rader og 10 sekunder.
- En kilde som feiler, sletter ingenting: tabellen beholder radene sine til neste runde.
- En kolonne som dukker opp i kilden etter opprettelsen, legges ikke til.
- Slack kobles til via innkommende webhook, ennå ikke via en Slack-app.

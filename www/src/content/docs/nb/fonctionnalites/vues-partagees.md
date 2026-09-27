---
title: Delte visninger
description: Vis en visning skrivebeskyttet med en lenke, bygg den inn på et nettsted, abonner på en kalender.
---

En datavisning – rutenett, kanban, kalender, tidslinje, galleri, liste – kan **deles
skrivebeskyttet**: en lenke `/v/<jeton>` viser den til dem som ikke kan åpne basedb, uten å
tillate noen skriving. Det er motstykket til [delte skjemaer](/basedb/nb/fonctionnalites/formulaires-partages/),
som lar folk svare uten å la dem lese noe. Et [instrumentbord](/basedb/nb/fonctionnalites/tableaux-de-bord/#del-et-instrumentbord)
deles på samme måte.

## Del

Visningens meny → **Del…**, og deretter:

| Tilgang | Hvem som leser |
|---|---|
| **Offentlig** | alle som har lenken, uten konto |
| **Innloggede medlemmer** | et medlem av arbeidsområdet, etter innlogging – ved behov bare fra bestemte grupper |

![Deling av en kalender](../../../../assets/screens/partage-vue.png)

Bryteren **Aktiv lenke** stanser lenken uten at den går tapt. Siden åpnes utenfor
applikasjonen: ingen sidepanel, intet databasenavn, intet tabellnavn – visningen, filtrene,
kolonnene, og ingenting annet. En kalender eller en tidslinje leses der som en kalenderapp.

![Den samme kalenderen, åpnet via lenken](../../../../assets/screens/vue-partagee.png)

## Hvem det leses på vegne av

Visningen leses med **tillatelsene til personen som publiserte den**, vurdert på nytt ved hver lesing:
et felt som er skjult for vedkommende, vises ikke, og hvis personen mister tilgangen til tabellen, slutter lenken
å vise noe som helst.

## Bygg inn på et annet nettsted

Kryss av for **Tillat innbygging på et annet nettsted**: dialogen gir en **innbyggingskode**
`<iframe>`, som du limer inn i et intranett, en wiki eller et presentasjonsnettsted. Uten denne
avkrysningen nekter siden å bli vist i en ramme på et annet nettsted.

## En kalender i kalenderappen din

For en kalender eller en tidslinje som er delt **offentlig**, gir dialogen **adressen til
kalenderstrømmen**: en iCalendar-strøm (`…/calendar.ics`, høyst 1 000 hendelser) som
Google Kalender, Outlook eller Apple Calendar kan abonnere på. Teamets frister vises
i kalenderen til hver enkelt, og følger tabellen.

## En kilde for andre databaser

En offentlig lenke gir også **visningens API-adresse**: radene den viser, i
JSON. En [synkronisert tabell](/basedb/nb/integrations/synchronisation/) – på denne instansen eller
en annen – kan bruke den som kilde.

## Begrensninger

- Lesing er begrenset til 120 forespørsler per minutt, per adresse og per lenke.
- Et skjema deles ikke for lesing: det deles [for å motta svar](/basedb/nb/fonctionnalites/formulaires-partages/).

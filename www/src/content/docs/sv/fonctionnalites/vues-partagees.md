---
title: Delade vyer
description: Visa en vy skrivskyddad via en länk, bädda in den på en webbplats, prenumerera på en kalender.
---

En datavy – rutnät, kanban, kalender, tidslinje, galleri, lista – kan **delas skrivskyddad**: en
länk `/v/<jeton>` visar den för den som inte kan öppna basedb, utan att något kan skrivas. Det är
motsvarigheten till [delade formulär](/basedb/sv/fonctionnalites/formulaires-partages/), som låter
någon svara utan att kunna läsa något. En [instrumentpanel](/basedb/sv/fonctionnalites/tableaux-de-bord/#dela-en-instrumentpanel)
delas på samma sätt.

## Dela

Vyns meny → **Dela…**, och sedan:

| Åtkomst | Vem läser |
|---|---|
| **Offentlig** | alla som har länken, utan konto |
| **Inloggade medlemmar** | en medlem i arbetsytan, efter inloggning – vid behov bara i vissa grupper |

![Delning av en kalender](../../../../assets/screens/partage-vue.png)

Reglaget **Aktiv länk** pausar länken utan att den går förlorad. Sidan öppnas utanför
programmet: inget sidofält, inget databasnamn, inget tabellnamn – vyn, dess filter, dess
kolumner och inget annat. En kalender eller en tidslinje läses där som en vanlig kalender.

![Samma kalender, öppnad via sin länk](../../../../assets/screens/vue-partagee.png)

## I vems namn man läser

Vyn läses med **behörigheterna hos den som publicerade den**, som prövas på nytt vid varje
läsning: ett fält som är dolt för hen visas inte, och förlorar hen åtkomsten till tabellen
slutar länken att visa något alls.

## Bädda in på en annan webbplats

Kryssa i **Tillåt inbäddning på en annan webbplats**: dialogen ger dig en **inbäddningskod**
`<iframe>` att klistra in på ett intranät, en wiki eller en presentationssajt. Utan den rutan
vägrar sidan att visas i en ram på en annan webbplats.

## En kalender i din kalenderapp

För en kalender eller en tidslinje som delas **offentligt** ger dialogen **adressen till
kalenderflödet**: ett iCalendar-flöde (`…/calendar.ics`, högst 1 000 händelser) som Google
Kalender, Outlook eller Apple Kalender kan prenumerera på. Teamets förfallodatum dyker upp i
allas kalendrar och följer tabellen.

## En källa för andra databaser

En offentlig länk ger också **adressen till vyns API**: raderna som den visar, i JSON. En
[synkroniserad tabell](/basedb/sv/integrations/synchronisation/) – på den här instansen eller en
annan – kan använda den som källa.

## Begränsningar

- Läsningen är begränsad till 120 förfrågningar per minut, per adress och per länk.
- Ett formulär delas inte för läsning: det delas [för att ta emot svar](/basedb/sv/fonctionnalites/formulaires-partages/).

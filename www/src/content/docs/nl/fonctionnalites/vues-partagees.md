---
title: Gedeelde weergaven
description: Een weergave alleen-lezen tonen via een link, haar in een site insluiten, je abonneren op een kalender.
---

Een gegevensweergave — raster, kanban, kalender, tijdlijn, galerie, lijst — wordt **alleen-lezen
gedeeld**: een link `/v/<jeton>` toont haar aan wie basedb niet kan openen, zonder dat er iets
geschreven kan worden. Het is de tegenhanger van [gedeelde formulieren](/basedb/nl/fonctionnalites/formulaires-partages/),
waarmee je kunt antwoorden zonder iets te kunnen lezen. Een [dashboard](/basedb/nl/fonctionnalites/tableaux-de-bord/#een-dashboard-delen)
deel je op dezelfde manier.

## Delen

Menu van de weergave → **Delen…**, daarna:

| Toegang | Wie leest |
|---|---|
| **Openbaar** | iedereen met de link, zonder account |
| **Ingelogde leden** | een lid van de werkruimte, na inloggen — desgewenst alleen van bepaalde groepen |

![Het delen van een kalender](../../../../assets/screens/partage-vue.png)

De schakelaar **Link actief** schort de link op zonder hem kwijt te raken. De pagina opent buiten
de applicatie: geen zijbalk, geen databasenaam, geen tabelnaam — de weergave, haar filters, haar
kolommen, en verder niets. Een kalender of een tijdlijn lees je er als een agenda.

![Dezelfde kalender, geopend via zijn link](../../../../assets/screens/vue-partagee.png)

## Namens wie er gelezen wordt

De weergave wordt gelezen met de **rechten van de persoon die haar heeft gepubliceerd**, bij elke leesactie opnieuw bepaald:
een veld dat voor die persoon verborgen is, wordt niet getoond, en als die persoon de toegang tot de tabel verliest, toont de link
niets meer.

## In een andere site insluiten

Vink **Insluiten in een andere site toestaan** aan: het dialoogvenster geeft een **insluitcode**
`<iframe>`, om te plakken in een intranet, een wiki, een bedrijfswebsite. Zonder dit
vakje weigert de pagina om in het frame van een andere site te worden getoond.

## Een kalender in je agenda

Voor een kalender of een tijdlijn die **openbaar** is gedeeld, geeft het dialoogvenster het **adres van de
agendafeed**: een iCalendar-feed (`…/calendar.ics`, hooguit 1 000 gebeurtenissen) waarop
Google Agenda, Outlook of Apple Calendar zich abonneren. De deadlines van het team verschijnen
in ieders agenda, en volgen de tabel.

## Een bron voor andere databases

Een openbare link geeft ook het **API-adres van de weergave**: de rijen die ze toont, in
JSON. Een [gesynchroniseerde tabel](/basedb/nl/integrations/synchronisation/) — op deze instantie of
een andere — kan haar als bron gebruiken.

## Beperkingen

- Het lezen is beperkt tot 120 verzoeken per minuut, per adres en per link.
- Een formulier wordt niet gedeeld om te lezen: het wordt gedeeld [om antwoorden te ontvangen](/basedb/nl/fonctionnalites/formulaires-partages/).

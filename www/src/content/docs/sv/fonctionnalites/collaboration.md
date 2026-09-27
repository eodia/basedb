---
title: Samarbete
description: Kommentarer och omnämnanden, aviseringar, uppdateringar i realtid och närvaro.
---

Flera personer arbetar i samma databas samtidigt: var och en ser de andras skrivningar komma in,
vet vem som tittar på vad och diskuterar en rad där den finns.

## Kommentarer

En rads raddetaljer har en flik **Kommentarer**, mellan ”Detaljer” och ”Historik”. Skriv `@` för
att **nämna** en medlem och Ctrl+Enter för att skicka. Var och en kan redigera eller ta bort sina
egna kommentarer.

![En konversation om ett projekt](../../../../assets/screens/commentaires.png)

Det räcker att kunna läsa raden för att kommentera den. En person som nämns men inte kan läsa
raden får ingen avisering – och författaren får veta det i stället för att tro att meddelandet
har gått fram.

## Aviseringar

Klockan uppe till höger räknar det som är oläst. Fyra saker hamnar där:

- någon **nämner** dig i en kommentar;
- någon **svarar** i en konversation där du har skrivit;
- någon **anger** dig i ett Person-fält – från gränssnittet, API:et, ett formulär eller en
  automatisering;
- en [automatisering](/basedb/sv/fonctionnalites/automatisations/) **aviserar** dig.

Öppnar du en avisering öppnas raden. **Markera alla som lästa** nollställer räknaren;
aviseringarna sparas i 90 dagar.

![Ett mottaget omnämnande](../../../../assets/screens/notifications.png)

## Realtid

De andras skrivningar visas **utan att sidan laddas om**: en ändrad cell, ett flyttat kort, en
tillagd rad – oavsett om de kommer från gränssnittet, API:et, en agent eller direkt SQL. Servern
skickar bara en **signal**, aldrig data: det är skärmen som läser om, med dina behörigheter. En
cell som du håller på att redigera ersätts aldrig mitt under fingrarna på dig.

## Närvaro

Ansiktena på dem som tittar på **samma tabell** visas högst upp på skärmen; de som har öppnat
**samma rad** visas i sidhuvudet i dess raddetaljer. I rutnätet syns de andras pekare på den
cell de hovrar över.

## Ångra

Ctrl+Z ångrar din senaste skrivning – se [historiken](/basedb/sv/fonctionnalites/historique/#ångra-ctrlz).

## Begränsningar

- Aviseringarna stannar i basedb: inga skickas med e-post för närvarande.
- När fler än hundra rader ändras på en gång laddar skärmen om hela sidan i stället för rad
  för rad.

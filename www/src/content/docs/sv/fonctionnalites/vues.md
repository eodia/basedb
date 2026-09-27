---
title: Vyer
description: Rutnät, kanban, kalender, tidslinje, galleri, lista, formulär och enkät – gemensamma eller personliga.
---

En tabell kan visas på **åtta sätt**. En vy kopierar inga data och ger inga fler behörigheter
än tabellen själv.

:::note
De här vyerna är sätt att visa **en** tabell. En [SQL-vy](/basedb/sv/fonctionnalites/requetes-et-vues-sql/)
är något annat: en riktig PostgreSQL-vy, skriven i SQL mot databasens tabeller och placerad
bland dem i sidofältet.
:::

| Vy | Vad den visar | Vad den behöver |
|---|---|---|
| **Rutnät** | rader, filtrerade, sorterade, grupperade, med valda kolumner | – |
| **Kanban** | kort i kolumner | ett enkelval |
| **Kalender** | rader på sitt datum, per månad eller vecka | ett datumfält |
| **Tidslinje** | staplar mellan två datum, och deras beroenden | ett startdatum |
| **Galleri** | kort, med en omslagsbild | – |
| **Lista** | en rad per post, i hopfällbara grupper | – |
| **Formulär** | en sida med frågor för att skapa en rad | – |
| **Enkät** | samma frågor, en per skärm | – |

## Vyväljaren

Den finns till vänster om ”Filtrera”. ”Alla rader” är tabellens rutnät, som ingen har sparat och
ingen kan ta bort; sedan kommer de **gemensamma vyerna**, i den ordning som den som bygger
databasen har valt, och därefter **Mina vyer**.

- En **gemensam vy** syns för alla. Att skapa, konfigurera, byta namn på, ändra ordning på
  eller ta bort den kräver nivån **Hantera**. Den kan vara **låst**: ett hänglås visar det, och
  ingen kan ändra den förrän den har låsts upp.
- En **personlig vy** syns bara för dig och kräver bara att du kan läsa tabellen.
  **Skapa personlig vy**, eller **Spara som vy** efter att du har filtrerat och sorterat: var och
  en sparar sina egna sätt att läsa, utan att ändra något för andra. **Duplicera** på en
  gemensam vy ger en personlig kopia.

![Ett galleri med kunder](../../../../assets/screens/galerie.png)

## Verktygsfältet

Ovanför rutnätet, i den här ordningen:

- **Filtrera** kombinerar villkor per fält;
- **Kolumner** väljer vad som visas – systemkolumnerna ligger för sig, under
  ”Systeminformation”;
- **Gruppera** delar in raderna efter ett fält med ett enda värde – enkelval, relation,
  person, datum, tal, text, kryssruta … – i hopfällbara grupper, var och en med sitt antal
  räknat över hela filtret;
- **Färger** färgar raderna efter ett enkelval eller efter **regler** – ett filter och en färg,
  högst tjugo – som en kantlinje, som bakgrund eller både och;
- **Radhöjd**: låg, medel, hög, mycket hög;
- **Sök…**, längst till höger, söker i alla kolumner medan du skriver; Esc tömmer sökningen.
  Den fungerar också i kanban, kalender, tidslinje, galleri och lista, och sparas aldrig i vyn.

Under varje kolumn finns en **Sammanfattning** som beräknas över alla rader i filtret, inte bara
på sidan: ifyllda, tomma, unika värden, summa, medelvärde, minimum, maximum, ikryssade rutor.

## Kanban, kalender, tidslinje

- **Kanban** ordnar korten efter ett enkelval; drar du ett kort ändras raden, och ett ”+” högst
  upp i en kolumn skapar en rad som redan har det valet. Varje kort visar en rubrik, en
  omslagsbild, de valda fälten och en **beskrivning** som citerar radens värden – ”Leverans
  planerad den `{{Date}}` för `{{Client}}`” –, skriven i vyns inställningar med knappen
  **Infoga fält**.
- **Kalendern** placerar varje rad på sitt datum, med ett eventuellt slutdatum; drar du en rad
  från en dag till en annan flyttas den.
- **Tidslinjen** ritar staplar mellan ett startdatum och ett slutdatum, grupperade efter ett
  enkelval eller en relation. Med inställningen **Beror på** – en relation från tabellen till sig
  själv – kopplar en pil varje uppgift till dem den beror på, röd när den går bakåt i tiden.

![En tidslinje med beroenden](../../../../assets/screens/chronologie.png)

![En kalender efter förfallodatum](../../../../assets/screens/calendrier.png)

## Galleri och lista

- **Galleriet** visar kort: en **omslagsbild** (beskuren eller hel), en storlek (små, medelstora,
  stora kort), en färg efter ett enkelval.
- **Listan** visar en rad per post, **grupperad** efter ett enkelval, en relation eller en
  person.

![En lista med kunder, grupperad efter bransch](../../../../assets/screens/liste.png)

I kanban, galleri och lista kan korten och raderna **ordnas för hand** genom att du drar dem –
upp till 5 000; en vald sortering har företräde framför den ordningen.

## Formulär och enkät

Du kryssar i frågorna och ordnar dem; var och en har en rubrik, en hjälptext och kan göras
obligatorisk. Formuläret har sin titel, sin introduktion, texten på sin knapp och sitt
tackmeddelande. Det fylls i inne i basedb eller [delas via en länk](/basedb/sv/fonctionnalites/formulaires-partages/).

## Dela en vy

En datavy – rutnät, kanban, kalender, tidslinje, galleri, lista – kan **delas skrivskyddad** via
en länk och bäddas in på en annan webbplats, och en kalender blir ett kalenderflöde. Se
[Delade vyer](/basedb/sv/fonctionnalites/vues-partagees/).

## Det läsaren inte ser

En vy **anpassas efter sin läsare**: ett fält som är dolt för läsaren försvinner ur kolumnerna,
korten och frågorna. En vy vars filter citerar ett dolt fält visas inte alls: utan sitt filter
skulle den visa mer än den skapades för att visa.

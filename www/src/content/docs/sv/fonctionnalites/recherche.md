---
title: Sökning
description: Ett enda fält för att hitta allt — tabeller, vyer, instrumentpaneler, rader, kommandon — och för att ställa en fråga till Copilot. Ctrl+K.
---

Fältet **Sök tabeller, rader, kommandon…**, mitt i listen högst upp, öppnar sökningen: ett
enda fält för allt du kan nå i basedb. **Ctrl+K** (**⌘K** på Mac) öppnar eller stänger den från
vilken skärm som helst — utom i en textredigerare, där den i stället lägger till en länk.

## Vad den hittar

| | |
|---|---|
| **Tabeller och objekt** | projekten och databaserna du ser; tabellerna, SQL-vyerna och sparade frågor; vyerna i den öppna databasens tabeller, personliga inräknade; frågorna, instrumentpanelerna och automatiseringarna i projektets databaser; tabellernas kolumner; öppna flikar |
| **Rader** | själva datan, i den öppna databasens tabeller: kolumnernas text, listornas val, ett exakt tal — från och med två tecken. Ett inklistrat rad-id hittar sin rad |
| **Kommandon** | det programmet kan göra: gå till strukturen, historiken, databasens instrumentpaneler; skapa en tabell, en fråga, en SQL-fråga, en databas, ett projekt, utgå från en mall; importera till en tabell; ångra eller göra om den senaste skrivningen; stänga eller byta flik; byta tema; öppna Copilot; **Kopiera länken till den här sidan**; öppna en flik i inställningarna eller administrationen; logga ut |
| **Copilot** | en fråga på naturligt språk, ställd till Copilot |

**Enter** öppnar det valda resultatet: en rad öppnas i sin tabell, på sin raddetalj. På en
stor skärm visar en panel till höger en förhandsgranskning — värdena i en rad, kolumnerna och
beskrivningen för en tabell, beskrivningen för en instrumentpanel eller en automatisering.
Klistra in en basedb-adress: **Öppna den här länken** tar dig dit (se
[en länk till varje skärm](/basedb/sv/fonctionnalites/collaboration/#en-länk-till-varje-skärm)).

Det tomma fältet erbjuder dina **senaste**, de öppna flikarna, databasens tabeller och några
förslag.

## Skriv som du tänker

- **Inga versaler krävs**: `volvo` hittar ”Volvo”.
- **Ordbörjan och initialer**: `nk` för ”Ny kund”, `nytab` för ”Ny tabell”.
- **Ett överseende med skrivfel** — en bortglömd, dubblerad, utbytt eller omkastad bokstav, två i
  ett ord på mer än sju bokstäver —, aldrig på den första bokstaven.
- **Varje skrivet ord måste hittas någonstans**, i namnet eller i det som innehåller det:
  `försäljning kunder` hittar tabellen ”Kunder” i databasen ”Försäljning”. Typen kan också
  skrivas: `vy`, `automatisering`, `instrumentpanel`.
- **En tabell, sedan det du söker i den**: `kunder göteborg` söker efter ”göteborg” i raderna i
  tabellen ”Kunder”.

Överst kommer **bästa träffen**; det du öppnar ofta och nyligen stiger upp. Det minnet finns kvar
i din webbläsare.

## Begränsa sökningen

Knapparna under fältet — **Alla**, **Tabeller och objekt**, **Rader**, **Kommandon**,
**Copilot** — begränsar vad som söks. Ett första tecken gör samma sak:

| Skriv först | För att söka |
|---|---|
| `#` | bara tabeller och objekt |
| `/` | bara rader |
| `>` | bara kommandon |
| `?` | en fråga till Copilot |

**Tab**, på en tabell eller en databas, söker **inuti** den: dess namn visas i fältet, och
sökningen gäller sedan bara dess rader, vyer, kolumner och kommandon. Det tomma fältet visar då
de tjugo senast ändrade raderna. **⌫**, med tomt fält, tar dig ur det igen; **Esc** går tillbaka
ett steg, sedan stänger.

## Fråga Copilot

Varje sökning avslutas med **Fråga Copilot: ”…”**, placerad överst när texten läses som en
fråga — den slutar med ”?”, börjar med ”hur mycket”, ”vilken”, ”visa”…, eller har fem ord eller
fler. Copilot öppnas på databasen och tar emot frågan som om du hade skrivit den själv. Den läser
strukturen, inte raderna, om du inte kryssar i **Tillåt läsning av data**, och den föreslår: inget
ändras förrän du tillämpar det. AI måste vara konfigurerad på instansen — se [Artificiell
intelligens](/basedb/sv/fonctionnalites/ia/).

## Behörigheter och begränsningar

Sökningen går via samma vägar som resten av skärmen, **med dina behörigheter**: en tabell eller
en kolumn som är stängd för dig visas inte, varken bland objekten eller i raderna.
Automatiseringar erbjuds bara till den som har nivån **Hantera** på deras databas.

- Raderna söks i den öppna databasen, eller i den databas eller tabell du gått in i med Tab: tre
  rader per tabell, på högst tjugofyra tabeller; tjugo rader i en tabell.
- Frågorna, instrumentpanelerna och automatiseringarna är de i det öppna projektet (högst åtta
  databaser), omlästa minst var annan minut.
- Varje grupp visar några resultat, sedan **N fler resultat**, som öppnar den i sin helhet.

## Tangentbordsgenvägar

**Genvägar**, längst ned i sökningen, eller kommandot **Tangentbordsgenvägar**, visar dem alla.
**Ctrl** läses **⌘** på Mac.

| Tangenter | Effekt |
|---|---|
| **Ctrl+K** | öppna eller stänga sökningen |
| **↑** **↓**, **Enter** | bläddra bland resultaten, öppna resultatet |
| **Alt+W** | stänga fliken |
| **Ctrl+Tab**, **Ctrl+Skift+Tab** | nästa flik, föregående flik |
| klick med mushjulet | stänga en flik |
| **Ctrl+A**, **Ctrl+C** | i rutnätet, markera allt, kopiera de valda cellerna |
| **Ctrl+klick** | följa en relation |
| **Ctrl+Z**, **Ctrl+Y** | ångra den senaste skrivningen, göra om den |
| **Ctrl+Enter** | skicka en kommentar, spara en beskrivning |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | i en text: fetstil, kursiv, länk |

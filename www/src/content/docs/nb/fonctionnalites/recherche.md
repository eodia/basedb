---
title: Søk
description: Ett eneste felt for å finne alt – tabeller, visninger, instrumentbord, rader, kommandoer – og for å stille et spørsmål til Copilot. Ctrl+K.
---

Feltet **Søk i tabeller, rader, kommandoer …**, midt i den øverste linjen, åpner søket: ett
eneste felt for alt du kan nå i basedb. **Ctrl+K** (**⌘K** på Mac) åpner eller lukker det fra
hvilken som helst skjerm – bortsett fra i en teksteditor, der det legger til en lenke i stedet.

## Hva den finner

| | |
|---|---|
| **Tabeller og objekter** | prosjektene og databasene du ser; tabellene, SQL-visningene og lagrede spørringer; visningene til tabellene i den åpne databasen, personlige inkludert; spørsmålene, instrumentbordene og automatiseringene til prosjektets databaser; kolonnene til tabellene; åpne faner |
| **Rader** | selve dataene, i tabellene i den åpne databasen: teksten i kolonnene, valgene i listene, et eksakt tall – fra og med to tegn. En innlimt rad-ID finner raden sin |
| **Kommandoer** | det programmet kan gjøre: gå til strukturen, historikken, instrumentbordene til databasen; opprette en tabell, et spørsmål, en SQL-spørring, en database, et prosjekt, starte fra en mal; importere til en tabell; angre eller gjenopprette siste skriving; lukke eller bytte fane; bytte tema; åpne Copilot; **Kopier lenken til denne siden**; åpne en fane i innstillingene eller administrasjonen; logge ut |
| **Copilot** | et spørsmål på naturlig språk, overlatt til Copilot |

**Enter** åpner det valgte resultatet: en rad åpnes i tabellen sin, i raddetaljene. På en stor
skjerm viser et panel til høyre en forhåndsvisning – verdiene i en rad, kolonnene og
beskrivelsen til en tabell, beskrivelsen til et instrumentbord eller en automatisering. Lim inn
en basedb-adresse: **Åpne denne lenken** fører deg dit (se
[en lenke til hver skjerm](/basedb/nb/fonctionnalites/collaboration/#en-lenke-til-hver-skjerm)).

Det tomme feltet foreslår **nylige**, de åpne fanene, tabellene i databasen og noen forslag.

## Skriv slik du tenker

- **Ingen aksenter, ingen store bokstaver**: `lindeklinikken` finner «Lindeklinikken».
- **Ordstammer og forbokstaver**: `nk` for «Ny kunde», `nytab` for «Ny tabell».
- **En skrivefeil tilgis** – en bokstav som mangler, dobles, byttes ut eller bytter plass, to
  i et ord på mer enn sju bokstaver –, aldri i den første bokstaven.
- **Hvert skrevet ord må finnes et sted**, i navnet eller i det som inneholder det:
  `lys kunder` finner tabellen «Kunder» i databasen «Atelier Lys». Typen kan også skrives:
  `visning`, `auto`, `instrumentbord`.
- **En tabell, så det du leter etter i den**: `kunder bergen` søker etter «bergen» i radene i
  tabellen «Kunder».

Øverst ligger **beste resultat**; det du åpner ofte og nylig, stiger opp. Denne hukommelsen
ligger i nettleseren din.

## Avgrens søket

Knappene under feltet – **Alle**, **Tabeller og objekter**, **Rader**, **Kommandoer**,
**Copilot** – avgrenser hva som søkes i. Det første tegnet gjør det samme:

| Skriv først | For å søke i |
|---|---|
| `#` | bare tabeller og objekter |
| `/` | bare rader |
| `>` | bare kommandoer |
| `?` | et spørsmål til Copilot |

**Tab**, på en tabell eller en database, søker **inni** den: navnet vises i feltet, og søket
gjelder da bare radene, visningene, kolonnene og kommandoene dens. Det tomme feltet viser da de
tjue radene som sist ble endret. **⌫**, med tomt felt, går ut igjen; **Esc** går ett hakk
tilbake, og lukker deretter.

## Spør Copilot

Hvert søk ender med **Spør Copilot: «…»**, plassert øverst når teksten leses som et spørsmål –
den ender med «?», begynner med «hvor mange», «hvilken», «vis»…, eller teller fem ord eller
mer. Copilot åpnes på databasen og mottar spørsmålet som om du hadde skrevet det der. Den leser
strukturen, ikke radene, med mindre du krysser av for **Tillat lesing av dataene**, og den
foreslår: ingenting endres før du bruker forslaget. KI må være satt opp på instansen – se
[Kunstig intelligens](/basedb/nb/fonctionnalites/ia/).

## Tillatelser og begrensninger

Søket går gjennom de samme rutene som resten av skjermen, **med dine tillatelser**: en tabell
eller en kolonne som er stengt for deg, vises ikke, verken blant objektene eller i radene.
Automatiseringene tilbys bare til den som har nivået **Administrere** på databasen deres.

- Radene søkes i den åpne databasen, eller i databasen eller tabellen du har gått inn i med
  Tab: tre rader per tabell, på høyst tjuefire tabeller; tjue rader i en tabell.
- Spørsmålene, instrumentbordene og automatiseringene er de i det åpne prosjektet (høyst åtte
  databaser), lest på nytt høyst hvert annet minutt.
- Hver gruppe viser noen resultater, og så **N flere resultater**, som åpner den i sin helhet.

## Tastatursnarveier

**Snarveier**, nederst i søket, eller kommandoen **Tastatursnarveier**, viser dem alle. **Ctrl**
leses **⌘** på Mac.

| Taster | Effekt |
|---|---|
| **Ctrl+K** | åpne eller lukke søket |
| **↑** **↓**, **Enter** | bla gjennom resultatene, åpne resultatet |
| **Alt+W** | lukke fanen |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | neste fane, forrige fane |
| klikk med musehjulet | lukke en fane |
| **Ctrl+A**, **Ctrl+C** | i rutenettet: velg alt, kopier de valgte cellene |
| **Ctrl+klikk** | følge en relasjon |
| **Ctrl+Z**, **Ctrl+Y** | angre siste skriving, gjenopprette den |
| **Ctrl+Enter** | sende en kommentar, lagre en beskrivelse |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | i en tekst: fet, kursiv, lenke |

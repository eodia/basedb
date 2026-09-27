---
title: Søgning
description: Ét felt til at finde alt — tabeller, visninger, dashboards, rækker, kommandoer — og til at stille et spørgsmål til Copilot. Ctrl+K.
---

Feltet **Søg efter tabeller, rækker, kommandoer…**, midt i den øverste bjælke, åbner søgningen:
ét felt til alt, du kan nå i basedb. **Ctrl+K** (**⌘K** på Mac) åbner eller lukker den fra en
hvilken som helst skærm — undtagen i en teksteditor, hvor det i stedet tilføjer et link.

## Hvad den finder

| | |
|---|---|
| **Tabeller og objekter** | de projekter og databaser, du kan se; tabellerne, SQL-views og gemte forespørgsler; visningerne af den åbne databases tabeller, personlige inklusive; spørgsmålene, dashboards og automatiseringer i projektets databaser; tabellernes kolonner; de åbne faner |
| **Rækker** | selve dataene, i den åbne databases tabeller: kolonnernes tekst, listevalgene, et præcist tal — fra to tegn. Et indsat række-id finder dens række |
| **Kommandoer** | det, applikationen kan gøre: gå til strukturen, historikken, databasens dashboards; oprette en tabel, et spørgsmål, en SQL-forespørgsel, en database, et projekt, starte fra en skabelon; importere i en tabel; fortryde eller genoprette den seneste skrivning; lukke eller skifte fane; skifte tema; åbne Copilot; **Kopiér linket til denne side**; åbne en fane under indstillinger eller administration; logge ud |
| **Copilot** | et spørgsmål på naturligt sprog, overladt til Copilot |

**Enter** åbner det valgte resultat: en række åbnes i sin tabel, på sin rækkedetalje. På en stor
skærm viser et panel til højre en forhåndsvisning — en rækkes værdier, en tabels kolonner og
beskrivelse, beskrivelsen af et dashboard eller en automatisering. Sæt en basedb-adresse ind:
**Åbn dette link** fører dig derhen (se
[et link til hver skærm](/basedb/da/fonctionnalites/collaboration/#et-link-til-hver-skærm)).

Det tomme felt foreslår dine **seneste**, de åbne faner, databasens tabeller og nogle forslag.

## Skriv som du tænker

- **Ingen forskel på store og små bogstaver**: `salg` finder »Salg«.
- **Begyndelser af ord og forbogstaver**: `nk` for »Ny kunde«, `nytab` for »Ny tabel«.
- **En tastefejl bliver tilgivet** — et glemt, fordoblet, erstattet eller byttet bogstav, to i et
  ord på mere end syv bogstaver —, aldrig på det første bogstav.
- **Hvert indtastet ord skal findes et sted**, i navnet eller i det, der indeholder det:
  `salg kunder` finder tabellen »Kunder« i databasen »Salg«. Typen skrives også: `visning`,
  `automatisering`, `dashboard`.
- **En tabel, og så det, man søger i den**: `kunder aarhus` søger efter »aarhus« i rækkerne i
  tabellen »Kunder«.

Øverst, **det bedste resultat**; det, du åbner ofte og for nylig, rykker op. Denne hukommelse
bliver i din browser.

## Afgræns søgningen

Knapperne under feltet — **Alle**, **Tabeller og objekter**, **Rækker**, **Kommandoer**,
**Copilot** — afgrænser det, der søges i. Det samme gør et første tegn:

| Skriv først | For at søge |
|---|---|
| `#` | kun tabeller og objekter |
| `/` | kun rækker |
| `>` | kun kommandoer |
| `?` | et spørgsmål til Copilot |

**Tab**, på en tabel eller en database, søger **i den**: dens navn vises i feltet, og søgningen
omfatter herefter kun dens rækker, visninger, kolonner og kommandoer. Det tomme felt viser da de
tyve sidst ændrede rækker. **⌫**, det tomme felt, går ud igen; **Esc** går et trin tilbage og
lukker derefter.

## Spørg Copilot

Hver søgning slutter med **Spørg Copilot: »…«**, placeret øverst, når teksten læses som et
spørgsmål — den slutter med »?«, begynder med »hvor mange«, »hvilken«, »vis«… eller tæller fem
ord eller mere. Copilot åbner på databasen og modtager spørgsmålet, som havde du selv skrevet
det. Det læser strukturen, ikke rækkerne, medmindre du markerer **Tillad læsning af data**, og
det foreslår: intet ændres, før du anvender det. AI skal være konfigureret på instansen — se
[Kunstig intelligens](/basedb/da/fonctionnalites/ia/).

## Tilladelser og begrænsninger

Søgningen går gennem de samme ruter som resten af skærmen, **med dine tilladelser**: en tabel
eller en kolonne, der er lukket for dig, vises ikke, hverken blandt objekterne eller i rækkerne.
Automatiseringer tilbydes kun til dem, der har niveauet **Administrere** på deres database.

- Rækkerne søges i den åbne database, eller i den database eller tabel, du er gået ind i med Tab:
  tre rækker pr. tabel, på højst fireogtyve tabeller; tyve rækker i en tabel.
- Spørgsmålene, dashboards og automatiseringer er dem i det åbne projekt (højst otte databaser),
  genlæst højst hvert andet minut.
- Hver gruppe viser nogle få resultater, derefter **N andre resultater**, som åbner den helt.

## Tastaturgenveje

**Genveje**, nederst i søgningen, eller kommandoen **Tastaturgenveje**, viser dem alle. **Ctrl**
læses **⌘** på Mac.

| Taster | Effekt |
|---|---|
| **Ctrl+K** | åbne eller lukke søgningen |
| **↑** **↓**, **Enter** | gennemse resultaterne, åbne resultatet |
| **Alt+W** | lukke fanen |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | næste fane, forrige fane |
| klik med musehjulet | lukke en fane |
| **Ctrl+A**, **Ctrl+C** | i gitteret, vælge alt, kopiere de valgte celler |
| **Ctrl+klik** | følge en relation |
| **Ctrl+Z**, **Ctrl+Y** | annullere den seneste skrivning, genoprette den |
| **Ctrl+Enter** | sende en kommentar, gemme en beskrivelse |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | i en tekst: fed, kursiv, link |

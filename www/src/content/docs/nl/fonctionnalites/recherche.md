---
title: Zoeken
description: Eén enkel veld om alles te vinden — tabellen, weergaven, dashboards, rijen, opdrachten — en om een vraag aan de Copilot te stellen. Ctrl+K.
---

Het veld **Zoek tabellen, rijen, opdrachten…**, in het midden van de bovenste balk, opent de
zoekfunctie: één enkel veld voor alles wat je in basedb kunt bereiken. **Ctrl+K**
(**⌘K** op Mac) opent of sluit het vanaf elk scherm — behalve in een teksteditor, waar het een
link toevoegt.

## Wat de zoekfunctie vindt

| | |
|---|---|
| **Tabellen en objecten** | de projecten en de databases die je ziet; de tabellen, SQL-views en opgeslagen query’s; de weergaven van de tabellen van de geopende database, persoonlijke inbegrepen; de vragen, dashboards en automatiseringen van de databases van het project; de kolommen van de tabellen; de open tabbladen |
| **Rijen** | de gegevens zelf, in de tabellen van de geopende database: de tekst van de kolommen, de keuzes van de lijsten, een exact getal — vanaf twee tekens. Een geplakt rij-ID vindt zijn rij |
| **Opdrachten** | wat de applicatie kan: naar de structuur, de geschiedenis, de dashboards van de database gaan; een tabel, een vraag, een SQL-query, een database, een project aanmaken, starten vanuit een sjabloon; importeren in een tabel; de laatste schrijfactie ongedaan maken of herstellen; een tabblad sluiten of wisselen; van thema wisselen; de Copilot openen; **Link van deze pagina kopiëren**; een tabblad van de instellingen of het beheer openen; uitloggen |
| **Copilot** | een vraag in natuurlijke taal, toevertrouwd aan de Copilot |

**Enter** opent het gekozen resultaat: een rij opent in zijn tabel, op zijn fiche. Op een groot
scherm toont een paneel rechts de voorvertoning ervan — de waarden van een rij, de kolommen en de
beschrijving van een tabel, de beschrijving van een dashboard of een automatisering. Plak een
adres van basedb: **Deze link openen** brengt je erheen (zie
[een link naar elk scherm](/basedb/nl/fonctionnalites/collaboration/#een-link-naar-elk-scherm)).

Het lege veld biedt je **recente items** aan, de open tabbladen, de tabellen van de database en
enkele suggesties.

## Typ zoals je denkt

- **Geen accenten of hoofdletters nodig**: `zorg` vindt “Zorg”.
- **Woordbegin en initialen**: `nd` voor “Nieuwe database”, `nieuwtab` voor “Nieuwe tabel”.
- **Eén typefout wordt vergeven** — een vergeten, verdubbelde, vervangen of omgewisselde letter,
  twee in een woord van meer dan zeven letters —, nooit op de eerste letter.
- **Elk getypt woord moet ergens terug te vinden zijn**, in de naam of in wat hem bevat:
  `atelier klanten` vindt de tabel “Klanten” van de database “Atelier Lumen”. Het soort typ je ook
  in: `weergave`, `automatisering`, `dashboard`.
- **Eerst een tabel, dan wat je erin zoekt**: `klanten utrecht` zoekt “Utrecht” in de rijen van de
  tabel “Klanten”.

Bovenaan staat het **beste resultaat**; wat je vaak en recent hebt geopend, komt naar boven. Dat
geheugen blijft in je browser.

## De zoekopdracht beperken

De knoppen onder het veld — **Alles**, **Tabellen en objecten**, **Rijen**, **Opdrachten**,
**Copilot** — beperken wat er wordt doorzocht. Een eerste teken doet hetzelfde:

| Typ eerst | Om te zoeken naar |
|---|---|
| `#` | alleen de tabellen en objecten |
| `/` | alleen de rijen |
| `>` | alleen de opdrachten |
| `?` | een vraag aan de Copilot |

**Tab**, op een tabel of een database, zoekt **erbinnen**: zijn naam verschijnt in het veld, en de
zoekopdracht gaat dan alleen nog over zijn rijen, zijn weergaven, zijn kolommen en zijn
opdrachten. Het lege veld toont dan de twintig meest recent gewijzigde rijen. **⌫**, bij een leeg
veld, gaat er weer uit; **Esc** gaat een stap terug, en sluit daarna.

## Aan de Copilot vragen

Elke zoekopdracht eindigt met **Aan de Copilot vragen: “…”**, vooraan geplaatst als de tekst
klinkt als een vraag — hij eindigt op “?”, begint met “hoeveel”, “welke”, “toon”…, of telt vijf
woorden of meer. De Copilot opent op de database en ontvangt de vraag alsof je ze had getypt. Hij
leest de structuur, niet de rijen, tenzij je **Lezen van gegevens toestaan** aanvinkt, en hij doet
voorstellen: er verandert niets voordat je ze toepast. De AI moet op de instantie geconfigureerd
zijn — zie [Kunstmatige intelligentie](/basedb/nl/fonctionnalites/ia/).

## Rechten en beperkingen

De zoekfunctie gaat via dezelfde routes als de rest van het scherm, **met jouw rechten**: een
tabel of een kolom die voor jou gesloten is, verschijnt niet, niet tussen de objecten en niet in
de rijen. Automatiseringen worden alleen voorgesteld aan wie het niveau **Beheren** heeft op hun
database.

- De rijen worden gezocht in de geopende database, of in de database of de tabel waar je via Tab
  in bent gegaan: drie rijen per tabel, op hooguit vierentwintig tabellen; twintig rijen in een
  tabel.
- De vragen, dashboards en automatiseringen zijn die van het geopende project (hooguit acht
  databases), hooguit elke twee minuten opnieuw gelezen.
- Elke groep toont enkele resultaten, en daarna **N andere resultaten**, dat hem volledig opent.

## Toetsenbordsneltoetsen

**Sneltoetsen**, onderaan de zoekfunctie, of de opdracht **Toetsenbordsneltoetsen**, toont ze
allemaal. **Ctrl** wordt **⌘** op Mac.

| Toetsen | Effect |
|---|---|
| **Ctrl+K** | de zoekfunctie openen of sluiten |
| **↑** **↓**, **Enter** | door de resultaten bladeren, het resultaat openen |
| **Alt+W** | het tabblad sluiten |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | volgend tabblad, vorig tabblad |
| muiswielklik | een tabblad sluiten |
| **Ctrl+A**, **Ctrl+C** | in het raster, alles selecteren, de gekozen cellen kopiëren |
| **Ctrl+klik** | een relatie volgen |
| **Ctrl+Z**, **Ctrl+Y** | de laatste schrijfactie ongedaan maken, herstellen |
| **Ctrl+Enter** | een opmerking versturen, een beschrijving opslaan |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | in een tekst: vet, cursief, link |

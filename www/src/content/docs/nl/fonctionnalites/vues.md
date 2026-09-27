---
title: Weergaven
description: Raster, kanban, kalender, tijdlijn, galerie, lijst, formulier en enquête — gezamenlijk of persoonlijk.
---

Een tabel laat zich op **acht manieren** tonen. Een weergave kopieert geen gegevens, en geeft geen enkel recht
meer dan de tabel zelf.

:::note
Deze weergaven zijn manieren om **één** tabel te tonen. Een [SQL-view](/basedb/nl/fonctionnalites/requetes-et-vues-sql/)
is iets anders: een echte PostgreSQL-view, in SQL geschreven op de tabellen van de database, en daartussen
geplaatst in de zijbalk.
:::

| Weergave | Wat ze toont | Wat ze nodig heeft |
|---|---|---|
| **Raster** | rijen, gefilterd, gesorteerd, gegroepeerd, met gekozen kolommen | — |
| **Kanban** | kaarten in kolommen | een enkele keuze |
| **Kalender** | rijen op hun datum, per maand of per week | een datumveld |
| **Tijdlijn** | balken tussen twee datums, en hun afhankelijkheden | een startdatum |
| **Galerie** | kaarten, met een omslagafbeelding | — |
| **Lijst** | één regel per record, in inklapbare groepen | — |
| **Formulier** | een pagina met vragen om een rij aan te maken | — |
| **Enquête** | dezelfde vragen, één per scherm | — |

## De weergavekiezer

Die staat links van “Filteren”. “Alle rijen” is het raster van de tabel, dat niemand
heeft opgeslagen en niemand kan verwijderen; daarna komen de **gezamenlijke weergaven**, in
de volgorde die de bouwer van de database heeft gekozen, en dan **Mijn weergaven**.

- Een **gezamenlijke weergave** ziet iedereen. Haar maken, instellen, hernoemen,
  herordenen of verwijderen vraagt het niveau **Beheren**. Ze kan **vergrendeld** zijn: een
  hangslot geeft dat aan, en niemand wijzigt haar meer voordat ze is ontgrendeld.
- Een **persoonlijke weergave** zie alleen jij, en vraagt alleen dat je de tabel mag lezen.
  **Persoonlijke weergave maken**, of **Opslaan als weergave** na filteren en sorteren:
  iedereen bewaart zijn eigen manieren van lezen, zonder iets te veranderen voor de anderen. **Dupliceren** van een
  gezamenlijke weergave maakt er een persoonlijke kopie van.

![Een galerie met klanten](../../../../assets/screens/galerie.png)

## De werkbalk

Boven het raster, in deze volgorde:

- **Filteren** combineert voorwaarden per veld;
- **Kolommen** kiest wat er getoond wordt — de systeemkolommen staan apart, onder
  “Systeeminformatie”;
- **Groeperen** deelt de rijen in op een veld met één waarde — enkele keuze, relatie,
  persoon, datum, getal, tekst, selectievakje… — in inklapbare groepen, elk met zijn
  aantal over het hele filter;
- **Kleuren** kleurt de rijen volgens een enkele keuze, of volgens **regels** — een filter en
  een kleur, hooguit twintig — als streep, als achtergrond, of allebei;
- **Rijhoogte**: kort, gemiddeld, hoog, extra hoog;
- **Zoeken…**, rechts, zoekt in alle kolommen terwijl je typt; Esc
  wist de zoekopdracht. Die geldt ook voor de kanban, de kalender, de tijdlijn, de galerie
  en de lijst, en wordt nooit in de weergave opgeslagen.

Onder elke kolom een **Samenvatting**, berekend over alle rijen van het filter, niet alleen over
de pagina: gevuld, leeg, unieke waarden, som, gemiddelde, minimum, maximum, aangevinkte vakjes.

## Kanban, kalender, tijdlijn

- De **kanban** deelt de kaarten in volgens een enkele keuze; een kaart slepen wijzigt de rij,
  een “+” boven een kolom maakt een rij aan die die keuze al heeft. Elke kaart toont een
  titel, een omslagafbeelding, de gekozen velden, en een **beschrijving** die de
  waarden van de rij citeert — “Levering gepland op `{{Date}}` voor `{{Client}}`” —, geschreven in de
  instellingen van de weergave met de knop **Veld invoegen**.
- De **kalender** plaatst elke rij op haar datum, eventueel met een einddatum; een
  rij van de ene dag naar de andere slepen verschuift haar.
- De **tijdlijn** tekent balken tussen een startdatum en een einddatum, gegroepeerd op
  een enkele keuze of een relatie. Met de instelling **Afhankelijk van** — een relatie van de tabel
  naar zichzelf — verbindt een pijl elke taak met de taken waarvan ze afhangt, rood wanneer die
  terug in de tijd gaat.

![Een tijdlijn met haar afhankelijkheden](../../../../assets/screens/chronologie.png)

![Een kalender op vervaldatum](../../../../assets/screens/calendrier.png)

## Galerie en lijst

- De **galerie** toont kaarten: een **omslagafbeelding** (bijgesneden of volledig), een
  formaat (kleine, middelgrote, grote kaarten), een kleur volgens een enkele keuze.
- De **lijst** toont één regel per record, **gegroepeerd** op een enkele keuze, een
  relatie of een persoon.

![Een lijst met klanten, gegroepeerd op sector](../../../../assets/screens/liste.png)

In de kanban, de galerie en de lijst **orden je de kaarten en regels met de hand** door ze
te slepen — tot 5 000; een gekozen sortering gaat voor op deze volgorde.

## Formulier en enquête

Je vinkt de vragen aan en zet ze in volgorde; elke vraag heeft een titel, een hulptekst, en kan
verplicht worden gemaakt. Het formulier heeft een titel, een introductie, het label van de knop en een
bedankbericht. Het wordt ingevuld in basedb, of [via een link gedeeld](/basedb/nl/fonctionnalites/formulaires-partages/).

## Een weergave delen

Een gegevensweergave — raster, kanban, kalender, tijdlijn, galerie, lijst — wordt **alleen-lezen
gedeeld** via een link, kan in een andere site worden ingesloten, en een kalender wordt een
agendafeed. Zie [Gedeelde weergaven](/basedb/nl/fonctionnalites/vues-partagees/).

## Wat de lezer niet ziet

Een weergave wordt **opnieuw geprojecteerd voor haar lezer**: een veld dat voor hem verborgen is, verdwijnt uit de
kolommen, de kaarten en de vragen. Een weergave waarvan het filter een verborgen veld citeert, wordt helemaal niet
getoond: zonder haar filter zou ze meer laten zien dan waarvoor ze is gemaakt.

---
title: Dashboards
description: Vragen gesteld met de muis of in SQL, vijftien manieren om ze te tonen en in te stellen, dashboards in een raster, in tabbladen, onder gemeenschappelijke filters — gelezen met ieders eigen rechten, en gedeeld via een link.
---

Een **dashboard** brengt op één pagina samen waar een team elke dag naar kijkt: de
cijfers die ertoe doen, hun verloop maand na maand, de verdeling van een status, de
komende deadlines. Elke kaart toont er een **vraag** — een leesactie op de database,
gebouwd met de muis of geschreven in SQL — en **filters** bovenaan de pagina sturen de
kaarten aan die eraan gekoppeld zijn.

![Het dashboard “Pilotage de l’agence”: trend van de maand, doel, gestapelde omzet, sentiment van de reviews](../../../../assets/screens/tableaux-de-bord.png)

Alles opent via **Dashboards**, in het blok van de geopende database onderaan de
zijbalk. Links staan de dashboards en de opgeslagen vragen van de database, en
**Gegevens verkennen** om een vraag te stellen zonder iets op te slaan. Iedere lezer van de database
kan ze bekijken en verkennen; aanmaken, wijzigen en opslaan vraagt het niveau **Beheren**.

## Een vraag stellen met de muis

Een vraag bouw je in stappen, onder elkaar:

![De editor van een vraag: de gegevens, de filters, de samenvatting per maand](../../../../assets/screens/question-editeur.png)

| Stap | Wat je er kiest |
|---|---|
| **Gegevens** | de starttabel, en de kolommen die getoond worden als er niets wordt samengevat |
| **Gegevens koppelen** | een andere tabel van de database, gekoppeld via een relatie — vanzelf voorgesteld — of via twee kolommen van dezelfde soort; left join, inner join, right join of full join |
| **Filter** | per kolom, met wat het type ervan aanbiedt: is / is niet, bevat, tussen, leeg…; voor een datum een **periode**: vandaag, de afgelopen 30 dagen, deze maand, het vorige kwartaal, van … tot …; of een expressie geschreven zoals in de balk van de weergaven |
| **Samenvatten** | maten — aantal rijen, som, gemiddelde, mediaan, minimum, maximum, unieke waarden, standaardafwijking, cumulatieven — **per** één tot drie kolommen |
| **Sorteren**, **Beperken** | de volgorde van de rijen, en hoeveel er maximaal |

Een datum groepeer je **per dag, week, maand, kwartaal of jaar**, of per rang — dag van de
week, maand van het jaar, uur van de dag; een getal in klassen. Een meerkeuzeveld
telt elke rij mee bij elk van haar keuzes. Periodes worden gelezen in jouw tijdzone en de
week begint op de dag uit je instellingen.

**Visualiseren** voert de vraag uit. Het resultaat wordt getoond op de manier die erbij past — een
getal, een lijn, staven, een tabel — en dat verander je onderaan het scherm:

| Visualisatie | Om te tonen |
|---|---|
| **Getal**, **Trend**, **Voortgang**, **Meter** | een waarde; de laatste periode tegenover de vorige en dezelfde periode vorig jaar; de voortgang naar een doel |
| **Kolommen**, **Staven**, **Lijn**, **Vlakken**, **Combinatie** | maten langs een dimensie, in reeksen naast elkaar, gestapeld of tot 100 % |
| **Cirkel**, **Trechter** | aandelen, stappen |
| **Spreidingsdiagram** | twee maten tegen elkaar, een derde als grootte |
| **Tabel**, **Draaitabel** | de rijen, sorteerbaar; de rijen volgens de ene dimensie, de kolommen volgens een andere, met hun totalen |
| **Landkaart** | de regio’s of departementen van Frankrijk, of de landen, gekleurd volgens een waarde; of punten op breedte- en lengtegraad |

**Instellingen** bepaalt wat er getoond wordt, en het resultaat kun je downloaden als **CSV**.

### Een grafiek aanpassen

| Visualisatie | Wat **Instellingen** biedt |
|---|---|
| **Staven, lijnen, vlakken, combinatie** | de kleur en naam van elke reeks; het stapelen, met het totaal boven de stapels; de breedte van de staven; vloeiende lijnen of trappen, met of zonder punten; de volgorde van de categorieën; de titels van de assen, de schaalverdeling, de hoek van de labels, de grenzen, een logaritmische schaal; de waarden op de grafiek; een doel |
| **Cirkel** | een ring en de dikte ervan, een halve cirkel, een roos; het totaal in het midden; het aantal segmenten vóór “Overige”; de kleur en naam van elk segment; de labels op de segmenten of ernaast; de plaats van de legenda |
| **Trechter** | de kleur en naam van elke stap, hun volgorde |
| **Getal, trend, voortgang, meter** | de kleur, kleuren volgens de waarde, een bijschrift onder het getal, de vergelijking — en of een daling goed nieuws is |
| **Tabel, draaitabel** | kolommen hernoemen en herordenen, balken in de cellen, kleuren volgens de waarde — per cel of per rij —, de dichtheid, de rijen per pagina, de rijnummers, de totalen |
| **Landkaart** | de kleurtint, de namen van de regio’s |

Voor alle: de getalnotatie — decimalen, voor- en achtervoegsel, afgekort als `1,2 k`.

## Verkennen met één klik

Een klik op een staaf, een punt of een segment opent wat het voorstelt:

- **Deze rijen bekijken**: de rijen achter het punt, gefilterd op wat het voorstelt;
- **Per week uitsplitsen**: een periode geopend op een fijnere — een jaar in zijn
  kwartalen, een maand in zijn weken;
- **Verdelen per…**: dezelfde maat, voor dit punt, volgens een andere kolom;
- **Alleen deze waarde**, **Deze waarde uitsluiten**.

Elke stap is een aparte vraag, die je kunt opslaan als je wilt; de terugpijl gaat
naar de vorige stap. Een rij van een tabel opent haar rijdetails.

Op een dashboard biedt dezelfde klik ook **Dashboard filteren: “Lyon”**, met het
aantal betrokken kaarten: een **tijdelijk** filter, nooit opgeslagen, gestippeld weergegeven
in de filterbalk en met één klik te verwijderen, dat geldt voor elke kaart waarvan de vraag
dezelfde kolom leest — via haar tabel of via een koppeling. Het wordt alleen aangeboden als er nog geen filter
van het dashboard aan die kolom op de kaart is gekoppeld, en blijft grijs (“enige kaart”) als
geen andere kaart haar leest. SQL-vragen houden er geen rekening mee.

## Een vraag in SQL schrijven

Een **SQL-vraag** is een `SELECT` op de tabellen van de database, onder hun echte naam. Ze
wordt **alleen-lezen uitgevoerd, met je eigen rechten** — voor iedereen, beheerders
inbegrepen: een tabel die voor jou gesloten is, bestaat niet, een verborgen veld wordt geweigerd, en een
schrijfactie is onmogelijk. Om een query gewoon onder de tabellen op te bergen, zonder grafiek, of
er een echte PostgreSQL-view van te maken, zie [Query’s en SQL-views](/basedb/nl/fonctionnalites/requetes-et-vues-sql/).

Een **variabele** schrijf je als `{{nom}}`; een deel dat moet wegvallen als het geen waarde heeft, tussen
`[[` en `]]`:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Een variabele is een tekst, een getal, een datum — of een **kolomfilter**: `{{periode}}`
wordt dan een volledige voorwaarde op de gekozen kolom, hier `echeance`, of `TRUE` als er niets
is gekozen. Zo kan een filter van het dashboard een SQL-vraag aansturen
net als de andere.

## Een dashboard inrichten

**Bewerken** zet het dashboard in bewerkmodus:

- **Vraag** plaatst een opgeslagen vraag, of maakt er een die alleen bij de kaart hoort;
- **Titel** en **Tekst** voegen een sectietitel of een tekst in Markdown toe;
- **Ingesloten pagina** toont een `https://`-adres in een geïsoleerd frame, dat geen
  sessie en geen gegevens ontvangt;
- **Tabblad** verdeelt de kaarten over meerdere pagina’s; dubbelklikken hernoemt een tabblad.

De kaarten verplaats je met hun sleepgreep en vergroot of verklein je via hun hoek, op een raster van
24 kolommen. **Opslaan** bewaart het geheel; **Annuleren** gaat terug naar de vorige versie. Een
kaarttitel opent, in leesmodus, de vraag om haar te verkennen, met de filters van het dashboard.

## Filters

**Filter** voegt bovenaan het dashboard een bedieningselement toe: een **datum** (een periode), een
**categorie** (waarden om aan te vinken), een **tekst**, een **getal**, of een **datumgroepering**
die de lijnen van maand naar week of jaar laat overschakelen.

Een filter stuurt de kaarten aan die eraan gekoppeld zijn — één, meerdere of alle. Bij het aanmaken
koppelt het zich vanzelf aan de kolommen die erbij passen; geselecteerd toont het op elke kaart de
kolom die het filtert, om te wijzigen of te verwijderen, en **Aan alle compatibele kaarten koppelen**
vult de rest aan. Het kan een **standaardwaarde** hebben — bijvoorbeeld “Dit jaar”.

In leesmodus kan een klik op een punt ook een filter instellen: **Filteren op “Lyon”** op een
kaart waarvan de kolom met steden aan het filter “Ville” is gekoppeld.

![Het tabblad “Activité”: taken per deadline gestapeld per status, trechter van de projecten, geschatte uren in een draaitabel](../../../../assets/screens/tableaux-de-bord-activite.png)

## De Copilot

**Copilot**, in de kop van de sectie Dashboards, opent rechts een gesprek in
natuurlijke taal over de database: “de omzet per maand”, “voeg een filter per klant toe”,
“waarom daalt augustus?”. Elk voorstel komt binnen als een kaart, die je met één klik toepast:

| Voorstel | Wat het doet |
|---|---|
| **Een vraag** | uitgevoerd en getekend in het gesprek; ze opent in de editor of wordt aan het dashboard toegevoegd |
| **Wijzigingen van het dashboard**, of een nieuw dashboard | kaarten toegevoegd, gewijzigd of verwijderd, teksten, filters die zich vanzelf koppelen aan de kaarten met de kolom, tabbladen, naam — één enkele opslagactie, **terug te draaien** vanuit de kaart |
| **Waarden voor de getoonde filters** | “laat me vorige maand zien”: de filters worden ingesteld, er wordt niets opgeslagen |

Een vraag stellen of de filters instellen staat open voor iedere lezer van de database; een dashboard wijzigen of
aanmaken vraagt het niveau **Beheren**.

Standaard gaat **alleen de structuur** naar de AI-provider, samen met het gesprek: de
tabellen en hun velden, de dashboards en de opgeslagen vragen van de database, en het getoonde
dashboard — de tabbladen, de filters, de definitie van de kaarten (hun vragen, hun teksten).
Niet de rijen, niet de resultaten van de kaarten, en niet de **in de filters gekozen waarden**, die
gegevens kunnen zijn: van een filter gaat alleen mee dát het een waarde heeft. Een veld dat als
onzichtbaar voor agents is gemarkeerd, gaat niet mee, en de vraag van een kaart die het citeert ook niet.

Het vakje **Lezen van gegevens toestaan** voegt, voor dit gesprek, de waarden van de
getoonde filters toe en de resultaten van de kaarten onder die filters (hooguit 50 rijen per leesactie,
vermeld onder het antwoord), om de cijfers met onderbouwing te bespreken. Zie
[Kunstmatige intelligentie](/basedb/nl/fonctionnalites/ia/).

## Een dashboard delen

**Delen**, in de kop van een dashboard, is beschikbaar voor wie het niveau **Beheren** heeft op de
database. Twee mogelijkheden:

- **Database delen…** nodigt mensen uit voor de database: ze openen het dashboard in basedb, en
  elke kaart leest met hun eigen rechten;
- **Link maken** geeft een link naar **alleen** dit dashboard, die geen enkel recht op de database vraagt.

| Toegang via de link | Wie leest |
|---|---|
| **Openbaar** | iedereen met de link, zonder account |
| **Ingelogde leden** | een lid van de werkruimte, na inloggen — desgewenst alleen van bepaalde groepen |

De pagina van de link toont de tabbladen, de filters en de kaarten van het dashboard, **alleen-lezen**:
geen verkenning, geen toegang tot de rijen, geen eigen vragen. De kaarten lezen met de **rechten van de
persoon die de link heeft gepubliceerd**, bij elke leesactie opnieuw bepaald: verliest die persoon de toegang tot de database, dan wordt de
link **opgeschort**. De schakelaar **Link actief** zet hem uit zonder hem kwijt te raken, **Opnieuw genereren**
maakt de oude ongeldig.

Vink **Insluiten in een andere site toestaan** aan: het dialoogvenster geeft een **insluitcode**
`<iframe>`, om het dashboard in een intranet of een wiki te tonen. Het is hetzelfde mechanisme als bij
[gedeelde weergaven](/basedb/nl/fonctionnalites/vues-partagees/).

## Ieder zijn eigen rechten

Elke kaart leest **met de rechten van wie kijkt**: hetzelfde dashboard toont aan ieder wat die
mag zien — behalve via een deellink, die leest met de rechten van de persoon die hem heeft gepubliceerd. Een kaart over een tabel of een veld dat voor jou gesloten is, toont
“Gegevens niet toegankelijk”, in plaats van een cijfer dat door weglating zou liegen. Een vraag opslaan
deelt alleen de vraag, nooit wat de auteur ervan mag lezen.

## Beperkingen

- Een vraag levert hooguit 2 000 rijen op; een samenvatting heeft er bijna altijd genoeg aan.
- Elke kaart voert haar query uit bij het openen en bij elk filter, zonder cache.
- De kaartachtergronden beslaan Europees Frankrijk (regio’s, departementen) en de landen van de
  wereld. Bron: IGN, Admin Express (Licence ouverte); Natural Earth.

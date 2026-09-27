---
title: Rechten en groepen
description: Accounts, groepen, toegangsniveaus per project, database en tabel, beperkingen per veld, en je instellingen.
---

Rechten worden toegekend aan **groepen**, nooit aan personen afzonderlijk. Een niveau
dat op een project, een database of een tabel wordt gezet, geldt voor alles wat
eronder valt, ook voor wat later wordt aangemaakt.

## De vier niveaus

| Niveau | Staat toe |
|---|---|
| **Geen toegang** | niets: de resource is onzichtbaar |
| **Lezen** | de rijen zien, er opmerkingen bij plaatsen, persoonlijke weergaven maken, de structuur en de dashboards bekijken, eigen vragen stellen, alleen-lezen SQL schrijven en persoonlijke query’s opslaan |
| **Bewerken** | plus rijen aanmaken, wijzigen en verwijderen |
| **Beheren** | plus de structuur wijzigen, gedeelde weergaven, dashboards en opgeslagen vragen aanmaken, een dashboard via een link delen, query’s delen, SQL-views, automatiseringen, integraties en tokens aanmaken; de SQL heeft toegang tot de hele database, schrijfacties inbegrepen |

Rechten **tellen op**: iemand krijgt het hoogste niveau dat een van
zijn groepen hem geeft. Een tabel minder geven dan haar database maakt haar “granulair”.

Twee groepen bestaan altijd: **Beheerders**, die alles beheren, en **Alle
gebruikers**, waar elk account deel van uitmaakt — wat je deze groep toekent, heeft iedereen.

## Tot op het veld

Onder het raster met niveaus verbergt **Velden** een kolom voor een groep, of maakt haar
voor die groep niet bewerkbaar. Het scherm toont ook wat een bepaalde persoon werkelijk ziet, en via welke groep.

Een verborgen veld is overal afwezig: in het raster, de weergaven, de API, de MCP-server, de geschiedenis,
de SQL die in de interface wordt geschreven en de SQL-views. Filteren of sorteren op zo’n veld reageert zoals bij een veld
dat niet bestaat.

## En SQL?

In de interface volgt SQL dezelfde rechten, toegepast door PostgreSQL zelf: zonder het niveau
Beheren wordt een query alleen-lezen uitgevoerd, op een rol die alleen van die persoon is, waar een gesloten
tabel niet bestaat en een verborgen veld wordt geweigerd. Een [SQL-view](/basedb/nl/fonctionnalites/requetes-et-vues-sql/)
wordt gelezen met de rechten van wie hem leest, en een query delen deelt alleen de tekst ervan.

Een **directe `psql`-toegang** tot de database valt daarentegen niet onder basedb: die leest alles, verborgen
velden inbegrepen. De beperkingen beschermen de oppervlakken van het product — interface, API, MCP —, nooit
tegen iemand die SQL-toegang tot de database heeft; die toegang regel je met PostgreSQL-`GRANT`s,
ingesteld door de beheerder van de server.

## Accounts en inloggen

- Een account wordt aangemaakt met een **tijdelijk wachtwoord**, dat één keer wordt getoond en bij de
  eerste keer inloggen moet worden gewijzigd.
- Inloggen gebeurt met een wachtwoord of via een **OpenID Connect**-provider die de serverbeheerder
  heeft ingesteld.
- Beheeracties vragen een **verhoogde sessie**: een wachtwoord dat in de afgelopen
  vijf minuten opnieuw is ingetypt.
- Sessies kun je intrekken; een sessie intrekken maakt de toegangstokens ervan meteen ongeldig.

## Jouw instellingen

**Instellingen**, in het profielmenu linksonder, gaat alleen over jou:

| Tabblad | Wat je er doet |
|---|---|
| **Profiel** | de weergavenaam; het inlogadres; de identiteitsproviders die aan het account zijn gekoppeld, om te koppelen of te ontkoppelen |
| **Beveiliging** | het wachtwoord wijzigen; de open sessies, één voor één of allemaal te sluiten |
| **Uiterlijk** | de taal van de interface; het thema; de volgorde van datums — `25/09/2026` of `2026-09-25` — en de eerste dag van de week in kalenders |
| **Meldingen** | de soorten meldingen die je niet meer wilt |
| **Tokens** | de integratietokens die je hebt aangemaakt, in al je databases, hun laatste gebruik, en het intrekken ervan |

basedb spreekt **twintig talen**: Frans, Engels, Duits, Spaans, Italiaans, Portugees
(Brazilië), Nederlands, Pools, Tsjechisch, Zweeds, Deens, Noors, Fins, Roemeens, Hongaars,
Turks, Oekraïens, Japans, vereenvoudigd Chinees en Koreaans. Standaard neemt de interface de taal
van je browser over; **Taal**, onder **Uiterlijk**, stelt een andere in. Getallen en datums
volgen de gekozen taal.

Het thema blijft gebonden aan de browser; de taal, de volgorde van datums en de eerste dag van de
week volgen je van het ene apparaat naar het andere. Je adres wijzigen of een provider koppelen vraagt een verhoogde
sessie; een account zonder wachtwoord, dat via een provider inlogt, houdt het adres van die
provider.

## Eén enkel handhavingspunt

Alle oppervlakken — interface, API, MCP, gedeelde formulieren en weergaven, automatiseringen —
gaan langs hetzelfde beslispunt voor rechten, in de kern. Er bestaat geen private
route voor de interface: wat het scherm niet toont, heeft de API niet teruggestuurd.

Het omgekeerde geldt ook: het scherm **biedt niet aan wat geweigerd zou worden**. Zonder het niveau
Beheren kun je het scherm Structuur bekijken zonder knop of potlood, en biedt de import niet aan om
een tabel aan te maken; zonder het recht om rijen aan te maken of te verwijderen, biedt het raster geen
invoerregel en geen “Verwijderen”.

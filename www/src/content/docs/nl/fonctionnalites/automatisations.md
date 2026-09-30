---
title: Automatiseringen
description: Als een rij verandert, op een vast tijdstip of met één klik — bewerken, aanmaken, zoeken, op elke rij herhalen, vertakken, AI raadplegen, een melding sturen, een e-mail versturen, een dienst aanroepen, naar Slack schrijven.
---

Een automatisering zegt **wanneer**, **als** en **dan**: als een taak op “Fait” komt, het
tijdstip noteren; als er een negatieve review binnenkomt, de verantwoordelijke een melding sturen en naar Slack schrijven; elke
maandag om 9.00 uur de rij voor het teamoverleg aanmaken. En als één actie niet genoeg is, volgt ze een
**flow**: een rij zoeken, de ene of de andere vertakking nemen afhankelijk van wat die rij zegt, stappen
herhalen op elke rij die aan een filter voldoet, in een stap hergebruiken wat een eerdere stap heeft
gevonden of geschreven.

Je opent ze via **Automatiseringen**, in het blok van de geopende database onderaan de
zijbalk, en ze vragen het niveau **Beheren**.

![Een flow en een van zijn uitvoeringen, erop geplaatst](../../../../assets/screens/nl/automatisations.webp)

## De flow

De flow wordt van boven naar beneden getekend: de trigger, daarna elke stap. Een **+** op een lijn
voegt op die plek een stap toe; een kaart opent haar instellingen aan de rechterkant. Een eenvoudige
automatisering — een trigger en een actie — past op twee kaarten, en stel je in zoals voorheen.

## Wanneer

| Trigger | Instellingen |
|---|---|
| **Een rij wordt aangemaakt** | de tabel |
| **Een rij wordt gewijzigd** | de tabel, en desgewenst alleen de velden die in de gaten gehouden moeten worden |
| **Op een vast tijdstip** | elk uur, elke dag of elke week, op het gekozen tijdstip en in de gekozen tijdzone |
| **Er wordt op een knop geklikt** | een [veld Knop](/basedb/nl/fonctionnalites/tables-et-champs/#knop) van de tabel |

Een trigger op rijen ziet **alle** schrijfacties: de interface, de API, een agent, een
gedeeld formulier, en zelfs directe SQL — automatiseringen vertrekken vanuit de geschiedenis, die ze
allemaal vastlegt.

## Alleen als

Een optionele voorwaarde, in de [filtertaal](/basedb/nl/integrations/api-rest/#lezen) —
`statut eq "fait"`, `montant gte 10000 and payee eq false` — geëvalueerd op de rij **op het moment
van handelen**. Een uitvoering waarvan de voorwaarde niet is vervuld, wordt “overgeslagen”, en meldt dat.

## Dan

Tot dertig stappen, in volgorde; de eerste die mislukt, stopt de volgende.

| Stap | Wat ze doet |
|---|---|
| **Rij bewerken** | schrijft waarden in de rij die de trigger activeerde — of in de rij die een stap heeft gevonden of aangemaakt |
| **Rij aanmaken** | in deze tabel of een andere tabel van de database |
| **Rij zoeken** | de eerste rij van een tabel die aan een filter voldoet, zodat de volgende stappen haar kunnen citeren of wijzigen |
| **Iemand een melding sturen** | een [melding](/basedb/nl/fonctionnalites/collaboration/#meldingen) aan gekozen personen, of aan de persoon in een veld Persoon |
| **Een e-mail versturen** | aan mensen van het team, aan de persoon in een veld Persoon, aan het adres in een veld E-mail — een klant, een leverancier — of aan getypte adressen; het onderwerp en de tekst citeren de rij en de vorige stappen |
| **Webhook aanroepen** | een HTTPS-verzoek naar een dienst — methode, adres, headers en body naar eigen inzicht ([details](#een-dienst-aanroepen)); het antwoord kun je daarna citeren |
| **Naar Slack sturen** | een bericht in een [gekoppeld](/basedb/nl/integrations/synchronisation/#slack) kanaal |
| **AI raadplegen** | een antwoord van de [AI-provider](/basedb/nl/fonctionnalites/ia/) op een instructie die de rij en de vorige stappen citeert — opstellen, samenvatten, indelen —, gelezen als een tekst, een getal, ja of nee, een datum of een keuze uit een lijst |
| **Voorwaarde** | meerdere vertakkingen: de eerste waarvan de voorwaarde is vervuld, wordt genomen, “Anders” als geen enkele dat is; de vertakkingen komen daarna weer samen |
| **Voor elke rij** | de stappen die ze bevat, één keer voor elke rij van een tabel die aan een filter voldoet ([details](#voor-elke-rij)) |

Een zoekactie die niets vindt, stopt de flow niet: de stappen die haar rij moesten wijzigen,
worden overgeslagen. Om in dat geval iets anders te doen, test een voorwaarde dat — een vertakking
met een leeg filter wordt genomen zodra de zoekactie iets heeft gevonden.

## Voor elke rij

De stap **Voor elke rij** leest de rijen van een tabel die aan haar filter voldoen — leeg: alle
—, in de gekozen volgorde, tot haar limiet (standaard 50, hooguit 200), en voert daarna één keer
voor elke rij de stappen uit die in haar kader staan. “Elke maandag de onbetaalde facturen
aanmanen” schrijf je als: **Op een vast tijdstip**, daarna **Voor elke rij** van de facturen
`payee eq false and relancee eq false`, en in de lus een e-mail aan de contactpersoon van de
factuur en **Rij wijzigen** die “Relancée” aanvinkt.

In de lus noemt het id van de stap de **rij van de ronde**: `{{e1.client}}` citeert haar, en
**Rij wijzigen** stelt haar voor tussen de te wijzigen rijen. Na de lus geeft `{{e1.nombre}}` aan
hoeveel rijen ze heeft doorlopen — voor een samenvatting op Slack, bijvoorbeeld. Het filter kan
citeren wat eraan voorafgaat: geactiveerd door een betaalde factuur, doorloopt
`facture eq {{_id}}` haar detailregels.

Boven de limiet wachten de resterende rijen op de volgende uitvoering, die dat meldt: laat de
rijen die al verwerkt zijn uit het filter vallen — een vakje “relancée”, een datum — om ze
allemaal te verwerken in de loop van de uitvoeringen. Een lus kan geen andere lus bevatten, en
een uitvoering stopt na twee minuten.

## Een dienst aanroepen

De stap **Webhook aanroepen** stuurt standaard, in `POST`, de gegevens van de automatisering: de
gekozen rij en wat de vorige stappen hebben gevonden of geschreven. Om met een dienst te praten
zoals die het verwacht, stel je in:

- de **methode**: `POST`, `PUT`, `PATCH`, `GET` of `DELETE` — de laatste twee zonder body;
- het **adres**, dat na de host kan citeren — `https://api.exemple.fr/clients/{{e2.numero}}`;
  elke waarde wordt daarin gecodeerd;
- **headers**, waarvan de waarde kan citeren: `Idempotency-Key: {{_id}}`;
- de **body**: de gegevens van de automatisering, een **JSON om te schrijven**, een
  **formulier** (een paar `sleutel=waarde` per regel) of een **tekst**. In een JSON is een citaat
  tussen aanhalingstekens tekst, en buiten aanhalingstekens een waarde — een getal, ja of nee,
  een lijst:

```json
{ "facture": "{{e1.numero}}", "montant": {{e1.montant}}, "payee": {{e1.payee}} }
```

Een API-sleutel of een token zet je in een **geheime** header (het slotje): versleuteld met de
sleutel van de instantie, wordt hij nooit meer getoond — niet op het scherm, niet door de API,
niet aan Copilot — en gaat alleen naar de host waarvoor je hem hebt opgegeven. Verandert de host
van het adres, dan geef je hem opnieuw op; **Vervangen** voert een nieuwe in.

## AI raadplegen

Net als een [AI-veld](/basedb/nl/fonctionnalites/ia/#de-ai-optie-van-een-veld) stuurt de stap zijn
instructie naar de provider, waarin elke verwijzing door haar waarde is vervangen:

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

Je kiest het **verwachte antwoord** — een vrije of korte tekst, een getal, ja of nee, een datum,
een webadres, of een keuze uit een lijst, die je uit een keuzeveld kunt overnemen. Het model
wordt daarvan op de hoogte gesteld, en een antwoord dat er geen bevat, laat de stap mislukken. De volgende stappen
citeren het met `{{e1.reponse}}`: in de titel van een aangemaakte taak, een bericht, of een keuzeveld,
waar het bij de keuze met hetzelfde label wordt ingedeeld.

Wat de instructie citeert, gaat naar de provider: de stap vraagt je **toestemming**, die je opnieuw geeft
wanneer de instructie verandert. Elke aanroep wordt gelogd en telt, samen met de AI-velden, mee in
`BASEDB_AI_FIELD_QUOTA` (standaard 300 per uur). De AI doet niets uit zichzelf: het zijn de
stappen erna die schrijven of meldingen sturen.

## Citeren

Waarden, berichten en filters citeren wat eraan voorafgaat, via de knop **{ }** naast
elke tekst:

- `{{Titre}}`, `{{_id}}`: de rij die de trigger activeerde;
- `{{e2.titre}}`, `{{e2._id}}`: de rij die door stap `e2` is gevonden, aangemaakt of gewijzigd — elke
  stap toont zijn id op zijn kaart;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: wat webhook `e3` heeft geantwoord;
- `{{e4.reponse}}`: het antwoord van AI-stap `e4`;
- `{{e5.client}}` in de lus `e5`, de rij van de ronde; `{{e5.nombre}}` erna, het aantal doorlopen
  rijen;
- `{{_maintenant}}`: het tijdstip van de uitvoering.

Een waarde die uit één enkele verwijzing bestaat, geeft de waarde zelf door: een relatie, een persoon, een
keuze — zo wordt een aangemaakte rij gekoppeld aan de rij die een zoekactie heeft gevonden. In een
filter is een verwijzing altijd een vergeleken waarde, nooit filtertaal.

Een stap kan alleen citeren wat met zekerheid vóór hem is gebeurd: wat een vertakking heeft gevonden,
kun je na de voorwaarde niet meer citeren. De editor meldt dat op de kaart vóór het opslaan.

## De Copilot

**Copilot**, in de kop, opent rechts een gesprek in natuurlijke taal over de
automatiseringen van de database: “als een taak naar review gaat, stuur de toegewezen persoon
een melding”, “voeg een AI-samenvatting toe aan de notities”, “waarom is de laatste uitvoering
mislukt?”. Hij antwoordt en **stelt** een complete automatisering **voor** — de automatisering die je op het scherm hebt,
aangepast, of een nieuwe —, met de lijst van wat er verandert.

De Copilot slaat niets op: **Op de flow plaatsen** toont het voorstel in de editor,
waar je het naleest voordat je opslaat — en **Annuleren**, op de kaart, zet de flow terug zoals hij
was. Een nieuwe automatisering opent in de editor, om aan te maken. Elk voorstel wordt
gecontroleerd zoals een opslagactie dat zou worden; wat niet klopt, wordt verworpen en gemeld.

Standaard gaat **alleen de structuur** naar de AI-provider, samen met het gesprek: de tabellen
en hun velden, de automatiseringen van de database, die op het scherm zoals de editor haar toont, en
haar laatste uitvoeringen — hun statussen en foutcodes, nooit een waarde. Personen
en Slack-kanalen gaan mee onder markeringen (`p1`, `s1`), nooit met hun id. Het vakje
**Lezen van gegevens toestaan** laat de Copilot, voor dit gesprek, rijen lezen
(hooguit 50 per leesactie), waarbij elke leesactie onder zijn antwoord wordt vermeld.

## Testen, volgen

**Testen op een rij** voert de opgeslagen automatisering uit op een gekozen rij, echt en
wel. Het tabblad **Uitvoeringen** bewaart de laatste 50, gedurende 30 dagen: in afwachting, bezig, geslaagd,
overgeslagen met de reden, mislukt met de code. Kies er een en die wordt op de flow geplaatst — de genomen
vertakking wordt getekend, elke doorlopen stap zegt wat ze heeft gedaan en hoe lang dat duurde, de rest is
vervaagd. In een lus geeft elke stap ook aan hoeveel keer ze heeft gedraaid.

## Namens wie ze handelt

Een automatisering handelt met de **rechten van de persoon die haar het laatst heeft opgeslagen**,
bij elke uitvoering opnieuw bepaald: verliest die persoon een recht, dan mislukt de stap die dat recht nodig had
in plaats van eroverheen te stappen, en vindt een zoekactie alleen wat die persoon mag lezen.
De geschiedenis toont dat als “Automatisering ‘Tâche terminée’ · namens …”, en haar schrijfacties
maak je ongedaan zoals alle andere.

## Beperkingen

- Wat een automatisering schrijft, triggert geen andere automatisering: wat op elkaar moet volgen, schrijf je
  in één flow.
- Een zoekactie levert één rij op, de eerste; een lus doorloopt er hooguit 200 per uitvoering,
  en de eerste stap die mislukt, stopt de lus. Geen wachttijd (“drie dagen later”).
- Geen scripts. Een e-mail wordt als platte tekst verstuurd, één per ontvanger — hooguit twintig
  per stap —, via de [verzendserver](/basedb/nl/hebergement/variables/#e-mails) van de
  instantie; een antwoord komt terecht bij de eigenaar van de automatisering.
- Een voorwaarde test een rij: om een vertakking te nemen op basis van het antwoord van de AI, schrijf je dat
  eerst in een veld van de rij.
- Een [databasesjabloon](/basedb/nl/fonctionnalites/modeles/) neemt alleen automatiseringen mee zonder
  zoekactie, lus, voorwaarde of AI-stap, en nooit een webhook.
- Een webhook volgt geen omleiding en wacht maximaal 10 seconden; een andere reactie dan 2xx laat
  de stap mislukken.
- 100 uitvoeringen per uur per automatisering; een gemist uurlijks tijdstip wordt maar
  één keer ingehaald.
- De vertraging tussen de schrijfactie en de actie is in de orde van een seconde.

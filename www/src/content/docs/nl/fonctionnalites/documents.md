---
title: PDF-documenten
description: Een rij als factuur, offerte of afdrukbare fiche, met haar gekoppelde rijen en totalen.
---

Een rij wordt een **PDF**: een factuur met haar regels en haar totaal, een offerte, een
leveringsbon, een fiche. In de rijdetails van een rij opent de knop **PDF-document** hem in een
nieuw tabblad, van waaruit de browser hem afdrukt of opslaat.

## De fiche, zonder iets in te stellen

Zonder sjabloon wordt een rij afgedrukt als **fiche**: haar naam als titel, daarna alle velden
die je kunt lezen, in jouw taal.

## De sjablonen

Wie de tabel bouwt — het niveau Beheren — schrijft ze, vanuit de rijdetails van een rij:
**PDF-document › Documentsjablonen…**. Een sjabloon is een pagina (A4 of Letter, staand of
liggend), een taal voor de waarden, een voettekst en een reeks blokken:

| Blok | Wat het toont |
|---|---|
| **Tekst** | opgemaakte tekst — koppen, vet, lijsten, links — die de kolommen van de rij citeert met het menu **Kolom**: “Factuur `{{numero}}` van `{{date}}`” |
| **Velden van de rij** | de gekozen velden, of allemaal: label links, waarde rechts |
| **Tabel met gekoppelde rijen** | de rijen die naar deze rij verwijzen — de regels van een factuur — of die welke een meervoudige relatie aanwijst, met de gekozen kolommen en hun **totalen** |
| **Pagina-einde** | de rest op een nieuwe pagina |

De editor toont ernaast de PDF die het sjabloon van de geopende rij maakt, wijzigingen
inbegrepen.

De waarden worden geschreven **in de taal van het sjabloon**: een bedrag met zijn valuta
(“1.234,50 €”), een datum voluit geschreven (“30 september 2026”), ja en nee, het label van een
keuze, de naam van een persoon. De tekst wordt gezet met ingebedde lettertypen die de twintig
talen van basedb dekken, ideogrammen inbegrepen.

## Iedereen met zijn eigen rechten

Een document wordt gelezen **met de rechten van wie het afdrukt**: een veld dat voor hem
verborgen is, staat er niet in, een gekoppelde rij die hij niet mag zien, staat niet in de
tabel — en ook niet in het totaal. Twee personen kunnen dus twee verschillende documenten van
dezelfde rij krijgen: elk heeft het zijne.

## Via de API

```bash
# De PDF van een rij met een sjabloon, of “fiche”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` toont de sjablonen van de tabel.

## Beperkingen

- Geen afbeelding (logo) en geen gekozen kleur in een document, geen kop die losstaat van de
  voet.
- Één document per rij: nog geen PDF van meerdere rijen, en nog geen aanmaak via een
  automatisering.

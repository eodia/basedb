---
title: PDF-documenten
description: Een rij als factuur, offerte, fiche of attest in jouw kleuren, met logo, gekoppelde rijen en totalen.
---

Een rij wordt een **PDF**: een factuur met haar regels en haar totaal, een offerte, een
leveringsbon, een productfiche, een attest. In de rijdetails van een rij opent de knop
**PDF-document** hem in een nieuw tabblad, van waaruit de browser hem afdrukt of opslaat.

## De fiche, zonder iets in te stellen

Zonder sjabloon wordt een rij afgedrukt als **fiche**: haar naam als titel, daarna alle velden
die je kunt lezen, in jouw taal.

## Een sjabloon maken

Wie de tabel bouwt — het niveau Beheren — maakt de sjablonen vanuit de rijdetails van een rij:
**PDF-document › Documentsjablonen…**. Een nieuw sjabloon vertrekt van een **startpunt**:

| Startpunt | Wat het instelt |
|---|---|
| **Factuur** | kop met logo en gegevens, “FACTUUR”, nummer en datum; klant; gefactureerde regels en hun totaal; overzicht excl. / incl. btw; betalingsvoorwaarden; wettelijke vermeldingen in de voet |
| **Offerte** | titel op een gekleurde band, gegevens in een raster, diensten, geldigheid, zone “Goed voor akkoord” |
| **Fiche** | grote titel over de volledige breedte, foto van het afbeeldingsveld, velden in een raster, lange teksten |
| **Attest** | omkaderde liggende pagina, gecentreerde tekst, handtekening |
| **Lege pagina** | een titel en de velden van de rij |

Het wordt opgebouwd met **de kolommen van je tabel** — haar nummer, haar datum, haar bedragen,
haar foto, de rijen die ermee verbonden zijn — en wat de tabel niet heeft, wordt gewoon
weggelaten. Alles kun je daarna aanpassen; het voorbeeld, rechts, toont de PDF van de geopende
rij en wordt bij elke wijziging bijgewerkt.

## De inhoud: blokken

De blokken volgen elkaar van boven naar beneden; je **versleept** ze aan hun handvat om ze te
herschikken, en je opent ze om ze in te stellen.

| Blok | Wat het toont |
|---|---|
| **Titel** | een grote titel en een ondertitel, sober, in kleur, onderstreept, of op een band — tot aan de randen van de pagina |
| **Tekst** | opgemaakte tekst — koppen, vet, lijsten, links — die de kolommen van de rij citeert met het menu **Kolom**: “Factuur `{{numero}}` van `{{date}}`”; uitgelijnd of uitgevuld, op een gekleurde achtergrond, omkaderd of gemarkeerd met een gekleurde balk |
| **Afbeelding** | een logo, een stempel, of de foto van een afbeeldingsveld van de rij |
| **Velden van de rij** | de gekozen velden, of allemaal: label links, label erboven in een raster van 2 of 3, of **overzicht** — waarden rechts, de laatste (het te betalen totaal) vet; lege velden kun je verbergen |
| **Tabel met gekoppelde rijen** | de rijen die naar deze rij verwijzen — de regels van een factuur — of die welke een meervoudige relatie aanwijst, met hun **totalen**; gekleurde koptekst, om en om getinte rijen, kopteksten, breedtes en uitlijningen van kolommen naar eigen inzicht (“Aant.” voor “Aantal”) |
| **Kolommen** | twee of drie kolommen naast elkaar, elk met haar eigen blokken: “Gefactureerd aan” aan de ene kant, de referenties aan de andere |
| **Scheidingslijn**, **Ruimte** | een lijn — kort voor een handtekening — of een leegte |
| **Pagina-einde** | de rest op een nieuwe pagina |

## Stijl en pagina

- **Accentkleur** — die van je merk: titels, banden, tabelkoppen, links. De tekst erop is wit
  of donker, naargelang wat het best leesbaar is.
- **Tekstkleur**, **lettertype** van de tekst en de titels (met of zonder schreef),
  **tekstgrootte**, stijl van de tussenkopjes.
- **Formaat** (A4 of Letter), **oriëntatie**, **marges**, enkel of dubbel **kader** rond de
  pagina, **verticaal gecentreerde** inhoud — voor een attest.
- **Taal van de waarden**: bedragen worden geschreven met hun munteenheid (“1.234,50 €”), data
  voluit (“30 september 2026”), ja en nee, het label van een keuze, de naam van een persoon. De
  tekst wordt gezet met ingebedde lettertypen die de twintig talen van basedb dekken, ideogrammen
  inbegrepen.

## Koptekst en voettekst

De **koptekst** draagt je **logo** — een geüploade afbeelding (PNG, JPEG of SVG; een te zware
afbeelding wordt verkleind) of het afbeeldingsveld van de rij —, een tekst links (je gegevens) en
een tekst rechts (wat het document is, zijn nummer, zijn datum), op de eerste pagina of op elke
pagina. De **voettekst** draagt je wettelijke vermeldingen en de paginanummers. Beide citeren de
kolommen van de rij, net als een tekst.

## Iedereen met zijn eigen rechten

Een document wordt gelezen **met de rechten van wie het afdrukt**: een veld dat voor hem
verborgen is, staat er niet in — niet in een tekst, en niet als afbeelding —, een gekoppelde rij
die hij niet mag zien, staat niet in de tabel — en ook niet in het totaal. Twee personen kunnen
dus twee verschillende documenten van dezelfde rij krijgen: elk heeft het zijne.

## Via de API

```bash
# De PDF van een rij met een sjabloon, of “fiche”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` toont de sjablonen van de tabel.

## Beperkingen

- Een geüploade afbeelding is hoogstens 300 KB, acht per sjabloon; een afbeelding van een veld
  wordt overgenomen als het een PNG of een JPEG is.
- Een waarde van een gekoppelde rij citeer je buiten de tabel met een **opzoekveld** op de tabel
  van het document; een totaal incl. btw is een veld van de tabel.
- Één document per rij: nog geen PDF van meerdere rijen. Een
  [automatisering](/basedb/nl/fonctionnalites/automatisations/#een-pdf-en-een-e-mail) kan dat
  voor je doen — **Een PDF genereren** — en het als bijlage versturen.

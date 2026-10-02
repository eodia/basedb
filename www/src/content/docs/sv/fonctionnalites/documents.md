---
title: PDF-dokument
description: En rad blir en faktura, en offert, ett informationsblad eller ett intyg i dina egna färger, med logotyp, länkade rader och totaler.
---

En rad blir en **PDF**: en faktura med sina rader och sin totalsumma, en offert, en följesedel,
ett produktblad, ett intyg. I en rads raddetaljer öppnar knappen **PDF-dokument** den i en ny
flik, varifrån webbläsaren skriver ut eller sparar den.

## Raddetaljerna, utan att ställa in något

Utan en mall skrivs en rad ut som **raddetaljer**: dess namn som rubrik, sedan alla fält du kan
läsa, på ditt språk.

## Skapa en mall

Den som bygger tabellen – nivån Hantera – skapar mallarna från en rads raddetaljer:
**PDF-dokument › Dokumentmallar…**. En ny mall utgår från en **utgångspunkt**:

| Utgångspunkt | Vad den lägger till |
|---|---|
| **Faktura** | sidhuvud med logotyp och kontaktuppgifter, ”FAKTURA”, nummer och datum; kund; fakturerade rader och deras totalsumma; sammanfattning exkl./inkl. moms; betalningsvillkor; juridisk information i sidfoten |
| **Offert** | rubrik på en färgad banderoll, information i rutnät, tjänster, giltighetstid, område för ”Läst och godkänt” |
| **Informationsblad** | stor rubrik i full bredd, foto från bildfältet, fält i rutnät, långa texter |
| **Intyg** | inramad liggande sida, centrerad text, signatur |
| **Tom sida** | en rubrik och radens fält |

Den byggs med **din tabells kolumner** – dess nummer, datum, belopp, foto, de rader som är
länkade till den – och det som tabellen saknar lämnas helt enkelt bort. Allt kan sedan ändras;
förhandsvisningen till höger visar PDF:en för den öppna raden och uppdateras vid varje ändring.

## Innehållet: block

Blocken följer varandra uppifrån och ned; du **drar** dem i sitt handtag för att ordna om dem,
och öppnar dem för att ställa in dem.

| Block | Vad det visar |
|---|---|
| **Rubrik** | en stor rubrik och en underrubrik, sober, i färg, understruken, eller på en banderoll – ända ut till sidans kanter |
| **Text** | formaterad text – rubriker, fetstil, listor, länkar – som citerar radens kolumner med menyn **Kolumn**: ”Faktura `{{numero}}` den `{{date}}`”; vänsterställd eller marginaljusterad, på tonad bakgrund, inramad eller markerad med ett accentstreck |
| **Bild** | en logotyp, en stämpel, eller bilden från ett bildfält på raden |
| **Radens fält** | de valda fälten, eller alla: etikett till vänster, etikett ovanför i ett rutnät med 2 eller 3 kolumner, eller **sammanfattning** – värden till höger, det sista (totalbeloppet) i fet stil; tomma fält kan döljas |
| **Tabell med länkade rader** | de rader som pekar på den här – raderna på en faktura – eller de som en multipel relation pekar på, med deras **totaler**; färgad rubrikrad, varannan rad tonad, kolumnrubriker, bredder och justeringar som du själv ställer in (”Ant.” för ”Antal”) |
| **Kolumner** | två eller tre kolumner sida vid sida, var och en med sina block: ”Fakturerad till” på den ena, referenserna på den andra |
| **Avgränsare**, **Mellanrum** | en linje – kort för en signatur – eller ett mellanrum |
| **Sidbrytning** | resten på en ny sida |

## Stil och sida

- **Accentfärg** – din varumärkesfärg: rubriker, banderoller, tabellrubriker, länkar. Texten
  ovanpå den blir vit eller mörk, beroende på vad som är lättast att läsa.
- **Textfärg**, **typsnitt** för text och rubriker (med eller utan serifer), textens
  **storlek**, stil på mellanrubrikerna.
- **Format** (A4 eller Letter), **orientering**, **marginaler**, enkel eller dubbel **ram**
  runt sidan, innehåll **centrerat vertikalt** – för ett intyg.
- **Språk för värdena**: belopp skrivs med sin valuta (”1 234,50 €”), datum skrivs ut i ord
  (”30 september 2026”), ja och nej, etiketten på ett val, en persons namn. Texten sätts med
  inbyggda typsnitt som täcker basedbs tjugo språk, ideogram inräknade.

## Sidhuvud och sidfot

**Sidhuvudet** bär din **logotyp** – en uppladdad bild (PNG, JPEG eller SVG; en för stor bild
förminskas) eller radens bildfält –, en text till vänster (dina kontaktuppgifter) och en text
till höger (vad dokumentet är, dess nummer, dess datum), på den första sidan eller på var och
en. **Sidfoten** bär din juridiska information och sidnumren. Båda citerar radens kolumner,
precis som en text.

## Var och en med sina behörigheter

Ett dokument läses **med behörigheterna hos den som skriver det ut**: ett fält som är dolt för
hen finns inte där – inte i en text, inte heller som bild –, en länkad rad hen inte ser är inte
med i tabellen – och inte i totalen. Två personer kan alltså få två olika dokument av samma
rad: var och en får sitt.

## Via API:et

```bash
# PDF:en för en rad med en mall, eller "raddetaljer"
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listar tabellens mallar.

## Begränsningar

- En uppladdad bild väger högst 300 kB, åtta per mall; en bild från ett fält återanvänds om
  det är en PNG eller en JPEG.
- Ett värde från en länkad rad citeras utanför tabellen med en **sökning** på dokumentets
  tabell; ett totalbelopp inkl. moms är ett fält i tabellen.
- Ett dokument per rad: ännu ingen PDF med flera rader. En
  [automatisering](/basedb/sv/fonctionnalites/automatisations/#en-pdf-och-ett-e-postmeddelande)
  kan göra det åt dig – **Generera en PDF** – och skicka den som bilaga.

---
title: PDF-dokument
description: En rad blir en faktura, en offert eller en utskrivbar sida, med sina länkade rader och sina totaler.
---

En rad blir en **PDF**: en faktura med sina rader och sin totalsumma, en offert, en följesedel,
en sida. I en rads raddetaljer öppnar knappen **PDF-dokument** den i en ny flik, varifrån
webbläsaren skriver ut eller sparar den.

## Raddetaljerna, utan att ställa in något

Utan en mall skrivs en rad ut som **raddetaljer**: dess namn som rubrik, sedan alla fält du kan
läsa, på ditt språk.

## Mallarna

Den som bygger tabellen – nivån Hantera – skriver dem, från en rads raddetaljer:
**PDF-dokument › Dokumentmallar…**. En mall är en sida (A4 eller Letter, stående eller
liggande), ett språk för värdena, en sidfot och en rad block:

| Block | Vad det visar |
|---|---|
| **Text** | formaterad text – rubriker, fetstil, listor, länkar – som citerar radens kolumner med menyn **Kolumn**: ”Faktura `{{numero}}` den `{{date}}`” |
| **Radens fält** | de valda fälten, eller alla: etikett till vänster, värde till höger |
| **Tabell med länkade rader** | de rader som pekar på den här – raderna på en faktura – eller de som en multipel relation pekar på, med valda kolumner och deras **totaler** |
| **Sidbrytning** | resten på en ny sida |

Redigeraren visar bredvid den PDF som mallen gör av den öppna raden, ändringar inräknade.

Värdena skrivs **på mallens språk**: ett belopp med sin valuta (”1 234,50 €”), ett datum
utskrivet i ord (”30 september 2026”), ja och nej, etiketten på ett val, en persons namn.
Texten sätts med inbyggda typsnitt som täcker basedbs tjugo språk, ideogram inräknade.

## Var och en med sina behörigheter

Ett dokument läses **med behörigheterna hos den som skriver det ut**: ett fält som är dolt för
hen finns inte där, en länkad rad hen inte ser är inte med i tabellen – och inte i totalen. Två
personer kan alltså få två olika dokument av samma rad: var och en får sitt.

## Via API:et

```bash
# PDF:en för en rad med en mall, eller "raddetaljer"
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listar tabellens mallar.

## Begränsningar

- Ingen bild (logotyp) eller vald färg i ett dokument, inget sidhuvud skilt från sidfoten.
- Ett dokument per rad: ännu ingen PDF med flera rader, och ingen generering från en
  automatisering.

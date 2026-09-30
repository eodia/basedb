---
title: PDF-dokumenter
description: En række som en faktura, et tilbud eller en udskrivelig oversigt, med dens forbundne rækker og totaler.
---

En række bliver en **PDF**: en faktura med dens linjer og total, et tilbud, en følgeseddel, en
oversigt. I en rækkes rækkedetaljer åbner knappen **PDF-dokument** den i en ny fane, hvorfra
browseren udskriver eller gemmer den.

## Oversigten, uden at indstille noget

Uden en skabelon udskrives en række som en **oversigt**: dens navn som titel, derefter alle de
felter, du kan læse, på dit sprog.

## Skabeloner

Den, der bygger tabellen — niveauet Administrere — skriver dem, fra en rækkes rækkedetaljer:
**PDF-dokument › Dokumentskabeloner…**. En skabelon er en side (A4 eller Letter, portræt eller
landskab), et sprog for værdierne, en sidefod og en række blokke:

| Blok | Hvad den viser |
|---|---|
| **Tekst** | formateret tekst — overskrifter, fed, lister, links — der citerer rækkens kolonner med menuen **Kolonne**: »Faktura `{{numero}}` fra `{{date}}`« |
| **Rækkens felter** | de valgte felter, eller alle: etiket til venstre, værdi til højre |
| **Tabel med forbundne rækker** | de rækker, der peger på denne — en fakturas linjer — eller de, en multipel relation peger på, med de valgte kolonner og deres **totaler** |
| **Sideskift** | fortsættelsen på en ny side |

Editoren viser side om side den PDF, skabelonen gør ud af den åbne række, ændringer inklusive.

Værdierne skrives **på skabelonens sprog**: et beløb med sin valuta (»1.234,50 €«), en dato
skrevet fuldt ud (»30. september 2026«), ja og nej, et valgs etiket, en persons navn. Teksten
sættes med indbyggede skrifttyper, der dækker basedbs tyve sprog, ideogrammer inklusive.

## Hver med sine tilladelser

Et dokument læses **med tilladelserne fra den, der udskriver det**: et felt, der er skjult for
personen, står ikke i det, en forbundet række, personen ikke kan se, er ikke i tabellen — og
ikke i totalen. To personer kan derfor få to forskellige dokumenter af samme række: hver sin.

## Via API'et

```bash
# PDF'en for en række med en skabelon, eller »oversigt«
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lister tabellens skabeloner.

## Begrænsninger

- Intet billede (logo) eller valgt farve i et dokument, ingen sidehoved forskellig fra
  sidefoden.
- Ét dokument pr. række: endnu ingen PDF for flere rækker, og ingen generering fra en
  automatisering.

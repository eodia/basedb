---
title: PDF-dokumenter
description: En rad som blir en faktura, et tilbud eller et utskriftsvennlig ark, med koblede rader og totaler.
---

En rad blir et **PDF**: en faktura med sine rader og sin sum, et tilbud, en følgeseddel, et
ark. I raddetaljene til en rad åpner knappen **PDF-dokument** den i en ny fane, hvorfra
nettleseren skriver den ut eller lagrer den.

## Arket, uten noe å stille inn

Uten en mal skrives en rad ut som et **ark**: navnet som tittel, og deretter alle feltene du
kan lese, på ditt eget språk.

## Malene

Den som bygger tabellen — nivået Administrere — skriver dem, fra raddetaljene til en rad:
**PDF-dokument › Dokumentmaler…**. En mal er en side (A4 eller Letter, stående eller liggende),
et språk for verdiene, en bunntekst og en rekke blokker:

| Blokk | Hva den viser |
|---|---|
| **Tekst** | formatert tekst — overskrifter, fet, lister, lenker — som refererer til radens kolonner med menyen **Kolonne**: «Faktura `{{numero}}` av `{{date}}`» |
| **Radens felter** | de valgte feltene, eller alle: etikett til venstre, verdi til høyre |
| **Tabell med koblede rader** | radene som viser til denne — radene på en faktura — eller dem en multippel relasjon viser til, med de valgte kolonnene og deres **totaler** |
| **Sideskift** | fortsettelsen på en ny side |

Editoren viser ved siden av PDF-en malen gir av den åpne raden, endringer inkludert.

Verdiene skrives **på malens språk**: et beløp med sin valuta («1 234,50 €»), en dato skrevet ut
(«30. september 2026»), ja og nei, etiketten til et valg, navnet på en person. Teksten settes
med innebygde skrifter som dekker basedbs tjue språk, ideogrammer inkludert.

## Hver med sine tillatelser

Et dokument leses **med tillatelsene til den som skriver det ut**: et felt som er skjult for
vedkommende, vises ikke der, en koblet rad vedkommende ikke ser, er ikke i tabellen — heller ikke
i totalen. To personer kan altså få to forskjellige dokumenter av samme rad: hver sitt.

## Via API-et

```bash
# PDF-en av en rad med en mal, eller «arket»
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lister tabellens maler.

## Begrensninger

- Ingen bilde (logo) eller valgt farge i et dokument, ingen topptekst atskilt fra bunnteksten.
- Ett dokument per rad: ennå ikke PDF for flere rader, eller generering fra en automatisering.

---
title: PDF-dokumenter
description: En rad som blir en faktura, et tilbud, et ark eller en attest i dine farger, med logo, koblede rader og totaler.
---

En rad blir et **PDF**: en faktura med sine rader og sin sum, et tilbud, en følgeseddel, et
produktark, en attest. I raddetaljene til en rad åpner knappen **PDF-dokument** den i en ny
fane, hvorfra nettleseren skriver den ut eller lagrer den.

## Arket, uten noe å stille inn

Uten en mal skrives en rad ut som et **ark**: navnet som tittel, og deretter alle feltene du
kan lese, på ditt eget språk.

## Opprett en mal

Den som bygger tabellen — nivået Administrere — oppretter malene fra raddetaljene til en rad:
**PDF-dokument › Dokumentmaler…**. En ny mal starter fra et **utgangspunkt**:

| Utgangspunkt | Hva det setter opp |
|---|---|
| **Faktura** | topptekst med logo og kontaktopplysninger, «FAKTURA», nummer og dato; kunde; fakturerte rader og totalsummen deres; sammendrag eks. mva / inkl. mva; betalingsvilkår; juridiske opplysninger i bunnteksten |
| **Tilbud** | tittel på et fargebånd, informasjon i rutenett, tjenester, gyldighet, felt for «Godkjent for avtale» |
| **Raddetaljer** | stor tittel i full bredde, bilde fra bildefeltet, felt i rutenett, lange tekster |
| **Attest** | innrammet liggende side, sentrert tekst, signatur |
| **Blank side** | en tittel og radens felter |

Den bygges med **kolonnene i tabellen din** — nummeret, datoen, beløpene, bildet, radene som
er koblet til den — og det tabellen ikke har, blir ganske enkelt utelatt. Alt kan endres i den
etterpå; forhåndsvisningen, til høyre, viser PDF-en av den åpne raden og oppdateres ved hver
endring.

## Innholdet: blokker

Blokkene følger hverandre ovenfra og ned; du **drar** dem i håndtaket for å endre
rekkefølgen, og åpner dem for å stille dem inn.

| Blokk | Hva den viser |
|---|---|
| **Tittel** | en stor tittel og en undertittel, nøytral, i farge, understreket, eller på et bånd — helt ut til sidekantene |
| **Tekst** | formatert tekst — overskrifter, fet, lister, lenker — som refererer til radens kolonner med menyen **Kolonne**: «Faktura `{{numero}}` av `{{date}}`»; justert eller blokkjustert, på tonet bakgrunn, innrammet eller merket med en fargestripe |
| **Bilde** | en logo, et stempel, eller bildet fra et bildefelt i raden |
| **Radens felter** | de valgte feltene, eller alle: etikett til venstre, etikett over i rutenett med 2 eller 3 kolonner, eller **sammendrag** — verdier til høyre, den siste (totalbeløpet som skal betales) i fet skrift; tomme felt kan skjules |
| **Tabell med koblede rader** | radene som viser til denne — radene på en faktura — eller dem en multippel relasjon viser til, med deres **totaler**; farget topptekstrad, annenhver rad tonet, kolonneoverskrifter, -bredder og -justering i egen hånd («Ant.» for «Antall») |
| **Kolonner** | to eller tre kolonner side ved side, hver med sine blokker: «Fakturert til» på den ene siden, referansene på den andre |
| **Skillelinje**, **Mellomrom** | en linje — kort for en signatur — eller et tomrom |
| **Sideskift** | fortsettelsen på en ny side |

## Stilen og siden

- **Aksentfarge** — merkevarens egen: titler, bånd, tabelloverskrifter, lenker. Teksten som
  ligger over den, er hvit eller mørk, etter hva som er lettest å lese.
- **Tekstfarge**, **skrifttype** for tekst og titler (med eller uten seriffer), **størrelse**
  på teksten, stil på mellomtitlene.
- **Format** (A4 eller Letter), **retning**, **marger**, enkel eller dobbel **ramme** rundt
  siden, innhold **sentrert vertikalt** — for en attest.
- **Språk for verdiene**: beløp skrives med sin valuta («1 234,50 €»), datoer skrevet ut
  («30. september 2026»), ja og nei, etiketten til et valg, navnet på en person. Teksten settes
  med innebygde skrifter som dekker basedbs tjue språk, ideogrammer inkludert.

## Topptekst og bunntekst

**Toppteksten** har **logoen** din — et opplastet bilde (PNG, JPEG eller SVG; et for stort
bilde blir redusert) eller bildefeltet i raden —, en tekst til venstre (kontaktopplysningene
dine) og en tekst til høyre (hva dokumentet er, nummeret og datoen), på første side eller på
hver side. **Bunnteksten** har de juridiske opplysningene dine og sidetallene. Begge
refererer til radens kolonner, som en tekst.

## Hver med sine tillatelser

Et dokument leses **med tillatelsene til den som skriver det ut**: et felt som er skjult for
vedkommende, vises ikke der — verken i en tekst eller et bilde —, en koblet rad vedkommende
ikke ser, er ikke i tabellen — heller ikke i totalen. To personer kan altså få to forskjellige
dokumenter av samme rad: hver sitt.

## Via API-et

```bash
# PDF-en av en rad med en mal, eller «arket»
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lister tabellens maler.

## Begrensninger

- Et opplastet bilde veier høyst 300 KB, åtte per mal; et bilde fra et felt brukes hvis det er
  en PNG eller en JPEG.
- En verdi fra en koblet rad kan vises til utenfor tabellen med et **søk** på dokumentets
  tabell; et beløp inkl. mva er et felt i tabellen.
- Ett dokument per rad: ennå ikke PDF for flere rader. En
  [automatisering](/basedb/nb/fonctionnalites/automatisations/#en-pdf-og-en-e-post) kan gjøre
  det for deg — **Generer en PDF** — og sende det som vedlegg.

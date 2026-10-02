---
title: PDF-dokumenter
description: En række som faktura, tilbud, informationsblad eller attest i dine farver, med logo, forbundne rækker og totaler.
---

En række bliver en **PDF**: en faktura med dens linjer og total, et tilbud, en følgeseddel, et
produktblad, en attest. I en rækkes rækkedetaljer åbner knappen **PDF-dokument** den i en ny
fane, hvorfra browseren udskriver eller gemmer den.

## Oversigten, uden at indstille noget

Uden en skabelon udskrives en række som en **oversigt**: dens navn som titel, derefter alle de
felter, du kan læse, på dit sprog.

## Opret en skabelon

Den, der bygger tabellen — niveauet Administrere — opretter skabelonerne fra en rækkes
rækkedetaljer: **PDF-dokument › Dokumentskabeloner…**. En ny skabelon starter fra et
**udgangspunkt**:

| Udgangspunkt | Hvad det opsætter |
|---|---|
| **Faktura** | sidehoved med logo og kontaktoplysninger, »FAKTURA«, nummer og dato; kunde; fakturerede linjer og deres total; oversigt ekskl. moms / inkl. moms; betalingsbetingelser; juridiske oplysninger i sidefoden |
| **Tilbud** | titel på et farvet banner, oplysninger i gitter, tjenester, gyldighed, felt »Læst og godkendt« |
| **Informationsblad** | stor titel i fuld bredde, foto fra billedfeltet, felter i gitter, lange tekster |
| **Attest** | liggende side med ramme, centreret tekst, underskrift |
| **Tom side** | en titel og rækkens felter |

Den bygges med **kolonnerne fra din tabel** — dens nummer, dens dato, dens beløb, dens foto, de
rækker, der er forbundet med den — og det, tabellen ikke har, bliver simpelthen udeladt. Alt kan
ændres bagefter; forhåndsvisningen til højre viser PDF'en for den åbne række og opdateres ved
hver ændring.

## Indholdet: blokke

Blokkene følger efter hinanden oppefra og ned; du **trækker** dem i deres håndtag for at
omordne dem, og åbner dem for at indstille dem.

| Blok | Hvad den viser |
|---|---|
| **Titel** | en stor titel og en undertitel, sober, farvet, understreget, eller på et banner — helt ud til siderne |
| **Tekst** | formateret tekst — overskrifter, fed, lister, links — der citerer rækkens kolonner med menuen **Kolonne**: »Faktura `{{numero}}` fra `{{date}}`«; venstrejusteret eller justeret, på tonet baggrund, indrammet eller markeret med en farvet bjælke |
| **Billede** | et logo, et stempel, eller fotoet fra et billedfelt på rækken |
| **Rækkens felter** | de valgte felter, eller alle: etiket til venstre, etiket over i et gitter på 2 eller 3, eller **oversigt** — værdier til højre, den sidste (det samlede beløb) i fed; tomme felter kan skjules |
| **Tabel med forbundne rækker** | de rækker, der peger på denne — en fakturas linjer — eller de, en multipel relation peger på, med deres **totaler**; farvet overskriftsrække, hver anden række tonet, overskrifter, bredder og justeringer for kolonner efter eget valg (»Ant.« for »Antal«) |
| **Kolonner** | to eller tre kolonner side om side, hver med sine blokke: »Faktureret til« i den ene, referencerne i den anden |
| **Separator**, **Mellemrum** | en streg — kort til en underskrift — eller et blankt felt |
| **Sideskift** | fortsættelsen på en ny side |

## Stil og side

- **Accentfarve** — din brands farve: titler, bannere, tabellernes overskriftsrække, links.
  Teksten, der ligger ovenpå, er hvid eller mørk, efter hvad der læses bedst.
- **Tekstfarve**, **skrifttype** for teksten og titlerne (med eller uden serif), **størrelse**
  på teksten, stil for mellemrubrikkerne.
- **Format** (A4 eller Letter), **retning**, **margener**, enkelt eller dobbelt **ramme**
  omkring siden, indhold **centreret lodret** — til en attest.
- **Sprog for værdierne**: beløb skrives med deres valuta (»1.234,50 €«), datoer skrives fuldt
  ud (»30. september 2026«), ja og nej, et valgs etiket, en persons navn. Teksten sættes med
  indbyggede skrifttyper, der dækker basedbs tyve sprog, ideogrammer inklusive.

## Sidehoved og sidefod

**Sidehovedet** bærer dit **logo** — et sendt billede (PNG, JPEG eller SVG; et for stort billede
formindskes) eller rækkens billedfelt —, en tekst til venstre (dine kontaktoplysninger) og en
tekst til højre (hvad dokumentet er, dets nummer, dets dato), på den første side eller på hver
side. **Sidefoden** bærer dine juridiske oplysninger og sidetallene. Begge citerer rækkens
kolonner, som en tekst.

## Hver med sine tilladelser

Et dokument læses **med tilladelserne fra den, der udskriver det**: et felt, der er skjult for
personen, står ikke i det — hverken i en tekst eller i et billede —, en forbundet række,
personen ikke kan se, er ikke i tabellen — og ikke i totalen. To personer kan derfor få to
forskellige dokumenter af samme række: hver sin.

## Via API'et

```bash
# PDF'en for en række med en skabelon, eller »oversigt«
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lister tabellens skabeloner.

## Begrænsninger

- Et sendt billede vejer højst 300 kB, otte pr. skabelon; et billede fra et felt bruges, hvis
  det er et PNG eller et JPEG.
- En værdi fra en forbundet række citeres uden for tabellen med et **opslag** på dokumentets
  tabel; en totalpris inkl. moms er et felt i tabellen.
- Ét dokument pr. række: endnu ingen PDF for flere rækker. En
  [automatisering](/basedb/da/fonctionnalites/automatisations/#en-pdf-og-en-e-mail) kan gøre det
  for dig — **Generer en PDF** — og sende den som vedhæftning.

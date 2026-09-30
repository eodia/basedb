---
title: Documente PDF
description: Un rând transformat în factură, deviz sau fișă imprimabilă, cu rândurile sale legate și totalurile lor.
---

Un rând devine un **PDF**: o factură cu rândurile ei și totalul, un deviz, un aviz de expediție,
o fișă. În fișa unui rând, butonul **Document PDF** îl deschide într-un tab nou, de unde
browserul îl imprimă sau îl salvează.

## Fișa, fără nimic de reglat

Fără model, un rând se imprimă ca **fișă**: numele lui ca titlu, apoi toate câmpurile pe care le
puteți citi, în limba dumneavoastră.

## Modelele

Cine construiește tabelul — nivelul Gestionare — le scrie, din fișa unui rând:
**Document PDF › Șabloane de document…**. Un model este o pagină (A4 sau Letter, portret sau
peisaj), o limbă pentru valori, un subsol de pagină și o succesiune de blocuri:

| Bloc | Ce arată |
|---|---|
| **Text** | text formatat — titluri, aldin, liste, linkuri — care citează coloanele rândului cu meniul **Coloană**: „Factura `{{numero}}` din `{{date}}`” |
| **Câmpurile rândului** | câmpurile alese, sau toate: eticheta la stânga, valoarea la dreapta |
| **Tabel cu rândurile legate** | rândurile care desemnează acesta — rândurile unei facturi — sau cele pe care le desemnează o relație multiplă, cu coloanele alese și **totalurile** lor |
| **Întrerupere de pagină** | continuarea pe o pagină nouă |

Editorul arată alături PDF-ul pe care modelul îl face din rândul deschis, inclusiv
modificările.

Valorile se scriu **în limba modelului**: o sumă cu moneda ei („1 234,50 €”), o dată în litere
(„30 septembrie 2026”), da și nu, eticheta unei opțiuni, numele unei persoane. Textul este
compus cu fonturi încorporate care acoperă cele douăzeci de limbi ale basedb, ideograme
incluse.

## Fiecare cu permisiunile sale

Un document se citește **cu permisiunile celui care îl imprimă**: un câmp ascuns pentru el nu
figurează în el, un rând legat pe care nu îl vede nu este în tabel — nici în total. Două
persoane pot deci obține două documente diferite ale aceluiași rând: fiecare îl are pe al său.

## Prin API

```bash
# PDF-ul unui rând cu un model, sau „fișă”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listează modelele tabelului.

## Limite

- Nicio imagine (logo) și nicio culoare aleasă într-un document, niciun antet distinct de
  subsol.
- Un document pe rând: încă nu există PDF cu mai multe rânduri, nici generare printr-o
  automatizare.

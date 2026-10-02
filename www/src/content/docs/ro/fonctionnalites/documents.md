---
title: Documente PDF
description: Un rând transformat în factură, ofertă, fișă sau adeverință în culorile dumneavoastră, cu logo, rânduri legate și totaluri.
---

Un rând devine un **PDF**: o factură cu rândurile ei și totalul, un deviz, un aviz de
expediție, o fișă de produs, o adeverință. În fișa unui rând, butonul **Document PDF** îl
deschide într-un tab nou, de unde browserul îl imprimă sau îl salvează.

## Fișa, fără nimic de reglat

Fără model, un rând se imprimă ca **fișă**: numele lui ca titlu, apoi toate câmpurile pe care le
puteți citi, în limba dumneavoastră.

## Crearea unui model

Cine construiește tabelul — nivelul Gestionare — creează modelele din fișa unui rând:
**Document PDF › Șabloane de document…**. Un model nou începe de la un **punct de pornire**:

| Punct de pornire | Ce pune |
|---|---|
| **Factură** | antet cu logo și date de contact, „FACTURĂ”, număr și dată; client; rânduri facturate și totalul lor; recapitulare fără TVA / cu TVA; condiții de plată; mențiuni legale în subsol |
| **Ofertă** | titlu pe un bandou colorat, informații în grilă, prestații, valabilitate, zonă „Bun de acord” |
| **Fișă** | titlu mare pe toată lățimea, fotografia câmpului imagine, câmpuri în grilă, texte lungi |
| **Adeverință** | pagină peisaj încadrată, text centrat, semnătură |
| **Pagină goală** | un titlu și câmpurile rândului |

Este construit cu **coloanele tabelului dumneavoastră** — numărul său, data sa, sumele sale,
fotografia sa, rândurile care îi sunt legate — iar ce nu are tabelul este simplu lăsat la o
parte. Totul se schimbă apoi; previzualizarea, din dreapta, arată PDF-ul rândului deschis și
se actualizează la fiecare modificare.

## Conținutul: blocuri

Blocurile se succed de sus în jos; le **trageți** de mânerul lor pentru a le reordona, le
deschideți pentru a le regla.

| Bloc | Ce arată |
|---|---|
| **Titlu** | un titlu mare și un subtitlu, sobru, color, subliniat, sau pe un bandou — până la marginile paginii |
| **Text** | text formatat — titluri, aldin, liste, linkuri — care citează coloanele rândului cu meniul **Coloană**: „Factura `{{numero}}` din `{{date}}`”; alineat sau aliniat în bloc, pe fundal colorat, încadrat sau marcat cu o bară de culoare |
| **Imagine** | un logo, o ștampilă, sau fotografia unui câmp imagine al rândului |
| **Câmpurile rândului** | câmpurile alese, sau toate: eticheta la stânga, eticheta deasupra în grilă de 2 sau 3, sau **recapitulare** — valorile la dreapta, ultima (totalul datorat) cu aldin; câmpurile goale pot fi ascunse |
| **Tabel cu rândurile legate** | rândurile care desemnează acesta — rândurile unei facturi — sau cele pe care le desemnează o relație multiplă, cu **totalurile** lor; antet colorat, un rând din două colorat, antete, lățimi și alinieri de coloană la mâna dumneavoastră („Cant.” pentru „Cantitate”) |
| **Coloane** | două sau trei coloane una lângă alta, fiecare cu blocurile sale: „Facturat către” pe o parte, referințele pe cealaltă |
| **Separator**, **Spațiu** | o linie — scurtă pentru o semnătură — sau un gol |
| **Întrerupere de pagină** | continuarea pe o pagină nouă |

## Stilul și pagina

- **Culoare de accent** — cea a mărcii dumneavoastră: titluri, bandouri, antete de tabel,
  linkuri. Textul pus peste ea este alb sau întunecat, după ce se citește mai bine.
- **Culoarea textului**, **fontul** textului și al titlurilor (fără sau cu serife),
  **dimensiunea** textului, stilul intertitlurilor.
- **Format** (A4 sau Letter), **orientare**, **margini**, **cadru** simplu sau dublu în jurul
  paginii, conținut **centrat vertical** — pentru o adeverință.
- **Limba valorilor**: sumele se scriu cu moneda lor („1 234,50 €”), datele în litere
  („30 septembrie 2026”), da și nu, eticheta unei opțiuni, numele unei persoane. Textul este
  compus cu fonturi încorporate care acoperă cele douăzeci de limbi ale basedb, ideograme
  incluse.

## Antet și subsol de pagină

**Antetul** poartă **logo**-ul dumneavoastră — o imagine trimisă (PNG, JPEG sau SVG; o
imagine prea mare este redusă) sau câmpul imagine al rândului —, un text la stânga (datele
dumneavoastră de contact) și un text la dreapta (ce este documentul, numărul său, data sa), pe
prima pagină sau pe fiecare. **Subsolul de pagină** poartă mențiunile dumneavoastră legale și
numerele de pagină. Amândouă citează coloanele rândului, ca un text.

## Fiecare cu permisiunile sale

Un document se citește **cu permisiunile celui care îl imprimă**: un câmp ascuns pentru el nu
figurează în el — nici într-un text, nici într-o imagine —, un rând legat pe care nu îl vede
nu este în tabel — nici în total. Două persoane pot deci obține două documente diferite ale
aceluiași rând: fiecare îl are pe al său.

## Prin API

```bash
# PDF-ul unui rând cu un model, sau „fișă”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listează modelele tabelului.

## Limite

- O imagine trimisă cântărește cel mult 300 Ko, opt pe model; o imagine dintr-un câmp este
  reluată dacă este un PNG sau un JPEG.
- O valoare a unui rând legat se citează în afara tabelului printr-o **căutare** pe tabelul
  documentului; un total cu TVA este un câmp al tabelului.
- Un document pe rând: încă nu există PDF cu mai multe rânduri. O
  [automatizare](/basedb/ro/fonctionnalites/automatisations/#un-pdf-și-un-e-mail) poate face
  asta pentru dumneavoastră — **Generare PDF** — și o poate trimite ca atașament.

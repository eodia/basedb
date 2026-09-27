---
title: Interogări și vizualizări SQL
description: SQL pentru fiecare, cu propriile sale permisiuni; interogări salvate sub tabele, personale sau partajate; vizualizări PostgreSQL reale așezate printre tabele.
---

Tabelele dumneavoastră sunt tabele PostgreSQL reale, iar interfața le interoghează în SQL, sub
numele lor real. Fiecare membru al bazei poate scrie o interogare, o poate **salva** sub tabele
— doar pentru sine, pentru întreaga bază sau pentru câteva grupuri —, iar cine gestionează baza
poate face din ea o **vizualizare SQL**: o vizualizare PostgreSQL reală, așezată printre tabele,
pe care o citesc și `psql` și instrumentele dumneavoastră.

![O interogare salvată, deschisă din rubrica „Interogări”; deasupra, două vizualizări SQL așezate printre tabele](../../../../assets/screens/requete-sql.png)

## Fiecare cu permisiunile sale

Butonul **+** din bara de file sau meniul **⋯** al bazei → **Interogare SQL nouă** deschide o
filă SQL: un editor cu evidențiere și completare, **Ctrl+Enter** pentru execuție și rezultatul
în aceeași grilă ca tabelele dumneavoastră. Ce poate citi interogarea depinde de cine o
lansează:

- cu nivelul **Gestionare** pe bază, întreaga bază, inclusiv scrierile;
- cu nivelurile **Citire** sau **Editare**, interogarea se execută **doar în citire, cu
  propriile dumneavoastră permisiuni**. Un tabel care vă este închis nu există pentru ea; un
  câmp care vă este ascuns dispare din `SELECT *` și este refuzat dacă îl numiți, chiar și
  calificând tabelul; o scriere este refuzată. Rezultatul poartă eticheta **Permisiunile
  dumneavoastră**.

![Eticheta „Permisiunile dumneavoastră”: interogarea vede doar tabelele și câmpurile deschise persoanei](../../../../assets/screens/sql-vos-droits.png)

Nu ecranul face selecția: PostgreSQL însuși vă aplică permisiunile, coloană cu coloană, pe un
rol care vă este propriu. O interogare nu vă poate deci arăta nimic din ce nu v-ar arăta grila,
API-ul sau serverul MCP.

## Salvarea unei interogări

**Salvați**, în bara filei, așază interogarea sub tabelele bazei, la rubrica **Interogări**. Se
redeschide cu un clic; **⋯** → **Salvați ca…** face o copie, **Nume și partajare…** (în filă
sau în meniul ei din bara laterală) o redenumește, schimbă cine o vede sau o șterge.

![Salvarea unei interogări: numele ei, ce arată și cine o vede](../../../../assets/screens/requete-enregistrer.png)

| Domeniu | Cine o vede | Cine o poate crea și modifica |
|---|---|---|
| **Personală** — un lacăt | doar dumneavoastră | oricine vede baza, pentru sine |
| **Toată baza** | oricine vede baza | nivelul **Gestionare** pe bază |
| **Anumite grupuri** | membrii grupurilor alese | nivelul **Gestionare** pe bază |

**Partajarea unei interogări partajează textul ei, niciodată ceea ce poate citi autorul ei.**
Fiecare o execută cu propriile permisiuni: aceeași interogare, deschisă de două persoane, îi
arată fiecăreia ce are dreptul să vadă — sau îi spune că o coloană nu există pentru ea.

O interogare deschisă din bara laterală **se execută imediat, doar în citire**: îi vedeți
rezultatul fără să fi decis nimic. **Executați** o relansează apoi așa cum este. Un punct lângă
numele ei semnalează că i-ați schimbat textul de la salvare; **Salvați** o salvează acolo dacă
o puteți modifica și, altfel, propune să faceți una nouă.

## Vizualizările SQL

O **vizualizare SQL** este o vizualizare PostgreSQL reală din schema bazei. Își ocupă locul
**printre tabele**, cu culoarea și pictograma ei ca un tabel, și un mic **ochi** în dreapta care
arată că este o vizualizare. Un clic o deschide într-o filă: rândurile ei în grilă,
**Reîmprospătați** pentru a le reciti.

![Vizualizarea „Factures à encaisser”, deschisă din bara laterală](../../../../assets/screens/vue-sql.png)

Se creează din meniul **⋯** al bazei → **Vizualizare SQL nouă…** sau dintr-o filă SQL:
**⋯** → **Creați o vizualizare SQL…**, iar interogarea din filă devine definiția ei. Dialogul
cere:

- **eticheta** și **aspectul** ei — culoare, pictogramă sau imagine, alese ca pentru un tabel;
- **numele tehnic**, derivat din etichetă dacă nu dați unul — cel care se scrie după `FROM`;
- **interogarea**: un singur `SELECT`, pe tabelele și pe celelalte vizualizări ale bazei.
  PostgreSQL refuză ce refuză, iar editorul indică locul.

![Dialogul unei vizualizări SQL: etichetă și aspect, nume tehnic, interogare, descriere](../../../../assets/screens/vue-sql-dialogue.png)

Vizualizarea se citește apoi sub numele ei, din interfață, ca și din `psql` sau din instrumentul
dumneavoastră de BI:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**O vizualizare nu arată niciodată un câmp pe care nu îl vedeți.** Fiecare o citește cu
propriile permisiuni, pe fiecare tabel și fiecare coloană pe care le citește ea; bara laterală
o listează doar celor care pot citi tot ce citește ea. Nu citește decât **propria** bază: o
altă bază sau catalogul basedb sunt refuzate încă de la creare. Crearea, modificarea sau
ștergerea ei cer nivelul **Gestionare** pe bază.

### Când se schimbă structura

- **Redenumirea** unui tabel sau a unui câmp nu strică o vizualizare: PostgreSQL o urmează.
- **Schimbarea formulei** unui câmp calculat pe care îl citește o retrage pentru o clipă, apoi o
  repune pe noua coloană. Dacă nu mai este validă, rămâne **de corectat** — un triunghi o
  indică în bara laterală — cu definiția păstrată: **Editați vizualizarea…**, corectați,
  salvați.
- Un tabel nu este purjat cât timp o vizualizare îl citește, iar o vizualizare nu este ștearsă
  cât timp o altă vizualizare o citește: refuzul numește vizualizarea în cauză.

## Interogare, vizualizare SQL sau întrebare?

| | Ce este | Unde se află | Pentru |
|---|---|---|---|
| **Interogare salvată** | un text SQL | sub tabele, la rubrica „Interogări” | a regăsi o interogare, a o partaja ca text |
| **Vizualizare SQL** | o vizualizare PostgreSQL reală | printre tabele | a da un nume unei citiri, pentru interfață **și** pentru `psql`, scripturile, instrumentele dumneavoastră |
| **Întrebare** | o citire construită cu mouse-ul sau în SQL și reprezentarea ei vizuală | în [tablourile de bord](/basedb/ro/fonctionnalites/tableaux-de-bord/) | o cifră, un grafic, un tabel încrucișat, sub filtre |

## Limite

- Grila arată cel mult numărul de **rânduri pe pagină** ales în partea de jos a ecranului;
  „trunchiat” semnalează acest lucru. O interogare se oprește după 15 secunde.
- O vizualizare SQL se citește în SQL și în interfață; API-ul REST și serverul MCP nu o expun.
- O vizualizare SQL rămâne în mediul în care a fost creată: crearea unui mediu, compararea
  structurii sau salvarea unui șablon nu o preiau încă.

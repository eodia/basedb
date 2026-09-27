---
title: Istoric
description: Fiecare scriere, oricare i-ar fi originea, cu valorile de dinainte.
---

basedb înregistrează în istoric **fiecare scriere**, oricare i-ar fi originea: interfața,
API-ul, un agent MCP, un formular public — și chiar o interogare SQL scrisă de mână în `psql`.

![Istoricul unei baze](../../../../assets/screens/historique.png)

## Cum este captat

Nu de aplicație, ci de **triggere PostgreSQL**, chiar în tranzacția scrierii. O scriere care
eșuează nu lasă nicio urmă; o scriere care reușește nu poate lipsi din istoric. Reviziile sunt
apoi vărsate în jurnale imuabile, partiționate pe luni.

Identitatea circulă prin variabile de sesiune setate la începutul fiecărei tranzacții. O
scriere care nu le are — SQL direct — este înregistrată ca atare, împreună cu sesiunea care a
făcut-o (`psql`, adresă, proces): nu este refuzată din acest motiv.

| Actor | Afișat ca |
|---|---|
| o persoană | numele ei |
| un program (API) sau un agent (MCP) | persoana care a creat tokenul, „prin tokenul …” |
| un formular public | „Formular «…» · răspuns public” |
| o automatizare | „Automatizare «…» · în numele lui” persoana care răspunde de ea |
| SQL direct | „Sesiune SQL directă” |

## Ce puteți face cu el

- **Citiți** istoricul unui rând (fila „Istoric” din detaliile rândului), al unui tabel sau al
  unei baze (**Istoric**, în meniul **⋯** al bazei), filtrat pe tabel.
- **Anulați** o modificare: valorile de dinainte sunt reaplicate câmp cu câmp.
- **Restaurați** un rând șters din intrarea sa „a șters”.
- Urmăriți **istoricul structurilor** (fila „Structură”): tabele și câmpuri create, modificate,
  șterse.

## Anulare (Ctrl+Z)

În grilă, **Ctrl+Z** (⌘Z pe Mac) anulează ultima dumneavoastră scriere; **Ctrl+Shift+Z** sau
**Ctrl+Y** o refac. Un mesaj confirmă ce a fost anulat — „Anulat: modificarea «Montant»” — cu
un buton pentru a reveni asupra anulării.

Se anulează astfel o celulă, un card sau o bară mutată, un rând creat sau șters, o lipire — și
un import întreg, socotit ca un singur gest. Până la cincizeci de gesturi, filă cu filă.

Nu este o întoarcere în timp a ecranului: este o **scriere nouă**, făcută de server pe baza
istoricului și înregistrată și ea în istoric. Este refuzată dacă cineva a modificat rândul
între timp — „Anulare imposibilă: «Statut» a fost modificat între timp” — în loc să îi
suprascrie munca. Astfel nu vă puteți anula decât propriile scrieri, din ultimele douăzeci și
patru de ore, și niciodată structura. Într-o celulă în curs de editare, Ctrl+Z rămâne cel al
textului.

## Permisiuni

Istoricul urmează permisiunile de citire: un câmp ascuns pentru dumneavoastră nu apare în
reviziile pe care le citiți.

---
title: Colaborare
description: Comentarii și mențiuni, notificări, actualizări în timp real, prezență și un link către fiecare ecran.
---

Mai multe persoane lucrează în aceeași bază în același timp: fiecare vede sosind scrierile
celorlalți, știe cine se uită la ce și discută despre un rând chiar acolo unde se află acesta.

## Comentarii

Detaliile unui rând au o filă **Comentarii**, între „Detalii” și „Istoric”. Tastați `@` pentru
a **menționa** un membru, Ctrl+Enter pentru a trimite. Fiecare își poate edita sau șterge
propriile comentarii.

![O conversație despre un proiect](../../../../assets/screens/commentaires.png)

Este suficient să puteți citi rândul pentru a-l comenta. O persoană menționată care nu îl
poate citi nu este anunțată — iar autorul este avertizat, în loc să creadă că mesajul a plecat.

## Notificări

Clopoțelul, din dreapta sus, numără ce nu a fost citit. Acolo sosesc patru lucruri:

- cineva vă **menționează** într-un comentariu;
- cineva **răspunde** într-o conversație în care ați scris;
- cineva vă **desemnează** într-un câmp Persoană — din interfață, din API, dintr-un formular
  sau dintr-o automatizare;
- o [automatizare](/basedb/ro/fonctionnalites/automatisations/) vă **anunță**.

Deschiderea unei notificări deschide rândul. **Marcați totul ca citit** golește contorul;
notificările sunt păstrate 90 de zile.

![O mențiune primită](../../../../assets/screens/notifications.png)

## Timp real

Scrierile celorlalți apar **fără reîncărcare**: o celulă modificată, un card mutat, un rând
adăugat — fie că vin din interfață, din API, de la un agent sau din SQL direct. Serverul
trimite doar un **semnal**, niciodată date: ecranul este cel care recitește, cu permisiunile
dumneavoastră. O celulă pe care o modificați nu este niciodată înlocuită în timp ce lucrați
în ea.

## Prezență

Fețele persoanelor care se uită la **același tabel** apar în partea de sus a ecranului; ale
celor care au deschis **același rând**, în antetul detaliilor rândului. În grilă, cursorul
celorlalți apare pe celula peste care trec.

## Un link către fiecare ecran

Adresa din browser urmărește ce priviți: un tabel, una dintre vizualizările lui, detaliile unui
rând, un tablou de bord, o automatizare, o întrebare, setările dumneavoastră. Copiați-o
într-un mesaj: colegul dumneavoastră ajunge în același loc, cu propriile permisiuni. Adăugați-o
la favorite; butoanele înainte și înapoi ale browserului vă readuc unde ați fost.

| Adresă | Ce deschide |
|---|---|
| `/bases/ventes/tables/opportunites` | tabelul „Opportunités” al bazei „Ventes” |
| `/bases/ventes/tables/opportunites?vue=…` | una dintre vizualizările lui |
| `/bases/ventes/tables/opportunites?ligne=…` | detaliile unuia dintre rândurile lui |
| `/bases/ventes/tableaux-de-bord/…` | un tablou de bord |
| `/bases/ventes/automatisations/…` | o automatizare |
| `/parametres/apparence` | setările dumneavoastră |

O adresă numește un **loc**, nu starea în care ați lăsat-o: filtrele, sortările și lățimile
coloanelor rămân cele ale fiecărui browser. O bază și un tabel sunt scrise acolo prin numele lor
PostgreSQL: redenumite, vechea adresă nu mai duce nicăieri. O adresă care nu duce nicăieri — o
greșeală de tastare, un obiect șters, sau ceva ce nu aveți dreptul să vedeți — afișează „Această
pagină nu există”.

## Anulare

Ctrl+Z anulează ultima dumneavoastră scriere — consultați [istoricul](/basedb/ro/fonctionnalites/historique/#anulare-ctrlz).

## Limite

- Notificările rămân în basedb: deocamdată niciuna nu este trimisă prin e-mail.
- Peste o sută de rânduri modificate dintr-odată, ecranul reîncarcă întreaga pagină în loc să
  procedeze rând cu rând.

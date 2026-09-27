---
title: Formulare partajate
description: Partajați un formular printr-un link, public sau rezervat membrilor conectați.
---

Un formular sau un chestionar se **partajează printr-un link** `/f/<jeton>`. Persoana care
răspunde nu are nevoie de **nicio permisiune asupra tabelului**: fiecare răspuns adaugă un
rând și nimic altceva din tabel nu îi este arătat. Pentru a arăta rânduri în loc să le
primiți, o vizualizare se partajează [doar în citire](/basedb/ro/fonctionnalites/vues-partagees/).

![Dialogul de partajare](../../../../assets/screens/partage-formulaire.png)

## Cine poate răspunde

| Acces | Cine răspunde | Ce se afișează |
|---|---|---|
| **Public** | oricine are linkul, fără cont | doar formularul |
| **Membri conectați** | un membru al spațiului de lucru — la nevoie, doar din anumite grupuri | conectarea, apoi formularul și „Răspundeți ca …” |

Pagina linkului este în afara aplicației: fără bară laterală, fără numele bazei, fără alte
rânduri.

![Un formular public](../../../../assets/screens/formulaire-public.png)

## În numele cui este scris răspunsul

Rândul se scrie sub **autoritatea persoanei care a publicat partajarea** — ultima care a
salvat-o. Dreptul ei de a crea rânduri este verificat **la fiecare răspuns**, limitat la
întrebările formularului: dacă îl pierde, formularul este suspendat până când cineva care are
acest drept îl salvează din nou.

Istoricul spune cine a răspuns, nu cine a publicat:

- un răspuns de la un **membru** este atribuit persoanei;
- un răspuns **public** este atribuit formularului însuși: „Formular «Demande de devis» ·
  răspuns public · publicat de Camille”.

## Deschidere și închidere

Dialogul setează:

- comutatorul **Link activ**;
- o **dată de închidere**;
- un **număr maxim de răspunsuri** — exact, chiar și la răspunsuri simultane;
- **Regenerați linkul**: cel vechi încetează imediat să funcționeze;
- **Opriți partajarea**: linkul dispare, răspunsurile rămân în tabel.

Un formular închis spune acest lucru într-o frază, chiar înainte de a cere conectarea.

## Limite

- Întrebările de tip **relație**, **fișier** și **imagine** nu sunt puse printr-un link
  partajat; dialogul le semnalează.
- Trimiterea este limitată la 20 de răspunsuri pe minut, pe adresă și pe link. În spatele
  proxy-ului furnizat (Caddy), adresa este cea a vizitatorului.

Detaliile se află în [capitolul 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
al documentului de arhitectură.

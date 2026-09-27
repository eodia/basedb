---
title: Vizualizări partajate
description: Arătați o vizualizare doar în citire printr-un link, încorporați-o într-un site, abonați-vă la un calendar.
---

O vizualizare de date — grilă, kanban, calendar, cronologie, galerie, listă — se **partajează
doar în citire**: un link `/v/<jeton>` o arată celor care nu pot deschide basedb, fără a
permite să se scrie ceva. Este corespondentul [formularelor partajate](/basedb/ro/fonctionnalites/formulaires-partages/),
care permit să se răspundă fără a lăsa să se citească nimic. Un [tablou de bord](/basedb/ro/fonctionnalites/tableaux-de-bord/#partajarea-unui-tablou-de-bord)
se partajează în același mod.

## Partajare

Meniul vizualizării → **Partajați…**, apoi:

| Acces | Cine citește |
|---|---|
| **Public** | oricine are linkul, fără cont |
| **Membri conectați** | un membru al spațiului de lucru, după conectare — la nevoie, doar din anumite grupuri |

![Partajarea unui calendar](../../../../assets/screens/partage-vue.png)

Comutatorul **Link activ** suspendă linkul fără a-l pierde. Pagina se deschide în afara
aplicației: fără bară laterală, fără numele bazei, fără numele tabelului — vizualizarea,
filtrele ei, coloanele ei și nimic altceva. Un calendar sau o cronologie se citește acolo ca o
agendă.

![Același calendar, deschis prin linkul său](../../../../assets/screens/vue-partagee.png)

## În numele cui se citește

Vizualizarea se citește cu **permisiunile persoanei care a publicat-o**, reevaluate la fiecare
citire: un câmp ascuns pentru ea nu se afișează, iar dacă pierde accesul la tabel, linkul nu
mai arată nimic.

## Încorporarea în alt site

Bifați **Permiteți încorporarea în alt site**: dialogul oferă un **cod de încorporare**
`<iframe>`, de lipit într-un intranet, un wiki, un site de prezentare. Fără această casetă,
pagina refuză să fie afișată în cadrul unui alt site.

## Un calendar în agenda dumneavoastră

Pentru un calendar sau o cronologie partajate **public**, dialogul oferă **adresa fluxului de
calendar**: un flux iCalendar (`…/calendar.ics`, cel mult 1 000 de evenimente) la care se pot
abona Google Calendar, Outlook sau Apple Calendar. Termenele echipei apar în agenda fiecăruia
și urmează tabelul.

## O sursă pentru alte baze

Un link public oferă și **adresa API a vizualizării**: rândurile pe care le arată, în JSON. Un
[tabel sincronizat](/basedb/ro/integrations/synchronisation/) — pe această instanță sau pe alta
— o poate lua drept sursă.

## Limite

- Citirea este limitată la 120 de cereri pe minut, pe adresă și pe link.
- Un formular nu se partajează în citire: se partajează [pentru a primi răspunsuri](/basedb/ro/fonctionnalites/formulaires-partages/).

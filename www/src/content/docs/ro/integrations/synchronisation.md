---
title: Slack, calendare și tabele sincronizate
description: Anunțați un canal Slack, conectați un calendar, țineți un tabel la zi dintr-un CSV, dintr-un calendar sau din altă bază.
---

Ecranul **Integrări** al unei baze se deschide din meniul profilului, din stânga jos. Cere
nivelul **Gestionare** și reunește ce leagă baza de restul instrumentelor dumneavoastră.

![Ecranul Integrări al unei baze](../../../../assets/screens/integrations.png)

## Slack

**Conectați un canal**: în Slack, creați un *webhook de intrare* pentru canalul dorit, apoi
lipiți adresa lui (`https://hooks.slack.com/…`, singura origine acceptată). **Testați** trimite
un mesaj de probă. Adresa este criptată imediat ce este salvată și nu mai este afișată
niciodată.

Canalul conectat devine apoi o acțiune a [automatizărilor](/basedb/ro/fonctionnalites/automatisations/):
**Trimiteți pe Slack**, cu un mesaj care citează rândul — „Recenzie negativă nouă de la
{{Auteur}}: {{Avis}}”.

## Calendare

Două sensuri, două mijloace:

- **Vedeți o vizualizare într-un calendar**: partajați public o vizualizare calendar sau
  cronologie; dialogul ei de partajare oferă adresa unui **flux iCalendar**, la care vă abonați
  din Google Calendar („Alte calendare” → „Din adresa URL”), Outlook sau Apple Calendar.
  Consultați [Vizualizări partajate](/basedb/ro/fonctionnalites/vues-partagees/#un-calendar-în-agenda-dumneavoastră).
- **Importați un calendar**: creați un tabel sincronizat cu sursa „Calendar” și cu adresa iCal
  secretă a calendarului.

## Tabele sincronizate

Un tabel sincronizat este **ținut la zi dintr-o sursă**: se citește, se filtrează și se arată
în vizualizări ca celelalte, dar nu se scrie manual — o insignă „Sincronizat” vă amintește
acest lucru, iar API-ul refuză orice scriere (`TABLE_SYNCED`).

| Sursă | Ce devine tabelul |
|---|---|
| **Fișier CSV online** | câte o coloană pentru fiecare coloană a fișierului, tipizată după conținutul ei: număr, dată sau text |
| **Calendar** (Google Calendar, iCalendar) | un eveniment pe rând: titlu, început, sfârșit, loc, descriere |
| **Vizualizare partajată dintr-un basedb** | rândurile unei [vizualizări partajate](/basedb/ro/fonctionnalites/vues-partagees/#o-sursă-pentru-alte-baze), pe această instanță sau pe alta |

**Tabel sincronizat nou** alege sursa și intervalul — de la o dată la 15 minute până la o dată
pe zi; **Sincronizați** o recitește imediat. Fiecare trecere creează, modifică și șterge ce este
necesar pentru ca tabelul să semene cu sursa, orientându-se după un câmp **Cheie de
sincronizare**. Toate aceste scrieri trec prin istoric.

**Opriți** sincronizarea face tabelul unul obișnuit: rândurile lui rămân și se pot scrie din
nou manual.

## Limite

- O sursă este citită în limita a 5 MB, 10 000 de rânduri și 10 secunde.
- O sursă eșuată nu șterge nimic: tabelul își păstrează rândurile până la trecerea următoare.
- O coloană apărută în sursă după creare nu este adăugată.
- Slack se conectează printr-un webhook de intrare, încă nu printr-o aplicație Slack.

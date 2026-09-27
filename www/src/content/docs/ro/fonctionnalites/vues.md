---
title: Vizualizări
description: Grilă, kanban, calendar, cronologie, galerie, listă, formular și chestionar — colaborative sau personale.
---

Un tabel se arată în **opt moduri**. O vizualizare nu copiază nicio dată și nu dă nicio
permisiune în plus față de tabelul însuși.

:::note
Aceste vizualizări sunt moduri de a arăta **un** tabel. O [vizualizare SQL](/basedb/ro/fonctionnalites/requetes-et-vues-sql/)
este altceva: o vizualizare PostgreSQL reală, scrisă în SQL pe tabelele bazei și așezată
printre ele în bara laterală.
:::

| Vizualizare | Ce arată | De ce are nevoie |
|---|---|---|
| **Grilă** | rânduri filtrate, sortate, grupate, cu coloanele alese | — |
| **Kanban** | carduri pe coloane | o selecție unică |
| **Calendar** | rânduri la data lor, pe lună sau pe săptămână | un câmp de tip dată |
| **Cronologie** | bare între două date și dependențele lor | o dată de început |
| **Galerie** | carduri, cu o imagine de copertă | — |
| **Listă** | un rând pe înregistrare, în grupuri care se pot restrânge | — |
| **Formular** | o pagină de întrebări pentru a crea un rând | — |
| **Chestionar** | aceleași întrebări, câte una pe ecran | — |

## Selectorul de vizualizări

Se află în stânga butonului „Filtrați”. „Toate rândurile” este grila tabelului, pe care nimeni
nu a salvat-o și nimeni nu o poate șterge; urmează **vizualizările colaborative**, în ordinea
aleasă de cine construiește baza, apoi **Vizualizările mele**.

- O **vizualizare colaborativă** este văzută de toți. Crearea, configurarea, redenumirea,
  reordonarea sau ștergerea ei cer nivelul **Gestionare**. Poate fi **blocată**: un lacăt
  indică acest lucru și nimeni nu o mai modifică înainte de a o debloca.
- O **vizualizare personală** este văzută doar de dumneavoastră și cere doar posibilitatea de
  a citi tabelul. **Creați o vizualizare personală** sau **Salvați ca vizualizare** după ce ați
  filtrat și sortat: fiecare își păstrează propriile moduri de citire, fără a schimba nimic
  pentru ceilalți. **Duplicați**, pe o vizualizare colaborativă, face din ea o copie personală.

![O galerie de clienți](../../../../assets/screens/galerie.png)

## Bara de instrumente

Deasupra grilei, în această ordine:

- **Filtrați** combină condiții pe câmpuri;
- **Coloane** alege ce se afișează — coloanele de sistem sunt separate, sub
  „Informații de sistem”;
- **Grupați** așază rândurile după un câmp cu valoare unică — selecție unică, relație,
  persoană, dată, număr, text, casetă de selectare… — în grupuri care se pot restrânge, fiecare
  cu numărătoarea sa pe întregul filtru;
- **Culori** colorează rândurile după o selecție unică sau după **reguli** — un filtru și o
  culoare, cel mult douăzeci — ca linie, ca fundal sau ambele;
- **Înălțimea rândurilor**: scurtă, medie, înaltă, foarte înaltă;
- **Căutați…**, în dreapta, caută în toate coloanele pe măsură ce tastați; Esc golește
  căutarea. Funcționează și pentru kanban, calendar, cronologie, galerie și listă și nu este
  niciodată salvată în vizualizare.

Sub fiecare coloană, un **Rezumat** calculat pe toate rândurile filtrului, nu doar pe pagină:
completate, goale, valori unice, sumă, medie, minim, maxim, casete bifate.

## Kanban, calendar, cronologie

- **Kanbanul** așază cardurile după o selecție unică; tragerea unui card modifică rândul, un
  „+” în capul coloanei creează un rând care are deja această opțiune. Fiecare card arată un
  titlu, o imagine de copertă, câmpurile alese și o **descriere** care citează valorile
  rândului — „Livrare prevăzută pe `{{Date}}` pentru `{{Client}}`” —, scrisă în setările
  vizualizării cu butonul **Inserați un câmp**.
- **Calendarul** plasează fiecare rând la data sa, cu o eventuală dată de sfârșit; tragerea
  unui rând de pe o zi pe alta îl mută.
- **Cronologia** trasează bare între o dată de început și o dată de sfârșit, grupate după o
  selecție unică sau o relație. Cu setarea **Depinde de** — o relație a tabelului către el
  însuși — o săgeată leagă fiecare sarcină de cele de care depinde, roșie atunci când merge
  înapoi în timp.

![O cronologie cu dependențele ei](../../../../assets/screens/chronologie.png)

![Un calendar după termen](../../../../assets/screens/calendrier.png)

## Galerie și listă

- **Galeria** arată carduri: o **imagine de copertă** (decupată sau întreagă), o dimensiune
  (carduri mici, medii, mari), o culoare după o selecție unică.
- **Lista** arată un rând pe înregistrare, **grupat** după o selecție unică, o relație sau o
  persoană.

![O listă de clienți, grupată pe sectoare](../../../../assets/screens/liste.png)

În kanban, galerie și listă, cardurile și rândurile se **ordonează manual** prin tragere — până
la 5 000; o sortare aleasă are prioritate față de această ordine.

## Formular și chestionar

Bifați întrebările și ordonați-le; fiecare are un enunț, un text de ajutor și poate fi făcută
obligatorie. Formularul are titlul său, prezentarea sa, eticheta butonului și mesajul de
mulțumire. Se completează în basedb sau se [partajează printr-un link](/basedb/ro/fonctionnalites/formulaires-partages/).

## Partajarea unei vizualizări

O vizualizare de date — grilă, kanban, calendar, cronologie, galerie, listă — se **partajează
doar în citire** printr-un link, se încorporează în alt site, iar un calendar devine un flux de
calendar. Consultați [Vizualizări partajate](/basedb/ro/fonctionnalites/vues-partagees/).

## Ce nu vede cititorul

O vizualizare este **reproiectată pentru cititorul ei**: un câmp ascuns pentru acesta dispare
din coloane, din carduri și din întrebări. O vizualizare al cărei filtru citează un câmp ascuns
nu este arătată deloc: arătată fără filtrul ei, ar dezvălui mai mult decât a fost făcută să
arate.

---
title: Căutare
description: Un singur câmp pentru a găsi tot — tabele, vizualizări, tablouri de bord, rânduri, comenzi — și pentru a pune o întrebare lui Copilot. Ctrl+K.
---

Câmpul **Căutați tabele, rânduri, comenzi…**, în centrul barei de sus, deschide căutarea: un
singur câmp pentru tot ce puteți atinge în basedb. **Ctrl+K** (**⌘K** pe Mac) o deschide sau o
închide din orice ecran — cu excepția unui editor de text, unde adaugă un link.

## Ce găsește

| | |
|---|---|
| **Tabele și obiecte** | proiectele și bazele pe care le vedeți; tabelele, vizualizările SQL și interogările salvate; vizualizările tabelelor bazei deschise, inclusiv cele personale; întrebările, tablourile de bord și automatizările bazelor proiectului; coloanele tabelelor; filele deschise |
| **Rânduri** | datele înseși, în tabelele bazei deschise: textul coloanelor, opțiunile listelor, un număr exact — de la două caractere. Un identificator de rând lipit găsește rândul lui |
| **Comenzi** | ceea ce știe să facă aplicația: mergeți la structură, la istoric, la tablourile de bord ale bazei; creați un tabel, o întrebare, o interogare SQL, o bază, un proiect, porniți de la un șablon; importați într-un tabel; anulați sau restabiliți ultima scriere; închideți sau schimbați fila; schimbați tema; deschideți Copilot; **Copiați linkul acestei pagini**; deschideți o filă de setări sau de administrare; deconectați-vă |
| **Copilot** | o întrebare în limbaj natural, încredințată lui Copilot |

**Enter** deschide rezultatul ales: un rând se deschide în tabelul lui, în fișa lui. Pe un ecran
mare, un panou din dreapta arată o previzualizare — valorile unui rând, coloanele și descrierea
unui tabel, descrierea unui tablou de bord sau a unei automatizări. Lipiți o adresă de basedb:
**Deschideți acest link** vă duce acolo (vedeți
[un link către fiecare ecran](/basedb/ro/fonctionnalites/collaboration/#un-link-către-fiecare-ecran)).

Câmpul gol propune **recentele** dumneavoastră, filele deschise, tabelele bazei și câteva
sugestii.

## Tastați așa cum gândiți

- **Fără diacritice și fără majuscule**: `clienti` găsește „Clienți”.
- **Începuturi de cuvinte și inițiale**: `cn` pentru „Client nou”, `tabnou` pentru „Tabel nou”.
- **O greșeală de tastare iertată** — o literă uitată, dublată, înlocuită sau inversată, două
  într-un cuvânt de peste șapte litere —, niciodată pe prima literă.
- **Fiecare cuvânt tastat trebuie să se regăsească undeva**, în nume sau în ceea ce îl conține:
  `vanzari clienti` găsește tabelul „Clienți” din baza „Vânzări”. Tipul se tastează și el:
  `vizualizare`, `automatizare`, `tablou de bord`.
- **Un tabel, apoi ce se caută în el**: `clienti cluj` caută „cluj” în rândurile tabelului
  „Clienți”.

În frunte, **cel mai bun rezultat**; ce deschideți des și recent urcă. Această memorie rămâne în
browserul dumneavoastră.

## Restrângerea căutării

Pastilele de sub câmp — **Toate**, **Tabele și obiecte**, **Rânduri**, **Comenzi**, **Copilot** —
restrâng ce se caută. Un prim caracter face același lucru:

| Tastați mai întâi | Pentru a căuta |
|---|---|
| `#` | doar tabelele și obiectele |
| `/` | doar rândurile |
| `>` | doar comenzile |
| `?` | o întrebare pentru Copilot |

**Tab**, pe un tabel sau o bază, caută **înăuntru**: numele lui se afișează în câmp, iar
căutarea nu mai poartă decât asupra rândurilor, vizualizărilor, coloanelor și comenzilor lui.
Câmpul gol arată atunci ultimele douăzeci de rânduri modificate. **⌫**, cu câmpul gol, iese din
el; **Esc** revine cu un pas, apoi închide.

## Întrebați Copilot

Fiecare căutare se termină cu **Întrebați Copilot: „…”**, plasat în frunte când textul se
citește ca o întrebare — se termină în „?”, începe cu „câți”, „care”, „arată”…, sau numără cinci
cuvinte sau mai multe. Copilot se deschide pe bază și primește întrebarea ca și cum ați fi
tastat-o dumneavoastră. Citește structura, nu rândurile, cu excepția cazului în care bifați
**Permiteți citirea datelor**, iar el propune: nimic nu se schimbă înainte să aplicați. Este
nevoie ca AI-ul să fie configurat pe instanță — vedeți
[Inteligență artificială](/basedb/ro/fonctionnalites/ia/).

## Permisiuni și limite

Căutarea trece prin aceleași căi ca restul ecranului, **cu permisiunile dumneavoastră**: un
tabel sau o coloană care vă este închisă nu apare, nici printre obiecte, nici în rânduri.
Automatizările sunt propuse doar celui care are nivelul **Gestionare** pe baza lor.

- Rândurile sunt căutate în baza deschisă, sau în baza ori tabelul în care ați intrat prin Tab:
  trei rânduri pe tabel, pe cel mult douăzeci și patru de tabele; douăzeci de rânduri într-un
  tabel.
- Întrebările, tablourile de bord și automatizările sunt cele ale proiectului deschis (cel mult
  opt baze), recitite din nou la cel mult două minute.
- Fiecare grup arată câteva rezultate, apoi **Alte N rezultate**, care îl deschide în întregime.

## Comenzi rapide de la tastatură

**Comenzi rapide**, în partea de jos a căutării, sau comanda **Comenzi rapide de la tastatură**,
le arată pe toate. **Ctrl** se citește **⌘** pe Mac.

| Taste | Efect |
|---|---|
| **Ctrl+K** | deschide sau închide căutarea |
| **↑** **↓**, **Enter** | parcurge rezultatele, deschide rezultatul |
| **Alt+W** | închide fila |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | fila următoare, fila anterioară |
| clic pe rotița mausului | închide o filă |
| **Ctrl+A**, **Ctrl+C** | în grilă, selectează tot, copiază celulele alese |
| **Ctrl+clic** | urmărește o relație |
| **Ctrl+Z**, **Ctrl+Y** | anulează ultima scriere, o restabilește |
| **Ctrl+Enter** | trimite un comentariu, salvează o descriere |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | într-un text: aldin, cursiv, link |

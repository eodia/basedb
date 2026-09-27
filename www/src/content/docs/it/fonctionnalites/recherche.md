---
title: Ricerca
description: Un solo campo per trovare tutto — tabelle, viste, dashboard, righe, comandi — e per porre una domanda al Copilot. Ctrl+K.
---

Il campo **Cerca tabelle, righe, comandi…**, al centro della barra in alto, apre la ricerca: un
solo campo per tutto ciò che puoi raggiungere in basedb. **Ctrl+K** (**⌘K** su Mac) la apre o la
chiude da qualsiasi schermata — tranne che in un editor di testo, dove aggiunge invece un link.

## Cosa trova

| | |
|---|---|
| **Tabelle e oggetti** | i progetti e i database che vedi; le tabelle, viste SQL e query salvate; le viste delle tabelle del database aperto, comprese quelle personali; le domande, dashboard e automazioni dei database del progetto; le colonne delle tabelle; le tab aperte |
| **Righe** | i dati stessi, nelle tabelle del database aperto: il testo delle colonne, le opzioni delle liste, un numero esatto — a partire da due caratteri. Un identificativo di riga incollato trova la sua riga |
| **Comandi** | ciò che l’applicazione sa fare: andare alla struttura, alla cronologia, alle dashboard del database; creare una tabella, una domanda, una query SQL, un database, un progetto, partire da un modello; importare in una tabella; annullare o ripristinare l’ultima scrittura; chiudere o cambiare tab; cambiare tema; aprire il Copilot; **Copia il link di questa pagina**; aprire una tab delle impostazioni o dell’amministrazione; uscire |
| **Copilot** | una domanda in linguaggio naturale, affidata al Copilot |

**Invio** apre il risultato scelto: una riga si apre nella sua tabella, sui suoi dettagli. Su uno
schermo grande, un pannello a destra ne mostra l’anteprima — i valori di una riga, le colonne e la
descrizione di una tabella, la descrizione di una dashboard o di un’automazione. Incolla un
indirizzo di basedb: **Apri questo link** ti ci porta (vedi
[un link per ogni schermata](/basedb/it/fonctionnalites/collaboration/#un-link-per-ogni-schermata)).

Il campo vuoto propone i tuoi **recenti**, le tab aperte, le tabelle del database e alcuni
suggerimenti.

## Digita come pensi

- **Né accenti né maiuscole**: `citta` trova «Città».
- **Inizi di parola e iniziali**: `nc` per «Nuovo cliente», `nuovtab` per «Nuova tabella».
- **Un errore di battitura perdonato** — una lettera dimenticata, raddoppiata, sostituita o
  invertita, due in una parola di più di sette lettere —, mai sulla prima lettera.
- **Ogni parola digitata deve trovarsi da qualche parte**, nel nome o in ciò che lo contiene:
  `vendite clienti` trova la tabella «Clienti» del database «Vendite». Si può digitare anche il
  tipo: `vista`, `auto`, `dashboard`.
- **Una tabella, poi ciò che si cerca al suo interno**: `clienti milano` cerca «milano» nelle
  righe della tabella «Clienti».

In cima, il **miglior risultato**; ciò che apri spesso e di recente sale in alto. Questa memoria
resta nel tuo browser.

## Restringere la ricerca

I badge sotto il campo — **Tutto**, **Tabelle e oggetti**, **Righe**, **Comandi**, **Copilot** —
restringono ciò che viene cercato. Anche un primo carattere fa lo stesso:

| Digita prima | Per cercare |
|---|---|
| `#` | solo tabelle e oggetti |
| `/` | solo righe |
| `>` | solo comandi |
| `?` | una domanda al Copilot |

**Tab**, su una tabella o un database, cerca **al suo interno**: il suo nome compare nel campo, e
la ricerca riguarda allora solo le sue righe, le sue viste, le sue colonne e i suoi comandi. Il
campo vuoto mostra allora le venti righe modificate più di recente. **⌫**, a campo vuoto, ne esce;
**Esc** torna indietro di un passo, poi chiude.

## Chiedere al Copilot

Ogni ricerca finisce con **Chiedi al Copilot: «…»**, messo in cima quando il testo si legge come
una domanda — finisce con «?», comincia con «quanti», «quale», «mostra»…, oppure conta cinque
parole o più. Il Copilot si apre sul database e riceve la domanda come se l’avessi digitata lì.
Legge la struttura, non le righe, a meno che tu non spunti **Consenti la lettura dei dati**, e
propone: nulla cambia finché non applichi. Serve che l’IA sia configurata sull’istanza — vedi
[Intelligenza artificiale](/basedb/it/fonctionnalites/ia/).

## Permessi e limiti

La ricerca passa per le stesse route del resto dello schermo, **con i tuoi permessi**: una
tabella o una colonna che ti è preclusa non compare, né tra gli oggetti né nelle righe. Le
automazioni sono proposte solo a chi ha il livello **Gestione** sul loro database.

- Le righe sono cercate nel database aperto, o nel database o nella tabella in cui sei entrato con
  Tab: tre righe per tabella, su ventiquattro tabelle al massimo; venti righe in una tabella.
- Le domande, dashboard e automazioni sono quelle del progetto aperto (otto database al massimo),
  rilette al massimo ogni due minuti.
- Ogni gruppo mostra alcuni risultati, poi **N altri risultati**, che lo apre per intero.

## Scorciatoie da tastiera

**Scorciatoie**, in fondo alla ricerca, o il comando **Scorciatoie da tastiera**, le mostra tutte.
**Ctrl** si legge **⌘** su Mac.

| Tasti | Effetto |
|---|---|
| **Ctrl+K** | aprire o chiudere la ricerca |
| **↑** **↓**, **Invio** | scorrere i risultati, aprire il risultato |
| **Alt+W** | chiudere la tab |
| **Ctrl+Tab**, **Ctrl+Maiusc+Tab** | tab successiva, tab precedente |
| clic con la rotellina | chiudere una tab |
| **Ctrl+A**, **Ctrl+C** | nella griglia, selezionare tutto, copiare le celle scelte |
| **Ctrl+clic** | seguire una relazione |
| **Ctrl+Z**, **Ctrl+Y** | annullare l’ultima scrittura, ripristinarla |
| **Ctrl+Invio** | inviare un commento, salvare una descrizione |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | in un testo: grassetto, corsivo, link |

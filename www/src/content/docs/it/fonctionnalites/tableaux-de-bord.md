---
title: Dashboard
description: Domande poste con il mouse o in SQL, quindici modi per mostrarle e configurarle, dashboard a griglia, a tab, sotto filtri comuni — lette con i permessi di ciascuno, e condivise tramite link.
---

Una **dashboard** riunisce in una pagina ciò che un team guarda ogni giorno: i
numeri che contano, la loro evoluzione mese dopo mese, la ripartizione di uno stato, le
prossime scadenze. Ogni scheda mostra una **domanda** — una lettura del database,
costruita con il mouse o scritta in SQL — e dei **filtri** in cima alla pagina controllano le
schede a cui sono collegati.

![La dashboard «Pilotage de l’agence»: tendenza del mese, obiettivo, fatturato in pila, sentiment delle recensioni](../../../../assets/screens/tableaux-de-bord.png)

Tutto si apre da **Dashboard**, nel riquadro del database aperto in fondo alla barra
laterale. A sinistra, le dashboard e le domande salvate del database, e
**Esplora i dati** per porre una domanda senza salvare nulla. Ogni lettore del database
le consulta, le esplora e salva le proprie domande; creare una dashboard e condividere una
domanda richiedono il livello **Gestione**.

Una domanda salvata è **personale** — solo tu la vedi —, per **tutto il database** o per
**gruppi**. Il suo menu, con un clic destro o tramite **⋯**, la apre in una tab accanto alle
tabelle, cambia il suo nome e la sua condivisione, oppure la elimina. Il **+** della barra delle
tab propone anche **Nuova domanda** e **Nuova domanda SQL**.

**Salva**, nell’intestazione di una domanda, la conserva; una domanda che non puoi modificare
propone invece **Salva una copia**, che diventa tua. **⋯** (**Altre azioni**) offre anche **Nome
e condivisione…**, **Salva una copia…** e **Elimina la domanda**; una tab che la mostrava
conserva il suo contenuto, tornato non salvato.

## Porre una domanda con il mouse

Una domanda si costruisce per passaggi, uno sotto l’altro:

![L’editor di una domanda: i dati, i filtri, il riepilogo per mese](../../../../assets/screens/question-editeur.png)

| Passaggio | Cosa vi si sceglie |
|---|---|
| **Dati** | la tabella di partenza, e le colonne mostrate quando nulla è riepilogato |
| **Unisci dati** | un’altra tabella del database, collegata da una relazione — proposta automaticamente — o da due colonne dello stesso tipo; join sinistro, interno, destro o completo |
| **Filtro** | per colonna, con ciò che il suo tipo propone: è / non è, contiene, tra, vuoto…; per una data, un **periodo**: oggi, gli ultimi 30 giorni, questo mese, il trimestre scorso, dal … al …; oppure un’espressione scritta come nella barra delle viste |
| **Riepiloga** | misure — numero di righe, somma, media, mediana, minimo, massimo, valori distinti, deviazione standard, somme cumulative — **per** da una a tre colonne |
| **Ordina**, **Limita** | l’ordine delle righe, e quante al massimo |

Una data si raggruppa **per giorno, settimana, mese, trimestre o anno**, oppure per posizione — giorno della
settimana, mese dell’anno, ora del giorno; un numero, per fasce. Una selezione multipla
conta ogni riga in ciascuna delle sue scelte. I periodi si leggono nel tuo fuso orario e la
settimana inizia dal giorno indicato nelle tue impostazioni.

**Visualizza** esegue la domanda. Il risultato si mostra nel modo più adatto — un
numero, una linea, delle barre, una tabella — e si cambia in fondo allo schermo:

| Visualizzazione | Per mostrare |
|---|---|
| **Numero**, **Tendenza**, **Avanzamento**, **Indicatore** | un valore; l’ultimo periodo rispetto al precedente e allo stesso dell’anno scorso; l’avanzamento verso un obiettivo |
| **Istogramma**, **Barre**, **Linee**, **Aree**, **Combinato** | misure lungo una dimensione, in serie affiancate, in pila o al 100% |
| **Torta**, **Imbuto** | quote, fasi |
| **Dispersione** | due misure l’una rispetto all’altra, una terza come dimensione dei punti |
| **Tabella**, **Tabella pivot** | le righe, ordinabili; le righe per una dimensione, le colonne per un’altra, con i loro totali |
| **Mappa** | le regioni o i dipartimenti della Francia, o i paesi, colorati in base a un valore; oppure punti per latitudine e longitudine |

**Opzioni** regola ciò che si mostra, e il risultato si scarica in **CSV**.

### Personalizzare un grafico

| Visualizzazione | Cosa propone **Opzioni** |
|---|---|
| **Barre, linee, aree, combinato** | il colore e il nome di ogni serie; l’impilamento, con il totale sopra le pile; la larghezza delle barre; linee smussate o a gradini, con o senza punti; l’ordine delle categorie; i titoli degli assi, le graduazioni, l’inclinazione delle etichette, i limiti, una scala logaritmica; i valori sul grafico; un obiettivo |
| **Torta** | un anello e il suo spessore, un semicerchio, una rosa; il totale al centro; il numero di fette prima di «Altri»; il colore e il nome di ogni fetta; le etichette sulle fette o accanto; la posizione della legenda |
| **Imbuto** | il colore e il nome di ogni fase, il loro ordine |
| **Numero, tendenza, avanzamento, indicatore** | il colore, colori in base al valore, una didascalia sotto il numero, il confronto — e se un calo è una buona notizia |
| **Tabella, tabella pivot** | rinominare e riordinare le colonne, barre nelle celle, colori in base al valore — per cella o per riga —, la densità, le righe per pagina, i numeri di riga, i totali |
| **Mappa** | la tonalità, i nomi delle regioni |

Per tutti, il formato dei numeri: decimali, prefisso e suffisso, abbreviato in `1,2 k`.

## Esplorare con un clic

Un clic su una barra, un punto o una fetta apre ciò che rappresenta:

- **Vedi queste righe**: le righe dietro il punto, filtrate per ciò che rappresenta;
- **Dettaglia per settimana**: un periodo scomposto in uno più fine — un anno nei suoi
  trimestri, un mese nelle sue settimane;
- **Suddividi per…**: la stessa misura, per quel punto, secondo un’altra colonna;
- **Solo questo valore**, **Escludi questo valore**.

Ogni passo è una domanda a sé, che si può salvare se si vuole; la freccia indietro torna
al passo precedente. Una riga di una tabella apre i suoi dettagli.

Su una dashboard, lo stesso clic propone anche **Filtra la dashboard: «Lyon»**, con il
numero di schede interessate: un filtro **temporaneo**, mai salvato, mostrato tratteggiato
nella barra dei filtri e rimovibile con un clic, che si applica a ogni scheda la cui domanda
legge la stessa colonna — tramite la sua tabella o tramite un join. Viene proposto solo se nessun filtro della
dashboard è già collegato a quella colonna sulla scheda, e resta disattivato («unica scheda») quando
nessun’altra scheda la legge. Le domande SQL non ne tengono conto.

## Scrivere una domanda in SQL

Una **domanda SQL** è un `SELECT` sulle tabelle del database, con il loro vero nome. Viene
eseguita **in sola lettura, con i tuoi permessi** — per tutti, gestori
compresi: una tabella che ti è preclusa non esiste, un campo nascosto viene rifiutato, e una
scrittura è impossibile. Per disporre semplicemente una query sotto le tabelle, senza grafico, o
per farne una vera vista PostgreSQL, vedi [Query e viste SQL](/basedb/it/fonctionnalites/requetes-et-vues-sql/).

Una **variabile** si scrive `{{nom}}`; una parte da rimuovere quando non ha valore va tra
`[[` e `]]`:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Una variabile è un testo, un numero, una data — oppure un **filtro di colonna**: `{{periode}}`
diventa allora un’intera condizione sulla colonna scelta, qui `echeance`, oppure `TRUE` quando
non viene scelto nulla. È ciò che permette a un filtro della dashboard di controllare una domanda SQL
come le altre.

## Organizzare una dashboard

**Modifica** mette la dashboard in modalità modifica:

- **Domanda** inserisce una domanda salvata — una domanda personale viene copiata in essa —,
  oppure ne crea una propria della scheda;
- **Titolo** aggiunge un titolo di sezione, **Testo** un testo formattato — titoli, elenchi,
  link — che può citare dei numeri (vedi più sotto);
- **Pagina incorporata** mostra un indirizzo `https://` in un riquadro isolato, che non riceve né
  sessione né dati;
- **Tab** distribuisce le schede su più pagine; un doppio clic rinomina una tab.

Le schede si spostano dalla loro maniglia e si ridimensionano dall’angolo, su una griglia di
24 colonne. **Salva** conserva il tutto; **Annulla** torna alla versione precedente. Il titolo
di una scheda, in lettura, apre la sua domanda per esplorarla, filtri della dashboard compresi.

### Numeri nel testo

Un testo cita un valore con un nome tra doppie graffe: «Questo mese, `{{chiffre_affaires}}` di
fatturato su `{{commandes}}` ordini.» Ogni nome diventa un badge, da collegare con un clic — o
tramite **Variabile** nella barra dell’editor — a:

| Fonte | Cosa mostra il testo |
|---|---|
| **una scheda** della dashboard | ciò che mostra, con i propri filtri |
| **una domanda salvata** di tutto il database | il suo valore, e i filtri della dashboard vi si collegano come a una scheda |
| **una domanda conservata nel testo** | il suo valore; è così che si cita una domanda personale |
| **un filtro** della dashboard | il valore scelto, come lo indica la sua impostazione |

Il valore di una domanda è quello che mostrerebbe il suo **Numero**: la sua prima misura,
sull’ultima riga. Si calcola con i permessi del lettore, e viene sempre mostrato come testo. Un
testo cita al massimo 20 valori; un nome si scrive in minuscolo, cifre e `_`. I testi scritti in
Markdown prima dell’editor si leggono come prima, e diventano formattati non appena vengono
riscritti. Il Copilot, invece, scrive i suoi testi in Markdown.

## I filtri

**Filtro** aggiunge un controllo in cima alla dashboard: una **data** (un periodo), una
**categoria** (valori da spuntare), un **testo**, un **numero**, o un **raggruppamento per
data** che fa passare le linee dal mese alla settimana o all’anno.

Un filtro controlla le schede a cui è collegato — una, alcune o tutte. Alla sua creazione si
collega da solo alle colonne adatte; quando è selezionato, mostra su ogni scheda la
colonna che filtra, da cambiare o rimuovere, e **Collega a tutte le schede compatibili**
completa il resto. Può avere un **valore predefinito** — «Quest’anno», per esempio.

In lettura, un clic su un punto può anche impostare un filtro: **Filtra per «Lyon»** su una
scheda la cui colonna delle città è collegata al filtro «Ville».

![La tab «Activité»: attività per scadenza in pila per stato, imbuto dei progetti, ore stimate in tabella pivot](../../../../assets/screens/tableaux-de-bord-activite.png)

## Il Copilot

**Copilot**, nell’intestazione della sezione Dashboard, apre a destra una conversazione in
linguaggio naturale sul database: «il fatturato per mese», «aggiungi un filtro per cliente»,
«perché agosto è in calo?». Ogni proposta arriva come una scheda, che si applica con un clic:

| Proposta | Cosa fa |
|---|---|
| **Una domanda** | eseguita e disegnata nella conversazione; si apre nell’editor o si aggiunge alla dashboard |
| **Modifiche alla dashboard**, o una dashboard nuova | schede aggiunte, modificate o rimosse, testi, filtri collegati automaticamente alle schede che hanno la colonna, tab, nome — un solo salvataggio, **annullabile** dalla scheda |
| **Valori per i filtri visualizzati** | «mostrami il mese scorso»: i filtri si impostano, nulla viene salvato |

Porre una domanda o impostare i filtri è consentito a ogni lettore del database; modificare o creare
una dashboard richiede il livello **Gestione**.

Per impostazione predefinita, **solo la struttura** viene inviata al fornitore di IA, insieme alla conversazione: le
tabelle e i loro campi, le dashboard e le domande salvate del database, e la dashboard
visualizzata — le sue tab, i suoi filtri, la definizione delle sue schede (le loro domande, i loro testi).
Né le righe, né i risultati delle schede, né i **valori scelti nei filtri**, che
possono essere dati: di un filtro viene inviato solo il fatto che ha un valore. Un campo contrassegnato
come invisibile per gli agenti non viene inviato, né la domanda di una scheda che lo cita.

La casella **Consenti la lettura dei dati** aggiunge, per la conversazione, i valori dei
filtri visualizzati e i risultati delle schede con quei filtri (50 righe al massimo per lettura,
elencate sotto la risposta), per commentare i numeri con i dati alla mano. Vedi
[Intelligenza artificiale](/basedb/it/fonctionnalites/ia/).

## Condividere una dashboard

**Condividi**, nell’intestazione di una dashboard, è disponibile per chi ha il livello **Gestione** sul
database. Due strade:

- **Condividi database…** invita persone nel database: aprono la dashboard in basedb, e
  ogni scheda legge con i loro permessi;
- **Crea link** fornisce un link a questa **sola** dashboard, che non richiede alcun permesso sul database.

| Accesso del link | Chi legge |
|---|---|
| **Pubblico** | chiunque abbia il link, senza account |
| **Membri connessi** | un membro dello spazio di lavoro, dopo l’accesso — se serve, solo di alcuni gruppi |

La pagina del link mostra le tab, i filtri e le schede della dashboard, **in sola lettura**:
né esplorazione, né accesso alle righe, né domande proprie. Le sue schede leggono con i **permessi della
persona che ha pubblicato il link**, rivalutati a ogni lettura: se perde l’accesso al database, il
link viene **sospeso**. L’interruttore **Link attivo** lo disattiva senza perderlo, **Rigenera**
invalida il vecchio.

Spunta **Consenti l’incorporamento in un altro sito**: la finestra di dialogo fornisce un **codice di incorporamento**
`<iframe>`, per mostrare la dashboard in una intranet o in un wiki. È lo stesso meccanismo delle
[viste condivise](/basedb/it/fonctionnalites/vues-partagees/).

## A ciascuno i suoi permessi

Ogni scheda legge **con i permessi di chi guarda**: la stessa dashboard mostra a ciascuno ciò che ha
il permesso di vedere — tranne tramite un link di condivisione, che legge con quelli della persona che l’ha pubblicato. Una scheda che riguarda una tabella o un campo che ti è precluso mostra
«Dato non accessibile», anziché un numero che mentirebbe per omissione. Salvare una
domanda condivide solo la domanda, mai ciò che il suo autore può leggere.

## Limiti

- Una domanda restituisce al massimo 2.000 righe; un riepilogo quasi sempre se ne accontenta.
- Ogni scheda esegue la sua query all’apertura e a ogni filtro, senza cache.
- Le basi cartografiche coprono la Francia metropolitana (regioni, dipartimenti) e i paesi del
  mondo. Fonte: IGN, Admin Express (Licence ouverte); Natural Earth.

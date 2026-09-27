---
title: Viste
description: Griglia, kanban, calendario, sequenza temporale, galleria, elenco, modulo e questionario — collaborative o personali.
---

Una tabella si mostra in **otto modi**. Una vista non copia alcun dato e non concede alcun permesso
in più rispetto alla tabella stessa.

:::note
Queste viste sono modi di mostrare **una** tabella. Una [vista SQL](/basedb/it/fonctionnalites/requetes-et-vues-sql/)
è un’altra cosa: una vera vista PostgreSQL, scritta in SQL sulle tabelle del database, disposta tra
di esse nella barra laterale.
:::

| Vista | Cosa mostra | Cosa le serve |
|---|---|---|
| **Griglia** | righe filtrate, ordinate, raggruppate, con le colonne scelte | — |
| **Kanban** | schede in colonne | una selezione singola |
| **Calendario** | righe alla loro data, per mese o per settimana | un campo data |
| **Sequenza temporale** | barre tra due date, e le loro dipendenze | una data di inizio |
| **Galleria** | schede, con un’immagine di copertina | — |
| **Elenco** | una riga per record, in gruppi comprimibili | — |
| **Modulo** | una pagina di domande per creare una riga | — |
| **Questionario** | le stesse domande, una per schermata | — |

## Il selettore delle viste

Si trova a sinistra di «Filtra». «Tutte le righe» è la griglia della tabella, che nessuno
ha salvato né può eliminare; seguono le **viste collaborative**, nell’ordine
scelto da chi costruisce il database, poi **Le mie viste**.

- Una **vista collaborativa** è visibile a tutti. Crearla, configurarla, rinominarla,
  riordinarla o eliminarla richiede il livello **Gestione**. Può essere **bloccata**: lo
  indica un lucchetto, e nessuno può più modificarla senza prima sbloccarla.
- Una **vista personale** è visibile solo a te, e richiede soltanto di poter leggere la tabella.
  **Crea vista personale**, oppure **Salva come vista** dopo aver filtrato e ordinato:
  ognuno conserva i propri modi di leggere, senza cambiare nulla per gli altri. **Duplica** una
  vista collaborativa ne crea una copia personale.

![Una galleria di clienti](../../../../assets/screens/galerie.png)

## La barra degli strumenti

Sopra la griglia, in quest’ordine:

- **Filtra** combina condizioni per campo;
- **Colonne** sceglie cosa mostrare — le colonne di sistema sono a parte, sotto
  «Informazioni di sistema»;
- **Raggruppa** dispone le righe secondo un campo a valore singolo — selezione singola, relazione,
  persona, data, numero, testo, casella di controllo… — in gruppi comprimibili, ognuno con il proprio
  conteggio su tutto il filtro;
- **Colori** colora le righe secondo una selezione singola, oppure secondo **regole** — un filtro e
  un colore, venti al massimo — come striscia, come sfondo o entrambi;
- **Altezza righe**: bassa, media, alta, molto alta;
- **Cerca…**, a destra, cerca in tutte le colonne mentre digiti; Esc
  svuota la ricerca. Vale anche per il kanban, il calendario, la sequenza temporale, la galleria
  e l’elenco, e non viene mai salvata nella vista.

Sotto ogni colonna, un **Riepilogo** calcolato su tutte le righe del filtro, non solo sulla
pagina: compilate, vuote, valori unici, somma, media, minimo, massimo, caselle spuntate.

## Kanban, calendario, sequenza temporale

- Il **kanban** dispone le schede secondo una selezione singola; trascinare una scheda modifica la riga,
  un «+» in cima alla colonna crea una riga che ha già quella scelta. Ogni scheda mostra un
  titolo, un’immagine di copertina, i campi scelti e una **descrizione** che cita i
  valori della riga — «Consegna prevista il `{{Date}}` per `{{Client}}`» —, scritta nelle
  impostazioni della vista con il pulsante **Inserisci campo**.
- Il **calendario** colloca ogni riga alla sua data, con un’eventuale data di fine; trascinare una
  riga da un giorno all’altro la sposta.
- La **sequenza temporale** traccia barre tra una data di inizio e una data di fine, raggruppate per
  una selezione singola o una relazione. Con l’impostazione **Dipende da** — una relazione della tabella
  verso sé stessa — una freccia collega ogni attività a quelle da cui dipende, rossa quando
  torna indietro nel tempo.

![Una sequenza temporale con le sue dipendenze](../../../../assets/screens/chronologie.png)

![Un calendario per scadenza](../../../../assets/screens/calendrier.png)

## Galleria ed elenco

- La **galleria** mostra schede: un’**immagine di copertina** (ritagliata o intera), una
  dimensione (schede piccole, medie, grandi), un colore secondo una selezione singola.
- L’**elenco** mostra una riga per record, **raggruppata** per una selezione singola, una
  relazione o una persona.

![Un elenco di clienti, raggruppato per settore](../../../../assets/screens/liste.png)

Nel kanban, nella galleria e nell’elenco, le schede e le righe si **ordinano a mano**
trascinandole — fino a 5.000; un ordinamento scelto prevale su quest’ordine.

## Modulo e questionario

Si spuntano le domande e si mettono in ordine; ognuna ha un’etichetta, un testo di aiuto, e può essere resa
obbligatoria. Il modulo ha il suo titolo, la sua presentazione, l’etichetta del pulsante e il messaggio
di ringraziamento. Si compila in basedb, oppure si [condivide tramite link](/basedb/it/fonctionnalites/formulaires-partages/).

## Condividere una vista

Una vista di dati — griglia, kanban, calendario, sequenza temporale, galleria, elenco — si **condivide in
sola lettura** tramite link, si incorpora in un altro sito, e un calendario diventa un feed
di calendario. Vedi [Viste condivise](/basedb/it/fonctionnalites/vues-partagees/).

## Ciò che il lettore non vede

Una vista viene **riproiettata per chi la legge**: un campo che gli è nascosto scompare dalle
colonne, dalle schede e dalle domande. Una vista il cui filtro cita un campo nascosto non viene
mostrata affatto: mostrata senza il suo filtro, mostrerebbe più di quanto è stata pensata per
mostrare.

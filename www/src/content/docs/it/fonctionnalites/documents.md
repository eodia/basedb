---
title: Documenti PDF
description: Una riga in fattura, preventivo, scheda o attestato nei tuoi colori, con logo, righe collegate e totali.
---

Una riga diventa un **PDF**: una fattura con le sue righe e il suo totale, un preventivo, un
documento di trasporto, una scheda prodotto, un attestato. Nei dettagli di una riga, il pulsante
**Documento PDF** lo apre in una nuova scheda del browser, da cui il browser lo stampa o lo salva.

## I dettagli, senza impostare nulla

Senza modello, una riga si stampa come **dettagli**: il suo nome come titolo, poi tutti i campi
che puoi leggere, nella tua lingua.

## Creare un modello

Chi costruisce la tabella — il livello Gestione — crea i modelli dai dettagli di una riga:
**Documento PDF › Modelli di documento…**. Un nuovo modello parte da un **punto di partenza**:

| Punto di partenza | Cosa imposta |
|---|---|
| **Fattura** | intestazione con logo e contatti, «FATTURA», numero e data; cliente; righe fatturate e il loro totale; riepilogo imponibile/totale; condizioni di pagamento; note legali in piè di pagina |
| **Preventivo** | titolo su una fascia colorata, informazioni in griglia, prestazioni, validità, zona «Buono per accettazione» |
| **Scheda** | titolo grande a piena larghezza, foto del campo immagine, campi in griglia, testi lunghi |
| **Attestato** | pagina orizzontale incorniciata, testo centrato, firma |
| **Pagina vuota** | un titolo e i campi della riga |

È costruito con **le colonne della tua tabella** — il suo numero, la sua data, i suoi importi, la
sua foto, le righe che le sono collegate — e ciò che la tabella non ha viene semplicemente
lasciato da parte. Tutto si può cambiare in seguito; l’anteprima, a destra, mostra il PDF della
riga aperta e si aggiorna a ogni modifica.

## Il contenuto: i blocchi

I blocchi si susseguono dall’alto verso il basso; si **trascinano** dalla loro maniglia per
riordinarli, si aprono per regolarli.

| Blocco | Cosa mostra |
|---|---|
| **Titolo** | un grande titolo e un sottotitolo, sobrio, a colori, sottolineato, oppure su una fascia — fino ai bordi della pagina |
| **Testo** | testo formattato — titoli, grassetto, elenchi, link — che cita le colonne della riga con il menu **Colonna**: «Fattura `{{numero}}` del `{{date}}`»; allineato o giustificato, su sfondo colorato, bordato o segnato da una barra di colore |
| **Immagine** | un logo, un timbro, o la foto di un campo immagine della riga |
| **Campi della riga** | i campi scelti, o tutti: etichetta a sinistra, etichetta sopra in una griglia di 2 o 3, oppure **riepilogo** — valori a destra, l’ultimo (il totale dovuto) in grassetto; i campi vuoti possono essere nascosti |
| **Tabella delle righe collegate** | le righe che designano questa — le righe di una fattura — o quelle che designa una relazione multipla, con i loro **totali**; intestazione colorata, una riga su due colorata, intestazioni, larghezze e allineamenti di colonna a tua scelta («Qtà» per «Quantità») |
| **Colonne** | due o tre colonne fianco a fianco, ciascuna con i propri blocchi: «Fatturato a» da un lato, i riferimenti dall’altro |
| **Separatore**, **Spazio** | una linea — corta per una firma — oppure uno spazio |
| **Interruzione di pagina** | il resto su una nuova pagina |

## Lo stile e la pagina

- **Colore dell’accento** — quello del tuo marchio: titoli, fasce, intestazioni di tabella, link.
  Il testo posato sopra è bianco o scuro, secondo ciò che si legge meglio.
- **Colore del testo**, **carattere** del testo e dei titoli (senza o con grazie),
  **dimensione** del testo, stile dei sottotitoli.
- **Formato** (A4 o Letter), **orientamento**, **margini**, **cornice** semplice o doppia attorno
  alla pagina, contenuto **centrato verticalmente** — per un attestato.
- **Lingua dei valori**: gli importi si scrivono con la loro valuta («1.234,50 €»), le date
  per intero («30 settembre 2026»), sì e no, l’etichetta di una scelta, il nome di una
  persona. Il testo è composto con font incorporati che coprono le venti lingue di basedb,
  ideogrammi compresi.

## Intestazione e piè di pagina

L’**intestazione** porta il tuo **logo** — un’immagine inviata (PNG, JPEG o SVG; un’immagine
troppo pesante viene ridotta) o il campo immagine della riga —, un testo a sinistra (i tuoi
contatti) e un testo a destra (cos’è il documento, il suo numero, la sua data), sulla prima
pagina o su ciascuna. Il **piè di pagina** porta le tue note legali e i numeri di pagina.
Entrambi citano le colonne della riga, come un testo.

## Ognuno con i propri permessi

Un documento viene letto **con i permessi di chi lo stampa**: un campo per lui nascosto non vi
figura — né in un testo, né in un’immagine —, una riga collegata che non può vedere non è nella
tabella — né nel totale. Due persone possono quindi ottenere due documenti diversi della stessa
riga: ognuno ha il proprio.

## Tramite l’API

```bash
# Il PDF di una riga con un modello, o «dettagli»
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` elenca i modelli della tabella.

## Limiti

- Un’immagine inviata pesa 300 KB al massimo, otto per modello; un’immagine di un campo viene
  ripresa se è un PNG o un JPEG.
- Un valore di una riga collegata si cita fuori dalla tabella con una **ricerca** sulla tabella
  del documento; un totale IVA inclusa è un campo della tabella.
- Un documento per riga: non ancora un PDF di più righe. Una
  [automazione](/basedb/it/fonctionnalites/automatisations/#un-pdf-e-unemail) può farlo
  per te — **Genera un PDF** — e inviarlo in allegato.

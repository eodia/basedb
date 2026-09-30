---
title: Documenti PDF
description: Una riga in fattura, preventivo o scheda stampabile, con le sue righe collegate e i suoi totali.
---

Una riga diventa un **PDF**: una fattura con le sue righe e il suo totale, un preventivo, un
documento di trasporto, una scheda. Nei dettagli di una riga, il pulsante **Documento PDF** lo
apre in una nuova scheda del browser, da cui il browser lo stampa o lo salva.

## I dettagli, senza impostare nulla

Senza modello, una riga si stampa come **dettagli**: il suo nome come titolo, poi tutti i campi
che puoi leggere, nella tua lingua.

## I modelli

Chi costruisce la tabella — il livello Gestione — li scrive, dai dettagli di una riga:
**Documento PDF › Modelli di documento…**. Un modello è una pagina (A4 o Letter, verticale o
orizzontale), una lingua per i valori, un piè di pagina e una sequenza di blocchi:

| Blocco | Cosa mostra |
|---|---|
| **Testo** | testo formattato — titoli, grassetto, elenchi, link — che cita le colonne della riga con il menu **Colonna**: «Fattura `{{numero}}` del `{{date}}`» |
| **Campi della riga** | i campi scelti, o tutti: etichetta a sinistra, valore a destra |
| **Tabella delle righe collegate** | le righe che designano questa — le righe di una fattura — o quelle che designa una relazione multipla, con le colonne scelte e i loro **totali** |
| **Interruzione di pagina** | il resto su una nuova pagina |

L’editor mostra a fianco il PDF che il modello genera dalla riga aperta, modifiche comprese.

I valori si scrivono **nella lingua del modello**: un importo con la sua valuta («1.234,50 €»),
una data per intero («30 settembre 2026»), sì e no, l’etichetta di una scelta, il nome di una
persona. Il testo è composto con font incorporati che coprono le venti lingue di basedb,
ideogrammi compresi.

## Ognuno con i propri permessi

Un documento viene letto **con i permessi di chi lo stampa**: un campo per lui nascosto non vi
figura, una riga collegata che non può vedere non è nella tabella — né nel totale. Due persone
possono quindi ottenere due documenti diversi della stessa riga: ognuno ha il proprio.

## Tramite l’API

```bash
# Il PDF di una riga con un modello, o «dettagli»
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` elenca i modelli della tabella.

## Limiti

- Nessuna immagine (logo) né colore scelto in un documento, nessuna intestazione distinta dal
  piè di pagina.
- Un documento per riga: non ancora un PDF di più righe, né una generazione tramite
  un’automazione.

---
title: Cronologia
description: Ogni scrittura, da qualunque parte provenga, con i valori precedenti.
---

basedb registra nella cronologia **ogni scrittura**, da qualunque parte provenga: l’interfaccia, l’API, un agente MCP,
un modulo pubblico — e persino una query SQL scritta a mano in `psql`.

![La cronologia di un database](../../../../assets/screens/historique.png)

## Come viene catturata

Non dall’applicazione, ma da **trigger PostgreSQL**, nella transazione stessa della
scrittura. Una scrittura che fallisce non lascia traccia; una scrittura che riesce non può
mancare di lasciarne. Le revisioni vengono poi riversate in registri immutabili, partizionati per
mese.

L’identità viaggia tramite variabili di sessione impostate all’inizio di ogni transazione. Una
scrittura che non ne porta — SQL diretto — viene registrata come tale, con la sessione che
l’ha eseguita (`psql`, indirizzo, processo): non viene mai rifiutata per questo.

| Attore | Mostrato come |
|---|---|
| una persona | il suo nome |
| un programma (API) o un agente (MCP) | la persona che ha creato il token, «tramite il token …» |
| un modulo pubblico | «Modulo “…” · risposta pubblica» |
| un’automazione | «Automazione “…” · per conto di» la persona che ne risponde |
| SQL diretto | «Sessione SQL diretta» |

## Cosa se ne può fare

- **Leggere** la cronologia di una riga (tab «Cronologia» dei suoi dettagli), di una tabella o di un
  database (**Cronologia**, nel menu **⋯** del database), filtrata per tabella.
- **Annullare** una modifica: i valori precedenti vengono riapplicati campo per campo.
- **Ripristinare** una riga eliminata dalla sua voce «ha eliminato».
- Seguire la **cronologia della struttura** (tab «Struttura»): tabelle e campi creati,
  modificati, eliminati.

## Annullare (Ctrl+Z)

Nella griglia, **Ctrl+Z** (⌘Z su Mac) annulla la tua ultima scrittura; **Ctrl+Maiusc+Z** o
**Ctrl+Y** la ripristina. Un messaggio conferma cosa è stato annullato — «Annullato: modifica di
“Montant”» — con un pulsante per annullare l’annullamento.

Si annullano così una cella, una scheda o una barra spostata, una riga creata o eliminata, un
incolla — e un’intera importazione, contata come un solo gesto. Fino a cinquanta gesti, per ciascuna
tab del browser.

Non è un ritorno indietro dello schermo: è una **nuova scrittura**, eseguita dal
server a partire dalla cronologia, e registrata anch’essa. Viene rifiutata se qualcuno ha
modificato la riga nel frattempo — «Impossibile annullare: “Statut” è stato modificato nel frattempo» — piuttosto
che sovrascrivere il suo lavoro. Si annullano così solo le proprie scritture, delle ultime
ventiquattro ore, e mai la struttura. In una cella in corso di modifica, Ctrl+Z resta
quello del testo.

## Permessi

La cronologia segue i permessi di lettura: un campo nascosto per te non compare nelle
revisioni che leggi.

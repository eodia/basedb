---
title: Intelligenza artificiale
description: L’opzione IA di un campo, le bozze, il Copilot e quello delle dashboard — e cosa viene inviato al fornitore.
---

L’IA è **facoltativa**. Senza un fornitore configurato, nulla viene inviato da nessuna parte. basedb sa
dialogare con **OpenAI**, **Anthropic** e **Mistral**, con la tua chiave.

## Configurare un fornitore

Finché nessuna impostazione è salvata nell’interfaccia, l’API legge il suo ambiente:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic o mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # o BASEDB_AI_API_KEY
```

La chiave si legge da `BASEDB_AI_API_KEY` o, in mancanza, dal nome consueto del fornitore
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## L’opzione IA di un campo

L’IA non è un tipo di campo ma un’**opzione**: l’interruttore **IA** nelle impostazioni di un
campo — testo, testo lungo, URL, numero, selezione singola, booleano, data — lo fa compilare da
un modello, a partire da un’istruzione che cita altre colonne:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Il campo viene calcolato non appena la riga esiste, poi ogni volta che una colonna citata cambia —
  e, se lo si desidera, secondo una pianificazione (al massimo ogni 15 minuti).
- La colonna **mantiene il suo tipo**: una risposta in cui non si legge nulla di quel tipo (un numero
  introvabile, una scelta che non esiste) viene rifiutata anziché scritta.
- Disattivare l’opzione rende il campo di nuovo modificabile a mano, con i valori conservati.
- I valori citati vengono inviati al fornitore: **l’attivazione richiede un consenso
  esplicito**.

`BASEDB_AI_FIELD_QUOTA` limita questi calcoli per ora e per tenant (300 per impostazione predefinita).

## In un’automazione

Un’[automazione](/basedb/it/fonctionnalites/automatisations/#chiedi-allia) può **chiedere
all’IA** in uno dei suoi passaggi: un’istruzione che cita la riga e i passaggi precedenti,
una risposta letta nel tipo scelto, che i passaggi successivi scrivono, inviano o citano. Stesse
regole di un campo: consenso al salvataggio, viene inviato solo ciò che l’istruzione cita,
ogni chiamata registrata e contata in `BASEDB_AI_FIELD_QUOTA`.

## Bozze e Copilot

- **Bozze**: descrivere una tabella o una formula in una frase, e ricevere una proposta da
  rileggere. Vengono inviati solo le etichette, i tipi e la frase inserita — nessun valore di cella.
- **Modelli**: descrivere un intero database — «il monitoraggio dei reclami dei miei clienti» — e
  ricevere tabelle, righe di esempio, viste, dashboard e automazioni, da perfezionare e poi da
  creare. Viene inviata solo la frase. Vedi [Modelli di database](/basedb/it/fonctionnalites/modeles/#chiederlo-allia).
- **Copilot**: una conversazione sul database visualizzato. Si chiede un filtro, una query, delle
  colonne, una tabella, un set di dati di prova; ogni proposta arriva come una scheda e si applica
  con un clic, attraverso le stesse route dei moduli dell’interfaccia.

Per impostazione predefinita, viene inviata al fornitore solo la struttura. La casella **«Consenti la lettura dei
dati»** permette al Copilot, per la conversazione, di leggere righe (50 al massimo per lettura)
e di rispondere a partire da esse — ogni lettura è elencata sotto la sua risposta.

## Il Copilot delle dashboard

Nella sezione [Dashboard](/basedb/it/fonctionnalites/tableaux-de-bord/#il-copilot), il
Copilot propone domande, modifiche della dashboard e valori per i suoi filtri, da
applicare con un clic. Stesse regole: senza consenso, viene inviata solo la struttura — tabelle e
campi, dashboard e domande del database, definizione delle schede della dashboard visualizzata (le loro
domande, i loro testi) —, mai i risultati né i valori scelti nei filtri. La casella
**«Consenti la lettura dei dati»** aggiunge questi valori e i risultati delle schede con i
filtri visualizzati, 50 righe al massimo per lettura, ognuna elencata sotto la risposta.

## Il Copilot delle automazioni

Nella sezione [Automazioni](/basedb/it/fonctionnalites/automatisations/#il-copilot), il Copilot
propone un’intera automazione — quella sullo schermo, modificata, o una nuova — che posiziona nel
flusso dell’editor, **senza mai salvarla**: la rileggi, poi la salvi. Stesse regole:
senza consenso, viene inviata solo la struttura — tabelle e campi, automazioni del database, quella
sullo schermo, le sue ultime esecuzioni senza alcun valore, persone e canali Slack con dei segnaposto —,
e la casella **«Consenti la lettura dei dati»** aggiunge righe lette, 50 al massimo per lettura.

`BASEDB_AI_QUOTA` limita le chiamate interattive per ora e per tenant (120 per impostazione predefinita).

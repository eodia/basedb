---
title: n8n
description: Leggere e scrivere le righe di basedb da un workflow n8n, e avviarne uno a ogni riga creata, modificata o eliminata.
---

Il pacchetto **n8n-nodes-basedb** aggiunge tre nodi a n8n:

| Nodo | Ruolo |
|---|---|
| **basedb** | leggere e scrivere le righe di una tabella, commentare una riga; utilizzabile come strumento da un agente IA di n8n |
| **basedb Trigger** | avviare un workflow per ogni riga creata — o creata o modificata — dall’ultima rilevazione |
| **basedb Webhook Trigger** | avviare un workflow nell’istante in cui una riga viene creata, modificata o eliminata |

## Installare

In n8n: **Settings › Community Nodes › Install**, poi `n8n-nodes-basedb`.

Senza l’interfaccia — modalità coda, immagine Docker preconfigurata — : `npm install
n8n-nodes-basedb` nella cartella `~/.n8n/nodes`, poi riavvia n8n.

## Le credenziali

Crea in n8n una credenziale **basedb API**:

| Campo | Valore |
|---|---|
| **Instance URL** | l’indirizzo dove apri basedb: `https://basedb.exemple.fr` |
| **Workspace** | il riferimento dello spazio di lavoro, quello degli indirizzi dell’API (`/api/v1/<espace>/…`): `t4z56fq`, a meno che l’istanza non fissi `BASEDB_TENANT` |
| **Token** | un **token di integrazione**: menu **⋯** del database → **API e agenti** → **Token API e MCP…** |

Un token apre **un** database. Legge le sue righe, le scrive se è stato creato in scrittura, e non
ha mai più permessi della persona che l’ha creato. Al salvataggio, n8n prova la connessione e dice
se il token viene rifiutato.

## Leggere e scrivere: il nodo basedb

| Operazione | Cosa fa |
|---|---|
| **Row › Create** | aggiunge una riga |
| **Row › Create or Update** | modifica la riga i cui campi scelti portano questi valori, o la aggiunge se nessuna li porta |
| **Row › Get** | legge una riga tramite il suo `_id` |
| **Row › Get Many** | legge le righe di un filtro, nell’ordine richiesto, fino a un limite o tutte, pagina dopo pagina |
| **Row › Update** | modifica una riga, trovata tramite il suo `_id` o altri campi |
| **Comment › Create** | commenta una riga; una @mention avvisa la persona |

Il **database** e la **tabella** si scelgono da elenchi, quelli che il token apre. I campi da
scrivere vengono mostrati con il loro nome in basedb, una selezione singola con le sue opzioni,
un campo Persona con i membri dello spazio di lavoro; un campo calcolato — formula, ricerca,
aggregazione, numerazione automatica — non vi figura, perché è basedb stesso a scriverlo. Un
valore che il campo rifiuta ferma il nodo con il codice di basedb e il suo significato.

- Il **filtro** e l’**ordinamento** usano i nomi tecnici dei campi, quelli dell’SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. La grammatica è quella
  dell’[API REST](/basedb/it/integrations/api-rest/#leggere).
- I **numeri** arrivano come testo decimale (`"1250.50"`), per non perdere alcuna cifra; l’opzione
  **Numbers as Numbers** li converte in numeri.
- Una **relazione** si legge `{ "id": …, "display": … }` e si scrive tramite l’`_id` della riga
  collegata.
- **Create or Update** non modifica mai più righe: se più righe portano i valori, il nodo si
  ferma invece di indovinare.
- Nessuna operazione **Delete**: per rimuovere righe, contrassegnale (uno stato «Archiviato»),
  affida l’eliminazione a un’[automazione](/basedb/it/fonctionnalites/automatisations/), oppure
  chiama l’[API REST](/basedb/it/integrations/api-rest/) con un token creato per eliminare.

## Avviare un workflow

### A ogni rilevazione: basedb Trigger

Il nodo chiede a basedb, al ritmo scelto (ogni minuto, ogni ora…), le righe **create** — o
**create o modificate** — dall’ultima volta, un filtro in più se serve. Funziona ovunque, anche
quando basedb non può contattare n8n. Alla sua prima rilevazione, annota a che punto è la
tabella e non emette nulla; una prova dall’editor restituisce l’ultima riga, per avere di che
collegare i nodi successivi.

### Nell’istante: basedb Webhook Trigger

Ogni riga creata, modificata o eliminata — anche tramite SQL scritto direttamente in
PostgreSQL — avvia subito il workflow:

1. Aggiungi il nodo e copia il suo **Production URL**.
2. In basedb, menu **⋯** del database → **API e agenti** → **Webhook…**: crea un webhook verso
   questo indirizzo, scegli le sue tabelle e i suoi eventi.
3. basedb mostra una sola volta il **secret di firma**: inseriscilo in una credenziale
   **basedb Webhook** di n8n.
4. Attiva il workflow.

Ogni evento diventa un elemento: il suo `type` (`record.created`, `record.updated`,
`record.deleted`), la tabella, la riga **prima** e **dopo**, e i campi cambiati (`changed`). Il
nodo verifica la **firma** di ogni consegna e risponde `401` a quella che non ne ha una, che ne
ha una falsa, o che risale a più di cinque minuti prima. basedb consegna **almeno una volta**:
elimina i duplicati basandoti sull’`id` dell’evento se il workflow non deve trattarlo due volte.

:::note
basedb invia un webhook solo a un indirizzo **HTTPS pubblico**: un n8n su una rete privata usa
piuttosto **basedb Trigger**. Vedi [Webhook](/basedb/it/integrations/webhooks/).
:::

## Senza il nodo

Il nodo **HTTP Request** di n8n parla anche con basedb: intestazione `Authorization: Bearer
<token>`, JSON in andata e ritorno, paginazione tramite `meta.next_cursor` passato come `after`
(`{{ $response.body.meta.next_cursor }}`), e ripresa dopo un’interruzione tramite un filtro su
`_updated_at` e tramite `…/<table>/deleted?since=`.

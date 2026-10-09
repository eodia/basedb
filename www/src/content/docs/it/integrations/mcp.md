---
title: Server MCP
description: Collegare un agente IA a basedb tramite il Model Context Protocol.
---

basedb espone un **server MCP** (`POST /mcp`, allo stesso indirizzo dell’interfaccia): un agente — Claude, un
assistente di programmazione, il tuo agente — vi scopre i database, legge e scrive righe, ne
elimina se lo permetti, e **propone** evoluzioni della struttura.

## Collegare un agente

Crea un token da **Token API e MCP…** (menu del database, sotto **API e agenti**), con l’accesso MCP spuntato. Lo stesso token
serve per l’API REST e per MCP, e apre **tutto il database**: la sua produzione e i suoi altri
ambienti (vedi più sotto).

Metti il token in una variabile d’ambiente, `BASEDB_TOKEN`, mai in un file di configurazione.
Un client che parla MCP in HTTP — Claude Code, tra gli altri — punta direttamente a `…/mcp` con
l’intestazione `Authorization: Bearer <jeton>`. Con Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Il comando scrive il file `.mcp.json` del progetto, dove `${BASEDB_TOKEN}` resta un riferimento
alla variabile: il token stesso non vi compare.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Un client che sa avviare solo programmi locali (stdio) passa dal relay del repository, che legge
il token dalla variabile indicata da `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Chiedi poi all’agente di chiamare `whoami`: dice chi ha creato il token, quale database apre, i suoi
ambienti e i suoi permessi.

## Scegliere l’ambiente

Un database può avere più [ambienti](/basedb/it/fonctionnalites/environnements/) — produzione,
collaudo, sviluppo —, ciascuno con le proprie tabelle e le proprie righe. Un token di tutto il
database li apre tutti, e l’ambiente si sceglie, dal più ampio al più preciso:

- **il nome del database**, senza altro: `crm` è la produzione, `crm_recette` il collaudo;
- **l’indirizzo del server**: `…/mcp?environment=recette` punta al collaudo per tutta la
  connessione. Il relay fa lo stesso con `--environment recette`. Si dichiara così un server per
  ambiente, tutti con lo stesso token:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **l’argomento `environment`** di ogni strumento che nomina un database, per una sola chiamata:
  `list_records` con `{"base": "crm", "table": "clients", "environment": "recette"}`.

Un ambiente si indica con il suo badge, senza tenere conto di maiuscole e accenti
(`Recette`, `recette`, `developpement` per «Sviluppo»), oppure con `production`. `whoami` elenca
quelli che il token apre; `list_bases` e `describe_base` dicono di quale ambiente è ciascun database.

Un token può anche essere limitato a un solo ambiente, alla creazione: non ne vede allora nessun altro.

## I quindici strumenti

| Strumento | Ruolo |
|---|---|
| `whoami` | chi è l’agente, con quali permessi, su quali ambienti |
| `list_bases`, `describe_base`, `describe_table` | scoprire la struttura, le sue descrizioni e il suo aspetto |
| `list_records`, `get_record`, `lookup_records` | leggere, filtrare, risolvere un valore visualizzato |
| `create_record`, `update_record` | scrivere righe |
| `delete_record`, `restore_record` | eliminare una riga — con un token creato per questo — e ripristinarla |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proporre un’evoluzione della struttura |
| `propose_update_look` | proporre il colore e l’icona di una tabella e delle sue opzioni |

## Colori e icone

Una tabella, e ogni opzione di un campo di selezione, hanno un colore e un’icona, come
nell’interfaccia. L’agente li sceglie proponendo:

- `propose_create_table` accetta `color` e `icon` per la tabella;
- `propose_add_field` accetta `color` e `icon` su ogni opzione di un `select` o di un `multi_select`;
- `propose_update_look` cambia quelli di una tabella esistente e delle sue opzioni: una chiave
  omessa mantiene ciò che c’è, `null` lo cancella.

`color` è un colore `#rrggbb`. `icon` è il nome di un’icona
[Lucide](https://lucide.dev/icons/) tra quelle che l’interfaccia disegna — `truck`, `circle-check`,
`flame`…: lo schema dello strumento le elenca, e un nome sconosciuto viene rifiutato. `describe_base` e
`describe_table` restituiscono l’aspetto attuale. Un campo, invece, non ha un’icona da scegliere:
l’interfaccia disegna quella del suo tipo.

## Eliminare righe

Un token creato con i permessi **Lettura, scrittura ed eliminazione** permette all’agente di
eliminare righe, **una alla volta**, tramite il loro `_id`. `delete_record` restituisce la riga
com’era, e l’eliminazione viene registrata nella cronologia a nome del token; `restore_record`
ripristina la riga con il suo `_id` — l’agente disfa da solo il proprio errore, e una persona può
farlo anche dalla cronologia.

L’agente non elimina:

- con un token in lettura, o in lettura e scrittura: il rifiuto dice quale token creare;
- una riga che una relazione a cascata porterebbe via insieme ad altre (`TOKEN_CASCADE_FORBIDDEN`):
  questa eliminazione si fa nell’interfaccia, da una persona che vede cosa porta via;
- più righe in una volta: nessuno strumento lo fa.

## Cosa non fa un agente

- **Elimina solo con il tuo consenso**: un token creato per questo, una riga alla volta.
- **Non modifica la struttura** — né il suo aspetto: la propone. La proposta attende in **Proposte
  degli agenti…** (menu del database), dove una persona che gestisce la struttura la approva o la rifiuta;
  senza decisione, scade dopo 24 ore.
- **Non ha mai più permessi** della persona che ha creato il suo token: i permessi del token sono
  intersecati con i suoi, ambiente per ambiente.
- Non vede i campi contrassegnati come invisibili per gli agenti, né i database chiusi a MCP.

Ogni chiamata viene registrata in base alla forma dei suoi parametri, mai ai loro valori.

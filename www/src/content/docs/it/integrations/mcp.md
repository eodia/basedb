---
title: Server MCP
description: Collegare un agente IA a basedb tramite il Model Context Protocol.
---

basedb espone un **server MCP** (`POST /mcp`, allo stesso indirizzo dell’interfaccia): un agente — Claude, un
assistente di programmazione, il tuo agente — vi scopre i database, legge e scrive righe, ne
elimina se lo permetti, e **propone** evoluzioni della struttura.

## Collegare un agente

Crea un token da **Token API e MCP…** (menu del database, sotto **API e agenti**), con l’accesso MCP spuntato. Lo stesso token
serve per l’API REST e per MCP.

Per un client che parla HTTP, l’indirizzo è `http://localhost:3000/mcp` con
`Authorization: Bearer <jeton>`. Per un client che avvia processi (stdio), il repository fornisce
un relay che legge il token da una variabile d’ambiente — mai dalla configurazione:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## I quattordici strumenti

| Strumento | Ruolo |
|---|---|
| `whoami` | chi è l’agente, con quali permessi |
| `list_bases`, `describe_base`, `describe_table` | scoprire la struttura e le sue descrizioni |
| `list_records`, `get_record`, `lookup_records` | leggere, filtrare, risolvere un valore visualizzato |
| `create_record`, `update_record` | scrivere righe |
| `delete_record`, `restore_record` | eliminare una riga — con un token creato per questo — e ripristinarla |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proporre un’evoluzione della struttura |

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
- **Non modifica la struttura**: la propone. La proposta attende in **Proposte
  degli agenti…** (menu del database), dove una persona che gestisce la struttura la approva o la rifiuta;
  senza decisione, scade dopo 24 ore.
- **Non ha mai più permessi** della persona che ha creato il suo token: i permessi del token sono
  intersecati con i suoi.
- Non vede i campi contrassegnati come invisibili per gli agenti, né i database chiusi a MCP.

Ogni chiamata viene registrata in base alla forma dei suoi parametri, mai ai loro valori.

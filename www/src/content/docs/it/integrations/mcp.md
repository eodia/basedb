---
title: Server MCP
description: Collegare un agente IA a basedb tramite il Model Context Protocol.
---

basedb espone un **server MCP** (`POST /mcp`, allo stesso indirizzo dell’interfaccia): un agente — Claude, un
assistente di programmazione, il tuo agente — vi scopre i database, legge e scrive righe, e
**propone** evoluzioni della struttura.

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

## I dodici strumenti

| Strumento | Ruolo |
|---|---|
| `whoami` | chi è l’agente, con quali permessi |
| `list_bases`, `describe_base`, `describe_table` | scoprire la struttura e le sue descrizioni |
| `list_records`, `get_record`, `lookup_records` | leggere, filtrare, risolvere un valore visualizzato |
| `create_record`, `update_record` | scrivere righe |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proporre un’evoluzione della struttura |

## Cosa non fa un agente

- **Non elimina nulla.**
- **Non modifica la struttura**: la propone. La proposta attende in **Proposte
  degli agenti…** (menu del database), dove una persona che gestisce la struttura la approva o la rifiuta;
  senza decisione, scade dopo 24 ore.
- **Non ha mai più permessi** della persona che ha creato il suo token: i permessi del token sono
  intersecati con i suoi.
- Non vede i campi contrassegnati come invisibili per gli agenti, né i database chiusi a MCP.

Ogni chiamata viene registrata in base alla forma dei suoi parametri, mai ai loro valori.

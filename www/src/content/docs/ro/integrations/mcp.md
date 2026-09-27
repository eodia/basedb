---
title: Server MCP
description: Conectați un agent AI la basedb prin Model Context Protocol.
---

basedb expune un **server MCP** (`POST /mcp`, la aceeași adresă ca interfața): un agent — Claude, un
asistent de programare, propriul dumneavoastră agent — descoperă acolo bazele, citește și scrie
rânduri și **propune** modificări ale structurii.

## Conectarea unui agent

Creați un token din **Tokenuri API și MCP…** (meniul bazei, sub **API și agenți**), cu accesul MCP bifat. Același token
servește pentru API-ul REST și pentru MCP.

Pentru un client care comunică prin HTTP, adresa este `http://localhost:3000/mcp` cu
`Authorization: Bearer <jeton>`. Pentru un client care lansează procese (stdio), depozitul
furnizează un releu care citește tokenul dintr-o variabilă de mediu — niciodată din
configurație:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Cele douăsprezece instrumente

| Instrument | Rol |
|---|---|
| `whoami` | cine este agentul, cu ce permisiuni |
| `list_bases`, `describe_base`, `describe_table` | descoperirea structurii și a descrierilor ei |
| `list_records`, `get_record`, `lookup_records` | citire, filtrare, rezolvarea unei valori de afișare |
| `create_record`, `update_record` | scrierea de rânduri |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propunerea unei modificări a structurii |

## Ce nu face un agent

- **Nu șterge nimic.**
- **Nu schimbă structura**: o propune. Propunerea așteaptă în **Propunerile agenților…**
  (meniul bazei), unde o persoană care gestionează structura o aprobă sau o refuză; fără
  decizie, expiră după 24 de ore.
- **Nu are niciodată mai multe permisiuni** decât persoana care i-a creat tokenul: permisiunile
  tokenului sunt intersectate cu ale ei.
- Nu vede câmpurile marcate ca invizibile pentru agenți, nici bazele închise pentru MCP.

Fiecare apel este jurnalizat după forma parametrilor săi, niciodată după valorile lor.

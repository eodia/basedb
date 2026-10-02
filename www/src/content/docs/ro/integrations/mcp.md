---
title: Server MCP
description: Conectați un agent AI la basedb prin Model Context Protocol.
---

basedb expune un **server MCP** (`POST /mcp`, la aceeași adresă ca interfața): un agent — Claude, un
asistent de programare, propriul dumneavoastră agent — descoperă acolo bazele, citește și scrie
rânduri, le șterge dacă îi permiteți, și **propune** modificări ale structurii.

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

## Cele paisprezece instrumente

| Instrument | Rol |
|---|---|
| `whoami` | cine este agentul, cu ce permisiuni |
| `list_bases`, `describe_base`, `describe_table` | descoperirea structurii și a descrierilor ei |
| `list_records`, `get_record`, `lookup_records` | citire, filtrare, rezolvarea unei valori de afișare |
| `create_record`, `update_record` | scrierea de rânduri |
| `delete_record`, `restore_record` | ștergerea unui rând — cu un token creat pentru aceasta — și readucerea lui |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propunerea unei modificări a structurii |

## Ștergerea rândurilor

Un token creat cu drepturile **Citire, scriere și ștergere** permite agentului să șteargă
rânduri, **câte unul**, după `_id`-ul lor. `delete_record` redă rândul așa cum era, iar
ștergerea este înregistrată în istoric în numele tokenului; `restore_record` readuce rândul sub
`_id`-ul său — agentul își anulează singur greșeala, iar o persoană o poate face și ea din
istoric.

Agentul nu șterge:

- cu un token în citire, sau în citire și scriere: refuzul spune ce token trebuie creat;
- un rând pe care o relație în cascadă l-ar antrena împreună cu altele (`TOKEN_CASCADE_FORBIDDEN`):
  această ștergere se face în interfață, de o persoană care vede ce antrenează;
- mai multe rânduri dintr-o dată: niciun instrument nu face asta.

## Ce nu face un agent

- **Nu șterge decât cu acordul dumneavoastră**: un token creat pentru aceasta, câte un rând.
- **Nu schimbă structura**: o propune. Propunerea așteaptă în **Propunerile agenților…**
  (meniul bazei), unde o persoană care gestionează structura o aprobă sau o refuză; fără
  decizie, expiră după 24 de ore.
- **Nu are niciodată mai multe permisiuni** decât persoana care i-a creat tokenul: permisiunile
  tokenului sunt intersectate cu ale ei.
- Nu vede câmpurile marcate ca invizibile pentru agenți, nici bazele închise pentru MCP.

Fiecare apel este jurnalizat după forma parametrilor săi, niciodată după valorile lor.

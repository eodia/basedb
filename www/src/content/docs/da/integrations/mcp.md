---
title: MCP-server
description: Tilslut en AI-agent til basedb via Model Context Protocol.
---

basedb stiller en **MCP-server** til rådighed (`POST /mcp`, på samme adresse som brugerfladen): en
agent — Claude, en kodeassistent, din egen agent — kan her opdage databaserne, læse og skrive
rækker og **foreslå** ændringer af strukturen.

## Tilslut en agent

Opret et token fra **API- og MCP-tokens…** (databasens menu under **API og agenter**) med
MCP-adgang markeret. Det samme token bruges til REST-API'et og til MCP.

For en klient, der taler HTTP, er adressen `http://localhost:3000/mcp` med
`Authorization: Bearer <jeton>`. For en klient, der starter processer (stdio), leverer
repositoriet et relæ, der læser tokenet fra en miljøvariabel — aldrig fra konfigurationen:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## De tolv værktøjer

| Værktøj | Rolle |
|---|---|
| `whoami` | hvem agenten er, og med hvilke tilladelser |
| `list_bases`, `describe_base`, `describe_table` | opdag strukturen og dens beskrivelser |
| `list_records`, `get_record`, `lookup_records` | læs, filtrer, slå en visningsværdi op |
| `create_record`, `update_record` | skriv rækker |
| `propose_create_table`, `propose_add_field`, `get_proposal` | foreslå en ændring af strukturen |

## Hvad en agent ikke gør

- **Den sletter intet.**
- **Den ændrer ikke strukturen**: den foreslår den. Forslaget venter i **Agenternes forslag…**
  (databasens menu), hvor en person, der administrerer strukturen, godkender eller afviser det;
  uden en beslutning udløber det efter 24 timer.
- **Den har aldrig flere tilladelser** end den person, der oprettede dens token: tokenets
  tilladelser krydses med personens.
- Den ser ikke felter, der er markeret som usynlige for agenter, og heller ikke databaser, der er
  lukket for MCP.

Hvert kald logges med formen på dets parametre, aldrig med deres værdier.

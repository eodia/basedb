---
title: MCP-server
description: Tilslut en AI-agent til basedb via Model Context Protocol.
---

basedb stiller en **MCP-server** til rådighed (`POST /mcp`, på samme adresse som brugerfladen): en
agent — Claude, en kodeassistent, din egen agent — kan her opdage databaserne, læse og skrive
rækker, slette dem, hvis du tillader det, og **foreslå** ændringer af strukturen.

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

## De fjorten værktøjer

| Værktøj | Rolle |
|---|---|
| `whoami` | hvem agenten er, og med hvilke tilladelser |
| `list_bases`, `describe_base`, `describe_table` | opdag strukturen og dens beskrivelser |
| `list_records`, `get_record`, `lookup_records` | læs, filtrer, slå en visningsværdi op |
| `create_record`, `update_record` | skriv rækker |
| `delete_record`, `restore_record` | slet en række — med et token oprettet til det — og bring den tilbage |
| `propose_create_table`, `propose_add_field`, `get_proposal` | foreslå en ændring af strukturen |

## Slet rækker

Et token oprettet med rettighederne **Læse, skrive og slette** giver agenten mulighed for at
slette rækker, **én ad gangen**, via deres `_id`. `delete_record` gengiver rækken, som den var,
og sletningen historiseres i tokenets navn; `restore_record` bringer rækken tilbage under dens
`_id` — agenten retter selv sin fejl, og det kan en person også gøre fra historikken.

Agenten sletter ikke:

- med et token, der kun læser, eller læser og skriver: afvisningen angiver, hvilket token der skal
  oprettes;
- en række, som en kaskaderelation ville tage med sig sammen med andre (`TOKEN_CASCADE_FORBIDDEN`):
  den sletning sker i brugerfladen, af en person, der ser, hvad den tager med sig;
- flere rækker på én gang: intet værktøj gør det.

## Hvad en agent ikke gør

- **Den sletter kun med din tilladelse**: et token oprettet til det, én række ad gangen.
- **Den ændrer ikke strukturen**: den foreslår den. Forslaget venter i **Agenternes forslag…**
  (databasens menu), hvor en person, der administrerer strukturen, godkender eller afviser det;
  uden en beslutning udløber det efter 24 timer.
- **Den har aldrig flere tilladelser** end den person, der oprettede dens token: tokenets
  tilladelser krydses med personens.
- Den ser ikke felter, der er markeret som usynlige for agenter, og heller ikke databaser, der er
  lukket for MCP.

Hvert kald logges med formen på dets parametre, aldrig med deres værdier.

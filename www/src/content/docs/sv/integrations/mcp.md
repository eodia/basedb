---
title: MCP-server
description: Koppla en AI-agent till basedb via Model Context Protocol.
---

basedb exponerar en **MCP-server** (`POST /mcp`, på samma adress som gränssnittet): en agent –
Claude, en kodassistent, din egen agent – upptäcker där databaserna, läser och skriver rader och
**föreslår** ändringar i strukturen.

## Koppla in en agent

Skapa en token från **API- och MCP-tokens…** (databasens meny, under **API och agenter**), med
MCP-åtkomst ikryssad. Samma token används för REST-API:et och för MCP.

För en klient som talar HTTP är adressen `http://localhost:3000/mcp` med
`Authorization: Bearer <jeton>`. För en klient som startar processer (stdio) tillhandahåller
repot ett relä som läser token från en miljövariabel – aldrig från konfigurationen:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## De tolv verktygen

| Verktyg | Roll |
|---|---|
| `whoami` | vem agenten är, med vilka behörigheter |
| `list_bases`, `describe_base`, `describe_table` | upptäcka strukturen och dess beskrivningar |
| `list_records`, `get_record`, `lookup_records` | läsa, filtrera, slå upp ett visningsvärde |
| `create_record`, `update_record` | skriva rader |
| `propose_create_table`, `propose_add_field`, `get_proposal` | föreslå en ändring i strukturen |

## Vad en agent inte gör

- **Den tar inte bort något.**
- **Den ändrar inte strukturen**: den föreslår. Förslaget väntar i **Agenternas förslag…**
  (databasens meny), där en person som hanterar strukturen godkänner eller avvisar det; utan
  beslut upphör det att gälla efter 24 timmar.
- **Den har aldrig fler behörigheter** än personen som skapade dess token: tokenens behörigheter
  begränsas till skärningen med personens.
- Den ser inte fält som är markerade som osynliga för agenter, och inte heller databaser som är
  stängda för MCP.

Varje anrop loggas med parametrarnas form, aldrig med deras värden.

---
title: MCP-server
description: Koppla en AI-agent till basedb via Model Context Protocol.
---

basedb exponerar en **MCP-server** (`POST /mcp`, på samma adress som gränssnittet): en agent –
Claude, en kodassistent, din egen agent – upptäcker där databaserna, läser och skriver rader, tar
bort om du tillåter det, och **föreslår** ändringar i strukturen.

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

## De fjorton verktygen

| Verktyg | Roll |
|---|---|
| `whoami` | vem agenten är, med vilka behörigheter |
| `list_bases`, `describe_base`, `describe_table` | upptäcka strukturen och dess beskrivningar |
| `list_records`, `get_record`, `lookup_records` | läsa, filtrera, slå upp ett visningsvärde |
| `create_record`, `update_record` | skriva rader |
| `delete_record`, `restore_record` | ta bort en rad – med en token skapad för det – och återställa den |
| `propose_create_table`, `propose_add_field`, `get_proposal` | föreslå en ändring i strukturen |

## Ta bort rader

En token skapad med rättigheterna **Läsa, skriva och ta bort** låter agenten ta bort rader, **en
i taget**, via deras `_id`. `delete_record` ger tillbaka raden som den var, och borttagningen
registreras i historiken i tokenens namn; `restore_record` återställer raden med dess `_id` –
agenten ångrar själv sitt misstag, och en person kan också göra det, från historiken.

Agenten tar inte bort:

- med en token i läsläge, eller i läs- och skrivläge: avslaget säger vilken token som behövs;
- en rad som en kaskadrelation skulle ta med sig andra rader (`TOKEN_CASCADE_FORBIDDEN`): den
  borttagningen görs i gränssnittet, av en person som ser vad den tar med sig;
- flera rader på en gång: inget verktyg gör det.

## Vad en agent inte gör

- **Den tar bara bort med ditt godkännande**: en token skapad för det, en rad i taget.
- **Den ändrar inte strukturen**: den föreslår. Förslaget väntar i **Agenternas förslag…**
  (databasens meny), där en person som hanterar strukturen godkänner eller avvisar det; utan
  beslut upphör det att gälla efter 24 timmar.
- **Den har aldrig fler behörigheter** än personen som skapade dess token: tokenens behörigheter
  begränsas till skärningen med personens.
- Den ser inte fält som är markerade som osynliga för agenter, och inte heller databaser som är
  stängda för MCP.

Varje anrop loggas med parametrarnas form, aldrig med deras värden.

---
title: MCP-server
description: Koppla en AI-agent till basedb via Model Context Protocol.
---

basedb exponerar en **MCP-server** (`POST /mcp`, på samma adress som gränssnittet): en agent –
Claude, en kodassistent, din egen agent – upptäcker där databaserna, läser och skriver rader, tar
bort om du tillåter det, och **föreslår** ändringar i strukturen.

## Koppla in en agent

Skapa en token från **API- och MCP-tokens…** (databasens meny, under **API och agenter**), med
MCP-åtkomst ikryssad. Samma token används för REST-API:et och för MCP, och öppnar **hela
databasen**: dess produktion och dess andra miljöer (se längre ned).

Lägg token i en miljövariabel, `BASEDB_TOKEN`, aldrig i en konfigurationsfil. En klient som pratar
MCP över HTTP – Claude Code, bland andra – går direkt till `…/mcp` med huvudet
`Authorization: Bearer <jeton>`. Med Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Kommandot skriver projektets fil `.mcp.json`, där `${BASEDB_TOKEN}` förblir en referens till
variabeln: själva token finns inte i den.

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

En klient som bara kan starta lokala program (stdio) går via repots relä, som läser token från
variabeln som anges av `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Be sedan agenten anropa `whoami`: den berättar vem som skapade token, vilken databas den öppnar,
dess miljöer och dess behörigheter.

## Välja miljö

En databas kan ha flera [miljöer](/basedb/sv/fonctionnalites/environnements/) (produktion, test,
utveckling), var och en med sina egna tabeller och rader. En token för hela databasen öppnar alla,
och miljön väljs, från det bredaste till det mest precisa:

- **databasens namn**, utan något annat: `crm` är produktionen, `crm_recette` är testmiljön;
- **serverns adress**: `…/mcp?environment=recette` riktar sig mot testmiljön för hela
  anslutningen. Reläet gör detsamma med `--environment recette`. Man anger på så sätt en server
  per miljö, alla med samma token:

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

- **argumentet `environment`** i varje verktyg som anger en databas, för ett enda anrop:
  `list_records` med `{"base": "crm", "table": "clients", "environment": "recette"}`.

En miljö anges med sin etikett, utan hänsyn till versaler och accenter (`Recette`, `recette`,
`developpement` för ”Développement”), eller med `production`. `whoami` listar de miljöer som token
öppnar; `list_bases` och `describe_base` anger vilken miljö varje databas tillhör.

En token kan också begränsas till en enda miljö vid skapandet: den ser då ingen annan.

## De femton verktygen

| Verktyg | Roll |
|---|---|
| `whoami` | vem agenten är, med vilka behörigheter, på vilka miljöer |
| `list_bases`, `describe_base`, `describe_table` | upptäcka strukturen, dess beskrivningar och dess utseende |
| `list_records`, `get_record`, `lookup_records` | läsa, filtrera, slå upp ett visningsvärde |
| `create_record`, `update_record` | skriva rader |
| `delete_record`, `restore_record` | ta bort en rad – med en token skapad för det – och återställa den |
| `propose_create_table`, `propose_add_field`, `get_proposal` | föreslå en ändring i strukturen |
| `propose_update_look` | föreslå färg och ikon för en tabell och dess alternativ |

## Färger och ikoner

En tabell, och varje alternativ i ett enkelval, har en färg och en ikon, som i gränssnittet.
Agenten väljer dem när den föreslår:

- `propose_create_table` tar emot `color` och `icon` för tabellen;
- `propose_add_field` tar emot `color` och `icon` på varje alternativ i ett `select` eller ett
  `multi_select`;
- `propose_update_look` ändrar dem för en befintlig tabell och dess alternativ: en utelämnad
  nyckel behåller det som redan gäller, `null` rensar det.

`color` är en färg `#rrggbb`. `icon` är namnet på en [Lucide](https://lucide.dev/icons/)-ikon
bland dem som gränssnittet ritar – `truck`, `circle-check`, `flame` …: verktygets schema räknar
upp dem, och ett okänt namn avvisas. `describe_base` och `describe_table` returnerar det
nuvarande utseendet. Ett fält har däremot ingen ikon att välja: gränssnittet ritar den som hör
till dess typ.

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
- **Den ändrar inte strukturen** – inte heller dess utseende: den föreslår. Förslaget väntar i
  **Agenternas förslag…** (databasens meny), där en person som hanterar strukturen godkänner
  eller avvisar det; utan beslut upphör det att gälla efter 24 timmar.
- **Den har aldrig fler behörigheter** än personen som skapade dess token: tokenens behörigheter
  begränsas till skärningen med personens, miljö för miljö.
- Den ser inte fält som är markerade som osynliga för agenter, och inte heller databaser som är
  stängda för MCP.

Varje anrop loggas med parametrarnas form, aldrig med deras värden.

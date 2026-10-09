---
title: MCP-server
description: Een AI-agent op basedb aansluiten via het Model Context Protocol.
---

basedb biedt een **MCP-server** (`POST /mcp`, op hetzelfde adres als de interface): een agent — Claude, een
code-assistent, je eigen agent — ontdekt er de databases, leest en schrijft rijen, verwijdert ze
als je dat toestaat, en **stelt** structuurwijzigingen **voor**.

## Een agent aansluiten

Maak een token aan via **API- en MCP-tokens…** (menu van de database, onder **API en agents**), met MCP-toegang aangevinkt. Hetzelfde token
werkt voor de REST-API en voor MCP, en opent **de hele database**: haar productie en haar andere
omgevingen (zie verderop).

Zet het token in een omgevingsvariabele, `BASEDB_TOKEN`, nooit in een configuratiebestand.
Een client die MCP via HTTP spreekt — onder andere Claude Code — gaat rechtstreeks naar `…/mcp` met de
header `Authorization: Bearer <jeton>`. Met Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Het commando schrijft het bestand `.mcp.json` van het project, waarin `${BASEDB_TOKEN}` een verwijzing
naar de variabele blijft: het token zelf staat er niet in.

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

Een client die alleen lokale programma’s kan starten (stdio), gaat via de relay van de repository, die
het token leest uit de variabele die `--token-env` aangeeft:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Vraag de agent daarna om `whoami` aan te roepen: dat zegt wie het token heeft aangemaakt, welke
database het opent, met welke omgevingen en welke rechten.

## De omgeving kiezen

Een database kan meerdere [omgevingen](/basedb/nl/fonctionnalites/environnements/) hebben — productie,
acceptatie, ontwikkeling —, elk met eigen tabellen en rijen. Een token voor de hele database opent ze
allemaal, en de omgeving kies je, van het meest algemene tot het meest nauwkeurige:

- **de naam van de database**, zonder iets anders: `crm` is productie, `crm_recette` acceptatie;
- **het adres van de server**: `…/mcp?environment=recette` richt zich voor de hele verbinding op
  acceptatie. De relay doet hetzelfde met `--environment recette`. Zo registreer je een server per
  omgeving, allemaal met hetzelfde token:

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

- **het argument `environment`** van elke tool die een database noemt, voor één enkele aanroep:
  `list_records` met `{"base": "crm", "table": "clients", "environment": "recette"}`.

Een omgeving noem je met de naam op haar badge, hoofdletters en accenten doen er niet toe (`Recette`,
`recette`, `developpement` voor “Développement”), of met `production`. `whoami` toont de omgevingen
die het token opent; `list_bases` en `describe_base` zeggen tot welke omgeving elke database behoort.

Een token kan bij het aanmaken ook tot één omgeving worden beperkt: het ziet er dan geen enkele andere.

## De vijftien tools

| Tool | Rol |
|---|---|
| `whoami` | wie de agent is, met welke rechten, op welke omgevingen |
| `list_bases`, `describe_base`, `describe_table` | de structuur, de beschrijvingen en het uiterlijk ervan ontdekken |
| `list_records`, `get_record`, `lookup_records` | lezen, filteren, een weergavewaarde omzetten |
| `create_record`, `update_record` | rijen schrijven |
| `delete_record`, `restore_record` | een rij verwijderen — met een token dat daarvoor is aangemaakt — en terughalen |
| `propose_create_table`, `propose_add_field`, `get_proposal` | een structuurwijziging voorstellen |
| `propose_update_look` | de kleur en het pictogram van een tabel en van haar keuzes voorstellen |

## Kleuren en pictogrammen

Een tabel, en elke keuze uit een keuzelijst, hebben een kleur en een pictogram, zoals in de
interface. De agent kiest ze door ze voor te stellen:

- `propose_create_table` accepteert `color` en `icon` voor de tabel;
- `propose_add_field` accepteert `color` en `icon` op elke optie van een `select` of een
  `multi_select`;
- `propose_update_look` wijzigt die van een bestaande tabel en van haar keuzes: een weggelaten sleutel
  behoudt wat er staat, `null` wist het.

`color` is een kleur `#rrggbb`. `icon` is de naam van een [Lucide](https://lucide.dev/icons/)-pictogram
uit de pictogrammen die de interface tekent — `truck`, `circle-check`, `flame`…: het schema van de tool
somt ze op, en een onbekende naam wordt geweigerd. `describe_base` en `describe_table` geven het
huidige uiterlijk terug. Een veld heeft geen pictogram om te kiezen: de interface tekent dat van zijn
type.

## Rijen verwijderen

Een token dat is aangemaakt met de rechten **Lezen, schrijven en verwijderen** staat de agent toe
om rijen te verwijderen, **één voor één**, via hun `_id`. `delete_record` geeft de rij terug zoals
ze was, en de verwijdering wordt vastgelegd op naam van het token; `restore_record` brengt de rij
terug onder dezelfde `_id` — de agent maakt zijn eigen fout zelf ongedaan, en een persoon kan dat
ook vanuit de geschiedenis.

De agent verwijdert niet:

- met een token dat alleen mag lezen, of mag lezen en schrijven: de weigering zegt welk token je
  moet aanmaken;
- een rij die via een cascaderelatie andere rijen mee zou nemen (`TOKEN_CASCADE_FORBIDDEN`): die
  verwijdering gebeurt in de interface, door een persoon die ziet wat ze meeneemt;
- meerdere rijen in één keer: geen enkele tool doet dat.

## Wat een agent niet doet

- **Hij verwijdert alleen met jouw toestemming**: een token dat daarvoor is aangemaakt, één rij per keer.
- **Hij wijzigt de structuur niet** — het uiterlijk evenmin: hij stelt die wijzigingen voor. Het
  voorstel wacht in **Agentvoorstellen…** (menu van de database), waar een persoon die de structuur
  beheert het goedkeurt of weigert; zonder beslissing verloopt het na 24 uur.
- **Hij heeft nooit meer rechten** dan de persoon die zijn token heeft aangemaakt: de rechten van het token worden
  gecombineerd met die van die persoon, omgeving voor omgeving, en alleen wat beide toestaan blijft over.
- Hij ziet de velden niet die als onzichtbaar voor agents zijn gemarkeerd, en ook niet de databases die voor MCP gesloten zijn.

Elke aanroep wordt gelogd met de vorm van zijn parameters, nooit met hun waarden.

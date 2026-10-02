---
title: MCP-server
description: Een AI-agent op basedb aansluiten via het Model Context Protocol.
---

basedb biedt een **MCP-server** (`POST /mcp`, op hetzelfde adres als de interface): een agent — Claude, een
code-assistent, je eigen agent — ontdekt er de databases, leest en schrijft rijen, verwijdert ze
als je dat toestaat, en **stelt** structuurwijzigingen **voor**.

## Een agent aansluiten

Maak een token aan via **API- en MCP-tokens…** (menu van de database, onder **API en agents**), met MCP-toegang aangevinkt. Hetzelfde token
werkt voor de REST-API en voor MCP.

Voor een client die HTTP spreekt, is het adres `http://localhost:3000/mcp` met
`Authorization: Bearer <jeton>`. Voor een client die processen start (stdio), levert de repository
een relay die het token uit een omgevingsvariabele leest — nooit uit de configuratie:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## De veertien tools

| Tool | Rol |
|---|---|
| `whoami` | wie de agent is, met welke rechten |
| `list_bases`, `describe_base`, `describe_table` | de structuur en de beschrijvingen ervan ontdekken |
| `list_records`, `get_record`, `lookup_records` | lezen, filteren, een weergavewaarde omzetten |
| `create_record`, `update_record` | rijen schrijven |
| `delete_record`, `restore_record` | een rij verwijderen — met een token dat daarvoor is aangemaakt — en terughalen |
| `propose_create_table`, `propose_add_field`, `get_proposal` | een structuurwijziging voorstellen |

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
- **Hij wijzigt de structuur niet**: hij stelt haar voor. Het voorstel wacht in **Voorstellen
  van agents…** (menu van de database), waar een persoon die de structuur beheert het goedkeurt of weigert;
  zonder beslissing verloopt het na 24 uur.
- **Hij heeft nooit meer rechten** dan de persoon die zijn token heeft aangemaakt: de rechten van het token worden
  gecombineerd met die van die persoon, en alleen wat beide toestaan blijft over.
- Hij ziet de velden niet die als onzichtbaar voor agents zijn gemarkeerd, en ook niet de databases die voor MCP gesloten zijn.

Elke aanroep wordt gelogd met de vorm van zijn parameters, nooit met hun waarden.

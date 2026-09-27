---
title: Server MCP
description: Připojení AI agenta k basedb přes Model Context Protocol.
---

basedb poskytuje **server MCP** (`POST /mcp`, na stejné adrese jako rozhraní): agent – Claude,
asistent pro programování, váš vlastní agent – v něm objevuje databáze, čte a zapisuje řádky
a **navrhuje** změny struktury.

## Připojení agenta

Vytvořte token přes **Tokeny API a MCP…** (nabídka databáze, v části **API a agenti**) se zaškrtnutým přístupem MCP. Tentýž token
slouží pro REST API i pro MCP.

Pro klienta, který komunikuje přes HTTP, je adresa `http://localhost:3000/mcp` s hlavičkou
`Authorization: Bearer <jeton>`. Pro klienta, který spouští procesy (stdio), obsahuje
repozitář relé, které čte token z proměnné prostředí – nikdy z konfigurace:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Dvanáct nástrojů

| Nástroj | Role |
|---|---|
| `whoami` | kdo je agent a s jakými oprávněními |
| `list_bases`, `describe_base`, `describe_table` | objevování struktury a jejích popisů |
| `list_records`, `get_record`, `lookup_records` | čtení, filtrování, dohledání zobrazované hodnoty |
| `create_record`, `update_record` | zápis řádků |
| `propose_create_table`, `propose_add_field`, `get_proposal` | návrh změny struktury |

## Co agent nedělá

- **Nic neodstraňuje.**
- **Nemění strukturu**: navrhuje ji. Návrh čeká v **Návrhy agentů…** (nabídka databáze), kde
  ho osoba, která spravuje strukturu, schválí nebo zamítne; bez rozhodnutí vyprší po
  24 hodinách.
- **Nikdy nemá víc oprávnění** než osoba, která vytvořila jeho token: oprávnění tokenu se
  protínají s jejími.
- Nevidí pole označená jako neviditelná pro agenty ani databáze uzavřené pro MCP.

Každé volání se zaznamenává podle tvaru svých parametrů, nikdy podle jejich hodnot.

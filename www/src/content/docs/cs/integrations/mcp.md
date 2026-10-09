---
title: Server MCP
description: Připojení AI agenta k basedb přes Model Context Protocol.
---

basedb poskytuje **server MCP** (`POST /mcp`, na stejné adrese jako rozhraní): agent – Claude,
asistent pro programování, váš vlastní agent – v něm objevuje databáze, čte a zapisuje řádky,
pokud mu to dovolíte i odstraňuje, a **navrhuje** změny struktury.

## Připojení agenta

Vytvořte token přes **Tokeny API a MCP…** (nabídka databáze, v části **API a agenti**) se zaškrtnutým přístupem MCP. Tentýž token
slouží pro REST API i pro MCP a otevírá **celou databázi**: její produkční prostředí i ostatní
prostředí (viz níže).

Token uložte do proměnné prostředí `BASEDB_TOKEN`, nikdy do konfiguračního souboru. Klient, který
mluví MCP přes HTTP – mimo jiné Claude Code – míří přímo na `…/mcp` s hlavičkou
`Authorization: Bearer <jeton>`. S Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Příkaz zapíše soubor `.mcp.json` projektu, v němž `${BASEDB_TOKEN}` zůstává odkazem na proměnnou:
samotný token v něm není.

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

Klient, který umí spouštět jen místní programy (stdio), používá relé z repozitáře, které čte token
z proměnné, již pojmenuje `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Poté požádejte agenta, aby zavolal `whoami`: řekne, kdo token vytvořil, kterou databázi a která její
prostředí otevírá a jaká má oprávnění.

## Volba prostředí

Databáze může mít více [prostředí](/basedb/cs/fonctionnalites/environnements/) – produkční,
testovací, vývojové –, každé s vlastními tabulkami a řádky. Token celé databáze je otevírá všechna
a prostředí se volí od nejširšího po nejpřesnější:

- **název databáze**, bez čehokoli dalšího: `crm` je produkční prostředí, `crm_recette` testovací;
- **adresa serveru**: `…/mcp?environment=recette` míří na testovací prostředí pro celé spojení.
  Relé dělá totéž s `--environment recette`. Tak se deklaruje jeden server na prostředí, všechny
  se stejným tokenem:

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

- **argument `environment`** každého nástroje, který jmenuje databázi, pro jediné volání:
  `list_records` s `{"base": "crm", "table": "clients", "environment": "recette"}`.

Prostředí se jmenuje podle svého štítku, bez ohledu na velká písmena a diakritiku
(`Recette`, `recette`, `developpement` pro „Développement“), nebo podle `production`. `whoami`
vypíše ta, která token otevírá; `list_bases` a `describe_base` říkají, o které prostředí jde
u každé databáze.

Token lze také při vytvoření omezit na jediné prostředí: žádné další pak nevidí.

## Patnáct nástrojů

| Nástroj | Role |
|---|---|
| `whoami` | kdo je agent, s jakými oprávněními a na kterých prostředích |
| `list_bases`, `describe_base`, `describe_table` | objevování struktury, jejích popisů a jejího vzhledu |
| `list_records`, `get_record`, `lookup_records` | čtení, filtrování, dohledání zobrazované hodnoty |
| `create_record`, `update_record` | zápis řádků |
| `delete_record`, `restore_record` | odstranit řádek — s tokenem k tomu vytvořeným — a vrátit ho zpět |
| `propose_create_table`, `propose_add_field`, `get_proposal` | návrh změny struktury |
| `propose_update_look` | návrh barvy a ikony tabulky a jejích voleb |

## Barvy a ikony

Tabulka a každá volba seznamu voleb mají barvu a ikonu, stejně jako v rozhraní. Agent je volí tím,
že je navrhuje:

- `propose_create_table` přijímá `color` a `icon` pro tabulku;
- `propose_add_field` přijímá `color` a `icon` u každé možnosti pole `select` nebo `multi_select`;
- `propose_update_look` mění barvu a ikonu existující tabulky a jejích voleb: vynechaný klíč
  ponechá to, co je nastaveno, `null` to vymaže.

`color` je barva `#rrggbb`. `icon` je název ikony [Lucide](https://lucide.dev/icons/) z těch, které
rozhraní vykresluje – `truck`, `circle-check`, `flame`…: schéma nástroje je vyjmenovává a neznámý
název je odmítnut. `describe_base` a `describe_table` vracejí aktuální vzhled. Pole naproti tomu
nemá ikonu k výběru: rozhraní vykresluje ikonu jeho typu.

## Odstraňování řádků

Token vytvořený s oprávněním **Čtení, zápis a odstranění** umožňuje agentovi odstraňovat
řádky, **jeden po druhém**, podle jejich `_id`. `delete_record` vrátí řádek tak, jak byl,
a odstranění se zaznamená do historie jménem tokenu; `restore_record` vrátí řádek zpět pod jeho
`_id` — agent tak sám napraví svou chybu, a totéž může udělat i člověk z historie.

Agent neodstraňuje:

- s tokenem pouze pro čtení, nebo pro čtení a zápis: odmítnutí řekne, jaký token vytvořit;
- řádek, který by kaskádová vazba odnesla spolu s dalšími (`TOKEN_CASCADE_FORBIDDEN`):
  takové odstranění se provádí v rozhraní, osobou, která vidí, co tím odnáší;
- více řádků najednou: to žádný nástroj neumí.

## Co agent nedělá

- **Odstraňuje jen s vaším souhlasem**: token k tomu vytvořený, jeden řádek po druhém.
- **Nemění strukturu** – ani její vzhled: navrhuje ji. Návrh čeká v **Návrhy agentů…** (nabídka
  databáze), kde ho osoba, která spravuje strukturu, schválí nebo zamítne; bez rozhodnutí vyprší
  po 24 hodinách.
- **Nikdy nemá víc oprávnění** než osoba, která vytvořila jeho token: oprávnění tokenu se
  protínají s jejími, prostředí po prostředí.
- Nevidí pole označená jako neviditelná pro agenty ani databáze uzavřené pro MCP.

Každé volání se zaznamenává podle tvaru svých parametrů, nikdy podle jejich hodnot.

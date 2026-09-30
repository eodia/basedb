---
title: n8n
description: Číst a zapisovat řádky basedb z workflow n8n a spustit ho při každém vytvořeném, upraveném nebo odstraněném řádku.
---

Balíček **n8n-nodes-basedb** přidává do n8n tři uzly:

| Uzel | Role |
|---|---|
| **basedb** | čte a zapisuje řádky tabulky, komentuje řádek; použitelný jako nástroj agentem AI v n8n |
| **basedb Trigger** | spustí workflow pro každý řádek vytvořený — nebo vytvořený nebo upravený — od posledního dotazu |
| **basedb Webhook Trigger** | spustí workflow ve chvíli, kdy je řádek vytvořen, upraven nebo odstraněn |

## Instalace

V n8n: **Settings › Community Nodes › Install**, a pak `n8n-nodes-basedb`.

Bez rozhraní — režim fronty, předem sestavený Docker obraz —: `npm install
n8n-nodes-basedb` do složky `~/.n8n/nodes`, a pak n8n restartujte.

## Přihlašovací údaje

V n8n vytvořte přihlašovací údaj **basedb API**:

| Pole | Hodnota |
|---|---|
| **Instance URL** | adresa, na které otevíráte basedb: `https://basedb.exemple.fr` |
| **Workspace** | reference pracovního prostoru, ta z adres API (`/api/v1/<prostor>/…`): `t4z56fq`, pokud instance nenastavuje `BASEDB_TENANT` |
| **Token** | **integrační token**: nabídka **⋯** databáze → **API a agenti** → **Tokeny API a MCP…** |

Token otevírá **jednu** databázi. Čte její řádky, zapisuje je, pokud byl vytvořen pro zápis,
nikdy nemá víc oprávnění než osoba, která ho vytvořila, a **nikdy nic neodstraňuje**. Při
uložení n8n vyzkouší spojení a řekne, zda je token odmítnut.

## Čtení a zápis: uzel basedb

| Operace | Co dělá |
|---|---|
| **Row › Create** | přidá řádek |
| **Row › Create or Update** | upraví řádek, jehož zvolená pole nesou tyto hodnoty, nebo ho přidá, pokud žádný nese |
| **Row › Get** | přečte řádek podle jeho `_id` |
| **Row › Get Many** | přečte řádky podle filtru, v požadovaném pořadí, až do limitu nebo všechny, stránku po stránce |
| **Row › Update** | upraví řádek, nalezený podle jeho `_id` nebo podle jiných polí |
| **Comment › Create** | komentuje řádek; @zmínka upozorní danou osobu |

**Databáze** a **tabulka** se vybírají ze seznamů, z těch, které token otevírá. Pole k zápisu
se zobrazují pod svým názvem v basedb, jednoduchý výběr se svými možnostmi, pole Osoba
s členy pracovního prostoru; počítané pole — vzorec, vyhledávání, agregace, automatické
číslo — se v nich nenachází, protože ho zapisuje sám basedb. Hodnota, kterou pole odmítne,
zastaví uzel na kódu basedb a jeho významu.

- **Filtr** a **řazení** používají technické názvy polí, ty ze SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Gramatika je stejná jako
  u [REST API](/basedb/cs/integrations/api-rest/#čtení).
- **Čísla** přicházejí jako desetinný text (`"1250.50"`), aby se neztratila žádná číslice;
  volba **Numbers as Numbers** je převede na čísla.
- **Vazba** se čte jako `{ "id": …, "display": … }` a zapisuje se pomocí `_id` propojeného
  řádku.
- **Create or Update** nikdy neupraví více řádků: pokud jich víc nese tyto hodnoty, uzel se
  zastaví, místo aby hádal.
- Žádná operace **Delete**: token nic neodstraňuje. Pro vyřazení řádků je označte (stav
  „Archivé“), nebo svěřte odstranění [automatizaci](/basedb/cs/fonctionnalites/automatisations/).

## Spuštění workflow

### Při každém dotazu: basedb Trigger

Uzel se dotazuje basedb, ve zvoleném tempu (každou minutu, každou hodinu…), na řádky
**vytvořené** — nebo **vytvořené nebo upravené** — od posledního dotazu, případně navíc
s filtrem. Funguje všude, i když basedb nemůže spojit n8n. Při prvním dotazu si zaznamená,
kde je tabulka, a nic nevydá; zkušební spuštění z editoru vrátí poslední řádek, aby bylo čím
propojit následující uzly.

### Okamžitě: basedb Webhook Trigger

Každý řádek vytvořený, upravený nebo odstraněný — i SQL příkazem napsaným přímo
v PostgreSQL — okamžitě spustí workflow:

1. Přidejte uzel a zkopírujte jeho **Production URL**.
2. V basedb, nabídka **⋯** databáze → **API a agenti** → **Webhooky…**: vytvořte webhook na
   tuto adresu, zvolte jeho tabulky a jeho události.
3. basedb jednou zobrazí **tajný podpisový klíč**: vložte ho do přihlašovacího údaje
   **basedb Webhook** v n8n.
4. Aktivujte workflow.

Každá událost se stane položkou: svým `type` (`record.created`, `record.updated`,
`record.deleted`), tabulkou, řádkem **před** a **po**, a změněnými poli (`changed`). Uzel
ověřuje **podpis** každého doručení a odpoví `401` tomu, které ho nemá, má nesprávný, nebo je
starší než pět minut. basedb doručuje **alespoň jednou**: pokud workflow nemá zpracovat
událost dvakrát, odstraňte duplicity podle `id` události.

:::note
basedb odesílá webhook jen na veřejnou adresu **HTTPS**: n8n v privátní síti použije raději
**basedb Trigger**. Viz [Webhooky](/basedb/cs/integrations/webhooks/).
:::

## Bez uzlu

Uzel n8n **HTTP Request** mluví s basedb také: hlavička `Authorization: Bearer <token>`, JSON
při odeslání i při odpovědi, stránkování pomocí `meta.next_cursor` předaného jako `after`
(`{{ $response.body.meta.next_cursor }}`), a návrat po výpadku pomocí filtru na
`_updated_at` a pomocí `…/<table>/deleted?since=`.

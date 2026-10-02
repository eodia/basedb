---
title: n8n
description: Läsa och skriva basedbs rader från ett n8n-arbetsflöde, och starta ett för varje rad som skapas, ändras eller tas bort.
---

Paketet **n8n-nodes-basedb** lägger till tre noder i n8n:

| Nod | Roll |
|---|---|
| **basedb** | läsa och skriva raderna i en tabell, kommentera en rad; kan användas som verktyg av en AI-agent i n8n |
| **basedb Trigger** | starta ett arbetsflöde för varje rad som skapats – eller skapats eller ändrats – sedan senaste avläsningen |
| **basedb Webhook Trigger** | starta ett arbetsflöde i samma stund en rad skapas, ändras eller tas bort |

## Installera

I n8n: **Settings › Community Nodes › Install**, sedan `n8n-nodes-basedb`.

Utan gränssnittet – köläge, en Docker-avbildning som redan är förberedd –: `npm install
n8n-nodes-basedb` i mappen `~/.n8n/nodes`, och starta sedan om n8n.

## Autentiseringsuppgifterna

Skapa en autentiseringsuppgift **basedb API** i n8n:

| Fält | Värde |
|---|---|
| **Instance URL** | adressen där du öppnar basedb: `https://basedb.exemple.fr` |
| **Workspace** | arbetsytans referens, den som ingår i API:ets adresser (`/api/v1/<arbetsyta>/…`): `t4z56fq`, om inte instansen har satt `BASEDB_TENANT` |
| **Token** | en **integrationstoken**: databasens **⋯**-meny → **API och agenter** → **API- och MCP-tokens…** |

En token öppnar **en** databas. Den läser dess rader, skriver dem om den skapades med
skrivrätt, och har aldrig fler behörigheter än personen som skapade den. Vid sparandet testar
n8n anslutningen och säger till om token avvisas.

## Läsa och skriva: noden basedb

| Åtgärd | Vad den gör |
|---|---|
| **Row › Create** | lägger till en rad |
| **Row › Create or Update** | ändrar raden vars valda fält har dessa värden, eller lägger till den om ingen rad har dem |
| **Row › Get** | läser en rad via dess `_id` |
| **Row › Get Many** | läser raderna i ett filter, i begärd ordning, upp till en gräns eller alla, sida efter sida |
| **Row › Update** | ändrar en rad, hittad via dess `_id` eller andra fält |
| **Comment › Create** | kommenterar en rad; en @omnämning aviserar personen |

**Databasen** och **tabellen** väljs i listor, de som token öppnar. Fälten att skriva till visas
med sitt namn i basedb, ett enkelval med sina alternativ, ett Person-fält med arbetsytans
medlemmar; ett beräknat fält – formel, uppslag, aggregering, autonummer – finns inte där,
eftersom basedb skriver det självt. Ett värde som fältet avvisar stoppar noden med basedbs kod
och vad den betyder.

- **Filtret** och **sorteringen** använder fältens tekniska namn, samma som i SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Grammatiken är densamma som för
  [REST-API:et](/basedb/sv/integrations/api-rest/#läsa).
- **Talen** kommer som decimaltext (`"1250.50"`), för att inte tappa någon siffra; alternativet
  **Numbers as Numbers** omvandlar dem till tal.
- En **relation** läses som `{ "id": …, "display": … }` och skrivs med den länkade radens
  `_id`.
- **Create or Update** ändrar aldrig flera rader: om flera har värdena stoppar noden hellre än
  att gissa.
- Ingen åtgärd **Delete**: vill du ta bort rader, markera dem (en status ”Arkiverad”), låt en
  [automatisering](/basedb/sv/fonctionnalites/automatisations/) sköta borttagningen, eller
  anropa [REST-API:et](/basedb/sv/integrations/api-rest/) med en token skapad för att ta bort.

## Starta ett arbetsflöde

### Vid varje avläsning: basedb Trigger

Noden frågar basedb, i den takt du väljer (varje minut, varje timme …), efter raderna som
**skapats** – eller **skapats eller ändrats** – sedan senast, med ett filter till om det
behövs. Den fungerar överallt, även när basedb inte kan nå n8n. Vid sin första avläsning
noterar den var tabellen står och skickar inget; ett test från redigeraren ger den senaste
raden, för att ha något att koppla de följande noderna till.

### Direkt: basedb Webhook Trigger

Varje rad som skapas, ändras eller tas bort – även med SQL skriven direkt i PostgreSQL –
startar arbetsflödet omedelbart:

1. Lägg till noden och kopiera dess **Production URL**.
2. I basedb, databasens **⋯**-meny → **API och agenter** → **Webhooks…**: skapa en webhook mot
   den adressen, och välj dess tabeller och händelser.
3. basedb visar en gång **signeringshemligheten**: lägg den i en autentiseringsuppgift
   **basedb Webhook** i n8n.
4. Aktivera arbetsflödet.

Varje händelse blir ett element: dess `type` (`record.created`, `record.updated`,
`record.deleted`), tabellen, raden **före** och **efter**, och de ändrade fälten (`changed`).
Noden kontrollerar **signaturen** för varje leverans och svarar `401` på den som saknar en, har
en falsk, eller som är äldre än fem minuter. basedb levererar **minst en gång**: avdubblera på
händelsens `id` om arbetsflödet inte får hantera den två gånger.

:::note
basedb skickar bara en webhook till en **offentlig HTTPS-adress**: ett n8n på ett privat
nätverk använder i stället **basedb Trigger**. Se [Webhooks](/basedb/sv/integrations/webhooks/).
:::

## Utan noden

n8ns nod **HTTP Request** pratar också med basedb: rubriken `Authorization: Bearer <token>`,
JSON både ut och in, paginering med `meta.next_cursor` skickad som `after`
(`{{ $response.body.meta.next_cursor }}`), och återupptagning efter ett avbrott med ett filter
på `_updated_at` och med `…/<table>/deleted?since=`.

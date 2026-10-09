---
title: n8n
description: De rijen van basedb lezen en schrijven vanuit een n8n-workflow, en er een starten bij elke aangemaakte, gewijzigde of verwijderde rij.
---

Het pakket **n8n-nodes-basedb** voegt drie nodes toe aan n8n:

| Node | Rol |
|---|---|
| **basedb** | de rijen van een tabel lezen en schrijven, een rij becommentariëren; te gebruiken als tool door een AI-agent van n8n |
| **basedb Trigger** | een workflow starten voor elke rij die is aangemaakt — of aangemaakt of gewijzigd — sinds de laatste peiling |
| **basedb Webhook Trigger** | een workflow starten op het moment dat een rij wordt aangemaakt, gewijzigd of verwijderd |

## Installeren

In n8n: **Settings › Community Nodes › Install**, dan `n8n-nodes-basedb`.

Zonder de interface — wachtrijmodus, vooraf gebouwde Docker-image — : `npm install
n8n-nodes-basedb` in de map `~/.n8n/nodes`, en herstart daarna n8n.

## De identiteitsgegevens

Maak in n8n een identiteitsgegeven **basedb API** aan:

| Veld | Waarde |
|---|---|
| **Instance URL** | het adres waarop je basedb opent: `https://basedb.exemple.fr` |
| **Workspace** | de referentie van de werkruimte, die van de API-adressen (`/api/v1/<werkruimte>/…`): `t4z56fq`, tenzij de instantie `BASEDB_TENANT` instelt |
| **Token** | een **integratietoken**: menu **⋯** van de database → **API en agents** → **API- en MCP-tokens…** |
| **Environment** | optioneel: de omgeving van de database waarin je werkt — `recette`, `production`… Leeg: productie |

Een token opent **één** database — alle omgevingen ervan, of slechts één als het bij het aanmaken is
beperkt. Het leest haar rijen, schrijft ze als het met schrijfrechten is aangemaakt, en heeft nooit
meer rechten dan de persoon die het heeft aangemaakt. Bij het opslaan probeert n8n de verbinding en
meldt het of het token wordt geweigerd.

Om op productie en op acceptatie te werken, maak je twee identiteitsgegevens met hetzelfde token, het
ene met **Environment** leeg, het andere met `recette`. Zonder gekozen omgeving toont de lijst met
databases van de node elke omgeving, met haar naam tussen haakjes.

## Lezen en schrijven: de basedb-node

| Bewerking | Wat ze doet |
|---|---|
| **Row › Create** | voegt een rij toe |
| **Row › Create or Update** | wijzigt de rij waarvan de gekozen velden deze waarden dragen, of voegt ze toe als geen enkele rij ze draagt |
| **Row › Get** | leest een rij via haar `_id` |
| **Row › Get Many** | leest de rijen van een filter, in de gevraagde volgorde, tot een limiet of allemaal, pagina na pagina |
| **Row › Update** | wijzigt een rij, gevonden via haar `_id` of via andere velden |
| **Comment › Create** | becommentarieert een rij; een @vermelding stuurt de persoon een melding |

De **database** en de **tabel** kies je uit lijsten, die welke het token opent. De velden om te
schrijven worden getoond met hun naam in basedb, een enkele keuze met haar opties, een veld
Persoon met de leden van de werkruimte; een berekend veld — formule, opzoekveld, aggregatie,
automatisch nummer — komt er niet in voor, omdat basedb het zelf schrijft. Een waarde die het
veld weigert, stopt de node op de code van basedb en wat die betekent.

- Het **filter** en de **sortering** gebruiken de technische namen van de velden, die van SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. De grammatica is die van de
  [REST-API](/basedb/nl/integrations/api-rest/#lezen).
- **Getallen** komen aan als decimale tekst (`"1250.50"`), om geen enkel cijfer te verliezen;
  de optie **Numbers as Numbers** zet ze om in getallen.
- Een **relatie** wordt gelezen als `{ "id": …, "display": … }` en geschreven via de `_id` van
  de gekoppelde rij.
- **Create or Update** wijzigt nooit meerdere rijen: als er meerdere de waarden dragen, stopt
  de node in plaats van te raden.
- Geen bewerking **Delete**: om rijen te verwijderen, markeer je ze (een status “Archivé”),
  vertrouw je de verwijdering toe aan een
  [automatisering](/basedb/nl/fonctionnalites/automatisations/), of roep je de
  [REST-API](/basedb/nl/integrations/api-rest/) aan met een token dat voor verwijderen is
  aangemaakt.

## Een workflow starten

### Bij elke peiling: basedb Trigger

De node vraagt basedb, in het gekozen tempo (elke minuut, elk uur…), naar de rijen die
**aangemaakt** — of **aangemaakt of gewijzigd** — zijn sinds de vorige keer, met eventueel een
extra filter. Hij werkt overal, ook wanneer basedb n8n niet kan bereiken. Bij zijn eerste
peiling noteert hij waar de tabel staat en geeft hij niets door; een test vanuit de editor
levert de laatste rij op, zodat er iets is om de volgende nodes aan te koppelen.

### Meteen: basedb Webhook Trigger

Elke rij die wordt aangemaakt, gewijzigd of verwijderd — zelfs door SQL rechtstreeks in
PostgreSQL geschreven — start de workflow onmiddellijk:

1. Voeg de node toe en kopieer zijn **Production URL**.
2. In basedb, menu **⋯** van de database → **API en agents** → **Webhooks…**: maak een webhook
   naar dit adres, kies zijn tabellen en zijn gebeurtenissen.
3. basedb toont eenmalig het **ondertekeningsgeheim**: zet het in een identiteitsgegeven
   **basedb Webhook** van n8n.
4. Activeer de workflow.

Elke gebeurtenis wordt een element: zijn `type` (`record.created`, `record.updated`,
`record.deleted`), de tabel, de rij **voor** en **na**, en de gewijzigde velden (`changed`).
De node controleert de **handtekening** van elke levering en antwoordt `401` op een levering
zonder handtekening, met een onjuiste handtekening, of die meer dan vijf minuten oud is. basedb
levert **minstens één keer**: ontdubbel op het `id` van de gebeurtenis als de workflow het niet
twee keer mag verwerken.

:::note
basedb verstuurt alleen een webhook naar een **openbaar HTTPS-adres**: een n8n op een
privénetwerk gebruikt liever **basedb Trigger**. Zie [Webhooks](/basedb/nl/integrations/webhooks/).
:::

## Zonder de node

De node **HTTP Request** van n8n praat ook met basedb: header `Authorization: Bearer <token>`,
JSON heen en terug, paginering via `meta.next_cursor` doorgegeven als `after`
(`{{ $response.body.meta.next_cursor }}`), en herstel na een storing via een filter op
`_updated_at` en via `…/<table>/deleted?since=`.

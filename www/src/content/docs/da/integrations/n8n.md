---
title: n8n
description: Læs og skriv basedbs rækker fra et n8n-workflow, og start et for hver række, der oprettes, ændres eller slettes.
---

Pakken **n8n-nodes-basedb** tilføjer tre noder til n8n:

| Node | Rolle |
|---|---|
| **basedb** | læser og skriver rækkerne i en tabel, kommenterer en række; kan bruges som værktøj af en AI-agent i n8n |
| **basedb Trigger** | starter et workflow for hver række, der er oprettet — eller oprettet eller ændret — siden sidste aflæsning |
| **basedb Webhook Trigger** | starter et workflow i det øjeblik en række oprettes, ændres eller slettes |

## Installer

I n8n: **Settings › Community Nodes › Install**, derefter `n8n-nodes-basedb`.

Uden brugerfladen — kø-tilstand, et Docker-image, der er sat op i forvejen —: `npm install
n8n-nodes-basedb` i mappen `~/.n8n/nodes`, og genstart n8n.

## Legitimationsoplysningerne

Opret et legitimationssæt **basedb API** i n8n:

| Felt | Værdi |
|---|---|
| **Instance URL** | adressen, hvor du åbner basedb: `https://basedb.exemple.fr` |
| **Workspace** | arbejdsområdets reference, den i API'ets adresser (`/api/v1/<arbejdsområde>/…`): `t4z56fq`, med mindre instansen fastsætter `BASEDB_TENANT` |
| **Token** | et **integrationstoken**: menuen **⋯** af databasen → **API og agenter** → **API- og MCP-tokens…** |
| **Environment** | valgfrit: det miljø i databasen, der skal arbejdes i — `recette`, `production`… Tomt: produktion |

Et token åbner **én** database — alle dens miljøer, eller kun ét, hvis det blev begrænset ved
oprettelsen. Det læser dens rækker, skriver dem, hvis det er oprettet med skriveadgang, og har
aldrig flere tilladelser end den person, der oprettede det. Ved oprettelsen afprøver n8n
forbindelsen og siger, om tokenet afvises.

For at arbejde på produktion og på test skal du oprette to legitimationssæt med det samme token,
det ene med **Environment** tomt, det andet med `recette`. Uden et valgt miljø viser nodens liste
over databaser hvert miljø, med dets navn i parentes.

## Læs og skriv: noden basedb

| Handling | Hvad den gør |
|---|---|
| **Row › Create** | tilføjer en række |
| **Row › Create or Update** | ændrer den række, hvis valgte felter bærer disse værdier, eller tilføjer den, hvis ingen gør |
| **Row › Get** | læser en række ved dens `_id` |
| **Row › Get Many** | læser rækkerne fra et filter, i den ønskede rækkefølge, op til en grænse eller alle, side for side |
| **Row › Update** | ændrer en række, fundet ved dens `_id` eller ved andre felter |
| **Comment › Create** | kommenterer en række; en @omtale giver personen besked |

**Databasen** og **tabellen** vælges i lister, dem tokenet åbner. De felter, der skal skrives,
vises med deres navn i basedb, et Enkeltvalg med sine muligheder, et Person-felt med
arbejdsområdets medlemmer; et beregnet felt — formel, opslag, aggregering, autonummer — findes
ikke der, siden basedb selv skriver det. En værdi, feltet afviser, stopper noden med basedbs
kode og hvad den betyder.

- **Filteret** og **sorteringen** bruger felternes tekniske navne, dem fra SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Grammatikken er den samme som i
  [REST-API'et](/basedb/da/integrations/api-rest/#læs).
- **Tal** ankommer som decimaltekst (`"1250.50"`), for ikke at tabe et ciffer; indstillingen
  **Numbers as Numbers** konverterer dem til tal.
- En **relation** læses som `{ "id": …, "display": … }` og skrives med den forbundne rækkes
  `_id`.
- **Create or Update** ændrer aldrig flere rækker: hvis flere bærer værdierne, stopper noden
  hellere end at gætte.
- Ingen **Delete**-handling: for at fjerne rækker kan du markere dem (en status »Arkiveret«),
  lade en [automatisering](/basedb/da/fonctionnalites/automatisations/) tage sig af sletningen,
  eller kalde [REST-API'et](/basedb/da/integrations/api-rest/) med et token oprettet til at
  slette.

## Start et workflow

### Ved hver aflæsning: basedb Trigger

Noden spørger basedb, i det valgte tempo (hvert minut, hver time…), om de rækker, der er
**oprettet** — eller **oprettet eller ændret** — siden sidste gang, med et ekstra filter, hvis
det er nødvendigt. Den virker overalt, selv når basedb ikke kan nå n8n. Ved sin første
aflæsning noterer den, hvor tabellen står, og udsender intet; et forsøg fra editoren giver den
seneste række, så der er noget at forbinde de følgende noder med.

### I samme øjeblik: basedb Webhook Trigger

Hver række, der oprettes, ændres eller slettes — selv ved SQL skrevet direkte i PostgreSQL —
starter workflowet med det samme:

1. Tilføj noden, og kopiér dens **Production URL**.
2. I basedb, menuen **⋯** af databasen → **API og agenter** → **Webhooks…**: opret en webhook
   til denne adresse, vælg dens tabeller og dens hændelser.
3. basedb viser én gang **signaturhemmeligheden**: læg den i et legitimationssæt
   **basedb Webhook** i n8n.
4. Aktivér workflowet.

Hver hændelse bliver et element: dens `type` (`record.created`, `record.updated`,
`record.deleted`), tabellen, rækken **før** og **efter**, og de ændrede felter (`changed`).
Noden kontrollerer **signaturen** for hver levering og svarer `401` til den, der ingen har, som
har en falsk, eller som er mere end fem minutter gammel. basedb leverer **mindst én gang**:
fjern dubletter ud fra hændelsens `id`, hvis workflowet ikke må behandle den to gange.

:::note
basedb sender kun en webhook til en **offentlig HTTPS**-adresse: en n8n på et privat netværk
bruger i stedet **basedb Trigger**. Se [Webhooks](/basedb/da/integrations/webhooks/).
:::

## Uden noden

n8ns node **HTTP Request** taler også med basedb: header `Authorization: Bearer <token>`,
JSON begge veje, paginering med `meta.next_cursor` givet videre som `after`
(`{{ $response.body.meta.next_cursor }}`), og genoptagelse efter et nedbrud ved et filter på
`_updated_at` og ved `…/<table>/deleted?since=`.

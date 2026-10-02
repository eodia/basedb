---
title: n8n
description: Les og skriv radene i basedb fra en n8n-arbeidsflyt, og start én for hver rad som opprettes, endres eller slettes.
---

Pakken **n8n-nodes-basedb** legger til tre noder i n8n:

| Node | Rolle |
|---|---|
| **basedb** | lese og skrive radene i en tabell, kommentere en rad; kan brukes som verktøy av en KI-agent i n8n |
| **basedb Trigger** | starte en arbeidsflyt for hver rad som er opprettet — eller opprettet eller endret — siden forrige avlesning |
| **basedb Webhook Trigger** | starte en arbeidsflyt i det øyeblikket en rad opprettes, endres eller slettes |

## Installer

I n8n: **Settings › Community Nodes › Install**, deretter `n8n-nodes-basedb`.

Uten grensesnittet — kømodus, et Docker-image bygget på forhånd — : `npm install
n8n-nodes-basedb` i mappen `~/.n8n/nodes`, og start n8n på nytt.

## Identifikasjonen

Opprett en identifikasjon **basedb API** i n8n:

| Felt | Verdi |
|---|---|
| **Instance URL** | adressen der du åpner basedb: `https://basedb.exemple.fr` |
| **Workspace** | arbeidsområdets referanse, den i API-ets adresser (`/api/v1/<espace>/…`): `t4z56fq`, med mindre instansen setter `BASEDB_TENANT` |
| **Token** | et **integrasjonstoken**: menyen **⋯** på basen → **API og agenter** → **API- og MCP-tokener…** |

Et token åpner **én** base. Det leser radene, skriver dem hvis det ble opprettet med
skriverettighet, og har aldri flere tillatelser enn personen som opprettet det. Ved lagring
prøver n8n forbindelsen og sier om tokenet blir avvist.

## Lese og skrive: basedb-noden

| Operasjon | Hva den gjør |
|---|---|
| **Row › Create** | legger til en rad |
| **Row › Create or Update** | endrer raden der de valgte feltene har disse verdiene, eller legger den til hvis ingen har dem |
| **Row › Get** | leser en rad ved sin `_id` |
| **Row › Get Many** | leser radene i et filter, i ønsket rekkefølge, opptil en grense eller alle, side for side |
| **Row › Update** | endrer en rad, funnet ved sin `_id` eller ved andre felt |
| **Comment › Create** | kommenterer en rad; en @omtale varsler personen |

**Basen** og **tabellen** velges fra lister, dem tokenet åpner. Feltene som skal skrives,
vises med navnet sitt i basedb, en valgliste med sine alternativer, et Person-felt med
medlemmene av arbeidsområdet; et beregnet felt — formel, oppslag, aggregering, autonummer —
er ikke der, siden basedb skriver det selv. En verdi feltet avviser, stopper noden med
basedbs kode og hva den betyr.

- **Filteret** og **sorteringen** bruker feltenes tekniske navn, dem i SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Grammatikken er den i
  [REST-API-et](/basedb/nb/integrations/api-rest/#lese).
- **Tallene** kommer som desimaltekst (`"1250.50"`), for ikke å tape et siffer;
  innstillingen **Numbers as Numbers** gjør dem om til tall.
- En **relasjon** leses `{ "id": …, "display": … }` og skrives med `_id`-en til den koblede raden.
- **Create or Update** endrer aldri flere rader: hvis flere har verdiene, stopper noden
  i stedet for å gjette.
- Ingen operasjon **Delete**: for å fjerne rader, merk dem (en status «Arkivert»), la en
  [automatisering](/basedb/nb/fonctionnalites/automatisations/) stå for slettingen, eller kall
  [REST-API-et](/basedb/nb/integrations/api-rest/) med et token opprettet for å slette.

## Start en arbeidsflyt

### Ved hver avlesning: basedb Trigger

Noden spør basedb, i valgt takt (hvert minutt, hver time …), om radene som er
**opprettet** — eller **opprettet eller endret** — siden forrige gang, med et filter i tillegg
om nødvendig. Den virker overalt, selv når basedb ikke kan nå n8n. Ved sin første avlesning
noterer den hvor tabellen står, og sender ikke ut noe; en test fra editoren gir den siste raden,
til å koble sammen de neste nodene.

### I samme øyeblikk: basedb Webhook Trigger

Hver rad som opprettes, endres eller slettes — selv med SQL skrevet direkte i PostgreSQL —
starter arbeidsflyten med en gang:

1. Legg til noden og kopier dens **Production URL**.
2. I basedb, menyen **⋯** på basen → **API og agenter** → **Webhooks…**: opprett en webhook til
   denne adressen, og velg tabellene og hendelsene den skal gjelde.
3. basedb viser **signeringshemmeligheten** én gang: legg den i en identifikasjon
   **basedb Webhook** i n8n.
4. Aktiver arbeidsflyten.

Hver hendelse blir et element: sin `type` (`record.created`, `record.updated`,
`record.deleted`), tabellen, raden **før** og **etter**, og de endrede feltene (`changed`).
Noden kontrollerer **signaturen** til hver levering og svarer `401` til den som ikke har en, som
har en falsk, eller som er mer enn fem minutter gammel. basedb leverer **minst én gang**:
fjern duplikater med hendelsens `id` hvis arbeidsflyten ikke skal behandle den to ganger.

:::note
basedb sender webhook bare til en offentlig **HTTPS**-adresse: en n8n på et privat nettverk
bruker heller **basedb Trigger**. Se [Webhooks](/basedb/nb/integrations/webhooks/).
:::

## Uten noden

n8ns node **HTTP Request** snakker også med basedb: header `Authorization: Bearer <jeton>`,
JSON begge veier, paginering med `meta.next_cursor` sendt som `after`
(`{{ $response.body.meta.next_cursor }}`), og gjenopptaking etter et avbrudd med et filter på
`_updated_at` og med `…/<table>/deleted?since=`.

---
title: TypeScript-SDK
description: Les og skriv radene i basedb fra TypeScript, med typene til tabellene dine generert fra din instans.
---

Pakken **@basedb/sdk** kaller [REST-API-et](/basedb/nb/integrations/api-rest/) fra
TypeScript eller JavaScript: typede rader, alle sidene, filene, avvisningene med sin
kode. Ingen avhengigheter: standard `fetch`, fra Node 18 og oppover, Deno, Bun eller i en
nettleser.

```bash
npm install @basedb/sdk
```

## Typene til tabellene dine

En kommando leser beskrivelsen av basene dine og skriver typene deres til en fil i
programmet ditt:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

For hver base tokenet åpner — eller dem `--base` navngir, gjentatt —, og for hver tabell tre
former: raden slik basedb **leser** den, slik man **oppretter** den, slik man **endrer** den. En
valgliste blir unionen av verdiene sine; et felt basedb beregner — formel, oppslag,
aggregering, antall, autonummer — leses uten å kunne skrives; et obligatorisk felt uten
standardverdi kreves ved opprettelsen. Kjør kommandoen på nytt når tabellene endres.

## Lese og skrive

```ts
import { Basedb, BasedbError, filter } from '@basedb/sdk'
import type { Schema } from './basedb.js'

const db = new Basedb<Schema>({ url: 'https://basedb.exemple.fr', token: process.env.BASEDB_TOKEN! })
const opportunites = db.base('b_t4z56fq_ventes').table('opportunites')

const o = await opportunites.create({ titre: 'Audit', montant: 12500, statut: 'nouveau' })
await opportunites.update(o._id, { statut: 'gagne' })

for await (const ligne of opportunites.all({
  filter: filter`statut eq ${'gagne'} and montant gte ${10000}`,
  sort: '-montant',
})) {
  console.log(ligne.titre, ligne.montant)
}
```

En tabell, et felt eller et valg som ikke finnes, er en **typefeil**, allerede før
programmet kjører.

| Metode | Rolle |
|---|---|
| `list(options)` | én side, og `next` for den neste |
| `all(options)` | alle radene i et filter, side for side, mens de leses |
| `first(options)`, `count(filtre)` | den første raden, antall rader |
| `get(id)` | én rad |
| `create(valeurs)`, `createMany(lignes)` | legge til en rad; flere, alle eller ingen |
| `update(id, valeurs)` | endre felt; et felt som ikke er med, forblir som det er, `null` tømmer det |
| `aggregate({ aggregates, filter, group })` | summer, gjennomsnitt, antall over alle radene i et filter |
| `comments(id).list()`, `.add(texte)` | kommentarene til en rad; en @omtale varsler |
| `upload(champ, octets, { name, type })` | laste opp en fil, som raden deretter refererer til med sin `id` |
| `db.undo(ligne)` | angre skrivingen som ga denne raden — avvist hvis den er endret siden |

- **`filter`** skriver hver innsatt verdi som en verdi: en tekst en bruker har skrevet inn,
  forblir en tekst, aldri en del av filteret.
- **Tallene** leses som desimaltekst (`"12500.0000000000"`), for ikke å tape et siffer;
  de skrives som tall eller som tekst.
- En **relasjon** leses `{ id, display }` og skrives med `_id`-en til den koblede raden;
  `links: 'id'` leser bare `_id`-en.
- En **avvisning** er en `BasedbError`: sin `code` — stabil, én per årsak, den samme på alle
  språk —, `status`, `details` og `requestId`. En forespørsel om å sende saktere (`429`)
  prøves på nytt etter tiden basedb angir.

## Miljøene

En database som har flere [miljøer](/basedb/nb/fonctionnalites/environnements/) – produksjon,
test … – beholder navnene og typene sine fra ett miljø til et annet. Med et token opprettet for
hele databasen retter `environment()` seg mot et miljø, mens den samme koden kjøres et annet
sted:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

Alternativet `environment` i konstruktøren gjør det samme for hele klienten. SDK-et sender
headeren `X-Basedb-Environment`; uten den peker hvert databasenavn på sitt eget miljø
(`b_t4z56fq_ventes` er produksjon).

## Tokenet

Et **integrasjonstoken** opprettes i grensesnittet: menyen **⋯** på basen → **API og agenter**
→ **API- og MCP-tokener…**. Det åpner én base – alle miljøene dens, eller bare ett –, leser
radene, skriver dem hvis det ble opprettet med skriverettighet, har aldri flere tillatelser enn
personen som opprettet det, og **sletter bare hvis det ble opprettet for det** («Lesing,
skriving og sletting»): ellers blir `delete()` avvist.

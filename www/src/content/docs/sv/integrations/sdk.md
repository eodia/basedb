---
title: TypeScript-SDK
description: Läsa och skriva basedbs rader från TypeScript, med typer för dina tabeller genererade från din instans.
---

Paketet **@basedb/sdk** anropar [REST-API:et](/basedb/sv/integrations/api-rest/) från
TypeScript eller JavaScript: typade rader, alla sidor, filerna, avslagen med sin kod. Inga
beroenden: standard-`fetch`, från Node 18 och senare, Deno, Bun eller i en webbläsare.

```bash
npm install @basedb/sdk
```

## Typerna för dina tabeller

Ett kommando läser beskrivningen av dina databaser och skriver deras typer till en fil i ditt
program:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Varje databas som token öppnar – eller de som anges med `--base`, upprepat –, och för varje
tabell tre former: raden som basedb **läser** den, som man **skapar** den, som man **ändrar**
den. Ett enkelval blir unionen av sina värden; ett fält som basedb beräknar – formel, uppslag,
aggregering, antal, autonummer – kan läsas men inte skrivas; ett obligatoriskt fält utan
standardvärde krävs vid skapandet. Kör kommandot igen när tabellerna ändras.

## Läsa och skriva

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

En tabell, ett fält eller ett val som inte finns är ett **typfel**, redan innan programmet
körs.

| Metod | Roll |
|---|---|
| `list(options)` | en sida, och `next` för nästa |
| `all(options)` | alla rader i ett filter, sida efter sida, i takt med att de läses |
| `first(options)`, `count(filtre)` | den första raden, antalet rader |
| `get(id)` | en rad |
| `create(valeurs)`, `createMany(lignes)` | lägga till en rad; flera, alla eller ingen |
| `update(id, valeurs)` | ändra fält; ett fält som saknas förblir som det är, `null` tömmer det |
| `aggregate({ aggregates, filter, group })` | summor, medelvärden, antal över alla rader i ett filter |
| `comments(id).list()`, `.add(texte)` | kommentarerna på en rad; en @omnämning aviserar |
| `upload(champ, octets, { name, type })` | ladda upp en fil, som raden sedan citerar via sitt `id` |
| `db.undo(ligne)` | ångra skrivningen som gav den här raden – avvisas om den har ändrats sedan |

- **`filter`** skriver varje infogat värde som ett värde: en text som en användare skrivit in
  förblir en text, aldrig en bit av filtret.
- **Talen** läses som decimaltext (`"12500.0000000000"`), för att inte tappa någon siffra; de
  skrivs som tal eller som text.
- En **relation** läses som `{ id, display }` och skrivs med den länkade radens `_id`;
  `links: 'id'` läser bara `_id`.
- Ett **avslag** är ett `BasedbError`: dess `code` – stabil, en per orsak, densamma på alla
  språk –, `status`, `details` och `requestId`. En begäran om att sakta ner (`429`) körs om
  efter den fördröjning som basedb anger.

## Token

En **integrationstoken** skapas i gränssnittet: databasens **⋯**-meny → **API och agenter** →
**API- och MCP-tokens…**. Den öppnar en databas, läser dess rader, skriver dem om den skapades
med skrivrätt, har aldrig fler behörigheter än personen som skapade den, och **tar bara bort om
den har skapats för det** (”Läsa, skriva och ta bort”): annars avvisas `delete()`.

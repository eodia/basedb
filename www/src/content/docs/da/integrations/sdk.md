---
title: TypeScript SDK
description: Læs og skriv basedbs rækker fra TypeScript, med typerne for dine tabeller genereret fra din instans.
---

Pakken **@basedb/sdk** kalder [REST-API'et](/basedb/da/integrations/api-rest/) fra TypeScript
eller JavaScript: typede rækker, alle siderne, filerne, afvisningerne med deres kode. Ingen
afhængighed: standard `fetch`, under Node 18 og senere, Deno, Bun eller i en browser.

```bash
npm install @basedb/sdk
```

## Typerne for dine tabeller

En kommando læser beskrivelsen af dine databaser og skriver deres typer i en fil i dit program:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Hver database, tokenet åbner — eller dem, der er navngivet med `--base`, gentaget —, og for
hver tabel tre former: rækken sådan som basedb **læser** den, sådan som man **opretter** den,
sådan som man **ændrer** den. Et enkeltvalg bliver foreningen af dets værdier; et felt, basedb
beregner — formel, opslag, aggregering, antal, autonummer — læses uden at kunne skrives; et
påkrævet felt uden en standardværdi kræves ved oprettelsen. Kør kommandoen igen, når tabellerne
ændres.

## Læs og skriv

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

En tabel, et felt eller et valg, der ikke findes, er en **typefejl**, allerede før programmet
kører.

| Metode | Rolle |
|---|---|
| `list(options)` | én side, og `next` for den næste |
| `all(options)` | alle rækker fra et filter, side for side, i takt med at de læses |
| `first(options)`, `count(filtre)` | den første række, antallet af rækker |
| `get(id)` | en række |
| `create(valeurs)`, `createMany(lignes)` | tilføje en række; flere, alle eller ingen |
| `update(id, valeurs)` | ændre felter; et felt, der ikke er med, forbliver som det er, `null` tømmer det |
| `aggregate({ aggregates, filter, group })` | summer, gennemsnit, antal på tværs af alle rækker i et filter |
| `comments(id).list()`, `.add(texte)` | en rækkes kommentarer; en @omtale giver besked |
| `upload(champ, octets, { name, type })` | lægge en fil op, som rækken derefter citerer ved sin `id` |
| `db.undo(ligne)` | fortryde den skrivning, der gav denne række — afvist, hvis den er ændret siden |

- **`filter`** skriver hver indsat værdi som en værdi: en tekst, en bruger har indtastet,
  forbliver en tekst, aldrig et stykke af filteret.
- **Tal** læses i decimaltekst (`"12500.0000000000"`), for ikke at tabe et ciffer; de skrives
  som tal eller som tekst.
- En **relation** læses som `{ id, display }` og skrives med den forbundne rækkes `_id`;
  `links: 'id'` læser kun `_id`.
- En **afvisning** er en `BasedbError`: dens `code` — stabil, én pr. årsag, den samme på alle
  sprog —, `status`, `details` og `requestId`. En anmodning om at sætte farten ned (`429`)
  gentages efter den ventetid, basedb angiver.

## Tokenet

Et **integrationstoken** oprettes i brugerfladen: menuen **⋯** af databasen → **API og
agenter** → **API- og MCP-tokens…**. Det åbner en database, læser dens rækker, skriver dem,
hvis det er oprettet med skriveadgang, har aldrig flere tilladelser end den person, der
oprettede det, og **sletter kun, hvis det er oprettet til det** (»Læse, skrive og slette«):
ellers afvises `delete()`.

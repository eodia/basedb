---
title: SDK TypeScript
description: Citiți și scrieți rândurile basedb din TypeScript, cu tipurile tabelelor dumneavoastră generate din instanța dumneavoastră.
---

Pachetul **@basedb/sdk** apelează [API-ul REST](/basedb/ro/integrations/api-rest/) din
TypeScript sau JavaScript: rândurile tipizate, toate paginile, fișierele, refuzurile cu codul
lor. Fără nicio dependență: `fetch`-ul standard, sub Node 18 și versiuni ulterioare, Deno, Bun
sau într-un browser.

```bash
npm install @basedb/sdk
```

## Tipurile tabelelor dumneavoastră

O comandă citește descrierea bazelor dumneavoastră și scrie tipurile lor într-un fișier al
programului dumneavoastră:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Fiecare bază pe care tokenul o deschide — sau cele numite prin `--base`, repetat —, iar pentru
fiecare tabel trei forme: rândul așa cum basedb îl **citește**, așa cum îl **creați**, așa cum
îl **modificați**. O selecție unică devine uniunea valorilor ei; un câmp pe care basedb îl
calculează — formulă, căutare, agregare, numărare, număr automat — se citește fără a se scrie;
un câmp obligatoriu fără valoare implicită este cerut la creare. Relansați comanda când
tabelele se schimbă.

## Citire și scriere

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

Un tabel, un câmp sau o opțiune care nu există este o **eroare de tip**, chiar înainte ca
programul să ruleze.

| Metodă | Rol |
|---|---|
| `list(options)` | o pagină, și `next` pentru următoarea |
| `all(options)` | toate rândurile unui filtru, pagină după pagină, pe măsură ce sunt citite |
| `first(options)`, `count(filtre)` | primul rând, numărul de rânduri |
| `get(id)` | un rând |
| `create(valeurs)`, `createMany(lignes)` | adăugarea unui rând; a mai multora, a tuturor sau a niciunuia |
| `update(id, valeurs)` | modificarea unor câmpuri; un câmp absent rămâne neschimbat, `null` îl golește |
| `aggregate({ aggregates, filter, group })` | sume, medii, numărări pe toate rândurile unui filtru |
| `comments(id).list()`, `.add(texte)` | comentariile unui rând; o @mențiune anunță |
| `upload(champ, octets, { name, type })` | depunerea unui fișier, pe care rândul îl citează apoi prin `id`-ul său |
| `db.undo(ligne)` | anularea scrierii care a produs acest rând — refuzată dacă s-a schimbat de atunci |

- **`filter`** scrie fiecare valoare inserată ca o valoare: un text introdus de un utilizator
  rămâne un text, niciodată o parte a filtrului.
- **Numerele** se citesc ca text decimal (`"12500.0000000000"`), pentru a nu pierde nicio
  cifră; se scriu ca număr sau ca text.
- O **relație** se citește `{ id, display }` și se scrie prin `_id`-ul rândului legat;
  `links: 'id'` citește doar `_id`-ul.
- Un **refuz** este o `BasedbError`: `code`-ul ei — stabil, unul pentru fiecare cauză, același
  în toate limbile —, `status`, `details` și `requestId`. O cerere de încetinire (`429`) este
  reîncercată după intervalul indicat de basedb.

## Tokenul

Un **token de integrare** se creează din interfață: meniul **⋯** al bazei → **API și agenți**
→ **Tokenuri API și MCP…**. Deschide o bază, citește rândurile ei, le scrie dacă a fost creat
cu drept de scriere, nu are niciodată mai multe permisiuni decât persoana care l-a creat, și
**nu șterge niciodată**: `delete()` cere permisiunile unei sesiuni.

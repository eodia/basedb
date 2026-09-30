---
title: TypeScript SDK
description: A basedb sorainak olvasása és írása TypeScriptből, a táblái típusaival, amelyeket a példányából generál.
---

A **@basedb/sdk** csomag TypeScriptből vagy JavaScriptből hívja meg az
[API RESTet](/basedb/hu/integrations/api-rest/): típusos sorok, minden oldal, fájlok,
elutasítások a kódjukkal. Semmilyen függőség: a szabványos `fetch`, Node 18 és újabb, Deno,
Bun vagy egy böngésző alatt.

```bash
npm install @basedb/sdk
```

## A táblái típusai

Egy parancs beolvassa az adatbázisai leírását, és beírja a típusaikat a programja egy
fájljába:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Minden adatbázis, amelyet a token megnyit – vagy azok, amelyeket a `--base` nevez meg, akár
többször is –, és minden táblához három forma: a sor, ahogyan a basedb **olvassa**, ahogyan
**létrehozzák**, ahogyan **módosítják**. Egy egyszeres választás az értékei uniójává válik;
egy mező, amelyet a basedb számít – képlet, kikeresés, aggregálás, darabszám, automatikus
szám – csak olvasható, nem írható; egy alapértelmezett érték nélküli kötelező mező
létrehozáskor megkövetelt. Indítsa újra a parancsot, amikor a táblák megváltoznak.

## Olvasás és írás

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

Egy nem létező tábla, mező vagy választás **típushiba**, még mielőtt a program elindulna.

| Metódus | Szerep |
|---|---|
| `list(options)` | egy oldal, és a `next` a következőhöz |
| `all(options)` | egy szűrő összes sora, oldalanként, amint olvassák őket |
| `first(options)`, `count(filtre)` | az első sor, a sorok száma |
| `get(id)` | egy sor |
| `create(valeurs)`, `createMany(lignes)` | sor hozzáadása; több sor, mind vagy semelyik |
| `update(id, valeurs)` | mezők módosítása; egy hiányzó mező változatlan marad, a `null` kiüríti |
| `aggregate({ aggregates, filter, group })` | összegek, átlagok, darabszámok egy szűrő összes során |
| `comments(id).list()`, `.add(texte)` | egy sor megjegyzései; egy @mention értesít |
| `upload(champ, octets, { name, type })` | fájl letétele, amelyre a sor ezután az `id`-jével hivatkozik |
| `db.undo(ligne)` | annak az írásnak a visszavonása, amely ezt a sort létrehozta – elutasítva, ha azóta megváltozott |

- A **`filter`** minden beillesztett értéket értékként ír be: egy felhasználó által beírt
  szöveg szöveg marad, sosem a szűrő egy darabja.
- A **számok** tizedes szövegként olvashatók (`"12500.0000000000"`), hogy semelyik számjegy se
  vesszen el; számként vagy szövegként írhatók.
- Egy **kapcsolat** `{ id, display }` alakban olvasható, és a kapcsolt sor `_id`-jével írható;
  a `links: 'id'` csak az `_id`-t olvassa.
- Egy **elutasítás** egy `BasedbError`: a `code`-ja – stabil, egy okonként, minden nyelven
  ugyanaz –, `status`, `details` és `requestId`. Egy lassításra kérő válasz (`429`) a basedb
  által jelzett várakozás után újrapróbálkozik.

## A token

Egy **integrációs token** a felületen jön létre: az adatbázis **⋯** menüje → **API és
ügynökök** → **API- és MCP-tokenek…**. Egy adatbázist nyit meg, olvassa a sorait, írja is, ha
íráshoz jött létre, sosincs több joga, mint annak a személynek, aki létrehozta, és **soha nem
töröl**: a `delete()` egy munkamenet jogait igényli.

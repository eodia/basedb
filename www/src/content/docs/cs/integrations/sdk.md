---
title: SDK TypeScript
description: Číst a zapisovat řádky basedb z TypeScriptu, s typy vašich tabulek vygenerovanými z vaší instance.
---

Balíček **@basedb/sdk** volá [REST API](/basedb/cs/integrations/api-rest/) z TypeScriptu nebo
JavaScriptu: typované řádky, všechny stránky, soubory, odmítnutí s jejich kódem. Žádná
závislost: standardní `fetch`, pod Node 18 a novějším, Deno, Bun nebo v prohlížeči.

```bash
npm install @basedb/sdk
```

## Typy vašich tabulek

Příkaz přečte popis vašich databází a zapíše jejich typy do souboru vašeho programu:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Pro každou databázi, kterou token otevírá — nebo ty, které jmenuje opakované `--base` —,
a pro každou tabulku tři podoby: řádek tak, jak ho basedb **čte**, tak, jak se **vytváří**,
tak, jak se **upravuje**. Jednoduchý výběr se stane sjednocením svých hodnot; pole, které
basedb počítá — vzorec, vyhledávání, agregace, počet, automatické číslo — se čte, ale
nezapisuje; povinné pole bez výchozí hodnoty je při vytvoření vyžadováno. Příkaz spusťte
znovu, když se tabulky změní.

## Čtení a zápis

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

Tabulka, pole nebo volba, které neexistují, jsou **typovou chybou** ještě dřív, než program
běží.

| Metoda | Role |
|---|---|
| `list(options)` | jedna stránka a `next` pro následující |
| `all(options)` | všechny řádky filtru, stránku po stránce, jak se čtou |
| `first(options)`, `count(filtre)` | první řádek, počet řádků |
| `get(id)` | jeden řádek |
| `create(valeurs)`, `createMany(lignes)` | přidat řádek; více, všechny nebo žádný |
| `update(id, valeurs)` | upravit pole; chybějící pole zůstane beze změny, `null` ho vyprázdní |
| `aggregate({ aggregates, filter, group })` | součty, průměry, počty přes všechny řádky filtru |
| `comments(id).list()`, `.add(texte)` | komentáře řádku; @zmínka upozorní |
| `upload(champ, octets, { name, type })` | vložit soubor, na který řádek pak odkáže svým `id` |
| `db.undo(ligne)` | zrušit zápis, který tento řádek vytvořil — odmítnuto, pokud se od té doby změnil |

- **`filter`** zapisuje každou vloženou hodnotu jako hodnotu: text zadaný uživatelem zůstává
  textem, nikdy součástí filtru.
- **Čísla** se čtou jako desetinný text (`"12500.0000000000"`), aby se neztratila žádná
  číslice; zapisují se jako číslo nebo jako text.
- **Vazba** se čte jako `{ id, display }` a zapisuje se pomocí `_id` propojeného řádku;
  `links: 'id'` čte jen `_id`.
- **Odmítnutí** je `BasedbError`: jeho `code` — stálý, jeden pro každou příčinu, stejný ve
  všech jazycích —, `status`, `details` a `requestId`. Žádost o zpomalení (`429`) se zopakuje
  po době, kterou basedb udá.

## Token

**Integrační token** se vytváří v rozhraní: nabídka **⋯** databáze → **API a agenti** →
**Tokeny API a MCP…**. Otevírá jednu databázi, čte její řádky, zapisuje je, pokud byl
vytvořen pro zápis, nikdy nemá víc oprávnění než osoba, která ho vytvořila, a **odstraňuje jen
tehdy, pokud byl vytvořen i k tomu** („Čtení, zápis a odstranění“): jinak je `delete()` odmítnuto.

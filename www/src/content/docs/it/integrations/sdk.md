---
title: SDK TypeScript
description: Leggere e scrivere le righe di basedb da TypeScript, con i tipi delle tue tabelle generati dalla tua istanza.
---

Il pacchetto **@basedb/sdk** chiama l’[API REST](/basedb/it/integrations/api-rest/) da
TypeScript o JavaScript: le righe tipizzate, tutte le pagine, i file, i rifiuti con il loro
codice. Nessuna dipendenza: il `fetch` standard, su Node 18 e successivi, Deno, Bun o in un
browser.

```bash
npm install @basedb/sdk
```

## I tipi delle tue tabelle

Un comando legge la descrizione dei tuoi database e scrive i loro tipi in un file del tuo
programma:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Ogni database che il token apre — o quelli indicati da `--base`, ripetuto —, e per ogni tabella
tre forme: la riga come basedb la **legge**, come si **crea**, come si **modifica**. Una
selezione singola diventa l’unione dei suoi valori; un campo che basedb calcola — formula,
ricerca, aggregazione, conteggio, numerazione automatica — si legge senza scriversi; un campo
obbligatorio senza valore predefinito è richiesto alla creazione. Rilancia il comando quando le
tabelle cambiano.

## Leggere e scrivere

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

Una tabella, un campo o una scelta che non esiste è un **errore di tipo**, prima ancora che il
programma venga eseguito.

| Metodo | Ruolo |
|---|---|
| `list(options)` | una pagina, e `next` per la successiva |
| `all(options)` | tutte le righe di un filtro, pagina dopo pagina, man mano che si leggono |
| `first(options)`, `count(filtre)` | la prima riga, il numero di righe |
| `get(id)` | una riga |
| `create(valeurs)`, `createMany(lignes)` | aggiungere una riga; più righe, tutte o nessuna |
| `update(id, valeurs)` | modificare dei campi; un campo assente resta com’è, `null` lo svuota |
| `aggregate({ aggregates, filter, group })` | somme, medie, conteggi su tutte le righe di un filtro |
| `comments(id).list()`, `.add(texte)` | i commenti di una riga; una @mention avvisa |
| `upload(champ, octets, { name, type })` | caricare un file, che la riga cita poi tramite il suo `id` |
| `db.undo(ligne)` | annullare la scrittura che ha prodotto questa riga — rifiutato se è cambiata da allora |

- **`filter`** scrive ogni valore inserito come un valore: un testo digitato da un utente resta
  un testo, mai un pezzo del filtro.
- I **numeri** si leggono in testo decimale (`"12500.0000000000"`), per non perdere alcuna
  cifra; si scrivono come numero o come testo.
- Una **relazione** si legge `{ id, display }` e si scrive tramite l’`_id` della riga collegata;
  `links: 'id'` legge solo l’`_id`.
- Un **rifiuto** è un `BasedbError`: il suo `code` — stabile, uno per causa, lo stesso in tutte
  le lingue —, `status`, `details` e `requestId`. Una richiesta di rallentare (`429`) viene
  ritentata dopo il ritardo indicato da basedb.

## Il token

Un **token di integrazione** si crea nell’interfaccia: menu **⋯** del database → **API e
agenti** → **Token API e MCP…**. Apre un database, legge le sue righe, le scrive se è stato
creato in scrittura, non ha mai più permessi della persona che l’ha creato, e **non elimina
mai**: `delete()` richiede i permessi di una sessione.

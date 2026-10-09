---
title: SDK TypeScript
description: Odczytuj i zapisuj wiersze basedb z TypeScript, z typami twoich tabel generowanymi z twojej instancji.
---

Pakiet **@basedb/sdk** wywołuje [API REST](/basedb/pl/integrations/api-rest/) z TypeScript albo
JavaScript: typowane wiersze, wszystkie strony, pliki, odrzucenia z ich kodem. Bez żadnej
zależności: standardowy `fetch`, pod Node 18 i nowszym, Deno, Bun albo w przeglądarce.

```bash
npm install @basedb/sdk
```

## Typy twoich tabel

Jedna komenda odczytuje opis twoich baz i zapisuje ich typy w pliku twojego programu:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Każda baza, którą otwiera token — albo te nazwane przez `--base`, powtórzone —, a dla każdej
tabeli trzy formy: wiersz taki, jak basedb go **odczytuje**, taki, jak go się **tworzy**, taki,
jak go się **zmienia**. Pojedynczy wybór staje się unią jego wartości; pole, które basedb
oblicza — formuła, odnośnik, agregacja, zliczanie, autonumer — odczytuje się bez możliwości
zapisu; pole obowiązkowe bez wartości domyślnej jest wymagane przy tworzeniu. Uruchom komendę
ponownie, gdy tabele się zmienią.

## Odczyt i zapis

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

Tabela, pole albo wybór, który nie istnieje, to **błąd typu**, jeszcze zanim program się
uruchomi.

| Metoda | Rola |
|---|---|
| `list(options)` | jedna strona, a `next` dla następnej |
| `all(options)` | wszystkie wiersze filtra, strona po stronie, w miarę ich odczytu |
| `first(options)`, `count(filtre)` | pierwszy wiersz, liczba wierszy |
| `get(id)` | jeden wiersz |
| `create(valeurs)`, `createMany(lignes)` | dodać wiersz; kilka, wszystkie albo żaden |
| `update(id, valeurs)` | zmienić pola; pole nieobecne pozostaje bez zmian, `null` je czyści |
| `aggregate({ aggregates, filter, group })` | sumy, średnie, zliczenia na wszystkich wierszach filtra |
| `comments(id).list()`, `.add(texte)` | komentarze wiersza; @wzmianka powiadamia |
| `upload(champ, octets, { name, type })` | wysłać plik, który wiersz potem przytacza przez jego `id` |
| `db.undo(ligne)` | anulować zapis, który utworzył ten wiersz — odrzucone, jeśli zmienił się od tego czasu |

- **`filter`** zapisuje każdą wstawioną wartość jako wartość: tekst wpisany przez użytkownika
  pozostaje tekstem, nigdy fragmentem filtra.
- **Liczby** odczytuje się jako tekst dziesiętny (`"12500.0000000000"`), żeby nie zgubić żadnej
  cyfry; zapisuje się je jako liczbę albo tekst.
- **Relacja** odczytuje się jako `{ id, display }`, a zapisuje przez `_id` powiązanego wiersza;
  `links: 'id'` odczytuje tylko `_id`.
- **Odrzucenie** to `BasedbError`: jego `code` — stabilny, jeden na przyczynę, taki sam we
  wszystkich językach —, `status`, `details` i `requestId`. Żądanie zwolnienia tempa (`429`)
  jest powtarzane po czasie, który wskaże basedb.

## Środowiska

Baza, która ma kilka [środowisk](/basedb/pl/fonctionnalites/environnements/) – produkcyjne,
testowe… – zachowuje swoje nazwy i typy w każdym środowisku. Z tokenem utworzonym dla całej bazy
`environment()` wskazuje środowisko, dzięki czemu ten sam kod może działać gdzie indziej:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

Opcja `environment` konstruktora robi to samo dla całego klienta. SDK wysyła nagłówek
`X-Basedb-Environment`; bez niego każda nazwa bazy wskazuje jej własne środowisko
(`b_t4z56fq_ventes` to środowisko produkcyjne).

## Token

**Token integracji** tworzy się w interfejsie: menu **⋯** bazy → **API i agenci**
→ **Tokeny API i MCP…**. Otwiera on jedną bazę – wszystkie jej środowiska albo tylko jedno –,
odczytuje jej wiersze, zapisuje je, jeśli został utworzony z prawem zapisu, nigdy nie ma
większych uprawnień niż osoba, która go
utworzyła, i **usuwa tylko wtedy, gdy został do tego utworzony** („Odczyt, zapis i usuwanie”):
w przeciwnym razie `delete()` jest odrzucane.

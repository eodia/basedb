---
title: TypeScript-SDK
description: Die Zeilen von basedb aus TypeScript lesen und schreiben, mit den aus Ihrer Instanz generierten Typen Ihrer Tabellen.
---

Das Paket **@basedb/sdk** ruft die [REST-API](/basedb/de/integrations/api-rest/) aus TypeScript
oder JavaScript auf: typisierte Zeilen, alle Seiten, Dateien, Ablehnungen mit ihrem Code. Keine
Abhängigkeit: das Standard-`fetch`, ab Node 18, Deno, Bun oder im Browser.

```bash
npm install @basedb/sdk
```

## Die Typen Ihrer Tabellen

Ein Befehl liest die Beschreibung Ihrer Datenbanken und schreibt ihre Typen in eine Datei Ihres
Programms:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Für jede Datenbank, die das Token öffnet — oder die mit `--base` genannten, wiederholbar —, und
für jede Tabelle drei Formen: die Zeile, wie basedb sie **liest**, wie man sie **anlegt**, wie
man sie **ändert**. Eine Einfachauswahl wird zur Union ihrer Werte; ein von basedb berechnetes
Feld — Formel, Nachschlagefeld, Aggregation, Anzahl, Autonummer — lässt sich lesen, aber nicht
schreiben; ein erforderliches Feld ohne Standardwert wird beim Anlegen verlangt. Führen Sie den
Befehl erneut aus, wenn sich die Tabellen ändern.

## Lesen und schreiben

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

Eine Tabelle, ein Feld oder eine Auswahl, die nicht existiert, ist ein **Typfehler** — noch
bevor das Programm läuft.

| Methode | Rolle |
|---|---|
| `list(options)` | eine Seite, und `next` für die nächste |
| `all(options)` | alle Zeilen eines Filters, Seite für Seite, während man sie liest |
| `first(options)`, `count(filtre)` | die erste Zeile, die Anzahl der Zeilen |
| `get(id)` | eine Zeile |
| `create(valeurs)`, `createMany(lignes)` | eine Zeile anlegen; mehrere, alle oder keine |
| `update(id, valeurs)` | Felder ändern; ein fehlendes Feld bleibt unverändert, `null` leert es |
| `aggregate({ aggregates, filter, group })` | Summen, Durchschnitte, Anzahlen über alle Zeilen eines Filters |
| `comments(id).list()`, `.add(texte)` | die Kommentare einer Zeile; eine @-Erwähnung benachrichtigt |
| `upload(champ, octets, { name, type })` | eine Datei ablegen, die die Zeile anschließend über ihre `id` zitiert |
| `db.undo(ligne)` | den Schreibvorgang rückgängig machen, der diese Zeile hervorgebracht hat — abgelehnt, wenn sie sich seither geändert hat |

- **`filter`** schreibt jeden eingefügten Wert als Wert: ein von einer Person eingegebener Text
  bleibt ein Text, nie ein Stück des Filters.
- **Zahlen** werden als Dezimaltext gelesen (`"12500.0000000000"`), um keine Ziffer zu
  verlieren; sie werden als Zahl oder als Text geschrieben.
- Eine **Verknüpfung** wird als `{ id, display }` gelesen und über die `_id` der verknüpften
  Zeile geschrieben; `links: 'id'` liest nur die `_id`.
- Eine **Ablehnung** ist ein `BasedbError`: sein `code` — stabil, einer pro Ursache, derselbe in
  allen Sprachen —, `status`, `details` und `requestId`. Eine Bitte, langsamer zu senden
  (`429`), wird nach der von basedb angegebenen Frist erneut versucht.

## Die Umgebungen

Eine Datenbank mit mehreren [Umgebungen](/basedb/de/fonctionnalites/environnements/) – Produktion,
Staging … – behält ihre Namen und ihre Typen von einer Umgebung zur anderen. Mit einem Token, das für
die ganze Datenbank angelegt wurde, zielt `environment()` auf eine Umgebung, wobei derselbe Code
anderswo läuft:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

Die Option `environment` des Konstruktors tut dasselbe für den ganzen Client. Das SDK sendet den
Header `X-Basedb-Environment`; ohne ihn bezeichnet jeder Datenbankname seine eigene Umgebung
(`b_t4z56fq_ventes` ist die Produktion).

## Das Token

Ein **Integrationstoken** wird in der Oberfläche angelegt: Menü **⋯** der Datenbank →
**API und Agenten** → **API- und MCP-Token …**. Es öffnet eine Datenbank — alle ihre Umgebungen oder
nur eine —, liest ihre Zeilen, schreibt sie, wenn es mit Schreibrecht angelegt wurde, hat nie mehr
Berechtigungen als die Person, die es angelegt hat, und **löscht nur, wenn es dafür angelegt wurde**
(„Lesen, Schreiben und Löschen“): Andernfalls wird `delete()` abgelehnt.

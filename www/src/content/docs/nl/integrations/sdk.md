---
title: TypeScript-SDK
description: De rijen van basedb lezen en schrijven vanuit TypeScript, met de types van je tabellen gegenereerd vanuit je instantie.
---

Het pakket **@basedb/sdk** roept de [REST-API](/basedb/nl/integrations/api-rest/) aan vanuit
TypeScript of JavaScript: getypeerde rijen, alle pagina's, bestanden, weigeringen met hun code.
Geen enkele afhankelijkheid: de standaard `fetch`, onder Node 18 en later, Deno, Bun of in een
browser.

```bash
npm install @basedb/sdk
```

## De types van je tabellen

Een commando leest de beschrijving van je databases en schrijft hun types naar een bestand van
je programma:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Elke database die het token opent — of die welke `--base` aanwijst, herhaald —, en voor elke
tabel drie vormen: de rij zoals basedb ze **leest**, zoals je ze **aanmaakt**, zoals je ze
**wijzigt**. Een enkele keuze wordt de unie van haar waarden; een veld dat basedb berekent —
formule, opzoekveld, aggregatie, aantal, automatisch nummer — is te lezen zonder te schrijven;
een verplicht veld zonder standaardwaarde is vereist bij het aanmaken. Herhaal het commando
wanneer de tabellen veranderen.

## Lezen en schrijven

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

Een tabel, een veld of een keuze die niet bestaat, is een **typefout**, nog voordat het
programma draait.

| Methode | Rol |
|---|---|
| `list(options)` | één pagina, en `next` voor de volgende |
| `all(options)` | alle rijen van een filter, pagina na pagina, terwijl je ze leest |
| `first(options)`, `count(filtre)` | de eerste rij, het aantal rijen |
| `get(id)` | een rij |
| `create(valeurs)`, `createMany(lignes)` | een rij toevoegen; meerdere, allemaal of geen |
| `update(id, valeurs)` | velden wijzigen; een ontbrekend veld blijft ongewijzigd, `null` maakt het leeg |
| `aggregate({ aggregates, filter, group })` | sommen, gemiddelden, aantallen over alle rijen van een filter |
| `comments(id).list()`, `.add(texte)` | de opmerkingen van een rij; een @vermelding stuurt een melding |
| `upload(champ, octets, { name, type })` | een bestand opslaan, dat de rij daarna citeert via haar `id` |
| `db.undo(ligne)` | de schrijfactie ongedaan maken die deze rij heeft opgeleverd — geweigerd als ze sindsdien is gewijzigd |

- **`filter`** schrijft elke ingevoegde waarde als een waarde: een tekst die een gebruiker heeft
  ingevoerd, blijft een tekst, nooit een stukje van het filter.
- **Getallen** worden gelezen als decimale tekst (`"12500.0000000000"`), om geen enkel cijfer
  te verliezen; ze worden geschreven als getal of als tekst.
- Een **relatie** wordt gelezen als `{ id, display }` en geschreven via de `_id` van de
  gekoppelde rij; `links: 'id'` leest alleen de `_id`.
- Een **weigering** is een `BasedbError`: zijn `code` — stabiel, één per oorzaak, dezelfde in
  alle talen —, `status`, `details` en `requestId`. Een verzoek om te vertragen (`429`) wordt
  opnieuw geprobeerd na de vertraging die basedb aangeeft.

## De omgevingen

Een database met meerdere [omgevingen](/basedb/nl/fonctionnalites/environnements/) — productie,
acceptatie… — behoudt haar namen en haar types van de ene omgeving naar de andere. Met een token dat
voor de hele database is aangemaakt richt `environment()` zich op een omgeving, terwijl dezelfde code
elders draait:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

De optie `environment` van de constructor doet hetzelfde voor de hele client. De SDK stuurt de header
`X-Basedb-Environment` mee; zonder die header wijst elke databasenaam zijn eigen omgeving aan
(`b_t4z56fq_ventes` is productie).

## Het token

Een **integratietoken** maak je aan in de interface: menu **⋯** van de database → **API en
agents** → **API- en MCP-tokens…**. Het opent één database — alle omgevingen ervan, of slechts één —,
leest haar rijen, schrijft ze als het met schrijfrechten is aangemaakt, heeft nooit meer rechten dan
de persoon die het heeft aangemaakt, en **verwijdert alleen als het daarvoor is aangemaakt** (“Lezen,
schrijven en verwijderen”): anders wordt `delete()` geweigerd.

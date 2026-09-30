---
title: TypeScript-SDK
description: Lue ja kirjoita basedb:n rivejä TypeScriptistä, taulukoidesi tyypeillä, jotka on luotu instanssistasi.
---

Paketti **@basedb/sdk** kutsuu [REST API:a](/basedb/fi/integrations/api-rest/) TypeScriptistä
tai JavaScriptistä: tyypitetyt rivit, kaikki sivut, tiedostot, hylkäykset koodeineen. Ei
riippuvuuksia: vakiomuotoinen `fetch`, Node 18:sta ja sitä uudemmista, Deno, Bun tai selain.

```bash
npm install @basedb/sdk
```

## Taulukoidesi tyypit

Komento lukee tietokantojesi kuvauksen ja kirjoittaa niiden tyypit ohjelmasi tiedostoon:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Jokaisesta tietokannasta, jonka tunnus avaa – tai niistä, jotka `--base` nimeää, toistettuna –,
ja jokaisesta taulukosta kolme muotoa: rivi sellaisena kuin basedb sen **lukee**, sellaisena
kuin sen **luodaan**, sellaisena kuin sitä **muokataan**. Yksi valinta -kentästä tulee sen
arvojen unioni; kenttä, jonka basedb laskee – kaava, haku, kooste, määrä, automaattinen numero –
luetaan kirjoittamatta sitä; pakollinen kenttä, jolla ei ole oletusarvoa, vaaditaan luotaessa.
Suorita komento uudelleen, kun taulukot muuttuvat.

## Lukeminen ja kirjoittaminen

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

Taulukko, kenttä tai valinta, jota ei ole olemassa, on **tyyppivirhe**, jo ennen kuin ohjelma
käynnistyy.

| Metodi | Tehtävä |
|---|---|
| `list(options)` | yksi sivu, ja `next` seuraavaan |
| `all(options)` | suodattimen kaikki rivit, sivu kerrallaan, sitä mukaa kun niitä luetaan |
| `first(options)`, `count(filtre)` | ensimmäinen rivi, rivien määrä |
| `get(id)` | yksi rivi |
| `create(valeurs)`, `createMany(lignes)` | rivin lisääminen; useita, kaikki tai ei yhtään |
| `update(id, valeurs)` | kenttien muokkaaminen; puuttuva kenttä pysyy sellaisenaan, `null` tyhjentää sen |
| `aggregate({ aggregates, filter, group })` | summat, keskiarvot, määrät suodattimen kaikilta riveiltä |
| `comments(id).list()`, `.add(texte)` | rivin kommentit; @maininta ilmoittaa |
| `upload(champ, octets, { name, type })` | tiedoston tallentaminen, jonka rivi mainitsee sen jälkeen `id`:llään |
| `db.undo(ligne)` | tämän rivin tehneen kirjoituksen peruminen – hylätään, jos rivi on muuttunut sen jälkeen |

- **`filter`** kirjoittaa jokaisen liitetyn arvon arvona: käyttäjän kirjoittama teksti pysyy
  tekstinä, ei koskaan suodattimen palana.
- **Luvut** luetaan desimaalitekstinä (`"12500.0000000000"`), jotta yksikään numero ei häviä; ne
  kirjoitetaan lukuna tai tekstinä.
- **Viittaus** luetaan muodossa `{ id, display }` ja kirjoitetaan linkitetyn rivin `_id`:llä;
  `links: 'id'` lukee vain `_id`:n.
- **Hylkäys** on `BasedbError`: sen `code` – pysyvä, yksi kutakin syytä kohden, sama kaikilla
  kielillä –, `status`, `details` ja `requestId`. Hidastuspyyntö (`429`) yritetään uudelleen
  basedb:n ilmoittaman viiveen jälkeen.

## Tunnus

**Integraatiotunnus** luodaan käyttöliittymässä: tietokannan **⋯**-valikko → **API ja agentit**
→ **API- ja MCP-tunnukset…**. Se avaa yhden tietokannan, lukee sen rivejä, kirjoittaa niitä, jos
se on luotu kirjoitusoikeuksin, ei koskaan enempää oikeuksia kuin sen luoneella henkilöllä, ja
**ei koskaan poista**: `delete()` vaatii istunnon oikeudet.

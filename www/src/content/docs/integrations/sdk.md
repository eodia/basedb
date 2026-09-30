---
title: SDK TypeScript
description: Lire et écrire les lignes de basedb depuis TypeScript, avec les types de vos tables générés depuis votre instance.
---

Le paquet **@basedb/sdk** appelle l’[API REST](/basedb/integrations/api-rest/) depuis
TypeScript ou JavaScript : les lignes typées, toutes les pages, les fichiers, les refus avec leur
code. Aucune dépendance : le `fetch` standard, sous Node 18 et après, Deno, Bun ou dans un
navigateur.

```bash
npm install @basedb/sdk
```

## Les types de vos tables

Une commande lit la description de vos bases et écrit leurs types dans un fichier de votre
programme :

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Chaque base que le jeton ouvre — ou celles nommées par `--base`, répété —, et pour chaque table
trois formes : la ligne telle que basedb la **lit**, telle qu’on la **crée**, telle qu’on la
**modifie**. Une liste de choix devient l’union de ses valeurs ; un champ que basedb calcule —
formule, recherche, cumul, décompte, numéro automatique — se lit sans s’écrire ; un champ
obligatoire sans valeur par défaut est exigé à la création. Relancez la commande quand les
tables changent.

## Lire et écrire

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

Une table, un champ ou un choix qui n’existe pas est une **erreur de type**, avant même que le
programme ne tourne.

| Méthode | Rôle |
|---|---|
| `list(options)` | une page, et `next` pour la suivante |
| `all(options)` | toutes les lignes d’un filtre, page après page, à mesure qu’on les lit |
| `first(options)`, `count(filtre)` | la première ligne, le nombre de lignes |
| `get(id)` | une ligne |
| `create(valeurs)`, `createMany(lignes)` | ajouter une ligne ; plusieurs, toutes ou aucune |
| `update(id, valeurs)` | modifier des champs ; un champ absent reste tel quel, `null` le vide |
| `aggregate({ aggregates, filter, group })` | sommes, moyennes, décomptes sur toutes les lignes d’un filtre |
| `comments(id).list()`, `.add(texte)` | les commentaires d’une ligne ; une @mention prévient |
| `upload(champ, octets, { name, type })` | déposer un fichier, que la ligne cite ensuite par son `id` |
| `db.undo(ligne)` | annuler l’écriture qui a rendu cette ligne — refusé si elle a changé depuis |

- **`filter`** écrit chaque valeur insérée comme une valeur : un texte saisi par un utilisateur
  reste un texte, jamais un morceau du filtre.
- Les **nombres** se lisent en texte décimal (`"12500.0000000000"`), pour ne perdre aucun
  chiffre ; ils s’écrivent en nombre ou en texte.
- Une **relation** se lit `{ id, display }` et s’écrit par l’`_id` de la ligne liée ;
  `links: 'id'` ne lit que l’`_id`.
- Un **refus** est une `BasedbError` : son `code` — stable, un par cause, le même dans toutes
  les langues —, `status`, `details` et `requestId`. Une demande de ralentir (`429`) est
  réessayée après le délai que basedb indique.

## Le jeton

Un **jeton d’intégration** se crée dans l’interface : menu **⋯** de la base → **API et agents**
→ **Jetons API et MCP…**. Il ouvre une base, lit ses lignes, les écrit s’il a été créé en
écriture, n’a jamais plus de droits que la personne qui l’a créé, et **ne supprime jamais** :
`delete()` demande les droits d’une session.

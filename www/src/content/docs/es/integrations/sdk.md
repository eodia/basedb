---
title: SDK TypeScript
description: Leer y escribir las filas de basedb desde TypeScript, con los tipos de tus tablas generados desde tu instancia.
---

El paquete **@basedb/sdk** llama a la [API REST](/basedb/es/integrations/api-rest/) desde
TypeScript o JavaScript: las filas tipadas, todas las páginas, los archivos, los rechazos con su
código. Sin ninguna dependencia: el `fetch` estándar, en Node 18 y posteriores, Deno, Bun o en un
navegador.

```bash
npm install @basedb/sdk
```

## Los tipos de tus tablas

Un comando lee la descripción de tus bases y escribe sus tipos en un archivo de tu programa:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Cada base que abre el token —o las nombradas con `--base`, repetido—, y para cada tabla, tres
formas: la fila tal como basedb la **lee**, tal como se **crea**, tal como se **modifica**. Una
selección única se convierte en la unión de sus valores; un campo que basedb calcula —fórmula,
búsqueda, acumulado, recuento, número automático— se lee sin poder escribirse; un campo
obligatorio sin valor predeterminado es exigido al crear. Vuelve a ejecutar el comando cuando
cambien las tablas.

## Leer y escribir

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

Una tabla, un campo o una opción que no existe es un **error de tipo**, incluso antes de que el
programa se ejecute.

| Método | Función |
|---|---|
| `list(options)` | una página, y `next` para la siguiente |
| `all(options)` | todas las filas de un filtro, página a página, a medida que se leen |
| `first(options)`, `count(filtre)` | la primera fila, el número de filas |
| `get(id)` | una fila |
| `create(valeurs)`, `createMany(lignes)` | añadir una fila; varias, todas o ninguna |
| `update(id, valeurs)` | modificar campos; un campo ausente queda igual, `null` lo vacía |
| `aggregate({ aggregates, filter, group })` | sumas, medias, recuentos sobre todas las filas de un filtro |
| `comments(id).list()`, `.add(texte)` | los comentarios de una fila; una @mención avisa |
| `upload(champ, octets, { name, type })` | subir un archivo, que la fila cita después por su `id` |
| `db.undo(ligne)` | anular la escritura que produjo esta fila — se rechaza si ha cambiado desde entonces |

- **`filter`** escribe cada valor insertado como un valor: un texto introducido por una persona
  usuaria sigue siendo un texto, nunca un fragmento del filtro.
- Los **números** se leen en texto decimal (`"12500.0000000000"`), para no perder ninguna cifra;
  se escriben como número o como texto.
- Una **relación** se lee `{ id, display }` y se escribe con el `_id` de la fila vinculada;
  `links: 'id'` solo lee el `_id`.
- Un **rechazo** es un `BasedbError`: su `code` —estable, uno por causa, el mismo en todos los
  idiomas—, `status`, `details` y `requestId`. Una petición de ralentizar (`429`) se reintenta
  después del plazo que indica basedb.

## Los entornos

Una base que tiene varios [entornos](/basedb/es/fonctionnalites/environnements/) — producción,
preproducción… — conserva sus nombres y sus tipos de un entorno a otro. Con un token creado para toda
la base, `environment()` apunta a un entorno, y el mismo código se ejecuta en otro:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

La opción `environment` del constructor hace lo mismo para todo el cliente. El SDK envía la cabecera
`X-Basedb-Environment`; sin ella, cada nombre de base designa su propio entorno
(`b_t4z56fq_ventes` es la producción).

## El token

Un **token de integración** se crea en la interfaz: menú **⋯** de la base → **API y agentes** →
**Tokens de API y MCP…**. Abre una base — todos sus entornos, o uno solo —, lee sus filas, las
escribe si se ha creado con permiso de escritura, nunca tiene más permisos que la persona que lo
creó, y **solo elimina si se ha creado para ello** («Lectura, escritura y eliminación»): si no, `delete()` se rechaza.

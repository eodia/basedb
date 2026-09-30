---
title: SDK TypeScript
description: Ler e escrever as linhas do basedb a partir de TypeScript, com os tipos das suas tabelas gerados a partir da sua instância.
---

O pacote **@basedb/sdk** chama a [API REST](/basedb/pt-br/integrations/api-rest/) a partir de
TypeScript ou JavaScript: as linhas tipadas, todas as páginas, os arquivos, as recusas com seu
código. Nenhuma dependência: o `fetch` padrão, no Node 18 e versões posteriores, Deno, Bun ou em
um navegador.

```bash
npm install @basedb/sdk
```

## Os tipos das suas tabelas

Um comando lê a descrição das suas bases e escreve seus tipos em um arquivo do seu programa:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Cada base que o token abre — ou as nomeadas por `--base`, repetido —, e para cada tabela três
formas: a linha como o basedb a **lê**, como se a **cria**, como se a **altera**. Uma lista de
escolha se torna a união de seus valores; um campo que o basedb calcula — fórmula, pesquisa,
agregação, contagem, número automático — se lê sem se escrever; um campo obrigatório sem valor
padrão é exigido na criação. Execute o comando de novo quando as tabelas mudarem.

## Ler e escrever

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

Uma tabela, um campo ou uma opção que não existe é um **erro de tipo**, antes mesmo que o
programa seja executado.

| Método | Papel |
|---|---|
| `list(options)` | uma página, e `next` para a seguinte |
| `all(options)` | todas as linhas de um filtro, página após página, à medida que são lidas |
| `first(options)`, `count(filtre)` | a primeira linha, o número de linhas |
| `get(id)` | uma linha |
| `create(valeurs)`, `createMany(lignes)` | adicionar uma linha; várias, todas ou nenhuma |
| `update(id, valeurs)` | alterar campos; um campo ausente permanece como está, `null` o esvazia |
| `aggregate({ aggregates, filter, group })` | somas, médias, contagens sobre todas as linhas de um filtro |
| `comments(id).list()`, `.add(texte)` | os comentários de uma linha; uma @menção notifica |
| `upload(champ, octets, { name, type })` | enviar um arquivo, que a linha cita depois pelo seu `id` |
| `db.undo(ligne)` | desfazer a escrita que produziu essa linha — recusado se ela mudou desde então |

- **`filter`** escreve cada valor inserido como um valor: um texto digitado por um usuário
  permanece um texto, nunca um pedaço do filtro.
- Os **números** se leem em texto decimal (`"12500.0000000000"`), para não perder nenhum dígito;
  se escrevem em número ou em texto.
- Uma **relação** se lê `{ id, display }` e se escreve pelo `_id` da linha vinculada;
  `links: 'id'` lê apenas o `_id`.
- Uma **recusa** é um `BasedbError`: seu `code` — estável, um por causa, o mesmo em todos os
  idiomas —, `status`, `details` e `requestId`. Um pedido para desacelerar (`429`) é repetido
  depois do prazo que o basedb indica.

## O token

Um **token de integração** se cria na interface: menu **⋯** da base → **API e agentes** →
**Tokens de API e MCP…**. Ele abre uma base, lê suas linhas, as escreve se tiver sido criado com
escrita, nunca tem mais permissões do que a pessoa que o criou, e **nunca exclui**: `delete()`
exige as permissões de uma sessão.

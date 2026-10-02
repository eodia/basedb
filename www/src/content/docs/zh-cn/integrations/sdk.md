---
title: TypeScript SDK
description: 从 TypeScript 读取和写入 basedb 的行，数据表的类型由您的实例生成。
---

**@basedb/sdk** 包从 TypeScript 或 JavaScript 调用 [REST API](/basedb/zh-cn/integrations/api-rest/)：带类型的行、完整分页、文件、带错误代码的拒绝信息。没有任何依赖：使用标准的 `fetch`，可运行于 Node 18 及以上版本、Deno、Bun 或浏览器中。

```bash
npm install @basedb/sdk
```

## 数据表的类型

一条命令会读取您各个数据库的描述，并把它们的类型写入您程序中的一个文件：

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

令牌能打开的每个数据库——或用重复的 `--base` 指定的那些——，每张数据表都会生成三种形式：basedb**读取**到的行、用来**创建**的行、用来**修改**的行。单选字段会变成其所有取值的联合类型；basedb 自己计算的字段——公式、查找引用、汇总、计数、自动编号——只能读取，不能写入；没有默认值的必填字段在创建时是必需的。数据表变化后，请重新运行该命令。

## 读取和写入

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

引用不存在的数据表、字段或选项会是一个**类型错误**，甚至在程序运行之前就会被发现。

| 方法 | 作用 |
|---|---|
| `list(options)` | 一页数据，以及用于获取下一页的 `next` |
| `all(options)` | 按筛选条件读取全部行，逐页读取，边读边处理 |
| `first(options)`、`count(filtre)` | 第一行；行数 |
| `get(id)` | 读取一行 |
| `create(valeurs)`、`createMany(lignes)` | 新增一行；新增多行，全部成功或全部失败 |
| `update(id, valeurs)` | 修改若干字段；未提及的字段保持不变，`null` 会将其清空 |
| `aggregate({ aggregates, filter, group })` | 对筛选条件下的所有行求和、求平均、计数 |
| `comments(id).list()`、`.add(texte)` | 读取或添加一行的评论；@提及会通知对方 |
| `upload(champ, octets, { name, type })` | 上传一个文件，随后该行可通过其 `id` 引用它 |
| `db.undo(ligne)` | 撤销产生这一行当前状态的那次写入——如果此后已发生变化，则会被拒绝 |

- **`filter`** 会把插入的每个值都当作数据处理：用户输入的文本始终是文本，绝不会成为筛选语句的一部分。
- **数字**以十进制文本形式返回（`"12500.0000000000"`），以避免丢失任何一位数字；写入时可以用数字或文本。
- **关联**读取为 `{ id, display }`，写入时使用关联行的 `_id`；`links: 'id'` 只读取 `_id`。
- **拒绝**是一个 `BasedbError`：它的 `code`——每种原因对应一个稳定的值，在所有语言中相同——、`status`、`details` 和 `requestId`。请求过快（`429`）会在 basedb 给出的延迟之后自动重试。

## 令牌

**集成令牌**在界面中创建：打开数据库的 **⋯** 菜单 → **API 与智能体** → **API 和 MCP 令牌…**。它能打开一个数据库，读取其中的行，如果创建时选择了可写就能写入，权限永远不会超过创建它的人，并且**只有在专门为删除而创建时才会删除**（“读写和删除”）：否则 `delete()` 会被拒绝。

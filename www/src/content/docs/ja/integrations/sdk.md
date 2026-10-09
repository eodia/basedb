---
title: TypeScript SDK
description: TypeScriptからbasedbの行を読み書きします。テーブルの型はインスタンスから生成されます。
---

**@basedb/sdk**パッケージは、TypeScriptまたはJavaScriptから[REST API](/basedb/ja/integrations/api-rest/)を呼び出します：型付きの行、すべてのページ、ファイル、コードを伴う拒否。依存関係はゼロです：標準の`fetch`があれば、Node 18以降、Deno、Bun、またはブラウザーで動きます。

```bash
npm install @basedb/sdk
```

## テーブルの型

あるコマンドが、あなたのデータベースの記述を読み取り、その型をプログラムのファイルに書き出します：

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

トークンが開く各データベース——または`--base`で指定した（複数回書ける）データベース——について、そして各テーブルにつき3つの形：basedbが**読み取る**ときの行、**作成する**ときの行、**変更する**ときの行です。単一選択はその選択肢の合併型になり、basedbが計算するフィールド——数式、ルックアップ、ロールアップ、カウント、自動採番——は書き込めずに読み取り専用になり、既定値のない必須フィールドは作成時に必須とされます。テーブルが変わったら、コマンドを再実行してください。

## 読み書き

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

存在しないテーブル、フィールド、選択肢は、プログラムが動く前から**型エラー**になります。

| メソッド | 役割 |
|---|---|
| `list(options)` | 1ページと、次のページのための`next` |
| `all(options)` | フィルターに合うすべての行を、読み取りながらページごとに |
| `first(options)`、`count(filtre)` | 最初の1行、行数 |
| `get(id)` | 1行 |
| `create(valeurs)`、`createMany(lignes)` | 行を1件追加。複数件は、全件かゼロ件か |
| `update(id, valeurs)` | フィールドを変更。指定しないフィールドはそのまま、`null`は空にします |
| `aggregate({ aggregates, filter, group })` | フィルターに合うすべての行の合計、平均、カウント |
| `comments(id).list()`、`.add(texte)` | 行のコメント。@メンションはその人に通知します |
| `upload(champ, octets, { name, type })` | ファイルを預け、行はその後`id`で引用します |
| `db.undo(ligne)` | この行を作った書き込みを取り消します——その後に変更されていれば拒否されます |

- **`filter`** は、差し込んだ値をそれぞれ値として書き込みます：利用者が入力したテキストはテキストのままで、フィルターの一部になることはありません。
- **数値**は小数点付きのテキストで読み取られます（`"12500.0000000000"`）。数字を1つも失わないためです。書き込みは数値でもテキストでも構いません。
- **リレーション**は`{ id, display }`として読み取られ、リンクされた行の`_id`で書き込まれます。`links: 'id'`は`_id`だけを読み取ります。
- **拒否**は`BasedbError`です：その`code`——原因ごとに固定で、どの言語でも同じ——、`status`、`details`、`requestId`。速度を落とすようにという要求（`429`）は、basedbが示す時間だけ待ってから再試行されます。

## 環境

複数の[環境](/basedb/ja/fonctionnalites/environnements/)——本番、ステージング…——を持つデータベースでも、名前と型は環境が違っても変わりません。データベース全体用に作成されたトークンなら、`environment()`で環境を指定でき、同じコードを別の環境で実行できます：

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

コンストラクターの`environment`オプションを使えば、クライアント全体に同じ指定ができます。SDKは`X-Basedb-Environment`ヘッダーを送ります。ヘッダーがなければ、それぞれのデータベース名が自分の環境を指します（`b_t4z56fq_ventes`は本番です）。

## トークン

**連携トークン**はインターフェースで作成します：データベースの **⋯** メニュー → **APIとエージェント** → **APIとMCPのトークン…**。トークンは1つのデータベース——そのすべての環境、または1つだけ——を開き、その行を読み取り、書き込み用に作成されていれば書き込みますが、作成した人を超える権限を持つことはなく、**そのために作成されている場合のみ削除します**（「読み取り、書き込みと削除」）：そうでなければ`delete()`は拒否されます。

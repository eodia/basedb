---
title: MCPサーバー
description: Model Context Protocolで、AIエージェントをbasedbにつなぎます。
---

basedbは**MCPサーバー**（`POST /mcp`、インターフェースと同じアドレス）を公開しています。エージェント（Claude、コーディングアシスタント、独自のエージェントなど）は、ここでデータベースを見つけ、行を読み書きし、許可すれば削除もして、構造の変更を**提案**します。

## エージェントをつなぐ

**APIとMCPのトークン…**（データベースのメニューの**APIとエージェント**内）からトークンを作成し、MCPアクセスにチェックを入れます。同じトークンで、REST APIとMCPの両方を使え、**データベース全体**——本番と他の環境——を開きます（下記参照）。

トークンは環境変数`BASEDB_TOKEN`に設定し、設定ファイルには決して書かないでください。HTTPでMCPを話すクライアント——Claude Codeなど——は、ヘッダー`Authorization: Bearer <jeton>`を付けて`…/mcp`に直接アクセスします。Claude Codeの場合：

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

このコマンドはプロジェクトの`.mcp.json`ファイルを書き出します。そこでは`${BASEDB_TOKEN}`が変数への参照のまま残り、トークン自体は書かれません。

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

ローカルのプログラム（stdio）しか起動できないクライアントは、リポジトリの中継プログラムを経由します。トークンは`--token-env`で指定した変数から読み込まれます：

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

次に、エージェントに`whoami`を呼び出してもらってください。トークンを作成した人、開いているデータベース、その環境、権限が返されます。

## 環境を選ぶ

データベースには複数の[環境](/basedb/ja/fonctionnalites/environnements/)——本番、ステージング、開発——を持たせることができ、それぞれが独自のテーブルと行を持ちます。データベース全体用のトークンはそのすべてを開き、環境は、範囲の広いものから狭いものの順に選びます：

- **データベース名**だけを指定した場合：`crm`は本番、`crm_recette`はステージングです。
- **サーバーのアドレス**：`…/mcp?environment=recette`は、その接続全体でステージングを対象にします。中継プログラムでは`--environment recette`が同じ働きをします。こうして、環境ごとに1つのサーバーを、同じトークンですべて登録できます：

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- データベースを指定する各ツールの **`environment`引数**：1回の呼び出しだけが対象になります。`list_records`に`{"base": "crm", "table": "clients", "environment": "recette"}`を渡す、など。

環境は、そのバッジの名前で指定します。大文字・小文字とアクセント記号は区別されません（`Recette`、`recette`、「Développement」なら`developpement`）。`production`でも指定できます。`whoami`はトークンが開く環境を一覧し、`list_bases`と`describe_base`は各データベースがどの環境のものかを示します。

トークンは、作成時に1つの環境だけに限定することもできます。その場合、他の環境は一切見えません。

## 15のツール

| ツール | 役割 |
|---|---|
| `whoami` | エージェントが誰で、どの権限を持ち、どの環境を使えるか |
| `list_bases`、`describe_base`、`describe_table` | 構造、その説明、外観を把握する |
| `list_records`、`get_record`、`lookup_records` | 読み取り、フィルター、表示値の解決 |
| `create_record`、`update_record` | 行の書き込み |
| `delete_record`、`restore_record` | 行を削除する——削除のために作成されたトークンで——、そして復元する |
| `propose_create_table`、`propose_add_field`、`get_proposal` | 構造の変更を提案する |
| `propose_update_look` | テーブルとその選択肢の色とアイコンを提案する |

## 色とアイコン

テーブルと、単一選択・複数選択フィールドの各選択肢には、インターフェースと同じように色とアイコンがあります。エージェントは、提案するときにこれらを選びます：

- `propose_create_table`は、テーブルの`color`と`icon`を受け付けます。
- `propose_add_field`は、`select`または`multi_select`の各オプションの`color`と`icon`を受け付けます。
- `propose_update_look`は、既存のテーブルとその選択肢の色とアイコンを変更します：キーを省略すると現在の設定が維持され、`null`を指定すると消去されます。

`color`は`#rrggbb`形式の色です。`icon`は、インターフェースが描画する[Lucide](https://lucide.dev/icons/)のアイコン名です——`truck`、`circle-check`、`flame`…：ツールのスキーマに一覧があり、未知の名前は拒否されます。`describe_base`と`describe_table`は現在の外観を返します。一方、フィールドにはアイコンを選ぶ項目がありません：インターフェースは、その型のアイコンを描画します。

## 行を削除する

「読み取り、書き込みと削除」の権限で作成されたトークンは、エージェントに行の削除を許可します。`_id`を指定して、**一度に1行**です。`delete_record`は削除前の行をそのまま返し、削除はそのトークンの名前で履歴に記録されます。`restore_record`はその`_id`のまま行を元に戻します——エージェントは自分の誤りを自分で取り消せますし、人も履歴から同じことができます。

エージェントが削除しないのは：

- 読み取り専用、または読み取りと書き込みのトークンの場合：拒否の応答に、どのトークンを作成すべきかが示されます。
- 連鎖的なリレーションによって他の行も一緒に削除される行の場合（`TOKEN_CASCADE_FORBIDDEN`）：この削除は、何が一緒に削除されるかを見られる人が、インターフェースで行います。
- 複数行を一度に削除する場合：どのツールもそれを行いません。

## エージェントがしないこと

- **削除は、あなたの同意があるときだけ行います**：そのために作成されたトークンで、一度に1行です。
- **構造も外観も変更しません**：提案するだけです。提案は**エージェントの提案…**（データベースのメニュー）で待機し、構造を管理する人が承認または却下します。判断されないまま24時間が経つと失効します。
- **トークンを作成した人を超える権限は持ちません**：トークンの権限は、その人の権限と、環境ごとに重なる部分だけに限られます。
- エージェントに対して非表示に設定されたフィールドや、MCPに対して閉じられたデータベースは見えません。

各呼び出しは、パラメーターの値ではなく、その形だけが記録されます。

---
title: MCPサーバー
description: Model Context Protocolで、AIエージェントをbasedbにつなぎます。
---

basedbは**MCPサーバー**（`POST /mcp`、インターフェースと同じアドレス）を公開しています。エージェント（Claude、コーディングアシスタント、独自のエージェントなど）は、ここでデータベースを見つけ、行を読み書きし、構造の変更を**提案**します。

## エージェントをつなぐ

**APIとMCPのトークン…**（データベースのメニューの**APIとエージェント**内）からトークンを作成し、MCPアクセスにチェックを入れます。同じトークンで、REST APIとMCPの両方を使えます。

HTTPで通信するクライアントの場合、アドレスは`http://localhost:3000/mcp`で、`Authorization: Bearer <jeton>`を付けます。プロセスを起動するクライアント（stdio）向けには、リポジトリに中継プログラムが用意されています。トークンは設定ファイルではなく、環境変数から読み込みます：

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## 12のツール

| ツール | 役割 |
|---|---|
| `whoami` | エージェントが誰で、どの権限を持つか |
| `list_bases`、`describe_base`、`describe_table` | 構造とその説明を把握する |
| `list_records`、`get_record`、`lookup_records` | 読み取り、フィルター、表示値の解決 |
| `create_record`、`update_record` | 行の書き込み |
| `propose_create_table`、`propose_add_field`、`get_proposal` | 構造の変更を提案する |

## エージェントがしないこと

- **何も削除しません。**
- **構造を変更しません**：提案するだけです。提案は**エージェントの提案…**（データベースのメニュー）で待機し、構造を管理する人が承認または却下します。判断されないまま24時間が経つと失効します。
- **トークンを作成した人を超える権限は持ちません**：トークンの権限は、その人の権限と重なる部分だけに限られます。
- エージェントに対して非表示に設定されたフィールドや、MCPに対して閉じられたデータベースは見えません。

各呼び出しは、パラメーターの値ではなく、その形だけが記録されます。

---
title: Docker Compose
description: イメージ、サービス、ボリューム、日常の運用。
---

basedbは**1つのイメージ**[`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)として、amd64とarm64向けに公開されています。リポジトリの`docker-compose.yml`が、これをPostgreSQLと組み合わせます。設定はすべて`.env`ファイルで行います（[環境変数](/basedb/ja/hebergement/variables/)を参照）。

## イメージ

イメージにはbasedbの3つのプロセスが含まれ、**単一のポート3000**で提供されます：

| パス | プロセス |
|---|---|
| `/api/*`、`/auth/*`、`/healthz` | REST API、ログイン、バックグラウンド処理 |
| `/mcp` | エージェント向けのMCPサーバー |
| それ以外すべて（`/`、`/f/…`、`/v/…`） | インターフェース |

起動時には、APIが最初に動きます。空のデータベースではカタログを適用して最初の管理者を作成し、2回目以降の起動ではどちらも何もしません。MCPサーバーは、APIが応答し次第起動します。いずれかのプロセスが停止するとコンテナ全体が停止し、再起動ポリシーによってコンテナ全体が再起動されます。

イメージはNode 22上で`node`ユーザーとして動作し、ヘルスチェック（`/healthz`）と、ファイルフィールドと画像フィールドのファイル用のボリューム`/data`を宣言しています。

| タグ | 内容 |
|---|---|
| `latest` | 最新の公開バージョン |
| `0.3` | 最新の0.3.x |
| `0.3.1` | このバージョンそのもの |

## サービス

| サービス | イメージ | ポート（127.0.0.1上） | ボリューム |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy`（オプション） | `caddy:2-alpine` | 80、443 | `caddy-data`、`caddy-config` |

## 便利なコマンド

```bash
docker compose up -d                # イメージをダウンロードして起動
docker compose logs -f basedb       # basedbのログを追う（初回起動時の管理者パスワード）
docker compose ps                   # サービスの状態とヘルス
docker compose restart basedb       # basedbを再起動
docker compose down                 # 停止（ボリュームは残ります）
```

リポジトリをクローンした環境では、`docker compose up -d --build`で、イメージをダウンロードする代わりにソースコードからビルドします。

## ポートを変更する

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## 既存のPostgreSQLデータベース

`DATABASE_URL`を設定すると、basedbは`db`コンテナの代わりにそのデータベースに接続します（`db`コンテナは使われないまま起動します。必要なら`docker-compose.override.yml`ファイルで取り除いてください）。PostgreSQL 16以上、データベースの所有者ロール、そして利用可能な`pg_trgm`と`unaccent`拡張が必要です。この場合は、イメージだけで十分です。[インストール](/basedb/ja/guides/installation/)をご覧ください。

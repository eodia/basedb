---
title: インストール
description: Docker Composeでbasedbをインストールする方法と、開発環境を起動する方法。
---

basedbは**1つのDockerイメージ**[`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)（amd64とarm64）に収まっています。**インターフェース**、**API**、**MCPサーバー**が、1つのアドレスで提供されます。必要なのは**PostgreSQL 16**のデータベースで、これは`docker-compose.yml`が用意します。

## Docker Composeを使う（推奨）

前提条件：Docker と Compose v2。必要なのはファイル2つだけで、ソースコードは不要です：

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

`.env`を開き、必須の2つの値だけを設定します：

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# 一度だけ生成します：openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

次に起動します：

```bash
docker compose up -d
```

初回起動時に、basedbはカタログを作成します。その後[http://localhost:3000](http://localhost:3000)を開くと、最初のページで**管理者アカウントの作成**を求められます。名前、メールアドレス、任意のパスワードを入力すると、そのままログインした状態になります。

:::caution[最初のアクセスで管理者が作成されます]
管理者が存在しない間は、最初にインターフェースを開いた人が管理者を作成します。インスタンスを他の人がアクセスできる状態にする**前に**（ドメインで公開したり、すべてのネットワークインターフェースでポートを公開したりする前に）、管理者を作成してください。
:::

無人インストールの場合は、`.env`の`BASEDB_ADMIN_EMAIL`で管理者を指定します。basedbは初回起動時にその管理者を作成し、パスワードをログ（`docker compose logs basedb`）に**一度だけ**表示します。`BASEDB_ADMIN_PASSWORD`でパスワードを固定することもできます。

| アドレス | 役割 |
|---|---|
| http://localhost:3000 | インターフェース |
| http://localhost:3000/api | REST APIとそのドキュメント |
| http://localhost:3000/mcp | エージェント向けのMCPサーバー |
| localhost:5432 | `psql`や各種ツール向けのPostgreSQL |

ポートは`127.0.0.1`にのみ公開されます。basedbをドメインで提供するには、[ドメインとHTTPS](/basedb/ja/hebergement/https/)をご覧ください。

## 独自のPostgreSQLを使う

PostgreSQL 16以上のデータベース（データベースの所有者ロールがあり、`pg_trgm`と`unaccent`拡張が利用できること）があれば、イメージだけで動きます：

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

生成したキーは必ず保管してください（下記の注意を参照）。

:::caution[インスタンスキー]
`BASEDB_ENCRYPTION_KEY`はセッションに署名し、保存されたシークレット（AIのキー、Webhookのシークレット、オートメーションのシークレットヘッダー、フォームのリンク）を暗号化します。変更するとすべてのユーザーがログアウトされ、これらのシークレットは読めなくなります。一度だけ生成し、データベースと一緒にバックアップしてください。
:::

## 開発環境

前提条件：Node 22以上、Docker、そして`corepack enable`。

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start`は空いているポートを選び、使い捨てのPostgreSQL 16を起動し、カタログを適用し、開発用の管理者（`admin@basedb.local` / `developpement-basedb`。ログイン画面にアドレスが入力済み）を用意してから、API、MCPサーバー、インターフェースを開発モードで起動します。`Ctrl+C`で、コンテナも含めてすべて停止します。

## 次のステップ

- [クイックスタート](/basedb/ja/guides/premiers-pas/)：データベース、テーブル、ビュー、フォーム。
- [環境変数](/basedb/ja/hebergement/variables/)：ファイル、AI、アドレス。

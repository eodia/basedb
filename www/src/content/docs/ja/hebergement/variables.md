---
title: 環境変数
description: basedbが読み込むすべての変数と、そのデフォルト値。
---

すべて、`docker-compose.yml`と同じ場所にある`.env`ファイルに記述します。このファイルは`docker compose`が読み込みます（コメント付きの完全なテンプレートは`.env.example`です）。`docker run`の場合は`-e`で渡します。**空の値は「未設定」とみなされます。**

## 必須

| 変数 | 役割 |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQLコンテナのパスワード |
| `BASEDB_ENCRYPTION_KEY` | インスタンスキー：セッションに署名し、シークレットを暗号化します。`openssl rand -base64 32`で一度だけ生成します |

## データベース

| 変数 | デフォルト | 役割 |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQLのロール |
| `POSTGRES_DB` | `basedb` | PostgreSQLのデータベース |
| `POSTGRES_PORT` | `5432` | 127.0.0.1上で公開するポート |
| `DATABASE_URL` | `db`コンテナ | 独自のPostgreSQL 16+データベース |

## 初回起動

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | 空のデータベースにカタログを適用します |
| `BASEDB_BOOTSTRAP` | `1` | 最初の管理者を準備します |
| `BASEDB_TENANT` | `t4z56fq` | APIのURLに使われるテナントの識別子 |
| `BASEDB_ADMIN_EMAIL` | — | 起動時に作成される最初の管理者のアドレス。空の場合は、最初にインターフェースを開いた人が作成します |
| `BASEDB_ADMIN_PASSWORD` | 自動生成（一度だけ表示） | `BASEDB_ADMIN_EMAIL`と組み合わせて使う、そのパスワード。設定すると、起動の**たびに**管理者に再適用されます。ログインしたら削除してください |

## Google、Microsoftなどでのログイン（OIDC）

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | 提供するプロバイダー（カンマ区切り）：`google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`、`_CLIENT_SECRET` | — | プロバイダーに登録したアプリケーション |
| `BASEDB_OIDC_<NOM>_ISSUER` | `google`、`gitlab`はそれぞれの発行者 | OpenID Connectの発行者 |
| `BASEDB_OIDC_<NOM>_LABEL`、`_SCOPES` | プロバイダーによる | ボタンの名前、要求するスコープ |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`：初回ログインでアカウントを作成しません |

[アカウントとログイン](/basedb/ja/hebergement/connexion/)をご覧ください。

## アドレス

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_PORT` | `3000` | 127.0.0.1上で公開するポート：インターフェース、`/api`、`/mcp` |
| `BASEDB_VERSION` | `latest` | `eodia/basedb`イメージのタグ |
| `BASEDB_PUBLIC_URL` | — | basedbの公開アドレス（OIDCのリダイレクト用） |
| `BASEDB_DOMAIN` | — | CaddyプロキシがHTTPSで提供するドメイン |
| `BASEDB_ORIGINS` | — | ブラウザーからAPIを呼び出すページを持つ他のサイト（カンマ区切り）。同じアドレスで提供されるbasedbのインターフェースには不要です |
| `BASEDB_API`、`BASEDB_MCP` | `/`、`/mcp` | ブラウザーから見たAPIとMCP。開発スタック（`pnpm start`）の場合にのみ設定します |

## ファイル

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | 1ファイルの最大サイズ |
| `BASEDB_S3_BUCKET` | — | S3ストレージを有効にします |
| `BASEDB_S3_ENDPOINT` | — | S3エンドポイント |
| `BASEDB_S3_REGION` | `us-east-1` | リージョン |
| `BASEDB_S3_ACCESS_KEY_ID`、`BASEDB_S3_SECRET_ACCESS_KEY` | — | 認証情報 |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0`でホスト形式のアドレス指定 |

## データベーステンプレート

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | 公開サイトのカタログ | インスタンスがギャラリーのテンプレートを読み込む場所。`off`で何も読み込みません（組み込みテンプレートは残ります）。[テンプレート](/basedb/ja/fonctionnalites/modeles/)を参照 |

## AI

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`、`anthropic`、`mistral` |
| `BASEDB_AI_MODEL` | — | モデル |
| `BASEDB_AI_API_KEY` | — | キー（なければ`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`MISTRAL_API_KEY`） |
| `BASEDB_AI_QUOTA` | `120` | テナントごとの1時間あたりの対話的な呼び出し回数 |
| `BASEDB_AI_FIELD_QUOTA` | `300` | テナントごとの1時間あたりのAIフィールドの計算回数 |
| `BASEDB_AI_WORKER` | `1` | `0`：このプロセスではバックグラウンド計算を行いません |

## 開発専用

| 変数 | 役割 |
|---|---|
| `BASEDB_DEV_MAIL=1` | メールを送信せず、ログに表示します |
| `BASEDB_WEBHOOK_DEV=1` | HTTPやローカルアドレスへのWebhookを許可します |

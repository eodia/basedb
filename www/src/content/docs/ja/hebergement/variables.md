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
| `BASEDB_BASE_PATH` | `BASEDB_PUBLIC_URL`のパス | ゲートウェイの配下でbasedbが提供されるパス。`https://passerelle.example.com/basedb/`の場合は`/basedb`。[Docker Compose](/basedb/ja/hebergement/docker/#ゲートウェイの配下パスの下で)を参照 |
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

## メール

送信サーバーがなければ、basedbはメールを送信しません。設定すると、**10分間未読のままの**通知（**設定 › 通知**で各自が選べます）、オートメーションの**メールを送信**ステップのメール、そして**パスワードをお忘れの方**のリンクが送られます。リンクは`BASEDB_PUBLIC_URL`を指します。設定されていない場合、メールにリンクは入りません。

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | SMTPサーバー：メールサービスや送信サービスのもの |
| `BASEDB_SMTP_PORT` | `587` | 最初から暗号化された接続には`465` |
| `BASEDB_SMTP_SECURE` | `starttls`（ポート465では`tls`） | 同じマシン上のリレー専用の場合のみ`none`：それ以外ではパスワードが平文で送られてしまいます |
| `BASEDB_SMTP_USER`、`BASEDB_SMTP_PASSWORD` | — | 送信アカウントの識別情報（必要な場合） |
| `BASEDB_MAIL_FROM` | — | `BASEDB_SMTP_HOST`とともに必須：送信者、`basedb <no-reply@exemple.fr>` |

起動時、ログにその状況が示されます：`Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` サーバーが拒否したメールは、1分後、5分後、30分後、120分後、
360分後に再送されます。

## 地図と住所

**地図**ビューは、ジオコーディングサービスによって住所の位置を決めます：デフォルトではOpenStreetMap（Nominatim）で、住所1件につき1回、最大で1秒に1件のリクエストを送り、応答はすべて保存されます。地図の背景は**ベースマップ**でできており、各閲覧者のブラウザーが直接読み込みます。

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | 同じプロトコルを話す別のサービス（自前のNominatim）。`off`：何も使わず、住所はインスタンスの外に出ず、緯度と経度だけで行を配置します |
| `BASEDB_MAP_TILES` | OpenStreetMapのタイル | 別のタイルサーバー、書式は`https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | そのサーバーが求める表示、地図右下に示されます |

起動時、ログにどのサービスが使われているかが示されます：`Géocodage : https://nominatim.openstreetmap.org.`

## PDFドキュメント

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_PDF_FONTS` | イメージ内のNotoフォント | コンテナにマウントする独自のフォルダー。`NotoSans-Regular.ttf`、`-Bold`、`-Italic`、`-BoldItalic`、そして中国語・日本語・韓国語用の`NotoSansCJK-Regular.ttc`と`-Bold.ttc`を置きます |

## データベーステンプレート

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | 公開サイトのカタログ | インスタンスがギャラリーのテンプレートを読み込む場所。`off`で何も読み込みません（組み込みテンプレートは残ります）。[テンプレート](/basedb/ja/fonctionnalites/modeles/)を参照 |

## AI

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`、`anthropic`、`mistral`、`openai_compatible`（Azure、ゲートウェイ、ローカルモデル） |
| `BASEDB_AI_MODEL` | — | モデル |
| `BASEDB_AI_API_KEY` | — | キー（なければ`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`MISTRAL_API_KEY`）。`openai_compatible`では省略可 |
| `BASEDB_AI_BASE_URL` | プロバイダーのアドレス | `/chat/completions`の手前までの部分（`anthropic`では`/messages`）で、パラメーターも含みます。`openai_compatible`では必須。[AI](/basedb/ja/fonctionnalites/ia/#azureゲートウェイローカルモデル)を参照 |
| `BASEDB_AI_HEADERS` | — | 各呼び出しに追加されるヘッダー（JSONオブジェクト）：`{"api-key":"…"}` |
| `BASEDB_AI_PROVIDER_SSL_VERIFY` | `true` | `false`：プロバイダーのTLS証明書を検証しません。自己署名証明書の社内ゲートウェイ向け。[AI](/basedb/ja/fonctionnalites/ia/#azureゲートウェイローカルモデル)を参照 |
| `BASEDB_AI_QUOTA` | `120` | テナントごとの1時間あたりの対話的な呼び出し回数 |
| `BASEDB_AI_FIELD_QUOTA` | `300` | テナントごとの1時間あたりのAIフィールドの計算回数 |
| `BASEDB_AI_WORKER` | `1` | `0`：このプロセスではバックグラウンド計算を行いません |

## 社内ネットワークへのWebhook

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | 社内サーバー（カンマ区切り）：ホスト名（`chat.intra.example.com`）、ドメインとそのサブドメイン（`*.intra.example.com`）、アドレスまたは範囲（`10.12.0.0/16`） |

Webhook、オートメーションのHTTPリクエスト、同期テーブルは、公開されたHTTPSアドレスにしか送信されません。これに加えて、一覧にあるターゲットは、アドレス、ポート、スキーム——HTTPも含め——を問わず受け付けられます。読み取れないエントリーがあると起動できません。[Webhook](/basedb/ja/integrations/webhooks/#送信先)をご覧ください。

## 公開デモ

[demo.basedb.eodia.com](https://demo.basedb.eodia.com)のような、誰にでも開かれたインスタンス：ログイン画面には共有アカウントがあらかじめ入力されており、訪問者はすべてを閲覧し、既存のものを変更できますが、データベース、テーブル、行、ファイル、コメント、アカウント、トークン、リンクのいずれも作成・削除できません。AIも、自分がデモには含まれていないと答えます。SQLコンソールは、そこでは読み取り専用です。データベースを毎晩元の状態に戻すのは、運用者の役目のままです。

| 変数 | デフォルト | 役割 |
|---|---|---|
| `BASEDB_DEMO` | — | `1`：インスタンスが公開デモになります |
| `BASEDB_DEMO_ACCOUNTS` | — | 言語ごとに1アカウント、カンマ区切り：`fr=demo@demo.com,en=demo-en@demo.com`。ログイン画面には、その言語のアカウントがあらかじめ入力されます（なければ英語、それもなければ最初のもの）。他のアカウントも選択肢として表示されます。デモを有効にする前に、それぞれ専用のプロジェクトを添えてこれらのアカウントを作成してください：有効化後は、管理者を含め、誰も新規作成できなくなります |
| `BASEDB_DEMO_PASSWORD` | — | `BASEDB_DEMO_ACCOUNTS`とともに使う、全アカウント共通のパスワード。アカウントと一緒に公開されます |

`BASEDB_DEMO_ACCOUNTS`がなければ、共有アカウントは`BASEDB_ADMIN_EMAIL`と`BASEDB_ADMIN_PASSWORD`が指定する管理者になります。デモのアドレスは、何を入力しても公開されたパスワードでログインできます：誤った入力を繰り返しても、全員分がロックされることはありません。

## 開発専用

| 変数 | 役割 |
|---|---|
| `BASEDB_DEV_MAIL=1` | メールを送信せず、ログに表示します |
| `BASEDB_WEBHOOK_DEV=1` | HTTPやローカルアドレスへのWebhookを許可します |

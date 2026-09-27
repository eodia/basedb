---
title: アカウントとログイン
description: 誰がアカウントを作成できるか、そしてGoogle、Microsoft、企業のSSOでログインする方法。
---

## 初回ログイン

新しいインスタンスでは、最初のページで**管理者アカウント**を作成します。名前、メールアドレス、任意のパスワードを入力します。インスタンスを他の人がアクセスできる状態にする前に（ドメインで公開したり、すべてのネットワークインターフェースでポートを公開したりする前に）、作成してください。

## アカウントの作成

デフォルトでは、インスタンスにアクセスできる人は誰でも**自分のアカウントを作成**し、自分のプロジェクトを作れます。それ以外のものは何も見えず、他の人のプロジェクトには**招待**によって参加します。

**システム管理 → ユーザー**の「アカウント作成」カードでは、次のことができます：

- アカウント作成を締め切る：招待された人だけがアカウントを作成できるようになります。
- 特定のドメインに限定する：`exemple.fr, autre.fr`とすると、これらのドメインのアドレスだけが許可されます。

## プロジェクトやデータベースに招待する

プロジェクトまたはデータベースに対して**管理**レベルを持つ人は、それを共有できます。プロジェクト（またはデータベース）のメニュー → **共有…** で、メールアドレスとレベル（閲覧、編集、管理）を指定します。basedbは7日間有効な**招待リンク**を生成するので、お好きな方法で相手に送ってください。相手はリンクを開いてログインするか、アカウントを作成します。同じ画面で、アクセスできる人の確認、レベルの変更や取り消し、保留中のリンクの再送ができます。

管理レベルの人が与えられるのは、自分が管理している範囲までです。データベースを管理する人はそのデータベースを共有できますが、そのプロジェクトは共有できません。

## Google、Microsoftなどでログインする

basedbは**OpenID Connect**に対応しています：Google、Microsoft Entra ID、GitLab、Keycloak、Authentik、Oktaなど。設定したプロバイダーごとに、ログイン、アカウント作成、招待の各画面に「…で続行」ボタンが追加されます。

1. `.env`で、basedbの公開アドレスを設定します：

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. プロバイダー側でWebアプリケーションを作成します。その**リダイレクトURI**は`https://basedb.example.com/auth/oidc/<nom>/callback`で、`<nom>`は下で付ける名前（`google`、`microsoft`など）です。

3. `.env`で宣言します：

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`：起動時に、basedbは採用したプロバイダーを一覧表示し、除外したプロバイダーについては何が足りないかを示します。

| 変数（プロバイダー`<NOM>`用） | 役割 |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`、`_CLIENT_SECRET` | プロバイダーに登録したアプリケーション |
| `BASEDB_OIDC_<NOM>_ISSUER` | 発行者（issuer）。`google`と`gitlab`では不要です |
| `BASEDB_OIDC_<NOM>_LABEL` | ボタンに表示する名前。デフォルトは`Google`、`Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | デフォルトは`openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`：既存のアカウントのみ許可します |

**初回ログインでは、アカウント作成の設定に従ってアカウントが作成されます。** 作成が開放されていれば許可され、ドメインに限定されていれば、そのドメインのアドレスだけが許可されます。パスワードを使うアカウントがすでに使っているアドレスが引き継がれることはなく、その持ち主は自分のパスワードでログインします。シークレットは環境変数にとどまり、データベースには何も書き込まれません。

:::note
GitHubはOpenID Connectのプロバイダーではないため、ここでは使えません。
:::

---
title: ドメインとHTTPS
description: 付属のCaddyプロキシの背後で、basedbをドメインとHTTPSで提供します。
---

本番環境では、basedbは**HTTPS**で提供する必要があります。セッションCookieは`Secure`で`__Host-`プレフィックスが付いており、ブラウザーがHTTPで受け付けるのは`localhost`の場合だけだからです。

イメージはすでに、すべてを1つのアドレスで提供しています。インターフェース、`/api`の下のAPI、`/mcp`の下のMCPサーバーです。あとはHTTPSプロキシの背後に置くだけです。`docker-compose.yml`には**Caddy**が付属しており、Let’s Encryptの証明書を自動で取得・更新します。

## セットアップ

1. ドメインのDNSをサーバーに向け、ポート80と443を開放します。
2. `.env`で次のように設定します：

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. `https`プロファイルで起動します：

   ```bash
   docker compose --profile https up -d
   ```

ポート3000は、引き続き`127.0.0.1`にのみ公開されます。外部からのトラフィックは、すべてCaddyを経由します。

## これらの変数が必要な理由

- `BASEDB_DOMAIN`：Caddyが証明書を要求するドメイン。
- `BASEDB_PUBLIC_URL`：OIDCログインのリダイレクト先アドレス。IDプロバイダーに登録したものと、1文字ずつ比較されます。
- Caddyは訪問者の実際のアドレスから`X-Forwarded-For`を設定し、basedbはそれがプライベートネットワークから来た場合にこれを採用します。これにより、APIのレート制限（ログイン、共有フォーム）が訪問者ごとにカウントされます。

## 他のプロキシ

Nginx、Traefik、ロードバランサーも使えます。ドメインの**すべての**トラフィックをコンテナのポート3000に送り、レスポンスのバッファリングを無効にしてください（MCPサーバーとリアルタイム機能は、レスポンスを逐次ストリーミングします）。また、プロキシが`X-Forwarded-For`に追記するのではなく、**置き換える**ようにしてください。

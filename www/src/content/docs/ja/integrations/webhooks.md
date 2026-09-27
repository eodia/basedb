---
title: Webhook
description: 作成、更新、削除のたびに、他のシステムに通知します。
---

Webhookは、1つまたは複数のテーブルの**イベント**を、HTTPSのアドレスに送ります：`record.created`、`record.updated`、`record.deleted`。データベースのメニューの**APIとエージェント**にある **Webhook…** から管理します。

## ペイロード

本文は常に**イベントの配列**で、各イベントには**変更前**と**変更後**の行全体と、変更されたフィールドの一覧が含まれます：

```json
{ "events": [
  { "id": "0195e…", "type": "record.updated",
    "occurred_at": "2026-09-26T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "b_t4z56fq_ventes", "table": "opportunites",
    "record_id": "0195a…",
    "actor": { "kind": "user" },
    "before": { "statut": "negociation", "montant": "125000", … },
    "after":  { "statut": "gagne", "montant": "125000", … },
    "changed": ["statut"] } ] }
```

直接SQLでの書き込みでも、イベントが発生します。イベントは、トリガーで記録される履歴から送られるためです。

## 署名、順序、再試行

- **署名付き**：`X-Basedb-Signature: t=…,v1=…`。生の本文のHMAC-SHA256で、デシリアライズする前に検証してください。
- 行ごとに**順序を保証**：同じ行の2つのイベントは、順番どおりに届きます。
- 失敗した場合は**再試行**されます。上限を超えるとWebhookは無効になり、インターフェースから再度有効にできます。キューと各配信は、確認、再送、破棄ができます。
- 配信は**少なくとも1回**：`X-Basedb-Delivery-Id`または`events[].id`で重複を除いてください。

## 送信先

Webhookの送信先は、**公開されたHTTPS**アドレスに限られます。開発時は、`BASEDB_WEBHOOK_DEV=1`でHTTPとローカルアドレスを許可できます。

---
title: Webhook
description: 在每次创建、修改或删除时通知其他系统。
---

Webhook 会将一张或多张数据表的**事件**发送到一个 HTTPS 地址：`record.created`、`record.updated`、`record.deleted`。在数据库菜单的 **API 与智能体** 下，通过 **Webhook…** 进行管理。

## 负载

请求体始终是一个**事件数组**，每个事件都包含**修改前**和**修改后**的完整行，以及已更改字段的列表：

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

即使是直接用 SQL 执行的写入也会产生事件：事件源自由触发器捕获的历史记录。

## 签名、顺序、重试

- **已签名**：`X-Basedb-Signature: t=…,v1=…`，即对原始请求体计算的 HMAC-SHA256，应在反序列化之前验证。
- 按行**保证顺序**：同一行的两个事件会按顺序到达。
- 失败时会**重试**；超过重试次数后，Webhook 会被停用，可在界面中重新启用。队列和每次投递都可以查看、重放或放弃。
- **至少投递一次**：请根据 `X-Basedb-Delivery-Id` 或 `events[].id` 去重。

## 目标地址

Webhook 只会发往**公共 HTTPS** 地址。在开发环境中，`BASEDB_WEBHOOK_DEV=1` 允许使用 HTTP 和本地地址。

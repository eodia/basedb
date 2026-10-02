---
title: n8n
description: 从 n8n 工作流读取和写入 basedb 的行，并在每次创建、修改或删除一行时启动工作流。
---

**n8n-nodes-basedb** 包为 n8n 添加了三个节点：

| 节点 | 作用 |
|---|---|
| **basedb** | 读取和写入某张数据表的行，为一行添加评论；可作为 n8n 中 AI 智能体使用的工具 |
| **basedb Trigger** | 针对自上次拉取以来**新建**——或**新建或修改**——的每一行启动一个工作流 |
| **basedb Webhook Trigger** | 在一行被创建、修改或删除的**那一刻**启动一个工作流 |

## 安装

在 n8n 中：**Settings › Community Nodes › Install**，然后输入 `n8n-nodes-basedb`。

没有界面时——队列模式、预先构建好的 Docker 镜像——：在 `~/.n8n/nodes` 目录中执行 `npm install
n8n-nodes-basedb`，然后重启 n8n。

## 凭据

在 n8n 中创建一个 **basedb API** 凭据：

| 字段 | 值 |
|---|---|
| **Instance URL** | 您打开 basedb 的地址：`https://basedb.exemple.fr` |
| **Workspace** | 工作区的标识，也就是 API 地址中的那部分（`/api/v1/<espace>/…`）：`t4z56fq`，除非实例设置了 `BASEDB_TENANT` |
| **Token** | 一个**集成令牌**：打开数据库的 **⋯** 菜单 → **API 与智能体** → **API 和 MCP 令牌…** |

一个令牌只能打开**一个**数据库。它可以读取其中的行，如果创建时选择了可写就能写入，并且权限永远不会超过创建它的人。保存凭据时，n8n 会尝试连接，并说明令牌是否被拒绝。

## 读取和写入：basedb 节点

| 操作 | 作用 |
|---|---|
| **Row › Create** | 新增一行 |
| **Row › Create or Update** | 修改所选字段带有这些值的那一行；如果没有任何行满足，则新增一行 |
| **Row › Get** | 按 `_id` 读取一行 |
| **Row › Get Many** | 按指定顺序读取符合筛选条件的行，直到达到上限或读完全部，逐页进行 |
| **Row › Update** | 修改一行，通过 `_id` 或其他字段找到它 |
| **Comment › Create** | 为一行添加评论；@提及会通知对方 |

**数据库**和**数据表**从列表中选择，即该令牌能打开的那些。要写入的字段会以它们在 basedb 中的名称显示，单选字段带着它的选项，人员字段带着工作区的成员；计算字段——公式、查找引用、汇总、自动编号——不会出现在其中，因为它们由 basedb 自己写入。字段拒绝的值会让节点停止，并给出 basedb 的错误代码及其含义。

- **筛选**和**排序**使用字段的技术名称，也就是 SQL 中的名称：`statut eq "gagne" and montant gte 10000`、`-montant,nom`。语法与 [REST API](/basedb/zh-cn/integrations/api-rest/#读取) 相同。
- **数字**以十进制文本形式返回（`"1250.50"`），以避免丢失任何一位数字；**Numbers as Numbers** 选项会把它们转换为数字。
- **关联**读取为 `{ "id": …, "display": … }`，写入时使用关联行的 `_id`。
- **Create or Update** 从不会修改多行：如果有多行都带有这些值，节点会直接停止，而不会去猜测。
- 没有 **Delete** 操作：要移除行，请为它们做标记（例如状态设为“已归档”），把删除操作交给一个[自动化](/basedb/zh-cn/fonctionnalites/automatisations/)，或者使用专门为删除创建的令牌调用[REST API](/basedb/zh-cn/integrations/api-rest/)。

## 启动工作流

### 每次拉取时：basedb Trigger

该节点会按所选的频率（每分钟、每小时……）向 basedb 请求自上次以来**新建**——或**新建或修改**——的行，如有需要还可以加上筛选条件。它到处都能用，即使 basedb 无法访问到 n8n 也一样。第一次拉取时，它只记录数据表当前的位置，不会发出任何数据；在编辑器中测试时，会返回最后一行，方便连接后续节点。

### 即时触发：basedb Webhook Trigger

每当一行被创建、修改或删除时——即使是直接在 PostgreSQL 中执行的 SQL——都会立刻启动工作流：

1. 添加该节点，并复制它的 **Production URL**。
2. 在 basedb 中，打开数据库的 **⋯** 菜单 → **API 与智能体** → **Webhook…**：创建一个指向该地址的 webhook，选择它的数据表和事件。
3. basedb 会显示一次**签名密钥**：把它填入 n8n 的 **basedb Webhook** 凭据中。
4. 激活该工作流。

每个事件会成为一个条目：它的 `type`（`record.created`、`record.updated`、`record.deleted`）、数据表、该行**修改前**和**修改后**的内容，以及发生变化的字段（`changed`）。该节点会校验每次投递的**签名**，对没有签名、签名错误，或时间超过五分钟的投递返回 `401`。basedb**至少投递一次**：如果工作流不能重复处理同一事件，请按事件的 `id` 去重。

:::note
basedb 只会向**公开的 HTTPS 地址**发送 webhook：处于私有网络中的 n8n 应改用 **basedb Trigger**。参见[Webhook](/basedb/zh-cn/integrations/webhooks/)。
:::

## 不使用该节点

n8n 的 **HTTP Request** 节点也可以直接与 basedb 通信：使用 `Authorization: Bearer <jeton>` 请求头，收发都是 JSON，分页方式是把 `meta.next_cursor` 传给 `after`（`{{ $response.body.meta.next_cursor }}`），故障恢复则通过对 `_updated_at` 的筛选，以及 `…/<table>/deleted?since=`。

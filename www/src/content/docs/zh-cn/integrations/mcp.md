---
title: MCP 服务器
description: 通过 Model Context Protocol 将 AI 智能体接入 basedb。
---

basedb 提供一个 **MCP 服务器**（`POST /mcp`，与界面使用同一地址）：智能体——Claude、代码助手、您自己的智能体——可以通过它发现数据库、读写行，如果您允许还能删除行，并**提议**结构变更。

## 接入智能体

在 **API 和 MCP 令牌…**（数据库菜单中的 **API 与智能体** 下）创建一个令牌，并勾选 MCP 访问。同一个令牌可同时用于 REST API 和 MCP。

对于使用 HTTP 的客户端，地址为 `http://localhost:3000/mcp`，并带上 `Authorization: Bearer <jeton>`。对于通过启动进程通信的客户端（stdio），仓库提供了一个中继程序，它从环境变量中读取令牌——绝不从配置文件中读取：

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## 十四个工具

| 工具 | 作用 |
|---|---|
| `whoami` | 智能体的身份及其权限 |
| `list_bases`、`describe_base`、`describe_table` | 发现结构及其描述 |
| `list_records`、`get_record`、`lookup_records` | 读取、筛选、解析显示值 |
| `create_record`、`update_record` | 写入行 |
| `delete_record`、`restore_record` | 删除一行——使用专门为此创建的令牌——并将其恢复 |
| `propose_create_table`、`propose_add_field`、`get_proposal` | 提议结构变更 |

## 删除行

拥有 **读写和删除** 权限的令牌，可让智能体按 `_id` **一次删除一行**。`delete_record` 会返回删除前的那一行内容，该删除操作会以该令牌的名义记录到历史中；`restore_record` 则按其 `_id` 将该行恢复回来——智能体可以自行撤销自己的失误，一个人也同样可以从历史记录中这样做。

智能体不会在以下情况下删除：

- 令牌是只读，或读写权限：拒绝信息会说明应创建哪种令牌；
- 该行会被级联关联连带删除其他行（`TOKEN_CASCADE_FORBIDDEN`）：这类删除只能在界面中进行，由能看清牵连范围的人来执行；
- 一次删除多行：没有任何工具能做到这一点。

## 智能体不能做什么

- **它只在获得您同意时才删除**：需要专门为此创建的令牌，且每次只删除一行。
- **它不修改结构**：只能提议。提议会在**智能体提议…**（数据库菜单）中等待，由管理结构的人批准或拒绝；如无决定，提议会在 24 小时后过期。
- **它的权限永远不会超过**创建其令牌的人：令牌的权限会与此人的权限取交集。
- 它看不到被标记为对智能体不可见的字段，也看不到对 MCP 关闭的数据库。

每次调用都只按其参数的结构记录日志，从不记录参数的值。

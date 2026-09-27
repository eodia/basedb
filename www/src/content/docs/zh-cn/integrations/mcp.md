---
title: MCP 服务器
description: 通过 Model Context Protocol 将 AI 智能体接入 basedb。
---

basedb 提供一个 **MCP 服务器**（`POST /mcp`，与界面使用同一地址）：智能体——Claude、代码助手、您自己的智能体——可以通过它发现数据库、读写行，并**提议**结构变更。

## 接入智能体

在 **API 和 MCP 令牌…**（数据库菜单中的 **API 与智能体** 下）创建一个令牌，并勾选 MCP 访问。同一个令牌可同时用于 REST API 和 MCP。

对于使用 HTTP 的客户端，地址为 `http://localhost:3000/mcp`，并带上 `Authorization: Bearer <jeton>`。对于通过启动进程通信的客户端（stdio），仓库提供了一个中继程序，它从环境变量中读取令牌——绝不从配置文件中读取：

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## 十二个工具

| 工具 | 作用 |
|---|---|
| `whoami` | 智能体的身份及其权限 |
| `list_bases`、`describe_base`、`describe_table` | 发现结构及其描述 |
| `list_records`、`get_record`、`lookup_records` | 读取、筛选、解析显示值 |
| `create_record`、`update_record` | 写入行 |
| `propose_create_table`、`propose_add_field`、`get_proposal` | 提议结构变更 |

## 智能体不能做什么

- **它不删除任何内容。**
- **它不修改结构**：只能提议。提议会在**智能体提议…**（数据库菜单）中等待，由管理结构的人批准或拒绝；如无决定，提议会在 24 小时后过期。
- **它的权限永远不会超过**创建其令牌的人：令牌的权限会与此人的权限取交集。
- 它看不到被标记为对智能体不可见的字段，也看不到对 MCP 关闭的数据库。

每次调用都只按其参数的结构记录日志，从不记录参数的值。

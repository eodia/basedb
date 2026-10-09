---
title: MCP 服务器
description: 通过 Model Context Protocol 将 AI 智能体接入 basedb。
---

basedb 提供一个 **MCP 服务器**（`POST /mcp`，与界面使用同一地址）：智能体——Claude、代码助手、您自己的智能体——可以通过它发现数据库、读写行，如果您允许还能删除行，并**提议**结构变更。

## 接入智能体

在 **API 和 MCP 令牌…**（数据库菜单中的 **API 与智能体** 下）创建一个令牌，并勾选 MCP 访问。同一个令牌可同时用于 REST API 和 MCP，并且可开放**整个数据库**：包括其生产环境和其他环境（见下文）。

请把令牌放进环境变量 `BASEDB_TOKEN`，绝不要放进配置文件。使用 HTTP 传输 MCP 的客户端（例如 Claude Code）可以直接访问 `…/mcp`，并带上请求头 `Authorization: Bearer <jeton>`。使用 Claude Code 时：

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

该命令会写入项目的 `.mcp.json` 文件，其中 `${BASEDB_TOKEN}` 仍然只是对该变量的引用：令牌本身不会出现在文件里。

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

只能启动本地程序（stdio）的客户端，则通过仓库提供的中继程序，它会从 `--token-env` 指定的变量中读取令牌：

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

然后让智能体调用 `whoami`：它会说明是谁创建了该令牌、令牌打开哪个数据库、有哪些环境，以及其权限。

## 选择环境

一个数据库可以有多个[环境](/basedb/zh-cn/fonctionnalites/environnements/)——生产、预发布、开发——每个环境都有各自的数据表和行。覆盖整个数据库的令牌可以访问所有环境，环境的选择方式按范围从大到小依次为：

- **数据库名称**，不加任何其他内容：`crm` 是生产环境，`crm_recette` 是预发布环境；
- **服务器地址**：`…/mcp?environment=recette` 让整个连接都指向预发布环境。中继程序用 `--environment recette` 达到同样的效果。这样可以为每个环境声明一个服务器，全部使用同一个令牌：

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- 每个需要指定数据库的工具的 **`environment` 参数**，仅对单次调用生效：`list_records` 搭配 `{"base": "crm", "table": "clients", "environment": "recette"}`。

环境以其徽标上的名称指定，不区分大小写和重音符号（`Recette`、`recette`，或用 `developpement` 指代“Développement”），也可以用 `production`。`whoami` 会列出令牌所能打开的环境；`list_bases` 和 `describe_base` 会说明每个数据库属于哪个环境。

令牌在创建时也可以被限定为单个环境：这样它就看不到任何其他环境。

## 十五个工具

| 工具 | 作用 |
|---|---|
| `whoami` | 智能体的身份、拥有哪些权限，以及可访问哪些环境 |
| `list_bases`、`describe_base`、`describe_table` | 发现结构、其描述及其外观 |
| `list_records`、`get_record`、`lookup_records` | 读取、筛选、解析显示值 |
| `create_record`、`update_record` | 写入行 |
| `delete_record`、`restore_record` | 删除一行——使用专门为此创建的令牌——并将其恢复 |
| `propose_create_table`、`propose_add_field`、`get_proposal` | 提议结构变更 |
| `propose_update_look` | 提议数据表及其选项的颜色和图标 |

## 颜色和图标

数据表以及单选字段的每个选项，都有一个颜色和一个图标，与界面中一样。智能体通过提议来选择它们：

- `propose_create_table` 接受用于数据表的 `color` 和 `icon`；
- `propose_add_field` 接受 `select` 或 `multi_select` 每个选项上的 `color` 和 `icon`；
- `propose_update_look` 用于修改现有数据表及其选项的颜色和图标：省略某个键则保留现有值，`null` 则将其清除。

`color` 是形如 `#rrggbb` 的颜色。`icon` 是界面所绘制的 [Lucide](https://lucide.dev/icons/) 图标之一的名称——`truck`、`circle-check`、`flame`……：工具的参数结构中列出了全部名称，未知的名称会被拒绝。`describe_base` 和 `describe_table` 会返回当前的外观。字段则没有图标可选：界面会绘制其类型对应的图标。

## 删除行

拥有 **读写和删除** 权限的令牌，可让智能体按 `_id` **一次删除一行**。`delete_record` 会返回删除前的那一行内容，该删除操作会以该令牌的名义记录到历史中；`restore_record` 则按其 `_id` 将该行恢复回来——智能体可以自行撤销自己的失误，一个人也同样可以从历史记录中这样做。

智能体不会在以下情况下删除：

- 令牌是只读，或读写权限：拒绝信息会说明应创建哪种令牌；
- 该行会被级联关联连带删除其他行（`TOKEN_CASCADE_FORBIDDEN`）：这类删除只能在界面中进行，由能看清牵连范围的人来执行；
- 一次删除多行：没有任何工具能做到这一点。

## 智能体不能做什么

- **它只在获得您同意时才删除**：需要专门为此创建的令牌，且每次只删除一行。
- **它不修改结构**——也不修改外观：只能提议。提议会在**智能体提议…**（数据库菜单）中等待，由管理结构的人批准或拒绝；如无决定，提议会在 24 小时后过期。
- **它的权限永远不会超过**创建其令牌的人：令牌的权限会逐个环境地与此人的权限取交集。
- 它看不到被标记为对智能体不可见的字段，也看不到对 MCP 关闭的数据库。

每次调用都只按其参数的结构记录日志，从不记录参数的值。

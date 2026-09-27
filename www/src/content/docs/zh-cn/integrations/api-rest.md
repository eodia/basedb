---
title: REST API
description: 通过程序读取和写入 basedb 中的行。
---

REST API 与界面使用的 API 完全相同：**不存在私有路由**。它的 URL 使用物理名称——也就是您在 SQL 中读到的名称。

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## 令牌

在界面中，打开数据库的 **⋯** 菜单 → **API 与智能体** → **API 和 MCP 令牌…**：在确认密码后，即可在这里创建一个仅限于该数据库的**集成令牌**，默认只读。令牌只显示一次；请将其保存在环境变量中。

以写入权限创建的令牌可以读取、创建和修改，但**从不删除**，并且其权限永远不会超过创建它的人。

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## 读取

| 参数 | 作用 |
|---|---|
| `filter` | 一个易读的表达式：`statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | 要返回的列 |
| `limit`、`cursor` | 使用加密游标分页（响应中的 `next_cursor`） |
| `links=display` | 返回关联及其显示值 |
| `count=exact` | 返回总数，上限为 100000 |
| `variables=raw` | 按原样返回长文本，包括 `{{colonne}}`，而不是代入[该行的值](/basedb/zh-cn/fonctionnalites/tables-et-champs/#富文本与变量) |

运算符：`eq`、`ne`、`eq_ci`、`contains`、`starts_with`、`ends_with`、`in`、`is_null`、`gt`、`gte`、`lt`、`lte`、`between`，可用 `and`、`or`、`not` 和括号组合。筛选条件可以穿过关联：`clients_id.ville eq "Lyon"`。

## 写入

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` 使用相同的请求体 `{"values": {…}}` 修改一行。错误采用统一格式：`{ "code": "…", "details": {…}, "request_id": "…" }`，每种原因对应一个稳定的错误代码。

每次写入都会返回 `x-basedb-transaction` 响应头：将其传给 `POST /api/v1/<tenant>/history/undo`（`{"transaction": "…"}`）即可撤销该写入，与界面中的 Ctrl+Z 一样——如果该行此后已被修改，撤销会被拒绝。

## 行之外

使用同一个令牌：

| 路由 | 作用 |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | 对筛选结果中所有行进行统计：`aggregates=montant:sum,nom:filled`、`group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`、`POST` | 读取和写入某一行的评论 |
| `POST /api/v1/<tenant>/automations/<id>/run` | 在某一行上（`{"record": "…"}`）运行由按钮触发的自动化 |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | 数据库的仪表盘 |
| `GET /api/v1/<tenant>/meta/users` | 工作区成员，用于人员字段 |
| `GET /api/v1/<tenant>/meta/templates` | 模板库中的数据库模板 |

[共享视图](/basedb/zh-cn/fonctionnalites/vues-partagees/)无需账户即可读取：`GET /api/v1/views/<jeton>` 和 `…/rows` 返回 JSON，`…/calendar.ics` 返回 iCalendar。

构建类操作——创建自动化、仪表盘、集成——仍仅限于界面会话：令牌只能读写行，不能修改数据库本身。

## 自动生成的文档

每个数据库都有自己的 **API 与 MCP 文档**页面：针对每张数据表，列出其端点、列，以及 cURL 和 JavaScript 示例。该文档**按您的权限过滤**——两位读者会得到两个不同的版本——并以**您屏幕所使用的语言**编写，同时还提供 OpenAPI 3.1 格式（`/api/v1/<tenant>/meta/bases/<base>/openapi.json`）。名称、路径和错误代码在所有语言中保持不变。

![数据库的自动生成文档](../../../../assets/screens/documentation-api.png)

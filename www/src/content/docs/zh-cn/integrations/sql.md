---
title: 直接使用 SQL
description: 使用 psql、BI 工具或脚本读写 basedb 的数据表。
---

这正是 basedb 存在的意义：**您的数据表就是真正的数据表**。任何 PostgreSQL 客户端都可以按名称读取它们。

## 名称

| 对象 | 物理名称 | 示例 |
|---|---|---|
| 数据库 | 模式（schema）`b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| 预发布环境 | 加上后缀的模式 | `b_t4z56fq_ventes_recette` |
| 数据表 | slug 化后的名称 | `opportunites` |
| 字段 | slug 化后的名称 | `echeance` |
| 关联 | `<table cible>_id` | `clients_id` |
| [SQL 视图](/basedb/zh-cn/fonctionnalites/requetes-et-vues-sql/) | 其技术名称，位于数据库的模式中 | `factures_a_encaisser` |

每个数据库的 **API 与 MCP 文档**页面会列出所有名称，`psql` 中的 `\d` 会显示描述（`COMMENT ON`）。

## 在界面中

标签栏中的 **+**，或数据库的 **⋯** 菜单 → **SQL 查询**：一个带语法高亮和自动补全的编辑器，结果显示在与数据表相同的网格中。

![一个已保存的查询，以及两个与数据表并列的 SQL 视图](../../../../assets/screens/requete-sql.png)

- **每个人都以自己的权限读取**：可管理级别可访问整个数据库，包括写入；其他成员编写的 SQL 为只读，对其不开放的数据表并不存在，隐藏的字段会消失。
- 查询可以**保存**在数据表下方——供自己、整个数据库或指定用户组使用——如有需要，还可以变为 **SQL 视图**：一个真正的 PostgreSQL 视图，与数据表并列，并可从 `psql` 读取。

详见[查询与 SQL 视图](/basedb/zh-cn/fonctionnalites/requetes-et-vues-sql/)。

## 通过 psql

使用随附的 `docker-compose.yml` 时，PostgreSQL 发布在 `127.0.0.1:5432` 上：

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## 用 SQL 写入

这是允许的。约束（单选、关联、链接、必填）由 PostgreSQL 维护，会像在界面中一样拒绝无效值。而且写入会**记入历史**：历史记录将其显示为“直接 SQL 会话”，并附上执行它的会话；它也可以像其他写入一样被撤销。

:::caution
用 SQL 修改**结构**（`ALTER TABLE`）会绕过 basedb 的目录（catalog），目录将无从知晓这些变更。请通过界面、API 或智能体提议进行修改：迁移引擎会制定计划、只短暂加锁，并保持目录准确。
:::

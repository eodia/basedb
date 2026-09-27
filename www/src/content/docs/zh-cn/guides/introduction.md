---
title: 简介
description: basedb 是什么，以及它与协作式电子表格有何不同。
---

**basedb** 是一款协作式数据库，秉承协作式电子表格的理念，由您自行托管——但有一点不同，并决定了其余的一切：**您的数据存放在真正的 PostgreSQL 数据表中**，类型明确，名称清晰可读。

![basedb 中一张数据表的网格](../../../../assets/screens/grille.png)

## 一个简单的承诺

没有通用数据模型，没有包罗万象的 `JSONB`，也没有 `field_1837`：

| 在 basedb 中 | 在 PostgreSQL 中 |
|---|---|
| 数据库“Ventes” | 模式（schema）`b_t4z56fq_ventes` |
| 数据表“Opportunités” | 数据表 `opportunites` |
| 字段“Échéance”（日期） | 列 `echeance date` |
| 单选字段“Statut” | 一个 `text` 列及其 `CHECK` 约束 |
| 关联字段“Client” | 一个 `clients_id uuid` 列及其 `FOREIGN KEY` |

因此，您可以打开 `psql`、BI 工具或 Python 脚本，不经过产品直接读取数据——甚至写入数据：约束依然有效，历史记录也会记下这次写入。

## 适合谁？

- **业务团队**：想要网格、视图和表单，而不必等待开发。
- **技术团队**：不愿数据被锁在专有格式中，希望接入惯用的工具。
- **AI 智能体**：这里有 MCP 服务器、清晰的权限，以及交由人工审核的提议。

## 您会找到什么

- 有类型的[数据表和字段](/basedb/zh-cn/fonctionnalites/tables-et-champs/)，关联就是真正的外键（也可以是多项关联），公式由 PostgreSQL 计算，还有跨关联的查找引用和汇总。
- 八种[视图](/basedb/zh-cn/fonctionnalites/vues/)：网格、看板、日历、时间线、画廊、列表、表单、问卷——可以是协作视图，也可以是个人视图。
- 通过链接共享的[表单](/basedb/zh-cn/fonctionnalites/formulaires-partages/)和[视图](/basedb/zh-cn/fonctionnalites/vues-partagees/)，以及可在日历应用中订阅的日历。
- [协作](/basedb/zh-cn/fonctionnalites/collaboration/)：评论与提及、通知、实时更新。
- [自动化](/basedb/zh-cn/fonctionnalites/automatisations/)、[仪表盘](/basedb/zh-cn/fonctionnalites/tableaux-de-bord/)及其问题，用鼠标或 SQL 构建。
- [人人可用的 SQL](/basedb/zh-cn/fonctionnalites/requetes-et-vues-sql/)，每个人都以自己的权限执行：保存在数据表下方的已保存查询，以及与数据表并列的真正 PostgreSQL 视图。
- [数据库模板](/basedb/zh-cn/fonctionnalites/modeles/)，可从模板库中选用，也可以让 AI 生成。
- [环境](/basedb/zh-cn/fonctionnalites/environnements/)——生产、预发布——可以相互比较和迁移。
- 每一次写入的[历史记录](/basedb/zh-cn/fonctionnalites/historique/)，直接 SQL 写入也包括在内，并可按 Ctrl+Z 撤销。
- 按用户组分配的[权限](/basedb/zh-cn/fonctionnalites/droits/)，可细化到字段。
- [REST API](/basedb/zh-cn/integrations/api-rest/)、[MCP 服务器](/basedb/zh-cn/integrations/mcp/)、[Webhook](/basedb/zh-cn/integrations/webhooks/)、Slack 以及[同步数据表](/basedb/zh-cn/integrations/synchronisation/)。
- 可选的 [AI](/basedb/zh-cn/fonctionnalites/ia/) 功能：由模型计算的字段、Copilot。

## 项目状态

basedb 是自由软件（AGPL-3.0），由 AI 原生软件工作室 [Eodia](https://eodia.com/fr/) 开发，目前处于积极开发阶段。内核、API、MCP 服务器和界面均已可用，并由一千多项测试覆盖；[路线图](/basedb/zh-cn/feuille-de-route/)列出了尚待完成的工作。它的[架构文档](https://github.com/eodia/basedb/tree/main/docs/architecture)约有二十个章节，记录了每一项决策。

:::tip[试一试]
克隆仓库后，只需一条命令：`docker compose up -d`。参见[安装](/basedb/zh-cn/guides/installation/)。
:::

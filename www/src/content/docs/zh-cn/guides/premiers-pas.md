---
title: 快速上手
description: 创建数据库、数据表、字段、视图和表单。
---

本教程只需十分钟，涵盖最基本的内容：完成后，您将拥有一张数据表、一个看板视图，以及一个可向其中写入数据的公开表单。

:::tip[一次看遍所有功能]
空项目中会提供**演示数据库**：一家小型代理公司，包括它的客户、项目、任务、发票和评价，并附有公式、各类视图、一个仪表盘和若干自动化。**新建数据库**也会打开[模板库](/basedb/zh-cn/fonctionnalites/modeles/)，您可以在其中向 AI 描述想要的数据库。
:::

## 1. 创建数据库

一切都按**项目**组织：侧边栏顶部的选择器用于切换或新建项目。在侧边栏中，筛选框右侧的 **+** 用于新建数据库。为它设置一个显示名称——“Ventes”——还可以根据需要添加描述、颜色和图标。

该数据库会成为一个 **PostgreSQL 模式（schema）**：它的物理名称（`b_t4z56fq_ventes`）会显示在表单和自动生成的文档中。

## 2. 创建数据表及其字段

在数据库的 **⋯** 菜单中选择**新建数据表**。然后通过同一菜单中的**结构**，使用其中的**字段**按钮添加字段：

| 字段 | 类型 |
|---|---|
| Nom | 短文本 |
| Statut | 单选——Nouveau、Qualifié、Gagné、Perdu |
| Montant | 货币 |
| Échéance | 日期 |
| Client | 关联 → Clients |
| Notes | 长文本（Markdown） |

之后，公式（`JOURS([Échéance]; AUJOURDHUI())`）、查找引用（客户所在城市）或汇总（每个客户的总金额）也以同样的方式添加——参见[数据表和字段](/basedb/zh-cn/fonctionnalites/tables-et-champs/)。

您也可以**导入** CSV 或 JSON 文件：导入功能会推测各列类型并允许您修改，然后创建数据表或向已有数据表追加数据，并逐行说明哪些数据被拒绝。

![数据库菜单](../../../../assets/screens/menu-base.png)

## 3. 录入与筛选

网格的编辑方式与电子表格相同：双击或按 Enter 编辑单元格，按 Esc 取消。**筛选**可按字段组合多个条件；排序通过列标题完成；**搜索…**（位于工具栏右侧）会在所有列中查找。每次修改都会立即保存，并记入[历史记录](/basedb/zh-cn/fonctionnalites/historique/)：按 **Ctrl+Z** 可撤销最近一次修改。

## 4. 添加视图

视图选择器位于“筛选”左侧，先列出“所有行”，然后是您的视图。创建一个按“Statut”分组的**看板**：将卡片从一列拖到另一列即可修改该行。

![按状态分组的看板](../../../../assets/screens/kanban.png)

## 5. 共享表单

创建一个**表单**视图，勾选要包含的问题，然后点击**共享**：选择“公开”，复制链接。每份回复都会在数据表中新增一行，而不会给回复者任何权限。详见[共享表单](/basedb/zh-cn/fonctionnalites/formulaires-partages/)。

## 6. 用 SQL 读取

数据库的 **⋯** 菜单 → **新建 SQL 查询**：您的数据表都在这里，使用的是它们的真实名称。

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**保存**会将查询放在数据表下方的“查询”分组中——仅供您自己使用，或供整个数据库使用；通过 **⋯** → **创建 SQL 视图…**，可将其变为一个真正的 PostgreSQL 视图，与数据表并列。每个人都以自己的权限读取它们。参见[查询与 SQL 视图](/basedb/zh-cn/fonctionnalites/requetes-et-vues-sql/)。

在 `psql` 或您的 BI 工具中也是如此。参见[直接使用 SQL](/basedb/zh-cn/integrations/sql/)。

---
title: 安装
description: 使用 Docker Compose 安装 basedb，或启动开发环境。
---

basedb 只需**一个 Docker 镜像**：[`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)（amd64 和 arm64），其中包含**界面**、**API** 和 **MCP 服务器**，通过同一个地址提供服务。它需要一个 **PostgreSQL 16** 数据库，`docker-compose.yml` 已提供。

## 使用 Docker Compose（推荐）

前提条件：Docker 及 Compose v2。只需两个文件，无需源代码：

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

打开 `.env`，填写仅有的两个必填值：

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# 只需生成一次，长期使用：openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

然后启动：

```bash
docker compose up -d
```

首次启动时，basedb 会创建其目录（catalog）。随后打开 [http://localhost:3000](http://localhost:3000)：第一个页面会请您**创建管理员账户**，填写您的姓名、邮箱地址和自选的密码，完成后即自动登录。

:::caution[首次访问会创建管理员]
只要还没有管理员，第一个打开界面的人就会创建它。请在让他人能够访问该实例**之前**先创建管理员——无论是通过域名访问，还是通过发布在所有网络接口上的端口访问。
:::

如需无人值守安装，可在 `.env` 中用 `BASEDB_ADMIN_EMAIL` 指定管理员：basedb 会在首次启动时创建该账户，并在日志（`docker compose logs basedb`）中**仅显示一次**其密码，除非您用 `BASEDB_ADMIN_PASSWORD` 自行设定。

| 地址 | 用途 |
|---|---|
| http://localhost:3000 | 界面 |
| http://localhost:3000/api | REST API 及其文档 |
| http://localhost:3000/mcp | MCP 服务器，供智能体使用 |
| localhost:5432 | PostgreSQL，供 `psql` 和您的工具使用 |

端口仅发布在 `127.0.0.1` 上。如需通过域名提供 basedb，请参见[域名与 HTTPS](/basedb/zh-cn/hebergement/https/)。

## 使用您自己的 PostgreSQL

只需镜像本身，再加一个 PostgreSQL 16 或更高版本的数据库（使用该数据库的所有者角色，并且 `pg_trgm` 和 `unaccent` 扩展可用）：

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

请保存生成的密钥：参见下方提示框。

:::caution[实例密钥]
`BASEDB_ENCRYPTION_KEY` 用于签名会话，并加密已保存的机密信息（AI 密钥、Webhook 密钥、自动化保密标头、表单链接）。更改它会让所有人退出登录，并使这些机密信息无法读取。请只生成一次，并与数据库一起备份。
:::

## 开发

前提条件：Node 22 或更高版本、Docker，以及 `corepack enable`。

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` 会选择空闲端口，启动一个临时的 PostgreSQL 16，应用目录，初始化一个开发用管理员（`admin@basedb.local` / `developpement-basedb`，登录时已预填邮箱地址），然后以开发模式启动 API、MCP 服务器和界面。按 `Ctrl+C` 会停止全部服务，包括容器。

## 接下来

- [快速上手](/basedb/zh-cn/guides/premiers-pas/)：一个数据库、一张数据表、一个视图、一个表单。
- [环境变量](/basedb/zh-cn/hebergement/variables/)：文件、AI、地址。

---
title: 环境变量
description: basedb 读取的所有变量及其默认值。
---

所有变量都放在 `.env` 文件中，该文件与 `docker-compose.yml` 位于同一目录，由 `docker compose` 读取（完整且带注释的模板为 `.env.example`）。使用 `docker run` 时，通过 `-e` 传入。**空值等同于“未设置”。**

## 必填

| 变量 | 作用 |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL 容器的密码 |
| `BASEDB_ENCRYPTION_KEY` | 实例密钥：签名会话、加密机密信息。使用 `openssl rand -base64 32` 生成一次，长期使用 |

## 数据库

| 变量 | 默认值 | 作用 |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL 角色 |
| `POSTGRES_DB` | `basedb` | PostgreSQL 数据库 |
| `POSTGRES_PORT` | `5432` | 发布在 127.0.0.1 上的端口 |
| `DATABASE_URL` | `db` 容器 | 您自己的 PostgreSQL 16+ 数据库 |

## 首次启动

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | 在空数据库上应用目录（catalog） |
| `BASEDB_BOOTSTRAP` | `1` | 准备第一个管理员 |
| `BASEDB_TENANT` | `t4z56fq` | 租户标识，出现在 API 的 URL 中 |
| `BASEDB_ADMIN_EMAIL` | — | 第一个管理员的邮箱地址，在启动时创建；留空时，由第一个打开界面的人创建 |
| `BASEDB_ADMIN_PASSWORD` | 自动生成，只显示一次 | 与 `BASEDB_ADMIN_EMAIL` 配合使用的密码；一旦设置，**每次**启动时都会重新应用到管理员账户：登录后请将其删除 |

## 使用 Google、Microsoft 等登录（OIDC）

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | 提供的身份提供商，以逗号分隔：`google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`、`_CLIENT_SECRET` | — | 在身份提供商处注册的应用 |
| `BASEDB_OIDC_<NOM>_ISSUER` | `google`、`gitlab` 自带 | OpenID Connect 颁发者 |
| `BASEDB_OIDC_<NOM>_LABEL`、`_SCOPES` | 取决于身份提供商 | 按钮名称、请求的权限范围 |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`：首次登录不会创建账户 |

参见[账户与登录](/basedb/zh-cn/hebergement/connexion/)。

## 地址

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_PORT` | `3000` | 发布在 127.0.0.1 上的端口：界面、`/api` 和 `/mcp` |
| `BASEDB_VERSION` | `latest` | `eodia/basedb` 镜像的标签 |
| `BASEDB_PUBLIC_URL` | — | basedb 的公开地址，用于 OIDC 回调 |
| `BASEDB_DOMAIN` | — | 由 Caddy 代理以 HTTPS 提供服务的域名 |
| `BASEDB_ORIGINS` | — | 其页面会从浏览器调用 API 的其他网站，以逗号分隔；basedb 自身的界面位于同一地址，无需设置 |
| `BASEDB_API`、`BASEDB_MCP` | `/`、`/mcp` | 浏览器所见的 API 和 MCP 地址；仅需为开发环境（`pnpm start`）设置 |

## 文件

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | 单个文件的最大大小 |
| `BASEDB_S3_BUCKET` | — | 启用 S3 存储 |
| `BASEDB_S3_ENDPOINT` | — | S3 端点 |
| `BASEDB_S3_REGION` | `us-east-1` | 区域 |
| `BASEDB_S3_ACCESS_KEY_ID`、`BASEDB_S3_SECRET_ACCESS_KEY` | — | 凭据 |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | 设为 `0` 则使用基于主机名的寻址 |

## 数据库模板

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | 公开网站的模板目录 | 实例从何处读取其模板库中的模板；设为 `off` 则不读取任何目录（内置模板仍然可用）——参见[模板](/basedb/zh-cn/fonctionnalites/modeles/) |

## 人工智能

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`、`anthropic` 或 `mistral` |
| `BASEDB_AI_MODEL` | — | 模型 |
| `BASEDB_AI_API_KEY` | — | 密钥（否则使用 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`MISTRAL_API_KEY`） |
| `BASEDB_AI_QUOTA` | `120` | 每个租户每小时的交互式调用次数 |
| `BASEDB_AI_FIELD_QUOTA` | `300` | 每个租户每小时的 AI 字段计算次数 |
| `BASEDB_AI_WORKER` | `1` | `0`：此进程中不执行后台计算 |

## 仅用于开发

| 变量 | 作用 |
|---|---|
| `BASEDB_DEV_MAIL=1` | 在日志中显示电子邮件，而不是发送 |
| `BASEDB_WEBHOOK_DEV=1` | 允许 Webhook 发往 HTTP 和本地地址 |

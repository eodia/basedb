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
| `BASEDB_BASE_PATH` | `BASEDB_PUBLIC_URL` 的路径部分 | basedb 在网关之后所使用的路径，`https://passerelle.example.com/basedb/` 对应 `/basedb`；参见[Docker Compose](/basedb/zh-cn/hebergement/docker/#位于网关之后路径之下) |
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

## 邮件

没有发送服务器时，basedb 不会发送任何邮件。有了它，以下内容才会发出：保持**十分钟未读**的通知（每个人在**设置 › 通知**中选择要接收哪些），自动化中**发送邮件**步骤发出的邮件，以及**忘记密码**的链接。链接指向 `BASEDB_PUBLIC_URL`；没有设置它时，邮件中就不会带链接。

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | SMTP 服务器：您邮箱服务商的，或某个发送服务的 |
| `BASEDB_SMTP_PORT` | `587` | 使用 `465` 可直接建立加密连接 |
| `BASEDB_SMTP_SECURE` | `starttls`（端口 465 时为 `tls`） | 只有同一台机器上的中继才使用 `none`：否则密码会以明文传输 |
| `BASEDB_SMTP_USER`、`BASEDB_SMTP_PASSWORD` | — | 发送账户的凭据，如果它需要的话 |
| `BASEDB_MAIL_FROM` | — | 使用 `BASEDB_SMTP_HOST` 时必填：发件人地址，如 `basedb <no-reply@exemple.fr>` |

启动时，日志会说明具体情况：`Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` 服务器拒绝的邮件会在 1、5、30、120，然后 360 分钟后重试。

## 地图和地址

**地图**视图借助地理编码服务来定位地址：默认使用 OpenStreetMap（Nominatim）的服务，每个地址查询一次，最多每秒一次请求，每个结果都会被缓存。底图由每位读者的浏览器直接从**切片**服务器加载。

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | 另一个使用相同协议的服务（您自己的 Nominatim）；`off`：不使用任何服务，地址不会离开实例，只用纬度和经度来定位行 |
| `BASEDB_MAP_TILES` | OpenStreetMap 的切片 | 另一个切片服务器，格式为 `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | 该服务器要求显示的署名，位于地图右下角 |

启动时，日志会说明使用的是哪个服务：`Géocodage : https://nominatim.openstreetmap.org.`

## PDF 文档

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_PDF_FONTS` | 镜像自带的 Noto 字体 | 挂载到容器中的您自己的文件夹，其中包含 `NotoSans-Regular.ttf`、`-Bold`、`-Italic`、`-BoldItalic`，以及供中文、日文和韩文使用的 `NotoSansCJK-Regular.ttc` 和 `-Bold.ttc` |

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

## 发往内部网络的 Webhook

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | 您的内部服务器，以逗号分隔：一个名称（`chat.intra.example.com`）、一个域名及其子域名（`*.intra.example.com`）、一个地址或一个地址段（`10.12.0.0/16`） |

Webhook、自动化发出的 HTTP 请求以及同步数据表，都只会发往公开的 HTTPS 地址。列表中的目标会被
额外接受，无论其地址、端口和协议如何——包括 HTTP。无法识别的条目会阻止启动。参见
[Webhook](/basedb/zh-cn/integrations/webhooks/#目标地址)。

## 公开演示

一个面向所有人开放的实例，例如 [demo.basedb.eodia.com](https://demo.basedb.eodia.com)：登录界面会预填一个共享账户，访问者可以查看一切并修改已有内容，但不能创建或删除任何东西——数据库、数据表、行、文件、评论、账户、令牌、链接皆不可创建或删除——AI 会回答说自己不参与演示。SQL 控制台在这里只能读取。每天夜里把数据库恢复原状仍由您自己负责。

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BASEDB_DEMO` | — | `1`：将实例变为公开演示 |
| `BASEDB_DEMO_ACCOUNTS` | — | 每种语言一个账户，以逗号分隔：`fr=demo@demo.com,en=demo-en@demo.com`；登录界面会预填与其语言匹配的账户，否则用英语账户，再否则用第一个账户，并提供其余账户可选。请在启用演示之前创建好这些账户，并各自配上项目：演示会拒绝所有人的创建操作，包括管理员 |
| `BASEDB_DEMO_PASSWORD` | — | 配合 `BASEDB_DEMO_ACCOUNTS` 使用，这些账户共用的密码，与账户一同公开 |

如果没有设置 `BASEDB_DEMO_ACCOUNTS`，共享账户就是由 `BASEDB_ADMIN_EMAIL` 和 `BASEDB_ADMIN_PASSWORD` 指定的管理员。演示账户的任何地址都会用公开的密码登录，无论输入了什么；错误的尝试不会把它对所有人锁死。

## 仅用于开发

| 变量 | 作用 |
|---|---|
| `BASEDB_DEV_MAIL=1` | 在日志中显示电子邮件，而不是发送 |
| `BASEDB_WEBHOOK_DEV=1` | 允许 Webhook 发往 HTTP 和本地地址 |

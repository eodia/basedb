---
title: 账户与登录
description: 谁可以创建账户，以及如何使用 Google、Microsoft 或企业 SSO 登录。
---

## 首次登录

在新实例上，第一个页面会创建**管理员账户**：您的姓名、邮箱地址和自选的密码。请在让他人能够访问该实例之前先创建它——无论是通过域名访问，还是通过发布在所有网络接口上的端口访问。

## 账户注册

默认情况下，任何能访问该实例的人都可以**创建自己的账户**，然后创建自己的项目。他们看不到其他任何内容：其他人的项目要通过**邀请**才能加入。

在**管理后台 → 用户**中，“账户注册”卡片可以：

- 关闭账户注册：此时只有受邀者才能创建账户；
- 或将其限定于某些域名——`exemple.fr, autre.fr` 只允许这些域名的地址注册。

## 邀请加入项目或数据库

拥有项目或数据库**可管理**级别的人可以共享它：项目（或数据库）菜单 → **共享…**，填写一个邮箱地址，选择一个级别——可查看、可编辑或可管理。basedb 会生成一个有效期为 7 天的**邀请链接**，您可以用任何方式将其发送给对方：对方打开链接后即可登录或创建账户。同一界面还会显示谁拥有访问权限，可以更改或撤销其级别，并保留待处理的链接以便重新发送。

管理者授予的权限永远不会超过其所管理的范围：数据库的管理者可以共享该数据库，但不能共享其所属的项目。

## 使用 Google、Microsoft 等登录

basedb 支持 **OpenID Connect**：Google、Microsoft Entra ID、GitLab、Keycloak、Authentik、Okta…… 每个已配置的身份提供商都会在登录、注册和邀请界面上添加一个“使用 … 继续”按钮。

1. 在 `.env` 中设置 basedb 的公开地址：

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. 在身份提供商处创建一个 Web 应用；其**回调地址**为 `https://basedb.example.com/auth/oidc/<nom>/callback`，其中 `<nom>` 是您在下面为它指定的名称（`google`、`microsoft`……）。

3. 在 `.env` 中声明它：

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. 运行 `docker compose up -d`：启动时，basedb 会列出已启用的身份提供商，并说明被忽略的那些还缺少什么。

| 变量（针对身份提供商 `<NOM>`） | 作用 |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`、`_CLIENT_SECRET` | 在身份提供商处注册的应用 |
| `BASEDB_OIDC_<NOM>_ISSUER` | 颁发者；`google` 和 `gitlab` 无需设置 |
| `BASEDB_OIDC_<NOM>_LABEL` | 按钮上的名称——默认为 `Google`、`Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | 默认为 `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`：只允许已有账户登录 |

**首次登录会创建账户**，前提是账户注册设置允许：注册开放时即可创建；限定于某些域名时，只允许这些域名的地址。已被密码账户使用的邮箱地址绝不会被接管：其所有者需使用密码登录。机密信息保存在环境变量中：不会有任何内容写入数据库。

:::note
GitHub 不是 OpenID Connect 身份提供商：无法在此使用。
:::

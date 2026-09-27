---
title: Docker Compose
description: 镜像、服务、卷以及日常运维。
---

basedb 以**单个镜像** [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb) 发布，支持 amd64 和 arm64。仓库中的 `docker-compose.yml` 将它与 PostgreSQL 组合在一起。所有配置都通过 `.env` 文件完成（参见[环境变量](/basedb/zh-cn/hebergement/variables/)）。

## 镜像

镜像包含 basedb 的三个进程，并通过**同一个端口 3000** 提供服务：

| 路径 | 进程 |
|---|---|
| `/api/*`、`/auth/*`、`/healthz` | REST API、登录、后台任务 |
| `/mcp` | MCP 服务器，供智能体使用 |
| 其余所有路径——`/`、`/f/…`、`/v/…` | 界面 |

启动时，API 最先启动：在空数据库上，它会应用目录（catalog）并创建第一个管理员；之后再启动时，这两步都不会产生任何作用。API 一旦响应，MCP 服务器就会启动。如果任一进程停止，整个容器都会停止，并由重启策略整体重新启动。

镜像以 `node` 用户在 Node 22 上运行，声明了健康检查（`/healthz`）和一个卷 `/data`，用于存放文件和图片字段的文件。

| 标签 | 内容 |
|---|---|
| `latest` | 最新发布的版本 |
| `0.3` | 最新的 0.3.x 版本 |
| `0.3.0` | 恰好是这个版本 |

## 服务

| 服务 | 镜像 | 端口（在 127.0.0.1 上） | 卷 |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy`（可选） | `caddy:2-alpine` | 80、443 | `caddy-data`、`caddy-config` |

## 常用命令

```bash
docker compose up -d                # 下载镜像并启动
docker compose logs -f basedb       # 跟踪 basedb 日志（首次启动时会显示管理员密码）
docker compose ps                   # 查看服务状态与健康状况
docker compose restart basedb       # 重启 basedb
docker compose down                 # 停止（卷会保留）
```

在仓库的克隆目录中运行 `docker compose up -d --build`，会从源代码构建镜像，而不是下载镜像。

## 修改端口

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## 使用现有的 PostgreSQL 数据库

设置 `DATABASE_URL`：basedb 会连接到该数据库，而不是 `db` 容器（该容器仍会启动，但不会被使用——如果您愿意，可以在 `docker-compose.override.yml` 文件中将其移除）。需要 PostgreSQL 16 或更高版本、该数据库的所有者角色，以及可用的 `pg_trgm` 和 `unaccent` 扩展。此时只需镜像本身即可——参见[安装](/basedb/zh-cn/guides/installation/)。

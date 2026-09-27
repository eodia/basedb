---
title: 域名与 HTTPS
description: 在随附的 Caddy 代理之后，通过域名以 HTTPS 提供 basedb。
---

在生产环境中，basedb 必须通过 **HTTPS** 提供服务：它的会话 Cookie 带有 `Secure` 标记和 `__Host-` 前缀，浏览器只有在 `localhost` 上才会通过 HTTP 接受它们。

镜像已经在同一个地址上提供所有服务——界面、`/api` 下的 API、`/mcp` 下的 MCP 服务器。剩下要做的只是将其置于 HTTPS 代理之后：`docker-compose.yml` 提供了一个代理 **Caddy**，它会自动获取并续期 Let’s Encrypt 证书。

## 配置步骤

1. 将域名的 DNS 指向服务器；开放 80 和 443 端口。
2. 在 `.env` 中设置：

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. 使用 `https` 配置档（profile）启动：

   ```bash
   docker compose --profile https up -d
   ```

端口 3000 仍然只发布在 `127.0.0.1` 上：所有外部流量都经过 Caddy。

## 为什么需要这些变量

- `BASEDB_DOMAIN`：Caddy 为其申请证书的域名。
- `BASEDB_PUBLIC_URL`：OIDC 登录的回调地址，会与在身份提供商处登记的地址逐字符比对。
- Caddy 根据访问者的真实地址设置 `X-Forwarded-For`，当该请求头来自私有网络时，basedb 会采用它：这样，API 的速率限制（登录、共享表单）就会按访问者分别计算。

## 其他代理

Nginx、Traefik 或负载均衡器也同样适用：将该域名的**所有**流量转发到容器的 3000 端口，不要对响应进行缓冲（MCP 服务器和实时更新会以流式方式发送响应），并确保代理**替换** `X-Forwarded-For`，而不是在其后追加。

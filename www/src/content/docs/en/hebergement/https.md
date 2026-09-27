---
title: Domain and HTTPS
description: Serve basedb on a domain, over HTTPS, behind the bundled Caddy proxy.
---

In production, basedb must be served over **HTTPS**: its session cookies are `Secure` and
prefixed with `__Host-`, and a browser only accepts them over HTTP on `localhost`.

The image already serves everything on a single address — the interface, the API under `/api`,
the MCP server under `/mcp`. All that remains is to put it behind an HTTPS proxy: the
`docker-compose.yml` provides one, **Caddy**, which obtains and renews its Let’s Encrypt
certificate on its own.

## Setup

1. Point your domain’s DNS to the server; open ports 80 and 443.
2. In `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Start with the `https` profile:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 stays published on `127.0.0.1` only: all outside traffic goes through Caddy.

## Why these variables

- `BASEDB_DOMAIN`: the domain Caddy requests the certificate for.
- `BASEDB_PUBLIC_URL`: the redirect address of an OIDC sign-in, compared character by
  character with the one registered with the identity provider.
- Caddy sets `X-Forwarded-For` from the visitor’s real address, and basedb keeps it when it
  comes from a private network: the API’s rate limits (sign-in, shared forms) then count per
  visitor.

## Another proxy

Nginx, Traefik or a load balancer work too: send **all** of the domain’s traffic to the
container’s port 3000, without response buffering (the MCP server and real-time updates stream
their responses as they go), and make sure the proxy **replaces** `X-Forwarded-For` rather than
appending to it.

---
title: Domän och HTTPS
description: Servera basedb på en domän, över HTTPS, bakom den medföljande Caddy-proxyn.
---

I produktion måste basedb serveras över **HTTPS**: dess sessionscookies är `Secure` och har
prefixet `__Host-`, och en webbläsare accepterar dem över HTTP bara på `localhost`.

Avbildningen serverar redan allt på en enda adress – gränssnittet, API:et under `/api`,
MCP-servern under `/mcp`. Det enda som återstår är att placera den bakom en HTTPS-proxy:
`docker-compose.yml` tillhandahåller en, **Caddy**, som själv skaffar och förnyar sitt
Let’s Encrypt-certifikat.

## Konfiguration

1. Låt DNS för din domän peka på servern; öppna portarna 80 och 443.
2. I `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Starta med profilen `https`:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 förblir publicerad bara på `127.0.0.1`: all extern trafik går via Caddy.

## Varför de här variablerna

- `BASEDB_DOMAIN`: domänen som Caddy begär certifikatet för.
- `BASEDB_PUBLIC_URL`: återanropsadressen för en OIDC-inloggning, som jämförs tecken för tecken
  med den som registrerats hos identitetsleverantören.
- Caddy sätter `X-Forwarded-For` utifrån besökarens verkliga adress, och basedb behåller den när
  den kommer från ett privat nätverk: API:ets hastighetsbegränsningar (inloggning, delade
  formulär) räknas då per besökare.

## En annan proxy

Nginx, Traefik eller en lastbalanserare fungerar också: skicka **all** trafik för domänen till
containerns port 3000, utan buffring av svaren (MCP-servern och realtidsfunktionerna strömmar
sina svar löpande), och se till att proxyn **ersätter** `X-Forwarded-For` i stället för att
komplettera den.

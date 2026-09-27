---
title: Domæne og HTTPS
description: Servér basedb på et domæne, over HTTPS, bag den medfølgende Caddy-proxy.
---

I produktion skal basedb serveres over **HTTPS**: dets sessionscookies er `Secure` og har
præfikset `__Host-`, og en browser accepterer dem kun over HTTP på `localhost`.

Imaget serverer allerede alt på én adresse — brugerfladen, API'et under `/api`, MCP-serveren
under `/mcp`. Det eneste, der mangler, er at placere det bag en HTTPS-proxy: `docker-compose.yml`
leverer en, **Caddy**, som selv henter og fornyer sit Let’s Encrypt-certifikat.

## Opsætning

1. Lad dit domænes DNS pege på serveren; åbn portene 80 og 443.
2. I `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Start med profilen `https`:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 forbliver kun udgivet på `127.0.0.1`: al ekstern trafik går gennem Caddy.

## Hvorfor disse variabler

- `BASEDB_DOMAIN`: det domæne, som Caddy anmoder om certifikatet til.
- `BASEDB_PUBLIC_URL`: returadressen for et OIDC-login, som sammenlignes tegn for tegn med den,
  der er registreret hos identitetsudbyderen.
- Caddy sætter `X-Forwarded-For` ud fra den besøgendes reelle adresse, og basedb beholder den,
  når den kommer fra et privat netværk: API'ets hastighedsgrænser (login, delte formularer)
  tæller så pr. besøgende.

## En anden proxy

Nginx, Traefik eller en load balancer fungerer også: send **al** trafik for domænet til
containerens port 3000 uden buffering af svarene (MCP-serveren og realtidsfunktionerne streamer
deres svar løbende), og sørg for, at proxyen **erstatter** `X-Forwarded-For` i stedet for at
tilføje til den.

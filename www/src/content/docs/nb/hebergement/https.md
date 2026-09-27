---
title: Domene og HTTPS
description: Server basedb på et domene, over HTTPS, bak den medfølgende Caddy-proxyen.
---

I produksjon må basedb serveres over **HTTPS**: øktinformasjonskapslene er `Secure` og
har prefikset `__Host-`, og en nettleser godtar dem over HTTP bare på `localhost`.

Imaget serverer allerede alt på én enkelt adresse – grensesnittet, API-et under `/api`, MCP-serveren
under `/mcp`. Det eneste som gjenstår, er å plassere det bak en HTTPS-proxy: `docker-compose.yml`
leverer én, **Caddy**, som selv henter og fornyer Let’s Encrypt-sertifikatet sitt.

## Oppsett

1. La DNS for domenet ditt peke til serveren; åpne portene 80 og 443.
2. I `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Start med profilen `https`:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 forblir publisert bare på `127.0.0.1`: all ekstern trafikk går gjennom Caddy.

## Hvorfor disse variablene

- `BASEDB_DOMAIN`: domenet Caddy ber om sertifikat for.
- `BASEDB_PUBLIC_URL`: returadressen for en OIDC-innlogging, som sammenlignes tegn for
  tegn med den som er registrert hos identitetsleverandøren.
- Caddy setter `X-Forwarded-For` ut fra den besøkendes faktiske adresse, og basedb beholder den når
  den kommer fra et privat nettverk: API-ets hastighetsgrenser (innlogging, delte skjemaer)
  teller da per besøkende.

## En annen proxy

Nginx, Traefik eller en lastbalanserer passer også: send **all** trafikk for
domenet til port 3000 i containeren, uten bufring av svarene (MCP-serveren og
sanntidsfunksjonene strømmer svarene sine fortløpende), og sørg for at proxyen **erstatter**
`X-Forwarded-For` i stedet for å legge til i den.

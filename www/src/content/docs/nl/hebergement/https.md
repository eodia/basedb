---
title: Domein en HTTPS
description: basedb op een domein serveren, via HTTPS, achter de meegeleverde Caddy-proxy.
---

In productie moet basedb via **HTTPS** worden geserveerd: de sessiecookies zijn `Secure` en
hebben het voorvoegsel `__Host-`, en een browser accepteert ze via HTTP alleen op `localhost`.

De image serveert al alles op één adres — de interface, de API onder `/api`, de MCP-server
onder `/mcp`. Je hoeft haar alleen nog achter een HTTPS-proxy te zetten: het `docker-compose.yml`
levert er een, **Caddy**, die zelf zijn Let’s Encrypt-certificaat aanvraagt en vernieuwt.

## Inrichten

1. Laat de DNS van je domein naar de server wijzen; open de poorten 80 en 443.
2. In `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Start met het profiel `https`:

   ```bash
   docker compose --profile https up -d
   ```

Poort 3000 blijft alleen op `127.0.0.1` gepubliceerd: al het externe verkeer gaat via Caddy.

## Waarom deze variabelen

- `BASEDB_DOMAIN`: het domein waarvoor Caddy het certificaat aanvraagt.
- `BASEDB_PUBLIC_URL`: de redirect-URL van een OIDC-login, die teken voor
  teken wordt vergeleken met de URL die bij de identiteitsprovider is geregistreerd.
- Caddy zet `X-Forwarded-For` op basis van het echte adres van de bezoeker, en basedb behoudt die header als
  hij uit een privénetwerk komt: de rate limits van de API (inloggen, gedeelde formulieren)
  tellen dan per bezoeker.

## Een andere proxy

Nginx, Traefik of een load balancer zijn ook geschikt: stuur **al** het verkeer van het
domein naar poort 3000 van de container, zonder buffering van de antwoorden (de MCP-server en de
realtime-updates streamen hun antwoorden), en zorg dat de proxy `X-Forwarded-For` **vervangt**
in plaats van aanvult.

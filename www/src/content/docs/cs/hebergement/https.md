---
title: Doména a HTTPS
description: Provoz basedb na doméně přes HTTPS za dodávanou proxy Caddy.
---

V produkci musí být basedb obsluhován přes **HTTPS**: jeho cookies relace jsou `Secure`
a mají předponu `__Host-`, a prohlížeč je přes HTTP přijme jen na `localhost`.

Obraz už vše obsluhuje na jediné adrese – rozhraní, API pod `/api`, server MCP pod `/mcp`.
Zbývá ho jen umístit za proxy HTTPS: `docker-compose.yml` jednu dodává, **Caddy**, která si
sama získává a obnovuje certifikát Let’s Encrypt.

## Nastavení

1. Nasměrujte DNS své domény na server; otevřete porty 80 a 443.
2. V `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Spusťte s profilem `https`:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 zůstává publikován pouze na `127.0.0.1`: veškerý vnější provoz prochází přes Caddy.

## Proč tyto proměnné

- `BASEDB_DOMAIN`: doména, pro kterou Caddy žádá certifikát.
- `BASEDB_PUBLIC_URL`: návratová adresa přihlášení OIDC, porovnávaná znak po znaku s adresou
  registrovanou u poskytovatele identity.
- Caddy nastavuje `X-Forwarded-For` podle skutečné adresy návštěvníka a basedb tuto hlavičku
  zachová, když přichází z privátní sítě: limity rychlosti API (přihlášení, sdílené formuláře)
  se pak počítají pro každého návštěvníka zvlášť.

## Jiná proxy

Vyhoví také Nginx, Traefik nebo nástroj pro vyrovnávání zátěže: posílejte **veškerý** provoz
domény na port 3000 kontejneru, bez ukládání odpovědí do vyrovnávací paměti (server MCP
a aktualizace v reálném čase streamují své odpovědi průběžně), a zajistěte, aby proxy
`X-Forwarded-For` **nahrazovala**, a ne doplňovala.

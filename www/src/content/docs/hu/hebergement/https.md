---
title: Domain és HTTPS
description: A basedb kiszolgálása egy domainen, HTTPS-en, a mellékelt Caddy proxy mögött.
---

Éles használatban a basedb-t **HTTPS**-en kell kiszolgálni: a munkamenet-sütijei `Secure`
jelzésűek és `__Host-` előtaggal rendelkeznek, a böngésző pedig HTTP-n csak a `localhost` címen
fogadja el őket.

A lemezkép már mindent egyetlen címen szolgál ki – a felületet, az API-t a `/api`, az
MCP-szervert a `/mcp` útvonalon. Csak egy HTTPS-proxy mögé kell helyezni: a `docker-compose.yml`
biztosít is egyet, a **Caddyt**, amely maga szerzi be és újítja meg a Let’s Encrypt-tanúsítványát.

## Beállítás

1. Irányítsa a domainje DNS-ét a szerverre; nyissa meg a 80-as és a 443-as portot.
2. A `.env` fájlban:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Indítsa el a `https` profillal:

   ```bash
   docker compose --profile https up -d
   ```

A 3000-es port továbbra is csak a `127.0.0.1` címen van közzétéve: minden külső forgalom a
Caddyn halad át.

## Miért ezek a változók

- `BASEDB_DOMAIN`: az a domain, amelyhez a Caddy a tanúsítványt kéri.
- `BASEDB_PUBLIC_URL`: az OIDC-bejelentkezés visszatérési címe, amelyet a rendszer karakterről
  karakterre összevet az identitásszolgáltatónál regisztrált címmel.
- A Caddy a látogató valódi címe alapján állítja be az `X-Forwarded-For` fejlécet, a basedb
  pedig megtartja, ha az egy magánhálózatból érkezik: így az API sebességkorlátai
  (bejelentkezés, megosztott űrlapok) látogatónként számolnak.

## Másik proxy

Az Nginx, a Traefik vagy egy terheléselosztó is megfelel: a domain **teljes** forgalmát
irányítsa a konténer 3000-es portjára, a válaszok pufferelése nélkül (az MCP-szerver és a valós
idejű frissítések folyamatosan továbbítják a válaszaikat), és győződjön meg róla, hogy a proxy
**lecseréli** az `X-Forwarded-For` fejlécet, nem pedig kiegészíti.

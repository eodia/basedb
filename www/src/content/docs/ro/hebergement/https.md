---
title: Domeniu și HTTPS
description: Serviți basedb pe un domeniu, prin HTTPS, în spatele proxy-ului Caddy furnizat.
---

În producție, basedb trebuie servit prin **HTTPS**: cookie-urile sale de sesiune sunt `Secure`
și au prefixul `__Host-`, iar un browser le acceptă prin HTTP doar pe `localhost`.

Imaginea servește deja totul la o singură adresă — interfața, API-ul sub `/api`, serverul MCP
sub `/mcp`. Nu mai rămâne decât să o plasați în spatele unui proxy HTTPS: `docker-compose.yml`
furnizează unul, **Caddy**, care își obține și își reînnoiește singur certificatul
Let’s Encrypt.

## Configurare

1. Direcționați DNS-ul domeniului dumneavoastră către server; deschideți porturile 80 și 443.
2. În `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Porniți cu profilul `https`:

   ```bash
   docker compose --profile https up -d
   ```

Portul 3000 rămâne publicat doar pe `127.0.0.1`: tot traficul extern trece prin Caddy.

## De ce aceste variabile

- `BASEDB_DOMAIN`: domeniul pentru care Caddy cere certificatul.
- `BASEDB_PUBLIC_URL`: adresa de redirecționare a unei conectări OIDC, comparată caracter cu
  caracter cu cea înregistrată la furnizorul de identitate.
- Caddy setează `X-Forwarded-For` pe baza adresei reale a vizitatorului, iar basedb îl păstrează
  atunci când vine dintr-o rețea privată: limitele de debit ale API-ului (conectare, formulare
  partajate) se calculează atunci pe vizitator.

## Un alt proxy

Nginx, Traefik sau un echilibrator de sarcină sunt de asemenea potrivite: trimiteți **tot**
traficul domeniului către portul 3000 al containerului, fără stocarea în buffer a răspunsurilor
(serverul MCP și timpul real își transmit răspunsurile pe măsură ce sunt produse) și asigurați-vă
că proxy-ul **înlocuiește** `X-Forwarded-For` în loc să îl completeze.

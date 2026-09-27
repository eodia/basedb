---
title: Domena i HTTPS
description: Serwuj basedb w domenie, przez HTTPS, za dostarczonym proxy Caddy.
---

W środowisku produkcyjnym basedb musi być serwowany przez **HTTPS**: jego ciasteczka sesji są
`Secure` i mają prefiks `__Host-`, a przeglądarka akceptuje je przez HTTP tylko na
`localhost`.

Obraz już serwuje wszystko pod jednym adresem – interfejs, API pod `/api`, serwer MCP pod
`/mcp`. Pozostaje tylko umieścić go za proxy HTTPS: `docker-compose.yml` dostarcza takie proxy,
**Caddy**, które samo uzyskuje i odnawia certyfikat Let’s Encrypt.

## Konfiguracja

1. Skieruj DNS swojej domeny na serwer; otwórz porty 80 i 443.
2. W `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Uruchom z profilem `https`:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 pozostaje opublikowany tylko na `127.0.0.1`: cały ruch z zewnątrz przechodzi przez
Caddy.

## Po co te zmienne

- `BASEDB_DOMAIN`: domena, dla której Caddy żąda certyfikatu.
- `BASEDB_PUBLIC_URL`: adres zwrotny logowania OIDC, porównywany znak po znaku z adresem
  zarejestrowanym u dostawcy tożsamości.
- Caddy ustawia `X-Forwarded-For` na podstawie rzeczywistego adresu odwiedzającego, a basedb
  uwzględnia go, gdy pochodzi z sieci prywatnej: limity częstotliwości API (logowanie,
  formularze udostępnione) liczą się wtedy dla każdego odwiedzającego osobno.

## Inne proxy

Nginx, Traefik czy load balancer też się nadają: kieruj **cały** ruch domeny na port 3000
kontenera, bez buforowania odpowiedzi (serwer MCP i czas rzeczywisty przesyłają odpowiedzi
strumieniowo) i upewnij się, że proxy **zastępuje** `X-Forwarded-For`, zamiast go uzupełniać.

---
title: Dominio y HTTPS
description: Servir basedb en un dominio, en HTTPS, detrás del proxy Caddy incluido.
---

En producción, basedb debe servirse en **HTTPS**: sus cookies de sesión son `Secure` y llevan
el prefijo `__Host-`, y un navegador solo las acepta en HTTP en `localhost`.

La imagen ya lo sirve todo en una sola dirección: la interfaz, la API en `/api` y el servidor MCP
en `/mcp`. Solo queda colocarla detrás de un proxy HTTPS: el `docker-compose.yml` incluye
uno, **Caddy**, que obtiene y renueva por sí solo su certificado de Let’s Encrypt.

## Puesta en marcha

1. Haz que el DNS de tu dominio apunte al servidor; abre los puertos 80 y 443.
2. En `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Arranca con el perfil `https`:

   ```bash
   docker compose --profile https up -d
   ```

El puerto 3000 sigue publicado solo en `127.0.0.1`: todo el tráfico exterior pasa por Caddy.

## Por qué estas variables

- `BASEDB_DOMAIN`: el dominio para el que Caddy solicita el certificado.
- `BASEDB_PUBLIC_URL`: la dirección de retorno de un inicio de sesión OIDC, que se compara carácter por
  carácter con la registrada en el proveedor de identidad.
- Caddy establece `X-Forwarded-For` a partir de la dirección real del visitante, y basedb la tiene en cuenta cuando
  procede de una red privada: así, los límites de frecuencia de la API (inicio de sesión, formularios compartidos)
  cuentan por visitante.

## Otro proxy

Nginx, Traefik o un balanceador de carga también sirven: envía **todo** el tráfico del
dominio al puerto 3000 del contenedor, sin almacenar las respuestas en búfer (el servidor MCP y el
tiempo real transmiten sus respuestas sobre la marcha), y asegúrate de que el proxy **reemplace**
`X-Forwarded-For` en lugar de completarlo.

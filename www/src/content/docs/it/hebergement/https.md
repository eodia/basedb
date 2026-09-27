---
title: Dominio e HTTPS
description: Servire basedb su un dominio, in HTTPS, dietro il proxy Caddy fornito.
---

In produzione, basedb deve essere servito in **HTTPS**: i suoi cookie di sessione sono `Secure` e
hanno il prefisso `__Host-`, e un browser li accetta in HTTP solo su `localhost`.

L’immagine serve già tutto su un unico indirizzo — l’interfaccia, l’API sotto `/api`, il server MCP
sotto `/mcp`. Resta solo da metterla dietro un proxy HTTPS: il `docker-compose.yml` ne
fornisce uno, **Caddy**, che ottiene e rinnova da solo il suo certificato Let’s Encrypt.

## Configurazione

1. Fai puntare il DNS del tuo dominio al server; apri le porte 80 e 443.
2. In `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Avvia con il profilo `https`:

   ```bash
   docker compose --profile https up -d
   ```

La porta 3000 resta pubblicata solo su `127.0.0.1`: tutto il traffico esterno passa per Caddy.

## Perché queste variabili

- `BASEDB_DOMAIN`: il dominio per cui Caddy richiede il certificato.
- `BASEDB_PUBLIC_URL`: l’URL di reindirizzamento di un accesso OIDC, confrontato carattere per
  carattere con quello registrato presso il fornitore di identità.
- Caddy imposta `X-Forwarded-For` a partire dall’indirizzo reale del visitatore, e basedb lo tiene in considerazione quando
  proviene da una rete privata: i limiti di frequenza dell’API (accesso, moduli condivisi)
  contano allora per visitatore.

## Un altro proxy

Nginx, Traefik o un bilanciatore di carico vanno bene anch’essi: invia **tutto** il traffico del
dominio alla porta 3000 del container, senza buffering delle risposte (il server MCP e il
tempo reale trasmettono le loro risposte in streaming), e assicurati che il proxy **sostituisca**
`X-Forwarded-For` anziché aggiungervi valori.

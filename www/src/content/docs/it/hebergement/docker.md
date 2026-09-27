---
title: Docker Compose
description: L’immagine, i servizi, i volumi e la gestione ordinaria.
---

basedb è pubblicato come **un’unica immagine**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
per amd64 e arm64. Il `docker-compose.yml` del repository la assembla con PostgreSQL. Tutta la
configurazione passa per un file `.env` (vedi
[Variabili d’ambiente](/basedb/it/hebergement/variables/)).

## L’immagine

Contiene i tre processi di basedb e li serve su **un’unica porta, la 3000**:

| Percorso | Processo |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | l’API REST, l’accesso, le elaborazioni in background |
| `/mcp` | il server MCP, per gli agenti |
| tutto il resto — `/`, `/f/…`, `/v/…` | l’interfaccia |

All’avvio, l’API parte per prima: su un database vuoto, applica il catalogo e crea il
primo amministratore; agli avvii successivi, entrambe le operazioni non hanno effetto. Il server MCP si avvia
non appena l’API risponde. Se uno dei processi si arresta, l’intero container si arresta, e la politica
di riavvio lo riavvia per intero.

L’immagine gira con l’utente `node`, su Node 22, dichiara un controllo di integrità
(`/healthz`) e un volume, `/data`, per i file dei campi File e Immagine.

| Tag | Contenuto |
|---|---|
| `latest` | l’ultima versione pubblicata |
| `0.3` | l’ultima versione 0.3.x |
| `0.3.0` | esattamente questa versione |

## I servizi

| Servizio | Immagine | Porta (su 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (opzionale) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Comandi utili

```bash
docker compose up -d                # scarica l’immagine e avvia
docker compose logs -f basedb       # segui basedb (password admin al 1° avvio)
docker compose ps                   # stato e integrità dei servizi
docker compose restart basedb       # riavvia basedb
docker compose down                 # ferma (i volumi restano)
```

Da un clone del repository, `docker compose up -d --build` costruisce l’immagine dal codice
invece di scaricarla.

## Cambiare le porte

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Un database PostgreSQL esistente

Definisci `DATABASE_URL`: basedb vi si collega invece che al container `db` (che si avvia comunque,
inutilizzato — rimuovilo tramite un file `docker-compose.override.yml` se preferisci). Servono
PostgreSQL 16 o superiore, un ruolo proprietario del database, e le estensioni `pg_trgm` e `unaccent`
disponibili. Basta allora la sola immagine — vedi [Installazione](/basedb/it/guides/installation/).

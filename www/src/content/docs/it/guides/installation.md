---
title: Installazione
description: Installare basedb con Docker Compose, o avviare lo stack di sviluppo.
---

basedb sta in **un’unica immagine Docker**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 e arm64): l’**interfaccia**, l’**API** e il **server MCP**, serviti su un unico
indirizzo. Ha bisogno di un database **PostgreSQL 16**, che il `docker-compose.yml` fornisce.

## Con Docker Compose (consigliato)

Prerequisiti: Docker con Compose v2. Bastano due file, non serve il codice:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Apri `.env` e compila gli unici due valori obbligatori:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# generata una volta per tutte: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Poi avvia:

```bash
docker compose up -d
```

Al primo avvio, basedb crea il catalogo. Apri poi
[http://localhost:3000](http://localhost:3000): la prima pagina ti chiede di **creare
l’account amministratore**, con il tuo nome, il tuo indirizzo email e la password che
preferisci, e hai subito effettuato l’accesso.

:::caution[La prima visita crea l’amministratore]
Finché non esiste alcun amministratore, la prima persona che apre l’interfaccia lo crea.
Crealo **prima** di rendere l’istanza raggiungibile da altri — su un dominio, o con una
porta pubblicata su tutte le interfacce.
:::

Per un’installazione senza intervento, indica l’amministratore in `.env` con
`BASEDB_ADMIN_EMAIL`: basedb lo crea al primo avvio e mostra la sua password **una sola
volta** nei log (`docker compose logs basedb`), a meno che tu non la imposti
con `BASEDB_ADMIN_PASSWORD`.

| Indirizzo | Ruolo |
|---|---|
| http://localhost:3000 | l’interfaccia |
| http://localhost:3000/api | l’API REST e la sua documentazione |
| http://localhost:3000/mcp | il server MCP, per gli agenti |
| localhost:5432 | PostgreSQL, per `psql` e i tuoi strumenti |

Le porte sono pubblicate solo su `127.0.0.1`. Per servire basedb su un dominio, vedi
[Dominio e HTTPS](/basedb/it/hebergement/https/).

## Con il tuo PostgreSQL

Basta la sola immagine, con un database PostgreSQL 16 o superiore (ruolo proprietario del
database, estensioni `pg_trgm` e `unaccent` disponibili):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Conserva la chiave generata: vedi il riquadro qui sotto.

:::caution[La chiave dell’istanza]
`BASEDB_ENCRYPTION_KEY` firma le sessioni e cifra i segreti salvati (chiavi IA,
segreti dei webhook, link dei moduli). Cambiarla disconnette tutti e rende illeggibili questi
segreti. Generala una volta sola e salvala insieme al database.
:::

## Per sviluppare

Prerequisiti: Node 22 o superiore, Docker e `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` sceglie porte libere, avvia un PostgreSQL 16 usa e getta, applica il catalogo,
predispone un amministratore di sviluppo (`admin@basedb.local` / `developpement-basedb`,
indirizzo precompilato nella schermata di accesso), poi avvia l’API, il server MCP e l’interfaccia in
modalità sviluppo. `Ctrl+C` ferma tutto, container compreso.

## E poi?

- [Primi passi](/basedb/it/guides/premiers-pas/): un database, una tabella, una vista, un modulo.
- [Variabili d’ambiente](/basedb/it/hebergement/variables/): file, IA, indirizzi.

---
title: Instalare
description: Instalați basedb cu Docker Compose sau porniți mediul de dezvoltare.
---

basedb încape într-o **singură imagine Docker**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 și arm64): **interfața**, **API-ul** și **serverul MCP**, servite la o singură adresă.
Are nevoie de o bază de date **PostgreSQL 16**, pe care o furnizează `docker-compose.yml`.

## Cu Docker Compose (recomandat)

Cerințe: Docker cu Compose v2. Două fișiere sunt suficiente, nu aveți nevoie de cod:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Deschideți `.env` și completați singurele două valori obligatorii:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# generată o singură dată: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Apoi porniți:

```bash
docker compose up -d
```

La prima pornire, basedb creează catalogul. Deschideți apoi
[http://localhost:3000](http://localhost:3000): prima pagină vă cere să **creați contul de
administrator**, cu numele, adresa dumneavoastră și parola aleasă, iar apoi sunteți conectat
imediat.

:::caution[Prima vizită creează administratorul]
Cât timp nu există niciun administrator, prima persoană care deschide interfața îl creează.
Creați-l **înainte** de a face instanța accesibilă altora — pe un domeniu sau cu un port
publicat pe toate interfețele.
:::

Pentru o instalare fără intervenție, numiți administratorul în `.env` cu
`BASEDB_ADMIN_EMAIL`: basedb îl creează la prima pornire și îi afișează parola **o singură
dată** în jurnalele sale (`docker compose logs basedb`), cu excepția cazului în care o fixați
cu `BASEDB_ADMIN_PASSWORD`.

| Adresă | Rol |
|---|---|
| http://localhost:3000 | interfața |
| http://localhost:3000/api | API-ul REST și documentația sa |
| http://localhost:3000/mcp | serverul MCP, pentru agenți |
| localhost:5432 | PostgreSQL, pentru `psql` și instrumentele dumneavoastră |

Porturile sunt publicate doar pe `127.0.0.1`. Pentru a servi basedb pe un domeniu, consultați
[Domeniu și HTTPS](/basedb/ro/hebergement/https/).

## Cu propriul dumneavoastră PostgreSQL

Imaginea singură este suficientă, cu o bază de date PostgreSQL 16 sau mai nouă (rol
proprietar al bazei de date, extensiile `pg_trgm` și `unaccent` disponibile):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Păstrați cheia generată: consultați caseta de mai jos.

:::caution[Cheia instanței]
`BASEDB_ENCRYPTION_KEY` semnează sesiunile și criptează secretele salvate (chei AI, secrete
de webhook-uri, linkuri de formulare). Schimbarea ei deconectează pe toată lumea și face
aceste secrete ilizibile. Generați-o o singură dată și salvați-o împreună cu baza de date.
:::

## Pentru dezvoltare

Cerințe: Node 22 sau mai nou, Docker și `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` alege porturi libere, pornește un PostgreSQL 16 de unică folosință, aplică
catalogul, creează un administrator de dezvoltare (`admin@basedb.local` /
`developpement-basedb`, adresă precompletată la conectare), apoi lansează API-ul, serverul MCP
și interfața în modul de dezvoltare. `Ctrl+C` oprește totul, inclusiv containerul.

## Și apoi?

- [Primii pași](/basedb/ro/guides/premiers-pas/): o bază, un tabel, o vizualizare, un formular.
- [Variabile de mediu](/basedb/ro/hebergement/variables/): fișiere, AI, adrese.

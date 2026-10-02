---
title: Docker Compose
description: Imaginea, serviciile, volumele și operarea curentă.
---

basedb este publicat ca **o singură imagine**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
pentru amd64 și arm64. `docker-compose.yml` din depozit o asamblează cu PostgreSQL. Întreaga
configurație trece printr-un fișier `.env` (consultați
[Variabile de mediu](/basedb/ro/hebergement/variables/)).

## Imaginea

Conține cele trei procese ale basedb și le servește pe **un singur port, 3000**:

| Cale | Proces |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | API-ul REST, conectarea, lucrul în fundal |
| `/mcp` | serverul MCP, pentru agenți |
| tot restul — `/`, `/f/…`, `/v/…` | interfața |

La pornire, API-ul pornește primul: pe o bază de date goală, aplică catalogul și creează primul
administrator; la pornirile următoare, ambele operații nu au niciun efect. Serverul MCP
pornește imediat ce API-ul răspunde. Dacă unul dintre procese se oprește, întregul container
se oprește, iar politica de repornire îl relansează în întregime.

Imaginea rulează sub utilizatorul `node`, pe Node 22, declară o verificare de sănătate
(`/healthz`) și un volum, `/data`, pentru fișierele câmpurilor Fișier și Imagine.

| Etichetă | Conținut |
|---|---|
| `latest` | ultima versiune publicată |
| `0.6` | ultima versiune 0.6.x |
| `0.6.1` | exact această versiune |

## Serviciile

| Serviciu | Imagine | Port (pe 127.0.0.1) | Volum |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (opțional) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Comenzi utile

```bash
docker compose up -d                # descărcați imaginea și porniți
docker compose logs -f basedb       # urmăriți basedb (parola de admin la prima pornire)
docker compose ps                   # starea și sănătatea serviciilor
docker compose restart basedb       # reporniți basedb
docker compose down                 # opriți (volumele rămân)
```

Dintr-o clonă a depozitului, `docker compose up -d --build` construiește imaginea din cod în
loc să o descarce.

## În spatele unei porți de acces, sub o cale

Când basedb este publicat sub o cale — `https://passerelle.example.com/basedb/` și nu la
rădăcina unui domeniu —, indicați această cale:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# sau, fără adresă publică:
BASEDB_BASE_PATH=/basedb
```

Totul trece atunci sub `/basedb`: interfața, `/basedb/api`, `/basedb/mcp`, link-urile de
partajare și cele din e-mailuri. Poarta de acces poate **păstra calea** transmițând cererea sau
o poate **elimina**: basedb le acceptă pe amândouă. `BASEDB_BASE_PATH=/` forțează rădăcina.

Imaginea este aceeași pentru toate adresele: calea este scrisă în interfață la pornirea
containerului, iar schimbarea căii cere doar o repornire.

## Schimbarea porturilor

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## O bază de date PostgreSQL existentă

Definiți `DATABASE_URL`: basedb se conectează la ea în locul containerului `db` (care pornește
oricum, nefolosit — eliminați-l printr-un fișier `docker-compose.override.yml` dacă preferați).
Este nevoie de PostgreSQL 16 sau mai nou, de un rol proprietar al bazei de date și de
extensiile `pg_trgm` și `unaccent` disponibile. Imaginea singură este atunci suficientă —
consultați [Instalare](/basedb/ro/guides/installation/).

---
title: Környezeti változók
description: A basedb által olvasott összes változó és az alapértelmezett értékük.
---

Mindegyik a `.env` fájlba kerül, a `docker-compose.yml` mellé, amelyet a `docker compose`
beolvas (a teljes, megjegyzésekkel ellátott minta a `.env.example`). A `docker run` használatakor
adja át őket `-e` kapcsolóval. **Az üres érték „nincs megadva” értéknek számít.**

## Kötelezők

| Változó | Szerep |
|---|---|
| `POSTGRES_PASSWORD` | a PostgreSQL-konténer jelszava |
| `BASEDB_ENCRYPTION_KEY` | a példány kulcsa: aláírja a munkameneteket, titkosítja a titkokat. `openssl rand -base64 32`, egyszer és végleg |

## Adatbázis

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-szerepkör |
| `POSTGRES_DB` | `basedb` | PostgreSQL-adatbázis |
| `POSTGRES_PORT` | `5432` | a 127.0.0.1 címen közzétett port |
| `DATABASE_URL` | a `db` konténer | egy saját PostgreSQL 16+ adatbázis |

## Első indítás

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | alkalmazza a katalógust egy üres adatbázison |
| `BASEDB_BOOTSTRAP` | `1` | előkészíti az első adminisztrátort |
| `BASEDB_TENANT` | `t4z56fq` | a munkaterület azonosítója az API URL-jeiben |
| `BASEDB_ADMIN_EMAIL` | – | az első, indításkor létrehozott adminisztrátor e-mail-címe; ha üres, az első személy hozza létre, aki megnyitja a felületet |
| `BASEDB_ADMIN_PASSWORD` | generált, egyszer megjelenítve | a `BASEDB_ADMIN_EMAIL` mellett az adminisztrátor jelszava; ha meg van adva, a rendszer **minden** indításkor újra alkalmazza az adminisztrátorra: bejelentkezés után távolítsa el |

## Bejelentkezés Google-lel, Microsofttal… (OIDC)

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | a felkínált szolgáltatók, vesszővel elválasztva: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | a szolgáltatónál regisztrált alkalmazás |
| `BASEDB_OIDC_<NOM>_ISSUER` | a `google` és a `gitlab` esetén az övék | az OpenID Connect kibocsátó |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | szolgáltatótól függően | a gomb neve, a kért hatókörök |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: az első bejelentkezés nem hoz létre fiókot |

Lásd: [Fiókok és bejelentkezés](/basedb/hu/hebergement/connexion/).

## Címek

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_PORT` | `3000` | a 127.0.0.1 címen közzétett port: a felület, a `/api` és a `/mcp` |
| `BASEDB_VERSION` | `latest` | az `eodia/basedb` lemezkép címkéje |
| `BASEDB_PUBLIC_URL` | – | a basedb nyilvános címe, az OIDC-visszatéréshez |
| `BASEDB_DOMAIN` | – | a Caddy proxy által HTTPS-en kiszolgált domain |
| `BASEDB_ORIGINS` | – | más webhelyek, amelyeknek oldalai a böngészőből hívják az API-t, vesszővel elválasztva; a basedb felületéhez szükségtelen, mivel az ugyanazon a címen fut |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | az API és az MCP a böngésző felől nézve; csak a fejlesztői környezethez (`pnpm start`) kell beállítani |

## Fájlok

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | egy fájl maximális mérete |
| `BASEDB_S3_BUCKET` | – | bekapcsolja az S3-tárolást |
| `BASEDB_S3_ENDPOINT` | – | S3-végpont |
| `BASEDB_S3_REGION` | `us-east-1` | régió |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | hitelesítő adatok |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` a gazdanév alapú címzéshez |

## Adatbázissablonok

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | a nyilvános webhely katalógusa | ahonnan a példány a galériája sablonjait olvassa; `off`, ha egyiket sem szeretné beolvasni (a beépített sablonok megmaradnak) – lásd: [Sablonok](/basedb/hu/fonctionnalites/modeles/) |

## Mesterséges intelligencia

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic` vagy `mistral` |
| `BASEDB_AI_MODEL` | – | a modell |
| `BASEDB_AI_API_KEY` | – | a kulcs (ennek hiányában `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interaktív hívások óránként és munkaterületenként |
| `BASEDB_AI_FIELD_QUOTA` | `300` | MI-mezők számításai óránként és munkaterületenként |
| `BASEDB_AI_WORKER` | `1` | `0`: ebben a folyamatban nincs háttérszámítás |

## Csak fejlesztéshez

| Változó | Szerep |
|---|---|
| `BASEDB_DEV_MAIL=1` | az e-maileket a naplóban jeleníti meg ahelyett, hogy elküldené őket |
| `BASEDB_WEBHOOK_DEV=1` | engedélyezi a HTTP-re és helyi címekre küldött webhookokat |

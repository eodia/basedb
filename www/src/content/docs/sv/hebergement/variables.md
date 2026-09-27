---
title: Miljövariabler
description: Alla variabler som basedb läser, och deras standardvärden.
---

Alla placeras i filen `.env`, bredvid `docker-compose.yml`, som `docker compose` läser (den
fullständiga, kommenterade mallen är `.env.example`). Med `docker run` skickar du dem med `-e`.
**Ett tomt värde räknas som ”inte satt”.**

## Obligatoriska

| Variabel | Roll |
|---|---|
| `POSTGRES_PASSWORD` | lösenordet för PostgreSQL-containern |
| `BASEDB_ENCRYPTION_KEY` | instansnyckeln: signerar sessionerna, krypterar hemligheterna. `openssl rand -base64 32`, en gång för alla |

## Databas

| Variabel | Standard | Roll |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-roll |
| `POSTGRES_DB` | `basedb` | PostgreSQL-databas |
| `POSTGRES_PORT` | `5432` | port som publiceras på 127.0.0.1 |
| `DATABASE_URL` | containern `db` | en egen PostgreSQL 16+-databas |

## Första starten

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | tillämpar katalogen på en tom databas |
| `BASEDB_BOOTSTRAP` | `1` | förbereder den första administratören |
| `BASEDB_TENANT` | `t4z56fq` | arbetsytans referens, i API:ets URL:er |
| `BASEDB_ADMIN_EMAIL` | – | adressen till den första administratören, som skapas vid start; är den tom skapar den första person som öppnar gränssnittet administratören |
| `BASEDB_ADMIN_PASSWORD` | genereras, visas en gång | tillsammans med `BASEDB_ADMIN_EMAIL`, administratörens lösenord; är det satt tillämpas det på nytt på administratören vid **varje** start: ta bort det när du har loggat in |

## Inloggning med Google, Microsoft … (OIDC)

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | de leverantörer som erbjuds, kommaseparerade: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | programmet som registrerats hos leverantören |
| `BASEDB_OIDC_<NOM>_ISSUER` | den för `google`, `gitlab` | OpenID Connect-utfärdaren |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | beror på leverantören | knappens namn, de begärda omfången |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: en första inloggning skapar inget konto |

Se [Konton och inloggning](/basedb/sv/hebergement/connexion/).

## Adresser

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_PORT` | `3000` | port som publiceras på 127.0.0.1: gränssnittet, `/api` och `/mcp` |
| `BASEDB_VERSION` | `latest` | taggen för avbildningen `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | – | basedbs offentliga adress, för OIDC-återanropet |
| `BASEDB_DOMAIN` | – | domänen som Caddy-proxyn serverar över HTTPS |
| `BASEDB_ORIGINS` | – | andra webbplatser vars sidor anropar API:et från webbläsaren, kommaseparerade; behövs inte för basedbs gränssnitt, som serveras på samma adress |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API:et och MCP sett från webbläsaren; ställs bara in för utvecklingsmiljön (`pnpm start`) |

## Filer

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | största tillåtna storlek för en fil |
| `BASEDB_S3_BUCKET` | – | aktiverar S3-lagring |
| `BASEDB_S3_ENDPOINT` | – | S3-slutpunkt |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | inloggningsuppgifter |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` för värdbaserad adressering |

## Databasmallar

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | den offentliga webbplatsens katalog | varifrån instansen läser mallarna i sitt galleri; `off` för att inte läsa några (de inbyggda mallarna finns kvar) – se [Mallar](/basedb/sv/fonctionnalites/modeles/) |

## Artificiell intelligens

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic` eller `mistral` |
| `BASEDB_AI_MODEL` | – | modellen |
| `BASEDB_AI_API_KEY` | – | nyckeln (annars `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interaktiva anrop per timme och arbetsyta |
| `BASEDB_AI_FIELD_QUOTA` | `300` | beräkningar av AI-fält per timme och arbetsyta |
| `BASEDB_AI_WORKER` | `1` | `0`: inga bakgrundsberäkningar i den här processen |

## Offentlig demo

En instans öppen för alla, som [demo.basedb.eodia.com](https://demo.basedb.eodia.com): inloggningsskärmen
fyller i förväg i ett delat konto, besökaren läser allt och ändrar det som redan finns, men
varken skapar eller tar bort något — databas, tabell, rad, fil, kommentar, konto, token, länk —,
och AI:n svarar att den inte ingår i demot. SQL-konsolen läser bara där. Att återställa databasen
varje natt är ditt eget ansvar.

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: instansen blir en offentlig demo |
| `BASEDB_DEMO_ACCOUNTS` | — | ett konto per språk, kommaseparerade: `fr=demo@demo.com,en=demo-en@demo.com`; inloggningsskärmen fyller i förväg i det som matchar sitt språk, annars engelska, annars det första, och erbjuder de andra. Skapa dessa konton, vart och ett med sitt eget projekt, innan du aktiverar demot: det vägrar skapande för alla, administratören inräknad |
| `BASEDB_DEMO_PASSWORD` | — | tillsammans med `BASEDB_DEMO_ACCOUNTS`, deras lösenord, samma för alla, publicerat med dem |

Utan `BASEDB_DEMO_ACCOUNTS` är det delade kontot den administratör som anges av
`BASEDB_ADMIN_EMAIL` och `BASEDB_ADMIN_PASSWORD`. En adress i demot loggar in med det publicerade
lösenordet, oavsett vad man skriver: felaktiga försök låser den inte för alla andra.

## Endast utveckling

| Variabel | Roll |
|---|---|
| `BASEDB_DEV_MAIL=1` | visar e-post i loggarna i stället för att skicka den |
| `BASEDB_WEBHOOK_DEV=1` | tillåter webhooks till HTTP och lokala adresser |

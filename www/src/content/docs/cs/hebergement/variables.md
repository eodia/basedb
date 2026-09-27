---
title: Proměnné prostředí
description: Všechny proměnné, které basedb čte, a jejich výchozí hodnoty.
---

Všechny se zapisují do souboru `.env` vedle `docker-compose.yml`, který `docker compose` čte
(úplná komentovaná šablona je `.env.example`). S `docker run` je předejte pomocí `-e`. **Prázdná hodnota znamená „nenastaveno“.**

## Povinné

| Proměnná | Role |
|---|---|
| `POSTGRES_PASSWORD` | heslo kontejneru PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | klíč instance: podepisuje relace, šifruje tajemství. `openssl rand -base64 32`, jednou provždy |

## Databáze

| Proměnná | Výchozí | Role |
|---|---|---|
| `POSTGRES_USER` | `basedb` | role PostgreSQL |
| `POSTGRES_DB` | `basedb` | databáze PostgreSQL |
| `POSTGRES_PORT` | `5432` | port publikovaný na 127.0.0.1 |
| `DATABASE_URL` | kontejner `db` | vlastní databáze PostgreSQL 16+ |

## První spuštění

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | použije katalog na prázdnou databázi |
| `BASEDB_BOOTSTRAP` | `1` | připraví prvního správce |
| `BASEDB_TENANT` | `t4z56fq` | identifikátor pracovního prostoru v URL API |
| `BASEDB_ADMIN_EMAIL` | – | adresa prvního správce, vytvořeného při spuštění; je-li prázdná, vytvoří ho první osoba, která otevře rozhraní |
| `BASEDB_ADMIN_PASSWORD` | vygenerované, zobrazené jednou | spolu s `BASEDB_ADMIN_EMAIL` jeho heslo; je-li nastaveno, použije se pro správce při **každém** spuštění: po přihlášení ho odeberte |

## Přihlášení přes Google, Microsoft… (OIDC)

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | nabízení poskytovatelé, oddělení čárkami: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | aplikace registrovaná u poskytovatele |
| `BASEDB_OIDC_<NOM>_ISSUER` | známý pro `google`, `gitlab` | vydavatel OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | podle poskytovatele | název tlačítka, požadované rozsahy |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: první přihlášení nevytvoří účet |

Viz [Účty a přihlášení](/basedb/cs/hebergement/connexion/).

## Adresy

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_PORT` | `3000` | port publikovaný na 127.0.0.1: rozhraní, `/api` a `/mcp` |
| `BASEDB_VERSION` | `latest` | tag obrazu `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | – | veřejná adresa basedb pro návrat z OIDC |
| `BASEDB_DOMAIN` | – | doména obsluhovaná přes HTTPS proxy Caddy |
| `BASEDB_ORIGINS` | – | další weby, jejichž stránky volají API z prohlížeče, oddělené čárkami; pro rozhraní basedb, obsluhované na stejné adrese, není potřeba |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API a MCP z pohledu prohlížeče; nastavujte jen pro vývojové prostředí (`pnpm start`) |

## Soubory

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maximální velikost souboru |
| `BASEDB_S3_BUCKET` | – | zapne úložiště S3 |
| `BASEDB_S3_ENDPOINT` | – | koncový bod S3 |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | přístupové údaje |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` pro adresování podle hostitele |

## Šablony databází

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | katalog veřejného webu | odkud instance čte šablony své galerie; `off`, aby nečetla žádné (zabudované šablony zůstanou) – viz [Šablony](/basedb/cs/fonctionnalites/modeles/) |

## Umělá inteligence

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic` nebo `mistral` |
| `BASEDB_AI_MODEL` | – | model |
| `BASEDB_AI_API_KEY` | – | klíč (jinak `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interaktivní volání za hodinu na pracovní prostor |
| `BASEDB_AI_FIELD_QUOTA` | `300` | výpočty polí AI za hodinu na pracovní prostor |
| `BASEDB_AI_WORKER` | `1` | `0`: žádné výpočty na pozadí v tomto procesu |

## Veřejná demoverze

Instance otevřená všem, jako [demo.basedb.eodia.com](https://demo.basedb.eodia.com): přihlašovací
obrazovka přednastaví sdílený účet, návštěvník vše čte a upravuje, co existuje, ale nic nevytváří
ani neodstraňuje — databázi, tabulku, řádek, soubor, komentář, účet, token, odkaz —, a AI
odpoví, že není součástí demoverze. SQL konzole zde jen čte. Uvedení databáze zpět do
výchozího stavu každou noc zůstává na vás.

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: instance se stane veřejnou demoverzí |
| `BASEDB_DEMO_ACCOUNTS` | — | jeden účet na jazyk, oddělené čárkami: `fr=demo@demo.com,en=demo-en@demo.com`; přihlašovací obrazovka přednastaví ten pro svůj jazyk, jinak angličtinu, jinak první, a nabídne ostatní. Vytvořte tyto účty, každý s jeho projektem, před zapnutím demoverze: ta odmítá vytváření všem, správce nevyjímaje |
| `BASEDB_DEMO_PASSWORD` | — | spolu s `BASEDB_DEMO_ACCOUNTS` jejich heslo, stejné pro všechny, zveřejněné spolu s nimi |

Bez `BASEDB_DEMO_ACCOUNTS` je sdíleným účtem správce, kterého určují `BASEDB_ADMIN_EMAIL`
a `BASEDB_ADMIN_PASSWORD`. Adresa demoverze se přihlásí se zveřejněným heslem, ať se zadá
cokoli: chybné pokusy ji nezamknou pro všechny.

## Jen pro vývoj

| Proměnná | Role |
|---|---|
| `BASEDB_DEV_MAIL=1` | vypisuje e-maily do protokolů místo jejich odesílání |
| `BASEDB_WEBHOOK_DEV=1` | povolí webhooky na HTTP a místní adresy |

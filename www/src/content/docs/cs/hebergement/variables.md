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

## E-maily

Bez odesílacího serveru basedb neodešle žádný e-mail. S ním odcházejí oznámení, která zůstala
deset minut nepřečtená (každý si zvolí, která, v **Nastavení › Oznámení**), e-maily z kroku
automatizací **Odeslat e-mail** a odkaz na **zapomenuté heslo**. Odkazy směřují na
`BASEDB_PUBLIC_URL`; bez ní e-mail žádný odkaz nenese.

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | server SMTP: vaší poštovní služby nebo odesílací služby |
| `BASEDB_SMTP_PORT` | `587` | `465` pro rovnou šifrované připojení |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` na portu 465) | `none` jen pro relay na stejném stroji: jinak by heslo šlo nešifrovaně |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | identifikátor odesílacího účtu, pokud nějaký vyžaduje |
| `BASEDB_MAIL_FROM` | — | povinné s `BASEDB_SMTP_HOST`: odesílatel, `basedb <no-reply@exemple.fr>` |

Při spuštění o tom protokol informuje: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` E-mail, který server odmítne, se opakuje po 1, 5, 30, 120 a
pak 360 minutách.

## Mapy a adresy

Zobrazení **Mapa** umísťuje adresu díky geokódovací službě: ve výchozím nastavení službě
OpenStreetMap (Nominatim), dotazované jednou na adresu, nejvýše jeden dotaz za sekundu, každá
odpověď se uchovává. Mapový podklad je tvořen **dlaždicemi**, které prohlížeč každého čtenáře
načítá přímo.

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | jiná služba mluvící stejným protokolem (váš vlastní Nominatim); `off`: žádná, adresy neopustí instanci a řádky umísťuje jen zeměpisná šířka a délka |
| `BASEDB_MAP_TILES` | dlaždice OpenStreetMap | jiný dlaždicový server, vzor `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | údaj, který tento server vyžaduje, vpravo dole na mapě |

Při spuštění protokol říká, která služba se používá: `Géocodage : https://nominatim.openstreetmap.org.`

## Dokumenty PDF

| Proměnná | Výchozí | Role |
|---|---|---|
| `BASEDB_PDF_FONTS` | písma Noto z obrazu | vlastní složka, připojená do kontejneru, která obsahuje `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, a pro čínštinu, japonštinu a korejštinu `NotoSansCJK-Regular.ttc` a `-Bold.ttc` |

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

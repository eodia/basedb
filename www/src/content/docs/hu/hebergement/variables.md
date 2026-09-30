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

## E-mailek

Levélküldő szerver nélkül a basedb egyetlen e-mailt sem küld el. Vele együtt megy ki a tíz
percig olvasatlanul maradt értesítés (mindenki maga választja meg, melyiket, a **Beállítások ›
Értesítések** menüpontban), az automatizálások **E-mail küldése** lépésének e-mailjei, és egy
**elfelejtett jelszó** hivatkozása. A hivatkozások a `BASEDB_PUBLIC_URL`-re mutatnak; ennek
hiányában egy e-mail nem hordoz ilyet.

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | az SMTP-szerver: az Öné, vagy egy kiküldő szolgáltatásé |
| `BASEDB_SMTP_PORT` | `587` | `465` az azonnal titkosított kapcsolathoz |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` a 465-ös porton) | `none` csak ugyanazon a gépen futó továbbító esetén: különben a jelszó nyílt szövegben menne |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | a kiküldő fiók azonosítója, ha kér ilyet |
| `BASEDB_MAIL_FROM` | — | kötelező a `BASEDB_SMTP_HOST` mellett: a feladó, `basedb <no-reply@exemple.fr>` |

Induláskor a napló jelzi, mi a helyzet: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Egy e-mailt, amelyet a szerver visszautasít, a rendszer 1, 5,
30, 120, majd 360 perc múlva újra megkísérel elküldeni.

## Térképek és címek

A **Térkép** nézet egy geokódolási szolgáltatás segítségével helyezi el a címet:
alapértelmezés szerint az OpenStreetMapét (Nominatim), amelyet a rendszer címenként egyszer
keres meg, legfeljebb másodpercenként egy kéréssel, és minden választ megőriz. A térkép alapja
**csempékből** áll, amelyeket minden olvasó böngészője közvetlenül tölt be.

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | egy másik, ugyanazt a protokollt beszélő szolgáltatás (egy saját Nominatim); `off`: semelyik, a címek nem hagyják el a példányt, és csak a szélességi és hosszúsági fok helyezi el a sorokat |
| `BASEDB_MAP_TILES` | az OpenStreetMap csempéi | egy másik csempeszerver, `https://…/{z}/{x}/{y}.png` mintával |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | a felirat, amelyet ez a szerver kér, a térkép jobb alsó sarkában |

Induláskor a napló jelzi, melyik szolgáltatást használja: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-dokumentumok

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_PDF_FONTS` | a lemezkép Noto betűtípusai | egy saját mappa, a konténerbe csatolva, amely tartalmazza a `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic` fájlokat, kínaihoz, japánhoz és koreaihoz pedig a `NotoSansCJK-Regular.ttc` és `-Bold.ttc` fájlokat |

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

## Nyilvános demó

Egy mindenki előtt nyitott példány, mint a [demo.basedb.eodia.com](https://demo.basedb.eodia.com):
a bejelentkezési képernyő előre kitölt egy közös fiókot, a látogató mindent elolvashat és
módosíthatja, ami már létezik, de semmit nem hozhat létre és nem törölhet – adatbázist, táblát,
sort, fájlt, megjegyzést, fiókot, tokent, hivatkozást –, és az MI azt válaszolja, hogy nem
része a demónak. Az SQL-konzol ott csak olvas. Az adatbázis éjszakánkénti visszaállítása az Ön
feladata marad.

| Változó | Alapértelmezés | Szerep |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: a példány nyilvános demóvá válik |
| `BASEDB_DEMO_ACCOUNTS` | — | egy fiók nyelvenként, vesszővel elválasztva: `fr=demo@demo.com,en=demo-en@demo.com`; a bejelentkezési képernyő előre kitölti a saját nyelvéhez tartozót, ennek hiányában az angolt, ennek hiányában az elsőt, és felkínálja a többit is. Hozza létre ezeket a fiókokat, mindegyiket a saját projektjével, mielőtt bekapcsolja a demót: az utána mindenkitől megtagadja a létrehozást, az adminisztrátortól is |
| `BASEDB_DEMO_PASSWORD` | — | a `BASEDB_DEMO_ACCOUNTS` mellett a jelszavuk, mindegyiküknél ugyanaz, velük együtt közzétéve |

A `BASEDB_DEMO_ACCOUNTS` nélkül a közös fiók az az adminisztrátor, akit a `BASEDB_ADMIN_EMAIL` és
a `BASEDB_ADMIN_PASSWORD` nevez meg. A demó egy címe a közzétett jelszóval jelentkezik be, bármit
is gépelnek be: a hibás próbálkozások nem zárolják mindenki elől.

## Csak fejlesztéshez

| Változó | Szerep |
|---|---|
| `BASEDB_DEV_MAIL=1` | az e-maileket a naplóban jeleníti meg ahelyett, hogy elküldené őket |
| `BASEDB_WEBHOOK_DEV=1` | engedélyezi a HTTP-re és helyi címekre küldött webhookokat |

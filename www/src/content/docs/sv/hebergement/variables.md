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

## E-post

Utan en sändningsserver skickar basedb ingen e-post. Med den skickas aviseringar som har varit
olästa i tio minuter (var och en väljer vilka under **Inställningar › Aviseringar**),
e-postmeddelandena från automatiseringarnas steg **Skicka e-post**, och länken till ett **glömt
lösenord**. Länkarna pekar mot `BASEDB_PUBLIC_URL`; utan den bär ett e-postmeddelande ingen länk.

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_SMTP_HOST` | – | SMTP-servern: din egen e-postserver eller en sändningstjänst |
| `BASEDB_SMTP_PORT` | `587` | `465` för en direkt krypterad anslutning |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` på port 465) | `none` bara för ett relä på samma maskin: annars skulle lösenordet skickas i klartext |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | – | inloggningsuppgifterna för sändningskontot, om det kräver några |
| `BASEDB_MAIL_FROM` | – | obligatorisk med `BASEDB_SMTP_HOST`: avsändaren, `basedb <no-reply@exemple.fr>` |

Vid start berättar loggen läget: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Ett e-postmeddelande som servern avvisar görs om efter 1, 5, 30,
120 och sedan 360 minuter.

## Kartor och adresser

Vyn **Karta** placerar en adress med hjälp av en geokodningstjänst: OpenStreetMaps (Nominatim)
som standard, tillfrågad en gång per adress, högst en förfrågan i sekunden, varje svar sparat.
Kartunderlaget består av **tiles** som varje läsares webbläsare hämtar direkt.

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | en annan tjänst som talar samma protokoll (en egen Nominatim); `off`: ingen, adresserna lämnar aldrig instansen och bara latitud och longitud placerar raderna |
| `BASEDB_MAP_TILES` | OpenStreetMaps tiles | en annan tile-server, mall `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | den hänvisning som denna server kräver, längst ned till höger på kartan |

Vid start berättar loggen vilken tjänst som används: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-dokument

| Variabel | Standard | Roll |
|---|---|---|
| `BASEDB_PDF_FONTS` | avbildningens Noto-typsnitt | en egen mapp, monterad i containern, som innehåller `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, och för kinesiska, japanska och koreanska `NotoSansCJK-Regular.ttc` och `-Bold.ttc` |

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

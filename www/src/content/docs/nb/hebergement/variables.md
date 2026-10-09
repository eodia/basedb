---
title: Miljøvariabler
description: Alle variablene basedb leser, og standardverdiene deres.
---

Alle legges i `.env`-filen, ved siden av `docker-compose.yml`, som `docker compose`
leser (den komplette malen med kommentarer er `.env.example`). Med `docker run` sender du dem med `-e`. **En tom verdi betyr «ikke satt».**

## Obligatoriske

| Variabel | Rolle |
|---|---|
| `POSTGRES_PASSWORD` | passordet til PostgreSQL-containeren |
| `BASEDB_ENCRYPTION_KEY` | instansnøkkel: signerer øktene, krypterer hemmelighetene. `openssl rand -base64 32`, én gang for alle |

## Database

| Variabel | Standard | Rolle |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-rolle |
| `POSTGRES_DB` | `basedb` | PostgreSQL-database |
| `POSTGRES_PORT` | `5432` | port publisert på 127.0.0.1 |
| `DATABASE_URL` | containeren `db` | din egen PostgreSQL 16+-database |

## Første oppstart

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | tar i bruk katalogen på en tom database |
| `BASEDB_BOOTSTRAP` | `1` | klargjør den første administratoren |
| `BASEDB_TENANT` | `t4z56fq` | tenantens referanse, i API-ets URL-er |
| `BASEDB_ADMIN_EMAIL` | – | adressen til den første administratoren, som opprettes ved oppstart; er den tom, oppretter den første personen som åpner grensesnittet, administratoren |
| `BASEDB_ADMIN_PASSWORD` | generert, vist én gang | sammen med `BASEDB_ADMIN_EMAIL`: passordet; er den satt, brukes den på nytt for administratoren ved **hver** oppstart: fjern den når du har logget inn |

## Innlogging med Google, Microsoft … (OIDC)

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | leverandørene som tilbys, kommaseparert: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | applikasjonen som er registrert hos leverandøren |
| `BASEDB_OIDC_<NOM>_ISSUER` | den til `google`, `gitlab` | OpenID Connect-utstederen |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | avhenger av leverandøren | navnet på knappen, omfangene (scopes) det bes om |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: en første innlogging oppretter ikke en konto |

Se [Kontoer og innlogging](/basedb/nb/hebergement/connexion/).

## Adresser

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_PORT` | `3000` | port publisert på 127.0.0.1: grensesnittet, `/api` og `/mcp` |
| `BASEDB_VERSION` | `latest` | taggen til imaget `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | – | den offentlige adressen til basedb, for OIDC-returen |
| `BASEDB_BASE_PATH` | stien til `BASEDB_PUBLIC_URL` | stien basedb serveres under bak en gateway, `/basedb` for `https://passerelle.example.com/basedb/`; se [Docker Compose](/basedb/nb/hebergement/docker/#bak-en-gateway-under-en-sti) |
| `BASEDB_DOMAIN` | – | domenet som Caddy-proxyen serverer over HTTPS |
| `BASEDB_ORIGINS` | – | andre nettsteder der sidene kaller API-et fra nettleseren, kommaseparert; unødvendig for grensesnittet til basedb, som serveres på samme adresse |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API-et og MCP sett fra nettleseren; skal bare justeres for utviklingsmiljøet (`pnpm start`) |

## Filer

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maksimal størrelse på en fil |
| `BASEDB_S3_BUCKET` | – | aktiverer S3-lagring |
| `BASEDB_S3_ENDPOINT` | – | S3-endepunkt |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | påloggingsinformasjon |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` for vertsbasert adressering |

## E-poster

Uten en utsendingsserver sender basedb ingen e-post. Med den sendes varsler som har stått
uleste i ti minutter (hver enkelt velger hvilke, under **Innstillinger › Varsler**), e-postene
fra automatiseringstrinnet **Send en e-post**, og lenken til et **glemt passord**. Lenkene peker
til `BASEDB_PUBLIC_URL`; uten den bærer en e-post ingen lenke.

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_SMTP_HOST` | – | SMTP-serveren: den til e-postleverandøren din eller en utsendingstjeneste |
| `BASEDB_SMTP_PORT` | `587` | `465` for en kryptert forbindelse fra starten |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` på port 465) | `none` bare for en relé på samme maskin: ellers ville passordet gått i klartekst |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | – | brukernavnet til utsendingskontoen, hvis den krever et |
| `BASEDB_MAIL_FROM` | – | obligatorisk med `BASEDB_SMTP_HOST`: avsenderen, `basedb <no-reply@exemple.fr>` |

Ved oppstart forteller loggen hvordan det står: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` En e-post som serveren avviser, prøves på nytt etter 1, 5, 30,
120 og deretter 360 minutter.

## Kart og adresser

Visningen **Kart** plasserer en adresse med en geokodingstjeneste: som standard OpenStreetMap
(Nominatim), spurt én gang per adresse, høyst én forespørsel i sekundet, og hvert svar lagres.
Kartbunnen er laget av **fliser** som nettleseren til hver leser laster direkte.

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | en annen tjeneste som snakker samme protokoll (en egen Nominatim); `off`: ingen, adressene forlater ikke instansen, og bare breddegraden og lengdegraden plasserer radene |
| `BASEDB_MAP_TILES` | flisene til OpenStreetMap | en annen flistjener, mønster `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | henvisningen denne tjeneren krever, nederst til høyre på kartet |

Ved oppstart forteller loggen hvilken tjeneste som brukes: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-dokumenter

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_PDF_FONTS` | Noto-skriftene i imaget | en egen mappe, montert i containeren, som har `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, og for kinesisk, japansk og koreansk `NotoSansCJK-Regular.ttc` og `-Bold.ttc` |

## Databasemaler

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | katalogen på det offentlige nettstedet | hvor instansen leser malene til galleriet sitt fra; `off` for ikke å lese noen (de innebygde malene blir værende) – se [Maler](/basedb/nb/fonctionnalites/modeles/) |

## Kunstig intelligens

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic`, `mistral` eller `openai_compatible` (Azure, en gateway, en lokal modell) |
| `BASEDB_AI_MODEL` | – | modellen |
| `BASEDB_AI_API_KEY` | – | nøkkelen (ellers `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`); valgfri for `openai_compatible` |
| `BASEDB_AI_BASE_URL` | leverandørens adresse | det som står foran `/chat/completions` (`/messages` for `anthropic`), parametere medregnet; obligatorisk for `openai_compatible` – se [Kunstig intelligens](/basedb/nb/fonctionnalites/ia/#azure-en-gateway-en-lokal-modell) |
| `BASEDB_AI_HEADERS` | – | headere som legges til i hvert kall, som et JSON-objekt: `{"api-key":"…"}` |
| `BASEDB_AI_PROVIDER_SSL_VERIFY` | `true` | `false`: leverandørens TLS-sertifikat kontrolleres ikke – en intern gateway med selvsignert sertifikat; se [Kunstig intelligens](/basedb/nb/fonctionnalites/ia/#azure-en-gateway-en-lokal-modell) |
| `BASEDB_AI_QUOTA` | `120` | interaktive kall per time og per tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | beregninger av KI-felt per time og per tenant |
| `BASEDB_AI_WORKER` | `1` | `0`: ingen bakgrunnsberegning i denne prosessen |

## Webhooks til det interne nettverket

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | – | dine interne servere, kommaseparert: et navn (`chat.intra.example.com`), et domene med underdomenene (`*.intra.example.com`), en adresse eller et område (`10.12.0.0/16`) |

Webhooks, HTTP-forespørsler fra automatiseringer og synkroniserte tabeller går bare til
offentlige HTTPS-adresser. Et mål fra listen godtas i tillegg, uansett adresse, port og
skjema – HTTP inkludert. En ulesbar oppføring hindrer oppstart. Se
[Webhooks](/basedb/nb/integrations/webhooks/#mål).

## Offentlig demo

En instans åpen for alle, som [demo.basedb.eodia.com](https://demo.basedb.eodia.com): innloggingsskjermen
fyller på forhånd ut en delt konto, den besøkende leser alt og endrer det som finnes,
men oppretter og sletter ingenting – database, tabell, rad, fil, kommentar, konto, token,
lenke –, og KI-en svarer at den ikke er en del av demoen. SQL-konsollen gjør der bare lesing.
Å sette databasen tilbake i stand hver natt er fortsatt ditt ansvar.

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_DEMO` | – | `1`: instansen blir en offentlig demo |
| `BASEDB_DEMO_ACCOUNTS` | – | én konto per språk, atskilt med komma: `fr=demo@demo.com,en=demo-en@demo.com`; innloggingsskjermen fyller på forhånd ut den for sitt eget språk, ellers engelsk, ellers den første, og tilbyr de andre. Opprett disse kontoene, hver med sitt prosjekt, før demoen aktiveres: den avviser opprettelser for alle, administrator inkludert |
| `BASEDB_DEMO_PASSWORD` | – | sammen med `BASEDB_DEMO_ACCOUNTS`, passordet deres, det samme for alle, publisert sammen med dem |

Uten `BASEDB_DEMO_ACCOUNTS` er den delte kontoen administratoren som `BASEDB_ADMIN_EMAIL` og
`BASEDB_ADMIN_PASSWORD` navngir. En adresse i demoen logger inn med det publiserte passordet,
uansett hva som skrives inn: mislykkede forsøk låser den ikke for alle andre.

## Bare for utvikling

| Variabel | Rolle |
|---|---|
| `BASEDB_DEV_MAIL=1` | viser e-postene i loggene i stedet for å sende dem |
| `BASEDB_WEBHOOK_DEV=1` | tillater webhooks til HTTP og lokale adresser |

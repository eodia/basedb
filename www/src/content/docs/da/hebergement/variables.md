---
title: Miljøvariabler
description: Alle de variabler, basedb læser, og deres standardværdier.
---

De placeres alle i filen `.env` ved siden af `docker-compose.yml`, som `docker compose` læser
(den komplette, kommenterede skabelon er `.env.example`). Med `docker run` angiver du dem med `-e`. **En tom værdi betyder »ikke sat«.**

## Påkrævede

| Variabel | Rolle |
|---|---|
| `POSTGRES_PASSWORD` | adgangskode til PostgreSQL-containeren |
| `BASEDB_ENCRYPTION_KEY` | instansnøgle: signerer sessioner, krypterer hemmeligheder. `openssl rand -base64 32`, én gang for alle |

## Database

| Variabel | Standard | Rolle |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-rolle |
| `POSTGRES_DB` | `basedb` | PostgreSQL-database |
| `POSTGRES_PORT` | `5432` | port udgivet på 127.0.0.1 |
| `DATABASE_URL` | containeren `db` | din egen PostgreSQL 16+-database |

## Første start

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | anvender kataloget på en tom database |
| `BASEDB_BOOTSTRAP` | `1` | forbereder den første administrator |
| `BASEDB_TENANT` | `t4z56fq` | arbejdsområdets reference i API'ets URL'er |
| `BASEDB_ADMIN_EMAIL` | — | adressen på den første administrator, der oprettes ved start; er den tom, opretter den første person, der åbner brugerfladen, administratoren |
| `BASEDB_ADMIN_PASSWORD` | genereret, vist én gang | sammen med `BASEDB_ADMIN_EMAIL` dennes adgangskode; når den er sat, anvendes den igen på administratoren ved **hver** start: fjern den, når du er logget ind |

## Login med Google, Microsoft … (OIDC)

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | de tilbudte udbydere, adskilt af kommaer: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | applikationen, der er registreret hos udbyderen |
| `BASEDB_OIDC_<NOM>_ISSUER` | den for `google`, `gitlab` | OpenID Connect-udstederen |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | afhænger af udbyderen | navnet på knappen, de ønskede scopes |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: et første login opretter ikke en konto |

Se [Konti og login](/basedb/da/hebergement/connexion/).

## Adresser

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_PORT` | `3000` | port udgivet på 127.0.0.1: brugerfladen, `/api` og `/mcp` |
| `BASEDB_VERSION` | `latest` | tagget for imaget `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | basedbs offentlige adresse, til OIDC-returadressen |
| `BASEDB_DOMAIN` | — | det domæne, som Caddy-proxyen serverer over HTTPS |
| `BASEDB_ORIGINS` | — | andre websteder, hvis sider kalder API'et fra browseren, adskilt af kommaer; unødvendig for basedbs brugerflade, som serveres på samme adresse |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API'et og MCP set fra browseren; skal kun indstilles til udviklingsmiljøet (`pnpm start`) |

## Filer

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maksimal størrelse på en fil |
| `BASEDB_S3_BUCKET` | — | aktiverer S3-lagring |
| `BASEDB_S3_ENDPOINT` | — | S3-endpoint |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | legitimationsoplysninger |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` for host-baseret adressering |

## E-mails

Uden en afsendelsesserver sender basedb ingen e-mails. Med den sendes notifikationer, der har
været ulæste i ti minutter (hver person vælger hvilke under **Indstillinger › Notifikationer**),
e-mails fra automatiseringstrinnet **Send en e-mail**, og linket til en **glemt adgangskode**.
Linkene peger på `BASEDB_PUBLIC_URL`; uden den bærer en e-mail ikke noget link.

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | SMTP-serveren: din egen mailserver eller en afsendelsestjeneste |
| `BASEDB_SMTP_PORT` | `587` | `465` for en forbindelse, der er krypteret fra start |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` på port 465) | `none` kun for et relæ på samme maskine: ellers ville adgangskoden blive sendt i klartekst |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | brugernavnet til afsendelseskontoen, hvis den kræver et |
| `BASEDB_MAIL_FROM` | — | obligatorisk sammen med `BASEDB_SMTP_HOST`: afsenderen, `basedb <no-reply@exemple.fr>` |

Ved start fortæller loggen, hvordan det står: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` En e-mail, som serveren afviser, prøves igen efter 1, 5, 30,
120 og derefter 360 minutter.

## Landkort og adresser

Visningen **Landkort** placerer en adresse med hjælp fra en geokodningstjeneste: som standard
OpenStreetMaps (Nominatim), forespurgt én gang pr. adresse, højst én forespørgsel i sekundet,
hvert svar gemt. Kortbunden er lavet af **fliser**, som hver læsers browser henter direkte.

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | en anden tjeneste, der taler samme protokol (din egen Nominatim); `off`: ingen, adresserne forlader ikke instansen, og kun breddegrad og længdegrad placerer rækkerne |
| `BASEDB_MAP_TILES` | OpenStreetMaps fliser | en anden fliseserver, mønster `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | den kildeangivelse, denne server kræver, nederst til højre på kortet |

Ved start fortæller loggen, hvilken tjeneste der bruges: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-dokumenter

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_PDF_FONTS` | imagets Noto-skrifttyper | en mappe hos dig selv, monteret i containeren, som indeholder `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, og for kinesisk, japansk og koreansk `NotoSansCJK-Regular.ttc` og `-Bold.ttc` |

## Databaseskabeloner

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | det offentlige websteds katalog | hvorfra instansen læser skabelonerne til sit galleri; `off` for ikke at læse nogen (de indbyggede skabeloner bliver) — se [Skabeloner](/basedb/da/fonctionnalites/modeles/) |

## Kunstig intelligens

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` eller `mistral` |
| `BASEDB_AI_MODEL` | — | modellen |
| `BASEDB_AI_API_KEY` | — | nøglen (ellers `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interaktive kald pr. time og pr. arbejdsområde |
| `BASEDB_AI_FIELD_QUOTA` | `300` | beregninger af AI-felter pr. time og pr. arbejdsområde |
| `BASEDB_AI_WORKER` | `1` | `0`: ingen baggrundsberegning i denne proces |

## Offentlig demo

En instans, der er åben for alle, som [demo.basedb.eodia.com](https://demo.basedb.eodia.com):
login-skærmen udfylder en delt konto på forhånd, den besøgende læser alt og ændrer det, der
findes, men opretter og sletter intet — database, tabel, række, fil, kommentar, konto, token,
link —, og AI'en svarer, at den ikke er en del af demoen. SQL-konsollen kan der kun læse.
At sætte databasen tilbage hver nat er stadig dit ansvar.

| Variabel | Standard | Rolle |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: instansen bliver en offentlig demo |
| `BASEDB_DEMO_ACCOUNTS` | — | en konto pr. sprog, adskilt af kommaer: `fr=demo@demo.com,en=demo-en@demo.com`; login-skærmen udfylder på forhånd den for sit eget sprog, ellers engelsk, ellers den første, og tilbyder de andre. Opret disse konti, hver med sit eget projekt, før du aktiverer demoen: den afviser oprettelser for alle, administrator inklusive |
| `BASEDB_DEMO_PASSWORD` | — | sammen med `BASEDB_DEMO_ACCOUNTS`, deres adgangskode, den samme for alle, offentliggjort sammen med dem |

Uden `BASEDB_DEMO_ACCOUNTS` er den delte konto den administrator, som `BASEDB_ADMIN_EMAIL` og
`BASEDB_ADMIN_PASSWORD` navngiver. En adresse fra demoen logger ind med den offentliggjorte
adgangskode, uanset hvad der tastes: forkerte forsøg låser den ikke for alle andre.

## Kun udvikling

| Variabel | Rolle |
|---|---|
| `BASEDB_DEV_MAIL=1` | viser e-mails i loggene i stedet for at sende dem |
| `BASEDB_WEBHOOK_DEV=1` | tillader webhooks til HTTP og lokale adresser |

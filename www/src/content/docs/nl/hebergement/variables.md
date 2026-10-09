---
title: Omgevingsvariabelen
description: Alle variabelen die basedb leest, en hun standaardwaarde.
---

Ze horen allemaal in het bestand `.env`, naast `docker-compose.yml`, dat `docker compose`
leest (het volledige sjabloon met commentaar is `.env.example`). Met `docker run` geef je ze door met `-e`. **Een lege waarde geldt als “niet ingesteld”.**

## Verplicht

| Variabele | Rol |
|---|---|
| `POSTGRES_PASSWORD` | wachtwoord van de PostgreSQL-container |
| `BASEDB_ENCRYPTION_KEY` | instantiesleutel: ondertekent de sessies, versleutelt de geheimen. `openssl rand -base64 32`, eenmalig |

## Database

| Variabele | Standaard | Rol |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-rol |
| `POSTGRES_DB` | `basedb` | PostgreSQL-database |
| `POSTGRES_PORT` | `5432` | poort gepubliceerd op 127.0.0.1 |
| `DATABASE_URL` | de container `db` | een eigen PostgreSQL 16+-database |

## Eerste start

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | past de catalogus toe op een lege database |
| `BASEDB_BOOTSTRAP` | `1` | bereidt de eerste beheerder voor |
| `BASEDB_TENANT` | `t4z56fq` | referentie van de werkruimte (tenant), in de URL’s van de API |
| `BASEDB_ADMIN_EMAIL` | — | e-mailadres van de eerste beheerder, aangemaakt bij het opstarten; leeg, dan maakt de eerste persoon die de interface opent hem aan |
| `BASEDB_ADMIN_PASSWORD` | gegenereerd, één keer getoond | samen met `BASEDB_ADMIN_EMAIL` het wachtwoord van de beheerder; indien ingesteld, wordt het bij **elke** start opnieuw op de beheerder toegepast: verwijder het zodra je bent ingelogd |

## Inloggen met Google, Microsoft… (OIDC)

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | de aangeboden providers, gescheiden door komma’s: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | de applicatie die bij de provider is geregistreerd |
| `BASEDB_OIDC_<NOM>_ISSUER` | die van `google`, `gitlab` | de OpenID Connect-issuer |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | afhankelijk van de provider | de naam op de knop, de gevraagde scopes |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: een eerste login maakt geen account aan |

Zie [Accounts en inloggen](/basedb/nl/hebergement/connexion/).

## Adressen

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_PORT` | `3000` | poort gepubliceerd op 127.0.0.1: de interface, `/api` en `/mcp` |
| `BASEDB_VERSION` | `latest` | de tag van de image `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | openbaar adres van basedb, voor de OIDC-redirect |
| `BASEDB_BASE_PATH` | het pad van `BASEDB_PUBLIC_URL` | het pad waaronder basedb achter een gateway wordt geserveerd, `/basedb` voor `https://passerelle.example.com/basedb/`; zie [Docker Compose](/basedb/nl/hebergement/docker/#achter-een-gateway-onder-een-pad) |
| `BASEDB_DOMAIN` | — | het domein dat de Caddy-proxy via HTTPS serveert |
| `BASEDB_ORIGINS` | — | andere sites waarvan de pagina’s de API vanuit de browser aanroepen, gescheiden door komma’s; niet nodig voor de interface van basedb, die op hetzelfde adres wordt geserveerd |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | de API en MCP zoals de browser ze ziet; alleen instellen voor de ontwikkelomgeving (`pnpm start`) |

## Bestanden

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maximale grootte van een bestand |
| `BASEDB_S3_BUCKET` | — | schakelt S3-opslag in |
| `BASEDB_S3_ENDPOINT` | — | S3-endpoint |
| `BASEDB_S3_REGION` | `us-east-1` | regio |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | inloggegevens |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` voor adressering per host |

## E-mails

Zonder verzendserver verstuurt basedb geen enkele e-mail. Daarmee gaan de meldingen die tien
minuten ongelezen zijn gebleven (iedereen kiest welke, bij **Instellingen › Meldingen**), de
e-mails van de stap **Een e-mail versturen** van de automatiseringen, en de link van een
**wachtwoord vergeten**. De links verwijzen naar `BASEDB_PUBLIC_URL`; zonder die variabele
draagt een e-mail er geen.

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | de SMTP-server: die van je mailprovider of van een verzenddienst |
| `BASEDB_SMTP_PORT` | `587` | `465` voor een van meet af aan versleutelde verbinding |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` op poort 465) | `none` alleen voor een relay op dezelfde machine: anders zou het wachtwoord onversleuteld worden verstuurd |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | de gebruikersnaam van het verzendaccount, als dat er een vraagt |
| `BASEDB_MAIL_FROM` | — | verplicht bij `BASEDB_SMTP_HOST`: de afzender, `basedb <no-reply@exemple.fr>` |

Bij het opstarten meldt het logboek de status: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Een e-mail die de server weigert, wordt na 1, 5, 30, 120 en dan
360 minuten opnieuw geprobeerd.

## Landkaarten en adressen

De weergave **Landkaart** plaatst een adres met behulp van een geocodeerservice: standaard die
van OpenStreetMap (Nominatim), één keer per adres bevraagd, hooguit één aanvraag per seconde,
elk antwoord bewaard. De achtergrondkaart bestaat uit **tegels** die de browser van elke lezer
rechtstreeks laadt.

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | een andere dienst die hetzelfde protocol spreekt (een eigen Nominatim); `off`: geen enkele, de adressen verlaten de instantie niet en alleen de breedtegraad en de lengtegraad plaatsen de rijen |
| `BASEDB_MAP_TILES` | de tegels van OpenStreetMap | een andere tegelserver, model `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | de vermelding die deze server vraagt, rechtsonder op de landkaart |

Bij het opstarten meldt het logboek welke dienst wordt gebruikt: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-documenten

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_PDF_FONTS` | de Noto-lettertypen van de image | een eigen map, gekoppeld in de container, met `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, en voor Chinees, Japans en Koreaans `NotoSansCJK-Regular.ttc` en `-Bold.ttc` |

## Databasesjablonen

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | de catalogus van de openbare site | waar de instantie de sjablonen van haar galerie leest; `off` om er geen enkele te lezen (de ingebouwde sjablonen blijven) — zie [Sjablonen](/basedb/nl/fonctionnalites/modeles/) |

## Kunstmatige intelligentie

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic`, `mistral` of `openai_compatible` (Azure, een gateway, een lokaal model) |
| `BASEDB_AI_MODEL` | — | het model |
| `BASEDB_AI_API_KEY` | — | de sleutel (anders `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`); optioneel voor `openai_compatible` |
| `BASEDB_AI_BASE_URL` | het adres van de provider | alles wat vóór `/chat/completions` komt (`/messages` voor `anthropic`), parameters inbegrepen; verplicht voor `openai_compatible` — zie [Kunstmatige intelligentie](/basedb/nl/fonctionnalites/ia/#azure-een-gateway-een-lokaal-model) |
| `BASEDB_AI_HEADERS` | — | headers die aan elke aanroep worden toegevoegd, als JSON-object: `{"api-key":"…"}` |
| `BASEDB_AI_PROVIDER_SSL_VERIFY` | `true` | `false`: het TLS-certificaat van de provider wordt niet gecontroleerd — een interne gateway met een zelfondertekend certificaat; zie [Kunstmatige intelligentie](/basedb/nl/fonctionnalites/ia/#azure-een-gateway-een-lokaal-model) |
| `BASEDB_AI_QUOTA` | `120` | interactieve aanroepen per uur en per werkruimte |
| `BASEDB_AI_FIELD_QUOTA` | `300` | berekeningen van AI-velden per uur en per werkruimte |
| `BASEDB_AI_WORKER` | `1` | `0`: geen achtergrondberekeningen in dit proces |

## Webhooks naar je interne netwerk

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | je interne servers, gescheiden door komma’s: een naam (`chat.intra.example.com`), een domein en zijn subdomeinen (`*.intra.example.com`), een adres of een bereik (`10.12.0.0/16`) |

Webhooks, HTTP-verzoeken van automatiseringen en gesynchroniseerde tabellen gaan alleen naar
openbare HTTPS-adressen. Een doel uit de lijst wordt daarnaast geaccepteerd, ongeacht zijn
adres, poort en schema — HTTP inbegrepen. Een onleesbare invoer verhindert het opstarten. Zie
[Webhooks](/basedb/nl/integrations/webhooks/#doelen).

## Openbare demo

Een instantie die voor iedereen open staat, zoals
[demo.basedb.eodia.com](https://demo.basedb.eodia.com): het inlogscherm vult een gedeeld account
vooraf in, de bezoeker leest alles en wijzigt wat bestaat, maar maakt niets aan en verwijdert niets
— database, tabel, rij, bestand, opmerking, account, token, link —, en de AI antwoordt dat ze geen
deel uitmaakt van de demo. De SQL-console doet er alleen lezen. De database elke nacht terugzetten
blijft jouw verantwoordelijkheid.

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: de instantie wordt een openbare demo |
| `BASEDB_DEMO_ACCOUNTS` | — | een account per taal, gescheiden door komma’s: `fr=demo@demo.com,en=demo-en@demo.com`; het inlogscherm vult dat van zijn taal vooraf in, anders het Engels, anders het eerste, en biedt de andere aan. Maak deze accounts aan, elk met zijn eigen project, voordat je de demo activeert: ze weigert het aanmaken voor iedereen, de beheerder inbegrepen |
| `BASEDB_DEMO_PASSWORD` | — | samen met `BASEDB_DEMO_ACCOUNTS`, hun wachtwoord, hetzelfde voor allemaal, samen met hen gepubliceerd |

Zonder `BASEDB_DEMO_ACCOUNTS` is het gedeelde account de beheerder die `BASEDB_ADMIN_EMAIL` en
`BASEDB_ADMIN_PASSWORD` noemen. Een adres van de demo logt in met het gepubliceerde wachtwoord, wat
je ook typt: verkeerde pogingen sluiten hem niet voor iedereen af.

## Alleen voor ontwikkeling

| Variabele | Rol |
|---|---|
| `BASEDB_DEV_MAIL=1` | toont e-mails in de logs in plaats van ze te versturen |
| `BASEDB_WEBHOOK_DEV=1` | staat webhooks naar HTTP en lokale adressen toe |

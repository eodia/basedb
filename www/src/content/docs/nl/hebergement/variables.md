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

## Databasesjablonen

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | de catalogus van de openbare site | waar de instantie de sjablonen van haar galerie leest; `off` om er geen enkele te lezen (de ingebouwde sjablonen blijven) — zie [Sjablonen](/basedb/nl/fonctionnalites/modeles/) |

## Kunstmatige intelligentie

| Variabele | Standaard | Rol |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` of `mistral` |
| `BASEDB_AI_MODEL` | — | het model |
| `BASEDB_AI_API_KEY` | — | de sleutel (anders `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interactieve aanroepen per uur en per werkruimte |
| `BASEDB_AI_FIELD_QUOTA` | `300` | berekeningen van AI-velden per uur en per werkruimte |
| `BASEDB_AI_WORKER` | `1` | `0`: geen achtergrondberekeningen in dit proces |

## Alleen voor ontwikkeling

| Variabele | Rol |
|---|---|
| `BASEDB_DEV_MAIL=1` | toont e-mails in de logs in plaats van ze te versturen |
| `BASEDB_WEBHOOK_DEV=1` | staat webhooks naar HTTP en lokale adressen toe |

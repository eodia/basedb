---
title: Zmienne środowiskowe
description: Wszystkie zmienne odczytywane przez basedb i ich wartości domyślne.
---

Wszystkie umieszcza się w pliku `.env`, obok `docker-compose.yml`, który czyta `docker compose`
(pełny szablon z komentarzami to `.env.example`). Z `docker run` przekazuj je przez `-e`.
**Pusta wartość oznacza „nieustawiona”.**

## Wymagane

| Zmienna | Rola |
|---|---|
| `POSTGRES_PASSWORD` | hasło kontenera PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | klucz instancji: podpisuje sesje, szyfruje sekrety. `openssl rand -base64 32`, raz na zawsze |

## Baza danych

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `POSTGRES_USER` | `basedb` | rola PostgreSQL |
| `POSTGRES_DB` | `basedb` | baza PostgreSQL |
| `POSTGRES_PORT` | `5432` | port opublikowany na 127.0.0.1 |
| `DATABASE_URL` | kontener `db` | twoja własna baza PostgreSQL 16+ |

## Pierwsze uruchomienie

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | stosuje katalog na pustej bazie |
| `BASEDB_BOOTSTRAP` | `1` | przygotowuje pierwszego administratora |
| `BASEDB_TENANT` | `t4z56fq` | identyfikator tenanta w adresach URL API |
| `BASEDB_ADMIN_EMAIL` | – | adres pierwszego administratora, tworzonego przy starcie; jeśli pusty, tworzy go pierwsza osoba, która otworzy interfejs |
| `BASEDB_ADMIN_PASSWORD` | generowane, wyświetlane raz | razem z `BASEDB_ADMIN_EMAIL` – jego hasło; jeśli ustawione, jest ponownie nadawane administratorowi przy **każdym** starcie: usuń je po zalogowaniu |

## Logowanie przez Google, Microsoft… (OIDC)

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | proponowani dostawcy, rozdzieleni przecinkami: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | aplikacja zarejestrowana u dostawcy |
| `BASEDB_OIDC_<NOM>_ISSUER` | ten dla `google`, `gitlab` | wystawca OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | zależnie od dostawcy | nazwa przycisku, żądane zakresy |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: pierwsze logowanie nie tworzy konta |

Zobacz [Konta i logowanie](/basedb/pl/hebergement/connexion/).

## Adresy

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_PORT` | `3000` | port opublikowany na 127.0.0.1: interfejs, `/api` i `/mcp` |
| `BASEDB_VERSION` | `latest` | tag obrazu `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | – | publiczny adres basedb, dla powrotu z OIDC |
| `BASEDB_DOMAIN` | – | domena serwowana przez HTTPS przez proxy Caddy |
| `BASEDB_ORIGINS` | – | inne witryny, których strony wywołują API z przeglądarki, rozdzielone przecinkami; zbędne dla interfejsu basedb, serwowanego pod tym samym adresem |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API i MCP widziane z przeglądarki; do ustawiania tylko dla stosu deweloperskiego (`pnpm start`) |

## Pliki

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maksymalny rozmiar pliku |
| `BASEDB_S3_BUCKET` | – | włącza magazyn S3 |
| `BASEDB_S3_ENDPOINT` | – | punkt dostępowy S3 |
| `BASEDB_S3_REGION` | `us-east-1` | region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | dane uwierzytelniające |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` dla adresowania przez host |

## Szablony baz

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | katalog publicznej witryny | skąd instancja czyta szablony do swojej galerii; `off`, aby nie czytać żadnego (szablony wbudowane pozostają) – zobacz [Szablony](/basedb/pl/fonctionnalites/modeles/) |

## Sztuczna inteligencja

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic` lub `mistral` |
| `BASEDB_AI_MODEL` | – | model |
| `BASEDB_AI_API_KEY` | – | klucz (w przeciwnym razie `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | wywołania interaktywne na godzinę i na tenanta |
| `BASEDB_AI_FIELD_QUOTA` | `300` | obliczenia pól AI na godzinę i na tenanta |
| `BASEDB_AI_WORKER` | `1` | `0`: brak obliczeń w tle w tym procesie |

## Tylko dla deweloperów

| Zmienna | Rola |
|---|---|
| `BASEDB_DEV_MAIL=1` | wyświetla e-maile w logach zamiast je wysyłać |
| `BASEDB_WEBHOOK_DEV=1` | zezwala na webhooki do HTTP i adresów lokalnych |

---
title: Docker Compose
description: Obraz, usługi, wolumeny i codzienna eksploatacja.
---

basedb jest publikowany jako **jeden obraz**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
dla amd64 i arm64. Plik `docker-compose.yml` z repozytorium łączy go z PostgreSQL. Cała
konfiguracja odbywa się przez plik `.env` (zobacz
[Zmienne środowiskowe](/basedb/pl/hebergement/variables/)).

## Obraz

Zawiera trzy procesy basedb i serwuje je na **jednym porcie, 3000**:

| Ścieżka | Proces |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | API REST, logowanie, zadania w tle |
| `/mcp` | serwer MCP dla agentów |
| cała reszta – `/`, `/f/…`, `/v/…` | interfejs |

Przy starcie API uruchamia się pierwsze: na pustej bazie stosuje katalog i tworzy pierwszego
administratora; przy kolejnych startach oba kroki nie mają żadnego efektu. Serwer MCP startuje,
gdy tylko API odpowiada. Jeśli jeden z procesów się zatrzyma, zatrzymuje się cały kontener, a
polityka ponownego uruchamiania uruchamia go ponownie w całości.

Obraz działa jako użytkownik `node`, na Node 22, deklaruje sprawdzanie stanu (`/healthz`) i
wolumen `/data` na pliki z pól Plik i Obraz.

| Tag | Zawartość |
|---|---|
| `latest` | najnowsza opublikowana wersja |
| `0.4` | najnowsza wersja 0.4.x |
| `0.4.0` | dokładnie ta wersja |

## Usługi

| Usługa | Obraz | Port (na 127.0.0.1) | Wolumen |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (opcjonalnie) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Przydatne polecenia

```bash
docker compose up -d                # pobierz obraz i uruchom
docker compose logs -f basedb       # śledź basedb (hasło administratora przy 1. starcie)
docker compose ps                   # stan i kondycja usług
docker compose restart basedb       # uruchom ponownie basedb
docker compose down                 # zatrzymaj (wolumeny zostają)
```

W sklonowanym repozytorium `docker compose up -d --build` buduje obraz z kodu, zamiast go
pobierać.

## Zmiana portów

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Istniejąca baza PostgreSQL

Ustaw `DATABASE_URL`: basedb łączy się z nią zamiast z kontenerem `db` (który i tak się
uruchamia, nieużywany – usuń go w pliku `docker-compose.override.yml`, jeśli wolisz).
Wymagany jest PostgreSQL 16 lub nowszy, rola będąca właścicielem bazy oraz dostępne
rozszerzenia `pg_trgm` i `unaccent`. Wystarczy wtedy sam obraz – zobacz
[Instalacja](/basedb/pl/guides/installation/).

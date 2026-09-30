---
title: Instalacja
description: Zainstaluj basedb za pomocą Docker Compose lub uruchom stos deweloperski.
---

basedb mieści się w **jednym obrazie Dockera**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 i arm64): **interfejs**, **API** i **serwer MCP**, serwowane pod jednym adresem.
Potrzebuje bazy **PostgreSQL 16**, którą zapewnia plik `docker-compose.yml`.

## Z Docker Compose (zalecane)

Wymagania: Docker z Compose v2. Wystarczą dwa pliki, kod nie jest potrzebny:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Otwórz `.env` i uzupełnij jedyne dwie wymagane wartości:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# wygeneruj raz na zawsze: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Następnie uruchom:

```bash
docker compose up -d
```

Przy pierwszym uruchomieniu basedb tworzy katalog. Otwórz potem
[http://localhost:3000](http://localhost:3000): pierwsza strona poprosi cię o **utworzenie
konta administratora** – z twoim imieniem i nazwiskiem, adresem e-mail i wybranym hasłem – i od
razu jesteś zalogowany.

:::caution[Pierwsza wizyta tworzy administratora]
Dopóki nie istnieje żaden administrator, tworzy go pierwsza osoba, która otworzy interfejs.
Utwórz go **zanim** udostępnisz instancję innym – w domenie albo z portem opublikowanym na
wszystkich interfejsach sieciowych.
:::

Aby zainstalować bez ręcznej interwencji, wskaż administratora w `.env` za pomocą
`BASEDB_ADMIN_EMAIL`: basedb utworzy go przy pierwszym uruchomieniu i wyświetli jego hasło
**tylko raz** w swoich logach (`docker compose logs basedb`), chyba że ustawisz je sam za pomocą
`BASEDB_ADMIN_PASSWORD`.

| Adres | Rola |
|---|---|
| http://localhost:3000 | interfejs |
| http://localhost:3000/api | API REST i jego dokumentacja |
| http://localhost:3000/mcp | serwer MCP dla agentów |
| localhost:5432 | PostgreSQL dla `psql` i twoich narzędzi |

Porty są publikowane tylko na `127.0.0.1`. Aby serwować basedb w domenie, zobacz
[Domena i HTTPS](/basedb/pl/hebergement/https/).

## Z własnym PostgreSQL

Wystarczy sam obraz i baza PostgreSQL 16 lub nowsza (rola będąca właścicielem bazy,
dostępne rozszerzenia `pg_trgm` i `unaccent`):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Zachowaj wygenerowany klucz: zobacz ramkę poniżej.

:::caution[Klucz instancji]
`BASEDB_ENCRYPTION_KEY` podpisuje sesje i szyfruje zapisane sekrety (klucze AI, sekrety
webhooków, sekretne nagłówki automatyzacji, linki formularzy). Jego zmiana wylogowuje
wszystkich i czyni te sekrety nieczytelnymi. Wygeneruj go raz i przechowuj w kopii zapasowej
razem z bazą.
:::

## Dla deweloperów

Wymagania: Node 22 lub nowszy, Docker i `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` wybiera wolne porty, uruchamia jednorazowy PostgreSQL 16, stosuje katalog,
tworzy deweloperskiego administratora (`admin@basedb.local` / `developpement-basedb`, adres
wstępnie wypełniony przy logowaniu), a następnie uruchamia API, serwer MCP i interfejs w trybie
deweloperskim. `Ctrl+C` zatrzymuje wszystko, łącznie z kontenerem.

## Co dalej?

- [Pierwsze kroki](/basedb/pl/guides/premiers-pas/): baza, tabela, widok, formularz.
- [Zmienne środowiskowe](/basedb/pl/hebergement/variables/): pliki, AI, adresy.

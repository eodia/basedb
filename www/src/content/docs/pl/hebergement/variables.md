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

## E-maile

Bez serwera wysyłki basedb nie wysyła żadnego e-maila. Wraz z nim wysyłane są powiadomienia
pozostałe dziesięć minut bez przeczytania (każdy wybiera, które, w **Ustawienia ›
Powiadomienia**), e-maile z kroku automatyzacji **Wyślij e-mail** oraz link do **Nie pamiętam
hasła**. Linki wskazują na `BASEDB_PUBLIC_URL`; bez niej e-mail nie zawiera linku.

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_SMTP_HOST` | – | serwer SMTP: twojej poczty albo usługi wysyłkowej |
| `BASEDB_SMTP_PORT` | `587` | `465` dla połączenia szyfrowanego od razu |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` na porcie 465) | `none` tylko dla przekaźnika na tej samej maszynie: inaczej hasło przechodziłoby jawnym tekstem |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | – | dane konta wysyłkowego, jeśli go wymaga |
| `BASEDB_MAIL_FROM` | – | wymagane z `BASEDB_SMTP_HOST`: nadawca, `basedb <no-reply@exemple.fr>` |

Przy starcie log podaje, co jest ustawione: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` E-mail odrzucony przez serwer jest powtarzany po 1, 5, 30, 120
i 360 minutach.

## Mapy i adresy

Widok **Mapa** umieszcza adres dzięki usłudze geokodowania: domyślnie usłudze OpenStreetMap
(Nominatim), odpytywanej raz na adres, co najwyżej jedno zapytanie na sekundę, z zachowaniem
każdej odpowiedzi. Podłoże mapy składa się z **kafelków**, które przeglądarka każdego czytelnika
wczytuje bezpośrednio.

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | inna usługa mówiąca tym samym protokołem (własny Nominatim); `off`: żadna, adresy nie opuszczają instancji, a wiersze umieszczają wyłącznie szerokość i długość geograficzna |
| `BASEDB_MAP_TILES` | kafelki OpenStreetMap | inny serwer kafelków, według wzoru `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | informacja, której wymaga ten serwer, w prawym dolnym rogu mapy |

Przy starcie log podaje, która usługa jest używana: `Géocodage : https://nominatim.openstreetmap.org.`

## Dokumenty PDF

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_PDF_FONTS` | czcionki Noto z obrazu | własny katalog, zamontowany w kontenerze, zawierający `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, a dla chińskiego, japońskiego i koreańskiego `NotoSansCJK-Regular.ttc` i `-Bold.ttc` |

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

## Publiczne demo

Instancja otwarta dla wszystkich, jak [demo.basedb.eodia.com](https://demo.basedb.eodia.com):
ekran logowania wypełnia z góry wspólne konto, odwiedzający czyta wszystko i modyfikuje to, co
istnieje, ale niczego nie tworzy ani nie usuwa — bazy, tabeli, wiersza, pliku, komentarza,
konta, tokenu, linku —, a AI odpowiada, że nie jest częścią demo. Konsola SQL tylko tam czyta.
Przywracanie bazy do stanu wyjściowego każdej nocy pozostaje po twojej stronie.

| Zmienna | Domyślnie | Rola |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: instancja staje się publicznym demo |
| `BASEDB_DEMO_ACCOUNTS` | — | jedno konto na język, rozdzielone przecinkami: `fr=demo@demo.com,en=demo-en@demo.com`; ekran logowania wypełnia z góry konto swojego języka, w przeciwnym razie angielskie, w przeciwnym razie pierwsze, i proponuje pozostałe. Utwórz te konta, każde z własnym projektem, przed włączeniem demo: odrzuca ono tworzenie czegokolwiek dla wszystkich, łącznie z administratorem |
| `BASEDB_DEMO_PASSWORD` | — | razem z `BASEDB_DEMO_ACCOUNTS` — ich hasło, takie samo dla wszystkich, publikowane razem z nimi |

Bez `BASEDB_DEMO_ACCOUNTS` wspólnym kontem jest administrator wskazany przez
`BASEDB_ADMIN_EMAIL` i `BASEDB_ADMIN_PASSWORD`. Adres demo loguje się opublikowanym hasłem,
niezależnie od tego, co się wpisze: błędne próby nie blokują go dla wszystkich.

## Tylko dla deweloperów

| Zmienna | Rola |
|---|---|
| `BASEDB_DEV_MAIL=1` | wyświetla e-maile w logach zamiast je wysyłać |
| `BASEDB_WEBHOOK_DEV=1` | zezwala na webhooki do HTTP i adresów lokalnych |

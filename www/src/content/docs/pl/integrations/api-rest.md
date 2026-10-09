---
title: API REST
description: Odczytuj i zapisuj wiersze basedb z poziomu programu.
---

API REST jest tym samym API, którego używa interfejs: **nie istnieje żadna prywatna ścieżka**.
Jego adresy URL zawierają nazwy fizyczne – te same, które czytasz w SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Token

W interfejsie, menu **⋯** bazy → **API i agenci** → **Tokeny API i MCP…**: osoba z poziomem
**Zarządzanie** na bazie lub na jej projekcie tworzy tam **token integracji** ograniczony do tej
bazy (wszystkich jej środowisk albo jednego), domyślnie tylko do odczytu, po potwierdzeniu swojego
hasła – konto bez hasła, logujące się przez dostawcę tożsamości, nie może tego jeszcze zrobić.
Jest wyświetlany tylko raz; umieść go w zmiennej środowiskowej.

Token czyta; tworzy i zmienia, jeśli został utworzony z prawem zapisu, a **usuwa, jeśli został
utworzony do tego** — uprawnienia „Odczyt, zapis i usuwanie” — poza wierszem, który zabrałaby ze
sobą relacja kaskadowa razem z innymi. Nigdy nie ma większych uprawnień niż osoba, która go
utworzyła.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Wybór środowiska

Baza, która ma kilka [środowisk](/basedb/pl/fonctionnalites/environnements/) – produkcyjne,
testowe… – pozostaje dla tokena utworzonego dla całej bazy **jedną** bazą. Ścieżka wskazuje bazę
nazwą jej środowiska produkcyjnego, a nagłówek `X-Basedb-Environment` wybiera środowisko:

```bash
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  -H "X-Basedb-Environment: recette"
```

- Bez nagłówka obowiązuje środowisko, które wskazuje ścieżka: `b_t4z56fq_ventes` to środowisko
  produkcyjne, `b_t4z56fq_ventes_recette` – testowe; oba zapisy pozostają ważne.
- `?environment=recette` robi to samo dla klienta, który nie ustawia nagłówka.
- Środowisko wskazuje się jego plakietką, bez rozróżniania wielkości liter i znaków
  diakrytycznych, albo słowem `production`. Środowisko, którego baza nie ma, odpowiada `404`, jak
  każdy nieistniejący zasób.
- `GET /api/v1/<tenant>/meta/bases` wymienia każde środowisko wraz z jego blokiem `environment`
  (`label`, `production`); z nagłówkiem wymienia tylko to jedno.

Token ograniczony przy tworzeniu do jednego środowiska nie otwiera żadnego innego: nagłówek nic tu
nie zmienia. Jego uprawnienia są zawsze zestawiane, środowisko po środowisku, z uprawnieniami
osoby, która go utworzyła.

## Odczyt

| Parametr | Rola |
|---|---|
| `filter` | czytelne wyrażenie: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | kolumny do zwrócenia |
| `limit`, `after` | stronicowanie szyfrowanym kursorem: `meta.next_cursor` strony, przekazane jako `after`, daje następną (`meta.has_next_page`) |
| `links=display` | relacje z ich wartością wyświetlaną |
| `count=exact` | łączna liczba, z górnym limitem 100 000 |
| `variables=raw` | długie teksty w postaci zapisanej, łącznie z `{{colonne}}`, zamiast z [wartościami z wiersza](/basedb/pl/fonctionnalites/tables-et-champs/#tekst-sformatowany-i-zmienne) |

Operatory: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, łączone przez `and`, `or`, `not` i nawiasy. Filtr
przechodzi przez relację: `clients_id.ville eq "Lyon"`.

## Zapis

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` zmienia wiersz z tą samą treścią `{"values": {…}}`. Błędy mają
jednolitą postać: `{ "code": "…", "details": {…}, "request_id": "…" }`, ze stałym kodem dla
każdej przyczyny.

Każdy zapis zwraca nagłówek `x-basedb-transaction`: przekazanie go do
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`) cofa zapis, tak jak Ctrl+Z w
interfejsie – z odmową, jeśli wiersz został w międzyczasie zmieniony.

## Poza wierszami

Z tym samym tokenem:

| Ścieżka | Rola |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | podsumowania wszystkich wierszy filtra: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | odczyt i zapis komentarzy wiersza |
| `POST /api/v1/<tenant>/automations/<id>/run` | uruchomienie automatyzacji wyzwalanej przyciskiem, na wierszu (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | pulpity bazy |
| `GET /api/v1/<tenant>/meta/users` | członkowie przestrzeni roboczej, dla pola Osoba |
| `GET /api/v1/<tenant>/meta/templates` | szablony baz z galerii |
| `GET /api/v1/<tenant>/events?base=<base>&table=<table>` | śledzenie tabeli w czasie rzeczywistym: sygnały, odczytywane potem przez powyższe ścieżki (zobacz [Webhooki](/basedb/pl/integrations/webhooks/#bez-webhooka-śledzenie-tabeli)) |

[Widoki udostępnione](/basedb/pl/fonctionnalites/vues-partagees/) czyta się bez konta:
`GET /api/v1/views/<jeton>` i `…/rows` w JSON, `…/calendar.ics` w iCalendar.

Budowanie – tworzenie automatyzacji, pulpitu, integracji – pozostaje zarezerwowane dla sesji
interfejsu: token czyta i zapisuje wiersze, nie zmienia bazy.

## Kolory i ikony

Tabela i każda opcja listy wyboru mają kolor (`color`, `#rrggbb`) i ikonę (`icon`, nazwa ikony
[Lucide](https://lucide.dev/icons/), którą rysuje interfejs: `truck`, `circle-check`, `flame`…).
`GET …/meta/bases/<base>` zwraca je dla bazy, jej tabel i opcji jej pól.

Aby je ustawić, użyj tokena dostępu osoby, która może zmieniać strukturę
(`POST /auth/session/access`) – token integracji nie zmienia bazy:

| Ścieżka | Treść |
|---|---|
| `POST …/admin/bases/<base>/tables` | `{"label": "Tickets", "color": "#dc2626", "icon": "flame", "fields": […]}` |
| `PATCH …/admin/bases/<base>/tables/<table>` | `{"color": "#2563eb", "icon": "inbox"}` – trzy klucze `color`, `icon`, `image` są traktowane łącznie: podanie jednego zastępuje wszystkie trzy |
| `POST …/admin/bases/<base>/tables/<table>/fields` | `{"label": "Priorité", "kind": "select", "options": [{"value": "haute", "color": "#dc2626", "icon": "flame"}, …]}` |
| `PUT …/admin/bases/<base>/tables/<table>/fields/<champ>/options` | cała lista opcji, po kolei, każda z kolorem i ikoną |

Agent korzysta z [serwera MCP](/basedb/pl/integrations/mcp/#kolory-i-ikony), gdzie te zmiany
**proponuje**. Pole nie ma ikony do wyboru: interfejs rysuje ikonę jego typu.

## Tworzenie bazy z szablonu

Aplikacja, która się instaluje, tworzy swoją bazę **jednym wywołaniem**: serwer stosuje szablon
– tabele, pola, relacje, przykładowe wiersze, widoki, pulpity, automatyzacje – i, jeśli
któryś krok się nie powiedzie, nie zostawia po sobie żadnej bazy.

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/admin/bases" \
  -H "Authorization: Bearer $ACCES" -H "content-type: application/json" \
  -d '{"template": "crm", "label": "Ventes", "rows": false}'
```

`template` to klucz szablonu z galerii albo cały szablon w
[formacie szablonów](/basedb/pl/fonctionnalites/modeles/). Z nagłówkiem
`Accept: application/x-ndjson` odpowiedź przychodzi linia po linii: jedna linia `{"step": …}` na
każdy krok, a potem utworzona baza. To wywołanie wymaga tokenu dostępu osoby, która może
utworzyć bazę (`POST /auth/session/access`, po zalogowaniu): token integracji otwiera tylko
istniejącą bazę.

## Sprawdzanie tokenu

Tokenów basedb nie sprawdza się poza basedb. Aplikacja, która go otrzymuje – na przykład
narzędzie otwarte z basedb z tokenem danej osoby – pyta, ile on jest wart (introspekcja,
RFC 7662), własnym tokenem integracji:

```bash
curl -X POST "http://localhost:3000/auth/introspect" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  --data-urlencode "token=$JETON_RECU"
```

```json
{ "active": true, "token_type": "access_token",
  "sub": "0195a…", "email": "claire@example.com", "name": "Claire Martin",
  "tenant": "t4z56fq", "groups": ["Commerciaux"], "exp": 1790000000 }
```

Każdy token, który nie jest nic wart – nieznany, wygasły, unieważniony, zamknięta sesja, inna
przestrzeń robocza – odpowiada `{"active": false}`, bez podania przyczyny. Odpowiedź jest
czytana na żywo: wylogowanie widać natychmiast. Dla tokenu integracji odpowiedź podaje też
bazę, którą otwiera (`base`, jej środowisko produkcyjne), czy otwiera wszystkie jej środowiska
(`environments`: `all`), czy tylko jedno (`one`), jego dostęp (`read`, `write` lub `delete`) oraz
jego powierzchnie.

## Generowana dokumentacja

Każda baza ma swoją stronę **Dokumentacja API i MCP**: dla każdej tabeli jej punkty dostępowe,
kolumny, przykłady w cURL i w JavaScripcie. Jest **filtrowana według twoich uprawnień** – dwie
osoby czytające otrzymują dwie wersje –, napisana **w języku twojego ekranu**, i istnieje też
w formacie OpenAPI 3.1 (`/api/v1/<tenant>/meta/bases/<base>/openapi.json`), który deklaruje token
Bearer i nagłówek `X-Basedb-Environment`. Nazwy, ścieżki i kody błędów pozostają takie same we
wszystkich językach.

![Generowana dokumentacja bazy](../../../../assets/screens/pl/documentation-api.webp)

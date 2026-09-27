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

W interfejsie, menu **⋯** bazy → **API i agenci** → **Tokeny API i MCP…**: tworzy się tam **token
integracji** ograniczony do tej bazy, domyślnie tylko do odczytu, po potwierdzeniu swojego
hasła. Jest wyświetlany tylko raz; umieść go w zmiennej środowiskowej.

Token czyta, tworzy i zmienia, jeśli został utworzony z prawem zapisu, **nigdy niczego nie
usuwa** i nigdy nie ma większych uprawnień niż osoba, która go utworzyła.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Odczyt

| Parametr | Rola |
|---|---|
| `filter` | czytelne wyrażenie: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | kolumny do zwrócenia |
| `limit`, `cursor` | stronicowanie szyfrowanym kursorem (`next_cursor` w odpowiedzi) |
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

[Widoki udostępnione](/basedb/pl/fonctionnalites/vues-partagees/) czyta się bez konta:
`GET /api/v1/views/<jeton>` i `…/rows` w JSON, `…/calendar.ics` w iCalendar.

Budowanie – tworzenie automatyzacji, pulpitu, integracji – pozostaje zarezerwowane dla sesji
interfejsu: token czyta i zapisuje wiersze, nie zmienia bazy.

## Generowana dokumentacja

Każda baza ma swoją stronę **Dokumentacja API i MCP**: dla każdej tabeli jej punkty dostępowe,
kolumny, przykłady w cURL i w JavaScripcie. Jest **filtrowana według twoich uprawnień** – dwie
osoby czytające otrzymują dwie wersje – i istnieje też w formacie OpenAPI 3.1
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`).

![Generowana dokumentacja bazy](../../../../assets/screens/documentation-api.png)

---
title: Serwer MCP
description: Podłącz agenta AI do basedb przez Model Context Protocol.
---

basedb udostępnia **serwer MCP** (`POST /mcp`, pod tym samym adresem co interfejs): agent –
Claude, asystent programisty, twój własny agent – odkrywa w nim bazy, czyta i zapisuje wiersze
oraz **proponuje** zmiany struktury.

## Podłączanie agenta

Utwórz token w **Tokeny API i MCP…** (menu bazy, w **API i agenci**), z zaznaczonym dostępem
MCP. Ten sam token służy do API REST i do MCP.

Dla klienta, który mówi HTTP, adres to `http://localhost:3000/mcp` z
`Authorization: Bearer <jeton>`. Dla klienta, który uruchamia procesy (stdio), repozytorium
dostarcza przekaźnik, który czyta token ze zmiennej środowiskowej – nigdy z konfiguracji:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Dwanaście narzędzi

| Narzędzie | Rola |
|---|---|
| `whoami` | kim jest agent i z jakimi uprawnieniami |
| `list_bases`, `describe_base`, `describe_table` | odkrywanie struktury i jej opisów |
| `list_records`, `get_record`, `lookup_records` | odczyt, filtrowanie, rozwiązywanie wartości wyświetlanej |
| `create_record`, `update_record` | zapis wierszy |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proponowanie zmiany struktury |

## Czego agent nie robi

- **Niczego nie usuwa.**
- **Nie zmienia struktury**: proponuje ją. Propozycja czeka w **Propozycje agentów…** (menu
  bazy), gdzie osoba zarządzająca strukturą ją zatwierdza lub odrzuca; bez decyzji wygasa po
  24 godzinach.
- **Nigdy nie ma większych uprawnień** niż osoba, która utworzyła jego token: uprawnienia tokena
  są zawężane do części wspólnej z uprawnieniami tej osoby.
- Nie widzi pól oznaczonych jako niewidoczne dla agentów ani baz zamkniętych dla MCP.

Każde wywołanie jest rejestrowane według kształtu jego parametrów, nigdy według ich wartości.

---
title: Serwer MCP
description: Podłącz agenta AI do basedb przez Model Context Protocol.
---

basedb udostępnia **serwer MCP** (`POST /mcp`, pod tym samym adresem co interfejs): agent –
Claude, asystent programisty, twój własny agent – odkrywa w nim bazy, czyta i zapisuje wiersze,
usuwa je, jeśli mu na to pozwolisz, oraz **proponuje** zmiany struktury.

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

## Czternaście narzędzi

| Narzędzie | Rola |
|---|---|
| `whoami` | kim jest agent i z jakimi uprawnieniami |
| `list_bases`, `describe_base`, `describe_table` | odkrywanie struktury i jej opisów |
| `list_records`, `get_record`, `lookup_records` | odczyt, filtrowanie, rozwiązywanie wartości wyświetlanej |
| `create_record`, `update_record` | zapis wierszy |
| `delete_record`, `restore_record` | usunięcie wiersza — tokenem utworzonym do tego — i jego przywrócenie |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proponowanie zmiany struktury |

## Usuwanie wierszy

Token utworzony z uprawnieniami **Odczyt, zapis i usuwanie** pozwala agentowi usuwać
wiersze, **po jednym na raz**, po ich `_id`. `delete_record` zwraca wiersz takim, jaki był,
a usunięcie jest odnotowane w historii w imieniu tokena; `restore_record` przywraca wiersz pod
jego `_id` — agent sam naprawia swój błąd, a osoba może to zrobić również z historii.

Agent nie usuwa:

- tokenem tylko do odczytu albo do odczytu i zapisu: odmowa mówi, jaki token trzeba utworzyć;
- wiersza, który relacja kaskadowa zabrałaby razem z innymi (`TOKEN_CASCADE_FORBIDDEN`): takie
  usunięcie wykonuje się w interfejsie, przez osobę, która widzi, co zostanie zabrane;
- wielu wierszy na raz: żadne narzędzie tego nie robi.

## Czego agent nie robi

- **Usuwa tylko za twoją zgodą**: token utworzony do tego celu, jeden wiersz na raz.
- **Nie zmienia struktury**: proponuje ją. Propozycja czeka w **Propozycje agentów…** (menu
  bazy), gdzie osoba zarządzająca strukturą ją zatwierdza lub odrzuca; bez decyzji wygasa po
  24 godzinach.
- **Nigdy nie ma większych uprawnień** niż osoba, która utworzyła jego token: uprawnienia tokena
  są zawężane do części wspólnej z uprawnieniami tej osoby.
- Nie widzi pól oznaczonych jako niewidoczne dla agentów ani baz zamkniętych dla MCP.

Każde wywołanie jest rejestrowane według kształtu jego parametrów, nigdy według ich wartości.

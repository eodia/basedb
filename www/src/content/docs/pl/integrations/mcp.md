---
title: Serwer MCP
description: Podłącz agenta AI do basedb przez Model Context Protocol.
---

basedb udostępnia **serwer MCP** (`POST /mcp`, pod tym samym adresem co interfejs): agent –
Claude, asystent programisty, twój własny agent – odkrywa w nim bazy, czyta i zapisuje wiersze,
usuwa je, jeśli mu na to pozwolisz, oraz **proponuje** zmiany struktury.

## Podłączanie agenta

Utwórz token w **Tokeny API i MCP…** (menu bazy, w **API i agenci**), z zaznaczonym dostępem
MCP. Ten sam token służy do API REST i do MCP oraz otwiera **całą bazę**: jej środowisko
produkcyjne i pozostałe środowiska (zobacz niżej).

Umieść token w zmiennej środowiskowej `BASEDB_TOKEN`, nigdy w pliku konfiguracyjnym. Klient, który
mówi MCP przez HTTP – między innymi Claude Code – kieruje się bezpośrednio pod `…/mcp` z nagłówkiem
`Authorization: Bearer <jeton>`. W Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Polecenie zapisuje plik `.mcp.json` projektu, w którym `${BASEDB_TOKEN}` pozostaje odwołaniem do
zmiennej: sam token w nim nie występuje.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Klient, który potrafi uruchamiać wyłącznie programy lokalne (stdio), korzysta z przekaźnika z
repozytorium, który odczytuje token ze zmiennej wskazanej przez `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Poproś następnie agenta o wywołanie `whoami`: powie, kto utworzył token, jaką bazę otwiera, jakie
ma środowiska i jakie ma uprawnienia.

## Wybór środowiska

Baza może mieć kilka [środowisk](/basedb/pl/fonctionnalites/environnements/) – produkcyjne,
testowe, deweloperskie –, każde z własnymi tabelami i wierszami. Token całej bazy otwiera je
wszystkie, a środowisko wybiera się od najogólniejszego sposobu do najdokładniejszego:

- **sama nazwa bazy**, bez niczego więcej: `crm` to środowisko produkcyjne, `crm_recette` –
  testowe;
- **adres serwera**: `…/mcp?environment=recette` kieruje całe połączenie do środowiska testowego.
  Przekaźnik robi to samo z `--environment recette`. W ten sposób deklaruje się po jednym serwerze
  na środowisko, wszystkie na tym samym tokenie:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **argument `environment`** każdego narzędzia, które wskazuje bazę, dla pojedynczego wywołania:
  `list_records` z `{"base": "crm", "table": "clients", "environment": "recette"}`.

Środowisko wskazuje się jego plakietką, bez rozróżniania wielkości liter i znaków
diakrytycznych (`Recette`, `recette`, `developpement` dla „Développement”), albo słowem
`production`. `whoami` wymienia te, które token otwiera; `list_bases` i `describe_base` mówią,
z którego środowiska pochodzi każda baza.

Token może też zostać ograniczony przy tworzeniu do jednego środowiska: nie widzi wtedy żadnego
innego.

## Piętnaście narzędzi

| Narzędzie | Rola |
|---|---|
| `whoami` | kim jest agent, z jakimi uprawnieniami i na jakich środowiskach |
| `list_bases`, `describe_base`, `describe_table` | odkrywanie struktury, jej opisów i wyglądu |
| `list_records`, `get_record`, `lookup_records` | odczyt, filtrowanie, rozwiązywanie wartości wyświetlanej |
| `create_record`, `update_record` | zapis wierszy |
| `delete_record`, `restore_record` | usunięcie wiersza — tokenem utworzonym do tego — i jego przywrócenie |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proponowanie zmiany struktury |
| `propose_update_look` | proponowanie koloru i ikony tabeli oraz jej opcji |

## Kolory i ikony

Tabela i każda opcja listy wyboru mają kolor i ikonę, tak jak w interfejsie. Agent wybiera je,
składając propozycję:

- `propose_create_table` przyjmuje `color` i `icon` dla tabeli;
- `propose_add_field` przyjmuje `color` i `icon` dla każdej opcji pola `select` lub `multi_select`;
- `propose_update_look` zmienia te ustawienia dla istniejącej tabeli i jej opcji: pominięty klucz
  zachowuje to, co jest ustawione, `null` to usuwa.

`color` to kolor `#rrggbb`. `icon` to nazwa ikony [Lucide](https://lucide.dev/icons/) spośród tych,
które rysuje interfejs – `truck`, `circle-check`, `flame`…: schemat narzędzia je wylicza, a nieznana
nazwa zostaje odrzucona. `describe_base` i `describe_table` zwracają aktualny wygląd. Pole
natomiast nie ma ikony do wyboru: interfejs rysuje ikonę jego typu.

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
- **Nie zmienia struktury** – ani jej wyglądu: proponuje ją. Propozycja czeka w **Propozycje
  agentów…** (menu bazy), gdzie osoba zarządzająca strukturą ją zatwierdza lub odrzuca; bez
  decyzji wygasa po 24 godzinach.
- **Nigdy nie ma większych uprawnień** niż osoba, która utworzyła jego token: uprawnienia tokena
  są zawężane do części wspólnej z uprawnieniami tej osoby, środowisko po środowisku.
- Nie widzi pól oznaczonych jako niewidoczne dla agentów ani baz zamkniętych dla MCP.

Każde wywołanie jest rejestrowane według kształtu jego parametrów, nigdy według ich wartości.

---
title: n8n
description: Odczytuj i zapisuj wiersze basedb z workflow n8n oraz uruchamiaj go przy każdym utworzonym, zmienionym lub usuniętym wierszu.
---

Pakiet **n8n-nodes-basedb** dodaje do n8n trzy węzły:

| Węzeł | Rola |
|---|---|
| **basedb** | odczytuje i zapisuje wiersze tabeli, komentuje wiersz; można go użyć jako narzędzia przez agenta AI w n8n |
| **basedb Trigger** | uruchamia workflow dla każdego wiersza utworzonego — albo utworzonego lub zmienionego — od ostatniego sprawdzenia |
| **basedb Webhook Trigger** | uruchamia workflow w chwili, gdy wiersz jest tworzony, zmieniany albo usuwany |

## Instalacja

W n8n: **Settings › Community Nodes › Install**, a potem `n8n-nodes-basedb`.

Bez interfejsu — tryb kolejki, obraz Docker zmontowany z wyprzedzeniem — : `npm install
n8n-nodes-basedb` w katalogu `~/.n8n/nodes`, a potem uruchom n8n ponownie.

## Dane uwierzytelniające

Utwórz w n8n dane uwierzytelniające **basedb API**:

| Pole | Wartość |
|---|---|
| **Instance URL** | adres, pod którym otwierasz basedb: `https://basedb.exemple.fr` |
| **Workspace** | identyfikator przestrzeni, ten z adresów API (`/api/v1/<przestrzeń>/…`): `t4z56fq`, o ile instancja nie ustala `BASEDB_TENANT` |
| **Token** | **token integracji**: menu **⋯** bazy → **API i agenci** → **Tokeny API i MCP…** |

Token otwiera **jedną** bazę. Odczytuje jej wiersze, zapisuje je, jeśli został utworzony z
prawem zapisu, i nigdy nie ma większych uprawnień niż osoba, która go utworzyła. Przy
zapisywaniu n8n sprawdza połączenie i informuje, jeśli token jest odrzucony.

## Odczyt i zapis: węzeł basedb

| Operacja | Co robi |
|---|---|
| **Row › Create** | dodaje wiersz |
| **Row › Create or Update** | zmienia wiersz, którego wybrane pola mają te wartości, albo dodaje go, jeśli żaden ich nie ma |
| **Row › Get** | odczytuje wiersz po jego `_id` |
| **Row › Get Many** | odczytuje wiersze z filtra, w żądanym porządku, do limitu albo wszystkie, stronami |
| **Row › Update** | zmienia wiersz, znaleziony po jego `_id` albo po innych polach |
| **Comment › Create** | komentuje wiersz; @wzmianka powiadamia osobę |

**Bazę** i **tabelę** wybiera się z list, tych, które otwiera token. Pola do zapisania
wyświetlają się pod swoją nazwą w basedb, pojedynczy wybór z jego opcjami, pole Osoba z
członkami przestrzeni; pole obliczane — formuła, odnośnik, agregacja, autonumer — nie
występuje w nich, bo basedb zapisuje je samo. Wartość odrzucona przez pole zatrzymuje węzeł
na kodzie basedb i jego znaczeniu.

- **Filtr** i **sortowanie** używają technicznych nazw pól, tych z SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Gramatyka jest tą z
  [API REST](/basedb/pl/integrations/api-rest/#odczyt).
- **Liczby** przychodzą jako tekst dziesiętny (`"1250.50"`), żeby nie zgubić żadnej cyfry;
  opcja **Numbers as Numbers** zamienia je na liczby.
- **Relacja** odczytuje się jako `{ "id": …, "display": … }`, a zapisuje przez `_id`
  powiązanego wiersza.
- **Create or Update** nigdy nie zmienia kilku wierszy: jeśli kilka ma te wartości, węzeł
  zatrzymuje się, zamiast zgadywać.
- Bez operacji **Delete**: aby usunąć wiersze, oznacz je (status „Archivé”), powierz usuwanie
  [automatyzacji](/basedb/pl/fonctionnalites/automatisations/), albo wywołaj
  [API REST](/basedb/pl/integrations/api-rest/) tokenem utworzonym do usuwania.

## Uruchamianie workflow

### Przy każdym sprawdzeniu: basedb Trigger

Węzeł pyta basedb, w wybranym rytmie (co minutę, co godzinę…), o wiersze **utworzone** — albo
**utworzone lub zmienione** — od ostatniego razu, dodatkowo z filtrem, jeśli trzeba. Działa
wszędzie, nawet gdy basedb nie może połączyć się z n8n. Przy pierwszym sprawdzeniu zapisuje, w
którym miejscu jest tabela, i nic nie emituje; próba z edytora zwraca ostatni wiersz, żeby mieć
czym połączyć kolejne węzły.

### Natychmiast: basedb Webhook Trigger

Każdy wiersz utworzony, zmieniony albo usunięty — nawet przez SQL napisany bezpośrednio w
PostgreSQL — uruchamia workflow od razu:

1. Dodaj węzeł i skopiuj jego **Production URL**.
2. W basedb, menu **⋯** bazy → **API i agenci** → **Webhooki…**: utwórz webhook na ten adres,
   wybierz jego tabele i zdarzenia.
3. basedb pokazuje raz **sekret podpisu**: umieść go w danych uwierzytelniających
   **basedb Webhook** w n8n.
4. Włącz workflow.

Każde zdarzenie staje się elementem: jego `type` (`record.created`, `record.updated`,
`record.deleted`), tabela, wiersz **przed** i **po** oraz zmienione pola (`changed`). Węzeł
sprawdza **podpis** każdej dostawy i odpowiada `401` tej, która go nie ma, ma fałszywy, albo
jest starsza niż pięć minut. basedb dostarcza **co najmniej raz**: usuń duplikaty po `id`
zdarzenia, jeśli workflow nie powinien go przetworzyć dwa razy.

:::note
basedb wysyła webhook tylko na adres **publiczny HTTPS**: n8n w sieci prywatnej używa raczej
**basedb Trigger**. Zobacz [Webhooki](/basedb/pl/integrations/webhooks/).
:::

## Bez węzła

Węzeł **HTTP Request** n8n też rozmawia z basedb: nagłówek `Authorization: Bearer <token>`,
JSON w obie strony, stronicowanie przez `meta.next_cursor` przekazane jako `after`
(`{{ $response.body.meta.next_cursor }}`), i wznowienie po awarii przez filtr na
`_updated_at` oraz przez `…/<table>/deleted?since=`.

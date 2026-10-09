---
title: Środowiska
description: Produkcyjne, testowe, deweloperskie – porównywanie, migrowanie, synchronizowanie.
---

Baza może mieć **środowiska**: produkcyjne, testowe, deweloperskie… Każde jest pełnoprawną
bazą – z własnym schematem, tabelami, wierszami i uprawnieniami – a wszystkie dzielą
**rodowód** bazy, jej tabel i pól.

## W interfejsie

Pasek boczny pokazuje **jeden wiersz na bazę**, z plakietką, która wskazuje otwarte
środowisko i pozwala je zmienić. Plakietka nie pojawia się, dopóki istnieje tylko środowisko
produkcyjne.

Środowiska dodaje się, zmienia im nazwy i usuwa w **Edytuj bazę…**: nowe środowisko powstaje
z **kopii struktury** innego, bez jego wierszy.

## Porównywanie środowisk

Z menu bazy, w **Więcej działań**, **Porównaj środowiska…** otwiera okno dialogowe:

- **Struktura**: środowiska w kolumnach, tabele i pola w wierszach; to, co różni się od
  środowiska produkcyjnego, jest wyróżnione.
- **Zastosuj migracje…** przygotowuje plan przejścia z jednego środowiska do drugiego, krok
  po kroku. Nigdy nie zaznacza automatycznie tego, co cofnęłoby nowszą zmianę w środowisku
  docelowym.
- **Synchronizacja wierszy**: tabela po tabeli, przenoszenie wierszy z jednego środowiska do
  drugiego według identyfikatora.

![Porównanie środowiska produkcyjnego i testowego](../../../../assets/screens/pl/environnements.webp)

## Skąd basedb wie, kto co zmienił

Porównanie opiera się na **historii struktur**: każde utworzenie, zmiana lub usunięcie tabeli
czy pola jest rejestrowane przez wyzwalacz w katalogu i widoczne w zakładce „Struktura”
historii. Identyfikatory rodowodu łączą pole ze środowiska testowego z jego odpowiednikiem w
środowisku produkcyjnym, nawet po zmianie nazwy.

## Przez API, SDK i MCP

**Token utworzony dla całej bazy** otwiera wszystkie jej środowiska, te dzisiejsze i te, które
zostaną dodane: jeden token dla środowiska produkcyjnego i testowego. Program lub agent wybiera
środowisko przy każdym wywołaniu:

| Gdzie | Jak |
|---|---|
| [API REST](/basedb/pl/integrations/api-rest/#wybór-środowiska) | nagłówek `X-Basedb-Environment: recette` lub `?environment=recette` |
| [SDK](/basedb/pl/integrations/sdk/#środowiska) | `db.environment('recette')` |
| [MCP](/basedb/pl/integrations/mcp/#wybór-środowiska) | adres `…/mcp?environment=recette` lub argument `environment` narzędzia |
| [n8n](/basedb/pl/integrations/n8n/#dane-uwierzytelniające) | pole **Environment** danych uwierzytelniających |

Bez żadnego z tych sposobów każda baza wskazuje swoje własne środowisko: nazwa środowiska
produkcyjnego otwiera produkcyjne, nazwa testowego – testowe. Token można też przy tworzeniu
ograniczyć do wyświetlanego środowiska: nie widzi wtedy żadnego innego. W obu przypadkach jego
uprawnienia są zestawiane, środowisko po środowisku, z uprawnieniami osoby, która go utworzyła.

## W SQL

Każde środowisko jest schematem: `b_t4z56fq_ventes` dla środowiska produkcyjnego,
`b_t4z56fq_ventes_recette` dla testowego. Twoje zapytania zmieniają środowisko przez zmianę
schematu – lub `search_path`.

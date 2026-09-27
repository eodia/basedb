---
title: Pierwsze kroki
description: Utwórz bazę, tabelę, pola, widok i formularz.
---

Ta ścieżka zajmuje dziesięć minut i obejmuje to, co najważniejsze: na końcu będziesz mieć
tabelę, widok kanban i publiczny formularz, który do niej zapisuje.

:::tip[Aby zobaczyć wszystko naraz]
Pusty projekt proponuje **bazę demonstracyjną**: małą agencję, jej klientów, projekty,
zadania, faktury i opinie, z formułami, widokami każdego rodzaju, pulpitem i
automatyzacjami. **Nowa baza** otwiera też [galerię szablonów](/basedb/pl/fonctionnalites/modeles/),
w której można opisać swoją bazę AI.
:::

## 1. Utwórz bazę

Wszystko jest zorganizowane według **projektów**: selektor u góry paska bocznego przełącza
projekt lub tworzy nowy. Na pasku **+** po prawej stronie filtra tworzy bazę. Nadaj jej
etykietę – „Ventes” – i, jeśli chcesz, opis, kolor i ikonę.

Baza staje się **schematem PostgreSQL**: jej nazwa fizyczna (`b_t4z56fq_ventes`) pojawia się w
formularzu i w generowanej dokumentacji.

## 2. Utwórz tabelę i jej pola

Z menu **⋯** bazy: **Nowa tabela**. Następnie dodaj jej pola z ekranu **Struktura** – w tym
samym menu – za pomocą przycisku **Pole**:

| Pole | Typ |
|---|---|
| Nom | Krótki tekst |
| Statut | Pojedynczy wybór – Nouveau, Qualifié, Gagné, Perdu |
| Montant | Waluta |
| Échéance | Data |
| Client | Relacja → Clients |
| Notes | Długi tekst (Markdown) |

Później w ten sam sposób dodasz formułę (`JOURS([Échéance]; AUJOURDHUI())`), odnośnik (miasto
klienta) albo agregację (łączna kwota na klienta) – zobacz
[Tabele i pola](/basedb/pl/fonctionnalites/tables-et-champs/).

Możesz też **zaimportować plik** CSV lub JSON: import odgaduje typy, pozwala je poprawić,
tworzy tabelę lub uzupełnia istniejącą i podaje, wiersz po wierszu, co odrzuca.

![Menu bazy](../../../../assets/screens/menu-base.png)

## 3. Wprowadzaj dane i filtruj

Siatkę edytuje się jak arkusz kalkulacyjny: dwukrotne kliknięcie lub Enter, aby zmienić
komórkę, Esc, aby anulować. **Filtruj** łączy warunki dla poszczególnych pól; sortowanie
ustawiasz w nagłówku kolumny; **Szukaj…**, po prawej stronie paska, przeszukuje wszystkie
kolumny. Każda zmiana jest zapisywana od razu – i [trafia do historii](/basedb/pl/fonctionnalites/historique/):
**Ctrl+Z** cofa ostatnią.

## 4. Dodaj widok

Selektor widoków, na lewo od „Filtruj”, proponuje „Wszystkie wiersze”, a potem twoje widoki.
Utwórz **kanban** pogrupowany według „Statut”: przeciągnięcie karty z jednej kolumny do
drugiej zmienia wiersz.

![Kanban według statusu](../../../../assets/screens/kanban.png)

## 5. Udostępnij formularz

Utwórz widok **Formularz**, zaznacz pytania, a potem **Udostępnij**: wybierz „Publiczny”,
skopiuj link. Każda odpowiedź dodaje wiersz do tabeli, nie dając osobie odpowiadającej żadnych
uprawnień. Szczegóły w [Formularze udostępnione](/basedb/pl/fonctionnalites/formulaires-partages/).

## 6. Czytaj w SQL

Menu **⋯** bazy → **Nowe zapytanie SQL**: twoje tabele są tam pod swoimi prawdziwymi nazwami.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Zapisz** umieszcza je pod tabelami, w sekcji „Zapytania” – dla ciebie albo dla całej
bazy – a **⋯** → **Utwórz widok SQL…** robi z niego prawdziwy widok PostgreSQL, ułożony wśród
tabel. Każdy czyta je ze swoimi własnymi uprawnieniami. Zobacz
[Zapytania i widoki SQL](/basedb/pl/fonctionnalites/requetes-et-vues-sql/).

Tak samo jest z poziomu `psql` czy twojego narzędzia BI. Zobacz [Bezpośredni SQL](/basedb/pl/integrations/sql/).

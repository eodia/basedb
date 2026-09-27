---
title: Zapytania i widoki SQL
description: SQL dla każdego, z jego własnymi uprawnieniami; zapisane zapytania pod tabelami, osobiste lub udostępnione; prawdziwe widoki PostgreSQL ułożone wśród tabel.
---

Twoje tabele są prawdziwymi tabelami PostgreSQL, a interfejs odpytuje je w SQL, pod ich
prawdziwymi nazwami. Każdy członek bazy może napisać zapytanie i je **zapisać** pod tabelami –
tylko dla siebie, dla całej bazy lub dla kilku grup –, a osoba zarządzająca bazą może zrobić z
niego **widok SQL**: prawdziwy widok PostgreSQL, ułożony wśród tabel, który czytają też `psql` i
twoje narzędzia.

![Zapisane zapytanie otwarte z sekcji „Zapytania”; powyżej dwa widoki SQL ułożone wśród tabel](../../../../assets/screens/requete-sql.png)

## Każdy ze swoimi uprawnieniami

**+** na pasku zakładek albo menu **⋯** bazy → **Zapytanie SQL** otwiera zakładkę SQL: edytor z
kolorowaniem składni i podpowiadaniem, **Ctrl+Enter**, aby wykonać, i wynik w tej samej siatce
co twoje tabele. To, co zapytanie może czytać, zależy od tego, kto je uruchamia:

- z poziomem **Zarządzanie** na bazie – całą bazę, łącznie z zapisami;
- z poziomem **Odczyt** lub **Edycja** zapytanie wykonuje się **tylko do odczytu, z twoimi
  własnymi uprawnieniami**. Tabela zamknięta przed tobą dla niego nie istnieje; pole ukryte
  przed tobą znika z `SELECT *` i jest odrzucane, jeśli je nazwiesz, nawet z kwalifikacją
  tabeli; zapis jest odrzucany. Wynik ma plakietkę **Twoje uprawnienia**.

![Plakietka „Twoje uprawnienia”: zapytanie widzi tylko tabele i pola dostępne dla danej osoby](../../../../assets/screens/sql-vos-droits.png)

To nie ekran filtruje: sam PostgreSQL egzekwuje twoje uprawnienia, kolumna po kolumnie, na
roli właściwej tylko tobie. Zapytanie nie może więc pokazać ci niczego, czego nie pokazałyby ci
siatka, API czy serwer MCP.

## Zapisywanie zapytania

**Zapisz**, na pasku zakładki, umieszcza zapytanie pod tabelami bazy, w sekcji **Zapytania**.
Otwiera się je ponownie jednym kliknięciem; **⋯** → **Zapisz jako…** tworzy kopię, a **Nazwa i
udostępnianie…** (w zakładce lub w menu zapytania na pasku bocznym) zmienia nazwę, zmienia, kto je
widzi, albo je usuwa — **Usuń** jest też w jego menu, dostępnym kliknięciem prawym przyciskiem.
Zakładka, która je pokazywała, zachowuje swój tekst.

![Zapisywanie zapytania: jego nazwa, co pokazuje i kto je widzi](../../../../assets/screens/requete-enregistrer.png)

| Zasięg | Kto je widzi | Kto może je tworzyć i zmieniać |
|---|---|---|
| **Osobiste** – kłódka | tylko ty | każdy, kto widzi bazę, dla siebie |
| **Cała baza** | każdy, kto widzi bazę | poziom **Zarządzanie** na bazie |
| **Grupy** | członkowie wybranych grup | poziom **Zarządzanie** na bazie |

**Udostępnienie zapytania udostępnia jego tekst, nigdy to, co może czytać jego autor.** Każdy
wykonuje je ze swoimi własnymi uprawnieniami: to samo zapytanie, otwarte przez dwie osoby,
pokazuje każdej to, co ma prawo widzieć – albo mówi jej, że dana kolumna dla niej nie istnieje.

Zapytanie otwarte z paska bocznego **wykonuje się od razu, tylko do odczytu**: widzisz jego
wynik bez podejmowania żadnej decyzji. **Uruchom** wykonuje je potem ponownie w obecnej postaci.
Kropka obok jego nazwy sygnalizuje, że jego tekst został zmieniony od czasu zapisania; **Zapisz**
zapisuje je w tym miejscu, jeśli możesz je zmieniać, a w przeciwnym razie proponuje utworzenie
nowego.

## Widoki SQL

**Widok SQL** to prawdziwy widok PostgreSQL w schemacie bazy. Zajmuje miejsce **wśród tabel**,
z kolorem i ikoną jak tabela, oraz małym **okiem** po prawej, które mówi, że to widok.
Kliknięcie otwiera go w zakładce: jego wiersze w siatce, **Odśwież**, aby odczytać je ponownie.

![Widok „Factures à encaisser” otwarty z paska bocznego](../../../../assets/screens/vue-sql.png)

Tworzy się go z menu **⋯** bazy → **Nowy widok SQL…** albo z zakładki SQL: **⋯** → **Utwórz
widok SQL…**, a zapytanie z zakładki staje się jego definicją. Okno dialogowe pyta o:

- jego **etykietę** i **wygląd** – kolor, ikonę lub obraz, wybierane jak dla tabeli;
- jego **nazwę techniczną**, tworzoną z etykiety, jeśli jej nie podasz – tę, którą pisze się
  po `FROM`;
- jego **zapytanie**: jeden `SELECT` na tabelach i innych widokach bazy. PostgreSQL odrzuca
  to, co odrzuca, a edytor wskazuje miejsce błędu.

![Okno widoku SQL: etykieta i wygląd, nazwa techniczna, zapytanie, opis](../../../../assets/screens/vue-sql-dialogue.png)

Widok czyta się potem pod jego nazwą, zarówno z interfejsu, jak i z `psql` czy twojego
narzędzia BI:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Widok nigdy nie pokazuje pola, którego nie widzisz.** Każdy czyta go ze swoimi własnymi
uprawnieniami, do każdej tabeli i każdej kolumny, którą widok czyta; pasek boczny pokazuje go
tylko osobom, które mogą czytać wszystko, co on czyta. Czyta tylko **swoją** bazę: inna baza
czy katalog basedb są odrzucane już przy tworzeniu. Utworzenie, zmiana lub usunięcie widoku
wymaga poziomu **Zarządzanie** na bazie. **Usuń**, w jego menu na pasku bocznym, usuwa go dla
wszystkich, łącznie ze skryptami i narzędziami; tabele, które czyta, pozostają nietknięte.

### Gdy zmienia się struktura

- **Zmiana nazwy** tabeli lub pola nie psuje widoku: PostgreSQL za nią podąża.
- **Zmiana formuły** czytanego przez widok pola obliczanego na chwilę go usuwa, a potem
  odtwarza na nowej kolumnie. Jeśli przestaje działać, pozostaje **do poprawienia** – wskazuje
  to trójkąt na pasku bocznym – z zachowaną definicją: **Edytuj widok…**, popraw, zapisz.
- Tabela nie jest trwale usuwana, dopóki czyta ją jakiś widok, a widok nie jest usuwany, dopóki
  czyta go inny widok: odmowa wskazuje widok, o który chodzi.

## Zapytanie, widok SQL czy pytanie?

| | Czym jest | Gdzie żyje | Do czego |
|---|---|---|---|
| **Zapisane zapytanie** | tekst SQL | pod tabelami, w sekcji „Zapytania” | by wrócić do zapytania, udostępnić je jako tekst |
| **Widok SQL** | prawdziwy widok PostgreSQL | wśród tabel | by nadać nazwę odczytowi, dla interfejsu **i** dla `psql`, twoich skryptów, twoich narzędzi |
| **Pytanie** | odczyt zbudowany myszą lub w SQL, wraz z jego wizualizacją | na [pulpitach](/basedb/pl/fonctionnalites/tableaux-de-bord/) | liczba, wykres, tabela przestawna, przy filtrach |

## Ograniczenia

- Siatka pokazuje najwyżej tyle **wierszy na stronę**, ile wybrano na dole ekranu; „obcięto”
  to sygnalizuje. Zapytanie zatrzymuje się po 15 sekundach.
- Widok SQL czyta się w SQL i w interfejsie; API REST i serwer MCP go nie udostępniają.
- Widok SQL pozostaje w środowisku, w którym go utworzono: utworzenie środowiska, porównanie
  struktury czy zapisanie szablonu jeszcze go nie przenoszą.

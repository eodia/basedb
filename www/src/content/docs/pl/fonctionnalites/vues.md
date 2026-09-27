---
title: Widoki
description: Siatka, kanban, kalendarz, oś czasu, galeria, lista, formularz i ankieta – wspólne lub osobiste.
---

Tabelę można pokazać na **osiem sposobów**. Widok nie kopiuje żadnych danych i nie daje
żadnych uprawnień ponad te, które daje sama tabela.

:::note
Te widoki to sposoby pokazania **jednej** tabeli. [Widok SQL](/basedb/pl/fonctionnalites/requetes-et-vues-sql/)
to coś innego: prawdziwy widok PostgreSQL, napisany w SQL na tabelach bazy i ułożony wśród
nich na pasku bocznym.
:::

| Widok | Co pokazuje | Czego wymaga |
|---|---|---|
| **Siatka** | wiersze, filtrowane, sortowane, grupowane, z wybranymi kolumnami | – |
| **Kanban** | karty w kolumnach | pojedynczego wyboru |
| **Kalendarz** | wiersze w ich dacie, w widoku miesiąca lub tygodnia | pola daty |
| **Oś czasu** | paski między dwiema datami i ich zależności | daty początkowej |
| **Galeria** | karty z obrazem okładki | – |
| **Lista** | jeden wiersz na rekord, w zwijanych grupach | – |
| **Formularz** | stronę pytań do utworzenia wiersza | – |
| **Ankieta** | te same pytania, po jednym na ekran | – |

## Selektor widoków

Znajduje się na lewo od „Filtruj”. „Wszystkie wiersze” to siatka tabeli, której nikt nie
zapisał i nikt nie może usunąć; dalej są **widoki wspólne**, w kolejności wybranej przez osobę
budującą bazę, a potem **Moje widoki**.

- **Widok wspólny** widzą wszyscy. Jego utworzenie, konfiguracja, zmiana nazwy, kolejności
  czy usunięcie wymaga poziomu **Zarządzanie**. Może być **zablokowany**: informuje o tym
  kłódka i nikt go nie zmieni bez wcześniejszego odblokowania.
- **Widok osobisty** widzisz tylko ty i wymaga on jedynie możliwości odczytu tabeli.
  **Utwórz widok osobisty** albo **Zapisz jako widok** po przefiltrowaniu i posortowaniu:
  każdy przechowuje własne sposoby czytania, nie zmieniając niczego innym. **Duplikuj** robi
  z widoku wspólnego kopię osobistą.

![Galeria klientów](../../../../assets/screens/galerie.png)

## Pasek narzędzi

Nad siatką, w tej kolejności:

- **Filtruj** łączy warunki dla poszczególnych pól;
- **Kolumny** wybiera, co się wyświetla – kolumny systemowe są osobno, w grupie
  „Informacje systemowe”;
- **Grupuj** układa wiersze według pola o pojedynczej wartości – pojedynczego wyboru,
  relacji, osoby, daty, liczby, tekstu, pola wyboru… – w zwijane grupy, każda z licznikiem dla
  całego filtra;
- **Kolory** koloruje wiersze według pojedynczego wyboru albo według **reguł** – filtr i kolor,
  najwyżej dwadzieścia – jako pasek, tło lub oba;
- **Wysokość wierszy**: niska, średnia, wysoka, bardzo wysoka;
- **Szukaj…**, po prawej, przeszukuje wszystkie kolumny w trakcie pisania; Esc czyści
  wyszukiwanie. Działa też w kanbanie, kalendarzu, osi czasu, galerii i liście, i nigdy nie
  jest zapisywane w widoku.

Pod każdą kolumną **Podsumowanie** obliczane na wszystkich wierszach filtra, a nie tylko na
bieżącej stronie: wypełnione, puste, unikalne wartości, suma, średnia, minimum, maksimum,
zaznaczone pola.

## Kanban, kalendarz, oś czasu

- **Kanban** układa karty według pojedynczego wyboru; przeciągnięcie karty zmienia wiersz,
  a „+” na górze kolumny tworzy wiersz z już ustawionym tym wyborem. Każda karta pokazuje
  tytuł, obraz okładki, wybrane pola i **opis** przytaczający wartości wiersza – „Dostawa
  zaplanowana na `{{Date}}` dla `{{Client}}`” –, pisany w ustawieniach widoku za pomocą
  przycisku **Wstaw pole**.
- **Kalendarz** umieszcza każdy wiersz w jego dacie, z ewentualną datą końcową; przeciągnięcie
  wiersza z jednego dnia na inny przesuwa go.
- **Oś czasu** rysuje paski między datą początkową a końcową, pogrupowane według pojedynczego
  wyboru lub relacji. Z ustawieniem **Zależy od** – relacją tabeli do samej siebie – strzałka
  łączy każde zadanie z tymi, od których zależy, czerwona, gdy cofa się w czasie.

![Oś czasu z zależnościami](../../../../assets/screens/chronologie.png)

![Kalendarz według terminu](../../../../assets/screens/calendrier.png)

## Galeria i lista

- **Galeria** pokazuje karty: **obraz okładki** (przycięty lub w całości), rozmiar (małe,
  średnie, duże karty), kolor według pojedynczego wyboru.
- **Lista** pokazuje jeden wiersz na rekord, **pogrupowany** według pojedynczego wyboru,
  relacji lub osoby.

![Lista klientów pogrupowana według branży](../../../../assets/screens/liste.png)

W kanbanie, galerii i liście karty i wiersze **układa się ręcznie**, przeciągając je – do
5000; wybrane sortowanie ma pierwszeństwo przed tą kolejnością.

## Formularz i ankieta

Zaznacza się pytania i ustala ich kolejność; każde ma treść, podpowiedź i może być
wymagane. Formularz ma swój tytuł, wprowadzenie, etykietę przycisku i komunikat z
podziękowaniem. Wypełnia się go w basedb albo [udostępnia przez link](/basedb/pl/fonctionnalites/formulaires-partages/).

## Udostępnianie widoku

Widok danych – siatkę, kanban, kalendarz, oś czasu, galerię, listę – można **udostępnić
tylko do odczytu** przez link, osadzić w innej witrynie, a kalendarz staje się kanałem
kalendarza do subskrypcji. Zobacz [Widoki udostępnione](/basedb/pl/fonctionnalites/vues-partagees/).

## Czego czytający nie widzi

Widok jest **przeliczany dla swojego czytającego**: pole ukryte przed nim znika z kolumn, kart
i pytań. Widok, którego filtr przytacza ukryte pole, w ogóle nie jest pokazywany: pokazany bez
filtra ujawniłby więcej, niż miał pokazywać.

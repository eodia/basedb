---
title: Tabele i pola
description: Typy pól w basedb, ich odwzorowanie w PostgreSQL, formuły i pola obliczane.
---

Każda tabela w basedb jest tabelą PostgreSQL; każde pole – typowaną kolumną. Wpisana przez
ciebie etykieta („Échéance”) staje się czytelną nazwą fizyczną (`echeance`) dzięki stabilnej
**slugifikacji**: bez znaków diakrytycznych, małymi literami, bez słów zastrzeżonych.

## Typy

| Typ | Kolumna PostgreSQL | Uwagi |
|---|---|---|
| Krótki tekst | `text` | jedna linia |
| Długi tekst | `text` | Markdown: fragment w siatce, podgląd po najechaniu, osobny edytor; może [przytaczać kolumnę](#tekst-sformatowany-i-zmienne) |
| Tekst sformatowany | `text` + `CHECK` | HTML oczyszczany przy zapisie, pisany w edytorze wizualnym – [zobacz niżej](#tekst-sformatowany-i-zmienne) |
| Liczba | `numeric` | nigdy liczba zmiennoprzecinkowa: kwota się nie rozjeżdża |
| Waluta, Procent, Czas trwania, Ocena | `numeric` | liczba i jej [format wyświetlania](#formaty-wyświetlania): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Pole wyboru | `boolean` | |
| Data | `date` | |
| Data i godzina | `timestamptz` | chwila bezwzględna, wyświetlana w strefie czasowej czytającego |
| Pojedynczy wybór | `text` + `CHECK` | kolor, ikona lub obraz dla każdej opcji |
| Wielokrotny wybór | `text[]` + `CHECK` | filtrowalny operatorami tablicowymi |
| E-mail | `text` + `CHECK` | adres sprawdzany przez bazę, otwierany jednym kliknięciem |
| Telefon, Kod kreskowy | `text` | krótki tekst i jego format: link do połączenia, czcionka o stałej szerokości |
| URL | `text` + `CHECK` | uzupełniany przy wpisywaniu (`exemple.fr` → `https://exemple.fr`) |
| Osoba | `uuid` | członek przestrzeni roboczej; wskazanie go [powiadamia](/basedb/pl/fonctionnalites/collaboration/) tę osobę |
| Autonumer | `bigint` identity | numeruje też już istniejące wiersze; nikt go nie wpisuje |
| Relacja | `uuid` + `FOREIGN KEY` | prawdziwy klucz obcy do tabeli docelowej |
| Relacja wielokrotna | `uuid[]` | wiele powiązanych wierszy, których integralności pilnuje wyzwalacz |
| Formuła | kolumna generowana `STORED` | obliczana przez PostgreSQL – lub przy odczycie, zobacz [Formuły](#formuły) |
| Odnośnik, Agregacja, Zliczanie | brak | obliczane przy odczycie, przez relację |
| Przycisk | brak | otwiera adres lub uruchamia [automatyzację](/basedb/pl/fonctionnalites/automatisations/) |
| Plik, Obraz | `jsonb` (metadane) | bajty trafiają do [magazynu plików](/basedb/pl/fonctionnalites/fichiers/) |

Każda tabela ma też swoje **kolumny systemowe**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` – utrzymywane przez wyzwalacz, nigdy niezapisywalne
przez API. Siatka umieszcza je w grupie **Informacje systemowe**, w menu kolumn: są w każdej
tabeli, a przydają się w nielicznych.

![Siatka tabeli z obliczanym czasem trwania, odnośnikiem i zliczaniem](../../../../assets/screens/grille.png)

## Ograniczenia pilnowane przez bazę

To, co obiecuje interfejs, gwarantuje PostgreSQL. Pojedynczy wybór to ograniczenie `CHECK`;
relacja – `FOREIGN KEY`; URL lub adres e-mail – wyrażenie regularne. Zapis w bezpośrednim SQL,
który je narusza, jest odrzucany tak samo jak w interfejsie:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Formaty wyświetlania

Waluta, Procent, Czas trwania, Ocena, Telefon i Kod kreskowy wybiera się jak typy, ale są to
**formaty**: kolumna pozostaje liczbą lub tekstem, zmienia się tylko sposób odczytu.

| Format | Na | Odczyt i wprowadzanie |
|---|---|---|
| Waluta | liczbie | `12 500,00 €` – euro, dolar, funt, frank szwajcarski, dolar kanadyjski, jen |
| Procent | liczbie | `15 %` |
| Czas trwania | liczbie sekund | `1:30`, a wprowadza się `1h30`, `90 min` |
| Ocena | liczbie | od 1 do 10 gwiazdek, ustawiana jednym kliknięciem |
| Telefon | krótkim tekście | link do połączenia |
| Kod kreskowy | krótkim tekście | czcionką o stałej szerokości |

Format można zmienić później (**Wyświetlanie** w edycji pola), nie ruszając zapisanych
wartości. Nie ogranicza on wartości: ocena 7 w skali 5 pozostaje 7.

## Formuły

Formułę pisze się po francusku: pola w nawiasach kwadratowych, argumenty rozdzielone `;`:

```text
ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)
SI([Payée]; FAUX; JOURS(AUJOURDHUI(); [Échéance]) > 0)
JOURS([Fin]; [Début])
```

Edytor podpowiada pola do wstawienia i panel funkcji; błąd wskazuje pole lub znak, którego
dotyczy.

| Rodzina | Funkcje |
|---|---|
| Logika | `SI`, `SIVIDE`, `ESTVIDE`, `ET`, `OU`, `NON`, `VRAI`, `FAUX` |
| Liczby | `ARRONDI`, `ABS`, `PLAFOND`, `PLANCHER`, `MIN`, `MAX` |
| Tekst | `MAJUSCULE`, `MINUSCULE`, `SANSESPACES`, `GAUCHE`, `DROITE`, `LONGUEUR`, `TEXTE`, `NOMBRE` |
| Daty | `ANNEE`, `MOIS`, `JOUR`, `JOURSEMAINE`, `JOURS`, `AJOUTER_JOURS`, `DATE`, `AUJOURDHUI`, `MAINTENANT` |
| Operatory | `+ - * /`, `&` do łączenia tekstu, `= <> < <= > >=` |

Formuła staje się **kolumną generowaną** przez PostgreSQL: `psql` i twoje narzędzia czytają ją
jak każdą inną. Formuła zależna od bieżącego dnia (`AUJOURDHUI()`, `MAINTENANT()`) lub
przytaczająca odnośnik albo agregację jest **obliczana przy odczycie**: można ją filtrować i
sortować w basedb, ale nie istnieje w bezpośrednim SQL.

Formuła nie przytacza ani innej formuły, ani bezpośrednio relacji – robi to odnośnik.
Wyodrębnianie lub zastępowanie fragmentu tekstu pojawi się później.

## Odnośniki, agregacje i zliczania

Trzy pola czytają **przez relację**, w jedną lub w drugą stronę – „klient projektu”, ale też
„zadania powiązane przez Projekt”:

- **odnośnik** przynosi wartość z powiązanego wiersza lub listę wartości: miasto klienta
  projektu;
- **agregacja** liczy na powiązanych wierszach: liczbę wartości, sumę, średnią, minimum,
  maksimum – przychody klienta, średnią ocenę jego opinii;
- **zliczanie** liczy powiązane wiersze: liczbę zadań projektu.

Są obliczane przy każdym odczycie, **z uprawnieniami osoby czytającej**: jeśli powiązana tabela
jest dla ciebie zamknięta, to pole też. Można je filtrować i sortować. Podążają za jedną
relacją, nie da się ich zapisywać, nie mają kolumny – więc nie istnieją w bezpośrednim SQL – i
nie występują ani w imporcie, ani w formularzach, ani w historii.

## Relacje

**Relacja** łączy wiersz z wierszem innej tabeli tej samej bazy. Siatka wyświetla **wartość
wyświetlaną** wiersza docelowego – kolumnę, którą wskazujesz jako taką dla jego tabeli – a
filtry przechodzą przez relację (`clients_id.ville eq "Lyon"`). Wiersze wskazujące na dany
wiersz są widoczne w jego szczegółach wiersza.

Zaznacz **Wiele wierszy na rekord**, a relacja stanie się **wielokrotna**: zadanie zależy od
kilku zadań, artykuł należy do kilku kategorii. Powiązane wiersze wyświetlają się jako
plakietki, wybiera się je przez wyszukiwanie i otwiera jednym kliknięciem ze szczegółów
wiersza. Usunięcie wiersza docelowego usuwa go z list, które go przytaczały – albo jest
odrzucane, jeśli tak wybierzesz. Działają filtry `has_any`, `has_all` i `is_null`, które również
przechodzą przez relację (`taches_ids.titre contains "logo"`). Relacji wielokrotnej nie da się
jeszcze sortować, grupować ani importować.

## Przycisk

Pole **Przycisk** nie ma wartości: działa. **Otwiera adres** – `https://` lub `mailto:`, który
może przytaczać wiersz (`mailto:{{E-mail}}`) – albo **uruchamia automatyzację** wyzwalaną
przyciskiem w tej samej tabeli. Wyświetla się w komórce, na karcie i w szczegółach wiersza.

## Opisy

Baza, tabela i pole mają **opis**, który można zmieniać bez migracji. Jest kopiowany do
`COMMENT ON` czytanego przez `psql`, do generowanej dokumentacji i do tego, co agent czyta przez
`describe_table`.

## Tekst sformatowany i zmienne

**Tekst sformatowany** to wariant HTML długiego tekstu, wybierany przy tworzeniu pola
(„Tekst sformatowany (HTML)”): nagłówki, pogrubienie, kursywa, podkreślenie, przekreślenie,
listy, cytaty, kod, linki i separatory, w edytorze wizualnym. HTML jest **oczyszczany przy
zapisie**, niezależnie od tego, czy pochodzi z interfejsu, API, serwera MCP czy importu, a
ograniczenie `CHECK` dodatkowo odrzuca niebezpieczne konstrukcje zapisane bezpośrednio w SQL
(`<script>`, atrybuty `on…`, `javascript:`). Bez obrazów, tabel i kolorów: to, czego baza by nie
zachowała, nie jest oferowane.

Długi tekst – zwykły lub sformatowany – może **przytaczać kolumnę swojego wiersza**. Menu
**Kolumna** w edytorze wstawia odwołanie w miejscu kursora: plakietkę w tekście sformatowanym,
`{{Ville}}` w Markdownie.

> Dostawa zaplanowana na `{{Livraison}}`, miejsce: `{{Ville}}`.

- Kolumna przechowuje odwołanie w postaci zapisanej – `{{ville}}`, przez nazwę fizyczną: to
  właśnie czyta `psql`.
- Wszędzie indziej – w siatce, szczegółach wiersza, API, serwerze MCP, widokach
  udostępnionych, automatyzacjach – tekst czyta się **z wartością z wiersza**: „Dostawa
  zaplanowana na 02/10/2026, miejsce: Lyon.” Zmiana miasta zmienia tekst.
- Pojedynczy wybór czyta się przez jego etykietę, osobę przez jej imię i nazwisko, datę w twoim
  formacie; wartość wstawiona do tekstu sformatowanego nigdy nie jest znacznikami.
- Kolumna, której czytający nie może odczytać, nie daje nic: ani wartości, ani nazwy.

Tekstu sformatowanego nie może wypełniać AI: model pisze tekst, a nie oczyszczony HTML.

## Zmiana struktury

Ekran **Struktura** bazy – w jej menu **⋯** na pasku bocznym – wyświetla tabele i ich pola:
dodawanie, zmiana nazwy, oznaczanie jako wymagane, zmiana kolejności, opisywanie, wskazywanie
pola wyświetlanego.

![Ekran Struktura bazy](../../../../assets/screens/structure.png)

Zmiana struktury wymaga poziomu **Zarządzanie**. Bez niego ekran można przeglądać, ale nic nie
proponuje: ani przycisku, ani ołówka, ani uchwytu – wymagalność i pole wyświetlane są podane, a
nie oferowane. Serwer i tak odrzuca każdą zmianę; ekran nie udaje już, że ją przyjmuje.

Dodanie pola, zmiana nazwy czy typu przechodzi przez **silnik migracji**: plan w krokach, krótkie
blokady i nazwana odmowa, gdy jakiejś danej nie da się przekonwertować.

**Zmiana nazwy** bazy, tabeli lub pola odbywa się w jednym oknie dialogowym. Etykieta zmienia
się zawsze, bez migracji. Administrator widzi pod spodem „Zmień nazwę także w bazie danych:
`clients` → `comptes`”: zaznaczona opcja zmienia też nazwę fizyczną i wyświetla analizę
wpływu – zapytania, widoki SQL i automatyzacje, które przytaczają starą nazwę. Stara nazwa
nadal jest obsługiwana przez **alias zgodności** – widok – do czasu zaktualizowania twoich
zapytań.

Usunięcie niczego od razu nie kasuje: tabela lub baza zostaje odsunięta
(`zz_supprime_…`) i pozostaje czytelna w SQL. Usuniętą bazę można przywrócić; przywracanie
pojedynczej tabeli z interfejsu jest [w planach](/basedb/pl/feuille-de-route/). Ostateczne
**trwałe usunięcie** jest zarezerwowane dla administracji, po trzydziestu dniach, i zaczyna się
od sprawdzonego eksportu CSV.

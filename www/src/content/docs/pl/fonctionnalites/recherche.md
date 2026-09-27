---
title: Wyszukiwanie
description: Jedno pole, by znaleźć wszystko — tabele, widoki, pulpity, wiersze, polecenia — i zadać pytanie Copilotowi. Ctrl+K.
---

Pole **Szukaj tabel, wierszy, poleceń…**, na środku górnego paska, otwiera wyszukiwanie: jedno
pole na wszystko, do czego masz dostęp w basedb. **Ctrl+K** (**⌘K** na Mac) otwiera je lub
zamyka z dowolnego ekranu — z wyjątkiem edytora tekstu, gdzie dodaje link.

## Co znajduje

| | |
|---|---|
| **Tabele i obiekty** | projekty i bazy, które widzisz; tabele, widoki SQL i zapisane zapytania; widoki tabel otwartej bazy, łącznie z osobistymi; pytania, pulpity i automatyzacje baz projektu; kolumny tabel; otwarte zakładki |
| **Wiersze** | same dane, w tabelach otwartej bazy: tekst kolumn, wartości list wyboru, dokładna liczba — od dwóch znaków. Wklejony identyfikator wiersza znajduje swój wiersz |
| **Polecenia** | to, co potrafi aplikacja: przejść do struktury, historii, pulpitów bazy; utworzyć tabelę, pytanie, zapytanie SQL, bazę, projekt, zacząć od szablonu; zaimportować dane do tabeli; cofnąć lub przywrócić ostatni zapis; zamknąć zakładkę lub zmienić na inną; zmienić motyw; otworzyć Copilota; **Skopiuj link do tej strony**; otworzyć zakładkę ustawień lub administracji; wylogować się |
| **Copilot** | pytanie w języku naturalnym, przekazane Copilotowi |

**Enter** otwiera wybrany wynik: wiersz otwiera się w swojej tabeli, w swoich szczegółach. Na
dużym ekranie panel po prawej pokazuje jego podgląd — wartości wiersza, kolumny i opis tabeli,
opis pulpitu lub automatyzacji. Wklej adres basedb: **Otwórz ten link** zaprowadzi cię tam
(zobacz [link do każdego ekranu](/basedb/pl/fonctionnalites/collaboration/#link-do-każdego-ekranu)).

Puste pole proponuje twoje **ostatnie**, otwarte zakładki, tabele bazy i kilka podpowiedzi.

## Pisz, jak myślisz

- **Bez znaków diakrytycznych i wielkich liter**: `uczen` znajdzie „Uczeń”.
- **Początki słów i inicjały**: `nk` dla „Nowy klient”, `nowtab` dla „Nowa tabela”.
- **Wybaczona literówka** — pominięta, podwojona, zamieniona lub przestawiona litera, dwie w
  słowie dłuższym niż siedem liter —, nigdy w pierwszej literze.
- **Każde wpisane słowo musi się gdzieś znaleźć**, w nazwie albo w tym, co ją zawiera:
  `sprzedaz klienci` znajdzie tabelę „Klienci” bazy „Sprzedaż”. Rodzaj obiektu też można
  wpisać: `widok`, `automat`, `pulpit`.
- **Najpierw tabela, potem to, czego w niej szukasz**: `klienci krakow` szuka „krakow” w
  wierszach tabeli „Klienci”.

Na górze **najlepszy wynik**; to, co otwierasz często i niedawno, wypływa wyżej. Ta pamięć
zostaje w twojej przeglądarce.

## Zawężanie wyszukiwania

Etykiety pod polem — **Wszystko**, **Tabele i obiekty**, **Wiersze**, **Polecenia**, **Copilot** —
zawężają zakres wyszukiwania. To samo robi pierwszy znak:

| Wpisz najpierw | Aby szukać |
|---|---|
| `#` | tylko tabel i obiektów |
| `/` | tylko wierszy |
| `>` | tylko poleceń |
| `?` | pytania do Copilota |

**Tab**, na tabeli lub bazie, szuka **w niej**: jej nazwa pojawia się w polu, a wyszukiwanie
obejmuje już tylko jej wiersze, widoki, kolumny i polecenia. Puste pole pokazuje wtedy dwadzieścia
ostatnio zmienionych wierszy. **⌫**, gdy pole jest puste, z tego wychodzi; **Esc** cofa o krok, a
potem zamyka.

## Zapytaj Copilota

Każde wyszukiwanie kończy się opcją **Zapytaj Copilota: „…”**, umieszczoną na górze, gdy tekst
brzmi jak pytanie — kończy się „?”, zaczyna od „ile”, „jaki”, „pokaż”…, albo liczy pięć słów i
więcej. Copilot otwiera się na bazie i otrzymuje pytanie tak, jakbyś je wpisał. Czyta strukturę,
nie wiersze, chyba że zaznaczysz **Zezwól na odczyt danych** — wtedy proponuje: nic się nie
zmienia, dopóki nie zastosujesz. AI musi być skonfigurowane na instancji — zobacz
[Sztuczna inteligencja](/basedb/pl/fonctionnalites/ia/).

## Uprawnienia i ograniczenia

Wyszukiwanie korzysta z tych samych ścieżek co reszta ekranu, **z twoimi uprawnieniami**: tabela
lub kolumna zamknięta przed tobą nie pojawia się ani wśród obiektów, ani w wierszach.
Automatyzacje są proponowane tylko osobom z poziomem **Zarządzanie** na ich bazie.

- Wiersze są szukane w otwartej bazie, albo w bazie lub tabeli, do której wszedłeś przez Tab:
  trzy wiersze na tabelę, w najwyżej dwudziestu czterech tabelach; dwadzieścia wierszy w tabeli.
- Pytania, pulpity i automatyzacje pochodzą z otwartego projektu (najwyżej ośmiu baz), odczytywane
  ponownie najwyżej co dwie minuty.
- Każda grupa pokazuje kilka wyników, a potem **N innych wyników**, co otwiera ją w całości.

## Skróty klawiszowe

**Skróty**, na dole wyszukiwania, albo polecenie **Skróty klawiszowe**, pokazuje je wszystkie.
**Ctrl** czyta się jako **⌘** na Mac.

| Klawisze | Efekt |
|---|---|
| **Ctrl+K** | otworzyć lub zamknąć wyszukiwanie |
| **↑** **↓**, **Enter** | przeglądać wyniki, otworzyć wynik |
| **Alt+W** | zamknąć zakładkę |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | następna zakładka, poprzednia zakładka |
| klik kółkiem myszy | zamknąć zakładkę |
| **Ctrl+A**, **Ctrl+C** | w siatce: zaznaczyć wszystko, skopiować wybrane komórki |
| **Ctrl+klik** | podążyć za relacją |
| **Ctrl+Z**, **Ctrl+Y** | cofnąć ostatni zapis, przywrócić go |
| **Ctrl+Enter** | wysłać komentarz, zapisać opis |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | w tekście: pogrubienie, kursywa, link |

---
title: Pulpity
description: Pytania zadawane myszą lub w SQL, piętnaście sposobów ich pokazywania i dostosowywania, pulpity w siatce, w zakładkach, przy wspólnych filtrach – czytane z uprawnieniami każdego i udostępniane przez link.
---

**Pulpit** zbiera na jednej stronie to, na co zespół patrzy każdego dnia: liczby, które się
liczą, ich zmiany z miesiąca na miesiąc, rozkład statusów, najbliższe terminy. Każda karta
pokazuje **pytanie** – odczyt z bazy, zbudowany myszą lub napisany w SQL – a **filtry** na
górze strony sterują kartami, które się z nimi połączy.

![Pulpit „Pilotage de l’agence”: trend miesiąca, cel, przychody w układzie skumulowanym, wydźwięk opinii](../../../../assets/screens/tableaux-de-bord.png)

Wszystko otwiera się z **Pulpity**, w bloku otwartej bazy na dole paska bocznego. Po lewej
pulpity i zapisane pytania bazy oraz **Eksploruj dane**, aby zadać pytanie bez zapisywania
czegokolwiek. Każdy, kto czyta bazę, może je przeglądać i eksplorować; tworzenie, zmiana i
zapisywanie wymagają poziomu **Zarządzanie**.

## Zadawanie pytania myszą

Pytanie buduje się krok po kroku, jeden krok pod drugim:

![Edytor pytania: dane, filtry, podsumowanie według miesięcy](../../../../assets/screens/question-editeur.png)

| Krok | Co się w nim wybiera |
|---|---|
| **Dane** | tabelę wyjściową i kolumny pokazywane, gdy nic nie jest podsumowane |
| **Połącz dane** | inną tabelę bazy, połączoną relacją – proponowaną automatycznie – lub dwiema kolumnami tego samego rodzaju; złączenie lewostronne, wewnętrzne, prawostronne lub pełne |
| **Filtr** | według kolumny, z tym, co oferuje jej typ: jest / nie jest, zawiera, pomiędzy, puste…; dla daty **okres**: dziś, ostatnie 30 dni, bieżący miesiąc, poprzedni kwartał, od … do …; albo wyrażenie zapisane jak na pasku widoków |
| **Podsumuj** | miary – liczba wierszy, suma, średnia, mediana, minimum, maksimum, wartości unikalne, odchylenie standardowe, sumy narastające – **według** jednej do trzech kolumn |
| **Sortuj**, **Ogranicz** | kolejność wierszy i ich maksymalna liczba |

Datę grupuje się **według dnia, tygodnia, miesiąca, kwartału lub roku** albo według pozycji –
dzień tygodnia, miesiąc roku, godzina dnia; liczbę – w przedziałach. Wielokrotny wybór liczy
każdy wiersz w każdym z jego wyborów. Okresy są odczytywane w twojej strefie czasowej, a tydzień
zaczyna się od dnia ustawionego w twoich ustawieniach.

**Wizualizuj** uruchamia pytanie. Wynik jest pokazywany w odpowiedni dla niego sposób – liczba,
linia, słupki, tabela – a zmienia się to na dole ekranu:

| Wizualizacja | Do pokazania |
|---|---|
| **Liczba**, **Trend**, **Postęp**, **Wskaźnik** | jednej wartości; ostatniego okresu w porównaniu z poprzednim i z tym samym rok wcześniej; postępu w kierunku celu |
| **Histogram**, **Słupki**, **Linia**, **Obszary**, **Łączony** | miar wzdłuż wymiaru, w seriach obok siebie, skumulowanych lub do 100 % |
| **Kołowy**, **Lejek** | udziałów, etapów |
| **Punktowy** | dwóch miar względem siebie, trzeciej jako rozmiaru |
| **Tabela**, **Tabela przestawna** | wierszy, z sortowaniem; wierszy według jednego wymiaru, kolumn według innego, z sumami |
| **Mapa** | regionów lub departamentów Francji albo krajów, pokolorowanych według wartości; albo punktów według szerokości i długości geograficznej |

**Opcje** ustawiają, co jest pokazywane, a wynik można pobrać jako **CSV**.

### Dostosowywanie wykresu

| Wizualizacja | Co oferują **Opcje** |
|---|---|
| **Słupki, linie, obszary, łączony** | kolor i nazwa każdej serii; skumulowanie, z sumą nad stosami; szerokość słupków; linie wygładzone lub schodkowe, z punktami lub bez; kolejność kategorii; tytuły osi, podziałki, nachylenie etykiet, zakresy, skala logarytmiczna; wartości na wykresie; cel |
| **Kołowy** | pierścień i jego grubość, półokrąg, wykres różany; suma w środku; liczba wycinków przed „Inne”; kolor i nazwa każdego wycinka; etykiety na wycinkach lub obok; położenie legendy |
| **Lejek** | kolor i nazwa każdego etapu, ich kolejność |
| **Liczba, trend, postęp, wskaźnik** | kolor, kolory zależne od wartości, podpis pod liczbą, porównanie – i to, czy spadek jest dobrą wiadomością |
| **Tabela, tabela przestawna** | zmiana nazw i kolejności kolumn, paski w komórkach, kolory zależne od wartości – dla komórki lub wiersza –, gęstość, wiersze na stronę, numery wierszy, sumy |
| **Mapa** | odcień, nazwy regionów |

Dla wszystkich – format liczb: miejsca dziesiętne, prefiks i sufiks, skrót `1,2 k`.

## Eksploracja jednym kliknięciem

Kliknięcie słupka, punktu lub wycinka otwiera to, co on reprezentuje:

- **Pokaż te wiersze**: wiersze stojące za punktem, przefiltrowane według tego, co reprezentuje;
- **Szczegóły według tygodni**: okres rozbity na drobniejszy – rok na kwartały, miesiąc na
  tygodnie;
- **Podziel według…**: ta sama miara, dla tego punktu, według innej kolumny;
- **Tylko ta wartość**, **Wyklucz tę wartość**.

Każdy krok to osobne pytanie, które można zapisać; strzałka wstecz wraca do poprzedniego kroku.
Wiersz tabeli otwiera jego szczegóły wiersza.

Na pulpicie to samo kliknięcie proponuje też **Filtruj pulpit: „Lyon”**, z liczbą kart, których
to dotyczy: filtr **tymczasowy**, nigdy niezapisywany, wyświetlany linią przerywaną na pasku
filtrów i usuwany jednym kliknięciem, który dotyczy każdej karty, której pytanie czyta tę samą
kolumnę – przez swoją tabelę lub przez złączenie. Jest proponowany tylko wtedy, gdy żaden filtr
pulpitu nie jest już połączony z tą kolumną na tej karcie, i pozostaje wyszarzony („jedyna
karta”), gdy żadna inna karta jej nie czyta. Pytania SQL go nie uwzględniają.

## Pisanie pytania w SQL

**Pytanie SQL** to `SELECT` na tabelach bazy, pod ich prawdziwymi nazwami. Wykonuje się
**tylko do odczytu, z twoimi własnymi uprawnieniami** – dla wszystkich, łącznie z osobami
zarządzającymi: tabela zamknięta przed tobą nie istnieje, ukryte pole jest odrzucane, a zapis
jest niemożliwy. Aby po prostu umieścić zapytanie pod tabelami, bez wykresu, albo zrobić z niego
prawdziwy widok PostgreSQL, zobacz [Zapytania i widoki SQL](/basedb/pl/fonctionnalites/requetes-et-vues-sql/).

**Zmienną** zapisuje się jako `{{nom}}`; fragment do pominięcia, gdy nie ma ona wartości –
między `[[` a `]]`:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Zmienna to tekst, liczba, data – albo **filtr kolumny**: `{{periode}}` staje się wtedy całym
warunkiem na wybranej kolumnie, tutaj `echeance`, lub `TRUE`, gdy nic nie wybrano. Dzięki temu
filtr pulpitu może sterować pytaniem SQL tak jak każdym innym.

## Układanie pulpitu

**Edytuj** przełącza pulpit w tryb edycji:

- **Pytanie** umieszcza zapisane pytanie albo tworzy pytanie właściwe tylko tej karcie;
- **Tytuł** i **Tekst** dodają tytuł sekcji lub tekst w Markdownie;
- **Osadzona strona** wyświetla adres `https://` w odizolowanej ramce, która nie otrzymuje ani
  sesji, ani danych;
- **Zakładka** rozkłada karty na kilka stron; dwukrotne kliknięcie zmienia nazwę zakładki.

Karty przesuwa się za uchwyt i zmienia ich rozmiar za róg, na siatce 24 kolumn. **Zapisz**
zachowuje całość; **Anuluj** wraca do poprzedniej wersji. Tytuł karty, w trybie odczytu,
otwiera jej pytanie do eksploracji, łącznie z filtrami pulpitu.

## Filtry

**Filtr** dodaje kontrolkę na górze pulpitu: **datę** (okres), **kategorię** (wartości do
zaznaczenia), **tekst**, **liczbę** albo **grupowanie dat**, które przełącza wykresy z miesięcy
na tygodnie lub lata.

Filtr steruje kartami, które się z nim połączy – jedną, kilkoma lub wszystkimi. Po utworzeniu
sam łączy się z pasującymi kolumnami; zaznaczony pokazuje na każdej karcie kolumnę, którą
filtruje, do zmiany lub usunięcia, a **Połącz ze wszystkimi zgodnymi kartami** uzupełnia
resztę. Może mieć **wartość domyślną** – na przykład „Ten rok”.

W trybie odczytu kliknięcie punktu może też ustawić filtr: **Filtruj według „Lyon”** na karcie,
której kolumna miast jest połączona z filtrem „Ville”.

![Zakładka „Activité”: zadania według terminu, skumulowane według statusu, lejek projektów, szacowane godziny w tabeli przestawnej](../../../../assets/screens/tableaux-de-bord-activite.png)

## Copilot

**Copilot**, w nagłówku sekcji Pulpity, otwiera po prawej rozmowę w języku naturalnym o bazie:
„przychody według miesięcy”, „dodaj filtr według klienta”, „dlaczego sierpień spada?”. Każda
propozycja przychodzi jako karta, którą stosuje się jednym kliknięciem:

| Propozycja | Co robi |
|---|---|
| **Pytanie** | wykonane i narysowane w rozmowie; otwiera się w edytorze lub zostaje dodane do pulpitu |
| **Zmiany pulpitu** albo nowy pulpit | dodane, zmienione lub usunięte karty, teksty, filtry połączone automatycznie z kartami, które mają daną kolumnę, zakładki, nazwa – jeden zapis, **do cofnięcia** z poziomu karty |
| **Wartości dla wyświetlanych filtrów** | „pokaż mi zeszły miesiąc”: filtry się ustawiają, nic nie jest zapisywane |

Zadawanie pytań i ustawianie filtrów jest dostępne dla każdego, kto czyta bazę; zmiana lub
utworzenie pulpitu wymaga poziomu **Zarządzanie**.

Domyślnie do dostawcy AI trafia **tylko struktura**, razem z rozmową: tabele i ich pola,
pulpity i zapisane pytania bazy oraz wyświetlany pulpit – jego zakładki, filtry, definicja
jego kart (ich pytania, ich teksty). Ani wiersze, ani wyniki kart, ani **wartości wybrane w
filtrach**, które mogą być danymi: z filtra wychodzi tylko informacja, że ma wartość. Pole
oznaczone jako niewidoczne dla agentów nie wychodzi, podobnie jak pytanie karty, które je
przytacza.

Pole wyboru **Zezwól na odczyt danych** dodaje, na czas rozmowy, wartości wyświetlanych filtrów
i wyniki kart przy tych filtrach (najwyżej 50 wierszy na odczyt, wymienionych pod odpowiedzią),
aby komentować liczby na ich podstawie. Zobacz
[Sztuczna inteligencja](/basedb/pl/fonctionnalites/ia/).

## Udostępnianie pulpitu

**Udostępnij**, w nagłówku pulpitu, jest dostępne dla osób z poziomem **Zarządzanie** na bazie.
Dwie drogi:

- **Udostępnij bazę…** zaprasza osoby do bazy: otwierają pulpit w basedb, a każda karta czyta
  z ich własnymi uprawnieniami;
- **Utwórz link** daje link do **tylko tego** pulpitu, który nie wymaga żadnych uprawnień do
  bazy.

| Dostęp przez link | Kto czyta |
|---|---|
| **Publiczny** | każdy, kto ma link, bez konta |
| **Zalogowani członkowie** | członek przestrzeni roboczej, po zalogowaniu – w razie potrzeby tylko z określonych grup |

Strona linku pokazuje zakładki, filtry i karty pulpitu **tylko do odczytu**: bez eksploracji,
dostępu do wierszy i własnych pytań. Jej karty czytają z **uprawnieniami osoby, która
opublikowała link**, ustalanymi na nowo przy każdym odczycie: jeśli straci ona dostęp do bazy,
link zostaje **zawieszony**. Przełącznik **Link aktywny** wyłącza go bez utraty, **Wygeneruj
ponownie** unieważnia stary.

Zaznacz **Zezwól na osadzanie w innej witrynie**: okno dialogowe poda **kod osadzenia**
`<iframe>`, aby wyświetlić pulpit w intranecie lub wiki. To ten sam mechanizm co w
[widokach udostępnionych](/basedb/pl/fonctionnalites/vues-partagees/).

## Każdy ze swoimi uprawnieniami

Każda karta czyta **z uprawnieniami osoby, która patrzy**: ten sam pulpit pokazuje każdemu to,
co ma prawo widzieć – z wyjątkiem linku udostępniania, który czyta z uprawnieniami osoby, która
go opublikowała. Karta dotycząca tabeli lub pola zamkniętego przed tobą wyświetla
„Dane niedostępne”, zamiast liczby, która kłamałaby przez przemilczenie. Zapisanie pytania
udostępnia tylko pytanie, nigdy to, co może czytać jego autor.

## Ograniczenia

- Pytanie zwraca najwyżej 2000 wierszy; podsumowaniu prawie zawsze to wystarcza.
- Każda karta wykonuje swoje zapytanie przy otwarciu i przy każdej zmianie filtra, bez pamięci
  podręcznej.
- Podkłady map obejmują Francję kontynentalną (regiony, departamenty) i kraje świata. Źródło:
  IGN, Admin Express (Licence ouverte); Natural Earth.

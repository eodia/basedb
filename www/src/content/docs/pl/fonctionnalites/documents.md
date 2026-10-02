---
title: Dokumenty PDF
description: Wiersz jako faktura, wycena, karta danych albo zaświadczenie w twoich kolorach, z logo, powiązanymi wierszami i sumami.
---

Wiersz staje się **PDF-em**: faktura z jej wierszami i sumą, wycena, dokument dostawy, karta
produktu, zaświadczenie. W szczegółach wiersza przycisk **Dokument PDF** otwiera go w nowej
karcie, skąd przeglądarka go wydrukuje albo zapisze.

## Karta, bez żadnych ustawień

Bez szablonu wiersz drukuje się jako **karta**: jego nazwa jako tytuł, a potem wszystkie pola,
które możesz przeczytać, w twoim języku.

## Nowy szablon

Kto tworzy tabelę — poziom Zarządzanie — tworzy szablony ze szczegółów wiersza:
**Dokument PDF › Szablony dokumentu…**. Nowy szablon zaczyna się od **punktu wyjścia**:

| Punkt wyjścia | Co zawiera |
|---|---|
| **Faktura** | nagłówek z logo i danymi kontaktowymi, „FAKTURA”, numer i data; klient; pozycje faktury i ich suma; podsumowanie netto / brutto; warunki płatności; informacje prawne w stopce |
| **Wycena** | tytuł na kolorowym banerze, informacje w siatce, usługi, ważność, pole „Zatwierdzenie” |
| **Karta danych** | duży tytuł na całą szerokość, zdjęcie z pola obrazu, pola w siatce, długie teksty |
| **Zaświadczenie** | strona pozioma w ramce, wyśrodkowany tekst, podpis |
| **Pusta strona** | tytuł i pola wiersza |

Jest zbudowany z **kolumn twojej tabeli** — jej numeru, daty, kwot, zdjęcia, powiązanych
wierszy — a to, czego w tabeli nie ma, jest po prostu pomijane. Wszystko można potem zmienić;
podgląd, po prawej, pokazuje PDF otwartego wiersza i aktualizuje się przy każdej zmianie.

## Zawartość: bloki

Bloki następują po sobie od góry do dołu; **przeciąga się** je za uchwyt, aby zmienić ich
kolejność, i otwiera, aby je ustawić.

| Blok | Co pokazuje |
|---|---|
| **Tytuł** | duży tytuł i podtytuł — stonowany, w kolorze, podkreślony, albo na banerze sięgającym do krawędzi strony |
| **Tekst** | tekst sformatowany — nagłówki, pogrubienie, listy, linki — który przytacza kolumny wiersza za pomocą menu **Kolumna**: „Faktura `{{numero}}` z `{{date}}`”; wyrównany albo wyjustowany, na kolorowym tle, w ramce albo oznaczony kolorowym paskiem |
| **Obraz** | logo, pieczątka, albo zdjęcie z pola obrazu wiersza |
| **Pola wiersza** | wybrane pola, albo wszystkie: etykieta po lewej, etykieta powyżej w siatce 2 lub 3, albo **podsumowanie** — wartości po prawej, ostatnia (suma do zapłaty) pogrubiona; puste pola można ukryć |
| **Tabela powiązanych wierszy** | wiersze, które wskazują na ten — pozycje faktury — albo te, na które wskazuje relacja wielokrotna, z ich **sumami**; kolorowy nagłówek, co drugi wiersz zabarwiony, nagłówki, szerokości i wyrównania kolumn do własnej ręki („Il.” dla „Ilość”) |
| **Kolumny** | dwie albo trzy kolumny obok siebie, każda z własnymi blokami: „Nabywca” z jednej strony, dane referencyjne z drugiej |
| **Separator**, **Odstęp** | linia — krótka dla podpisu — albo puste miejsce |
| **Podział strony** | ciąg dalszy na nowej stronie |

## Styl i strona

- **Kolor akcentu** — kolor twojej marki: tytuły, banery, nagłówki tabel, odnośniki. Tekst
  umieszczony na nim jest biały albo ciemny, zależnie od tego, co lepiej się czyta.
- **Kolor tekstu**, **czcionka** tekstu i tytułów (bezszeryfowa albo szeryfowa),
  **rozmiar** tekstu, styl nagłówków pomocniczych.
- **Format** (A4 albo Letter), **orientacja**, **marginesy**, **ramka** pojedyncza albo
  podwójna wokół strony, zawartość **wyśrodkowana w pionie** — dla zaświadczenia.
- **Język wartości**: kwoty zapisują się z walutą („1 234,50 €”), daty słowami
  („30 września 2026”), tak i nie, etykieta wyboru, imię i nazwisko osoby. Tekst jest składany
  czcionkami wbudowanymi, które obejmują dwadzieścia języków basedb, łącznie z ideogramami.

## Nagłówek i stopka

**Nagłówek** zawiera twoje **logo** — przesłany obraz (PNG, JPEG albo SVG; zbyt duży obraz
zostanie zmniejszony) albo pole obrazu wiersza —, tekst po lewej (twoje dane kontaktowe) i
tekst po prawej (co to za dokument, jego numer, jego data), na pierwszej stronie albo na
każdej. **Stopka** zawiera twoje informacje prawne i numery stron. Oba przytaczają kolumny
wiersza, tak jak tekst.

## Każdy z własnymi uprawnieniami

Dokument jest odczytywany **z uprawnieniami osoby, która go drukuje**: pole ukryte przed nią
nie występuje w nim — ani w tekście, ani jako obraz —, powiązany wiersz, którego nie widzi, nie
znajduje się w tabeli — ani w sumie. Dwie osoby mogą więc otrzymać dwa różne dokumenty tego
samego wiersza: każda ma swój.

## Przez API

```bash
# PDF wiersza z szablonem, albo „karta”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` zwraca listę szablonów tabeli.

## Ograniczenia

- Przesłany obraz waży 300 KB co najwyżej, osiem na szablon; obraz z pola jest wykorzystywany,
  jeśli jest w formacie PNG albo JPEG.
- Wartość z powiązanego wiersza przytacza się poza tabelą przez **odnośnik** do tabeli
  dokumentu; suma brutto jest polem tabeli.
- Jeden dokument na wiersz: PDF z wielu wierszy jeszcze nie istnieje. Może go zrobić za ciebie
  [automatyzacja](/basedb/pl/fonctionnalites/automatisations/#pdf-i-e-mail) — **Generuj PDF** —
  i wysłać w załączniku.

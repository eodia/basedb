---
title: Dokumenty PDF
description: Wiersz jako faktura, oferta albo karta do wydruku, z powiązanymi wierszami i sumami.
---

Wiersz staje się **PDF-em**: faktura z jej wierszami i sumą, oferta, dokument dostawy, karta.
W szczegółach wiersza przycisk **Dokument PDF** otwiera go w nowej karcie, skąd przeglądarka
go wydrukuje albo zapisze.

## Karta, bez żadnych ustawień

Bez szablonu wiersz drukuje się jako **karta**: jego nazwa jako tytuł, a potem wszystkie pola,
które możesz przeczytać, w twoim języku.

## Szablony

Kto tworzy tabelę — poziom Zarządzanie — pisze je ze szczegółów wiersza:
**Dokument PDF › Szablony dokumentu…**. Szablon to strona (A4 albo Letter, pionowa lub
pozioma), język wartości, stopka i ciąg bloków:

| Blok | Co pokazuje |
|---|---|
| **Tekst** | tekst sformatowany — nagłówki, pogrubienie, listy, linki — który przytacza kolumny wiersza za pomocą menu **Kolumna**: „Faktura `{{numero}}` z `{{date}}`” |
| **Pola wiersza** | wybrane pola albo wszystkie: etykieta po lewej, wartość po prawej |
| **Tabela powiązanych wierszy** | wiersze, które wskazują na ten — wiersze faktury — albo te, na które wskazuje wielokrotny link, z wybranymi kolumnami i ich **sumami** |
| **Podział strony** | ciąg dalszy na nowej stronie |

Edytor pokazuje z boku PDF, jaki szablon tworzy z otwartego wiersza, wraz ze zmianami.

Wartości zapisują się **w języku szablonu**: kwota z jej walutą („1 234,50 €”), data słowami
(„30 września 2026”), tak i nie, etykieta wyboru, imię i nazwisko osoby. Tekst jest składany
czcionkami wbudowanymi, które obejmują dwadzieścia języków basedb, łącznie z ideogramami.

## Każdy z własnymi uprawnieniami

Dokument jest odczytywany **z uprawnieniami osoby, która go drukuje**: pole ukryte przed nią
nie występuje w nim, powiązany wiersz, którego nie widzi, nie znajduje się w tabeli — ani w
sumie. Dwie osoby mogą więc otrzymać dwa różne dokumenty tego samego wiersza: każda ma swój.

## Przez API

```bash
# PDF wiersza z szablonem, albo „karta”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` zwraca listę szablonów tabeli.

## Ograniczenia

- Bez obrazu (logo) ani wybranego koloru w dokumencie, bez nagłówka odrębnego od stopki.
- Jeden dokument na wiersz: jeszcze nie ma PDF z wielu wierszy, ani generowania przez
  automatyzację.

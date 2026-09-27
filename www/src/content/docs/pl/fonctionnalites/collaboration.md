---
title: Współpraca
description: Komentarze i wzmianki, powiadomienia, aktualizacje w czasie rzeczywistym, obecność i link do każdego ekranu.
---

Kilka osób pracuje nad tą samą bazą jednocześnie: każda widzi, jak napływają zapisy
pozostałych, wie, kto na co patrzy, i rozmawia o wierszu tam, gdzie on się znajduje.

## Komentarze

Szczegóły wiersza mają zakładkę **Komentarze**, między „Szczegóły” a „Historia”. Wpisz `@`,
aby **wspomnieć** członka zespołu, Ctrl+Enter, aby wysłać. Każdy może edytować i usuwać własne
komentarze.

![Rozmowa o projekcie](../../../../assets/screens/commentaires.png)

Aby skomentować wiersz, wystarczy móc go czytać. Wspomniana osoba, która nie może go czytać,
nie zostaje powiadomiona – a autor jest o tym informowany, zamiast sądzić, że wiadomość dotarła.

## Powiadomienia

Dzwonek w prawym górnym rogu liczy to, co nieprzeczytane. Trafiają tam cztery rzeczy:

- ktoś **wspomina** cię w komentarzu;
- ktoś **odpowiada** w rozmowie z twoim udziałem;
- ktoś **wskazuje** cię w polu Osoba – z interfejsu, API, formularza lub automatyzacji;
- [automatyzacja](/basedb/pl/fonctionnalites/automatisations/) cię **powiadamia**.

Otwarcie powiadomienia otwiera wiersz. **Oznacz wszystkie jako przeczytane** zeruje licznik;
powiadomienia są przechowywane przez 90 dni.

![Otrzymana wzmianka](../../../../assets/screens/notifications.png)

## Czas rzeczywisty

Zapisy innych osób wyświetlają się **bez przeładowania**: zmieniona komórka, przesunięta
karta, dodany wiersz – niezależnie od tego, czy pochodzą z interfejsu, API, agenta czy
bezpośredniego SQL. Serwer wysyła tylko **sygnał**, nigdy dane: to ekran odczytuje je ponownie,
z twoimi uprawnieniami. Komórka, którą właśnie edytujesz, nigdy nie zostanie podmieniona pod
twoimi palcami.

## Obecność

Awatary osób, które patrzą na **tę samą tabelę**, wyświetlają się u góry ekranu; tych, które
otworzyły **ten sam wiersz** – w nagłówku jego szczegółów. W siatce kursor innych osób pojawia
się na komórce, nad którą go trzymają.

## Link do każdego ekranu

Adres w przeglądarce podąża za tym, na co patrzysz: tabelę, jeden z jej widoków, szczegóły
wiersza, pulpit, automatyzację, pytanie, twoje ustawienia. Wklej go w wiadomości: kolega trafia
w to samo miejsce, z własnymi uprawnieniami. Dodaj go do zakładek; przyciski wstecz i dalej w
przeglądarce wracają tam, gdzie byłeś.

| Adres | Co otwiera |
|---|---|
| `/bases/ventes/tables/opportunites` | tabelę „Opportunités” bazy „Ventes” |
| `/bases/ventes/tables/opportunites?vue=…` | jeden z jej widoków |
| `/bases/ventes/tables/opportunites?ligne=…` | szczegóły jednego z jej wierszy |
| `/bases/ventes/tableaux-de-bord/…` | pulpit |
| `/bases/ventes/automatisations/…` | automatyzację |
| `/parametres/apparence` | twoje ustawienia |

Adres nazywa **miejsce**, a nie stan, w jakim je zostawiłeś: filtry, sortowania i szerokości
kolumn pozostają właściwe każdej przeglądarce. Baza i tabela zapisują się w nim pod swoją nazwą
PostgreSQL: po zmianie nazwy stary adres nigdzie nie prowadzi. Adres, który nigdzie nie prowadzi
— literówka, usunięty obiekt albo coś, czego nie masz prawa widzieć — pokazuje „Ta strona nie
istnieje”.

## Cofanie

Ctrl+Z cofa twój ostatni zapis – zobacz [historię](/basedb/pl/fonctionnalites/historique/#cofanie-ctrlz).

## Ograniczenia

- Powiadomienia pozostają w basedb: na razie żadne nie jest wysyłane e-mailem.
- Przy ponad stu wierszach zmienionych naraz ekran przeładowuje całą stronę zamiast
  aktualizować wiersz po wierszu.

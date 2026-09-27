---
title: Slack, kalendarze i tabele synchronizowane
description: Powiadamiaj kanał Slacka, łącz kalendarz, utrzymuj tabelę w zgodności z plikiem CSV, kalendarzem lub inną bazą.
---

Ekran **Integracje** bazy otwiera się z menu profilu, w lewym dolnym rogu. Wymaga poziomu
**Zarządzanie** i skupia to, co łączy bazę z resztą twoich narzędzi.

![Ekran Integracje bazy](../../../../assets/screens/integrations.png)

## Slack

**Połącz kanał**: w Slacku utwórz *przychodzący webhook* dla wybranego kanału, a potem wklej
jego adres (`https://hooks.slack.com/…`, jedyne akceptowane źródło). **Testuj** wysyła
wiadomość próbną. Adres jest szyfrowany od razu przy zapisie i nigdy więcej nie jest
wyświetlany.

Połączony kanał staje się potem akcją [automatyzacji](/basedb/pl/fonctionnalites/automatisations/):
**Wyślij na Slack**, z wiadomością przytaczającą wiersz – „Nowa negatywna opinia od
{{Auteur}}: {{Avis}}”.

## Kalendarze

Dwa kierunki, dwa sposoby:

- **Zobacz widok w kalendarzu**: udostępnij publicznie widok kalendarza lub osi czasu; jego
  okno udostępniania podaje adres **kanału iCalendar**, który można subskrybować w Kalendarzu
  Google („Inne kalendarze” → „Z adresu URL”), Outlooku lub Apple Calendar. Zobacz
  [Widoki udostępnione](/basedb/pl/fonctionnalites/vues-partagees/#subskrypcja-w-aplikacji-kalendarza).
- **Importuj kalendarz**: utwórz tabelę synchronizowaną ze źródłem „Kalendarz”, podając tajny
  adres iCal kalendarza.

## Tabele synchronizowane

Tabela synchronizowana jest **utrzymywana w zgodności ze źródłem**: czyta się ją, filtruje i
pokazuje w widokach jak każdą inną, ale nie zapisuje się jej ręcznie – przypomina o tym
plakietka „Synchronizowana”, a API odrzuca każdy zapis (`TABLE_SYNCED`).

| Źródło | Czym staje się tabela |
|---|---|
| **Plik CSV online** | jedna kolumna na każdą kolumnę pliku, typowana na podstawie zawartości: liczba, data lub tekst |
| **Kalendarz** (Kalendarz Google, iCalendar) | jedno wydarzenie na wiersz: tytuł, początek, koniec, miejsce, opis |
| **Widok udostępniony z basedb** | wiersze [widoku udostępnionego](/basedb/pl/fonctionnalites/vues-partagees/#źródło-dla-innych-baz), w tej lub innej instancji |

**Nowa tabela synchronizowana** wybiera źródło i interwał – od co 15 minut do raz dziennie;
**Synchronizuj** odczytuje ją od razu. Każde przejście tworzy, zmienia i usuwa to, co trzeba,
aby tabela odpowiadała źródłu, orientując się według pola **Klucz synchronizacji**. Wszystkie te
zapisy przechodzą przez historię.

**Zatrzymaj** synchronizację, a tabela stanie się zwykła: jej wiersze zostają i znów można je
zapisywać ręcznie.

## Ograniczenia

- Źródło jest odczytywane w granicach 5 MB, 10 000 wierszy i 10 sekund.
- Źródło, którego odczyt się nie powiódł, niczego nie kasuje: tabela zachowuje swoje wiersze do
  następnego przejścia.
- Kolumna, która pojawiła się w źródle po utworzeniu tabeli, nie jest dodawana.
- Slack łączy się przez przychodzący webhook, jeszcze nie przez aplikację Slack.

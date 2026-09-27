---
title: Sztuczna inteligencja
description: Opcja AI pola, szkice, Copilot i Copilot pulpitów – oraz to, co trafia do dostawcy.
---

AI jest **opcjonalna**. Bez skonfigurowanego dostawcy nic nigdzie nie wychodzi. basedb potrafi
rozmawiać z **OpenAI**, **Anthropic** i **Mistral**, z twoim własnym kluczem.

## Konfiguracja dostawcy

Dopóki w interfejsie nie zapisano żadnych ustawień, API czyta swoje środowisko:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic lub mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # lub BASEDB_AI_API_KEY
```

Klucz jest odczytywany z `BASEDB_AI_API_KEY`, a w jego braku ze zwyczajowej nazwy dostawcy
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## Opcja AI pola

AI nie jest typem pola, lecz **opcją**: przełącznik **AI** w formularzu pola – tekstu, długiego
tekstu, URL, liczby, pojedynczego wyboru, wartości logicznej, daty – sprawia, że wypełnia je
model, na podstawie polecenia przytaczającego inne kolumny:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Pole jest obliczane, gdy tylko wiersz powstanie, a potem za każdym razem, gdy zmieni się
  przytoczona kolumna – oraz, jeśli chcesz, według harmonogramu (najczęściej co 15 minut).
- Kolumna **zachowuje swój typ**: odpowiedź, w której nie da się niczego odczytać w tym typie
  (brak liczby, nieistniejący wybór), jest odrzucana, a nie zapisywana.
- Wyłączenie opcji sprawia, że pole znów można edytować ręcznie, a wartości zostają zachowane.
- Przytaczane wartości trafiają do dostawcy: **włączenie wymaga wyraźnej zgody**.

`BASEDB_AI_FIELD_QUOTA` ogranicza te obliczenia na godzinę i na tenanta (domyślnie 300).

## W automatyzacji

[Automatyzacja](/basedb/pl/fonctionnalites/automatisations/#zapytaj-ai) może w jednym ze swoich
kroków **zapytać AI**: polecenie przytaczające wiersz i poprzednie kroki, odpowiedź odczytana w
wybranym typie, którą kolejne kroki zapisują, wysyłają lub przytaczają. Te same zasady co dla
pola: zgoda przy zapisie, wychodzi tylko to, co przytacza polecenie, każde wywołanie jest
rejestrowane i liczone w `BASEDB_AI_FIELD_QUOTA`.

## Szkice i Copilot

- **Szkice**: opisz tabelę lub formułę jednym zdaniem i otrzymaj propozycję do przejrzenia.
  Wychodzą tylko etykiety, typy i wpisane zdanie – żadna wartość komórki.
- **Szablony**: opisz całą bazę – „obsługa reklamacji moich klientów” – i otrzymaj tabele,
  przykładowe wiersze, widoki, pulpit i automatyzacje, do dopracowania, a potem utworzenia.
  Wychodzi tylko zdanie. Zobacz [Szablony baz](/basedb/pl/fonctionnalites/modeles/#poproś-ai-o-szablon).
- **Copilot**: rozmowa o wyświetlanej bazie. Prosi się o filtr, zapytanie, kolumny, tabelę,
  zestaw danych testowych; każda propozycja przychodzi jako karta i stosuje się ją jednym
  kliknięciem, tymi samymi ścieżkami co formularze.

Domyślnie do dostawcy trafia tylko struktura. Pole wyboru **„Zezwól na odczyt danych”** pozwala
Copilotowi, na czas rozmowy, czytać wiersze (najwyżej 50 na odczyt) i odpowiadać na ich
podstawie – każdy odczyt jest wymieniony pod jego odpowiedzią.

## Copilot pulpitów

W sekcji [Pulpity](/basedb/pl/fonctionnalites/tableaux-de-bord/#copilot) Copilot proponuje
pytania, zmiany pulpitu i wartości jego filtrów, do zastosowania jednym kliknięciem. Te same
zasady: bez zgody wychodzi tylko struktura – tabele i pola, pulpity i pytania bazy, definicja
kart wyświetlanego pulpitu (ich pytania, ich teksty) –, nigdy wyniki ani wartości wybrane w
filtrach. Pole wyboru **„Zezwól na odczyt danych”** dodaje te wartości oraz wyniki kart przy
wyświetlanych filtrach, najwyżej 50 wierszy na odczyt, każdy wymieniony pod odpowiedzią.

## Copilot automatyzacji

W sekcji [Automatyzacje](/basedb/pl/fonctionnalites/automatisations/#copilot) Copilot
proponuje całą automatyzację – tę na ekranie, zmienioną, albo nową – którą nakłada na przepływ
w edytorze, **nigdy jej nie zapisując**: przeglądasz ją, a potem zapisujesz. Te same zasady:
bez zgody wychodzi tylko struktura – tabele i pola, automatyzacje bazy, ta na ekranie, jej
ostatnie uruchomienia bez żadnej wartości, osoby i kanały Slacka pod oznaczeniami –, a pole wyboru
**„Zezwól na odczyt danych”** dodaje odczytane wiersze, najwyżej 50 na odczyt.

`BASEDB_AI_QUOTA` ogranicza wywołania interaktywne na godzinę i na tenanta (domyślnie 120).

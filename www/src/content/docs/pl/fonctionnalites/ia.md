---
title: Sztuczna inteligencja
description: Opcja AI pola, szkice, Copilot i Copilot pulpitów – oraz to, co trafia do dostawcy.
---

AI jest **opcjonalna**. Bez skonfigurowanego dostawcy nic nigdzie nie wychodzi. basedb potrafi
rozmawiać z **OpenAI**, **Anthropic** i **Mistral**, z twoim własnym kluczem – oraz z każdym
serwerem obsługującym API OpenAI: **Azure**, firmową bramą, modelem serwowanym u ciebie.

## Konfiguracja dostawcy

Dopóki w interfejsie nie zapisano żadnych ustawień, API czyta swoje środowisko:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral lub openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # lub BASEDB_AI_API_KEY
```

Klucz jest odczytywany z `BASEDB_AI_API_KEY`, a w jego braku ze zwyczajowej nazwy dostawcy
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, brama, model lokalny

`BASEDB_AI_PROVIDER=openai_compatible` wysyła wywołania, w formacie OpenAI, pod adres z
`BASEDB_AI_BASE_URL`: to, co poprzedza `/chat/completions`, razem z parametrami.
`BASEDB_AI_HEADERS` dodaje do każdego wywołania nagłówki, których ten serwer wymaga, jako obiekt JSON.

```bash
# Azure OpenAI: nazwa wdrożenia jako model, klucz w nagłówku api-key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Starsza postać Azure, według wdrożenia: parametr zostaje po ścieżce
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Model serwowany przez Ollama, bez klucza
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Przy `openai_compatible` klucz jest opcjonalny: jeśli podano `BASEDB_AI_API_KEY`, jest wysyłany
w `Authorization: Bearer`. Nagłówek z `BASEDB_AI_HEADERS` zastępuje nagłówek klucza – na
przykład gdy brama chce własnego `Authorization`.

`BASEDB_AI_BASE_URL` i `BASEDB_AI_HEADERS` obsługują też trzech pozostałych dostawców, osiąganych
przez bramę: dla `anthropic` adresem jest to, co poprzedza `/messages`. Te dwie zmienne
towarzyszą dostawcy ze środowiska i tylko jemu: tenant, który wybrał innego, nie otrzymuje ani
adresu, ani nagłówków, ani klucza. Start API zapisuje w logu wybranego dostawcę i sygnalizuje
nieprawidłowy adres lub obiekt JSON.

Wewnętrzna brama z samopodpisanym certyfikatem TLS albo firmowe proxy, które na nowo podpisuje
ruch, sprawiają, że wywołania kończą się błędem: `BASEDB_AI_PROVIDER_SSL_VERIFY=false` przestaje
sprawdzać certyfikat **tylko tego dostawcy** – wszystkie pozostałe wywołania wychodzące instancji
oraz dostawca wybrany przez tenanta nadal są sprawdzane. Start to sygnalizuje. Ponieważ klucz
przechodzi w każdym wywołaniu, zarezerwuj to dla sieci, nad którą masz kontrolę.

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

---
title: Szablony baz
description: Zacznij od szablonu, poproś o niego AI, napisz własny w JSON – i opublikuj go dla wszystkich instancji.
---

**Szablon** tworzy całą bazę jednym kliknięciem: jej tabele i ich relacje, przykładowe
wiersze, widoki, pulpit, automatyzacje oraz pola, które AI wypełnia sama.
[Galeria szablonów](/basedb/pl/modeles/) pokazuje te, które proponuje basedb.

## Zacznij od szablonu

**Nowa baza**, a potem **Zacznij od szablonu lub poproś o niego AI**: otwiera się galeria.

![Galeria szablonów w aplikacji](../../../../assets/screens/modeles.png)

Każdy szablon można przeczytać w całości przed użyciem – jego tabele i ich pola, widoki,
automatyzacje i polecenie każdego z jego pól AI. **Utwórz bazę** prosi o jej etykietę oraz,
jeśli są pola AI, o twoją zgodę na to, by przytaczane przez nie wartości trafiały do dostawcy
AI instancji. Bez tej zgody są to zwykłe pola, wypełnione przykładowymi wartościami.

Pusty projekt proponuje też **bazę demonstracyjną**: małą agencję, jej klientów, projekty,
zadania, faktury i opinie, która pokazuje wszystkie oblicza basedb.

## Poproś AI o szablon

Na górze galerii opisz swoją potrzebę jednym zdaniem – „obsługa reklamacji moich klientów,
z analizą tonu”. AI proponuje kompletną bazę: tabele, wiarygodne przykładowe wiersze, widoki,
pulpit oraz pola AI, gdy zastosowanie tego wymaga. Przeglądasz ją jak szablon, możesz ją
**dopracować** („dodaj tabelę dostawców”), a potem utworzyć. AI otrzymuje tylko twoje
zdanie – żadnych danych z żadnej bazy – i nic nie zostaje utworzone przed twoim kliknięciem.

## Pisanie szablonu w JSON

Szablon to dokument JSON. Oto jego szkielet:

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

Najważniejsze zasady:

- **Wszystko przytacza się przez etykietę**: pole w widoku, filtr (`[Statut] ne "Résolu"`),
  formułę (`[Prix] * [Quantité]`), polecenie AI lub wiadomość (`{{Titre}}`). Wybór podaje się
  przez jego etykietę.
- **Pierwsze pole** tabeli jest jej polem wyświetlanym: tekst, liczba, data, e-mail lub adres.
- **Relację** deklaruje się w `links`, nigdy jako pole; wiersz wskazuje przez nią inny wiersz
  za pomocą `"@clé"`, czyli `$key` wiersza w tabeli docelowej.
- **Data** może być względna wobec dnia zastosowania szablonu: `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`; data z godziną dodaje godzinę, `"+1d 14:30"`. Osobę zapisuje się jako `"$moi"`.
- **Pole AI** ma `"ai": { "prompt": "…" }` i może otrzymać przykładową wartość, zapisywaną
  tylko wtedy, gdy AI nie jest używana.
- Szablon **nigdy** nie zawiera udostępnień, uprawnień, webhooków, plików ani osób innych niż
  `"$moi"`: czasem pochodzi z zewnątrz i nie może niczego otwierać.

Pełna dokumentacja – wszystkie typy pól, wszystkie klucze widoków, limity – znajduje się w
rozdziale 20 dokumentacji architektury, w repozytorium.

## Publikowanie szablonu dla wszystkich instancji

Szablony oficjalnej galerii to pliki z folderu
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
repozytorium, jeden plik na szablon, nazwany według jego `key`. Publiczna witryna tworzy z nich
[galerię](/basedb/pl/modeles/) i publikuje cały katalog pod adresem
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Każda instancja czyta go,
gdy ktoś otwiera galerię, i przechowuje przez godzinę: wystarczy zmienić plik i ponownie
opublikować witrynę, by zmienić galerię we wszystkich instancjach.

Każdy szablon jest sprawdzany podczas budowania witryny tym samym walidatorem co na serwerze:
nieprawidłowy szablon przerywa budowanie, zamiast trafić do użytkowników.

Instancja czyta adres `BASEDB_TEMPLATES_URL` – domyślnie adres publicznej witryny. Wskaż własny
katalog albo ustaw `off`, aby nie czytać żadnego: instancja serwuje wtedy szablony wbudowane w
jej wersję.

## Szablony twojej instancji

Administrator może **zaimportować szablon JSON** do swojej instancji z poziomu galerii
(„Importuj JSON”): trafia on do galerii wszystkich jej użytkowników i zastępuje szablon o tym
samym kluczu. Propozycję AI można tam dodać jednym kliknięciem.

Każda baza może też stać się szablonem: **Zapisz jako szablon** w menu bazy, w **Więcej
działań**. Jej tabele, pola, polecenia AI, relacje, widoki udostępnione, pulpity i
automatyzacje – oraz, jeśli chcesz, do 50 wierszy na tabelę – pobiera się jako JSON, gotowy
do włączenia do oficjalnego katalogu lub katalogu instancji. Automatyzacja, która wyszukuje
wiersz, wybiera gałęzie lub przytacza poprzedni krok, na razie jest pomijana, a ekran o tym
informuje.

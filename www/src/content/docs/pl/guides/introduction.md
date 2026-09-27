---
title: Wprowadzenie
description: Czym jest basedb i co odróżnia go od arkuszy kalkulacyjnych do pracy zespołowej.
---

**basedb** to baza danych do pracy zespołowej, w duchu współdzielonych arkuszy kalkulacyjnych,
którą hostujesz samodzielnie – z jedną różnicą, od której zależy cała reszta: **twoje dane
żyją w prawdziwych tabelach PostgreSQL**, typowanych i nazwanych czytelnie.

![Siatka tabeli w basedb](../../../../assets/screens/grille.png)

## Prosta obietnica

Żadnego generycznego modelu, żadnego `JSONB` na wszystko, żadnego `field_1837`:

| W basedb | W PostgreSQL |
|---|---|
| Baza „Ventes” | schemat `b_t4z56fq_ventes` |
| Tabela „Opportunités” | tabela `opportunites` |
| Pole „Échéance” (Data) | kolumna `echeance date` |
| Pojedynczy wybór „Statut” | kolumna `text` i jej ograniczenie `CHECK` |
| Relacja „Client” | kolumna `clients_id uuid` i jej `FOREIGN KEY` |

Możesz więc otworzyć `psql`, narzędzie BI albo skrypt w Pythonie i czytać swoje dane z
pominięciem produktu – a nawet je zapisywać: ograniczenia obowiązują, a historia rejestruje
zapis.

## Dla kogo?

- **Zespoły biznesowe**, które chcą siatki, widoków i formularzy bez czekania na
  programistów.
- **Zespoły techniczne**, które nie chcą, by ich dane były uwięzione w zastrzeżonym formacie,
  i chcą podłączyć swoje zwykłe narzędzia.
- **Agenci AI**, którzy znajdą tu serwer MCP, jasne uprawnienia i propozycje zatwierdzane
  przez człowieka.

## Co tu znajdziesz

- Typowane [tabele i pola](/basedb/pl/fonctionnalites/tables-et-champs/), relacje, które są
  prawdziwymi kluczami obcymi – także wielokrotne –, formuły obliczane przez PostgreSQL,
  odnośniki i agregacje przez relacje.
- Osiem [widoków](/basedb/pl/fonctionnalites/vues/): siatka, kanban, kalendarz, oś czasu,
  galeria, lista, formularz, ankieta – wspólne lub osobiste.
- [Formularze](/basedb/pl/fonctionnalites/formulaires-partages/) i
  [widoki](/basedb/pl/fonctionnalites/vues-partagees/) udostępniane przez link oraz kalendarze,
  które można subskrybować w aplikacji kalendarza.
- [Współpraca](/basedb/pl/fonctionnalites/collaboration/): komentarze i wzmianki,
  powiadomienia, aktualizacje w czasie rzeczywistym.
- [Automatyzacje](/basedb/pl/fonctionnalites/automatisations/) oraz
  [pulpity](/basedb/pl/fonctionnalites/tableaux-de-bord/) i ich pytania, budowane myszą lub w SQL.
- [SQL dla każdego](/basedb/pl/fonctionnalites/requetes-et-vues-sql/), z jego własnymi
  uprawnieniami: zapisane zapytania pod tabelami i prawdziwe widoki PostgreSQL ułożone
  wśród nich.
- [Szablony baz](/basedb/pl/fonctionnalites/modeles/) do wybrania z galerii lub do zamówienia
  u AI.
- [Środowiska](/basedb/pl/fonctionnalites/environnements/) – produkcyjne, testowe – które można
  porównywać i migrować.
- [Historia](/basedb/pl/fonctionnalites/historique/) każdego zapisu, łącznie z bezpośrednim SQL,
  i Ctrl+Z do cofania.
- [Uprawnienia](/basedb/pl/fonctionnalites/droits/) według grup, aż do poziomu pola.
- [API REST](/basedb/pl/integrations/api-rest/), [serwer MCP](/basedb/pl/integrations/mcp/),
  [webhooki](/basedb/pl/integrations/webhooks/), Slack i
  [tabele synchronizowane](/basedb/pl/integrations/synchronisation/).
- [AI](/basedb/pl/fonctionnalites/ia/) jako opcja: pola obliczane przez model, Copilot.

## Stan projektu

basedb to wolne oprogramowanie (AGPL-3.0) rozwijane przez [Eodia](https://eodia.com/fr/),
studio oprogramowania natywnie opartego na AI, i jest w fazie aktywnego rozwoju. Rdzeń, API,
serwer MCP i interfejs działają i są objęte ponad tysiącem testów;
[plan rozwoju](/basedb/pl/feuille-de-route/) mówi, co jeszcze przed nami. Jego
[dokument architektury](https://github.com/eodia/basedb/tree/main/docs/architecture), liczący
około dwudziestu rozdziałów, utrwala każdą decyzję.

:::tip[Wypróbuj]
Po sklonowaniu repozytorium wystarczy jedno polecenie: `docker compose up -d`. Zobacz
[instalację](/basedb/pl/guides/installation/).
:::

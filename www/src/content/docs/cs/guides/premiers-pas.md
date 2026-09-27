---
title: První kroky
description: Vytvoření databáze, tabulky, polí, zobrazení a formuláře.
---

Tento průvodce zabere deset minut a pokryje to podstatné: na konci budete mít tabulku,
zobrazení kanban a veřejný formulář, který do ní zapisuje.

:::tip[Vše najednou]
Prázdný projekt nabízí **ukázkovou databázi**: malou agenturu, její klienty, projekty, úkoly,
faktury a recenze, se vzorci, zobrazeními všech druhů, řídicím panelem a automatizacemi.
**Nová databáze** také otevírá [galerii šablon](/basedb/cs/fonctionnalites/modeles/),
kde můžete svou databázi popsat AI.
:::

## 1. Vytvoření databáze

Vše se organizuje podle **projektů**: přepínač nahoře v postranním panelu mění projekt nebo
vytváří nový. V panelu vytvoří databázi tlačítko **+** vpravo od filtru. Dejte jí popisek
– „Ventes“ – a pokud chcete, také popis, barvu a ikonu.

Databáze se stane **schématem PostgreSQL**: její fyzický název (`b_t4z56fq_ventes`) se
zobrazí ve formuláři a ve vygenerované dokumentaci.

## 2. Vytvoření tabulky a jejích polí

V nabídce **⋯** databáze zvolte **Nová tabulka**. Poté přidejte její pole na obrazovce
**Struktura** – ve stejné nabídce – tlačítkem
**Pole**:

| Pole | Typ |
|---|---|
| Nom | Krátký text |
| Statut | Jednoduchý výběr – Nouveau, Qualifié, Gagné, Perdu |
| Montant | Měna |
| Échéance | Datum |
| Client | Vazba → Clients |
| Notes | Dlouhý text (Markdown) |

Později se stejným způsobem přidá vzorec (`DAYS([Échéance], TODAY())`), vyhledávání
(město klienta) nebo agregace (celková částka na klienta) – viz
[Tabulky a pole](/basedb/cs/fonctionnalites/tables-et-champs/).

Můžete také **importovat soubor** CSV nebo JSON: import odhadne typy, nechá vás je opravit,
vytvoří tabulku nebo doplní existující a řádek po řádku sdělí, co odmítá.

![Nabídka databáze](../../../../assets/screens/menu-base.png)

## 3. Zadávání a filtrování

Mřížka se upravuje jako tabulkový procesor: dvojklik nebo Enter pro úpravu buňky, Esc pro
zrušení. **Filtrovat** kombinuje podmínky podle polí; řadí se ze záhlaví sloupce;
**Hledat…** vpravo na liště hledá ve všech sloupcích. Každá změna se ihned uloží – a
[zaznamená do historie](/basedb/cs/fonctionnalites/historique/): **Ctrl+Z** vrátí tu
poslední.

## 4. Přidání zobrazení

Přepínač zobrazení vlevo od „Filtrovat“ nabízí „Všechny řádky“ a pod nimi vaše zobrazení.
Vytvořte **kanban** seskupený podle pole „Statut“: přetažením karty z jednoho sloupce do
druhého se řádek změní.

![Kanban podle stavu](../../../../assets/screens/kanban.png)

## 5. Sdílení formuláře

Vytvořte zobrazení **Formulář**, zaškrtněte otázky a pak klikněte na **Sdílet**: zvolte
„Veřejný“ a zkopírujte odkaz. Každá odpověď přidá do tabulky řádek, aniž by respondent
získal jakákoli oprávnění. Podrobnosti najdete v článku
[Sdílené formuláře](/basedb/cs/fonctionnalites/formulaires-partages/).

## 6. Čtení v SQL

Nabídka **⋯** databáze → **Dotaz SQL**: vaše tabulky jsou tam pod svými skutečnými
názvy.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Uložit** ho zařadí pod tabulky do sekce „Dotazy“ – pro vás, nebo pro celou databázi –
a **⋯** → **Vytvořit pohled SQL…** z něj udělá skutečný pohled PostgreSQL zařazený mezi
tabulky. Každý je čte se svými vlastními oprávněními. Viz
[Dotazy a pohledy SQL](/basedb/cs/fonctionnalites/requetes-et-vues-sql/).

Totéž platí z `psql` nebo z vašeho nástroje BI. Viz [Přímé SQL](/basedb/cs/integrations/sql/).

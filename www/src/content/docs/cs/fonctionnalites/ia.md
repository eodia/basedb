---
title: Umělá inteligence
description: Možnost AI u pole, koncepty, Copilot a Copilot řídicích panelů – a co odchází k poskytovateli.
---

AI je **volitelná**. Bez nakonfigurovaného poskytovatele nikam nic neodchází. basedb umí
komunikovat s **OpenAI**, **Anthropic** a **Mistral**, s vaším vlastním klíčem.

## Nastavení poskytovatele

Dokud v rozhraní není uloženo žádné nastavení, API čte své prostředí:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic nebo mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # nebo BASEDB_AI_API_KEY
```

Klíč se čte z `BASEDB_AI_API_KEY`, případně z obvyklého názvu proměnné poskytovatele
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## Možnost AI u pole

AI není typ pole, ale **možnost**: přepínač **AI** ve formuláři pole – text, dlouhý text, URL,
číslo, jednoduchý výběr, logická hodnota, datum – nechá pole vyplňovat modelem na základě
pokynu, který cituje jiné sloupce:

```text
Shrň {{Notes}} jednou větou.
Kategorie pro {{Description}} z možností seznamu.
```

- Pole se vypočítá, jakmile řádek existuje, a pak pokaždé, když se změní citovaný sloupec –
  a pokud chcete, také podle plánu (nejčastěji každých 15 minut).
- Sloupec **si zachovává svůj typ**: odpověď, v níž nelze v tomto typu nic přečíst
  (nenalezené číslo, neexistující volba), je odmítnuta, místo aby byla zapsána.
- Po vypnutí možnosti lze pole opět upravovat ručně, hodnoty zůstanou zachovány.
- Citované hodnoty odcházejí k poskytovateli: **aktivace vyžaduje výslovný souhlas**.

`BASEDB_AI_FIELD_QUOTA` omezuje tyto výpočty za hodinu a na pracovní prostor (ve výchozím
nastavení 300).

## V automatizaci

[Automatizace](/basedb/cs/fonctionnalites/automatisations/#zeptat-se-ai) se může v jednom ze
svých kroků **zeptat AI**: pokyn, který cituje řádek a předchozí kroky, a odpověď čtená ve
zvoleném typu, kterou následující kroky zapíší, odešlou nebo citují. Stejná pravidla jako
u pole: souhlas při uložení, odchází jen to, co pokyn cituje, každé volání se zaznamenává
a započítává do `BASEDB_AI_FIELD_QUOTA`.

## Koncepty a Copilot

- **Koncepty**: popište tabulku nebo vzorec jednou větou a dostanete návrh ke kontrole.
  Odcházejí jen popisky, typy a zadaná věta – žádná hodnota buňky.
- **Šablony**: popište celou databázi – „sledování reklamací mých zákazníků“ – a dostanete
  tabulky, ukázkové řádky, zobrazení, řídicí panel a automatizace, které doladíte a pak
  vytvoříte. Odchází jen věta. Viz [Šablony databází](/basedb/cs/fonctionnalites/modeles/#vyžádání-od-ai).
- **Copilot**: konverzace o zobrazené databázi. Požádáte o filtr, dotaz, sloupce, tabulku,
  testovací data; každý návrh přijde jako karta a použije se jedním kliknutím, stejnými
  cestami jako formuláře.

Ve výchozím nastavení odchází k poskytovateli jen struktura. Zaškrtávací políčko **„Povolit
čtení dat“** umožní Copilotovi v rámci konverzace číst řádky (nejvýše 50 při jednom čtení)
a odpovídat na jejich základě – každé čtení je uvedeno pod jeho odpovědí.

## Copilot řídicích panelů

V sekci [Řídicí panely](/basedb/cs/fonctionnalites/tableaux-de-bord/#copilot) Copilot
navrhuje otázky, úpravy panelu a hodnoty pro jeho filtry, které použijete jedním kliknutím.
Stejná pravidla: bez souhlasu odchází jen struktura – tabulky a pole, panely a otázky
databáze, definice karet zobrazeného panelu (jejich otázky, jejich texty) –, nikdy výsledky
ani hodnoty zvolené ve filtrech. Zaškrtávací políčko **„Povolit čtení dat“** přidá tyto
hodnoty a výsledky karet pod zobrazenými filtry, nejvýše 50 řádků při jednom čtení, každé
uvedené pod odpovědí.

## Copilot automatizací

V sekci [Automatizace](/basedb/cs/fonctionnalites/automatisations/#copilot) Copilot navrhuje
celou automatizaci – tu na obrazovce, upravenou, nebo novou –, kterou umístí do toku
v editoru, **aniž by ji kdy uložil**: zkontrolujete ji a pak ji uložíte. Stejná pravidla: bez
souhlasu odchází jen struktura – tabulky a pole, automatizace databáze, ta na obrazovce, její
poslední spuštění bez jakékoli hodnoty, osoby a kanály Slacku pod zástupnými značkami –,
a zaškrtávací políčko **„Povolit čtení dat“** přidá přečtené řádky, nejvýše 50 při jednom
čtení.

`BASEDB_AI_QUOTA` omezuje interaktivní volání za hodinu a na pracovní prostor (ve výchozím
nastavení 120).

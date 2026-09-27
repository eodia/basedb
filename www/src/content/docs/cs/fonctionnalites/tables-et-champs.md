---
title: Tabulky a pole
description: Typy polí v basedb, jejich promítnutí do PostgreSQL, vzorce a počítaná pole.
---

Každá tabulka v basedb je tabulkou PostgreSQL; každé pole je typovaným sloupcem. Popisek,
který zadáte („Échéance“), se stabilní **slugifikací** změní na čitelný fyzický název
(`echeance`): bez diakritiky, malými písmeny, bez rezervovaných slov.

## Typy

| Typ | Sloupec PostgreSQL | Poznámky |
|---|---|---|
| Krátký text | `text` | jeden řádek |
| Dlouhý text | `text` | Markdown: výňatek v mřížce, vykreslení při najetí myší, vlastní editor; může [citovat sloupec](#formátovaný-text-a-proměnné) |
| Formátovaný text | `text` + `CHECK` | HTML sanitizované při zápisu, psané ve vizuálním editoru – [viz níže](#formátovaný-text-a-proměnné) |
| Číslo | `numeric` | nikdy s plovoucí řádovou čárkou: částka se nerozjede |
| Měna, Procento, Doba trvání, Hodnocení | `numeric` | číslo a jeho [formát zobrazení](#formáty-zobrazení): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Zaškrtávací políčko | `boolean` | |
| Datum | `date` | |
| Datum a čas | `timestamptz` | absolutní okamžik zobrazený v časovém pásmu čtenáře |
| Jednoduchý výběr | `text` + `CHECK` | barva, ikona nebo obrázek pro každou možnost |
| Vícenásobný výběr | `text[]` + `CHECK` | filtrovatelný operátory pro pole hodnot |
| E-mail | `text` + `CHECK` | adresa ověřená databází, otevíraná jedním kliknutím |
| Telefon, Čárový kód | `text` | krátký text a jeho formát: odkaz pro volání, neproporcionální písmo |
| URL | `text` + `CHECK` | doplňuje se při zadávání (`exemple.fr` → `https://exemple.fr`) |
| Osoba | `uuid` | člen pracovního prostoru; jeho označení ho [upozorní](/basedb/cs/fonctionnalites/collaboration/) |
| Automatické číslo | `bigint` identity | očísluje i již existující řádky; nikdo ho nezadává |
| Vazba | `uuid` + `FOREIGN KEY` | skutečný cizí klíč do cílové tabulky |
| Vícenásobná vazba | `uuid[]` | více propojených řádků, jejichž integritu hlídá trigger |
| Vzorec | generovaný sloupec `STORED` | počítá ho PostgreSQL – nebo se počítá při čtení, viz [Vzorce](#vzorce) |
| Vyhledávání, Agregace, Počet | žádný | počítají se při čtení, přes vazbu |
| Tlačítko | žádný | otevře adresu nebo spustí [automatizaci](/basedb/cs/fonctionnalites/automatisations/) |
| Soubor, Obrázek | `jsonb` (metadata) | bajty se ukládají do [úložiště souborů](/basedb/cs/fonctionnalites/fichiers/) |

Každá tabulka má také své **systémové sloupce**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` – udržuje je trigger a přes API do nich nelze
zapisovat. Mřížka je řadí pod **Systémové informace** v nabídce sloupců: jsou v každé
tabulce, ale užitečné jen v málokteré.

![Mřížka tabulky s vypočtenou dobou trvání, vyhledáváním a počtem](../../../../assets/screens/grille.png)

## Omezení hlídaná databází

Co slibuje rozhraní, to zaručuje PostgreSQL. Jednoduchý výběr je omezení `CHECK`; vazba je
`FOREIGN KEY`; URL nebo e-mailová adresa je regulární výraz. Zápis přímo v SQL, který je
poruší, je odmítnut stejně jako v rozhraní:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Formáty zobrazení

Měna, Procento, Doba trvání, Hodnocení, Telefon a Čárový kód se vybírají jako typy, ale jsou
to **formáty**: sloupec zůstává číslem nebo textem, mění se jen způsob čtení.

| Formát | Pro | Čte se a zadává jako |
|---|---|---|
| Měna | číslo | `12 500,00 €` – euro, dolar, libra, švýcarský frank, kanadský dolar, jen |
| Procento | číslo | `15 %` |
| Doba trvání | počet sekund | `1:30`, zadává se jako `1h30`, `90 min` |
| Hodnocení | číslo | 1 až 10 hvězdiček, nastavuje se kliknutím |
| Telefon | krátký text | odkaz pro volání |
| Čárový kód | krátký text | neproporcionálním písmem |

Formát lze změnit i dodatečně (**Formát zobrazení** v úpravě pole), aniž by se změnily uložené
hodnoty. Hodnotu neomezuje: hodnocení 7 na pětibodové stupnici zůstane 7.

## Vzorce

Vzorec se píše anglicky (fungují i francouzské názvy), pole v hranatých závorkách, argumenty oddělené `,`:

```text
ROUND([Montant HT] * (1 + [Taux de TVA]), 2)
IF([Payée], FALSE, DAYS(TODAY(), [Échéance]) > 0)
DAYS([Fin], [Début])
```

Editor nabízí pole k vložení a panel funkcí; chyba pojmenuje pole nebo znak, který ji
způsobil.

| Skupina | Funkce |
|---|---|
| Logické | `IF`, `IFBLANK`, `ISBLANK`, `AND`, `OR`, `NOT`, `TRUE`, `FALSE` |
| Čísla | `ROUND`, `ABS`, `CEILING`, `FLOOR`, `MIN`, `MAX` |
| Text | `UPPER`, `LOWER`, `TRIM`, `LEFT`, `RIGHT`, `LEN`, `TEXT`, `VALUE` |
| Data | `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DAYS`, `ADD_DAYS`, `DATE`, `TODAY`, `NOW` |
| Operátory | `+ - * /`, `&` pro spojení textu, `= <> < <= > >=` |

Vzorec se stane **generovaným sloupcem** PostgreSQL: `psql` a vaše nástroje ho čtou jako
ostatní. Vzorec, který závisí na dni (`TODAY()`, `NOW()`) nebo cituje vyhledávání
či agregaci, se **počítá při čtení**: v basedb se podle něj dá filtrovat i řadit, ale v přímém
SQL neexistuje.

Vzorec necituje jiný vzorec ani přímo vazbu – to dělá vyhledávání. Extrakce nebo nahrazení
části textu přijde později.

## Vyhledávání, agregace a počty

Tři pole čtou **přes vazbu**, jedním nebo druhým směrem – „klient projektu“, ale také „úkoly
propojené přes Projekt“:

- **vyhledávání** přinese hodnotu z propojeného řádku nebo seznam hodnot: město klienta
  projektu;
- **agregace** počítá nad propojenými řádky: počet hodnot, součet, průměr, minimum, maximum –
  obrat klienta, průměrné hodnocení jeho recenzí;
- **počet** spočítá propojené řádky: počet úkolů projektu.

Počítají se při každém čtení, **s oprávněními toho, kdo čte**: pokud je vám propojená tabulka
nepřístupná, je nepřístupné i pole. Lze podle nich filtrovat i řadit. Sledují jedinou vazbu,
nedá se do nich zapisovat, nemají sloupec – a tedy v přímém SQL neexistují – a nefigurují
v importu, ve formulářích ani v historii.

## Vazby

**Vazba** spojuje řádek s řádkem jiné tabulky téže databáze. Mřížka zobrazuje **zobrazovanou
hodnotu** cílového řádku – sloupec, který pro jeho tabulku určíte jako zobrazované pole –
a filtry vazbou procházejí (`clients_id.ville eq "Lyon"`). Řádky, které na řádek odkazují, se
zobrazují v jeho detailu řádku.

Zaškrtněte **Více řádků na záznam** a vazba se stane **vícenásobnou**: úkol závisí na více
úkolech, článek patří do více kategorií. Propojené řádky se zobrazují jako štítky, vybírají se
vyhledáváním a otevírají se jedním kliknutím z detailu řádku. Odstranění cílového řádku ho
vyjme ze seznamů, které ho citovaly – nebo je odmítnuto, pokud jste to tak zvolili. Použít lze
filtry `has_any`, `has_all` a `is_null` a i ony vazbou procházejí
(`taches_ids.titre contains "logo"`). Podle vícenásobné vazby zatím nelze řadit ani seskupovat
a nelze ji importovat.

## Tlačítko

Pole **Tlačítko** nemá hodnotu: jedná. **Otevře adresu** – `https://` nebo `mailto:`, která
může citovat řádek (`mailto:{{E-mail}}`) – nebo **spustí automatizaci** se spouštěčem tlačítkem
na téže tabulce. Zobrazuje se v buňce, na kartě i v detailu řádku.

## Popisy

Databáze, tabulka i pole mají **popis**, který lze měnit bez migrace. Kopíruje se do
`COMMENT ON`, který čte `psql`, do vygenerované dokumentace a do toho, co agent čte přes
`describe_table`.

## Formátovaný text a proměnné

**Formátovaný text** je HTML varianta dlouhého textu, kterou zvolíte při vytváření pole
(„Formátovaný text (HTML)“): nadpisy, tučné písmo, kurzíva, podtržení, přeškrtnutí, seznamy,
citace, kód, odkazy a oddělovače ve vizuálním editoru. HTML se **sanitizuje při zápisu**, ať
přichází z rozhraní, z API, ze serveru MCP nebo z importu, a omezení `CHECK` navíc odmítá
nebezpečné konstrukce zapsané přímo v SQL (`<script>`, atributy `on…`, `javascript:`). Žádné
obrázky, tabulky ani barvy: co by databáze neuchovala, to se nenabízí.

Dlouhý text – prostý i formátovaný – může **citovat sloupec svého řádku**. Nabídka **Sloupec**
v editoru vloží citaci na pozici kurzoru: štítek ve formátovaném textu, `{{Ville}}`
v Markdownu.

> Livraison prévue le `{{Livraison}}` à `{{Ville}}`.

- Sloupec uchovává citaci tak, jak je napsaná – `{{ville}}`, podle fyzického názvu: to čte
  `psql`.
- Všude jinde – v mřížce, v detailu řádku, v API, na serveru MCP, ve sdílených zobrazeních,
  v automatizacích – se text čte **s hodnotou řádku**: „Livraison prévue le 02/10/2026
  à Lyon.“ Změna města změní text.
- Jednoduchý výběr se čte podle popisku, osoba podle jména, datum ve vašem formátu; hodnota
  vložená do formátovaného textu nikdy není značkováním.
- Sloupec, který čtenář nesmí číst, nevydá nic: ani svou hodnotu, ani svůj název.

Formátovaný text nemůže vyplňovat AI: model píše text, nikoli sanitizované HTML.

## Úprava struktury

Obrazovka **Struktura** databáze – v její nabídce **⋯** v postranním panelu – vypisuje tabulky a jejich pole: přidat, přejmenovat, nastavit jako povinné, změnit pořadí,
popsat, určit zobrazované pole.

![Obrazovka Struktura databáze](../../../../assets/screens/structure.png)

Změna struktury vyžaduje úroveň **Správa**. Bez ní lze obrazovku jen prohlížet a nic
nenabízí: žádné tlačítko, žádnou tužku, žádný úchyt – povinnost a zobrazované pole jsou
uvedeny, ale nelze je měnit. Server každou změnu tak jako tak odmítne; obrazovka už nepředstírá,
že ji přijímá.

Přidání, přejmenování nebo změna typu pole prochází **migračním mechanismem**: plán
v krocích, krátké zámky a pojmenované odmítnutí, když se nějaký údaj nedá převést.

**Přejmenování** databáze, tabulky nebo pole probíhá v jediném dialogu. Popisek se změní
vždy, bez migrace. Správce pod ním vidí „Přejmenovat i v databázi: `clients` → `comptes`“:
je-li zaškrtnuto, změní se i fyzický název a zobrazí se analýza dopadu – dotazy, pohledy SQL
a automatizace, které citují starý název. Starý název dál obsluhuje **alias pro
kompatibilitu** – pohled – po dobu, než aktualizujete své dotazy.

Odstranění nic hned nesmaže: tabulka nebo databáze je odsunuta (`zz_supprime_…`) a zůstává
čitelná v SQL. Odstraněnou databázi lze obnovit; obnova samotné tabulky z rozhraní
[teprve přijde](/basedb/cs/feuille-de-route/). Definitivní **vyčištění** je vyhrazeno
administraci, po třiceti dnech, a začíná ověřeným exportem do CSV.

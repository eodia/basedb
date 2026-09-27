---
title: Spolupráce
description: Komentáře a zmínky, oznámení, aktualizace v reálném čase a přítomnost.
---

Na stejné databázi pracuje současně více lidí: každý vidí, jak přicházejí zápisy ostatních,
ví, kdo se dívá na co, a o řádku diskutuje přímo tam, kde se nachází.

## Komentáře

Detail řádku má záložku **Komentáře** mezi „Podrobnosti“ a „Historie“. Napište `@`, abyste
**zmínili** člena, a Ctrl+Enter pro odeslání. Každý může upravovat nebo odstraňovat své
vlastní komentáře.

![Konverzace o projektu](../../../../assets/screens/commentaires.png)

Ke komentování řádku stačí oprávnění ho číst. Zmíněná osoba, která ho číst nemůže, upozorněna
není – a autor je o tom informován, místo aby se domníval, že zpráva odešla.

## Oznámení

Zvonek vpravo nahoře počítá nepřečtené. Přicházejí do něj čtyři věci:

- někdo vás **zmíní** v komentáři;
- někdo **odpoví** v konverzaci, do které jste psali;
- někdo vás **určí** v poli Osoba – z rozhraní, z API, z formuláře nebo z automatizace;
- [automatizace](/basedb/cs/fonctionnalites/automatisations/) vás **upozorní**.

Otevřením oznámení se otevře řádek. **Označit vše jako přečtené** vynuluje počítadlo;
oznámení se uchovávají 90 dní.

![Přijatá zmínka](../../../../assets/screens/notifications.png)

## Reálný čas

Zápisy ostatních se zobrazují **bez obnovení stránky**: upravená buňka, přesunutá karta,
přidaný řádek – ať přicházejí z rozhraní, z API, od agenta nebo z přímého SQL. Server posílá
jen **signál**, nikdy data: obrazovka si je znovu načte s vašimi oprávněními. Buňka, kterou
právě upravujete, se vám pod rukama nikdy nepřepíše.

## Přítomnost

Tváře lidí, kteří se dívají na **stejnou tabulku**, se zobrazují nahoře na obrazovce; tváře
těch, kdo otevřeli **stejný řádek**, v záhlaví jeho detailu. V mřížce se ukazatel ostatních
objevuje na buňce, nad kterou se právě nacházejí.

## Vrácení změn

Ctrl+Z vrátí váš poslední zápis – viz [historie](/basedb/cs/fonctionnalites/historique/#vrácení-změn-ctrlz).

## Omezení

- Oznámení zůstávají v basedb: zatím se žádné neposílá e-mailem.
- Při více než stu řádcích změněných najednou obrazovka znovu načte celou stránku, nikoli
  řádek po řádku.

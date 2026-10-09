---
title: Prostředí
description: Produkční, testovací, vývojové – porovnat, migrovat, synchronizovat.
---

Databáze může mít **prostředí**: produkční, testovací, vývojové… Každé je plnohodnotnou
databází – má své schéma, své tabulky, své řádky, svá oprávnění – a všechna sdílejí **původ**
databáze, jejích tabulek a jejích polí.

## V rozhraní

Postranní panel zobrazuje **jeden řádek na databázi** se štítkem, který ukazuje otevřené
prostředí a umožňuje ho přepnout. Štítek se nezobrazuje, dokud existuje jen produkční
prostředí.

Prostředí se přidávají, přejmenovávají a odstraňují v **Upravit databázi…**: nové prostředí
vzniká **kopií struktury** jiného prostředí, bez jeho řádků.

## Porovnání prostředí

V nabídce databáze v části **Další akce** otevře **Porovnat prostředí…** dialog:

- **Struktura**: prostředí ve sloupcích, tabulky a pole v řádcích; co se liší od produkčního
  prostředí, je zvýrazněno.
- **Použít migrace…** připraví plán přechodu z jednoho prostředí do jiného, krok za krokem.
  Nikdy automaticky nezaškrtne to, co by zrušilo novější změnu v cílovém prostředí.
- **Synchronizace řádků**: tabulku po tabulce přenést řádky z jednoho prostředí do jiného
  podle identifikátoru.

![Porovnání produkčního a testovacího prostředí](../../../../assets/screens/cs/environnements.webp)

## Jak basedb ví, kdo co změnil

Porovnání se opírá o **historii struktury**: každé vytvoření, úprava nebo odstranění tabulky či
pole je zachyceno triggerem nad katalogem a lze ho číst na záložce „Struktura“ v historii.
Identifikátory původu spojují pole testovacího prostředí s jeho protějškem v produkčním
prostředí, i když bylo přejmenováno.

## Přes API, SDK a MCP

**Token vytvořený pro celou databázi** otevírá všechna její prostředí, ta dnešní i ta, která
přibudou: jediný token pro produkční a testovací prostředí. Program nebo agent si prostředí vybírá
při každém volání:

| Kde | Jak |
|---|---|
| [REST API](/basedb/cs/integrations/api-rest/#volba-prostředí) | hlavička `X-Basedb-Environment: recette`, nebo `?environment=recette` |
| [SDK](/basedb/cs/integrations/sdk/#prostředí) | `db.environment('recette')` |
| [MCP](/basedb/cs/integrations/mcp/#volba-prostředí) | adresa `…/mcp?environment=recette`, nebo argument `environment` nástroje |
| [n8n](/basedb/cs/integrations/n8n/#přihlašovací-údaje) | pole **Environment** přihlašovacích údajů |

Bez čehokoli z toho označuje každá databáze své vlastní prostředí: název produkčního prostředí otevře
produkční, název testovacího otevře testovací. Token lze také při vytvoření omezit na zobrazené
prostředí: žádné další pak nevidí. V obou případech se jeho oprávnění porovnávají, prostředí po
prostředí, s oprávněními osoby, která ho vytvořila.

## V SQL

Každé prostředí je schéma: `b_t4z56fq_ventes` pro produkční, `b_t4z56fq_ventes_recette` pro
testovací. Vaše dotazy přepínají prostředí změnou schématu – nebo `search_path`.

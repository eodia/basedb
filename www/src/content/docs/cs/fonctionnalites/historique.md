---
title: Historie
description: Každý zápis, ať přichází odkudkoli, i s předchozími hodnotami.
---

basedb zaznamenává do historie **každý zápis**, ať přichází odkudkoli: z rozhraní, z API, od
agenta MCP, z veřejného formuláře – a dokonce i dotaz SQL napsaný ručně v `psql`.

![Historie databáze](../../../../assets/screens/historique.png)

## Jak se zachytává

Nezachytává ho aplikace, ale **triggery PostgreSQL**, přímo v transakci zápisu. Zápis, který
selže, nezanechá žádnou stopu; zápis, který uspěje, ji nemůže postrádat. Revize se pak
přesouvají do neměnných žurnálů rozdělených po měsících.

Identita putuje prostřednictvím proměnných relace nastavených na začátku každé transakce.
Zápis, který je nenese – přímé SQL –, se zaznamená jako takový, s relací, která ho provedla
(`psql`, adresa, proces): kvůli tomu však nikdy není odmítnut.

| Aktér | Zobrazen jako |
|---|---|
| osoba | její jméno |
| program (API) nebo agent (MCP) | osoba, která vytvořila token, „přes token …“ |
| veřejný formulář | „Formulář ‚…‘ · veřejná odpověď“ |
| automatizace | „Automatizace ‚…‘ · jménem“ osoby, která za ni odpovídá |
| přímé SQL | „Přímá relace SQL“ |

## Co s ní lze dělat

- **Číst** historii řádku (záložka „Historie“ v jeho detailu), tabulky nebo databáze
  (**Historie** v nabídce **⋯** databáze), filtrovanou podle tabulky.
- **Vrátit** změnu: předchozí hodnoty se znovu použijí pole po poli.
- **Obnovit** odstraněný řádek z jeho záznamu „odstranil(a)“.
- Sledovat **historii struktury** (záložka „Struktura“): vytvořené, upravené a odstraněné
  tabulky a pole.

## Vrácení změn (Ctrl+Z)

V mřížce **Ctrl+Z** (⌘Z na Macu) vrátí váš poslední zápis; **Ctrl+Shift+Z** nebo **Ctrl+Y**
ho znovu provede. Zpráva potvrdí, co bylo vráceno – „Vráceno: úprava pole ‚Montant‘“ –
a nabídne tlačítko, kterým vrácení odvoláte.

Takto lze vrátit buňku, přesunutou kartu nebo pruh, vytvořený nebo odstraněný řádek, vložení –
i celý import, počítaný jako jediná akce. Až padesát akcí, v každé záložce prohlížeče zvlášť.

Nejde o návrat obrazovky zpět: je to **nový zápis**, který provede server na základě historie
a který se rovněž zaznamená do historie. Je odmítnut, pokud řádek mezitím někdo upravil –
„Vrácení není možné: pole ‚Statut‘ bylo mezitím upraveno“ – místo aby přepsal jeho práci.
Takto lze vracet jen vlastní zápisy z posledních dvaceti čtyř hodin, a nikdy ne strukturu.
V buňce, do které právě píšete, zůstává Ctrl+Z zkratkou pro text.

## Oprávnění

Historie se řídí oprávněními ke čtení: pole, které je před vámi skryté, se v revizích, které
čtete, neobjeví.

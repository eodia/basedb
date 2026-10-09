---
title: Mesterséges intelligencia
description: A mezők MI-beállítása, a piszkozatok, a Copilot és az irányítópultok Copilotja – és mi kerül a szolgáltatóhoz.
---

Az MI **opcionális**. Beállított szolgáltató nélkül semmi nem kerül sehova. A basedb az
**OpenAI**, az **Anthropic** és a **Mistral** szolgáltatásait tudja használni, az Ön saját
kulcsával – és minden olyan szerverrel is képes beszélni, amely az OpenAI API-ját érti:
**Azure**, egy vállalati átjáró, egy Önnél futó modell.

## Szolgáltató beállítása

Amíg a felületen nincs mentett beállítás, az API a környezetéből olvas:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral vagy openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # vagy BASEDB_AI_API_KEY
```

A kulcsot a rendszer a `BASEDB_AI_API_KEY` változóból olvassa, ennek hiányában a szolgáltató
szokásos nevéből (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, egy átjáró, egy helyi modell

A `BASEDB_AI_PROVIDER=openai_compatible` az OpenAI formátumában küldi a hívásokat a
`BASEDB_AI_BASE_URL` címére: ez minden, ami a `/chat/completions` előtt áll, a paraméterekkel
együtt. A `BASEDB_AI_HEADERS` minden híváshoz hozzáadja azokat a fejléceket, amelyeket az adott
szerver kér, JSON-objektumként.

```bash
# Azure OpenAI: a telepítés neve a modell, a kulcs az api-key fejlécben
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Az Azure régi, telepítésenkénti formája: a paraméter az elérési út után marad
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Ollama által kiszolgált modell, kulcs nélkül
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Az `openai_compatible` esetén a kulcs elhagyható: ha a `BASEDB_AI_API_KEY` meg van adva,
`Authorization: Bearer` fejlécben megy el. A `BASEDB_AI_HEADERS` egy fejléce felülírja a kulcsét –
például egy átjáró esetén, amely a saját `Authorization` fejlécét akarja.

A `BASEDB_AI_BASE_URL` és a `BASEDB_AI_HEADERS` a másik három szolgáltatót is kiszolgálja, ha
átjárón keresztül érik el őket: az `anthropic` esetén a cím az, ami a `/messages` előtt áll. E két
változó a környezet szolgáltatóját kíséri, és csak azt: az a munkaterület, amely másikat
választott, sem a címet, sem a fejléceket, sem a kulcsot nem kapja meg. Az API indításakor a napló
kiírja a kiválasztott szolgáltatót, és jelzi az érvénytelen címet vagy JSON-objektumot.

Egy belső átjáró, amelynek TLS-tanúsítványa önaláírt, vagy egy vállalati proxy, amely újraaláírja
a forgalmat, meghiúsítja a hívásokat: a `BASEDB_AI_PROVIDER_SSL_VERIFY=false` **csak ennek a
szolgáltatónak** a tanúsítványát nem ellenőrzi többé – a példány minden egyéb kimenő hívása, és az
a szolgáltató, amelyet egy munkaterület választott, továbbra is ellenőrzött marad. Az indítás
jelzi ezt. Mivel a kulcs minden hívásban átmegy, csak olyan hálózaton használja, amelyet Ön
felügyel.

## A mező MI-beállítása

Az MI nem mezőtípus, hanem egy **beállítás**: a mező űrlapján lévő **MI** kapcsoló – szöveg,
hosszú szöveg, URL, szám, egyszeres választás, logikai érték, dátum esetén – azt eredményezi,
hogy a mezőt egy modell tölti ki, egy olyan utasítás alapján, amely más oszlopokra hivatkozik:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- A mező kiszámítódik, amint a sor létrejön, majd minden alkalommal, amikor egy hivatkozott
  oszlop megváltozik – és ha szeretné, ütemezetten is (legfeljebb 15 percenként).
- Az oszlop **megtartja a típusát**: az a válasz, amelyből nem olvasható ki ilyen típusú érték
  (nem található szám, nem létező választási lehetőség), elutasításra kerül, nem pedig
  beírásra.
- A beállítás kikapcsolásával a mező ismét kézzel szerkeszthetővé válik, az értékek
  megmaradnak.
- A hivatkozott értékek a szolgáltatóhoz kerülnek: **a bekapcsoláshoz kifejezett hozzájárulás
  szükséges**.

A `BASEDB_AI_FIELD_QUOTA` óránként és munkaterületenként korlátozza ezeket a számításokat
(alapértelmezés szerint 300).

## Automatizálásban

Egy [automatizálás](/basedb/hu/fonctionnalites/automatisations/#mi-megkérdezése) az egyik
lépésében **megkérdezheti az MI-t**: egy utasítás, amely a sorra és a korábbi lépésekre
hivatkozik, és egy válasz, amelyet a rendszer a választott típusként értelmez, és amelyet a
következő lépések beírnak, elküldenek vagy hivatkoznak rá. Ugyanazok a szabályok, mint egy
mezőnél: hozzájárulás mentéskor, csak az kerül elküldésre, amire az utasítás hivatkozik, és
minden hívás naplózásra kerül, és beleszámít a `BASEDB_AI_FIELD_QUOTA` keretbe.

## Piszkozatok és Copilot

- **Piszkozatok**: egy tábla vagy képlet leírása egy mondatban, és egy átnézendő javaslat
  fogadása. Csak a címkék, a típusok és a beírt mondat kerül elküldésre – egyetlen cellaérték
  sem.
- **Sablonok**: egy teljes adatbázis leírása – „ügyfeleim panaszainak nyomon követése” –, és
  táblák, példasorok, nézetek, irányítópult és automatizálások fogadása, amelyeket
  finomíthat, majd létrehozhat. Csak a mondat kerül elküldésre. Lásd:
  [Adatbázissablonok](/basedb/hu/fonctionnalites/modeles/#kérje-az-mi-től).
- **Copilot**: beszélgetés a megjelenített adatbázisról. Kérhet egy szűrőt, egy lekérdezést,
  oszlopokat, egy táblát, tesztadatokat; minden javaslat kártyaként érkezik, és egy kattintással
  alkalmazható, ugyanazokon az útvonalakon keresztül, mint az űrlapok.

Alapértelmezés szerint csak a struktúra kerül a szolgáltatóhoz. Az **„Adatok olvasásának
engedélyezése”** jelölőnégyzet lehetővé teszi a Copilot számára, hogy a beszélgetés idejére
sorokat olvasson (olvasásonként legfeljebb 50-et), és ezek alapján válaszoljon – minden olvasás a
válasza alatt fel van sorolva.

## Az irányítópultok Copilotja

Az [Irányítópultok](/basedb/hu/fonctionnalites/tableaux-de-bord/#a-copilot) részben a Copilot
kérdéseket, az irányítópult módosításait és a szűrőihez értékeket javasol, amelyek egy
kattintással alkalmazhatók. Ugyanazok a szabályok: hozzájárulás nélkül csak a struktúra kerül
elküldésre – a táblák és a mezők, az adatbázis irányítópultjai és kérdései, a megjelenített
irányítópult kártyáinak definíciója (a kérdéseik, a szövegeik) –, soha nem az eredmények vagy a
szűrőkben kiválasztott értékek. Az **„Adatok olvasásának engedélyezése”** jelölőnégyzet ezeket
az értékeket és a kártyák eredményeit is hozzáadja a megjelenített szűrők szerint,
olvasásonként legfeljebb 50 sort, mindegyiket a válasz alatt felsorolva.

## Az automatizálások Copilotja

Az [Automatizálások](/basedb/hu/fonctionnalites/automatisations/#a-copilot) részben a Copilot
egy teljes automatizálást javasol – a képernyőn lévőt módosítva, vagy egy újat –, amelyet a
szerkesztő folyamatára helyez, **anélkül, hogy valaha is mentené**: Ön átnézi, majd menti.
Ugyanazok a szabályok: hozzájárulás nélkül csak a struktúra kerül elküldésre – a táblák és a
mezők, az adatbázis automatizálásai, a képernyőn lévő, és annak legutóbbi futtatásai mindenféle
érték nélkül, a személyek és a Slack-csatornák jelölőkkel –, az **„Adatok olvasásának
engedélyezése”** jelölőnégyzet pedig olvasott sorokat is hozzáad, olvasásonként legfeljebb
50-et.

A `BASEDB_AI_QUOTA` óránként és munkaterületenként korlátozza az interaktív hívásokat
(alapértelmezés szerint 120).

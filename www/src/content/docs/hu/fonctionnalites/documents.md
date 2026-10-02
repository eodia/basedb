---
title: PDF-dokumentumok
description: Egy sor számlaként, árajánlatként, adatlapként vagy igazolásként, az Ön színeiben, logóval, kapcsolt sorokkal és összesítésekkel.
---

Egy sorból **PDF** lesz: egy számla a soraival és az összesítésével, egy árajánlat, egy
szállítási bizonylat, egy termékadatlap, egy igazolás. Egy sor részletei panelen a
**PDF-dokumentum** gomb új lapon nyitja meg, ahonnan a böngésző kinyomtatja vagy elmenti.

## Az adatlap, beállítás nélkül

Sablon nélkül egy sor **adatlapként** nyomtatódik ki: a neve címként, majd az összes mező,
amelyet olvashat, az Ön nyelvén.

## Sablon létrehozása

Aki felépíti a táblát – a Kezelés szint –, az a sablonokat egy sor részletei panelről hozza
létre: **PDF-dokumentum › Dokumentumsablonok…**. Egy új sablon egy **kiindulási pontból**
indul ki:

| Kiindulási pont | Mit tartalmaz |
|---|---|
| **Számla** | fejrész logóval és elérhetőségekkel, „SZÁMLA”, szám és dátum; ügyfél; számlázott sorok és összesítésük; nettó/bruttó összesítő; fizetési feltételek; jogi közlemények a lábrészben |
| **Árajánlat** | cím egy színes sávon, információk rácsban, szolgáltatások, érvényesség, egy „Jóváhagyva” terület |
| **Adatlap** | nagy, teljes szélességű cím, a Kép mező fotója, mezők rácsban, hosszú szövegek |
| **Igazolás** | keretezett fekvő lap, középre igazított szöveg, aláírás |
| **Üres oldal** | egy cím és a sor mezői |

**A tábla oszlopaival** épül fel – a számával, a dátumával, az összegeivel, a fotójával, a
hozzá kapcsolt sorokkal –, és amit a tábla nem tartalmaz, az egyszerűen kimarad. Innen bármi
módosítható; az előnézet, jobb oldalon, a megnyitott sor PDF-jét mutatja, és minden
módosításnál frissül.

## A tartalom: blokkok

A blokkok fentről lefelé követik egymást; a fogantyújuknál **húzva** rendezhetők át, és
megnyitva állíthatók be.

| Blokk | Mit mutat |
|---|---|
| **Cím** | egy nagy cím és egy alcím, egyszerű, színes, aláhúzott, vagy egy sávon – a lap széléig érő |
| **Szöveg** | formázott szöveg – címsorok, félkövér, listák, hivatkozások –, amely az **Oszlop** menüvel hivatkozik a sor oszlopaira: „`{{numero}}` számú számla, kelte `{{date}}`”; igazított vagy sorkizárt, színezett háttéren, keretezve vagy egy színes csíkkal jelölve |
| **Kép** | egy logó, egy pecsét, vagy a sor egy Kép mezőjének fotója |
| **Sor mezői** | a kiválasztott mezők, vagy az összes: címke balra, címke fölül 2 vagy 3 oszlopos rácsban, vagy **összesítő** – értékek jobbra, az utolsó (a fizetendő összeg) félkövéren; az üres mezők elrejthetők |
| **Kapcsolt sorok táblázata** | azok a sorok, amelyek ide hivatkoznak – egy számla sorai –, vagy amelyeket egy többszörös kapcsolat jelöl ki, **összesítéseikkel**; színes fejrész, soronként váltakozó árnyalás, fejrészek, oszlopszélességek és -igazítások az Ön kezében („Db” a „Mennyiség” helyett) |
| **Oszlopok** | két vagy három egymás melletti oszlop, mindegyik saját blokkjaival: „Számlázási cím” egyik oldalon, a hivatkozások a másikon |
| **Elválasztó**, **Térköz** | egy vonal – rövid, aláírásnak – vagy egy üres hely |
| **Oldaltörés** | a folytatás egy új lapon |

## A stílus és a lap

- **Kiemelő szín** – az Ön márkájáé: címek, sávok, táblázatfejek, hivatkozások. A rajta lévő
  szöveg fehér vagy sötét, attól függően, melyik olvasható jobban.
- **Szövegszín**, a szöveg és a címek **betűtípusa** (talpas vagy talp nélküli), a szöveg
  **mérete**, az alcímek stílusa.
- **Formátum** (A4 vagy Letter), **irányultság**, **margók**, egyszeres vagy dupla **keret** a
  lap körül, **függőlegesen középre igazított** tartalom – egy igazoláshoz.
- **Az értékek nyelve**: az összegek a pénznemükkel íródnak („1 234,50 €”), a dátumok kiírva
  („2026. szeptember 30.”), igen és nem, egy választás címkéje, egy személy neve. A szöveg
  beépített betűtípusokkal van szedve, amelyek a basedb mind a húsz nyelvét lefedik, az
  írásjegyeket is beleértve.

## Fejrész és lábrész

A **fejrész** hordozza az Ön **logóját** – egy feltöltött képet (PNG, JPEG vagy SVG; egy túl
nagy kép méretét csökkenti a rendszer) vagy a sor Kép mezőjét –, egy bal oldali szöveget (az
Ön elérhetőségei) és egy jobb oldali szöveget (mi a dokumentum, száma, dátuma), az első lapon
vagy mindegyiken. A **lábrész** hordozza a jogi közleményeit és a lapszámokat. Mindkettő
hivatkozik a sor oszlopaira, mint egy szöveg.

## Mindenki a saját jogosultságaival

Egy dokumentumot **a nyomtató jogosultságaival** olvas a rendszer: az előle elrejtett mező nem
szerepel benne – sem egy szövegben, sem képként –, egy kapcsolt sor, amelyet nem lát, nincs a
táblázatban – sem az összesítésben. Két személy tehát két különböző dokumentumot kaphat
ugyanabból a sorból: mindegyiké a saját joga szerint készül.

## Az API-ból

```bash
# Egy sor PDF-je egy sablonnal, vagy „adatlapként”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` a tábla sablonjait sorolja fel.

## Korlátok

- Egy feltöltött kép legfeljebb 300 KB, nyolc sablononként; egy mező képét a rendszer átveszi,
  ha az PNG vagy JPEG formátumú.
- Egy kapcsolt sor értéke a táblázaton kívül egy **Kikeresés** mezővel hivatkozható a
  dokumentum táblájában; egy bruttó összeg a tábla egy mezője.
- Soronként egy dokumentum: több sor PDF-je még nincs. Egy
  [automatizálás](/basedb/hu/fonctionnalites/automatisations/#egy-pdf-és-egy-e-mail) megteheti
  ezt Önnek – **PDF létrehozása** –, és elküldheti mellékletként.

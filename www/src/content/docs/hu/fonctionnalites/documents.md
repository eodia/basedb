---
title: PDF-dokumentumok
description: Egy sor számlaként, árajánlatként vagy nyomtatható adatlapként, a kapcsolt soraival és összesítéseivel.
---

Egy sorból **PDF** lesz: egy számla a soraival és az összesítésével, egy árajánlat, egy
szállítási bizonylat, egy adatlap. Egy sor részletei panelen a **PDF-dokumentum** gomb új
lapon nyitja meg, ahonnan a böngésző kinyomtatja vagy elmenti.

## Az adatlap, beállítás nélkül

Sablon nélkül egy sor **adatlapként** nyomtatódik ki: a neve címként, majd az összes mező,
amelyet olvashat, az Ön nyelvén.

## A sablonok

Aki felépíti a táblát – a Kezelés szint –, az írja meg őket, egy sor részletei panelről:
**PDF-dokumentum › Dokumentumsablonok…**. Egy sablon egy lap (A4 vagy Letter, álló vagy
fekvő), egy nyelv az értékekhez, egy lábjegyzet és egy blokksorozat:

| Blokk | Mit mutat |
|---|---|
| **Szöveg** | formázott szöveg – címsorok, félkövér, listák, hivatkozások –, amely az **Oszlop** menüvel hivatkozik a sor oszlopaira: „`{{numero}}` számú számla, kelte `{{date}}`” |
| **Sor mezői** | a kiválasztott mezők, vagy az összes: a címke balra, az érték jobbra |
| **Kapcsolt sorok táblázata** | azok a sorok, amelyek ide hivatkoznak – egy számla sorai –, vagy amelyeket egy többszörös kapcsolat jelöl ki, a kiválasztott oszlopokkal és azok **összesítéseivel** |
| **Oldaltörés** | a folytatás egy új lapon |

A szerkesztő mellette megmutatja azt a PDF-et, amelyet a sablon a megnyitott sorból készít, a
módosításokkal együtt.

Az értékek **a sablon nyelvén** íródnak: egy összeg a pénznemével („1 234,50 €”), egy dátum
kiírva („2026. szeptember 30.”), igen és nem, egy választás címkéje, egy személy neve. A
szöveg beépített betűtípusokkal van szedve, amelyek a basedb mind a húsz nyelvét lefedik, az
írásjegyeket is beleértve.

## Mindenki a saját jogosultságaival

Egy dokumentumot **a nyomtató jogosultságaival** olvas a rendszer: az előle elrejtett mező nem
szerepel benne, egy kapcsolt sor, amelyet nem lát, nincs a táblázatban – sem az
összesítésben. Két személy tehát két különböző dokumentumot kaphat ugyanabból a sorból:
mindegyiké a saját joga szerint készül.

## Az API-ból

```bash
# Egy sor PDF-je egy sablonnal, vagy „adatlapként”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` a tábla sablonjait sorolja fel.

## Korlátok

- Nincs kép (logó) és nincs választható szín egy dokumentumban, nincs a lábjegyzettől eltérő
  fejrész.
- Soronként egy dokumentum: több sor PDF-je, illetve automatizálás által történő előállítás
  még nincs.

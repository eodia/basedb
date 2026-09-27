---
title: Adatbázissablonok
description: Indulás egy sablonból, sablon kérése az MI-től, saját sablon írása JSON-ban – és közzététele minden példány számára.
---

Egy **sablon** egyetlen kattintással egy teljes adatbázist hoz létre: a tábláit és azok
kapcsolatait, példasorokat, nézeteket, egy irányítópultot, automatizálásokat, valamint olyan
mezőket, amelyeket az MI maga tölt ki. A [sablongaléria](/basedb/hu/modeles/) mutatja
azokat, amelyeket a basedb kínál.

## Indulás egy sablonból

**Új adatbázis**, majd **Indulás sablonból, vagy kérje az MI-től**: megnyílik a galéria.

![A sablongaléria az alkalmazásban](../../../../assets/screens/modeles.png)

Minden sablon teljes egészében átnézhető használat előtt – a táblái és azok mezői, a nézetei,
az automatizálásai és az egyes MI-mezőinek utasításai. Az **Adatbázis létrehozása** bekéri a
címkét, és ha vannak MI-mezők, az Ön hozzájárulását ahhoz, hogy az általuk hivatkozott értékek
a példány MI-szolgáltatójához kerüljenek. E hozzájárulás nélkül ezek közönséges mezők, a
példaértékeikkel kitöltve.

Egy üres projekt a **bemutató adatbázist** is felkínálja: egy kis ügynökség az ügyfeleivel,
projektjeivel, feladataival, számláival és értékeléseivel, amely a basedb minden oldalát
bemutatja.

## Kérje az MI-től

A galéria tetején írja le egy mondatban, mire van szüksége – „ügyfeleim panaszainak nyomon
követése, a hangnem elemzésével”. Az MI egy teljes adatbázist javasol: táblákat, hihető
példasorokat, nézeteket, irányítópultot, és MI-mezőket, ha a felhasználás indokolja. Ugyanúgy
átnézheti, mint egy sablont, **finomíthatja** („adj hozzá egy beszállítói táblát”), majd
létrehozhatja. Az MI csak az Ön mondatát kapja meg – egyetlen adatbázisból sem kap adatot –, és
semmi nem jön létre az Ön kattintása előtt.

## Sablon írása JSON-ban

A sablon egy JSON-dokumentum. Íme a váza:

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

A legfontosabb szabályok:

- **Mindenre a címkéjével kell hivatkozni**: egy mezőre egy nézetben, egy szűrőben
  (`[Statut] ne "Résolu"`), egy képletben (`[Prix] * [Quantité]`), egy MI-utasításban vagy egy
  üzenetben (`{{Titre}}`). Egy választási lehetőséget a címkéjével kell megadni.
- A tábla **első mezője** a megjelenítési mezője: szöveg, szám, dátum, e-mail vagy cím.
- A **kapcsolatot** a `links` részben kell deklarálni, soha nem mezőként; egy sor a `"@clé"`
  alakkal hivatkozik rá, ahol ez a céltábla egy sorának `$key` értéke.
- A **dátum** lehet relatív ahhoz a naphoz képest, amikor a sablont alkalmazzák: `"today"`,
  `"+3d"`, `"-2w"`, `"+1m"`; a dátum és idő az időpontot is hozzáadja: `"+1d 14:30"`. Egy
  személyt `"$moi"` alakban kell írni.
- Egy **MI-mező** `"ai": { "prompt": "…" }` kulcsot tartalmaz, és kaphat példaértéket, amely
  csak akkor kerül beírásra, ha az MI nincs használatban.
- A sablon **soha** nem tartalmaz megosztást, jogosultságot, webhookot, fájlt vagy a `"$moi"`
  értéken kívül más személyt: néha máshonnan származik, és semmit nem nyithat meg.

A teljes referencia – az összes mezőtípus, az összes nézetkulcs, a korlátok – az
architektúra-dokumentáció 20. fejezetében található, a tárolóban.

## Sablon közzététele minden példány számára

A hivatalos galéria sablonjai a tároló
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
mappájának fájljai, sablononként egy fájl, a `key` értéke szerint elnevezve. A nyilvános webhely
ezekből készíti a [galériát](/basedb/hu/modeles/), és a teljes katalógust a
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json) címen teszi közzé. Minden
példány akkor olvassa be, amikor valaki megnyitja a galériát, és egy órán át megőrzi: egy fájl
módosítása és a webhely újbóli közzététele elég ahhoz, hogy minden példány galériája megváltozzon.

Minden sablont a webhely buildelésekor ugyanaz a validátor ellenőriz, mint a szerveren: egy
érvénytelen sablon a build meghiúsulását okozza, ahelyett hogy a felhasználókhoz kerülne.

A példány a `BASEDB_TEMPLATES_URL` címet olvassa – alapértelmezés szerint a nyilvános
webhelyét. Állítsa egy saját katalógusra, vagy adja meg az `off` értéket, ha egyiket sem
szeretné beolvasni: ekkor a példány a verziójába beépített sablonokat kínálja.

## A példánya sablonjai

Egy adminisztrátor **JSON-sablont importálhat** a példányába a galériából („JSON importálása”):
a sablon bekerül az összes felhasználó galériájába, és lecseréli az azonos kulcsú sablont. Az
MI javaslata egy kattintással hozzáadható.

Bármely adatbázisból sablon is lehet: **Mentés sablonként** az adatbázis menüjében, a
**További műveletek** alatt. A táblái, mezői, MI-utasításai, kapcsolatai, megosztott nézetei,
irányítópultjai és automatizálásai – és ha szeretné, táblánként legfeljebb 50 sor – JSON-ként
letölthetők, készen arra, hogy a hivatalos vagy a példány saját katalógusába kerüljenek. Az az
automatizálás, amely sort keres, ágakat használ vagy egy korábbi lépésre hivatkozik, egyelőre
kimarad, és a képernyő ezt jelzi.

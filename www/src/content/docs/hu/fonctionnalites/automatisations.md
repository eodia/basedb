---
title: Automatizálások
description: Amikor egy sor megváltozik, ütemezetten vagy egy kattintásra – módosítás, létrehozás, keresés, elágazás, az MI megkérdezése, értesítés, webhook hívása, üzenet a Slackre.
---

Az automatizálás egy **mikor**, egy **ha** és egy **akkor** részből áll: amikor egy feladat „Fait”
állapotba kerül, rögzíti az időpontot; amikor negatív értékelés érkezik, értesíti a felelőst,
és ír a Slackre; minden hétfőn 9 órakor létrehozza a csapatmegbeszélés sorát. Ha pedig egy
művelet nem elég, egy **folyamatot** követ: megkeres egy sort, az alapján, amit a sor tartalmaz,
egyik vagy másik ágon halad tovább, és egy lépésben újra felhasználja, amit egy korábbi lépés
talált vagy írt.

Az **Automatizálások** menüpontból nyithatók meg, az oldalsáv alján, a megnyitott adatbázis
blokkjában, és **Kezelés** szintű jogosultságot igényelnek.

![Egy folyamat és az egyik futtatása, ráhelyezve](../../../../assets/screens/automatisations.png)

## A folyamat

A folyamat fentről lefelé rajzolódik ki: az eseményindító, majd az egyes lépések. Egy vonalon
lévő **+** azon a helyen ad hozzá egy lépést; egy kártya jobb oldalt nyitja meg a beállításait.
Egy egyszerű automatizálás – egy eseményindító és egy művelet – két kártyán elfér, és ugyanúgy
állítható be, mint korábban.

## Mikor

| Eseményindító | Beállítások |
|---|---|
| **Sor létrehozásakor** | a tábla |
| **Sor módosításakor** | a tábla, és szükség esetén csak a figyelendő mezők |
| **Ütemezetten** | óránként, naponta vagy hetente, a választott időpontban és időzónában |
| **Gombra kattintáskor** | a tábla egy [Gomb mezője](/basedb/hu/fonctionnalites/tables-et-champs/#gomb) |

A sorokra vonatkozó eseményindító **minden** írást lát: a felületét, az API-ét, egy ügynökét,
egy megosztott űrlapét, sőt a közvetlen SQL-ét is – az automatizálások az előzményekből
indulnak, amelyek mindegyiket rögzítik.

## Csak akkor, ha

Egy opcionális feltétel a [szűrők nyelvén](/basedb/hu/integrations/api-rest/#olvasás) –
`statut eq "fait"`, `montant gte 10000 and payee eq false` –, amelyet a rendszer a soron **a
művelet pillanatában** értékel ki. Az a futtatás, amelynek feltétele nem teljesül, „kihagyva”
állapotú lesz, és ezt jelzi is.

## Akkor

Legfeljebb harminc lépés, sorrendben; az első sikertelen lépés leállítja a következőket.

| Lépés | Mit csinál |
|---|---|
| **Sor módosítása** | értékeket ír az eseményt kiváltó sorba – vagy abba, amelyet egy lépés talált vagy létrehozott |
| **Sor létrehozása** | ebben a táblában vagy az adatbázis egy másik táblájában |
| **Sor keresése** | egy tábla első olyan sora, amely megfelel egy szűrőnek, hogy a következő lépések hivatkozhassanak rá vagy módosíthassák |
| **Valaki értesítése** | [értesítés](/basedb/hu/fonctionnalites/collaboration/#értesítések) kiválasztott személyeknek, vagy egy Személy mezőben szereplő személynek |
| **Webhook hívása** | HTTPS-en küldött `POST` egy tetszőleges címre; a válaszára ezután hivatkozni lehet |
| **Küldés Slackre** | üzenet egy [csatlakoztatott](/basedb/hu/integrations/synchronisation/#slack) csatornába |
| **MI megkérdezése** | az [MI-szolgáltató](/basedb/hu/fonctionnalites/ia/) válasza egy utasításra, amely a sorra és a korábbi lépésekre hivatkozik – megfogalmazás, összefoglalás, besorolás –, szövegként, számként, igen/nem értékként, dátumként vagy egy lista egyik elemeként értelmezve |
| **Feltétel** | több ág: az első, amelynek feltétele teljesül, kerül sorra, az „Egyébként” ág pedig akkor, ha egyiké sem; az ágak ezután újra összefutnak |

Az eredmény nélküli keresés nem állítja le a folyamatot: azok a lépések, amelyeknek a talált
sort kellett volna módosítaniuk, kimaradnak. Ha ilyenkor valami mást szeretne tenni, egy
feltétel ellenőrzi ezt – az üres szűrőjű ág akkor kerül sorra, ha a keresés talált valamit.

## MI megkérdezése

Az [MI-mezőhöz](/basedb/hu/fonctionnalites/ia/#a-mező-mi-beállítása) hasonlóan a lépés elküldi a
szolgáltatónak az utasítását, amelyben minden hivatkozás helyére az értéke kerül:

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

Kiválasztja a **várt választ** – szabad vagy rövid szöveg, szám, igen vagy nem, dátum,
webcím, vagy egy lista egyik eleme, amelyet egy választás típusú mezőből is átvehet. A modell
erről tájékoztatást kap, és ha a válasz nem tartalmaz ilyet, a lépés sikertelen lesz. A
következő lépések a `{{e1.reponse}}` alakkal hivatkoznak rá: egy létrehozott feladat címében,
egy üzenetben, vagy egy választás típusú mezőben, ahol az azonos címkéjű lehetőséghez kerül.

Amire az utasítás hivatkozik, az a szolgáltatóhoz kerül: a lépés az Ön **hozzájárulását**
kéri, amelyet az utasítás minden módosításakor újra meg kell adni. Minden hívás naplózásra
kerül, és az MI-mezőkkel együtt beleszámít a `BASEDB_AI_FIELD_QUOTA` keretbe (alapértelmezés
szerint óránként 300). Az MI magától nem tesz semmit: az utána következő lépések írnak vagy
értesítenek.

## Hivatkozás

Az értékek, az üzenetek és a szűrők hivatkozhatnak arra, ami előttük történt, az egyes
szövegek melletti **{ }** gombbal:

- `{{Titre}}`, `{{_id}}`: az eseményt kiváltó sor;
- `{{e2.titre}}`, `{{e2._id}}`: az `e2` lépés által talált, létrehozott vagy módosított sor –
  minden lépés kártyáján ott az azonosítója;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: amit az `e3` webhook válaszolt;
- `{{e4.reponse}}`: az `e4` MI-lépés válasza;
- `{{_maintenant}}`: a futtatás időpontja.

Az egyetlen hivatkozásból álló érték magát az értéket adja át: egy kapcsolatot, egy személyt,
egy választást – így kapcsolódik egy létrehozott sor ahhoz, amelyet egy keresés talált. Egy
szűrőben a hivatkozás mindig összehasonlított érték, soha nem a szűrőnyelv része.

Egy lépés csak arra hivatkozhat, ami biztosan megtörtént előtte: amit egy ág talált, arra a
feltétel után már nem lehet hivatkozni. A szerkesztő ezt mentés előtt jelzi a kártyán.

## A Copilot

A fejlécben lévő **Copilot** jobb oldalt természetes nyelvű beszélgetést nyit az adatbázis
automatizálásairól: „ha egy feladat ellenőrzésre kerül, értesítsd a hozzárendelt személyt”,
„adj hozzá MI-összefoglalót a jegyzetekhez”, „miért volt sikertelen az utolsó futtatás?”.
Válaszol, és **javasol** egy teljes automatizálást – a képernyőn lévőt módosítva, vagy egy
újat –, a változások listájával együtt.

A Copilot semmit nem ment: az **Alkalmazás a folyamatra** megmutatja a javaslatot a
szerkesztőben, ahol mentés előtt átnézheti – a kártyán lévő **Mégse** pedig visszaállítja a
folyamatot a korábbi állapotára. Az új automatizálás létrehozásra várva nyílik meg a
szerkesztőben. Minden javaslatot ugyanúgy ellenőriz a rendszer, mint egy mentést; ami nem
állja meg a helyét, azt elveti, és ezt jelzi is.

Alapértelmezés szerint **csak a struktúra** kerül az MI-szolgáltatóhoz a beszélgetéssel
együtt: a táblák és a mezőik, az adatbázis automatizálásai, a képernyőn lévő úgy, ahogy a
szerkesztő mutatja, és a legutóbbi futtatásai – azok állapotai és hibakódjai, soha egyetlen
érték sem. A személyek és a Slack-csatornák jelölőkkel (`p1`, `s1`) kerülnek átadásra, soha
nem az azonosítójukkal. Az **Adatok olvasásának engedélyezése** jelölőnégyzet lehetővé teszi a
Copilot számára, hogy a beszélgetés idejére sorokat olvasson (olvasásonként legfeljebb 50-et),
és minden olvasás a válasza alatt fel van sorolva.

## Tesztelés, követés

A **Tesztelés egy soron** a mentett automatizálást egy kiválasztott soron futtatja, élesben.
A **Futtatások** lap az utolsó 50-et őrzi meg, 30 napig: függőben, folyamatban, sikeres,
kihagyva az okával, sikertelen a kódjával. Ha kiválaszt egyet, a rendszer ráhelyezi a
folyamatra – a bejárt ág ki van rajzolva, minden végrehajtott lépés megmutatja, mit csinált és
mennyi idő alatt, a többi elhalványul.

## Kinek a nevében cselekszik

Az automatizálás **annak a személynek a jogosultságaival** cselekszik, **aki utoljára
mentette**, és ezeket minden futtatáskor újra ellenőrzi a rendszer: ha ez a személy elveszít
egy jogosultságot, az azt igénylő lépés sikertelen lesz ahelyett, hogy átlépne rajta, és egy
keresés csak azt találja meg, amit ő olvashat. Az előzmények így jelenítik meg:
„Automatizálás »Tâche terminée« · … nevében”, és az írásai ugyanúgy visszavonhatók, mint a
többi.

## Korlátok

- Amit egy automatizálás ír, az nem indít el másikat: aminek egymás után kell következnie,
  azt egyetlen folyamatba kell írni.
- A keresés egy sort ad, az elsőt; „minden sorra” és várakozás („három nappal később”)
  egyelőre nincs.
- Nincs e-mail és nincs szkript.
- A feltétel egy sort vizsgál: ha az MI válasza szerint szeretne ágat választani, először írja
  a választ a sor egy mezőjébe.
- Az [adatbázissablon](/basedb/hu/fonctionnalites/modeles/) csak azokat az automatizálásokat
  viszi magával, amelyekben nincs keresés, feltétel vagy MI-lépés.
- Automatizálásonként óránként 100 futtatás; egy kimaradt óránkénti időpontot csak egyszer
  pótol a rendszer.
- Az írás és a művelet közötti késleltetés másodperces nagyságrendű.

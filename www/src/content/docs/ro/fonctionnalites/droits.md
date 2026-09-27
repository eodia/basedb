---
title: Permisiuni și grupuri
description: Conturi, grupuri, niveluri de acces pe proiect, bază și tabel, restricții pe câmp și setările dumneavoastră.
---

Permisiunile se acordă **grupurilor**, niciodată persoanelor una câte una. Un nivel setat pe
un proiect, o bază sau un tabel se aplică la tot ce se află dedesubt, inclusiv la ce va fi
creat mai târziu.

## Cele patru niveluri

| Nivel | Permite |
|---|---|
| **Fără acces** | nimic: resursa este invizibilă |
| **Citire** | vizualizarea rândurilor, comentarea lor, crearea de vizualizări personale, consultarea structurii și a tablourilor de bord, formularea propriilor întrebări, scrierea de SQL doar în citire și salvarea propriilor interogări personale |
| **Editare** | plus crearea, modificarea și ștergerea rândurilor |
| **Gestionare** | plus modificarea structurii, crearea vizualizărilor partajate, a tablourilor de bord și a întrebărilor salvate, partajarea unui tablou de bord printr-un link, partajarea interogărilor, crearea vizualizărilor SQL, a automatizărilor, a integrărilor și a tokenurilor; SQL-ul său are acces la întreaga bază, inclusiv la scrieri |

Permisiunile **se adună**: o persoană primește cel mai înalt nivel pe care i-l dă unul dintre
grupurile sale. A da mai puțin unui tabel decât bazei lui îl face „granular”.

Două grupuri există întotdeauna: **Administratori**, care gestionează totul, și **Toți
utilizatorii**, din care face parte fiecare cont — ce i se acordă acestui grup are toată lumea.

## Până la nivel de câmp

Sub grila nivelurilor, **Câmpuri** ascunde o coloană pentru un grup sau o face nemodificabilă
pentru acesta. Ecranul arată și ce vede de fapt o anumită persoană și prin ce grup.

Un câmp ascuns lipsește peste tot: din grilă, din vizualizări, din API, din MCP, din istoric,
din SQL-ul scris în interfață și din vizualizările SQL. Filtrarea sau sortarea după el răspund
ca pentru un câmp care nu există.

## Și SQL-ul?

În interfață, SQL-ul urmează aceleași permisiuni, aplicate chiar de PostgreSQL: fără nivelul
Gestionare, o interogare se execută doar în citire, pe un rol propriu persoanei, unde un tabel
închis nu există și un câmp ascuns este refuzat. O [vizualizare SQL](/basedb/ro/fonctionnalites/requetes-et-vues-sql/)
se citește cu permisiunile celui care o citește, iar partajarea unei interogări partajează doar
textul ei.

Un acces **`psql` direct** la baza de date, în schimb, nu este guvernat de basedb: citește tot,
inclusiv câmpurile ascunse. Restricțiile protejează suprafețele produsului — interfață, API,
MCP —, niciodată împotriva cuiva care deține un acces SQL la baza de date; aceste accese se
reglementează prin `GRANT`-uri PostgreSQL, setate de operator.

## Conturi și conectare

- Un cont se creează cu o **parolă temporară**, afișată o singură dată și care trebuie
  schimbată la prima conectare.
- Conectarea se face cu parolă sau printr-un furnizor **OpenID Connect** declarat de operator.
- Acțiunile de administrare cer o **sesiune privilegiată**: o parolă reintrodusă în ultimele
  cinci minute.
- Sesiunile se pot revoca; revocarea unei sesiuni invalidează imediat tokenurile ei de acces.

## Setările dumneavoastră

**Setări**, în meniul profilului din stânga jos, vă privește doar pe dumneavoastră:

| Filă | Ce faceți acolo |
|---|---|
| **Profil** | numele afișat; adresa de conectare; furnizorii de identitate legați de cont, de legat sau de dezlegat |
| **Securitate** | schimbarea parolei; sesiunile deschise, de închis una câte una sau pe toate |
| **Aspect** | limba interfeței; tema; ordinea datelor — `25/09/2026` sau `2026-09-25` — și prima zi a săptămânii în calendare |
| **Notificări** | tipurile de notificări pe care nu le mai doriți |
| **Tokenuri** | tokenurile de integrare pe care le-ați creat, în toate bazele dumneavoastră, ultima lor utilizare și revocarea lor |

basedb vorbește **douăzeci de limbi**: franceză, engleză, germană, spaniolă, italiană,
portugheză (Brazilia), neerlandeză, poloneză, cehă, suedeză, daneză, norvegiană, finlandeză,
română, maghiară, turcă, ucraineană, japoneză, chineză simplificată și coreeană. În mod
implicit, interfața preia limba browserului dumneavoastră; **Limbă**, în **Aspect**, fixează
alta. Numerele și datele urmează limba aleasă.

Tema rămâne proprie browserului; limba, ordinea datelor și prima zi a săptămânii vă urmează de
pe un calculator pe altul. Schimbarea adresei sau legarea unui furnizor cer o sesiune
privilegiată; un cont fără parolă, care se conectează printr-un furnizor, păstrează adresa
acelui furnizor.

## Punctul unic de aplicare

Toate suprafețele — interfață, API, MCP, formulare și vizualizări partajate, automatizări —
trec prin același punct de decizie asupra permisiunilor, în nucleu. Nu există nicio rută
privată a interfeței: ce nu afișează ecranul este ce nu a returnat API-ul.

Și invers: ecranul **nu propune ce ar fi refuzat**. Fără nivelul Gestionare, ecranul Structură
se consultă fără butoane și fără creion, iar importul nu propune crearea unui tabel; fără
permisiunea de a crea sau de a șterge rânduri, grila nu oferă nici rândul de adăugare, nici
„Ștergeți”.

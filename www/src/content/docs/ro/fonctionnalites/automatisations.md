---
title: Automatizări
description: Când un rând se schimbă, intră într-un filtru sau dispare, când sosește o dată, la oră fixă, cu un clic sau cu un apel — modificați, creați, căutați, numărați, repetați, ramificați, așteptați, încercați, întrebați AI, generați un PDF, anunțați, trimiteți un e-mail, apelați un serviciu.
---

O automatizare spune **când**, **dacă** și **atunci**: când o sarcină trece la „Fait”, notați
ora; când sosește o recenzie negativă, anunțați responsabila și scrieți pe Slack; în fiecare
luni la ora 9, creați rândul pentru ședința echipei. Iar când o singură acțiune nu este
suficientă, automatizarea urmează un **flux**: caută un rând, ia o ramură sau alta în funcție
de ce conține acesta, repetă pași pe fiecare rând care răspunde unui filtru, reutilizează
într-un pas ce a găsit sau a scris un pas anterior, **așteaptă** trei zile înainte de o
relansare, trimite un **PDF** ca atașament.

Automatizările se deschid din **Automatizări**, în blocul bazei deschise din partea de jos a
barei laterale, și cer nivelul **Gestionare**.

![Un flux și una dintre execuțiile lui, afișată peste el](../../../../assets/screens/ro/automatisations.webp)

## Fluxul

Fluxul se desenează de sus în jos: declanșatorul, apoi fiecare pas. Un **+** pe o linie
deschide lista pașilor, rânduiți pe categorii — Rânduri, Comunicare, Documente, AI,
Logică — cu o căutare, și adaugă în acel loc pe cel ales; un card își deschide setările în
dreapta. O automatizare simplă — un declanșator și o acțiune — încape în două carduri și se
configurează ca înainte.

## Când

| Declanșator | Setări |
|---|---|
| **Un rând este creat** | tabelul |
| **Un rând este modificat** | tabelul și, la nevoie, doar câmpurile de urmărit |
| **La oră fixă** | în fiecare oră, în fiecare zi sau în fiecare săptămână, la ora și în fusul orar alese |
| **Se face clic pe un buton** | un [câmp Buton](/basedb/ro/fonctionnalites/tables-et-champs/#buton) al tabelului |
| **Un rând este șters** | tabelul; pașii citează rândul așa cum era |
| **Un rând intră într-un filtru** | tabelul și filtrul: automatizarea pornește când un rând intră în el, și repornește abia după ce a ieșit din el — „o factură trece în întârziere”, nu „o factură în întârziere este modificată” |
| **O dată ajunge** | un câmp Dată al tabelului, un decalaj — trei zile înainte, chiar în ziua respectivă, o săptămână după — și ora: relansări de scadență, aniversări de contract |
| **Un webhook este primit** | nimic: automatizarea își primește propria adresă, pe care o apelează un alt program ([detalii](#un-serviciu-care-apelează-basedb)) |

Un declanșator pe rânduri vede **toate** scrierile: interfața, API-ul, un agent, un formular
partajat și chiar SQL-ul direct — automatizările pornesc din istoric, care le captează pe
toate.

## Doar dacă

O condiție opțională, în [limbajul filtrelor](/basedb/ro/integrations/api-rest/#citire) —
`statut eq "fait"`, `montant gte 10000 and payee eq false` — evaluată pe rând **în momentul
acțiunii**. O execuție a cărei condiție nu este îndeplinită este „ignorată” și spune acest
lucru.

## Atunci

Până la patruzeci de pași, în ordine; primul care eșuează îi oprește pe următorii — cu excepția
unui bloc **Încercare** ([detalii](#încercare)).

| Pas | Ce face |
|---|---|
| **Editați un rând** | scrie valori în rândul care a declanșat automatizarea — sau în cel pe care un pas l-a găsit ori l-a creat |
| **Creați un rând** | în acest tabel sau în altul din bază |
| **Căutați un rând** | primul rând dintr-un tabel care corespunde unui filtru, pentru ca pașii următori să îl citeze sau să îl modifice |
| **Anunțați pe cineva** | o [notificare](/basedb/ro/fonctionnalites/collaboration/#notificări) către persoane alese sau către persoana dintr-un câmp Persoană |
| **Trimiteți un e-mail** | către persoane din echipă, către cea dintr-un câmp Persoană, la adresa dintr-un câmp E-mail — un client, un furnizor — sau la adrese scrise; subiectul și textul citează rândul și pașii anteriori |
| **Apelați un webhook** | o cerere HTTPS către un serviciu — metodă, adresă, anteturi și corp după cum doriți ([detalii](#apelați-un-serviciu)); răspunsul lui poate fi citat apoi |
| **Trimiteți pe Slack** | un mesaj într-un canal [conectat](/basedb/ro/integrations/synchronisation/#slack) |
| **Întrebați AI** | un răspuns al [furnizorului de AI](/basedb/ro/fonctionnalites/ia/) la o instrucțiune care citează rândul și pașii anteriori — redactare, rezumat, clasificare —, citit ca text, număr, da sau nu, dată sau opțiune dintr-o listă |
| **Condiție** | mai multe ramuri: este luată prima a cărei condiție este îndeplinită, „Altfel” când niciuna nu este; ramurile se reunesc apoi |
| **Pentru fiecare rând** | pașii pe care îi conține, o dată pentru fiecare rând dintr-un tabel care răspunde unui filtru ([detalii](#pentru-fiecare-rând)) |
| **Ștergere rând** | rândul care a declanșat automatizarea, sau cel pe care l-a găsit un pas — este pus la coșul de gunoi |
| **Numărare și adunare** | numărul de rânduri dintr-un filtru, suma lor, media lor, minimul sau maximul lor, de citat sau de testat apoi |
| **Generare PDF** | [documentul](/basedb/ro/fonctionnalites/documents/) unui rând, pus într-un câmp Fișier sau atașat la un e-mail |
| **Așteptare** | o durată, sau până la data unui câmp ([detalii](#așteptare)) |
| **Încercare** | pași, și alții de făcut dacă unul dintre ei eșuează ([detalii](#încercare)) |
| **Lansare automatizare** | o altă automatizare a bazei, pe un rând din tabelul ei |

O căutare care nu găsește nimic nu oprește fluxul: pașii care trebuiau să modifice rândul ei
sunt săriți. Pentru a face altceva în acest caz, **Dacă niciun rând nu este găsit…**, sub
căutare, adaugă o condiție care testează acest lucru.

O **condiție** testează un rând cu un filtru, sau o **valoare**: răspunsul AI, codul unui
webhook, un total — „`{{e2.reponse}}` este egal cu Urgent”, „`{{e3.somme.montant}}` este mai
mare sau egal cu 1000”. Numerele se compară drept numere, textele fără diacritice și fără
majuscule.

## Pentru fiecare rând

Pasul **Pentru fiecare rând** citește rândurile unui tabel care răspund filtrului său — gol:
toate —, în ordinea aleasă, până la limita sa (50 în mod implicit, cel mult 200), apoi execută
o dată pentru fiecare dintre ele pașii așezați în cadrul său. „În fiecare luni, retrimiteți
facturile neplătite” se scrie astfel: **La oră fixă**, apoi **Pentru fiecare rând** din
facturile `payee eq false and relancee eq false`, iar în buclă un e-mail către contactul
facturii și **Modificare rând** care bifează „Relancée”.

În buclă, identificatorul pasului numește **rândul curent**: `{{e1.client}}` îl citează, iar
**Modificare rând** îl propune printre rândurile de modificat. După buclă, `{{e1.nombre}}`
spune câte rânduri a parcurs — pentru un rezumat pe Slack, de exemplu. Filtrul poate cita ce
precede: declanșată de o factură plătită, `facture eq {{_id}}` parcurge rândurile ei de
detaliu.

Dincolo de limită, rândurile rămase așteaptă următoarea execuție, care semnalează acest lucru:
scoateți din filtru rândurile deja tratate — o casetă „relancée”, o dată — pentru a le trata
pe toate de-a lungul execuțiilor. O buclă nu conține altă buclă, iar o execuție se oprește
după două minute.

## Așteptare

Pasul **Așteptare** pune execuția în pauză — trei ore, două zile — sau până la data unui
câmp al unui rând, cu un decalaj și o oră: „în ziua premergătoare scadenței, la ora 9”.
Execuția apare **În pauză** în fila **Execuții**, cu data reluării ei.

Reia la pasul următor **recitind** rândurile sale: „trei zile după trimiterea ofertei, dacă
încă nu este acceptată, relansați” se scrie **Așteptare** 3 zile, apoi o condiție pe statutul
ofertei, așa cum este ea în acea zi. Dezactivarea automatizării oprește execuțiile în pauză; o
așteptare nu se pune nici într-o buclă, nici într-un bloc **Încercare**, și durează cel mult un
an.

## Încercare

Blocul **Încercare** are două ramuri. Prima este executată; dacă unul dintre pașii ei
eșuează, fluxul continuă cu a doua, **În caz de eșec**, care citează eșecul —
`{{e4.erreur}}`, codul, și `{{e4.etape}}`, pasul —, apoi continuă după bloc. Astfel puteți
anunța pe cineva când un serviciu nu răspunde, fără să opriți totul.

Mai simplu: un webhook poate **reîncerca** de la sine de până la trei ori după o cădere a
serviciului, iar o buclă poate **continua** în ciuda unui rând eșuat.

## Un PDF și un e-mail

**Generare PDF** face documentul unui rând — cu un [model de
document](/basedb/ro/fonctionnalites/documents/) al tabelului său, sau fișa cu toate
câmpurile lui — și îl poate pune într-un câmp Fișier. **Trimitere e-mail** îl poate atașa
apoi, împreună cu fișierele dintr-un câmp Fișier sau Imagine:

- un e-mail **fiecăruia**, sau **unul singur, pentru toți**, cu destinatari **în copie**;
- un mesaj în **text formatat** — aldin, liste, linkuri — care citează rândul;
- o adresă de **răspuns**: a dumneavoastră în mod implicit, sau cea dintr-un câmp E-mail;
- cel mult 50 de destinatari, 10 fișiere atașate și 15 Mo.

„Când o ofertă trece la Acceptat, trimiteți factura clientului, cu contabilitatea în copie”:
**Un rând intră într-un filtru** `statut eq "accepte"`, **Generare PDF** cu modelul Factură,
**Trimitere e-mail** la câmpul E-mail al clientului, cu factura atașată.

## Un serviciu care apelează basedb

Cu declanșatorul **Un webhook este primit**, automatizarea are propria sa adresă secretă, de
dat programului care trebuie să o lanseze — un magazin online, un formular extern, un
instrument de automatizare:

```bash
curl -X POST "https://basedb.example.com/api/v1/hooks/<secret>" \
  -H "content-type: application/json" \
  -d '{"client": {"nom": "Dupont"}, "total": 120}'
```

Pașii citează ce a trimis acesta: `{{trigger.client.nom}}`, `{{trigger.total}}`; un formular
se citește la fel, un text prin `{{trigger.texte}}`. Adresa se copiază din setările
declanșatorului; **Schimbați adresa** o înlocuiește, iar cea veche încetează imediat. Un apel
primește `202`, automatizarea pornește în aceeași secundă.

## Apelați un serviciu

Pasul **Apelați un webhook** trimite în mod implicit, prin `POST`, datele automatizării:
rândul ales și ce au găsit sau au scris pașii anteriori. Pentru a vorbi cu un serviciu așa cum
îl așteaptă acesta, se reglează:

- **metoda**: `POST`, `PUT`, `PATCH`, `GET` sau `DELETE` — ultimele două fără corp;
- **adresa**, care poate cita după gazda ei — `https://api.exemple.fr/clients/{{e2.numero}}`;
  fiecare valoare este codificată acolo;
- **anteturi**, a căror valoare poate cita: `Idempotency-Key: {{_id}}`;
- **corpul**: datele automatizării, un **JSON de compus**, un **formular** (o pereche
  `cheie=valoare` pe rând) sau un **text**. Într-un JSON, o citare între ghilimele este text,
  iar în afara ghilimelelor este o valoare — un număr, da sau nu, o listă:

```json
{ "facture": "{{e1.numero}}", "montant": {{e1.montant}}, "payee": {{e1.payee}} }
```

O cheie de API sau un token se pune într-un antet **secret** (lacătul): criptat de cheia
instanței, nu mai este afișat niciodată — nici pe ecran, nici de API, nici de Copilot — și
pleacă doar către gazda pentru care l-ați dat. Schimbarea gazdei adresei cere să îl dați din
nou; **Înlocuiți** introduce unul nou.

## Întrebați AI

La fel ca un [câmp AI](/basedb/ro/fonctionnalites/ia/#opțiunea-ai-a-unui-câmp), pasul îi trimite
furnizorului instrucțiunea sa, în care fiecare citare este înlocuită cu valoarea ei:

```text
Această recenzie de la {{auteur}} necesită o acțiune din partea noastră? {{avis}}
```

Alegeți **răspunsul așteptat** — un text liber sau scurt, un număr, da sau nu, o dată, o
adresă web sau o opțiune dintr-o listă, pe care o puteți prelua dintr-un câmp de selecție.
Modelul este informat, iar un răspuns care nu conține așa ceva face pasul să eșueze. Pașii
următori îl citează prin `{{e1.reponse}}`: în titlul unei sarcini create, într-un mesaj sau
într-un câmp de selecție, unde este plasat la opțiunea cu aceeași etichetă.

Ceea ce citează instrucțiunea pleacă la furnizor: pasul vă cere **acordul**, care trebuie dat
din nou atunci când instrucțiunea se schimbă. Fiecare apel este jurnalizat și se socotește,
împreună cu câmpurile AI, în `BASEDB_AI_FIELD_QUOTA` (300 pe oră în mod implicit). AI-ul nu face
nimic de la sine: pașii plasați după el sunt cei care scriu sau anunță.

## Citare

Valorile, mesajele și filtrele citează ceea ce precedă, din butonul **{ }** de lângă fiecare
text:

- `{{Titre}}`, `{{_id}}`: rândul care a declanșat automatizarea;
- `{{e2.titre}}`, `{{e2._id}}`: rândul găsit, creat sau modificat de pasul `e2` — fiecare pas
  își poartă identificatorul pe card;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: ce a răspuns webhook-ul `e3`;
- `{{e4.reponse}}`: răspunsul pasului AI `e4`;
- `{{e5.client}}` în bucla `e5`, rândul curent; `{{e5.nombre}}` după ea, numărul de rânduri
  parcurse;
- `{{e6.nombre}}`, `{{e6.somme.montant}}`, `{{e6.moyenne.montant}}`, `{{e6.max.echeance}}`: ce
  a numărat pasul `e6`;
- `{{e7.erreur}}`, `{{e7.etape}}`: eșecul recuperat de blocul **Încercare** `e7`;
- `{{e8.nom}}`: numele PDF-ului pasului `e8`;
- `{{trigger.client.nom}}`: ce a trimis un webhook primit;
- `{{_maintenant}}`: momentul execuției.

O valoare formată dintr-o singură citare transmite valoarea însăși: o relație, o persoană, o
opțiune — astfel se leagă un rând creat de cel pe care l-a găsit o căutare. Într-un filtru, o
citare este întotdeauna o valoare comparată, niciodată limbaj de filtrare.

Un pas nu poate cita decât ceea ce s-a petrecut cu siguranță înaintea lui: ce a găsit o ramură
nu mai poate fi citat după condiție. Editorul semnalează acest lucru pe card înainte de
salvare.

## Copilot

**Copilot**, în antet, deschide în dreapta o conversație în limbaj natural despre
automatizările bazei: „când o sarcină trece în revizuire, anunță persoana asignată”, „adaugă
un rezumat făcut de AI în note”, „de ce a eșuat ultima execuție?”. Răspunde și **propune** o
automatizare întreagă — cea pe care o aveți pe ecran, modificată, sau una nouă —, cu lista a
ceea ce se schimbă.

Copilot nu salvează nimic: **Aplicați pe flux** arată propunerea în editor, unde o recitiți
înainte de a salva — iar **Anulați**, pe card, readuce fluxul la cum era. O automatizare nouă
se deschide în editor, gata de creat. Fiecare propunere este verificată așa cum ar fi o
salvare; ce nu este valid este eliminat, și se spune acest lucru.

În mod implicit, **doar structura** pleacă la furnizorul de AI, împreună cu conversația:
tabelele și câmpurile lor, automatizările bazei, cea de pe ecran așa cum o arată editorul și
ultimele ei execuții — stările și codurile lor de eroare, niciodată o valoare. Persoanele și
canalele Slack pleacă sub repere (`p1`, `s1`), niciodată cu identificatorul lor. Caseta
**Permiteți citirea datelor** îi permite lui Copilot, pentru conversația respectivă, să citească
rânduri (cel mult 50 la o citire), fiecare citire fiind listată sub răspunsul său.

## Testare, urmărire

**Testați pe un rând** execută automatizarea salvată pe un rând ales, de-adevăratelea. Fila
**Execuții** le păstrează pe ultimele 50, timp de 30 de zile: în așteptare, în curs, reușită,
ignorată cu motivul ei, eșuată cu codul ei. Alegerea uneia o afișează peste flux — ramura
luată este trasată, fiecare pas parcurs spune ce a făcut și în cât timp, restul este estompat.
Într-o buclă, fiecare pas spune și de câte ori a rulat.

## În numele cui acționează

O automatizare acționează cu **permisiunile persoanei care a salvat-o ultima**, reevaluate la
fiecare execuție: dacă această persoană pierde o permisiune, pasul care avea nevoie de ea
eșuează în loc să treacă peste, iar o căutare găsește doar ce poate citi persoana respectivă.
Istoricul o afișează „Automatizare «Tâche terminée» · în numele lui …”, iar scrierile ei se
anulează ca toate celelalte.

## Limite

- Ce scrie o automatizare nu declanșează nicio altă automatizare: ce trebuie înlănțuit se
  scrie într-un singur flux, sau prin **Lansare automatizare**, cel mult trei niveluri.
- O căutare dă un singur rând, primul; o buclă parcurge cel mult 200 pe execuție. O execuție
  durează cel mult două minute, fără a include așteptările.
- Fără script. Un e-mail este trimis prin [serverul de trimitere](/basedb/ro/hebergement/variables/#e-mailuri)
  al instanței.
- Un [șablon pentru bază](/basedb/ro/fonctionnalites/modeles/) nu preia decât automatizările
  fără căutare, buclă, condiție sau pas AI, și niciodată un webhook.
- Un webhook nu urmează nicio redirecționare și așteaptă cel mult 10 secunde; un răspuns
  altul decât 2xx face pasul să eșueze, după reîncercările lui.
- O dată care ajunge este căutată în fiecare minut; contează doar cele ajunse după salvarea
  automatizării.
- 100 de execuții pe oră pentru fiecare automatizare; o programare orară ratată este recuperată
  o singură dată.
- Întârzierea dintre scriere și acțiune este de ordinul unei secunde.

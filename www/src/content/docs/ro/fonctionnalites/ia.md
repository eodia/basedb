---
title: Inteligență artificială
description: Opțiunea AI a unui câmp, ciornele, Copilot și cel al tablourilor de bord — și ce pleacă la furnizor.
---

AI-ul este **opțional**. Fără un furnizor configurat, nimic nu pleacă nicăieri. basedb știe
să comunice cu **OpenAI**, **Anthropic** și **Mistral**, cu propria dumneavoastră cheie — și cu
orice server care vorbește API-ul OpenAI: **Azure**, o poartă de acces de întreprindere, un
model găzduit de dumneavoastră.

## Configurarea unui furnizor

Cât timp nicio setare nu este salvată în interfață, API-ul își citește mediul:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral sau openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # sau BASEDB_AI_API_KEY
```

Cheia se citește din `BASEDB_AI_API_KEY` sau, în lipsa ei, din numele obișnuit al furnizorului
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, o poartă de acces, un model local

`BASEDB_AI_PROVIDER=openai_compatible` trimite apelurile, în formatul OpenAI, la adresa din
`BASEDB_AI_BASE_URL`: tot ce precedă `/chat/completions`, parametrii incluși.
`BASEDB_AI_HEADERS` adaugă la fiecare apel antetele pe care le cere acel server, sub forma unui
obiect JSON.

```bash
# Azure OpenAI: numele implementării drept model, cheia în antetul api-key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Vechea formă Azure, pe implementare: parametrul rămâne după cale
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Un model servit de Ollama, fără cheie
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Cu `openai_compatible`, cheia este opțională: dacă `BASEDB_AI_API_KEY` este dată, ea pleacă în
`Authorization: Bearer`. Un antet din `BASEDB_AI_HEADERS` îl înlocuiește pe cel al cheii — de
exemplu, pentru o poartă de acces care vrea propriul `Authorization`.

`BASEDB_AI_BASE_URL` și `BASEDB_AI_HEADERS` servesc și celorlalți trei furnizori, atunci când sunt
accesați printr-o poartă de acces: pentru `anthropic`, adresa este tot ce precedă `/messages`.
Aceste două variabile însoțesc furnizorul din mediu, și doar pe el: un spațiu de lucru care a ales
altul nu primește nici adresa, nici antetele, nici cheia. Pornirea API-ului scrie furnizorul
reținut și semnalează o adresă sau un obiect JSON invalide.

O poartă de acces internă al cărei certificat TLS este autosemnat, sau un proxy de întreprindere
care semnează din nou traficul, face apelurile să eșueze: `BASEDB_AI_PROVIDER_SSL_VERIFY=false`
încetează să verifice certificatul **doar al acestui furnizor** — toate celelalte apeluri de
ieșire ale instanței, precum și furnizorul pe care l-ar fi ales un spațiu de lucru, rămân
verificate. Pornirea o semnalează. Cheia trecând prin fiecare apel, rezervați această opțiune unei
rețele pe care o controlați.

## Opțiunea AI a unui câmp

AI-ul nu este un tip de câmp, ci o **opțiune**: comutatorul **AI** din formularul unui câmp —
text, text lung, URL, număr, selecție unică, boolean, dată — îl face să fie completat de un
model, pornind de la o instrucțiune care citează alte coloane:

```text
Rezumă {{Notes}} într-o frază.
Categoria pentru {{Description}} dintre opțiunile listei.
```

- Câmpul este calculat de îndată ce rândul există, apoi de fiecare dată când se schimbă o
  coloană citată — și, dacă doriți, după un program (cel mult o dată la 15 minute).
- Coloana **își păstrează tipul**: un răspuns din care nu se poate citi nimic în acest tip (un
  număr de negăsit, o opțiune care nu există) este refuzat în loc să fie scris.
- Dezactivarea opțiunii face câmpul din nou editabil manual, cu valorile păstrate.
- Valorile citate pleacă la furnizor: **activarea cere un consimțământ explicit**.

`BASEDB_AI_FIELD_QUOTA` limitează aceste calcule pe oră și pe spațiu de lucru (300 în mod
implicit).

## Într-o automatizare

O [automatizare](/basedb/ro/fonctionnalites/automatisations/#întrebați-ai) poate **întreba AI**
într-unul dintre pașii ei: o instrucțiune care citează rândul și pașii anteriori, un răspuns
citit în tipul ales, pe care pașii următori îl scriu, îl trimit sau îl citează. Aceleași reguli
ca pentru un câmp: consimțământ la salvare, pleacă doar ce citează instrucțiunea, fiecare apel
este jurnalizat și socotit în `BASEDB_AI_FIELD_QUOTA`.

## Ciorne și Copilot

- **Ciorne**: descrieți un tabel sau o formulă într-o frază și primiți o propunere de
  verificat. Pleacă doar etichetele, tipurile și fraza introdusă — nicio valoare din celule.
- **Șabloane**: descrieți o bază întreagă — „urmărirea reclamațiilor clienților mei” — și
  primiți tabele, rânduri de exemplu, vizualizări, un tablou de bord și automatizări, de
  rafinat și apoi de creat. Pleacă doar fraza. Consultați
  [Șabloane pentru baze](/basedb/ro/fonctionnalites/modeles/#cereți-l-de-la-ai).
- **Copilot**: o conversație despre baza afișată. Cereți un filtru, o interogare, coloane, un
  tabel, un set de date de test; fiecare propunere sosește ca un card și se aplică cu un clic,
  prin aceleași rute ca formularele.

În mod implicit, doar structura pleacă la furnizor. Caseta **„Permiteți citirea datelor”** îi
permite lui Copilot, pentru conversația respectivă, să citească rânduri (cel mult 50 la o
citire) și să răspundă pe baza lor — fiecare citire este listată sub răspunsul său.

## Copilot pentru tablouri de bord

În secțiunea [Tablouri de bord](/basedb/ro/fonctionnalites/tableaux-de-bord/#copilot),
Copilot propune întrebări, modificări ale tabloului și valori pentru filtrele sale, de aplicat
cu un clic. Aceleași reguli: fără consimțământ, pleacă doar structura — tabelele și câmpurile,
tablourile și întrebările bazei, definiția cardurilor tabloului afișat (întrebările lor,
textele lor) —, niciodată rezultatele sau valorile alese în filtre. Caseta **„Permiteți
citirea datelor”** adaugă aceste valori și rezultatele cardurilor sub filtrele afișate, cel
mult 50 de rânduri la o citire, fiecare citire fiind listată sub răspuns.

## Copilot pentru automatizări

În secțiunea [Automatizări](/basedb/ro/fonctionnalites/automatisations/#copilot), Copilot
propune o automatizare întreagă — cea de pe ecran, modificată, sau una nouă — pe care o
plasează pe fluxul editorului, **fără să o salveze vreodată**: o recitiți, apoi o salvați.
Aceleași reguli: fără consimțământ, pleacă doar structura — tabelele și câmpurile,
automatizările bazei, cea de pe ecran, ultimele ei execuții fără nicio valoare, persoanele și
canalele Slack sub repere —, iar caseta **„Permiteți citirea datelor”** adaugă rânduri citite,
cel mult 50 la o citire.

`BASEDB_AI_QUOTA` limitează apelurile interactive pe oră și pe spațiu de lucru (120 în mod
implicit).

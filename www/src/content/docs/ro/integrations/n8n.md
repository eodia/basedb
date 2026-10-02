---
title: n8n
description: Citiți și scrieți rândurile basedb dintr-un flux de lucru n8n și lansați unul la fiecare rând creat, modificat sau șters.
---

Pachetul **n8n-nodes-basedb** adaugă trei noduri la n8n:

| Nod | Rol |
|---|---|
| **basedb** | citește și scrie rândurile unui tabel, comentează un rând; poate fi folosit ca instrument de un agent AI din n8n |
| **basedb Trigger** | lansează un flux de lucru pentru fiecare rând creat — sau creat sau modificat — de la ultima verificare |
| **basedb Webhook Trigger** | lansează un flux de lucru chiar în momentul în care un rând este creat, modificat sau șters |

## Instalarea

În n8n: **Settings › Community Nodes › Install**, apoi `n8n-nodes-basedb`.

Fără interfață — mod coadă de așteptare, imagine Docker montată în avans — : `npm install
n8n-nodes-basedb` în dosarul `~/.n8n/nodes`, apoi reporniți n8n.

## Datele de conectare

Creați în n8n o dată de conectare **basedb API**:

| Câmp | Valoare |
|---|---|
| **Instance URL** | adresa la care deschideți basedb: `https://basedb.exemple.fr` |
| **Workspace** | referința spațiului de lucru, cea din adresele API-ului (`/api/v1/<spațiu>/…`): `t4z56fq`, cu excepția cazului în care instanța fixează `BASEDB_TENANT` |
| **Token** | un **token de integrare**: meniul **⋯** al bazei → **API și agenți** → **Tokenuri API și MCP…** |

Un token deschide **o singură** bază. Citește rândurile ei, le scrie dacă a fost creat cu drept
de scriere, și nu are niciodată mai multe permisiuni decât persoana care l-a creat. La salvare,
n8n încearcă conexiunea și spune dacă tokenul este refuzat.

## Citire și scriere: nodul basedb

| Operație | Ce face |
|---|---|
| **Row › Create** | adaugă un rând |
| **Row › Create or Update** | modifică rândul ale cărui câmpuri alese au aceste valori, sau îl adaugă dacă niciunul nu le are |
| **Row › Get** | citește un rând după `_id`-ul său |
| **Row › Get Many** | citește rândurile unui filtru, în ordinea cerută, până la o limită sau pe toate, pagină după pagină |
| **Row › Update** | modifică un rând, găsit după `_id`-ul său sau după alte câmpuri |
| **Comment › Create** | comentează un rând; o @mențiune anunță persoana |

**Baza** și **tabelul** se aleg din liste, cele pe care tokenul le deschide. Câmpurile de scris
se afișează cu numele lor din basedb, o selecție unică cu opțiunile ei, un câmp Persoană cu
membrii spațiului; un câmp calculat — formulă, căutare, agregare, număr automat — nu figurează,
întrucât basedb îl scrie el însuși. O valoare pe care câmpul o refuză oprește nodul pe codul
basedb și ce înseamnă el.

- **Filtrul** și **sortarea** folosesc numele tehnice ale câmpurilor, cele din SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Gramatica este cea a
  [API-ului REST](/basedb/ro/integrations/api-rest/#citire).
- **Numerele** ajung ca text decimal (`"1250.50"`), pentru a nu pierde nicio cifră; opțiunea
  **Numbers as Numbers** le transformă în numere.
- O **relație** se citește `{ "id": …, "display": … }` și se scrie prin `_id`-ul rândului legat.
- **Create or Update** nu modifică niciodată mai multe rânduri: dacă mai multe au aceste
  valori, nodul se oprește în loc să ghicească.
- Fără operația **Delete**: pentru a retrage rânduri, marcați-le (un statut „Arhivat”),
  confiați ștergerea unei [automatizări](/basedb/ro/fonctionnalites/automatisations/), sau
  apelați [API-ul REST](/basedb/ro/integrations/api-rest/) cu un token creat pentru ștergere.

## Lansarea unui flux de lucru

### La fiecare verificare: basedb Trigger

Nodul cere de la basedb, în ritmul ales (la fiecare minut, la fiecare oră…), rândurile
**create** — sau **create sau modificate** — de la ultima dată, un filtru în plus dacă este
nevoie. Funcționează oriunde, chiar și atunci când basedb nu poate contacta n8n. La prima sa
verificare, notează în ce stadiu este tabelul și nu emite nimic; o încercare din editor
returnează ultimul rând, pentru a avea de ce lega nodurile următoare.

### Chiar în acel moment: basedb Webhook Trigger

Fiecare rând creat, modificat sau șters — chiar și prin SQL scris direct în PostgreSQL —
lansează imediat fluxul de lucru:

1. Adăugați nodul și copiați **Production URL**-ul său.
2. În basedb, meniul **⋯** al bazei → **API și agenți** → **Webhookuri…**: creați un webhook
   către această adresă, alegeți tabelele și evenimentele lui.
3. basedb afișează o singură dată **secretul de semnătură**: puneți-l într-o dată de conectare
   **basedb Webhook** din n8n.
4. Activați fluxul de lucru.

Fiecare eveniment devine un element: `type`-ul său (`record.created`, `record.updated`,
`record.deleted`), tabelul, rândul **înainte** și **după**, și câmpurile schimbate (`changed`).
Nodul verifică **semnătura** fiecărei livrări și răspunde `401` celei care nu are una, care are
una falsă, sau care este mai veche de cinci minute. basedb livrează **cel puțin o dată**:
eliminați duplicatele după `id`-ul evenimentului dacă fluxul de lucru nu trebuie să îl trateze
de două ori.

:::note
basedb trimite un webhook doar către o adresă **HTTPS publică**: un n8n pe o rețea privată
folosește mai degrabă **basedb Trigger**. Vedeți [Webhook-uri](/basedb/ro/integrations/webhooks/).
:::

## Fără nod

Nodul **HTTP Request** al n8n vorbește și el cu basedb: antet `Authorization: Bearer <jeton>`,
JSON la trimitere și la primire, paginare prin `meta.next_cursor` transmis ca `after`
(`{{ $response.body.meta.next_cursor }}`), și repornire după o pană printr-un filtru pe
`_updated_at` și prin `…/<table>/deleted?since=`.

---
title: SQL direct
description: Citiți și scrieți tabelele basedb cu psql, un instrument de BI sau un script.
---

Aceasta este rațiunea de a fi a basedb: **tabelele dumneavoastră sunt tabele reale**. Orice
client PostgreSQL le citește sub numele lor.

## Numele

| Obiect | Nume fizic | Exemplu |
|---|---|---|
| Bază | o schemă `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Mediu de testare | schema cu sufix | `b_t4z56fq_ventes_recette` |
| Tabel | numele său slugificat | `opportunites` |
| Câmp | numele său slugificat | `echeance` |
| Relație | `<table cible>_id` | `clients_id` |
| [Vizualizare SQL](/basedb/ro/fonctionnalites/requetes-et-vues-sql/) | numele său tehnic, în schema bazei | `factures_a_encaisser` |

Pagina **Documentație API și MCP** a fiecărei baze le indică pe toate, iar `\d` în `psql`
arată descrierile (`COMMENT ON`).

## În interfață

Butonul **+** din bara de file sau meniul **⋯** al bazei → **Interogare SQL**: un editor
cu evidențiere și completare, al cărui rezultat se afișează în aceeași grilă ca tabelele
dumneavoastră.

![O interogare salvată și două vizualizări SQL așezate printre tabele](../../../../assets/screens/requete-sql.png)

- **Fiecare citește acolo cu permisiunile sale**: nivelul Gestionare are acces la întreaga bază,
  inclusiv la scrieri; ceilalți membri scriu SQL doar în citire, unde un tabel închis nu există
  și un câmp ascuns dispare.
- O interogare **se salvează** sub tabele — pentru sine, pentru întreaga bază sau pentru anumite
  grupuri — și devine, dacă doriți, o **vizualizare SQL**: o vizualizare PostgreSQL reală,
  așezată printre tabele și lizibilă din `psql`.

Totul este detaliat în [Interogări și vizualizări SQL](/basedb/ro/fonctionnalites/requetes-et-vues-sql/).

## Din psql

Cu `docker-compose.yml` furnizat, PostgreSQL este publicat pe `127.0.0.1:5432`:

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## Scrierea în SQL

Este permisă. Constrângerile (selecții unice, relații, URL-uri, câmpuri obligatorii) sunt
asigurate de PostgreSQL și refuză o valoare invalidă, ca în interfață. Iar scrierea este
**înregistrată în istoric**: istoricul o afișează ca „Sesiune SQL directă”, cu sesiunea care a
făcut-o, și se anulează ca toate celelalte.

:::caution
Schimbarea **structurii** în SQL (`ALTER TABLE`) ocolește catalogul basedb, care nu ar ști de
ea. Treceți prin interfață, prin API sau printr-o propunere de agent: motorul de migrări
planifică, blochează pentru scurt timp și păstrează catalogul exact.
:::

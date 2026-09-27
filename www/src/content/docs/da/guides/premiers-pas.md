---
title: Kom i gang
description: Opret en database, en tabel, felter, en visning og en formular.
---

Denne gennemgang tager ti minutter og dækker det vigtigste: til sidst har du en tabel, en
kanbanvisning og en offentlig formular, der skriver i den.

:::tip[Se det hele på én gang]
Et tomt projekt tilbyder **demodatabasen**: et lille bureau med dets kunder, projekter,
opgaver, fakturaer og anmeldelser, med formler, visninger af alle slags, et dashboard og
automatiseringer. **Ny database** åbner også [skabelongalleriet](/basedb/da/fonctionnalites/modeles/),
hvor du kan beskrive din database for AI.
:::

## 1. Opret en database

Alt organiseres i **projekter**: vælgeren øverst i sidepanelet skifter projekt eller opretter
et nyt. I panelet opretter **+** til højre for filteret en database. Giv den en etiket
— »Ventes« — og, hvis du vil, en beskrivelse, en farve og et ikon.

Databasen bliver et **PostgreSQL-skema**: dens fysiske navn (`b_t4z56fq_ventes`) vises i
formularen og i den genererede dokumentation.

## 2. Opret en tabel og dens felter

Fra databasens **⋯**-menu: **Ny tabel**. Tilføj derefter dens felter fra
**Struktur** — i samme menu — og knappen
**Felt**:

| Felt | Type |
|---|---|
| Nom | Kort tekst |
| Statut | Enkeltvalg — Nouveau, Qualifié, Gagné, Perdu |
| Montant | Valuta |
| Échéance | Dato |
| Client | Relation → Clients |
| Notes | Lang tekst (Markdown) |

Senere tilføjes en formel (`JOURS([Échéance]; AUJOURDHUI())`), et opslag (kundens by) eller
en aggregering (det samlede beløb pr. kunde) på samme måde — se
[Tabeller og felter](/basedb/da/fonctionnalites/tables-et-champs/).

Du kan også **importere en fil** i CSV eller JSON: importen gætter typerne, lader dig rette
dem, opretter tabellen eller supplerer en eksisterende tabel og fortæller række for række,
hvad den afviser.

![Menuen for en database](../../../../assets/screens/menu-base.png)

## 3. Indtast og filtrer

Gitteret redigeres som et regneark: dobbeltklik eller Enter for at redigere en celle, Esc for
at annullere. **Filtrer** kombinerer betingelser pr. felt; sortering sker fra
kolonneoverskriften; **Søg…** til højre i værktøjslinjen søger i alle kolonner. Hver ændring
gemmes med det samme — og [logges i historikken](/basedb/da/fonctionnalites/historique/):
**Ctrl+Z** fortryder den seneste.

## 4. Tilføj en visning

Visningsvælgeren til venstre for »Filtrer« viser »Alle rækker« og derefter dine visninger.
Opret en **kanban** grupperet efter »Statut«: når du trækker et kort fra én kolonne til en
anden, ændres rækken.

![En kanban efter status](../../../../assets/screens/kanban.png)

## 5. Del en formular

Opret en **Formular**-visning, markér spørgsmålene, og klik på **Del**: vælg »Offentlig«, og
kopiér linket. Hvert svar tilføjer en række til tabellen uden at give den, der svarer, nogen
tilladelser. Detaljer i [Delte formularer](/basedb/da/fonctionnalites/formulaires-partages/).

## 6. Læs i SQL

Databasens **⋯**-menu → **Ny SQL-forespørgsel**: dine tabeller er der under deres rigtige navn.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Gem** placerer den under tabellerne i afsnittet »Forespørgsler« — for dig selv eller for
hele databasen — og **⋯** → **Opret SQL-view…** gør den til et rigtigt PostgreSQL-view, placeret
blandt tabellerne. Alle læser dem med deres egne tilladelser. Se
[Forespørgsler og SQL-views](/basedb/da/fonctionnalites/requetes-et-vues-sql/).

Det er det samme fra `psql` eller dit BI-værktøj. Se [Direkte SQL](/basedb/da/integrations/sql/).

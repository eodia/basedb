---
title: Kom i gang
description: Opprett en database, en tabell, felt, en visning og et skjema.
---

Denne gjennomgangen tar ti minutter og dekker det viktigste: til slutt har du en tabell, en
kanban-visning og et offentlig skjema som skriver til den.

:::tip[Se alt på én gang]
Et tomt prosjekt tilbyr **demodatabasen**: et lite byrå med kunder, prosjekter,
oppgaver, fakturaer og tilbakemeldinger, med formler, visninger av alle slag, et instrumentbord og
automatiseringer. **Ny database** åpner også [malgalleriet](/basedb/nb/fonctionnalites/modeles/),
der du kan beskrive databasen din for KI.
:::

## 1. Opprett en database

Alt er organisert i **prosjekter**: velgeren øverst i sidepanelet bytter prosjekt eller
oppretter et nytt. I panelet oppretter **+** til høyre for filteret en database. Gi den en etikett
– «Ventes» – og, om du vil, en beskrivelse, en farge og et ikon.

Databasen blir et **PostgreSQL-skjema**: det fysiske navnet (`b_t4z56fq_ventes`) vises i
dialogboksen og i den genererte dokumentasjonen.

## 2. Opprett en tabell og feltene

Fra databasens **⋯**-meny: **Ny tabell**. Legg deretter til feltene fra
**Struktur** – i den samme menyen – og knappen
**Felt**:

| Felt | Type |
|---|---|
| Nom | Kort tekst |
| Statut | Enkeltvalg – Nouveau, Qualifié, Gagné, Perdu |
| Montant | Valuta |
| Échéance | Dato |
| Client | Relasjon → Clients |
| Notes | Lang tekst (Markdown) |

Senere legges en formel (`DAYS([Échéance], TODAY())`), et oppslag (kundens by)
eller en aggregering (totalbeløpet per kunde) til på samme måte – se
[Tabeller og felt](/basedb/nb/fonctionnalites/tables-et-champs/).

Du kan også **importere en fil** i CSV eller JSON: importen gjetter typene, lar deg
rette dem, oppretter tabellen eller fyller ut en eksisterende tabell, og forteller rad for rad hva den
avviser.

![Menyen til en database](../../../../assets/screens/menu-base.png)

## 3. Skriv inn og filtrer

Rutenettet redigeres som et regneark: dobbeltklikk eller Enter for å endre en celle, Esc for å
avbryte. **Filtrer** kombinerer betingelser per felt; sorteringen gjøres fra
kolonneoverskriften; **Søk…**, til høyre i verktøylinjen, søker i alle kolonnene. Hver
endring lagres umiddelbart – og [føres i historikken](/basedb/nb/fonctionnalites/historique/):
**Ctrl+Z** angrer den siste.

## 4. Legg til en visning

Visningsvelgeren, til venstre for «Filtrer», tilbyr «Alle rader» og deretter visningene dine.
Opprett en **kanban** gruppert etter «Statut»: når du drar et kort fra én kolonne til en annen, endres
raden.

![En kanban etter status](../../../../assets/screens/kanban.png)

## 5. Del et skjema

Opprett en **Skjema**-visning, kryss av for spørsmålene, og velg så **Del**: velg «Offentlig»,
kopier lenken. Hvert svar legger til en rad i tabellen, uten å gi noen tillatelser til den som
svarer. Detaljer i [Delte skjemaer](/basedb/nb/fonctionnalites/formulaires-partages/).

## 6. Les i SQL

Databasens **⋯**-meny → **SQL-spørring**: tabellene dine er der, under sine ekte navn.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Lagre** plasserer den under tabellene, i delen «Spørringer» – for deg selv, eller for hele
databasen – og **⋯** → **Opprett SQL-visning…** gjør den til en ekte PostgreSQL-visning, plassert blant
tabellene. Alle leser dem med sine egne tillatelser. Se
[Spørringer og SQL-visninger](/basedb/nb/fonctionnalites/requetes-et-vues-sql/).

Det er det samme fra `psql` eller BI-verktøyet ditt. Se [Direkte SQL](/basedb/nb/integrations/sql/).

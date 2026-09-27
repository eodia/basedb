---
title: Historikk
description: All skriving, uansett hvor den kommer fra, med verdiene fra før.
---

basedb fører historikk over **all skriving**, uansett hvor den kommer fra: grensesnittet, API-et, en MCP-agent,
et offentlig skjema – og til og med en SQL-spørring skrevet for hånd i `psql`.

![Historikken til en database](../../../../assets/screens/historique.png)

## Hvordan det fanges opp

Ikke av applikasjonen, men av **PostgreSQL-triggere**, i selve transaksjonen til
skrivingen. En skriving som mislykkes, etterlater ingen spor; en skriving som lykkes, kan ikke
unngå å etterlate ett. Revisjonene overføres deretter til uforanderlige logger, partisjonert per
måned.

Identiteten følger med via øktvariabler som settes i starten av hver transaksjon. En
skriving som ikke har dem – direkte SQL – registreres som nettopp det, med økten som
utførte den (`psql`, adresse, prosess): den blir aldri avvist av den grunn.

| Aktør | Vises som |
|---|---|
| en person | navnet sitt |
| et program (API) eller en agent (MCP) | personen som opprettet tokenet, «via tokenet …» |
| et offentlig skjema | «Skjema ‹…› · offentlig svar» |
| en automatisering | «Automatisering ‹…› · på vegne av» personen som står ansvarlig for den |
| direkte SQL | «Direkte SQL-økt» |

## Hva du kan gjøre med den

- **Lese** historikken til en rad (fanen «Historikk» i raddetaljene), til en tabell eller til en
  database (**Historikk**, i databasens **⋯**-meny), filtrert etter tabell.
- **Angre** en endring: verdiene fra før tas i bruk igjen, felt for felt.
- **Gjenopprette** en slettet rad fra oppføringen «har slettet».
- Følge **strukturhistorikken** (fanen «Struktur»): tabeller og felt som er opprettet,
  endret, slettet.

## Angre (Ctrl+Z)

I rutenettet angrer **Ctrl+Z** (⌘Z på Mac) din siste skriving; **Ctrl+Shift+Z** eller
**Ctrl+Y** gjør den om igjen. En melding bekrefter hva som ble angret – «Angret: endring av
‹Montant›» – med en knapp for å oppheve angringen.

På denne måten kan du angre en celle, et flyttet kort eller en flyttet stolpe, en opprettet eller slettet rad, en
innliming – og en hel import, som regnes som én handling. Opptil femti handlinger, fane for
fane.

Det er ikke en tilbakespoling av skjermen: det er en **ny skriving**, utført av
serveren ut fra historikken, og som også føres i historikken. Den avvises hvis noen har
endret raden siden – «Kan ikke angre: ‹Statut› er endret siden» – i stedet
for å overskrive arbeidet deres. Du kan bare angre dine egne skrivinger, fra de siste
tjuefire timene, og aldri strukturen. I en celle som redigeres, er Ctrl+Z fortsatt
tekstens egen angrefunksjon.

## Tillatelser

Historikken følger lesetillatelsene: et felt som er skjult for deg, vises ikke i
revisjonene du leser.

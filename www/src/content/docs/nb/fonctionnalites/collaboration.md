---
title: Samarbeid
description: Kommentarer og omtaler, varsler, oppdateringer i sanntid og tilstedeværelse.
---

Flere personer jobber i den samme databasen samtidig: hver av dem ser skrivingen til de
andre komme inn, vet hvem som ser på hva, og diskuterer en rad der den befinner seg.

## Kommentarer

Raddetaljene har en fane **Kommentarer**, mellom «Detaljer» og «Historikk». Skriv
`@` for å **omtale** et medlem, Ctrl+Enter for å sende. Alle kan endre eller slette sine
egne kommentarer.

![En samtale om et prosjekt](../../../../assets/screens/commentaires.png)

Å kunne lese raden er nok til å kommentere den. En omtalt person som ikke kan lese den,
blir ikke varslet – og forfatteren får beskjed om det i stedet for å tro at meldingen er sendt.

## Varsler

Bjellen, øverst til høyre, teller det som er ulest. Fire ting havner der:

- noen **omtaler** deg i en kommentar;
- noen **svarer** i en samtale der du har skrevet;
- noen **angir** deg i et Person-felt – fra grensesnittet, API-et, et skjema
  eller en automatisering;
- en [automatisering](/basedb/nb/fonctionnalites/automatisations/) **varsler** deg.

Å åpne et varsel åpner raden. **Merk alle som lest** nullstiller telleren; varslene
tas vare på i 90 dager.

![En mottatt omtale](../../../../assets/screens/notifications.png)

## Sanntid

Skrivingen til de andre vises **uten ny innlasting**: en endret celle, et flyttet
kort, en ny rad – enten den kommer fra grensesnittet, API-et, en agent eller direkte
SQL. Serveren sender bare et **signal**, aldri data: det er skjermen som leser på nytt, med
dine tillatelser. En celle du holder på å redigere, blir aldri erstattet mens du
skriver.

## Tilstedeværelse

Ansiktene til personene som ser på **den samme tabellen**, vises øverst på skjermen; de
som har åpnet **den samme raden**, i toppen av raddetaljene. I rutenettet vises pekeren til de
andre på cellen de holder musen over.

## Angre

Ctrl+Z angrer din siste skriving – se [historikken](/basedb/nb/fonctionnalites/historique/#angre-ctrlz).

## Begrensninger

- Varslene blir i basedb: ingen sendes på e-post foreløpig.
- Når mer enn hundre rader endres på én gang, laster skjermen inn hele siden på nytt i stedet for
  rad for rad.

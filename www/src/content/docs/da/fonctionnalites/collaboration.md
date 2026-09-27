---
title: Samarbejde
description: Kommentarer og omtaler, notifikationer, opdateringer i realtid og tilstedeværelse.
---

Flere personer arbejder i den samme database på samme tid: hver især ser de andres skrivninger
komme ind, ved, hvem der kigger på hvad, og diskuterer en række der, hvor den befinder sig.

## Kommentarer

Rækkedetaljerne for en række har en fane **Kommentarer** mellem »Detaljer« og »Historik«. Skriv
`@` for at **omtale** et medlem, og Ctrl+Enter for at sende. Hver person kan redigere eller
slette sine egne kommentarer.

![En samtale om et projekt](../../../../assets/screens/commentaires.png)

Det er nok at kunne læse rækken for at kommentere den. En omtalt person, der ikke kan læse den,
får ingen besked — og forfatteren får det at vide i stedet for at tro, at beskeden er sendt.

## Notifikationer

Klokken øverst til højre tæller det ulæste. Fire ting havner der:

- nogen **omtaler** dig i en kommentar;
- nogen **svarer** i en samtale, hvor du har skrevet;
- nogen **udpeger** dig i et Person-felt — fra brugerfladen, API'et, en formular eller en
  automatisering;
- en [automatisering](/basedb/da/fonctionnalites/automatisations/) **giver dig besked**.

Når du åbner en notifikation, åbnes rækken. **Markér alle som læst** nulstiller tælleren;
notifikationer gemmes i 90 dage.

![En modtaget omtale](../../../../assets/screens/notifications.png)

## Realtid

De andres skrivninger vises **uden genindlæsning**: en ændret celle, et flyttet kort, en
tilføjet række — uanset om de kommer fra brugerfladen, API'et, en agent eller direkte SQL.
Serveren sender kun et **signal**, aldrig data: det er skærmen, der læser igen, med dine
tilladelser. En celle, du er i gang med at redigere, bliver aldrig erstattet under fingrene
på dig.

## Tilstedeværelse

Ansigterne på de personer, der kigger på **den samme tabel**, vises øverst på skærmen; dem, der
har åbnet **den samme række**, vises i toppen af dens rækkedetaljer. I gitteret vises de andres
markør på den celle, de holder musen over.

## Fortryd

Ctrl+Z fortryder din seneste skrivning — se [historikken](/basedb/da/fonctionnalites/historique/#fortryd-ctrlz).

## Begrænsninger

- Notifikationer bliver i basedb: indtil videre sendes ingen via e-mail.
- Ændres mere end hundrede rækker på én gang, genindlæser skærmen hele siden i stedet for
  række for række.

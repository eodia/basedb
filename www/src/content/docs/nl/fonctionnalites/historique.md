---
title: Geschiedenis
description: Elke schrijfactie, waar ze ook vandaan komt, met de waarden van ervoor.
---

basedb legt **elke schrijfactie** vast in de geschiedenis, waar ze ook vandaan komt: de interface, de API, een MCP-agent,
een openbaar formulier — en zelfs een SQL-query die met de hand in `psql` is geschreven.

![De geschiedenis van een database](../../../../assets/screens/nl/historique.webp)

## Hoe het wordt vastgelegd

Niet door de applicatie, maar door **PostgreSQL-triggers**, in dezelfde transactie als de
schrijfactie. Een schrijfactie die mislukt, laat geen spoor na; een schrijfactie die slaagt, kan er
geen missen. De revisies worden daarna in onveranderlijke logs gezet, gepartitioneerd per
maand.

De identiteit reist mee via sessievariabelen die aan het begin van elke transactie worden gezet. Een
schrijfactie zonder die variabelen — directe SQL — wordt als zodanig vastgelegd, met de sessie die
haar heeft uitgevoerd (`psql`, adres, proces): ze wordt daarom nooit geweigerd.

| Actor | Getoond als |
|---|---|
| een persoon | de naam |
| een programma (API) of een agent (MCP) | de persoon die het token heeft aangemaakt, “via het token …” |
| een openbaar formulier | “Formulier ‘…’ · openbaar antwoord” |
| een automatisering | “Automatisering ‘…’ · namens” de persoon die ervoor verantwoordelijk is |
| directe SQL | “Directe SQL-sessie” |

## Wat je ermee kunt

- **De geschiedenis lezen** van een rij (tabblad “Geschiedenis” van de rijdetails), van een tabel of van een
  database (**Geschiedenis**, in het menu **⋯** van de database), gefilterd per tabel.
- **Een wijziging ongedaan maken**: de vorige waarden worden veld voor veld opnieuw toegepast.
- **Een verwijderde rij herstellen** vanuit de vermelding “heeft verwijderd”.
- De **structuurgeschiedenis** volgen (tabblad “Structuur”): tabellen en velden die zijn aangemaakt,
  gewijzigd, verwijderd.

## Ongedaan maken (Ctrl+Z)

In het raster maakt **Ctrl+Z** (⌘Z op Mac) je laatste schrijfactie ongedaan; **Ctrl+Shift+Z** of
**Ctrl+Y** voert haar opnieuw uit. Een bericht bevestigt wat ongedaan is gemaakt — “Ongedaan gemaakt: wijziging van
‘Montant’” — met een knop om het ongedaan maken terug te draaien.

Zo maak je een cel ongedaan, een verplaatste kaart of balk, een aangemaakte of verwijderde rij, een
plakactie — en een volledige import, die als één handeling telt. Tot vijftig handelingen, per
tabblad.

Het is geen terugspoelen van het scherm: het is een **nieuwe schrijfactie**, uitgevoerd door de
server op basis van de geschiedenis, en die ook zelf in de geschiedenis komt. Ze wordt geweigerd als iemand
de rij sindsdien heeft gewijzigd — “Ongedaan maken niet mogelijk: ‘Statut’ is sindsdien gewijzigd” — in plaats
van diens werk te overschrijven. Je maakt zo alleen je eigen schrijfacties ongedaan, van de afgelopen
vierentwintig uur, en nooit de structuur. In een cel die je aan het invullen bent, blijft Ctrl+Z
die van de tekst.

## Rechten

De geschiedenis volgt de leesrechten: een veld dat voor jou verborgen is, verschijnt niet in de
revisies die je leest.

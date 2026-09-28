---
title: Gedeelde formulieren
description: Een formulier delen via een link, openbaar of alleen voor ingelogde leden.
---

Een formulier of een enquête wordt **via een link gedeeld**: `/f/<jeton>`. Wie
antwoordt, heeft **geen enkel recht op de tabel** nodig: elk antwoord voegt een rij toe, en verder
wordt er niets van de tabel getoond. Om rijen te tonen in plaats van ze te ontvangen, deel je een weergave
[alleen-lezen](/basedb/nl/fonctionnalites/vues-partagees/).

![Het dialoogvenster voor delen](../../../../assets/screens/partage-formulaire.png)

## Wie kan antwoorden

| Toegang | Wie antwoordt | Wat er getoond wordt |
|---|---|---|
| **Openbaar** | iedereen met de link, zonder account | alleen het formulier |
| **Ingelogde leden** | een lid van de werkruimte — desgewenst van bepaalde groepen | het inloggen, daarna het formulier en “Je antwoordt als …” |

De pagina van de link staat buiten de applicatie: geen zijbalk, geen databasenaam, geen andere rijen.
Ze draagt het uiterlijk van het formulier — zijn thema, zijn kleur, zijn lettertype —, en stelt
alleen de vragen die eerdere antwoorden oproepen.

![Een openbaar formulier](../../../../assets/screens/formulaire-public.png)

## Namens wie het antwoord wordt geschreven

De rij wordt geschreven onder het **gezag van de persoon die het delen heeft gepubliceerd** — de laatste die
het heeft opgeslagen. Het recht van die persoon om rijen aan te maken wordt **bij elk antwoord** gecontroleerd, beperkt tot
de vragen van het formulier: verliest die persoon het, dan wordt het formulier opgeschort tot iemand
die het wel heeft, het opnieuw opslaat.

De geschiedenis vermeldt wie heeft geantwoord, niet wie heeft gepubliceerd:

- een antwoord van een **lid** wordt aan die persoon toegeschreven;
- een **openbaar** antwoord wordt aan het formulier zelf toegeschreven: “Formulier ‘Demande de
  devis’ · openbaar antwoord · gepubliceerd door Camille”.

## Openen en sluiten

Het dialoogvenster regelt:

- de schakelaar **Link actief**;
- een **sluitingsdatum**;
- een **maximumaantal antwoorden** — exact, ook bij gelijktijdige antwoorden;
- **Link opnieuw genereren**: de oude werkt meteen niet meer;
- **Delen stoppen**: de link verdwijnt, de antwoorden blijven in de tabel.

Een gesloten formulier meldt dat in één zin, nog voordat er om inloggen wordt gevraagd.

## Beperkingen

- Vragen van het type **relatie**, **bestand** en **afbeelding** worden niet gesteld via een gedeelde
  link; het dialoogvenster geeft ze aan.
- Het verzenden is beperkt tot 20 antwoorden per minuut, per adres en per link. Achter de meegeleverde proxy
  (Caddy) is het adres dat van de bezoeker.

De details staan in [hoofdstuk 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
van het architectuurdocument.

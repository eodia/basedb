---
title: Delte skjemaer
description: Del et skjema med en lenke, offentlig eller forbeholdt innloggede medlemmer.
---

Et skjema eller en spørreundersøkelse **deles med en lenke** `/f/<jeton>`. Den som
svarer, trenger **ingen tillatelser til tabellen**: hvert svar legger til en rad, og ingenting
annet fra tabellen vises for vedkommende. For å vise rader i stedet for å motta dem, kan en visning
deles [skrivebeskyttet](/basedb/nb/fonctionnalites/vues-partagees/).

![Delingsdialogen](../../../../assets/screens/partage-formulaire.png)

## Hvem som kan svare

| Tilgang | Hvem som svarer | Hva som vises |
|---|---|---|
| **Offentlig** | alle som har lenken, uten konto | skjemaet alene |
| **Innloggede medlemmer** | et medlem av arbeidsområdet – ved behov fra bestemte grupper | innloggingen, deretter skjemaet og «Du svarer som …» |

Lenkesiden ligger utenfor applikasjonen: ingen sidepanel, intet databasenavn, ingen andre rader.

![Et offentlig skjema](../../../../assets/screens/formulaire-public.png)

## Hvem svaret skrives på vegne av

Raden skrives med **myndigheten til personen som publiserte delingen** – den siste som
lagret den. Vedkommendes rett til å opprette rader kontrolleres **ved hvert svar**, begrenset til
spørsmålene i skjemaet: mister personen den, stanses skjemaet til noen
som har den, lagrer det på nytt.

Historikken viser hvem som svarte, ikke hvem som publiserte:

- et svar fra et **medlem** tilskrives personen;
- et **offentlig** svar tilskrives skjemaet selv: «Skjema ‹Demande de
  devis› · offentlig svar · publisert av Camille».

## Åpne og stenge

Dialogen styrer:

- bryteren **Aktiv lenke**;
- en **stengedato**;
- et **maksimalt antall svar** – nøyaktig, selv ved samtidige svar;
- **Generer lenken på nytt**: den gamle slutter å virke umiddelbart;
- **Slutt å dele**: lenken forsvinner, svarene blir liggende i tabellen.

Et stengt skjema sier det med én setning, før det i det hele tatt ber om innlogging.

## Begrensninger

- Spørsmål av typen **relasjon**, **fil** og **bilde** stilles ikke via en delt
  lenke; dialogen gjør oppmerksom på dem.
- Innsending er begrenset til 20 svar per minutt, per adresse og per lenke. Bak den medfølgende
  proxyen (Caddy) er adressen den besøkendes.

Detaljene står i [kapittel 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
i arkitekturdokumentet.

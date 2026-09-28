---
title: Delte formularer
description: Del en formular via et link, offentligt eller forbeholdt indloggede medlemmer.
---

En formular eller et spørgeskema **deles via et link** `/f/<jeton>`. Den person, der svarer,
behøver **ingen tilladelser til tabellen**: hvert svar tilføjer en række, og intet andet fra
tabellen vises for personen. Vil du vise rækker i stedet for at modtage dem, kan en visning
deles [skrivebeskyttet](/basedb/da/fonctionnalites/vues-partagees/).

![Delingsdialogen](../../../../assets/screens/partage-formulaire.png)

## Hvem kan svare

| Adgang | Hvem svarer | Hvad der vises |
|---|---|---|
| **Offentlig** | alle med linket, uden konto | formularen alene |
| **Indloggede medlemmer** | et medlem af arbejdsområdet — om nødvendigt fra bestemte grupper | login, derefter formularen og »Du svarer som …« |

Linkets side ligger uden for applikationen: intet sidepanel, intet databasenavn, ingen andre
rækker. Den bærer formularens udseende — dens tema, farve, skrifttype —, og stiller kun de
spørgsmål, som tidligere svar kalder på.

![En offentlig formular](../../../../assets/screens/formulaire-public.png)

## På hvis vegne svaret skrives

Rækken skrives med **myndigheden fra den person, der har udgivet delingen** — den seneste, der
har gemt den. Personens ret til at oprette rækker kontrolleres **ved hvert svar**, begrænset til
formularens spørgsmål: mister personen den, sættes formularen på pause, indtil en anden, der har
retten, gemmer den igen.

Historikken fortæller, hvem der har svaret, ikke hvem der har udgivet:

- et svar fra et **medlem** tilskrives personen;
- et **offentligt** svar tilskrives selve formularen: »Formular ›Demande de devis‹ · offentligt
  svar · udgivet af Camille«.

## Åbn og luk

Dialogen indstiller:

- kontakten **Link aktivt**;
- en **lukkedato**;
- et **maksimalt antal svar** — præcist, også ved samtidige svar;
- **Generér nyt link**: det gamle holder straks op med at virke;
- **Stop deling**: linket forsvinder, svarene bliver i tabellen.

En lukket formular siger det i én sætning, allerede før den beder om login.

## Begrænsninger

- Spørgsmål af typen **relation**, **fil** og **billede** stilles ikke via et delt link;
  dialogen gør opmærksom på dem.
- Indsendelse er begrænset til 20 svar i minuttet pr. adresse og pr. link. Bag den medfølgende
  proxy (Caddy) er adressen den besøgendes.

Detaljerne står i [kapitel 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
i arkitekturdokumentet.

---
title: Delade formulär
description: Dela ett formulär via en länk, offentligt eller bara för inloggade medlemmar.
---

Ett formulär eller en enkät **delas via en länk** `/f/<jeton>`. Den som svarar behöver **inga
behörigheter i tabellen**: varje svar lägger till en rad, och inget annat i tabellen visas för
hen. Vill du visa rader i stället för att ta emot dem kan en vy delas
[skrivskyddad](/basedb/sv/fonctionnalites/vues-partagees/).

![Delningsdialogen](../../../../assets/screens/partage-formulaire.png)

## Vem kan svara

| Åtkomst | Vem svarar | Vad som visas |
|---|---|---|
| **Offentlig** | alla som har länken, utan konto | formuläret, ingenting annat |
| **Inloggade medlemmar** | en medlem i arbetsytan – vid behov bara i vissa grupper | inloggningen, sedan formuläret och ”Du svarar som …” |

Länkens sida ligger utanför programmet: inget sidofält, inget databasnamn, inga andra rader.

![Ett offentligt formulär](../../../../assets/screens/formulaire-public.png)

## I vems namn svaret skrivs

Raden skrivs med **behörigheten hos den som publicerade delningen** – den som senast sparade
den. Hens rätt att skapa rader kontrolleras **vid varje svar**, begränsat till formulärets
frågor: förlorar hen den rätten pausas formuläret tills någon som har den sparar det igen.

Historiken visar vem som svarade, inte vem som publicerade:

- ett svar från en **medlem** tillskrivs personen;
- ett **offentligt** svar tillskrivs själva formuläret: ”Formulär ’Demande de devis’ ·
  offentligt svar · publicerat av Camille”.

## Öppna och stänga

I dialogen ställer du in:

- reglaget **Aktiv länk**;
- ett **stängningsdatum**;
- ett **högsta antal svar** – exakt, även när svar kommer in samtidigt;
- **Generera ny länk**: den gamla slutar genast att fungera;
- **Sluta dela**: länken försvinner, svaren finns kvar i tabellen.

Ett stängt formulär säger det med en mening, redan innan någon inloggning begärs.

## Begränsningar

- Frågor av typen **relation**, **fil** och **bild** ställs inte via en delad länk; dialogen
  påpekar dem.
- Inskickningen är begränsad till 20 svar per minut, per adress och per länk. Bakom den
  medföljande proxyn (Caddy) är adressen besökarens.

Detaljerna finns i [kapitel 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
i arkitekturdokumentet.

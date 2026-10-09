---
title: Tekoäly
description: Kentän tekoälyasetus, luonnokset, Copilot ja koontinäyttöjen Copilot – ja mitä palveluntarjoajalle lähtee.
---

Tekoäly on **valinnainen**. Ilman määritettyä palveluntarjoajaa mitään ei lähde minnekään.
basedb osaa keskustella **OpenAI**:n, **Anthropicin** ja **Mistralin** kanssa omalla avaimellasi
– sekä minkä tahansa OpenAI:n API:a puhuvan palvelimen kanssa: **Azure**, yrityksen yhdyskäytävä,
omalla palvelimellasi ajettava malli.

## Palveluntarjoajan määrittäminen

Niin kauan kuin käyttöliittymään ei ole tallennettu asetuksia, API lukee ympäristönsä:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral tai openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # tai BASEDB_AI_API_KEY
```

Avain luetaan muuttujasta `BASEDB_AI_API_KEY` tai sen puuttuessa palveluntarjoajan tavallisesta
muuttujasta (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, yhdyskäytävä, paikallinen malli

`BASEDB_AI_PROVIDER=openai_compatible` lähettää kutsut OpenAI:n muodossa muuttujan
`BASEDB_AI_BASE_URL` osoitteeseen: osoite on se, mikä edeltää polkua `/chat/completions`,
parametrit mukaan lukien. Muuttuja `BASEDB_AI_HEADERS` lisää jokaiseen kutsuun ne otsakkeet,
joita palvelin vaatii, JSON-objektina.

```bash
# Azure OpenAI: käyttöönoton nimi mallina, avain otsakkeessa api-key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Azuren vanhempi muoto, käyttöönottokohtainen: parametri jää polun perään
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Ollamalla ajettava malli, ilman avainta
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Arvolla `openai_compatible` avain on valinnainen: jos `BASEDB_AI_API_KEY` on annettu, se lähtee
`Authorization: Bearer` -otsakkeessa. Muuttujan `BASEDB_AI_HEADERS` otsake korvaa avaimen
otsakkeen – esimerkiksi yhdyskäytävä, joka haluaa oman `Authorization`-otsakkeensa.

Muuttujat `BASEDB_AI_BASE_URL` ja `BASEDB_AI_HEADERS` palvelevat myös kolmea muuta
palveluntarjoajaa, kun niihin otetaan yhteys yhdyskäytävän kautta: palveluntarjoajalla
`anthropic` osoite on se, mikä edeltää polkua `/messages`. Nämä kaksi muuttujaa kuuluvat
ympäristön palveluntarjoajalle, ja vain sille: työtila, joka on valinnut toisen, ei saa
osoitetta, otsakkeita eikä avainta. API:n käynnistys kirjaa valitun palveluntarjoajan ja
ilmoittaa virheellisestä osoitteesta tai JSON-objektista.

Sisäinen yhdyskäytävä, jonka TLS-varmenne on itse allekirjoitettu, tai yrityksen
välityspalvelin, joka allekirjoittaa liikenteen uudelleen, saa kutsut epäonnistumaan:
`BASEDB_AI_PROVIDER_SSL_VERIFY=false` lopettaa varmenteen tarkistamisen **vain tämän
palveluntarjoajan osalta** – kaikki instanssin muut lähtevät kutsut ja palveluntarjoaja, jonka
työtila on voinut valita, tarkistetaan edelleen. Käynnistys ilmoittaa asiasta. Koska avain
kulkee jokaisessa kutsussa, rajaa asetus verkkoon, jota hallitset itse.

## Kentän tekoälyasetus

Tekoäly ei ole kenttätyyppi vaan **asetus**: kentän lomakkeen **Tekoäly**-kytkin – teksti,
pitkä teksti, URL, luku, yksi valinta, totuusarvo, päivämäärä – antaa mallin täyttää kentän
kehotteen perusteella, joka viittaa muihin sarakkeisiin:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Kenttä lasketaan heti, kun rivi on olemassa, ja sitten aina, kun viitattu sarake muuttuu –
  ja halutessa aikataulun mukaan (enintään 15 minuutin välein).
- Sarake **säilyttää tyyppinsä**: vastaus, josta ei voi lukea mitään tämän tyyppistä (lukua ei
  löydy, valintaa ei ole olemassa), hylätään sen sijaan, että se kirjoitettaisiin.
- Asetuksen poistaminen käytöstä tekee kentästä jälleen käsin muokattavan, ja arvot säilyvät.
- Viitatut arvot lähtevät palveluntarjoajalle: **käyttöönotto vaatii nimenomaisen
  suostumuksen**.

`BASEDB_AI_FIELD_QUOTA` rajoittaa näitä laskentoja tuntia ja työtilaa kohden (oletuksena 300).

## Automaatiossa

[Automaatio](/basedb/fi/fonctionnalites/automatisations/#kysy-tekoälyltä) voi **kysyä
tekoälyltä** yhdessä vaiheistaan: kehote, joka viittaa riviin ja aiempiin vaiheisiin, ja vastaus
luettuna valitussa tyypissä, jonka seuraavat vaiheet kirjoittavat, lähettävät tai johon ne
viittaavat. Samat säännöt kuin kentällä: suostumus tallennettaessa, vain kehotteen viittaama
lähtee, ja jokainen kutsu kirjataan lokiin ja lasketaan kiintiöön `BASEDB_AI_FIELD_QUOTA`.

## Luonnokset ja Copilot

- **Luonnokset**: kuvaile taulukko tai kaava yhdellä lauseella ja saat tarkistettavan
  ehdotuksen. Vain nimikkeet, tyypit ja kirjoitettu lause lähtevät – ei yhtään solun arvoa.
- **Mallit**: kuvaile kokonainen tietokanta – ”asiakkaideni reklamaatioiden seuranta” – ja saat
  taulukot, esimerkkirivit, näkymät, koontinäytön ja automaatiot hiottaviksi ja luotaviksi. Vain
  lause lähtee. Katso [Tietokantamallit](/basedb/fi/fonctionnalites/modeles/#pyydä-tekoälyltä).
- **Copilot**: keskustelu näytetystä tietokannasta. Siltä voi pyytää suodattimen, kyselyn,
  sarakkeita, taulukon tai testiaineiston; jokainen ehdotus saapuu korttina ja otetaan käyttöön
  yhdellä napsautuksella samoja reittejä kuin lomakkeet.

Oletuksena palveluntarjoajalle lähtee vain rakenne. **”Salli tietojen lukeminen”** -valinta
antaa Copilotin lukea rivejä keskustelun ajan (enintään 50 lukukertaa kohden) ja vastata niiden
perusteella – jokainen lukukerta luetellaan sen vastauksen alla.

## Koontinäyttöjen Copilot

[Koontinäytöt](/basedb/fi/fonctionnalites/tableaux-de-bord/#copilot)-osiossa Copilot ehdottaa
kysymyksiä, koontinäytön muutoksia ja arvoja sen suodattimille yhdellä napsautuksella
käyttöön otettaviksi. Samat säännöt: ilman suostumusta lähtee vain rakenne – taulukot ja
kentät, tietokannan koontinäytöt ja kysymykset, näytetyn koontinäytön korttien määritelmät
(niiden kysymykset, niiden tekstit) –, ei koskaan tuloksia eikä suodattimiin valittuja arvoja.
**”Salli tietojen lukeminen”** -valinta lisää nämä arvot ja korttien tulokset näytetyillä
suodattimilla, enintään 50 riviä lukukertaa kohden, ja jokainen luetellaan vastauksen alla.

## Automaatioiden Copilot

[Automaatiot](/basedb/fi/fonctionnalites/automatisations/#copilot)-osiossa Copilot ehdottaa
kokonaista automaatiota – näytöllä olevaa muokattuna tai uutta –, jonka se asettaa editorin
työnkulkuun **tallentamatta sitä koskaan**: luet sen läpi ja tallennat sen sitten. Samat säännöt:
ilman suostumusta lähtee vain rakenne – taulukot ja kentät, tietokannan automaatiot, näytöllä
oleva automaatio, sen viimeisimmät suoritukset ilman yhtään arvoa, henkilöt ja Slack-kanavat
merkintöinä –, ja **”Salli tietojen lukeminen”** -valinta lisää luettuja rivejä, enintään 50
lukukertaa kohden.

`BASEDB_AI_QUOTA` rajoittaa vuorovaikutteisia kutsuja tuntia ja työtilaa kohden (oletuksena 120).

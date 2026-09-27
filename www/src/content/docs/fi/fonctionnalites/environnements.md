---
title: Ympäristöt
description: Tuotanto, testi, kehitys – vertaa, siirrä, synkronoi.
---

Tietokannalla voi olla **ympäristöjä**: tuotanto, testi, kehitys… Kukin niistä on täysimittainen
tietokanta – oma skeemansa, taulukkonsa, rivinsä ja käyttöoikeutensa – ja kaikilla on tietokannan,
sen taulukoiden ja sen kenttien **yhteinen alkuperä**.

## Käyttöliittymässä

Sivupalkki näyttää **yhden rivin tietokantaa kohden** ja merkin, joka kertoo avoimen ympäristön
ja jolla ympäristöä voi vaihtaa. Merkkiä ei näytetä niin kauan kuin on vain tuotanto.

Ympäristöjä lisätään, nimetään uudelleen ja poistetaan kohdassa **Muokkaa tietokantaa…**: uusi
ympäristö syntyy toisen ympäristön **rakenteen kopiosta** ilman sen rivejä.

## Ympäristöjen vertailu

Tietokannan valikosta kohdasta **Muut toiminnot** **Vertaa ympäristöjä…** avaa valintaikkunan:

- **Rakenne**: ympäristöt sarakkeina, taulukot ja kentät riveinä; tuotannosta poikkeava on
  korostettu.
- **Käytä migraatioita…** valmistelee suunnitelman siirtymiseksi ympäristöstä toiseen vaihe
  vaiheelta. Se ei koskaan valitse oletuksena sellaista, mikä kumoaisi kohteen uudemman muutoksen.
- **Rivien synkronointi**: taulukko kerrallaan rivien siirtäminen ympäristöstä toiseen tunnisteen
  perusteella.

![Tuotannon ja testin vertailu](../../../../assets/screens/environnements.png)

## Miten basedb tietää, kuka muutti mitä

Vertailu perustuu **rakenteen historiaan**: jokaisen taulukon tai kentän luominen, muokkaaminen
tai poistaminen tallennetaan katalogin liipaisimella, ja sen voi lukea historian
”Rakenne”-välilehdeltä. Alkuperätunnisteet yhdistävät testiympäristön kentän sen
tuotantovastineeseen, vaikka se olisi nimetty uudelleen.

## SQL:ssä

Jokainen ympäristö on skeema: `b_t4z56fq_ventes` tuotannolle, `b_t4z56fq_ventes_recette`
testille. Kyselysi vaihtavat ympäristöä vaihtamalla skeemaa – tai `search_path`-asetusta.

---
title: Tilit ja kirjautuminen
description: Kuka voi luoda tilin, ja kirjautuminen Googlella, Microsoftilla tai yrityksen kertakirjautumisella.
---

## Ensimmäinen kirjautuminen

Uudessa instanssissa ensimmäinen sivu luo **ylläpitäjän tilin**: nimesi, osoitteesi ja
valitsemasi salasana. Luo se ennen kuin instanssi on muiden saavutettavissa – verkkotunnuksessa
tai kaikkiin verkkoliitäntöihin julkaistun portin kautta.

## Tilien luominen

Oletuksena kuka tahansa, joka tavoittaa instanssin, voi **luoda tilinsä** ja sitten omia
projektejaan. Hän ei näe mitään muuta: muiden projektit tulevat hänelle **kutsun** kautta.

Kohdassa **Ylläpito → Käyttäjät** ”Tilien luominen” -kortti:

- sulkee tilien luomisen: silloin vain kutsutut henkilöt voivat luoda tilin;
- tai rajaa sen tiettyihin verkkotunnuksiin – `exemple.fr, autre.fr` hyväksyy vain nämä
  osoitteet.

## Kutsuminen projektiin tai tietokantaan

Henkilö, jolla on projektiin tai tietokantaan **Hallintaoikeus**-taso, jakaa sen: projektin (tai
tietokannan) valikko → **Jaa…**, osoite ja taso – Lukuoikeus, Muokkausoikeus tai
Hallintaoikeus. basedb luo 7 päivää voimassa olevan **kutsulinkin**, jonka lähetät henkilölle
haluamallasi tavalla: hän kirjautuu sisään tai luo tilinsä avaamalla sen. Sama näkymä näyttää,
kenellä on pääsy, muuttaa tai poistaa tason ja säilyttää odottavat linkit uudelleenlähettämistä
varten.

Hallinnoija ei koskaan anna enempää kuin hallinnoi: tietokannan hallinnoija jakaa tietokannan,
ei sen projektia.

## Kirjautuminen Googlella, Microsoftilla…

basedb puhuu **OpenID Connectia**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Jokainen määritetty palveluntarjoaja lisää ”Jatka palvelulla …” -painikkeen
kirjautumis-, tilinluonti- ja kutsunäkymiin.

1. Määritä basedb:n julkinen osoite `.env`-tiedostossa:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Luo palveluntarjoajan puolella verkkosovellus; sen **paluuosoite** on
   `https://basedb.example.com/auth/oidc/<nom>/callback`, jossa `<nom>` on nimi, jonka annat
   sille alla (`google`, `microsoft`…).

3. Määritä se `.env`-tiedostossa:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: käynnistyksessä basedb luettelee hyväksytyt palveluntarjoajat ja
   kertoo, mitä sivuun jätetyiltä puuttuu.

| Muuttuja palveluntarjoajalle `<NOM>` | Tehtävä |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | palveluntarjoajalle rekisteröity sovellus |
| `BASEDB_OIDC_<NOM>_ISSUER` | myöntäjä; tarpeeton `google`- ja `gitlab`-palveluntarjoajille |
| `BASEDB_OIDC_<NOM>_LABEL` | painikkeen nimi – oletuksena `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | oletuksena `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: hyväksyy vain olemassa olevat tilit |

**Ensimmäinen kirjautuminen luo tilin** sen mukaan, mitä tilien luominen sallii: avoimena se
hyväksyy tilin; verkkotunnuksiin rajattuna vain niiden osoitteet. Osoitetta, joka on jo
salasanatilin käytössä, ei koskaan oteta haltuun: sen haltija kirjautuu salasanallaan.
Salaisuudet pysyvät ympäristössä: niistä ei kirjoiteta mitään tietokantaan.

:::note
GitHub ei ole OpenID Connect -palveluntarjoaja: sitä ei voi käyttää tässä.
:::

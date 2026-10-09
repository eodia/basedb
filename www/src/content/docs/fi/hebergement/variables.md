---
title: Ympäristömuuttujat
description: Kaikki basedb:n lukemat muuttujat ja niiden oletusarvot.
---

Kaikki asetetaan `.env`-tiedostoon `docker-compose.yml`-tiedoston viereen, ja `docker compose`
lukee sen (täydellinen, kommentoitu malli on `.env.example`). Kun käytät `docker run` -komentoa,
välitä ne `-e`-valitsimella. **Tyhjä arvo tarkoittaa ”ei määritetty”.**

## Pakolliset

| Muuttuja | Tehtävä |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL-kontin salasana |
| `BASEDB_ENCRYPTION_KEY` | instanssin avain: allekirjoittaa istunnot, salaa salaisuudet. `openssl rand -base64 32`, kerran ja lopullisesti |

## Tietokanta

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-rooli |
| `POSTGRES_DB` | `basedb` | PostgreSQL-tietokanta |
| `POSTGRES_PORT` | `5432` | osoitteeseen 127.0.0.1 julkaistu portti |
| `DATABASE_URL` | `db`-kontti | oma PostgreSQL 16+ -tietokantasi |

## Ensimmäinen käynnistys

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | soveltaa katalogin tyhjään tietokantaan |
| `BASEDB_BOOTSTRAP` | `1` | valmistelee ensimmäisen ylläpitäjän |
| `BASEDB_TENANT` | `t4z56fq` | työtilan tunniste API:n URL-osoitteissa |
| `BASEDB_ADMIN_EMAIL` | – | käynnistyksessä luotavan ensimmäisen ylläpitäjän osoite; tyhjänä ensimmäinen käyttöliittymän avaaja luo ylläpitäjän |
| `BASEDB_ADMIN_PASSWORD` | luodaan, näytetään kerran | `BASEDB_ADMIN_EMAIL`-muuttujan kanssa ylläpitäjän salasana; määritettynä se asetetaan ylläpitäjälle uudelleen **jokaisessa** käynnistyksessä: poista se kirjauduttuasi |

## Kirjautuminen Googlella, Microsoftilla… (OIDC)

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | tarjottavat palveluntarjoajat pilkuilla erotettuina: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | palveluntarjoajalle rekisteröity sovellus |
| `BASEDB_OIDC_<NOM>_ISSUER` | `google`:n ja `gitlab`:n oma | OpenID Connect -myöntäjä |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | palveluntarjoajan mukaan | painikkeen nimi, pyydetyt laajuudet |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: ensimmäinen kirjautuminen ei luo tiliä |

Katso [Tilit ja kirjautuminen](/basedb/fi/hebergement/connexion/).

## Osoitteet

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_PORT` | `3000` | osoitteeseen 127.0.0.1 julkaistu portti: käyttöliittymä, `/api` ja `/mcp` |
| `BASEDB_VERSION` | `latest` | `eodia/basedb`-kuvan tunniste |
| `BASEDB_PUBLIC_URL` | – | basedb:n julkinen osoite OIDC-paluuta varten |
| `BASEDB_BASE_PATH` | `BASEDB_PUBLIC_URL`:n polku | polku, jonka alla basedb tarjoillaan yhdyskäytävän takana, `/basedb` osoitteelle `https://passerelle.example.com/basedb/`; katso [Docker Compose](/basedb/fi/hebergement/docker/#yhdyskäytävän-takana-polun-alla) |
| `BASEDB_DOMAIN` | – | verkkotunnus, jota Caddy-välityspalvelin tarjoilee HTTPS:llä |
| `BASEDB_ORIGINS` | – | muut sivustot, joiden sivut kutsuvat API:a selaimesta, pilkuilla erotettuina; tarpeeton basedb:n käyttöliittymälle, joka tarjoillaan samasta osoitteesta |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API ja MCP selaimesta katsottuna; aseta vain kehitysympäristöä varten (`pnpm start`) |

## Tiedostot

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | tiedoston enimmäiskoko |
| `BASEDB_S3_BUCKET` | – | ottaa S3-tallennuksen käyttöön |
| `BASEDB_S3_ENDPOINT` | – | S3-päätepiste |
| `BASEDB_S3_REGION` | `us-east-1` | alue |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | tunnistetiedot |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` isäntänimeen perustuvaa osoitteistusta varten |

## Sähköpostit

Ilman lähetyspalvelinta basedb ei lähetä yhtään sähköpostia. Sen kautta lähtevät kymmenen
minuuttia lukematta olleet ilmoitukset (kukin valitsee mitkä kohdassa **Asetukset ›
Ilmoitukset**), automaatioiden **Lähetä sähköposti** -vaiheen sähköpostit ja **unohtuneen
salasanan** linkki. Linkit osoittavat `BASEDB_PUBLIC_URL`-osoitteeseen; ilman sitä sähköposti
ei sisällä linkkiä.

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_SMTP_HOST` | – | SMTP-palvelin: sähköpostipalvelusi tai lähetyspalvelun |
| `BASEDB_SMTP_PORT` | `587` | `465` suoraan salatulle yhteydelle |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` portissa 465) | `none` vain samalla koneella olevalle välitykselle: muuten salasana kulkisi selkokielisenä |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | – | lähettävän tilin tunnus, jos se vaatii sellaisen |
| `BASEDB_MAIL_FROM` | – | pakollinen `BASEDB_SMTP_HOST`-muuttujan kanssa: lähettäjä, `basedb <no-reply@exemple.fr>` |

Käynnistyksessä loki kertoo tilanteen: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Sähköposti, jonka palvelin hylkää, yritetään uudelleen 1, 5, 30,
120 ja sitten 360 minuutin kuluttua.

## Kartat ja osoitteet

**Kartta**-näkymä paikantaa osoitteen geokoodauspalvelun avulla: oletuksena OpenStreetMapin
(Nominatim), jota kysytään kerran osoitetta kohden, enintään yksi pyyntö sekunnissa, ja
jokainen vastaus säilytetään. Karttapohja koostuu **laatoista**, jotka jokaisen lukijan selain
lataa suoraan.

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | toinen samaa protokollaa puhuva palvelu (oma Nominatim); `off`: ei mitään, osoitteet eivät poistu instanssista ja vain leveys- ja pituusaste sijoittavat rivit |
| `BASEDB_MAP_TILES` | OpenStreetMapin laatat | toinen laattapalvelin, malli `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | maininta, jota tämä palvelin vaatii, kartan oikeassa alakulmassa |

Käynnistyksessä loki kertoo, mitä palvelua käytetään: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-asiakirjat

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_PDF_FONTS` | kuvan Noto-fontit | oma kansiosi, liitetty konttiin, joka sisältää `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, ja kiinaa, japania ja koreaa varten `NotoSansCJK-Regular.ttc` ja `-Bold.ttc` |

## Tietokantamallit

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | julkisen sivuston katalogi | mistä instanssi lukee galleriansa mallit; `off`, jos mitään ei lueta (sisäänrakennetut mallit säilyvät) – katso [Mallit](/basedb/fi/fonctionnalites/modeles/) |

## Tekoäly

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic`, `mistral` tai `openai_compatible` (Azure, yhdyskäytävä, paikallinen malli) |
| `BASEDB_AI_MODEL` | – | malli |
| `BASEDB_AI_API_KEY` | – | avain (muuten `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`); valinnainen arvolla `openai_compatible` |
| `BASEDB_AI_BASE_URL` | palveluntarjoajan osoite | se, mikä edeltää polkua `/chat/completions` (`anthropic`-palveluntarjoajalla `/messages`), parametrit mukaan lukien; pakollinen arvolla `openai_compatible` – katso [Tekoäly](/basedb/fi/fonctionnalites/ia/#azure-yhdyskäytävä-paikallinen-malli) |
| `BASEDB_AI_HEADERS` | – | jokaiseen kutsuun lisättävät otsakkeet JSON-objektina: `{"api-key":"…"}` |
| `BASEDB_AI_PROVIDER_SSL_VERIFY` | `true` | `false`: palveluntarjoajan TLS-varmennetta ei tarkisteta – sisäinen yhdyskäytävä, jonka varmenne on itse allekirjoitettu; katso [Tekoäly](/basedb/fi/fonctionnalites/ia/#azure-yhdyskäytävä-paikallinen-malli) |
| `BASEDB_AI_QUOTA` | `120` | vuorovaikutteiset kutsut tuntia ja työtilaa kohden |
| `BASEDB_AI_FIELD_QUOTA` | `300` | tekoälykenttien laskennat tuntia ja työtilaa kohden |
| `BASEDB_AI_WORKER` | `1` | `0`: ei taustalaskentaa tässä prosessissa |

## Webhookit sisäverkkoon

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | omat sisäiset palvelimesi, pilkuilla erotettuina: nimi (`chat.intra.example.com`), verkkotunnus ja sen alitunnukset (`*.intra.example.com`), osoite tai osoitealue (`10.12.0.0/16`) |

Webhookit, automaatioiden HTTP-pyynnöt ja synkronoidut taulukot lähtevät vain julkisiin
HTTPS-osoitteisiin. Luettelossa oleva kohde hyväksytään niiden lisäksi, olipa sen osoite, portti
ja skeema mikä tahansa — HTTP mukaan lukien. Lukukelvoton merkintä estää käynnistyksen. Katso
[Webhookit](/basedb/fi/integrations/webhooks/#kohteet).

## Julkinen esittely

Kaikille avoin instanssi, kuten [demo.basedb.eodia.com](https://demo.basedb.eodia.com):
kirjautumisnäkymä esitäyttää jaetun tilin, vierailija lukee kaiken ja muokkaa olemassa olevaa,
mutta ei luo eikä poista mitään – tietokantaa, taulukkoa, riviä, tiedostoa, kommenttia, tiliä,
tunnusta, linkkiä –, ja tekoäly vastaa, ettei se kuulu esittelyyn. SQL-konsoli vain lukee
siellä. Tietokannan palauttaminen ennalleen joka yö on omalla vastuullasi.

| Muuttuja | Oletus | Tehtävä |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: instanssista tulee julkinen esittely |
| `BASEDB_DEMO_ACCOUNTS` | — | yksi tili kieltä kohden, pilkuilla erotettuina: `fr=demo@demo.com,en=demo-en@demo.com`; kirjautumisnäkymä esitäyttää oman kielensä tilin, muuten englanninkielisen, muuten ensimmäisen, ja tarjoaa muut vaihtoehtoina. Luo nämä tilit, kukin omalla projektillaan, ennen esittelyn käyttöönottoa: se estää luomisen kaikilta, ylläpitäjä mukaan lukien |
| `BASEDB_DEMO_PASSWORD` | — | yhdessä `BASEDB_DEMO_ACCOUNTS`-muuttujan kanssa niiden salasana, sama kaikille, julkaistuna niiden kanssa |

Ilman `BASEDB_DEMO_ACCOUNTS`-muuttujaa jaettu tili on ylläpitäjä, jonka nimeävät
`BASEDB_ADMIN_EMAIL` ja `BASEDB_ADMIN_PASSWORD`. Esittelyn osoite kirjautuu sisään julkaistulla
salasanalla, kirjoitettiinpa mitä tahansa: väärät yritykset eivät lukitse sitä kaikilta.

## Vain kehityskäyttöön

| Muuttuja | Tehtävä |
|---|---|
| `BASEDB_DEV_MAIL=1` | näyttää sähköpostit lokeissa lähettämisen sijaan |
| `BASEDB_WEBHOOK_DEV=1` | sallii webhookit HTTP-osoitteisiin ja paikallisiin osoitteisiin |

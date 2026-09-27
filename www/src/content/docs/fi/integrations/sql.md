---
title: Suora SQL
description: Lue ja kirjoita basedb:n taulukoita psql:llä, BI-työkalulla tai skriptillä.
---

Tämä on basedb:n olemassaolon syy: **taulukkosi ovat oikeita taulukoita**. Mikä tahansa
PostgreSQL-asiakasohjelma lukee niitä niiden nimillä.

## Nimet

| Objekti | Fyysinen nimi | Esimerkki |
|---|---|---|
| Tietokanta | skeema `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Testiympäristö | skeema jälkiliitteellä | `b_t4z56fq_ventes_recette` |
| Taulukko | sen slugifioitu nimi | `opportunites` |
| Kenttä | sen slugifioitu nimi | `echeance` |
| Viittaus | `<table cible>_id` | `clients_id` |
| [SQL-näkymä](/basedb/fi/fonctionnalites/requetes-et-vues-sql/) | sen tekninen nimi tietokannan skeemassa | `factures_a_encaisser` |

Kunkin tietokannan **API- ja MCP-dokumentaatio**-sivu antaa ne kaikki, ja `psql`:n `\d` näyttää
kuvaukset (`COMMENT ON`).

## Käyttöliittymässä

Välilehtipalkin **+** tai tietokannan **⋯**-valikko → **Uusi SQL-kysely**: editori, jossa on
korostus ja täydennys ja jonka tulos näkyy samassa ruudukossa kuin taulukkosi.

![Tallennettu kysely ja kaksi SQL-näkymää taulukoiden joukossa](../../../../assets/screens/requete-sql.png)

- **Kukin lukee omilla käyttöoikeuksillaan**: Hallintaoikeus-taso näkee koko tietokannan
  kirjoitukset mukaan lukien; muut jäsenet kirjoittavat SQL:ää vain luku -tilassa, jossa suljettua
  taulukkoa ei ole olemassa ja piilotettu kenttä katoaa.
- Kysely **tallennetaan** taulukoiden alle – itselle, koko tietokannalle tai ryhmille –, ja siitä
  voi halutessaan tehdä **SQL-näkymän**: oikean PostgreSQL-näkymän taulukoiden joukkoon, joka on
  luettavissa `psql`:stä.

Kaikki on kuvattu tarkemmin sivulla [Kyselyt ja SQL-näkymät](/basedb/fi/fonctionnalites/requetes-et-vues-sql/).

## psql:stä

Mukana toimitetulla `docker-compose.yml`-tiedostolla PostgreSQL julkaistaan osoitteeseen
`127.0.0.1:5432`:

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## Kirjoittaminen SQL:llä

Se on sallittua. PostgreSQL valvoo rajoitteita (yksi valinta -kentät, viittaukset, URL-osoitteet,
pakollisuus), ja ne hylkäävät virheellisen arvon kuten käyttöliittymässä. Kirjoitus myös
**kirjataan historiaan**: historia näyttää sen nimellä ”Suora SQL-istunto” sen tehneen istunnon
tiedoin, ja sen voi kumota kuten muutkin.

:::caution
**Rakenteen** muuttaminen SQL:llä (`ALTER TABLE`) ohittaa basedb:n katalogin, joka ei tietäisi
muutoksesta. Käytä käyttöliittymää, API:a tai agentin ehdotusta: migraatiomoottori suunnittelee,
lukitsee lyhyesti ja pitää katalogin täsmällisenä.
:::

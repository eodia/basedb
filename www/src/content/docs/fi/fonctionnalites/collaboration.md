---
title: Yhteistyö
description: Kommentit ja maininnat, ilmoitukset, reaaliaikaiset päivitykset ja läsnäolo.
---

Useat henkilöt työskentelevät samassa tietokannassa samaan aikaan: kukin näkee muiden
kirjoitusten saapuvan, tietää, kuka katsoo mitäkin, ja keskustelee rivistä siellä, missä se on.

## Kommentit

Rivin tiedoissa on **Kommentit**-välilehti ”Tiedot”- ja ”Historia”-välilehtien välissä.
Kirjoita `@` **mainitaksesi** jäsenen ja lähetä Ctrl+Enter-näppäinyhdistelmällä. Kukin voi
muokata ja poistaa omia kommenttejaan.

![Keskustelu projektista](../../../../assets/screens/commentaires.png)

Rivin lukuoikeus riittää sen kommentoimiseen. Mainittu henkilö, joka ei voi lukea riviä, ei saa
ilmoitusta – ja kirjoittajalle kerrotaan siitä, jottei hän luule viestin menneen perille.

## Ilmoitukset

Oikean yläkulman kello laskee lukemattomat. Sinne tulee neljä asiaa:

- joku **mainitsee** sinut kommentissa;
- joku **vastaa** keskusteluun, johon olet kirjoittanut;
- joku **valitsee** sinut Henkilö-kenttään – käyttöliittymästä, API:sta, lomakkeesta tai
  automaatiosta;
- [automaatio](/basedb/fi/fonctionnalites/automatisations/) **ilmoittaa** sinulle.

Ilmoituksen avaaminen avaa rivin. **Merkitse kaikki luetuiksi** nollaa laskurin; ilmoituksia
säilytetään 90 päivää.

![Vastaanotettu maininta](../../../../assets/screens/notifications.png)

## Reaaliaikaisuus

Muiden kirjoitukset näkyvät **lataamatta sivua uudelleen**: muokattu solu, siirretty kortti,
lisätty rivi – tulivat ne käyttöliittymästä, API:sta, agentilta tai suorasta SQL:stä. Palvelin
lähettää vain **signaalin**, ei koskaan tietoja: näkymä lukee tiedot uudelleen sinun
käyttöoikeuksillasi. Solua, jota olet muokkaamassa, ei koskaan korvata kesken muokkauksen.

## Läsnäolo

**Samaa taulukkoa** katsovien henkilöiden kasvot näkyvät näytön yläosassa; **saman rivin**
avanneiden kasvot sen rivin tietojen otsakkeessa. Ruudukossa muiden osoitin näkyy solussa,
jonka päällä he ovat.

## Kumoaminen

Ctrl+Z kumoaa viimeisimmän kirjoituksesi – katso [historia](/basedb/fi/fonctionnalites/historique/#kumoaminen-ctrlz).

## Rajoitukset

- Ilmoitukset pysyvät basedb:ssä: toistaiseksi mitään ei lähetetä sähköpostilla.
- Jos kerralla muuttuu yli sata riviä, näkymä lataa koko sivun uudelleen rivi kerrallaan
  päivittämisen sijaan.

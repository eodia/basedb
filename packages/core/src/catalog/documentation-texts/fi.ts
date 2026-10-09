import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Finnish: the French sentence of `documentation.ts` → its translation. */
export const fi: Catalog = {
  'Prise en main': 'Aloittaminen',
  'API REST': 'REST API',
  'Agents (MCP)': 'Agentit (MCP)',
  Tables: 'Taulukot',
  Référence: 'Viitetiedot',
  texte: 'teksti',
  'texte long': 'pitkä teksti',
  'nombre (chaîne décimale)': 'luku (desimaalimerkkijonona)',
  booléen: 'totuusarvo',
  'date (`2026-09-18`)': 'päivämäärä (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)':
    'päivämäärä ja aika UTC:ssa (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'yksi valinta',
  'choix multiple (liste de valeurs)': 'monivalinta (arvoluettelo)',
  'relation (`_id` de la ligne liée)': 'viittaus (linkitetyn rivin `_id`)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'moniviittaus (linkitettyjen rivien `_id`-arvot niiden järjestyksessä)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL (`https://…` tai `mailto:…`)',
  'adresse e-mail': 'sähköpostiosoite',
  'numéro automatique (lecture seule)': 'automaattinen numero (vain luku)',
  'personne (`id` d’un membre de l’espace)': 'henkilö (työtilan jäsenen `id`)',
  formule: 'kaava',
  'documents (liste de fichiers)': 'asiakirjat (tiedostoluettelo)',
  'images (liste de fichiers)': 'kuvat (tiedostoluettelo)',
  'colonne système': 'järjestelmäsarake',
  'Un texte plus long.': 'Pidempi teksti.',
  valeur: 'arvo',
  Exemple: 'Esimerkki',
  résultat: 'tulos',
  'photo.jpg': 'kuva.jpg',
  'devis.pdf': 'tarjous.pdf',
  Exemples: 'Esimerkit',
  'Lister les lignes': 'Listaa rivit',
  Réponse: 'Vastaus',
  'Créer une ligne': 'Luo rivi',
  'Déposer un fichier': 'Lataa tiedosto',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Pyynnön runko on itse tiedosto. Vastaus antaa `id`-tunnisteen, joka kirjoitetaan sen jälkeen kenttään {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Tunnuksen identiteetti: kuka sen loi, mikä sen tietokanta on sekä sen tosiasialliset oikeudet ja käyttörajat.',
  'Les bases que le jeton peut lire.': 'Tietokannat, joita tunnus voi lukea.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Tietokannan taulukot ja niiden viittausten verkko.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Taulukon kentät: tyyppi, pakollisuus, valinnat, viittaukset ja mitkä niistä voi muokata.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Rivien lukeminen: suodatin, lajittelu, kursoripohjainen sivutus.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Rivin lukeminen `_id`-tunnisteella, pitkät tekstit kokonaisuudessaan pyydettäessä.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Rivin `_id`-tunnisteen selvittäminen sen näyttöarvon perusteella, ennen viittauksen kirjoittamista.',
  'Créer une ligne.': 'Rivin luominen.',
  'Modifier les champs nommés d’une ligne.': 'Rivin nimettyjen kenttien muokkaaminen.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Rivin poistaminen tunnuksella, joka on luotu poistamista varten — vastaus palauttaa sen.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Poistetun rivin palauttaminen, sen `_id`-tunnisteella, historiasta.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Taulukon ja sen ensimmäisten kenttien ehdottaminen – päätöksen tekee henkilö.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Kentän, valintaluettelon tai viittauksen ehdottaminen – päätöksen tekee henkilö.',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    'Taulukon sekä sen valintaluetteloiden valintojen värin ja kuvakkeen ehdottaminen – päätöksen tekee henkilö.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Tunnuksen tekemän ehdotuksen tarkasteleminen uudelleen ja sen kohtalon selvittäminen.',
  'dépôt basedb': 'basedb:n tietovarasto',
  recette: 'testi',
  'Depuis un agent (MCP)': 'Agentin kautta (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Tämä tietokanta ei ole avoinna agenteille: mikään MCP-työkalu ei näe tätä taulukkoa, tunnuksesta riippumatta.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Kenttien selvittäminen ja se, mitkä niistä ovat muokattavia',
  'Lire ses lignes — filtre, tri, pagination': 'Rivien lukeminen – suodatin, lajittelu, sivutus',
  'Lire une ligne par son `_id`': 'Rivin lukeminen `_id`-tunnisteella',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Rivin selvittäminen näyttöarvon perusteella, {field}',
  'Modifier une ligne': 'Muokkaa riviä',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Yksikään työkalu ei ole käytettävissäsi tälle taulukolle.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Luomallasi tunnuksella ei koskaan ole enempää oikeuksia kuin sinulla itselläsi: nämä työkalut ovat yläraja.',
  Outil: 'Työkalu',
  Pour: 'Tarkoitus',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Poista rivi — tunnuksella, joka on luotu poistamista varten',
  'Ramener une ligne supprimée': 'Palauta poistettu rivi',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Agentti poistaa vain tunnuksella, joka on luotu oikeuksin ”Luku, kirjoitus ja poisto”, yhden rivin kerrallaan; poistettu rivi palautuu työkalulla `restore_record` tai historiasta.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Näkymättömät agentille:** {fields}. Agentille näitä sarakkeita ei ole olemassa: se ei voi lukea, suodattaa eikä kirjoittaa niitä.',
  'Arguments d’un appel': 'Kutsun argumentit',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Tunnuksen luominen tälle tietokannalle vaatii **Hallintaoikeus**-tason, jota sinulla ei ole. Pyydä tunnusta tietokantaa hallinnoivalta henkilöltä.',
  '<jeton>': '<tunnus>',
  'Connecter un agent': 'Agentin liittäminen',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedb:n **MCP-palvelin** avaa tämän tietokannan tekoälyagentille – Claude tai mikä tahansa MCP-asiakas: se löytää tietokannan, lukee sitä ja päätöksesi mukaan luo, muokkaa ja poistaa siinä rivejä. Se noudattaa samoja käyttöoikeuksia kuin REST API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Tämä tietokanta ei ole avoinna agenteille.** Niin kauan kuin se ei ole, mikään työkalu ei näe sitä, esitetystä tunnuksesta riippumatta.',
  'Créer un jeton': 'Tunnuksen luominen',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'Käyttöliittymässä tietokannan ”⋯”-valikko → **API ja agentit** → **API- ja MCP-tunnukset…**, **MCP**-pääsy valittuna. Tunnus avaa **koko tietokannan, kaikki sen ympäristöt** – tuotanto, testi… – tai vain yhden, jos rajaat sen. Oletuksena se on **vain luku** -oikeuksin: kirjoitusoikeus ja poisto-oikeus valitaan erikseen. Se näytetään vain kerran, ja sen voi perua samalta näytöltä. Kun myös **REST API** on valittuna, sama tunnus toimii myös ohjelmalle (katso ”Todennus”).',
  'Garder le jeton hors de la configuration': 'Tunnuksen pitäminen erillään asetuksista',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Tunnus tallennetaan ympäristömuuttujaan `BASEDB_TOKEN`, ei koskaan asiakasohjelman asetustiedostoon: se on versionhallinnassa, synkronoitu ja kaikkien istunnon ohjelmien luettavissa.',
  'Déclarer le serveur dans le client': 'Palvelimen määrittäminen asiakasohjelmaan',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    'HTTP:n yli MCP:tä puhuva asiakasohjelma – esimerkiksi Claude Code – ottaa yhteyden suoraan palvelimen osoitteeseen, `…/mcp`, otsakkeella {header}. Projektin `.mcp.json`-tiedostossa `${BASEDB_TOKEN}` luetaan ympäristöstä: tunnusta ei kirjoiteta tiedostoon. Samalla tunnuksella voi määrittää yhden palvelimen kutakin ympäristöä kohden.',
  'Client sans HTTP : le relais': 'Asiakasohjelma ilman HTTP:tä: välittäjä',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    'Asiakasohjelma, joka käynnistää vain paikallisia ohjelmia (stdio), käyttää **välittäjää** `relay.js`, joka kuljettaa sen viestit palvelimelle asti. Se lukee tunnuksen muuttujasta, jonka nimeää `--token-env` – oletuksena `BASEDB_MCP_TOKEN` –, palvelimen osoitteen kohdasta `--url` (tai `BASEDB_MCP_URL`) ja ympäristön kohdasta `--environment` (tai `BASEDB_MCP_ENVIRONMENT`).',
  'Autre client MCP': 'Muu MCP-asiakas',
  'votre-instance': 'instanssisi',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Tunnus hyväksytään vain niillä pääsyillä, jotka valittiin sitä luotaessa: pelkän ”MCP”-tunnuksen REST API hylkää, ja päinvastoin.',
  'Choisir l’environnement': 'Ympäristön valitseminen',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    'Tietokannalla voi olla useita ympäristöjä – tuotanto, testi, kehitys – ja jokaisella on omat taulukkonsa ja rivinsä. Koko tietokannan tunnus avaa ne kaikki; ympäristö valitaan kutsun yhteydessä, laajimmasta tarkimpaan:',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**Tietokannan nimi** sellaisenaan: {base} on tuotanto, ja jokaisella ympäristöllä on myös oma nimensä.',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**Palvelimen osoite**: {address} – yksi määritetty palvelin kutakin ympäristöä kohden.',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '**Argumentti `environment`** jokaisessa työkalussa, joka nimeää tietokannan, yhtä kutsua varten: {example}.',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    'Ympäristö nimetään sen merkin nimikkeellä, kirjainkoosta ja diakriittisistä merkeistä riippumatta, tai nimellä `production`. Ympäristöön, jota tietokannalla ei ole, vastataan `RESOURCE_NOT_FOUND`.',
  Vérifier: 'Tarkistus',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    'Pyydä agenttia kutsumaan `whoami`: se palauttaa tunnuksen luoneen henkilön, sen kattaman tietokannan, ympäristöt, jotka se avaa (`scope.available`), ja sen tosiasialliset oikeudet.',
  Outils: 'Työkalut',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} työkalua, aina samat: niiden nimi ja kuvaus eivät koskaan riipu tiedoistasi. Skeema selviää niitä kutsumalla.',
  Rôle: 'Tehtävä',
  Écrit: 'Kirjoittaa',
  oui: 'kyllä',
  propose: 'ehdottaa',
  non: 'ei',
  'Enchaînement type': 'Tyypillinen kutsujärjestys',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, sitten `describe_base`: mitä on olemassa.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` ennen mitä tahansa lukua tai kirjoitusta: kentät, niiden tyypit ja ne, joita tunnus voi kirjoittaa (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` parametreillä `filter`, `sort` ja `limit`; jatka parametrillä `cursor` niin kauan kuin `has_more` on `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Viittauksen kirjoittamiseksi: `lookup_records` kohdetaulukkoon, sitten `create_record` tai `update_record` löydetyllä `_id`-arvolla.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Rakenteen muuttamiseksi: `propose_create_table` tai `propose_add_field`, sitten `get_proposal` päätöksen seuraamiseksi.',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    'Ulkoasua varten: `color` ja `icon` työkalussa `propose_create_table` ja työkalun `propose_add_field` valinnoissa, tai `propose_update_look` olemassa olevalle taulukolle.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Poistamiseksi: `get_record` ensin, rivin varmistamiseksi, sitten `delete_record` — joka palauttaa sen vastauksessaan; `restore_record` palauttaa sen.',
  'Propositions de structure': 'Rakenne-ehdotukset',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Agentti ei koskaan muuta rakennetta itse: se **ehdottaa**. Ehdotus odottaa tietokannan ”Agenttien ehdotukset” -jonossa, jossa rakennetta muokata voiva henkilö hyväksyy tai hylkää sen; ilman päätöstä se vanhenee 24 tunnin kuluttua. Hyväksyttynä se toteutetaan tunnuksen luoneen henkilön nimissä – jos hänellä yhä on siihen oikeus – ja näkyy historiassa kuten mikä tahansa muu muutos.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Enintään 5 odottavaa ehdotusta tunnusta kohden; uusi ehdotus samasta kohteesta korvaa edellisen (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Ei poistoja, ei uudelleennimeämisiä, ei kaskadoituja viittauksia (`MCP_CASCADE_FORBIDDEN`).',
  'Couleurs et pictogrammes': 'Värit ja kuvakkeet',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    'Taulukolla ja luettelon jokaisella valinnalla on väri ja kuvake, kuten sovelluksessa. `color` on väri muodossa `#rrggbb`; `icon` on sen kuvakkeen nimi, jonka sovellus piirtää – työkalun skeema luettelee ne. Pois jätetty avain säilyttää nykyisen arvon, `null` tyhjentää sen. `describe_base` ja `describe_table` palauttavat nykyisen ulkoasun.',
  'Ce qui n’existe pas': 'Mitä ei ole olemassa',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Mikään työkalu ei poista useita rivejä kerralla, taulukkoa tai kenttää, suorita SQL:ää eikä hallinnoi oikeuksia tai tunnuksia. Agentti, joka kutsuu tällaista nimeä – `delete_records`, `run_sql`… – saa vastauksen `MCP_OPERATION_EXCLUDED`, kohteena olevasta tietokannasta riippumatta.',
  Bornes: 'Rajat',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 25 riviä oletuksena, enintään 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Suodattimessa on enintään 10 ehtoa, yhdistettynä JA-operaattorilla; lajittelussa enintään 3 kenttää.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'Luettelossa yli 500 merkin pituinen teksti katkaistaan ja mainitaan kohdassa `_truncated_fields`; `get_record` parametrillä `full_fields` palauttaa sen kokonaisena.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Kirjoitus hyväksyy `idempotency_key`-arvon: sen toistaminen ei luo kaksoiskappaletta.',
  'Ce que voit un agent': 'Mitä agentti näkee',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Agentti ei koskaan näe enempää kuin sen tunnuksen luonut henkilö – ja usein vähemmän.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Oikeudet**: tunnuksen omat, jotka tarkistetaan joka kutsulla sen luojan oikeuksia vasten. Jos tämän henkilön oikeudet vähenevät, tunnuksen oikeudet vähenevät niiden mukana; jos hänen tilinsä poistetaan käytöstä, tunnus lakkaa vastaamasta.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Lukea, luoda, muokata** – ja poistaa, yksi rivi kerrallaan, vain tunnuksella, joka on luotu tätä varten. Vain luku -tunnus hylkää kaiken kirjoittamisen (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Tämä tietokanta**: avoinna agenteille.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Tämä tietokanta**: **suljettu agenteilta** – mikään työkalu ei näe sitä.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Vain ihmisille tarkoitetut sarakkeet**: ei yhtään tässä tietokannassa näkemässäsi osassa.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Vain ihmisille tarkoitetut sarakkeet**: {columns}. Agentille niitä ei ole olemassa.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Dataa, ei ohjeita**: kuvaukset ja sisällöt esitetään käyttäjien syöttäminä tietoina, ja työkalut kertovat tämän agentille.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Loki**: jokainen kutsu kirjataan parametriensa muodon mukaan, ei koskaan niiden arvojen mukaan.',
  obligatoire: 'pakollinen',
  'calculé par l’IA': 'tekoälyn laskema',
  'lecture seule': 'vain luku',
  'HTML riche — **à assainir à l’affichage**':
    'Muotoiltu HTML – **puhdistettava ennen näyttämistä**',
  'invisible pour les agents': 'näkymätön agenteille',
  'relation → {table}': 'viittaus → {table}',
  'Valeurs : {values}.': 'Arvot: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'kohde ei ole sinulle näkyvä: solun arvo on aina {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'osoittaa kohteeseen {table} (näyttösaraketta ei ole määritetty: solu näyttää tunnisteen)',
  'pointe vers {table}, affiché par {field}':
    'osoittaa kohteeseen {table}, näytettynä kentällä {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'poistettaessa: kohderivin poistaminen estetään niin kauan kuin siihen viitataan',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'poistettaessa: kohderivin poistaminen tyhjentää tämän solun',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'poistettaessa: kohderivin poistaminen poistaa myös tämän rivin',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'kirjoitettaessa hyväksytään paljas `uuid`, `null` tai `{"id": "…"}`; luettaessa aina `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Listaa rivit – suodatin, lajittelu, kursoripohjainen sivutus',
  'Lire une ligne': 'Lue rivi',
  'Supprimer une ligne': 'Poista rivi',
  'Lister les lignes qui pointent vers celle-ci': 'Listaa rivit, jotka viittaavat tähän',
  Méthode: 'Metodi',
  Chemin: 'Polku',
  lire: 'lukea',
  créer: 'luoda',
  modifier: 'muokata',
  supprimer: 'poistaa',
  '**En SQL :** {sql}': '**SQL:ssä:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Voit {verbs}. Tästä luettelosta puuttuvat verbit eivät ole sinulle avoinna, eikä niitä vastaavia polkuja kuvata.',
  'Points d’accès': 'Päätepisteet',
  Colonnes: 'Sarakkeet',
  Colonne: 'Sarake',
  Libellé: 'Nimike',
  Type: 'Tyyppi',
  Description: 'Kuvaus',
  'Champs relation': 'Viittauskentät',
  'Colonnes système': 'Järjestelmäsarakkeet',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Aina luettavissa, ei koskaan kirjoitettavissa. Ne kantavat kursoripohjaisen sivutuksen ja vaiheittaisen jatkamisen, eikä mikään asetus piilota niitä.',
  Expansion: 'Laajennus',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} – syvyys 1 poikkeuksetta. Linkitetyt objektit saapuvat kohdassa `included`, indeksoituna ensin taulukon nimen ja sitten tunnisteen mukaan, eikä niitä upoteta riviin: 100 riviä, jotka osoittavat 3 kohteeseen, kuljettavat 3 objektia.',
  'Lignes référençantes': 'Viittaavat rivit',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} listaa rivit, jotka viittaavat annettuun riviin. Lohko, jonka lähdetaulukko ei ole sinulle näkyvä, ei näy siinä lainkaan – ei lohkoa, ei laskuria, ei mainintaa.',
  'une table que vous ne voyez pas': 'taulukko, jota et näe',
  'Vue d’ensemble': 'Yleiskatsaus',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Tämän tietokannan nimi on {name} – se on **PostgreSQL-skeeman** nimi, ja sama nimi, jonka kirjoitat sekä URL-osoitteisiisi että työkalukutsuihin. Taulukoilla ja sarakkeilla on samat nimet täällä ja SQL:ssä: mitään vastaavuustaulukkoa ei tarvitse tarkistaa.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Kaksi väylää, samat käyttöoikeudet: **REST API** ohjelmillesi, **MCP-palvelin** tekoälyagenteille. Jokainen taulukkosivu kertoo, miten sen tavoittaa kummallakin tavalla.',
  Élément: 'Ominaisuus',
  Valeur: 'Arvo',
  'Schéma PostgreSQL': 'PostgreSQL-skeema',
  'Préfixe des routes REST': 'REST-reittien etuliite',
  'ouverte — voir « Connecter un agent »': 'avoinna – katso ”Agentin liittäminen”',
  '**fermée aux agents**': '**suljettu agenteilta**',
  'Tables visibles': 'Näkyvät taulukot',
  Format: 'Muoto',
  'JSON, dans une enveloppe {envelope}': 'JSON, kääreessä {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Tämä dokumentaatio kuvaa sen, mitä SINÄ näet.** Kaksi lukijaa saa siitä kaksi eri versiota, ja se on tarkoituksellista, ei sivuvaikutus. Älä julkaise sitä sellaisenaan.',
  Authentification: 'Todennus',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Kaikki data-reitit vaativat **tunnuksen** `Authorization`-otsakkeessa. Istuntoevästettä ei koskaan hyväksytä täällä: selain lähettää sen jokaisella pyynnöllä, myös niillä, jotka vieras sivu aiheuttaa.',
  'Jeton d’intégration': 'Integraatiotunnus',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Ohjelma – skripti, synkronointi, muu sovellus – esittää **integraatiotunnuksen**, joka alkaa merkeillä `bdb_`. Se on voimassa vain tälle tietokannalle – kaikille sen ympäristöille tai vain yhdelle; se lukee, luo ja muokkaa, jos se on luotu kirjoitusoikeuksin, ja **poistaa vain, jos se on luotu tätä varten**; eikä sillä ole koskaan enempää oikeuksia kuin sen luoneella henkilöllä, tarkistettuna joka kutsulla. Ylläpito, SQL-konsoli ja tekoäly pysyvät siltä suljettuina.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Sellaisen luomiseksi: tietokannan ”⋯”-valikko → **API ja agentit** → **API- ja MCP-tunnukset…**, **REST API** -pääsy valittuna. Se näytetään vain kerran.',
  Appel: 'Kutsu',
  Environnement: 'Ympäristö',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    'Koko tietokannalle luotu tunnus avaa kaikki sen ympäristöt. Polku nimeää tietokannan – {base} on tuotanto – ja otsake {header} valitsee ympäristön; `?environment=` tekee saman asiakasohjelmalle, joka ei aseta otsaketta. Ilman kumpaakaan ympäristö on se, jonka tietokannan nimi osoittaa.',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Puuttuva todennus vastaa aina `401`, ei koskaan `404`: sinun täytyy voida kirjautua uudelleen.',
  Conventions: 'Käytännöt',
  Enveloppe: 'Kääre',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Kaikilla vastauksilla on sama muoto: {envelope}. Virheessä `data` korvataan koodilla, yksityiskohdilla ja pyynnön tunnisteella.',
  Nombres: 'Luvut',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Luvut ovat desimaalimerkkijonoja** poikkeuksetta: {example}. Liukuluku pyöristäisi summan huomaamatta.',
  montant: 'summa',
  'Ressource invisible': 'Näkymätön resurssi',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Näkymätön resurssi ja olematon resurssi vastaavat täsmälleen samoin**, tavu tavulta. `404` ei koskaan kerro, onko objekti olemassa.',
  Pagination: 'Sivutus',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Kursoripohjainen sivutus**: seuraa kenttää `meta.has_next_page` ja välitä `after`. Vientireittiä ei ole olemassa.',
  'Identifiants seuls': 'Pelkät tunnisteet',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Integraatiolle, joka haluaa vain tunnisteet, `?links=id` poistaa nimikkeiden selvittämisen – ja yhtä monta SQL-edestakaisin kulkua.',
  Relations: 'Viittaukset',
  'Aucune relation visible dans cette base.': 'Ei näkyviä viittauksia tässä tietokannassa.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Viittaukset ovat **oikeita PostgreSQL-viiteavaimia**. Tietokanta tarkistaa ne, ei sovellus: suora SQL-`INSERT` noudattaa samoja sääntöjä.',
  'Codes de réponse': 'Vastauskoodit',
  Statut: 'Tila',
  Signification: 'Merkitys',
  'Succès.': 'Onnistui.',
  'Ligne créée.': 'Rivi luotu.',
  'Suppression réussie, sans contenu.': 'Poisto onnistui, ei sisältöä.',
  'Authentification absente ou refusée.': 'Todennus puuttuu tai se on hylätty.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Olematon **tai** näkymätön resurssi – molemmat vastaukset ovat identtiset.',
  'Suppression refusée : la ligne est encore référencée.': 'Poisto evätty: riviin viitataan yhä.',
  'Valeur refusée par la validation.': 'Arvo hylätty validoinnissa.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Virheellä on aina tämä muoto, ja `request_id` on se, mikä on mainittava tuelle:',
  'La liste complète des codes est servie par {route}.':
    'Koodien täydellinen luettelo saadaan reitiltä {route}.',
  'Côté MCP': 'MCP:n puolella',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Hylkäys saapuu työkalutuloksena, joka on merkitty `isError`-lipulla ja jonka teksti on vakaa JSON-objekti: sama `code` kuin APIssa, kiinteä lause ja `hint`, joka kertoo, miten kutsu korjataan. `retryable` kertoo, kannattaako sitä yrittää uudelleen sellaisenaan.',
  'Écrire en SQL direct': 'Kirjoittaminen suoraan SQL:llä',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Avaa `psql`: se toimii, ja se on juuri tuotteen tarkoitus.',
  'Ce qui vous attend :': 'Mitä sinua odottaa:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Rajoitteet pätevät – pakollisuus, pituus, viiteavain. Riviä, johon viitataan, ei voi poistaa.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Järjestelmäsarakkeet eivät täyty itsestään manuaalisessa `INSERT`-lauseessa: `_id`, `_created_at` ja `_updated_at` saavat oletusarvot, `_created_by` ja `_updated_by` odottavat käyttäjätunnistetta.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedb:n käyttöoikeudet eivät päde suorassa SQL:ssä.** Ne hallitsevat tuotteen pintoja – APIa, käyttöliittymää, MCP:tä. PostgreSQL-yhteys näkee kaiken, mitä sen rooli näkee. Tämä sanotaan tässä, koska päinvastaisen lupaaminen olisi pahempi kuin ei mitään lupaamista.',
  '{base} — documentation API et MCP': '{base} – API- ja MCP-dokumentaatio',
}

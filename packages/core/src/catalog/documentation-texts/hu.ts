import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Hungarian: the French sentence of `documentation.ts` → its translation. */
export const hu: Catalog = {
  'Prise en main': 'Első lépések',
  'API REST': 'REST API',
  'Agents (MCP)': 'Ügynökök (MCP)',
  Tables: 'Táblák',
  Référence: 'Referencia',
  texte: 'szöveg',
  'texte long': 'hosszú szöveg',
  'nombre (chaîne décimale)': 'szám (decimális karakterlánc)',
  booléen: 'logikai érték',
  'date (`2026-09-18`)': 'dátum (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)':
    'dátum és idő, UTC-ben (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'választólista',
  'choix multiple (liste de valeurs)': 'többszörös választás (értéklista)',
  'relation (`_id` de la ligne liée)': 'kapcsolat (a kapcsolt sor `_id`-je)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'többszörös kapcsolat (a kapcsolt sorok `_id`-jeinek listája, sorrendjük szerint)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL-hivatkozás (`https://…` vagy `mailto:…`)',
  'adresse e-mail': 'e-mail cím',
  'numéro automatique (lecture seule)': 'automatikus szám (csak olvasható)',
  'personne (`id` d’un membre de l’espace)': 'személy (a munkaterület egy tagjának `id`-je)',
  formule: 'képlet',
  'documents (liste de fichiers)': 'dokumentumok (fájlok listája)',
  'images (liste de fichiers)': 'képek (fájlok listája)',
  'colonne système': 'rendszeroszlop',
  'Un texte plus long.': 'Egy hosszabb szöveg.',
  valeur: 'érték',
  Exemple: 'Példa',
  résultat: 'eredmény',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'ajanlat.pdf',
  Exemples: 'Példák',
  'Lister les lignes': 'Sorok listázása',
  Réponse: 'Válasz',
  'Créer une ligne': 'Sor létrehozása',
  'Déposer un fichier': 'Fájl feltöltése',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'A törzs maga a fájl. A válasz egy `id`-t ad vissza, amelyet ezután ide kell írni: {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'A token azonosítása: ki hozta létre, melyik adatbázishoz tartozik, mik a tényleges jogosultságai és keretei.',
  'Les bases que le jeton peut lire.': 'Azok az adatbázisok, amelyeket a token olvashat.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Egy adatbázis táblái és a kapcsolataik gráfja.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Egy tábla mezői: típus, kötelezőség, opciók, kapcsolatok, és hogy melyik módosítható.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Sorok olvasása: szűrés, rendezés, kurzoros lapozás.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Egy sor olvasása a `_id`-je alapján, a hosszú szövegekkel teljes terjedelmükben, ha ezt kérik.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Egy sor `_id`-jének megkeresése a megjelenítési értéke alapján, egy kapcsolat beírása előtt.',
  'Créer une ligne.': 'Sor létrehozása.',
  'Modifier les champs nommés d’une ligne.': 'Egy sor megnevezett mezőinek módosítása.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Egy tábla és az első mezőinek javaslása — egy személy dönt.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Egy mező, egy választólista vagy egy kapcsolat javaslása — egy személy dönt.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'A token egy javaslatának újraolvasása, és annak megtudása, mi lett a sorsa.',
  'dépôt basedb': 'basedb-tároló',
  'Depuis un agent (MCP)': 'Egy ügynöktől (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Ez az adatbázis nincs megnyitva ügynökök előtt: egyetlen MCP-eszköz sem látja ezt a táblát, bármelyik tokent használják is.',
  'Connaître ses champs, et lesquels sont modifiables':
    'A mezőinek megismerése, és hogy melyikük módosítható',
  'Lire ses lignes — filtre, tri, pagination': 'A sorainak olvasása — szűrés, rendezés, lapozás',
  'Lire une ligne par son `_id`': 'Egy sor olvasása a `_id`-je alapján',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Egy sor megkeresése a megjelenítési értéke alapján, {field}',
  'Modifier une ligne': 'Egy sor módosítása',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Egyetlen eszköz sincs megnyitva Ön előtt ezen a táblán.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Az Ön által létrehozott tokennek soha nincs több jogosultsága, mint Önnek: ezek az eszközök egy felső korlátot jelentenek.',
  Outil: 'Eszköz',
  Pour: 'Cél',
  'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.':
    'Egy sor törlése továbbra is a REST API-nak és a felületnek van fenntartva: egyetlen MCP-eszköz sem töröl.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Ügynök számára láthatatlan:** {fields}. Számára ezek az oszlopok nem léteznek: nem tudja őket sem olvasni, sem szűrni, sem írni.',
  'Arguments d’un appel': 'Egy hívás argumentumai',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Egy token létrehozása ehhez az adatbázishoz a **Kezelés** szintet igényli, amellyel Ön nem rendelkezik. Kérjen egyet attól a személytől, aki kezeli.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Ügynök csatlakoztatása',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.':
    'A basedb **MCP-szervere** megnyitja ezt az adatbázist egy MI-ügynök előtt — legyen az Claude vagy bármely MCP-kliens —, amely felfedezi, olvassa, és ha Ön úgy dönt, sorokat hoz létre és módosít benne. Ugyanazokon a jogosultságokon megy keresztül, mint a REST API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Ez az adatbázis nincs megnyitva ügynökök előtt.** Amíg ez így marad, egyetlen eszköz sem látja, bármelyik tokent mutatják is be.',
  'Créer un jeton': 'Token létrehozása',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'A felületen az adatbázis „⋯” menüjében → **API és ügynökök** → **API- és MCP-tokenek…**, bejelölt **MCP** hozzáféréssel. A token erre az adatbázisra korlátozódik, alapértelmezés szerint **csak olvasható**: az írás kifejezetten választható. Csak egyszer jelenik meg, és ugyanarról a képernyőről vonható vissza. A **REST API** hozzáférés is bejelölve, ugyanaz a token szolgál egy programhoz (lásd: „Hitelesítés”).',
  'Garder le jeton hors de la configuration': 'A token távoltartása a konfigurációtól',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'A token a `BASEDB_TOKEN` környezeti változóba kerül, soha nem a kliens konfigurációs fájljába: ez utóbbi verziókezelt, szinkronizált, és a munkamenet minden programja számára olvasható.',
  'Déclarer le serveur dans le client': 'A szerver megadása a kliensben',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'A kliens elindítja a **relét**, a `relay.js`-t, amely továbbítja az üzeneteit a szerverig. A tokent abból a változóból olvassa ki, amelyet a `--token-env` nevez meg — `BASEDB_MCP_TOKEN`, ha nincs más megadva —, a szerver címét pedig az `--url`-ből (vagy a `BASEDB_MCP_URL`-ből).',
  'Autre client MCP': 'Másik MCP-kliens',
  'votre-instance': 'on-peldanya',
  'Sans relais': 'Közvetítő nélkül',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Egy kliens, amely HTTP-n beszél MCP-t, közvetlenül a szerver címét célozza meg, a `…/mcp`-t, a {header} fejléccel. Egy token csak a létrehozásakor bejelölt hozzáférésekre fogadható el: egy önmagában „MCP” tokent a REST API elutasít, és fordítva.',
  Vérifier: 'Ellenőrzés',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Kérje meg az ügynököt, hogy hívja meg a `whoami`-t: ez visszaadja a tokent létrehozó személyt, az érvényességi körébe tartozó adatbázist és a tényleges jogosultságait.',
  Outils: 'Eszközök',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} eszköz, mindig ugyanazok: a nevük és a leírásuk soha nem függ az Ön adataitól. A séma a meghívásukkal fedezhető fel.',
  Rôle: 'Szerep',
  Écrit: 'Ír?',
  oui: 'igen',
  propose: 'javasol',
  non: 'nem',
  'Enchaînement type': 'Jellemző hívássorozat',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, majd `describe_base`: ami létezik.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` minden olvasás vagy írás előtt: a mezők, a típusaik, és hogy melyikbe írhat a token (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` a `filter`, `sort` és `limit` paraméterekkel; folytatás a `cursor`-ral, amíg a `has_more` értéke `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Egy kapcsolat írásához: `lookup_records` a céltáblán, majd `create_record` vagy `update_record` a megtalált `_id`-vel.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'A struktúra fejlesztéséhez: `propose_create_table` vagy `propose_add_field`, majd `get_proposal` a döntés nyomon követésére.',
  'Propositions de structure': 'Struktúra-javaslatok',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Egy ügynök soha nem módosítja saját maga a struktúrát: **javasol**. A javaslat az adatbázis „Ügynökök javaslatai” sorában vár, ahol egy, a struktúra módosítására jogosult személy jóváhagyja vagy elutasítja; döntés hiányában 24 óra után lejár. Jóváhagyás esetén annak a személynek a nevében kerül alkalmazásra, aki a tokent létrehozta — ha ennek a személynek még mindig joga van hozzá —, és úgy jelenik meg az előzményekben, mint bármely más módosítás.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Tokenenként legfeljebb 5 függőben lévő javaslat; ugyanarra az objektumra vonatkozó új javaslat felülírja az előzőt (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Nincs törlés, nincs átnevezés, nincs kaszkádolt kapcsolat (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Ami nem létezik',
  'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Egyetlen eszköz sem töröl sort, nem futtat SQL-t, és nem kezel jogosultságokat vagy tokeneket. Az az ügynök, amely ilyen nevet hív meg — `delete_record`, `run_sql`… —, `MCP_OPERATION_EXCLUDED` hibát kap, bármelyik adatbázist is célozza.',
  Bornes: 'Korlátok',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: alapértelmezés szerint 25 sor, legfeljebb 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Egy szűrő legfeljebb 10 feltételt tartalmazhat, ÉS-sel kombinálva; egy rendezés legfeljebb 3 mezőt.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'Egy listában az 500 karakternél hosszabb szöveg csonkolva jelenik meg, és megnevezésre kerül a `_truncated_fields`-ben; a `get_record` a `full_fields`-szel teljes egészében visszaadja.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Egy írás elfogad egy `idempotency_key`-t: a megismétlése nem hoz létre duplikátumot.',
  'Ce que voit un agent': 'Amit egy ügynök lát',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Egy ügynök soha nem lát többet, mint az a személy, aki a tokenjét létrehozta — és gyakran kevesebbet.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Jogosultságok**: a tokené, amelyeket minden híváskor összevetnek a létrehozója jogosultságaival. Ha ennek a személynek csökkennek a jogosultságai, a tokené is csökken velük; ha a fiókja letiltásra kerül, a token nem válaszol többé.',
  '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Olvasás, létrehozás, módosítás** — soha nem törlés. Egy csak olvasható token minden írást elutasít (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Ez az adatbázis**: nyitva áll az ügynökök előtt.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Ez az adatbázis**: **zárva az ügynökök előtt** — egyetlen eszköz sem látja.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Csak emberek számára fenntartott oszlopok**: egy sincs abban, amit Ön lát ebből az adatbázisból.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Csak emberek számára fenntartott oszlopok**: {columns}. Egy ügynök számára ezek nem léteznek.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Adatok, nem utasítások**: a leírások és a tartalmak felhasználók által megadott adatokként jelennek meg, és az eszközök ezt közlik is az ügynökkel.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Napló**: minden hívás a paraméterei formája szerint kerül naplózásra, soha nem az értékeik szerint.',
  obligatoire: 'kötelező',
  'calculé par l’IA': 'MI által számított',
  'lecture seule': 'csak olvasható',
  'HTML riche — **à assainir à l’affichage**': 'gazdag HTML — **megjelenítéskor tisztítandó**',
  'invisible pour les agents': 'ügynökök számára láthatatlan',
  'relation → {table}': 'kapcsolat → {table}',
  'Valeurs : {values}.': 'Értékek: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'a cél nem látható Ön számára: a cella értéke mindig {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'a(z) {table} táblára mutat (nincs kijelölt megjelenítési oszlop: a cella az azonosítót mutatja)',
  'pointe vers {table}, affiché par {field}':
    'a(z) {table} táblára mutat, a(z) {field} jeleníti meg',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'törléskor: a célsor törlése elutasításra kerül, amíg hivatkoznak rá',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'törléskor: a célsor törlése kiüríti ezt a cellát',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'törléskor: a célsor törlése ezt a sort is törli',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'írásban fogadjon el egy nyers `uuid`-t, `null`-t, vagy `{"id": "…"}`-t; olvasásban mindig `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Sorok listázása — szűrés, rendezés, kurzoros lapozás',
  'Lire une ligne': 'Sor olvasása',
  'Supprimer une ligne': 'Sor törlése',
  'Lister les lignes qui pointent vers celle-ci': 'A rá mutató sorok listázása',
  Méthode: 'Metódus',
  Chemin: 'Útvonal',
  lire: 'olvasás',
  créer: 'létrehozás',
  modifier: 'módosítás',
  supprimer: 'törlés',
  '**En SQL :** {sql}': '**SQL-ben:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Ön a következőket teheti: {verbs}. Az ebből a listából hiányzó műveletek nincsenek megnyitva Ön előtt, és a megfelelő útvonalak nincsenek leírva.',
  'Points d’accès': 'Végpontok',
  Colonnes: 'Oszlopok',
  Colonne: 'Oszlop',
  Libellé: 'Címke',
  Type: 'Típus',
  Description: 'Leírás',
  'Champs relation': 'Kapcsolat mezők',
  'Colonnes système': 'Rendszeroszlopok',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Mindig olvashatók, soha nem írhatók. Ezek hordozzák a kurzoros lapozást és az inkrementális folytatást, és semmilyen beállítás nem rejti el őket.',
  Expansion: 'Kiterjesztés',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — kivétel nélkül 1-es mélységig. A kapcsolt objektumok az `included`-ben érkeznek, táblanév, majd azonosító szerint indexelve, és nem beágyazva a sorba: 100, 3 célra mutató sor 3 objektumot szállít.',
  'Lignes référençantes': 'Hivatkozó sorok',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    'A {route} listázza az egy adott sorra mutató sorokat. Az a blokk, amelynek forrástáblája nem látható Ön számára, egyáltalán nem jelenik meg — sem blokk, sem számláló, sem említés.',
  'une table que vous ne voyez pas': 'egy tábla, amelyet Ön nem lát',
  'Vue d’ensemble': 'Áttekintés',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Ezt az adatbázist {name} néven hívják — ez a **PostgreSQL-séma** neve, és ugyanaz, amit az URL-jeiben és az eszközhívásokban is ír. A táblák és az oszlopok itt és SQL-ben is ugyanazokat a neveket viselik: nincs megfeleltetési tábla, amit meg kellene nézni.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Két hozzáférés, ugyanazok a jogosultságok: a **REST API** a programjaihoz, az **MCP-szerver** az MI-ügynökökhöz. Minden táblaoldal megmondja, hogyan érhető el mindkettőn keresztül.',
  Élément: 'Elem',
  Valeur: 'Érték',
  'Schéma PostgreSQL': 'PostgreSQL séma',
  'Préfixe des routes REST': 'REST útvonalak előtagja',
  'ouverte — voir « Connecter un agent »': 'nyitva — lásd: „Ügynök csatlakoztatása”',
  '**fermée aux agents**': '**zárva az ügynökök előtt**',
  'Tables visibles': 'Látható táblák',
  Format: 'Formátum',
  'JSON, dans une enveloppe {envelope}': 'JSON, egy {envelope} borítékban',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Ez a dokumentáció azt írja le, amit ÖN láthat.** Két olvasó két különböző változatot kap belőle, és ez a szabály, nem egy mellékhatás. Ne tegye közzé ebben a formában.',
  Authentification: 'Hitelesítés',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Minden adatútvonal egy **tokent** igényel, az `Authorization` fejlécben. A munkamenet-sütit itt soha nem fogadják el: egy böngésző minden kéréssel elküldi, beleértve azokat is, amelyeket egy idegen oldal vált ki.',
  'Jeton d’intégration': 'Integrációs token',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Egy program — szkript, szinkronizálás, másik alkalmazás — egy **integrációs tokent** mutat be, amely `bdb_` előtaggal kezdődik. Csak erre az adatbázisra érvényes; olvas, és létrehoz, illetve módosít, ha írásra jött létre, de **soha nem töröl**; és soha nincs több jogosultsága, mint annak a személynek, aki létrehozta, minden híváskor összevetve. Az adminisztráció, az SQL-konzol és az MI zárva marad előtte.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Egy létrehozásához: az adatbázis „⋯” menüje → **API és ügynökök** → **API- és MCP-tokenek…**, bejelölt **REST API** hozzáféréssel. Csak egyszer jelenik meg.',
  Appel: 'Hívás',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Egy hiányzó hitelesítés `401`-gyel válaszol, soha nem `404`-gyel: Önnek mindig újra be kell tudnia jelentkeznie.',
  Conventions: 'Konvenciók',
  Enveloppe: 'Boríték',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Minden válasz ugyanolyan alakú: {envelope}. Egy hiba a `data`-t a kóddal, a részletekkel és a kérésazonosítóval helyettesíti.',
  Nombres: 'Számok',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**A számok decimális karakterláncok**, kivétel nélkül: {example}. Egy lebegőpontos szám némán kerekítene egy összeget.',
  montant: 'osszeg',
  'Ressource invisible': 'Láthatatlan erőforrás',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Egy láthatatlan és egy nem létező erőforrás ugyanazt válaszolja**, bájtról bájtra. Egy `404` soha nem árulja el, hogy létezik-e az objektum.',
  Pagination: 'Lapozás',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Kurzoros lapozás**: kövesse a `meta.has_next_page`-et, és adja át az `after`-t. Nincs exportálásra szolgáló útvonal.',
  'Identifiants seuls': 'Csak azonosítók',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Egy olyan integrációhoz, amely csak azonosítókat szeretne, a `?links=id` megszünteti a címkék feloldását — és ugyanennyi SQL oda-vissza kérést.',
  Relations: 'Kapcsolatok',
  'Aucune relation visible dans cette base.': 'Nincs látható kapcsolat ebben az adatbázisban.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'A kapcsolatok **valódi PostgreSQL idegen kulcsok**. Az adatbázis ellenőrzi őket, nem az alkalmazás: egy közvetlen SQL `INSERT` ugyanazoknak a szabályoknak van alávetve.',
  'Codes de réponse': 'Válaszkódok',
  Statut: 'Állapot',
  Signification: 'Jelentés',
  'Succès.': 'Sikeres.',
  'Ligne créée.': 'Sor létrehozva.',
  'Suppression réussie, sans contenu.': 'Sikeres törlés, tartalom nélkül.',
  'Authentification absente ou refusée.': 'Hiányzó vagy elutasított hitelesítés.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Nem létező **vagy** láthatatlan erőforrás — a két válasz azonos.',
  'Suppression refusée : la ligne est encore référencée.':
    'Törlés elutasítva: a sorra még mindig hivatkoznak.',
  'Valeur refusée par la validation.': 'A validáció elutasította az értéket.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Egy hiba mindig ilyen alakú, és a `request_id` az, amit meg kell adni az ügyfélszolgálatnak:',
  'La liste complète des codes est servie par {route}.':
    'A kódok teljes listáját a {route} szolgáltatja.',
  'Côté MCP': 'MCP oldalon',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Egy elutasítás `isError` jelzésű eszközeredményként érkezik, amelynek szövege egy stabil JSON-objektum: ugyanaz a `code`, mint az API-ban, egy rögzített mondat, és egy `hint`, amely megmondja, hogyan kell javítani a hívást. A `retryable` megmondja, érdemes-e változatlanul újra megpróbálni.',
  'Écrire en SQL direct': 'Írás közvetlenül SQL-ben',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Nyissa meg a `psql`-t: ez működik, ez a termék célja.',
  'Ce qui vous attend :': 'Amire számítania kell:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'A megkötések érvényesek — kötelezőség, hossz, idegen kulcs. Egy hivatkozott sor nem törölhető.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'A rendszeroszlopok nem töltődnek ki maguktól egy kézi `INSERT` esetén: az `_id`, a `_created_at` és az `_updated_at` alapértelmezett értékekkel rendelkezik, az `_created_by` és az `_updated_by` pedig egy felhasználói azonosítót vár.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**A basedb jogosultságai nem érvényesek közvetlen SQL-ben.** Ezek a termék felületeit szabályozzák — API, felhasználói felület, MCP. Egy PostgreSQL-kapcsolat mindent lát, amit a szerepköre lát. Ez azért van itt leírva, mert az ellenkezőjét ígérni rosszabb lenne, mint semmit sem ígérni.',
  '{base} — documentation API et MCP': '{base} — API- és MCP-dokumentáció',
}

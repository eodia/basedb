import type { Catalog } from './catalog.js'

/** The API and MCP documentation in German: the French sentence of `documentation.ts` → its translation. */
export const de: Catalog = {
  'Prise en main': 'Erste Schritte',
  'API REST': 'REST-API',
  'Agents (MCP)': 'Agenten (MCP)',
  Tables: 'Tabellen',
  Référence: 'Referenz',
  texte: 'Text',
  'texte long': 'Langtext',
  'nombre (chaîne décimale)': 'Zahl (Dezimalzeichenkette)',
  booléen: 'Boolesch',
  'date (`2026-09-18`)': 'Datum (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'UTC-Datum/Uhrzeit (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'Einfachauswahl',
  'choix multiple (liste de valeurs)': 'Mehrfachauswahl (Liste von Werten)',
  'relation (`_id` de la ligne liée)': 'Verknüpfung (`_id` der verknüpften Zeile)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'Mehrfachverknüpfung (Liste der `_id` der verknüpften Zeilen, in ihrer Reihenfolge)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL (`https://…` oder `mailto:…`)',
  'adresse e-mail': 'E-Mail-Adresse',
  'numéro automatique (lecture seule)': 'Autonummer (schreibgeschützt)',
  'personne (`id` d’un membre de l’espace)': 'Person (`id` eines Mitglieds des Arbeitsbereichs)',
  formule: 'Formel',
  'documents (liste de fichiers)': 'Dokumente (Liste von Dateien)',
  'images (liste de fichiers)': 'Bilder (Liste von Dateien)',
  'colonne système': 'Systemspalte',
  'Un texte plus long.': 'Ein längerer Text.',
  valeur: 'Wert',
  Exemple: 'Beispiel',
  résultat: 'Ergebnis',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'angebot.pdf',
  Exemples: 'Beispiele',
  'Lister les lignes': 'Zeilen auflisten',
  Réponse: 'Antwort',
  'Créer une ligne': 'Zeile erstellen',
  'Déposer un fichier': 'Datei hochladen',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Der Body ist die Datei selbst. Die Antwort liefert eine `id`, die anschließend in {field} zu schreiben ist: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Die Identität des Tokens: wer es angelegt hat, seine Datenbank, seine tatsächlichen Berechtigungen und seine Budgets.',
  'Les bases que le jeton peut lire.': 'Die Datenbanken, die das Token lesen kann.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Die Tabellen einer Datenbank und der Graph ihrer Verknüpfungen.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Die Felder einer Tabelle: Typ, Pflichtstatus, Optionen, Verknüpfungen und welche davon änderbar sind.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Zeilen lesen: Filter, Sortierung, Paginierung per Cursor.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Eine Zeile anhand ihrer `_id` lesen, Langtexte vollständig, wenn dies angefordert wird.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Die `_id` einer Zeile anhand ihres Anzeigewerts finden, bevor eine Verknüpfung geschrieben wird.',
  'Créer une ligne.': 'Eine Zeile erstellen.',
  'Modifier les champs nommés d’une ligne.': 'Die benannten Felder einer Zeile ändern.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Eine Tabelle und ihre ersten Felder vorschlagen — eine Person entscheidet.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Ein Feld, eine Einfachauswahl oder eine Verknüpfung vorschlagen — eine Person entscheidet.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Einen Vorschlag des Tokens nachlesen und erfahren, was daraus geworden ist.',
  'dépôt basedb': 'basedb-Repository',
  'Depuis un agent (MCP)': 'Von einem Agenten (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Diese Datenbank ist nicht für Agenten geöffnet: Kein MCP-Werkzeug sieht diese Tabelle, unabhängig vom Token.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Ihre Felder kennen und welche davon änderbar sind',
  'Lire ses lignes — filtre, tri, pagination':
    'Ihre Zeilen lesen — Filter, Sortierung, Paginierung',
  'Lire une ligne par son `_id`': 'Eine Zeile anhand ihrer `_id` lesen',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Eine Zeile anhand ihres Anzeigewerts finden, {field}',
  'Modifier une ligne': 'Eine Zeile ändern',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Für diese Tabelle steht Ihnen kein Werkzeug zur Verfügung.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Ein Token, das Sie anlegen, hat nie mehr Berechtigungen als Sie: Diese Werkzeuge sind ein Maximum.',
  Outil: 'Werkzeug',
  Pour: 'Zweck',
  'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.':
    'Das Löschen einer Zeile bleibt der REST-API und der Oberfläche vorbehalten: Kein MCP-Werkzeug löscht.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Für einen Agenten unsichtbar:** {fields}. Für ihn existieren diese Spalten nicht: Er kann sie weder lesen noch filtern noch schreiben.',
  'Arguments d’un appel': 'Argumente eines Aufrufs',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Ein Token für diese Datenbank zu erstellen erfordert die Stufe **Verwalten**, die Sie nicht haben. Bitten Sie die Person, die sie verwaltet, um eines.',
  '<jeton>': '<Token>',
  'Connecter un agent': 'Einen Agenten anbinden',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.':
    'Der **MCP-Server** von basedb öffnet diese Datenbank für einen KI-Agenten — Claude oder einen beliebigen MCP-Client: Er entdeckt sie, liest sie und legt, wenn Sie es entscheiden, Zeilen darin an und ändert sie. Er unterliegt denselben Berechtigungen wie die REST-API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Diese Datenbank ist nicht für Agenten geöffnet.** Solange dies so ist, sieht sie kein Werkzeug, unabhängig vom vorgelegten Token.',
  'Créer un jeton': 'Token erstellen',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'In der Oberfläche, Menü „⋯“ der Datenbank → **API und Agenten** → **API- und MCP-Token …**, Zugriff **MCP** angehakt. Das Token ist auf diese Datenbank beschränkt, standardmäßig **schreibgeschützt**: Das Schreiben wird ausdrücklich gewählt. Es wird nur einmal angezeigt und lässt sich vom selben Bildschirm aus widerrufen. Auch für die **REST-API** angehakt, dient dasselbe Token einem Programm (siehe „Authentifizierung“).',
  'Garder le jeton hors de la configuration': 'Das Token aus der Konfiguration heraushalten',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Das Token wird in der Umgebungsvariable `BASEDB_TOKEN` abgelegt, niemals in der Konfigurationsdatei des Clients: Diese ist versioniert, synchronisiert und für alle Programme der Sitzung lesbar.',
  'Déclarer le serveur dans le client': 'Den Server im Client eintragen',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'Der Client startet das **Relay** `relay.js`, das seine Nachrichten bis zum Server transportiert. Es liest das Token aus der Variable, die `--token-env` nennt — `BASEDB_MCP_TOKEN`, wenn nichts angegeben ist — und die Adresse des Servers aus `--url` (oder `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Anderer MCP-Client',
  'votre-instance': 'ihre-instanz',
  'Sans relais': 'Ohne Relay',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Ein Client, der MCP über HTTP spricht, wendet sich direkt an die Adresse des Servers, `…/mcp`, mit dem Header {header}. Ein Token wird nur für die bei seiner Erstellung angehakten Zugriffe akzeptiert: Ein reines „MCP“-Token wird von der REST-API abgelehnt, und umgekehrt.',
  Vérifier: 'Prüfen',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Bitten Sie den Agenten, `whoami` aufzurufen: Es liefert die Person, die das Token angelegt hat, die Datenbank, für die es gilt, und seine tatsächlichen Berechtigungen.',
  Outils: 'Werkzeuge',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} Werkzeuge, immer dieselben: Ihr Name und ihre Beschreibung hängen nie von Ihren Daten ab. Das Schema wird durch ihren Aufruf entdeckt.',
  Rôle: 'Rolle',
  Écrit: 'Schreibt',
  oui: 'ja',
  propose: 'schlägt vor',
  non: 'nein',
  'Enchaînement type': 'Typischer Ablauf',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, dann `describe_base`: was existiert.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` vor jedem Lesen oder Schreiben: die Felder, ihre Typen und die, die das Token schreiben kann (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` mit `filter`, `sort` und `limit`; mit `cursor` fortfahren, solange `has_more` `true` ist.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Um eine Verknüpfung zu schreiben: `lookup_records` auf der Zieltabelle, dann `create_record` oder `update_record` mit der gefundenen `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Um die Struktur weiterzuentwickeln: `propose_create_table` oder `propose_add_field`, dann `get_proposal`, um die Entscheidung zu verfolgen.',
  'Propositions de structure': 'Strukturvorschläge',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Ein Agent ändert die Struktur nie selbst: Er **schlägt vor**. Der Vorschlag wartet in der Warteschlange „Vorschläge“ der Datenbank, wo eine Person, die die Struktur ändern kann, ihn genehmigt oder ablehnt; ohne Entscheidung läuft er nach 24 Stunden ab. Genehmigt, wird er im Namen der Person angewendet, die das Token angelegt hat — sofern diese Person noch dazu berechtigt ist — und erscheint im Verlauf wie jede andere Änderung.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Höchstens 5 ausstehende Vorschläge pro Token; ein neuer Vorschlag zum selben Objekt ersetzt den vorherigen (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Kein Löschen, kein Umbenennen, keine Verknüpfung mit Kaskade (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Was es nicht gibt',
  'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Kein Werkzeug löscht eine Zeile, führt SQL aus oder verwaltet Berechtigungen oder Token. Ein Agent, der einen solchen Namen aufruft — `delete_record`, `run_sql`… — erhält `MCP_OPERATION_EXCLUDED`, unabhängig von der betroffenen Datenbank.',
  Bornes: 'Grenzwerte',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: standardmäßig 25 Zeilen, höchstens 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Ein Filter zählt höchstens 10 Prädikate, verknüpft mit UND; eine Sortierung höchstens 3 Felder.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'In einer Liste wird ein Text mit mehr als 500 Zeichen gekürzt und in `_truncated_fields` genannt; `get_record` mit `full_fields` liefert ihn vollständig.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Ein Schreibvorgang akzeptiert einen `idempotency_key`: Ihn erneut auszuführen erzeugt kein Duplikat.',
  'Ce que voit un agent': 'Was ein Agent sieht',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Ein Agent sieht nie mehr als die Person, die sein Token angelegt hat — und oft weniger.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Berechtigungen**: die des Tokens, bei jedem Aufruf mit denen seines Erstellers abgeglichen. Sinken die Berechtigungen dieser Person, sinken die des Tokens mit ihnen; wird ihr Konto deaktiviert, antwortet das Token nicht mehr.',
  '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Lesen, Anlegen, Ändern** — nie Löschen. Ein schreibgeschütztes Token verweigert jedes Schreiben (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Diese Datenbank**: für Agenten geöffnet.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Diese Datenbank**: **für Agenten gesperrt** — kein Werkzeug sieht sie.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Nur für Menschen bestimmte Spalten**: keine in dem, was Sie von dieser Datenbank sehen.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Nur für Menschen bestimmte Spalten**: {columns}. Für einen Agenten existieren sie nicht.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Daten, keine Anweisungen**: Beschreibungen und Inhalte werden als von Nutzern eingegebene Daten dargestellt, und die Werkzeuge sagen dies dem Agenten.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Protokoll**: Jeder Aufruf wird anhand der Form seiner Parameter protokolliert, nie anhand ihrer Werte.',
  obligatoire: 'erforderlich',
  'calculé par l’IA': 'von der KI berechnet',
  'lecture seule': 'schreibgeschützt',
  'HTML riche — **à assainir à l’affichage**':
    'Formatiertes HTML — **vor der Anzeige zu bereinigen**',
  'invisible pour les agents': 'für Agenten unsichtbar',
  'relation → {table}': 'Verknüpfung → {table}',
  'Valeurs : {values}.': 'Werte: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'Ziel für Sie nicht sichtbar: Die Zelle ist immer {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'zeigt auf {table} (keine Anzeigespalte festgelegt: Die Zelle zeigt die Kennung)',
  'pointe vers {table}, affiché par {field}': 'zeigt auf {table}, angezeigt durch {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'beim Löschen: Das Löschen der Zielzeile wird verweigert, solange sie referenziert wird',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'beim Löschen: Das Löschen der Zielzeile leert diese Zelle',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'beim Löschen: Das Löschen der Zielzeile löscht auch diese Zeile',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'beim Schreiben akzeptieren Sie ein reines `uuid`, `null` oder `{"id": "…"}`; beim Lesen immer `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Zeilen auflisten — Filter, Sortierung, Paginierung per Cursor',
  'Lire une ligne': 'Eine Zeile lesen',
  'Supprimer une ligne': 'Eine Zeile löschen',
  'Lister les lignes qui pointent vers celle-ci': 'Die Zeilen auflisten, die auf diese verweisen',
  Méthode: 'Methode',
  Chemin: 'Pfad',
  lire: 'lesen',
  créer: 'erstellen',
  modifier: 'ändern',
  supprimer: 'löschen',
  '**En SQL :** {sql}': '**In SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Sie können {verbs}. Verben, die in dieser Liste fehlen, stehen Ihnen nicht offen, und die entsprechenden Pfade werden nicht beschrieben.',
  'Points d’accès': 'Endpunkte',
  Colonnes: 'Spalten',
  Colonne: 'Spalte',
  Libellé: 'Bezeichnung',
  Type: 'Typ',
  Description: 'Beschreibung',
  'Champs relation': 'Verknüpfungsfelder',
  'Colonnes système': 'Systemspalten',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Immer lesbar, nie beschreibbar. Sie tragen die Paginierung per Cursor und die inkrementelle Fortsetzung, und keine Einstellung blendet sie aus.',
  Expansion: 'Expansion',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — Tiefe 1 ohne Ausnahme. Die verknüpften Objekte kommen in `included` an, indexiert nach Tabellenname und dann nach Kennung, nicht in die Zeile eingebettet: 100 Zeilen, die auf 3 Ziele zeigen, transportieren 3 Objekte.',
  'Lignes référençantes': 'Referenzierende Zeilen',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} listet die Zeilen auf, die auf eine bestimmte Zeile zeigen. Ein Block, dessen Quelltabelle für Sie nicht sichtbar ist, erscheint dort überhaupt nicht — weder Block noch Zähler noch Erwähnung.',
  'une table que vous ne voyez pas': 'eine Tabelle, die Sie nicht sehen',
  'Vue d’ensemble': 'Übersicht',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Diese Datenbank heißt {name} — das ist der Name des **PostgreSQL-Schemas** und derjenige, den Sie in Ihren URLs wie in Werkzeugaufrufen schreiben. Die Tabellen und Spalten tragen hier und in SQL dieselben Namen: Es gibt keine Zuordnungstabelle, die Sie nachschlagen müssten.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Zwei Zugänge, dieselben Berechtigungen: die **REST-API** für Ihre Programme, der **MCP-Server** für KI-Agenten. Jede Tabellenseite sagt, wie sie über den einen wie über den anderen zu erreichen ist.',
  Élément: 'Element',
  Valeur: 'Wert',
  'Schéma PostgreSQL': 'PostgreSQL-Schema',
  'Préfixe des routes REST': 'Präfix der REST-Routen',
  'ouverte — voir « Connecter un agent »': 'geöffnet — siehe „Einen Agenten anbinden“',
  '**fermée aux agents**': '**für Agenten gesperrt**',
  'Tables visibles': 'Sichtbare Tabellen',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, in einer Hülle {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Diese Dokumentation beschreibt, was SIE sehen können.** Zwei Lesende erhalten zwei unterschiedliche Fassungen, und das ist die Regel, kein Nebeneffekt. Veröffentlichen Sie sie nicht unverändert.',
  Authentification: 'Authentifizierung',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Alle Datenrouten erfordern ein **Token** im Header `Authorization`. Das Sitzungscookie wird hier nie akzeptiert: Ein Browser sendet es bei jeder Anfrage, auch bei denen, die eine fremde Seite auslöst.',
  'Jeton d’intégration': 'Integrations-Token',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Ein Programm — Skript, Synchronisierung, andere Anwendung — legt ein **Integrations-Token** vor, das mit `bdb_` beginnt. Es gilt nur für diese Datenbank; es liest sowie legt an und ändert, wenn es mit Schreibrecht angelegt wurde, aber **löscht nie**; und es hat nie mehr Berechtigungen als die Person, die es angelegt hat, bei jedem Aufruf abgeglichen. Die Administration, die SQL-Konsole und die KI bleiben ihm verschlossen.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Um eines zu erstellen: Menü „⋯“ der Datenbank → **API und Agenten** → **API- und MCP-Token …**, Zugriff **REST-API** angehakt. Es wird nur einmal angezeigt.',
  Appel: 'Aufruf',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Eine fehlende Authentifizierung antwortet mit `401`, nie mit `404`: Sie müssen sich erneut anmelden können.',
  Conventions: 'Konventionen',
  Enveloppe: 'Hülle',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Alle Antworten haben dieselbe Form: {envelope}. Ein Fehler ersetzt `data` durch den Code, die Details und die Kennung der Anfrage.',
  Nombres: 'Zahlen',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Zahlen sind Dezimalzeichenketten**, ohne Ausnahme: {example}. Eine Gleitkommazahl würde einen Betrag stillschweigend runden.',
  montant: 'betrag',
  'Ressource invisible': 'Unsichtbare Ressource',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Eine unsichtbare Ressource und eine nicht existierende Ressource antworten identisch**, Byte für Byte. Ein `404` sagt Ihnen nie, ob das Objekt existiert.',
  Pagination: 'Paginierung',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginierung per Cursor**: Folgen Sie `meta.has_next_page` und übergeben Sie `after`. Es gibt keine Exportroute.',
  'Identifiants seuls': 'Nur Kennungen',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Für eine Integration, die nur Kennungen möchte, unterdrückt `?links=id` die Auflösung der Bezeichnungen — und ebenso viele SQL-Umläufe.',
  Relations: 'Verknüpfungen',
  'Aucune relation visible dans cette base.': 'Keine sichtbare Verknüpfung in dieser Datenbank.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Die Verknüpfungen sind **echte PostgreSQL-Fremdschlüssel**. Sie werden von der Datenbank geprüft, nicht von der Anwendung: Ein `INSERT` in direktem SQL unterliegt denselben Regeln.',
  'Codes de réponse': 'Antwortcodes',
  Statut: 'Status',
  Signification: 'Bedeutung',
  'Succès.': 'Erfolg.',
  'Ligne créée.': 'Zeile erstellt.',
  'Suppression réussie, sans contenu.': 'Löschen erfolgreich, ohne Inhalt.',
  'Authentification absente ou refusée.': 'Authentifizierung fehlt oder wurde abgelehnt.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Ressource existiert nicht **oder** ist unsichtbar — beide Antworten sind identisch.',
  'Suppression refusée : la ligne est encore référencée.':
    'Löschen abgelehnt: Die Zeile wird noch referenziert.',
  'Valeur refusée par la validation.': 'Wert von der Validierung abgelehnt.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Ein Fehler hat immer diese Form, und `request_id` ist das, was dem Support zu nennen ist:',
  'La liste complète des codes est servie par {route}.':
    'Die vollständige Liste der Codes wird von {route} bereitgestellt.',
  'Côté MCP': 'MCP-Seite',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Eine Ablehnung kommt als Werkzeugergebnis mit der Markierung `isError`, dessen Text ein stabiles JSON-Objekt ist: derselbe `code` wie die API, ein fester Satz und ein `hint`, der sagt, wie der Aufruf zu korrigieren ist. `retryable` sagt, ob es sich lohnt, es unverändert erneut zu versuchen.',
  'Écrire en SQL direct': 'Direkt in SQL schreiben',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Öffnen Sie `psql`: Es funktioniert, das ist der Zweck des Produkts.',
  'Ce qui vous attend :': 'Was Sie erwartet:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Die Constraints gelten — Pflichtfeld, Länge, Fremdschlüssel. Eine referenzierte Zeile lässt sich nicht löschen.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Die Systemspalten füllen sich bei einem manuellen `INSERT` nicht von selbst: `_id`, `_created_at` und `_updated_at` haben Standardwerte, `_created_by` und `_updated_by` erwarten eine Benutzerkennung.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**Die Berechtigungen von basedb gelten nicht in direktem SQL.** Sie regeln die Oberflächen des Produkts — API, Oberfläche, MCP. Eine PostgreSQL-Verbindung sieht alles, was ihre Rolle sieht. Dies wird hier gesagt, weil das Gegenteil zu versprechen schlimmer wäre, als nichts zu versprechen.',
  '{base} — documentation API et MCP': '{base} — API- und MCP-Dokumentation',
}

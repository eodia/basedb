import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Romanian: the French sentence of `documentation.ts` → its translation. */
export const ro: Catalog = {
  'Prise en main': 'Primii pași',
  'API REST': 'API REST',
  'Agents (MCP)': 'Agenți (MCP)',
  Tables: 'Tabele',
  Référence: 'Referință',
  texte: 'text',
  'texte long': 'text lung',
  'nombre (chaîne décimale)': 'număr (șir zecimal)',
  booléen: 'boolean',
  'date (`2026-09-18`)': 'dată (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'dată-oră UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'selecție unică',
  'choix multiple (liste de valeurs)': 'selecție multiplă (listă de valori)',
  'relation (`_id` de la ligne liée)': 'relație (`_id`-ul rândului asociat)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'relație multiplă (listă cu `_id`-urile rândurilor asociate, în ordinea lor)',
  'lien URL (`https://…` ou `mailto:…`)': 'link URL (`https://…` sau `mailto:…`)',
  'adresse e-mail': 'adresă de e-mail',
  'numéro automatique (lecture seule)': 'număr automat (doar în citire)',
  'personne (`id` d’un membre de l’espace)': 'persoană (`id`-ul unui membru al spațiului de lucru)',
  formule: 'formulă',
  'documents (liste de fichiers)': 'documente (listă de fișiere)',
  'images (liste de fichiers)': 'imagini (listă de fișiere)',
  'colonne système': 'coloană de sistem',
  'Un texte plus long.': 'Un text mai lung.',
  valeur: 'valoare',
  Exemple: 'Exemplu',
  résultat: 'rezultat',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'deviz.pdf',
  Exemples: 'Exemple',
  'Lister les lignes': 'Listarea rândurilor',
  Réponse: 'Răspuns',
  'Créer une ligne': 'Crearea unui rând',
  'Déposer un fichier': 'Depunerea unui fișier',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Corpul este chiar fișierul. Răspunsul oferă un `id`, care se scrie apoi în {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Identitatea tokenului: cine l-a creat, baza sa, permisiunile sale efective și bugetele sale.',
  'Les bases que le jeton peut lire.': 'Bazele pe care tokenul le poate citi.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Tabelele unei baze și graful relațiilor lor.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Câmpurile unui tabel: tip, obligativitate, opțiuni, relații și care dintre ele sunt modificabile.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Citirea rândurilor: filtrare, sortare, paginare prin cursor.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Citirea unui rând după `_id`-ul său, cu textele lungi în întregime dacă se cere.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Găsirea `_id`-ului unui rând după valoarea sa de afișare, înainte de a scrie o relație.',
  'Créer une ligne.': 'Crearea unui rând.',
  'Modifier les champs nommés d’une ligne.': 'Modificarea câmpurilor numite ale unui rând.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Ștergerea unui rând, cu un token creat pentru ștergere — răspunsul îl redă.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Readucerea unui rând șters, sub `_id`-ul său, din istoric.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Propunerea unui tabel și a primelor sale câmpuri — o persoană decide.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Propunerea unui câmp, a unei selecții unice sau a unei relații — o persoană decide.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Recitirea unei propuneri a tokenului și aflarea rezultatului ei.',
  'dépôt basedb': 'depozit basedb',
  'Depuis un agent (MCP)': 'De la un agent (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Această bază nu este deschisă agenților: niciun instrument MCP nu vede acest tabel, indiferent de token.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Cunoașterea câmpurilor sale și a celor care sunt modificabile',
  'Lire ses lignes — filtre, tri, pagination':
    'Citirea rândurilor sale — filtrare, sortare, paginare',
  'Lire une ligne par son `_id`': 'Citirea unui rând după `_id`-ul său',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Găsirea unui rând după valoarea sa de afișare, {field}',
  'Modifier une ligne': 'Modificarea unui rând',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Ștergerea unui rând — cu un token creat pentru ștergere',
  'Ramener une ligne supprimée': 'Readucerea unui rând șters',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Niciun instrument nu vă este deschis pe acest tabel.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Un token pe care îl creați nu are niciodată mai multe permisiuni decât dumneavoastră: aceste instrumente sunt un maxim.',
  Outil: 'Instrument',
  Pour: 'Scop',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Un agent nu șterge decât cu un token creat „Citire, scriere și ștergere”, câte un rând; rândul șters se restaurează prin `restore_record` sau din istoric.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Invizibile pentru un agent:** {fields}. Pentru el, aceste coloane nu există: nu le poate nici citi, nici filtra, nici scrie.',
  'Arguments d’un appel': 'Argumentele unui apel',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Crearea unui token pentru această bază necesită nivelul **Gestionare**, pe care nu îl aveți. Solicitați unul persoanei care o gestionează.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Conectarea unui agent',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    '**Serverul MCP** al basedb deschide această bază unui agent AI — Claude sau orice client MCP: acesta o descoperă, o citește și, dacă decideți astfel, creează, modifică și șterge rânduri în ea. Trece prin aceleași permisiuni ca API REST.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Această bază nu este deschisă agenților.** Cât timp nu este, niciun instrument nu o vede, indiferent de tokenul prezentat.',
  'Créer un jeton': 'Crearea unui token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'În interfață, meniul „⋯” al bazei → **API și agenți** → **Tokenuri API și MCP…**, cu accesul **MCP** bifat. Tokenul este limitat la această bază, **doar în citire** în mod implicit: scrierea, și ștergerea, se aleg explicit. Este afișat o singură dată și se revocă din același ecran. Bifat și pentru **API REST**, același token servește pentru un program (vezi „Autentificare”).',
  'Garder le jeton hors de la configuration': 'Păstrarea tokenului în afara configurației',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Tokenul se pune în variabila de mediu `BASEDB_TOKEN`, niciodată în fișierul de configurare al clientului: acesta este versionat, sincronizat și lizibil de toate programele sesiunii.',
  'Déclarer le serveur dans le client': 'Declararea serverului în client',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'Clientul lansează **releul** `relay.js`, care transportă mesajele sale până la server. Acesta citește tokenul din variabila numită de `--token-env` — `BASEDB_MCP_TOKEN` dacă nu se specifică nimic — și adresa serverului din `--url` (sau `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Alt client MCP',
  'votre-instance': 'instanta-dvs',
  'Sans relais': 'Fără releu',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Un client care vorbește MCP prin HTTP vizează direct adresa serverului, `…/mcp`, cu antetul {header}. Un token este acceptat doar pe accesurile bifate la crearea sa: un token doar „MCP” este refuzat de API REST, și invers.',
  Vérifier: 'Verificarea',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Cereți agentului să apeleze `whoami`: acesta returnează persoana care a creat tokenul, baza aflată în domeniul său și permisiunile sale efective.',
  Outils: 'Instrumente',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} instrumente, mereu aceleași: numele și descrierea lor nu depind niciodată de datele dumneavoastră. Schema se descoperă apelându-le.',
  Rôle: 'Rol',
  Écrit: 'Scrie?',
  oui: 'da',
  propose: 'propune',
  non: 'nu',
  'Enchaînement type': 'Înlănțuirea tipică',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, apoi `describe_base`: ce există.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` înaintea oricărei citiri sau scrieri: câmpurile, tipurile lor și cele pe care tokenul le poate scrie (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` cu `filter`, `sort` și `limit`; continuați cu `cursor` cât timp `has_more` are valoarea `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Pentru a scrie o relație: `lookup_records` pe tabelul țintă, apoi `create_record` sau `update_record` cu `_id`-ul găsit.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Pentru a modifica structura: `propose_create_table` sau `propose_add_field`, apoi `get_proposal` pentru a urmări decizia.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Pentru a șterge: `get_record` întâi, pentru a fi sigur de rând, apoi `delete_record` — care îl redă în răspunsul său; `restore_record` îl readuce.',
  'Propositions de structure': 'Propuneri de structură',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Un agent nu modifică niciodată singur structura: el **propune**. Propunerea așteaptă în coada „Propuneri” a bazei, unde o persoană care poate modifica structura o aprobă sau o refuză; fără decizie, expiră după 24 de ore. Aprobată, este aplicată în numele persoanei care a creat tokenul — dacă această persoană mai are dreptul să o facă — și apare în istoric ca orice altă modificare.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Cel mult 5 propuneri în așteptare per token; o propunere nouă pe același obiect o înlocuiește pe cea precedentă (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Nicio ștergere, nicio redenumire, nicio relație în cascadă (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Ce nu există',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Niciun instrument nu șterge mai multe rânduri deodată, un tabel sau un câmp, nu execută SQL și nu gestionează permisiunile sau tokenurile. Un agent care apelează un astfel de nume — `delete_records`, `run_sql`… — primește `MCP_OPERATION_EXCLUDED`, indiferent de baza vizată.',
  Bornes: 'Limite',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: 25 de rânduri în mod implicit, cel mult 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Un filtru conține cel mult 10 predicate, combinate prin ȘI; o sortare, cel mult 3 câmpuri.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'Într-o listă, un text de peste 500 de caractere este trunchiat și menționat în `_truncated_fields`; `get_record` cu `full_fields` îl redă întreg.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'O scriere acceptă o `idempotency_key`: reluarea ei nu creează un duplicat.',
  'Ce que voit un agent': 'Ce vede un agent',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Un agent nu vede niciodată mai mult decât persoana care i-a creat tokenul — și adesea mai puțin.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Permisiuni**: cele ale tokenului, verificate încrucișat la fiecare apel cu cele ale creatorului său. Dacă permisiunile acestei persoane scad, cele ale tokenului scad odată cu ele; dacă contul său este dezactivat, tokenul încetează să răspundă.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Citire, creare, modificare** — și ștergere, câte un rând, doar cu un token creat pentru aceasta. Un token doar în citire refuză orice scriere (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Această bază**: deschisă agenților.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Această bază**: **închisă agenților** — niciun instrument nu o vede.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Coloane rezervate oamenilor**: niciuna în ceea ce vedeți din această bază.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Coloane rezervate oamenilor**: {columns}. Pentru un agent, ele nu există.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Date, nu instrucțiuni**: descrierile și conținuturile sunt redate ca date introduse de utilizatori, iar instrumentele îi spun asta agentului.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Jurnal**: fiecare apel este înregistrat după forma parametrilor săi, niciodată după valorile lor.',
  obligatoire: 'obligatoriu',
  'calculé par l’IA': 'calculat de AI',
  'lecture seule': 'doar în citire',
  'HTML riche — **à assainir à l’affichage**': 'HTML formatat — **de sanitizat la afișare**',
  'invisible pour les agents': 'invizibil pentru agenți',
  'relation → {table}': 'relație → {table}',
  'Valeurs : {values}.': 'Valori: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'țintă nevizibilă pentru dumneavoastră: celula are întotdeauna valoarea {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'indică spre {table} (nicio coloană de afișare desemnată: celula arată identificatorul)',
  'pointe vers {table}, affiché par {field}': 'indică spre {table}, afișat prin {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'la ștergere: ștergerea rândului țintă este refuzată cât timp este referențiat',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'la ștergere: ștergerea rândului țintă golește această celulă',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'la ștergere: ștergerea rândului țintă șterge și acest rând',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'la scriere, acceptați un `uuid` simplu, `null`, sau `{"id": "…"}`; la citire, întotdeauna `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Listarea rândurilor — filtrare, sortare, paginare prin cursor',
  'Lire une ligne': 'Citirea unui rând',
  'Supprimer une ligne': 'Ștergerea unui rând',
  'Lister les lignes qui pointent vers celle-ci': 'Listarea rândurilor care indică spre acesta',
  Méthode: 'Metodă',
  Chemin: 'Cale',
  lire: 'citi',
  créer: 'crea',
  modifier: 'modifica',
  supprimer: 'șterge',
  '**En SQL :** {sql}': '**În SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Puteți {verbs}. Verbele absente din această listă nu vă sunt deschise, iar căile corespunzătoare nu sunt descrise.',
  'Points d’accès': 'Puncte de acces',
  Colonnes: 'Coloane',
  Colonne: 'Coloană',
  Libellé: 'Etichetă',
  Type: 'Tip',
  Description: 'Descriere',
  'Champs relation': 'Câmpuri de relație',
  'Colonnes système': 'Coloane de sistem',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Întotdeauna lizibile, niciodată inscriptibile. Ele susțin paginarea prin cursor și reluarea incrementală, iar nicio setare nu le ascunde.',
  Expansion: 'Expansiune',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — adâncime 1 fără excepție. Obiectele asociate ajung în `included`, indexate după numele tabelului și apoi după identificator, și nu sunt imbricate în rând: 100 de rânduri care indică spre 3 ținte transportă 3 obiecte.',
  'Lignes référençantes': 'Rânduri care referențiază',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} listează rândurile care indică spre un rând dat. Un bloc al cărui tabel sursă nu vă este vizibil nu apare deloc acolo — nici bloc, nici contor, nici mențiune.',
  'une table que vous ne voyez pas': 'un tabel pe care nu îl vedeți',
  'Vue d’ensemble': 'Prezentare generală',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Această bază se numește {name} — acesta este numele **schemei PostgreSQL**, și cel pe care îl scrieți în URL-urile dumneavoastră ca și în apelurile instrumentelor. Tabelele și coloanele poartă aceleași nume aici și în SQL: nu există niciun tabel de corespondență de consultat.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Două accesuri, aceleași permisiuni: **API REST** pentru programele dumneavoastră, **serverul MCP** pentru agenții AI. Fiecare pagină de tabel spune cum poate fi atins prin unul sau prin celălalt.',
  Élément: 'Element',
  Valeur: 'Valoare',
  'Schéma PostgreSQL': 'Schemă PostgreSQL',
  'Préfixe des routes REST': 'Prefixul rutelor REST',
  'ouverte — voir « Connecter un agent »': 'deschisă — vezi „Conectarea unui agent”',
  '**fermée aux agents**': '**închisă agenților**',
  'Tables visibles': 'Tabele vizibile',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, într-un înveliș {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Această documentație descrie ce PUTEȚI vedea DUMNEAVOASTRĂ.** Doi cititori obțin două versiuni diferite, iar aceasta este regula, nu un efect secundar. Nu o publicați așa cum este.',
  Authentification: 'Autentificare',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Toate rutele de date necesită un **token**, în antetul `Authorization`. Cookie-ul de sesiune nu este niciodată acceptat aici: un browser îl trimite la fiecare cerere, inclusiv cele provocate de o pagină străină.',
  'Jeton d’intégration': 'Token de integrare',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Un program — script, sincronizare, altă aplicație — prezintă un **token de integrare**, care începe cu `bdb_`. Este valabil doar pentru această bază; citește, creează și modifică dacă a fost creat cu drept de scriere, și **nu șterge decât dacă a fost creat pentru aceasta**; nu are niciodată mai multe permisiuni decât persoana care l-a creat, verificate încrucișat la fiecare apel. Administrarea, consola SQL și AI-ul îi rămân închise.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Pentru a crea unul: meniul „⋯” al bazei → **API și agenți** → **Tokenuri API și MCP…**, cu accesul **API REST** bifat. Este afișat o singură dată.',
  Appel: 'Apel',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'O autentificare absentă răspunde `401`, niciodată `404`: trebuie să vă puteți reconecta.',
  Conventions: 'Convenții',
  Enveloppe: 'Înveliș',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Toate răspunsurile au aceeași formă: {envelope}. O eroare înlocuiește `data` cu codul, detaliile și identificatorul cererii.',
  Nombres: 'Numere',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Numerele sunt șiruri zecimale**, fără excepție: {example}. Un număr în virgulă mobilă ar rotunji silențios o sumă.',
  montant: 'suma',
  'Ressource invisible': 'Resursă invizibilă',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**O resursă invizibilă și o resursă inexistentă răspund identic**, octet cu octet. Un `404` nu vă spune niciodată dacă obiectul există.',
  Pagination: 'Paginare',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginare prin cursor**: urmăriți `meta.has_next_page` și transmiteți `after`. Nu există nicio rută de export.',
  'Identifiants seuls': 'Doar identificatori',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Pentru o integrare care dorește doar identificatori, `?links=id` elimină rezolvarea etichetelor — și tot atâtea interogări SQL suplimentare.',
  Relations: 'Relații',
  'Aucune relation visible dans cette base.': 'Nicio relație vizibilă în această bază.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relațiile sunt **chei străine PostgreSQL reale**. Sunt verificate de bază, nu de aplicație: un `INSERT` în SQL direct este supus acelorași reguli.',
  'Codes de réponse': 'Coduri de răspuns',
  Statut: 'Status',
  Signification: 'Semnificație',
  'Succès.': 'Succes.',
  'Ligne créée.': 'Rând creat.',
  'Suppression réussie, sans contenu.': 'Ștergere reușită, fără conținut.',
  'Authentification absente ou refusée.': 'Autentificare absentă sau refuzată.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Resursă inexistentă **sau** invizibilă — cele două răspunsuri sunt identice.',
  'Suppression refusée : la ligne est encore référencée.':
    'Ștergere refuzată: rândul este încă referențiat.',
  'Valeur refusée par la validation.': 'Valoare refuzată de validare.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'O eroare are întotdeauna această formă, iar `request_id` este ceea ce trebuie citat la suport:',
  'La liste complète des codes est servie par {route}.':
    'Lista completă a codurilor este oferită de {route}.',
  'Côté MCP': 'Partea MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Un refuz sosește ca un rezultat de instrument marcat `isError`, al cărui text este un obiect JSON stabil: același `code` ca al API-ului, o frază fixă și un `hint` care spune cum se corectează apelul. `retryable` spune dacă merită reîncercat ca atare.',
  'Écrire en SQL direct': 'Scriere în SQL direct',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Deschideți `psql`: funcționează, acesta este scopul produsului.',
  'Ce qui vous attend :': 'Ce vă așteaptă:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Constrângerile se aplică — obligativitate, lungime, cheie străină. Un rând referențiat nu se șterge.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Coloanele de sistem nu se completează singure într-un `INSERT` manual: `_id`, `_created_at` și `_updated_at` au valori implicite, `_created_by` și `_updated_by` așteaptă un identificator de utilizator.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**Permisiunile basedb nu se aplică în SQL direct.** Ele guvernează suprafețele produsului — API, interfață, MCP. O conexiune PostgreSQL vede tot ce vede rolul său. Este spus aici pentru că a promite contrariul ar fi mai rău decât a nu promite nimic.',
  '{base} — documentation API et MCP': '{base} — documentație API și MCP',
}

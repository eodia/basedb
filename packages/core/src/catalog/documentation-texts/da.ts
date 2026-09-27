import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Danish: the French sentence of `documentation.ts` → its translation. */
export const da: Catalog = {
  'Prise en main': 'Kom godt i gang',
  'API REST': 'REST-API',
  'Agents (MCP)': 'Agenter (MCP)',
  Tables: 'Tabeller',
  Référence: 'Reference',
  texte: 'tekst',
  'texte long': 'lang tekst',
  'nombre (chaîne décimale)': 'tal (decimalstreng)',
  booléen: 'boolesk',
  'date (`2026-09-18`)': 'dato (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)':
    'dato og klokkeslæt UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'enkeltvalg',
  'choix multiple (liste de valeurs)': 'flervalg (liste af værdier)',
  'relation (`_id` de la ligne liée)': 'relation (`_id` for den relaterede række)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'multipel relation (liste af `_id` for de relaterede rækker, i deres rækkefølge)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL-link (`https://…` eller `mailto:…`)',
  'adresse e-mail': 'e-mailadresse',
  'numéro automatique (lecture seule)': 'autonummer (skrivebeskyttet)',
  'personne (`id` d’un membre de l’espace)': 'person (`id` for et medlem af arbejdsområdet)',
  formule: 'formel',
  'documents (liste de fichiers)': 'dokumenter (liste af filer)',
  'images (liste de fichiers)': 'billeder (liste af filer)',
  'colonne système': 'systemkolonne',
  'Un texte plus long.': 'En længere tekst.',
  valeur: 'værdi',
  Exemple: 'Eksempel',
  résultat: 'resultat',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'tilbud.pdf',
  Exemples: 'Eksempler',
  'Lister les lignes': 'List rækkerne',
  Réponse: 'Svar',
  'Créer une ligne': 'Opret en række',
  'Déposer un fichier': 'Upload en fil',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Selve kroppen er filen. Svaret giver et `id`, som derefter skal skrives i {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Tokenets identitet: hvem der har oprettet det, dets database, dets faktiske rettigheder og dets budgetter.',
  'Les bases que le jeton peut lire.': 'De databaser, som tokenet kan læse.',
  'Les tables d’une base et le graphe de leurs relations.':
    'En databases tabeller og grafen over deres relationer.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'En tabels felter: type, om de er påkrævede, valgmuligheder, relationer, og hvilke der kan redigeres.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Læse rækker: filter, sortering, paginering med cursor.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Læse en række via dens `_id`, med lange tekster i deres helhed, hvis det bliver bedt om.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Finde en rækkes `_id` ud fra dens visningsværdi, før en relation skrives.',
  'Créer une ligne.': 'Oprette en række.',
  'Modifier les champs nommés d’une ligne.': 'Redigere de navngivne felter i en række.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Foreslå en tabel og dens første felter — en person beslutter.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Foreslå et felt, et enkeltvalg eller en relation — en person beslutter.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Genlæse en af tokenets forslag og finde ud af, hvad der er blevet af den.',
  'dépôt basedb': 'basedb-repository',
  'Depuis un agent (MCP)': 'Fra en agent (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Denne database er ikke åben for agenter: intet MCP-værktøj kan se denne tabel, uanset hvilket token der bruges.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Kend dens felter, og hvilke der kan redigeres',
  'Lire ses lignes — filtre, tri, pagination': 'Læs dens rækker — filter, sortering, paginering',
  'Lire une ligne par son `_id`': 'Læs en række via dens `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Find en række ud fra dens visningsværdi, {field}',
  'Modifier une ligne': 'Rediger en række',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Intet værktøj er åbent for dig på denne tabel.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Et token, du opretter, har aldrig flere rettigheder end dig selv: disse værktøjer er et maksimum.',
  Outil: 'Værktøj',
  Pour: 'Formål',
  'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.':
    "At slette en række er fortsat forbeholdt REST-API'et og brugerfladen: intet MCP-værktøj sletter.",
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Usynlige for en agent:** {fields}. For agenten findes disse kolonner ikke: den kan hverken læse, filtrere eller skrive dem.',
  'Arguments d’un appel': 'Argumenter til et kald',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'At oprette et token til denne database kræver niveauet **Administrere**, som du ikke har. Bed den person, der administrerer den, om at oprette et.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Tilslut en agent',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.':
    "basedbs **MCP-server** åbner denne database for en AI-agent — Claude eller enhver MCP-klient: agenten opdager den, læser den og, hvis du beslutter det, opretter og redigerer rækker i den. Den bruger de samme tilladelser som REST-API'et.",
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Denne database er ikke åben for agenter.** Så længe det er tilfældet, kan intet værktøj se den, uanset hvilket token der bruges.',
  'Créer un jeton': 'Opret et token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'I brugerfladen, databasens »⋯«-menu → **API og agenter** → **API- og MCP-tokens…**, med adgangen **MCP** markeret. Tokenet er begrænset til denne database og er som standard **skrivebeskyttet**: skriveadgang skal vælges eksplicit. Det vises kun én gang og kan tilbagekaldes fra den samme skærm. Markeres også for **REST-API**, bruges det samme token til et program (se »Godkendelse«).',
  'Garder le jeton hors de la configuration': 'Hold tokenet uden for konfigurationen',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Tokenet placeres i miljøvariablen `BASEDB_TOKEN`, aldrig i klientens konfigurationsfil: den er versionsstyret, synkroniseret og læsbar for alle programmer i sessionen.',
  'Déclarer le serveur dans le client': 'Angiv serveren i klienten',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'Klienten starter **relæet** `relay.js`, som transporterer dens beskeder til serveren. Det læser tokenet fra den variabel, som `--token-env` angiver — `BASEDB_MCP_TOKEN`, hvis intet andet er angivet — og serverens adresse fra `--url` (eller `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Anden MCP-klient',
  'votre-instance': 'din-instans',
  'Sans relais': 'Uden relæ',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    "En klient, der taler MCP over HTTP, går direkte til serverens adresse, `…/mcp`, med headeren {header}. Et token accepteres kun for de adgange, der blev markeret ved oprettelsen: et token med kun »MCP« afvises af REST-API'et, og omvendt.",
  Vérifier: 'Kontrollér',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Bed agenten om at kalde `whoami`: den returnerer den person, der har oprettet tokenet, den database, det gælder for, og dets faktiske rettigheder.',
  Outils: 'Værktøjer',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} værktøjer, altid de samme: deres navn og beskrivelse afhænger aldrig af dine data. Skemaet opdages ved at kalde dem.',
  Rôle: 'Rolle',
  Écrit: 'Skriver?',
  oui: 'ja',
  propose: 'foreslår',
  non: 'nej',
  'Enchaînement type': 'Typisk forløb',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, derefter `describe_base`: det, der findes.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` før al læsning eller skrivning: felterne, deres typer, og hvilke tokenet kan skrive til (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` med `filter`, `sort` og `limit`; fortsæt med `cursor`, så længe `has_more` er `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'For at skrive en relation: `lookup_records` på måltabellen, derefter `create_record` eller `update_record` med det fundne `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'For at ændre strukturen: `propose_create_table` eller `propose_add_field`, derefter `get_proposal` for at følge beslutningen.',
  'Propositions de structure': 'Strukturforslag',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'En agent ændrer aldrig selv strukturen: den **foreslår**. Forslaget venter i databasens kø »Forslag«, hvor en person, der kan ændre strukturen, godkender eller afviser det; uden en beslutning udløber det efter 24 timer. Bliver det godkendt, udføres det i navnet på den person, der oprettede tokenet — hvis denne person stadig har ret til det — og det fremgår af historikken som enhver anden ændring.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Højst 5 ventende forslag pr. token; et nyt forslag om det samme objekt erstatter det forrige (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Ingen sletning, ingen omdøbning, ingen kaskaderelation (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Det, der ikke findes',
  'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Intet værktøj sletter en række, kører SQL eller administrerer rettigheder eller tokens. En agent, der kalder et sådant navn — `delete_record`, `run_sql`… — får `MCP_OPERATION_EXCLUDED`, uanset hvilken database der er tale om.',
  Bornes: 'Grænser',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 25 rækker som standard, højst 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Et filter har højst 10 betingelser, kombineret med OG; en sortering, højst 3 felter.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'I en liste bliver en tekst på mere end 500 tegn afkortet og nævnt i `_truncated_fields`; `get_record` med `full_fields` gengiver den i sin helhed.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'En skrivning accepterer en `idempotency_key`: at gentage den opretter ikke en dublet.',
  'Ce que voit un agent': 'Hvad en agent ser',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'En agent ser aldrig mere, end den person, der oprettede dens token, gør — og ofte mindre.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Rettigheder:** tokenets egne, krydstjekket ved hvert kald med skaberens. Hvis denne persons rettigheder mindskes, mindskes tokenets med dem; hvis personens konto deaktiveres, holder tokenet op med at svare.',
  '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Læse, oprette, redigere** — aldrig slette. Et skrivebeskyttet token afviser al skrivning (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Denne database:** åben for agenter.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Denne database:** **lukket for agenter** — intet værktøj kan se den.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Kolonner forbeholdt mennesker:** ingen, i det du kan se af denne database.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Kolonner forbeholdt mennesker:** {columns}. For en agent findes de ikke.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Data, ikke instrukser:** beskrivelser og indhold gengives som data indtastet af brugere, og værktøjerne fortæller agenten det.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Log:** hvert kald logges ud fra formen på dets parametre, aldrig deres værdier.',
  obligatoire: 'påkrævet',
  'calculé par l’IA': 'beregnet af AI',
  'lecture seule': 'skrivebeskyttet',
  'HTML riche — **à assainir à l’affichage**': 'Rig HTML — **skal renses ved visning**',
  'invisible pour les agents': 'usynlig for agenter',
  'relation → {table}': 'relation → {table}',
  'Valeurs : {values}.': 'Værdier: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'mål ikke synligt for dig: cellen har altid værdien {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    "peger på {table} (ingen visningskolonne angivet: cellen viser id'et)",
  'pointe vers {table}, affiché par {field}': 'peger på {table}, vist ved {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'ved sletning: det afvises at slette målrækken, så længe den er refereret',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'ved sletning: at slette målrækken tømmer denne celle',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'ved sletning: at slette målrækken sletter også denne række',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'ved skrivning accepteres et rent `uuid`, `null`, eller `{"id": "…"}`; ved læsning altid `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'List rækkerne — filter, sortering, paginering med cursor',
  'Lire une ligne': 'Læs en række',
  'Supprimer une ligne': 'Slet en række',
  'Lister les lignes qui pointent vers celle-ci': 'List de rækker, der peger på denne',
  Méthode: 'Metode',
  Chemin: 'Sti',
  lire: 'læse',
  créer: 'oprette',
  modifier: 'redigere',
  supprimer: 'slette',
  '**En SQL :** {sql}': '**I SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Du kan {verbs}. De verber, der ikke er med på denne liste, er ikke åbne for dig, og de tilsvarende stier er ikke beskrevet.',
  'Points d’accès': 'Adgangspunkter',
  Colonnes: 'Kolonner',
  Colonne: 'Kolonne',
  Libellé: 'Etiket',
  Type: 'Type',
  Description: 'Beskrivelse',
  'Champs relation': 'Relationsfelter',
  'Colonnes système': 'Systemkolonner',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Altid læsbare, aldrig skrivbare. De bærer pagineringen med cursor og den trinvise genoptagelse, og ingen indstilling skjuler dem.',
  Expansion: 'Udvidelse',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — dybde 1 uden undtagelse. De relaterede objekter leveres i `included`, indekseret efter tabelnavn og derefter id, og ikke indlejret i rækken: 100 rækker, der peger på 3 mål, transporterer 3 objekter.',
  'Lignes référençantes': 'Refererende rækker',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} lister de rækker, der peger på en given række. En blok, hvis kildetabel ikke er synlig for dig, vises slet ikke — hverken som blok, tæller eller omtale.',
  'une table que vous ne voyez pas': 'en tabel, du ikke kan se',
  'Vue d’ensemble': 'Oversigt',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    "Denne database hedder {name} — det er navnet på **PostgreSQL-skemaet**, og det, du skriver i dine URL'er såvel som i værktøjskald. Tabellerne og kolonnerne har de samme navne her og i SQL: der er ingen oversættelsestabel at slå op i.",
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    "To adgange, de samme tilladelser: **REST-API'et** til dine programmer, **MCP-serveren** til AI-agenter. Hver tabelside beskriver, hvordan den nås via den ene og den anden.",
  Élément: 'Element',
  Valeur: 'Værdi',
  'Schéma PostgreSQL': 'PostgreSQL-skema',
  'Préfixe des routes REST': 'Præfiks for REST-ruter',
  'ouverte — voir « Connecter un agent »': 'åben — se »Tilslut en agent«',
  '**fermée aux agents**': '**lukket for agenter**',
  'Tables visibles': 'Synlige tabeller',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, i en kuvert {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Denne dokumentation beskriver, hvad DU kan se.** To læsere får to forskellige versioner af den, og det er reglen, ikke en bivirkning. Offentliggør den ikke, som den er.',
  Authentification: 'Godkendelse',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Alle dataruter kræver et **token** i headeren `Authorization`. Sessionscookien accepteres aldrig her: en browser sender den med hver anmodning, også dem, en fremmed side fremkalder.',
  'Jeton d’intégration': 'Integrationstoken',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    "Et program — et script, en synkronisering, en anden applikation — fremviser et **integrationstoken**, der starter med `bdb_`. Det gælder kun for denne database; det læser, og opretter og redigerer, hvis det er oprettet med skriveadgang, men **sletter aldrig**; og det har aldrig flere rettigheder end den person, der oprettede det, krydstjekket ved hvert kald. Administration, SQL-konsollen og AI'en forbliver lukket for det.",
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'For at oprette et: databasens »⋯«-menu → **API og agenter** → **API- og MCP-tokens…**, med adgangen **REST-API** markeret. Det vises kun én gang.',
  Appel: 'Kald',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Manglende godkendelse svarer `401`, aldrig `404`: du skal altid kunne logge ind igen.',
  Conventions: 'Konventioner',
  Enveloppe: 'Kuvert',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Alle svar har samme form: {envelope}. En fejl erstatter `data` med koden, detaljerne og forespørgslens id.',
  Nombres: 'Tal',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Tal er decimalstrenge**, uden undtagelse: {example}. Et flydende tal ville stiltiende runde et beløb af.',
  montant: 'beloeb',
  'Ressource invisible': 'Usynlig ressource',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**En usynlig ressource og en ikke-eksisterende ressource svarer det samme**, byte for byte. Et `404` fortæller dig aldrig, om objektet findes.',
  Pagination: 'Paginering',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginering med cursor:** følg `meta.has_next_page`, og send `after`. Der findes ingen eksportrute.',
  'Identifiants seuls': "Kun id'er",
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    "For en integration, der kun ønsker id'er, fjerner `?links=id` opløsningen af etiketter — og dermed lige så mange SQL-rundture.",
  Relations: 'Relationer',
  'Aucune relation visible dans cette base.': 'Ingen synlig relation i denne database.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relationerne er **rigtige PostgreSQL-fremmednøgler**. De kontrolleres af databasen, ikke af applikationen: en `INSERT` i direkte SQL er underlagt de samme regler.',
  'Codes de réponse': 'Svarkoder',
  Statut: 'Status',
  Signification: 'Betydning',
  'Succès.': 'Succes.',
  'Ligne créée.': 'Række oprettet.',
  'Suppression réussie, sans contenu.': 'Sletning gennemført, uden indhold.',
  'Authentification absente ou refusée.': 'Manglende eller afvist godkendelse.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Ressource, der ikke findes, **eller** er usynlig — de to svar er identiske.',
  'Suppression refusée : la ligne est encore référencée.':
    'Sletning afvist: rækken er stadig refereret.',
  'Valeur refusée par la validation.': 'Værdi afvist af valideringen.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'En fejl har altid denne form, og `request_id` er det, du skal opgive til support:',
  'La liste complète des codes est servie par {route}.':
    'Den fulde liste over koder leveres af {route}.',
  'Côté MCP': 'På MCP-siden',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    "Et afslag kommer som et værktøjsresultat markeret `isError`, hvis tekst er et stabilt JSON-objekt: samme `code` som API'et, en fast sætning, og et `hint`, der siger, hvordan kaldet kan rettes. `retryable` siger, om det er værd at prøve igen uændret.",
  'Écrire en SQL direct': 'Skriv direkte i SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Åbn `psql`: det virker, det er meningen med produktet.',
  'Ce qui vous attend :': 'Det, der venter dig:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Begrænsningerne gælder — påkrævet, længde, fremmednøgle. En refereret række kan ikke slettes.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Systemkolonnerne udfyldes ikke automatisk i en manuel `INSERT`: `_id`, `_created_at` og `_updated_at` har standardværdier, `_created_by` og `_updated_by` forventer et bruger-id.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedbs tilladelser gælder ikke i direkte SQL.** De styrer produktets flader — API, brugerflade, MCP. En PostgreSQL-forbindelse ser alt, hvad dens rolle ser. Det siges her, fordi det ville være værre at love det modsatte end slet ikke at love noget.',
  '{base} — documentation API et MCP': '{base} — API- og MCP-dokumentation',
}

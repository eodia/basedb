import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Swedish: the French sentence of `documentation.ts` → its translation. */
export const sv: Catalog = {
  'Prise en main': 'Kom igång',
  'API REST': 'REST-API',
  'Agents (MCP)': 'Agenter (MCP)',
  Tables: 'Tabeller',
  Référence: 'Referens',
  texte: 'text',
  'texte long': 'lång text',
  'nombre (chaîne décimale)': 'tal (decimalsträng)',
  booléen: 'booleskt värde',
  'date (`2026-09-18`)': 'datum (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'datum och tid, UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'enkelval',
  'choix multiple (liste de valeurs)': 'flerval (lista med värden)',
  'relation (`_id` de la ligne liée)': 'relation (`_id` för den länkade raden)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'flera relationer (lista över de länkade radernas `_id`, i ordning)',
  'lien URL (`https://…` ou `mailto:…`)': 'url-länk (`https://…` eller `mailto:…`)',
  'adresse e-mail': 'e-postadress',
  'numéro automatique (lecture seule)': 'autonummer (skrivskyddat)',
  'personne (`id` d’un membre de l’espace)': 'person (`id` för en medlem i arbetsytan)',
  formule: 'formel',
  'documents (liste de fichiers)': 'dokument (lista med filer)',
  'images (liste de fichiers)': 'bilder (lista med filer)',
  'colonne système': 'systemkolumn',
  'Un texte plus long.': 'En längre text.',
  valeur: 'värde',
  Exemple: 'Exempel',
  résultat: 'resultat',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'offert.pdf',
  Exemples: 'Exempel',
  'Lister les lignes': 'Lista raderna',
  Réponse: 'Svar',
  'Créer une ligne': 'Skapa en rad',
  'Déposer un fichier': 'Ladda upp en fil',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Kroppen är själva filen. Svaret ger ett `id`, som du sedan skriver i {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Tokenens identitet: vem som skapade den, dess databas, dess faktiska behörigheter och dess budgetar.',
  'Les bases que le jeton peut lire.': 'Databaserna som token kan läsa.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Tabellerna i en databas och grafen över deras relationer.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Fälten i en tabell: typ, krav, alternativ, relationer och vilka som går att ändra.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Läsa rader: filter, sortering, sidnumrering med markör.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Läsa en rad via dess `_id`, med långa texter i sin helhet om man begär det.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Hitta `_id` för en rad via dess visningsvärde, innan du skriver en relation.',
  'Créer une ligne.': 'Skapa en rad.',
  'Modifier les champs nommés d’une ligne.': 'Ändra namngivna fält i en rad.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Ta bort en rad, med en token skapad för att ta bort – svaret ger tillbaka den.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Återställa en borttagen rad, med dess `_id`, från historiken.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Föreslå en tabell och dess första fält – en person avgör.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Föreslå ett fält, ett enkelval eller en relation – en person avgör.',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    'Föreslå färg och ikon för en tabell och för alternativen i dess listor – en person avgör.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Läsa om ett av tokenens förslag och se vad som blev av det.',
  'dépôt basedb': 'basedb-repot',
  recette: 'test',
  'Depuis un agent (MCP)': 'Från en agent (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Den här databasen är inte öppen för agenter: inget MCP-verktyg ser den här tabellen, oavsett vilken token som används.',
  'Connaître ses champs, et lesquels sont modifiables': 'Se dess fält, och vilka som går att ändra',
  'Lire ses lignes — filtre, tri, pagination': 'Läsa dess rader – filter, sortering, sidnumrering',
  'Lire une ligne par son `_id`': 'Läsa en rad via dess `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Hitta en rad via dess visningsvärde, {field}',
  'Modifier une ligne': 'Ändra en rad',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Ta bort en rad – med en token skapad för att ta bort',
  'Ramener une ligne supprimée': 'Återställa en borttagen rad',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Inget verktyg är öppet för dig på den här tabellen.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'En token du skapar har aldrig fler behörigheter än du: de här verktygen är den övre gränsen.',
  Outil: 'Verktyg',
  Pour: 'Syfte',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'En agent tar bara bort med en token skapad som ”Läsa, skriva och ta bort”, en rad i taget; den borttagna raden återställs med `restore_record` eller från historiken.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Dolda för en agent:** {fields}. För agenten finns de här kolumnerna inte: den kan varken läsa, filtrera eller skriva dem.',
  'Arguments d’un appel': 'Argument för ett anrop',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Att skapa en token för den här databasen kräver åtkomstnivån **Hantera**, som du inte har. Be personen som hanterar den om en.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Koppla in en agent',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedbs **MCP-server** öppnar den här databasen för en AI-agent – Claude eller vilken MCP-klient som helst: den upptäcker den, läser den och, om du bestämmer det, skapar, ändrar och tar bort rader i den. Den använder samma behörigheter som REST-API:et.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Den här databasen är inte öppen för agenter.** Så länge den inte är det ser inget verktyg den, oavsett vilken token som visas upp.',
  'Créer un jeton': 'Skapa en token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'I gränssnittet, databasens meny ”⋯” → **API och agenter** → **API- och MCP-tokens…**, med åtkomsten **MCP** ikryssad. Token öppnar **hela databasen, alla dess miljöer** – produktion, test… – eller bara en, om du begränsar den. Den är **skrivskyddad** som standard: skrivrätt, och borttagning, väljs uttryckligen. Den visas bara en gång och återkallas från samma skärm. Kryssa även i **REST-API:et**, så används samma token av ett program (se ”Autentisering”).',
  'Garder le jeton hors de la configuration': 'Håll token utanför konfigurationen',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Token placeras i miljövariabeln `BASEDB_TOKEN`, aldrig i klientens konfigurationsfil: den är versionshanterad, synkroniserad och läsbar av alla program i sessionen.',
  'Déclarer le serveur dans le client': 'Ange servern i klienten',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    'En klient som pratar MCP över HTTP – Claude Code, bland andra – går direkt till serverns adress, `…/mcp`, med huvudet {header}. I ett projekts `.mcp.json`-fil läses `${BASEDB_TOKEN}` från miljön: token skrivs inte in i filen. Med samma token kan du ange en server per miljö.',
  'Client sans HTTP : le relais': 'Klient utan HTTP: reläet',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    'En klient som bara startar lokala program (stdio) går via **reläet** `relay.js`, som transporterar dess meddelanden till servern. Det läser token från variabeln som anges av `--token-env` (`BASEDB_MCP_TOKEN` om inget annat sägs), serverns adress från `--url` (eller `BASEDB_MCP_URL`) och miljön från `--environment` (eller `BASEDB_MCP_ENVIRONMENT`).',
  'Autre client MCP': 'Annan MCP-klient',
  'votre-instance': 'din-instans',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'En token accepteras bara på de åtkomster som kryssades i vid dess skapande: en token som bara har ”MCP” nekas av REST-API:et, och tvärtom.',
  'Choisir l’environnement': 'Välja miljö',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    'En databas kan ha flera miljöer (produktion, test, utveckling), var och en med sina egna tabeller och rader. En token för hela databasen öppnar dem alla; miljön väljs vid anropet, från det bredaste till det mest precisa:',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**Databasens namn**, utan något annat: {base} är produktionen, och varje miljö behåller också sitt eget namn.',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**Serverns adress**: {address} – en server angiven per miljö.',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '**Argumentet `environment`** i varje verktyg som anger en databas, för ett enda anrop: {example}.',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    'En miljö anges med sin etikett, utan hänsyn till versaler och accenter, eller med `production`. En miljö som databasen inte har svarar med `RESOURCE_NOT_FOUND`.',
  Vérifier: 'Verifiera',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    'Be agenten anropa `whoami`: den ger tillbaka personen som skapade token, databasen den gäller för, miljöerna den öppnar (`scope.available`) och dess faktiska behörigheter.',
  Outils: 'Verktyg',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} verktyg, alltid desamma: deras namn och beskrivning beror aldrig på dina data. Schemat upptäcks genom att anropa dem.',
  Rôle: 'Roll',
  Écrit: 'Skriver?',
  oui: 'ja',
  propose: 'föreslår',
  non: 'nej',
  'Enchaînement type': 'Typiskt flöde',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, sedan `describe_base`: vad som finns.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` innan all läsning eller skrivning: fälten, deras typer, och vilka token får skriva (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` med `filter`, `sort` och `limit`; fortsätt med `cursor` så länge `has_more` är `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'För att skriva en relation: `lookup_records` på måltabellen, sedan `create_record` eller `update_record` med det hittade `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'För att ändra strukturen: `propose_create_table` eller `propose_add_field`, sedan `get_proposal` för att följa beslutet.',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    'För utseendet: `color` och `icon` i `propose_create_table` och i alternativen i `propose_add_field`, eller `propose_update_look` för en tabell som redan finns.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'För att ta bort: `get_record` först, för att vara säker på raden, sedan `delete_record` – som ger tillbaka den i sitt svar; `restore_record` återställer den.',
  'Propositions de structure': 'Förslag på strukturändringar',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'En agent ändrar aldrig strukturen själv: den **föreslår**. Förslaget väntar i databasens kö ”Förslag”, där en person som kan ändra strukturen godkänner eller avvisar det; utan beslut upphör det att gälla efter 24 timmar. Godkänt tillämpas det i namnet på personen som skapade token – om den personen fortfarande har rätt att göra det – och visas i historiken som vilken annan ändring som helst.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Högst 5 väntande förslag per token; ett nytt förslag på samma objekt ersätter det föregående (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Ingen borttagning, ingen namnändring, ingen relation i kaskad (`MCP_CASCADE_FORBIDDEN`).',
  'Couleurs et pictogrammes': 'Färger och ikoner',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    'En tabell och varje alternativ i en lista har en färg och en ikon, som i applikationen. `color` är en färg `#rrggbb`; `icon` är namnet på en av de ikoner som applikationen ritar – verktygets schema räknar upp dem. En utelämnad nyckel behåller det som redan gäller, `null` rensar det. `describe_base` och `describe_table` ger tillbaka det nuvarande utseendet.',
  'Ce qui n’existe pas': 'Det som inte finns',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Inget verktyg tar bort flera rader på en gång, en tabell eller ett fält, kör SQL eller hanterar behörigheter eller tokens. En agent som anropar ett sådant namn – `delete_records`, `run_sql`… – får `MCP_OPERATION_EXCLUDED`, oavsett vilken databas det gäller.',
  Bornes: 'Gränser',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 25 rader som standard, högst 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Ett filter har högst 10 predikat, kombinerade med OCH; en sortering, högst 3 fält.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'I en lista trunkeras en text på mer än 500 tecken och namnges i `_truncated_fields`; `get_record` med `full_fields` ger tillbaka den i sin helhet.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'En skrivning accepterar en `idempotency_key`: att upprepa den skapar ingen dubblett.',
  'Ce que voit un agent': 'Vad en agent ser',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'En agent ser aldrig mer än personen som skapade dess token – och ofta mindre.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Behörigheter**: tokenens egna, avstämda vid varje anrop mot skaparens. Om den personens behörigheter minskar, minskar tokenens med dem; om kontot inaktiveras slutar token att svara.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Läsa, skapa, ändra** – och ta bort, en rad i taget, bara med en token skapad för det. En skrivskyddad token nekar all skrivning (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Den här databasen**: öppen för agenter.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Den här databasen**: **stängd för agenter** – inget verktyg ser den.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Kolumner reserverade för människor**: inga i det du ser av den här databasen.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Kolumner reserverade för människor**: {columns}. För en agent existerar de inte.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Data, inte instruktioner**: beskrivningar och innehåll återges som data inmatad av användare, och verktygen säger det till agenten.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Logg**: varje anrop loggas utifrån formen på dess parametrar, aldrig utifrån deras värden.',
  obligatoire: 'obligatoriskt',
  'calculé par l’IA': 'AI-beräknat',
  'lecture seule': 'skrivskyddat',
  'HTML riche — **à assainir à l’affichage**': 'formaterad HTML – **saneras vid visning**',
  'invisible pour les agents': 'dolt för agenter',
  'relation → {table}': 'relation → {table}',
  'Valeurs : {values}.': 'Värden: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'målet är inte synligt för dig: cellen visar alltid {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'pekar på {table} (ingen visningskolumn angiven: cellen visar identifieraren)',
  'pointe vers {table}, affiché par {field}': 'pekar på {table}, visas med {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'vid borttagning: att ta bort målraden nekas så länge den refereras',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'vid borttagning: att ta bort målraden tömmer den här cellen',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'vid borttagning: att ta bort målraden tar även bort den här raden',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'vid skrivning, acceptera ett rått `uuid`, `null`, eller `{"id": "…"}`; vid läsning, alltid `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Lista raderna – filter, sortering, sidnumrering med markör',
  'Lire une ligne': 'Läsa en rad',
  'Supprimer une ligne': 'Ta bort en rad',
  'Lister les lignes qui pointent vers celle-ci': 'Lista raderna som pekar på den här',
  Méthode: 'Metod',
  Chemin: 'Sökväg',
  lire: 'läsa',
  créer: 'skapa',
  modifier: 'ändra',
  supprimer: 'ta bort',
  '**En SQL :** {sql}': '**I SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Du kan {verbs}. Verb som saknas i den här listan är inte öppna för dig, och motsvarande sökvägar beskrivs inte.',
  'Points d’accès': 'Slutpunkter',
  Colonnes: 'Kolumner',
  Colonne: 'Kolumn',
  Libellé: 'Etikett',
  Type: 'Typ',
  Description: 'Beskrivning',
  'Champs relation': 'Relationsfält',
  'Colonnes système': 'Systemkolumner',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Alltid läsbara, aldrig skrivbara. De bär sidnumreringen med markör och den stegvisa återupptagningen, och ingen inställning döljer dem.',
  Expansion: 'Expansion',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} – djup 1 utan undantag. De länkade objekten kommer i `included`, indexerade per tabellnamn och sedan per identifierare, och inte inbäddade i raden: 100 rader som pekar på 3 mål transporterar 3 objekt.',
  'Lignes référençantes': 'Refererande rader',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} listar raderna som pekar på en given rad. Ett block vars källtabell inte är synlig för dig visas inte alls där – varken block, räknare eller omnämnande.',
  'une table que vous ne voyez pas': 'en tabell som du inte ser',
  'Vue d’ensemble': 'Översikt',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Den här databasen heter {name} – det är namnet på **PostgreSQL-schemat**, samma namn som du skriver i dina URL:er och i verktygsanropen. Tabellerna och kolumnerna har samma namn här som i SQL: det finns ingen översättningstabell att slå upp.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Två ingångar, samma behörigheter: **REST-API:et** för dina program, **MCP-servern** för AI-agenter. Varje tabellsida beskriver hur du når den via båda.',
  Élément: 'Egenskap',
  Valeur: 'Värde',
  'Schéma PostgreSQL': 'PostgreSQL-schema',
  'Préfixe des routes REST': 'Prefix för REST-rutterna',
  'ouverte — voir « Connecter un agent »': 'öppen – se ”Koppla in en agent”',
  '**fermée aux agents**': '**stängd för agenter**',
  'Tables visibles': 'Synliga tabeller',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, i ett kuvert {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Den här dokumentationen beskriver vad DU kan se.** Två läsare får två olika versioner, och det är regeln, inte en bieffekt. Publicera den inte som den är.',
  Authentification: 'Autentisering',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Alla dataslutpunkter kräver en **token**, i huvudet `Authorization`. Sessionskakan accepteras aldrig här: en webbläsare skickar den vid varje begäran, även de som en främmande sida framkallar.',
  'Jeton d’intégration': 'Integrationstoken',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Ett program – ett skript, en synkronisering, en annan applikation – uppvisar en **integrationstoken**, som börjar med `bdb_`. Den gäller bara för den här databasen – alla dess miljöer, eller bara en; den läser, skapar och ändrar om den har skapats med skrivrätt, och **tar bara bort om den har skapats för det**; den har aldrig fler behörigheter än personen som skapade den, kontrollerat vid varje anrop. Administrationen, SQL-konsolen och AI:n förblir stängda för den.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'För att skapa en: databasens meny ”⋯” → **API och agenter** → **API- och MCP-tokens…**, med åtkomsten **REST-API** ikryssad. Den visas bara en gång.',
  Appel: 'Anrop',
  Environnement: 'Miljö',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    'En token som har skapats för hela databasen öppnar alla dess miljöer. Sökvägen anger databasen – {base} är produktionen – och huvudet {header} väljer miljön; `?environment=` gör detsamma för en klient som inte sätter något huvud. Utan någotdera gäller den miljö som databasnamnet anger.',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'En utebliven autentisering svarar `401`, aldrig `404`: du måste kunna logga in igen.',
  Conventions: 'Konventioner',
  Enveloppe: 'Kuvert',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Alla svar har samma form: {envelope}. Ett fel ersätter `data` med koden, detaljerna och begärans identifierare.',
  Nombres: 'Tal',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Tal är decimalsträngar**, utan undantag: {example}. Ett flyttal skulle tyst avrunda ett belopp.',
  montant: 'belopp',
  'Ressource invisible': 'Osynlig resurs',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**En osynlig resurs och en resurs som inte finns svarar likadant**, byte för byte. En `404` talar aldrig om för dig om objektet finns.',
  Pagination: 'Sidnumrering',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Sidnumrering med markör**: följ `meta.has_next_page` och skicka med `after`. Det finns ingen exportrutt.',
  'Identifiants seuls': 'Endast identifierare',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'För en integration som bara vill ha identifierare tar `?links=id` bort upplösningen av etiketter – och lika många SQL-anrop.',
  Relations: 'Relationer',
  'Aucune relation visible dans cette base.': 'Ingen synlig relation i den här databasen.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relationerna är **riktiga främmande nycklar i PostgreSQL**. De kontrolleras av databasen, inte av applikationen: en `INSERT` i direkt SQL följer samma regler.',
  'Codes de réponse': 'Svarskoder',
  Statut: 'Status',
  Signification: 'Betydelse',
  'Succès.': 'Lyckades.',
  'Ligne créée.': 'Raden skapades.',
  'Suppression réussie, sans contenu.': 'Borttagningen lyckades, utan innehåll.',
  'Authentification absente ou refusée.': 'Autentisering saknas eller nekades.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Resursen finns inte **eller** är osynlig – båda svaren är identiska.',
  'Suppression refusée : la ligne est encore référencée.':
    'Borttagning nekad: raden refereras fortfarande.',
  'Valeur refusée par la validation.': 'Värdet avvisades av valideringen.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Ett fel har alltid den här formen, och `request_id` är det du ska ange till supporten:',
  'La liste complète des codes est servie par {route}.':
    'Den fullständiga listan över koder tillhandahålls av {route}.',
  'Côté MCP': 'På MCP-sidan',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Ett avslag kommer som ett verktygsresultat märkt `isError`, vars text är ett stabilt JSON-objekt: samma `code` som API:et, en fast fras, och en `hint` som säger hur anropet ska rättas till. `retryable` anger om det är värt att försöka igen som det är.',
  'Écrire en SQL direct': 'Skriva direkt i SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Öppna `psql`: det fungerar, det är hela poängen med produkten.',
  'Ce qui vous attend :': 'Det som väntar dig:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Begränsningarna gäller – obligatoriskt, längd, främmande nyckel. En refererad rad går inte att ta bort.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Systemkolumnerna fylls inte i av sig själva vid en manuell `INSERT`: `_id`, `_created_at` och `_updated_at` har standardvärden, medan `_created_by` och `_updated_by` förväntar sig en användaridentifierare.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedbs behörigheter gäller inte i direkt SQL.** De styr produktens ytor – API, gränssnitt, MCP. En PostgreSQL-anslutning ser allt som dess roll ser. Det sägs här eftersom det vore värre att lova motsatsen än att inte lova något alls.',
  '{base} — documentation API et MCP': '{base} – API- och MCP-dokumentation',
}

import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Dutch: the French sentence of `documentation.ts` → its translation. */
export const nl: Catalog = {
  'Prise en main': 'Aan de slag',
  'API REST': 'REST-API',
  'Agents (MCP)': 'Agenten (MCP)',
  Tables: 'Tabellen',
  Référence: 'Referentie',
  texte: 'tekst',
  'texte long': 'lange tekst',
  'nombre (chaîne décimale)': 'getal (decimale tekenreeks)',
  booléen: 'booleaans',
  'date (`2026-09-18`)': 'datum (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'datum-tijd UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'enkele keuze',
  'choix multiple (liste de valeurs)': 'meerkeuze (lijst met waarden)',
  'relation (`_id` de la ligne liée)': 'relatie (`_id` van de gekoppelde rij)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    "meervoudige relatie (lijst met `_id`'s van de gekoppelde rijen, in hun volgorde)",
  'lien URL (`https://…` ou `mailto:…`)': 'URL (`https://…` of `mailto:…`)',
  'adresse e-mail': 'e-mailadres',
  'numéro automatique (lecture seule)': 'automatisch nummer (alleen-lezen)',
  'personne (`id` d’un membre de l’espace)': 'persoon (`id` van een lid van de werkruimte)',
  formule: 'formule',
  'documents (liste de fichiers)': 'documenten (lijst met bestanden)',
  'images (liste de fichiers)': 'afbeeldingen (lijst met bestanden)',
  'colonne système': 'systeemkolom',
  'Un texte plus long.': 'Een langere tekst.',
  valeur: 'waarde',
  Exemple: 'Voorbeeld',
  résultat: 'resultaat',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'offerte.pdf',
  Exemples: 'Voorbeelden',
  'Lister les lignes': 'Rijen opvragen',
  Réponse: 'Antwoord',
  'Créer une ligne': 'Rij maken',
  'Déposer un fichier': 'Een bestand uploaden',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'De body is het bestand zelf. Het antwoord geeft een `id`, dat je vervolgens in {field} schrijft: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'De identiteit van het token: wie het heeft aangemaakt, de database ervan, de effectieve rechten en de budgetten.',
  'Les bases que le jeton peut lire.': 'De databases die het token mag lezen.',
  'Les tables d’une base et le graphe de leurs relations.':
    'De tabellen van een database en de graaf van hun relaties.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'De velden van een tabel: type, verplichting, opties, relaties, en welke ervan te wijzigen zijn.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Rijen lezen: filter, sortering, paginering via cursor.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Een rij lezen via de `_id`, met lange teksten volledig als daarom wordt gevraagd.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'De `_id` van een rij vinden via de weergavewaarde, vóór het schrijven van een relatie.',
  'Créer une ligne.': 'Een rij maken.',
  'Modifier les champs nommés d’une ligne.': 'De genoemde velden van een rij wijzigen.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Een tabel en de eerste velden ervan voorstellen — een persoon beslist.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Een veld, een keuzelijst of een relatie voorstellen — een persoon beslist.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Een voorstel van het token opnieuw bekijken en weten wat ermee is gebeurd.',
  'dépôt basedb': 'basedb-repository',
  'Depuis un agent (MCP)': 'Vanuit een agent (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Deze database staat niet open voor agents: geen enkele MCP-tool ziet deze tabel, ongeacht welk token wordt gebruikt.',
  'Connaître ses champs, et lesquels sont modifiables':
    'De velden kennen, en welke ervan te wijzigen zijn',
  'Lire ses lignes — filtre, tri, pagination': 'De rijen lezen — filter, sortering, paginering',
  'Lire une ligne par son `_id`': 'Een rij lezen via de `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Een rij vinden via de weergavewaarde, {field}',
  'Modifier une ligne': 'Rij wijzigen',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Op deze tabel staat geen enkele tool voor je open.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Een token dat je aanmaakt heeft nooit meer rechten dan jij: deze tools zijn een maximum.',
  Outil: 'Tool',
  Pour: 'Voor',
  'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.':
    'Een rij verwijderen blijft voorbehouden aan de REST-API en de interface: geen enkele MCP-tool verwijdert.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Onzichtbaar voor een agent:** {fields}. Voor de agent bestaan deze kolommen niet: hij kan ze niet lezen, niet filteren en niet schrijven.',
  'Arguments d’un appel': 'Argumenten van een aanroep',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Voor het aanmaken van een token voor deze database heb je het niveau **Beheren** nodig, dat je niet hebt. Vraag er een aan bij de persoon die de database beheert.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Een agent aansluiten',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.':
    'De **MCP-server** van basedb stelt deze database open voor een AI-agent — Claude of een andere MCP-client: die ontdekt de database, leest ze en maakt en wijzigt er, als jij dat beslist, rijen in. Hij werkt met dezelfde rechten als de REST-API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Deze database staat niet open voor agents.** Zolang dat niet het geval is, ziet geen enkele tool die, ongeacht welk token wordt gebruikt.',
  'Créer un jeton': 'Een token aanmaken',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'In de interface, menu “⋯” van de database → **API en agents** → **API- en MCP-tokens…**, toegang **MCP** aangevinkt. Het token is beperkt tot deze database, standaard **alleen-lezen**: schrijven kies je expliciet. Het wordt maar één keer getoond, en kan vanaf hetzelfde scherm worden ingetrokken. Ook aangevinkt voor de **REST-API**, hetzelfde token werkt dan voor een programma (zie “Authenticatie”).',
  'Garder le jeton hors de la configuration': 'Het token buiten de configuratie houden',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    "Het token komt in de omgevingsvariabele `BASEDB_TOKEN`, nooit in het configuratiebestand van de client: dat bestand wordt geversioneerd, gesynchroniseerd en is leesbaar voor alle programma's van de sessie.",
  'Déclarer le serveur dans le client': 'De server registreren in de client',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'De client start de **relay** `relay.js`, die de berichten naar de server doorstuurt. Hij leest het token uit de variabele die `--token-env` aangeeft — `BASEDB_MCP_TOKEN` als niets is opgegeven — en het adres van de server uit `--url` (of `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Andere MCP-client',
  'votre-instance': 'jouw-instantie',
  'Sans relais': 'Zonder relay',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Een client die MCP via HTTP spreekt, gaat rechtstreeks naar het adres van de server, `…/mcp`, met de header {header}. Een token wordt alleen geaccepteerd voor de toegang die bij het aanmaken ervan is aangevinkt: een token met alleen “MCP” wordt geweigerd door de REST-API, en omgekeerd.',
  Vérifier: 'Controleren',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Vraag de agent om `whoami` aan te roepen: dat levert de persoon op die het token heeft aangemaakt, de database waarop het van toepassing is, en de effectieve rechten ervan.',
  Outils: 'Tools',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} tools, altijd dezelfde: hun naam en beschrijving hangen nooit af van jouw gegevens. Het schema ontdek je door ze aan te roepen.',
  Rôle: 'Rol',
  Écrit: 'Schrijft?',
  oui: 'ja',
  propose: 'stelt voor',
  non: 'nee',
  'Enchaînement type': 'Typische volgorde',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, daarna `describe_base`: wat er bestaat.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` vóór elke lees- of schrijfactie: de velden, hun types, en welke ervan het token mag schrijven (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` met `filter`, `sort` en `limit`; ga verder met `cursor` zolang `has_more` gelijk is aan `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Om een relatie te schrijven: `lookup_records` op de doeltabel, daarna `create_record` of `update_record` met de gevonden `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Om de structuur te laten evolueren: `propose_create_table` of `propose_add_field`, daarna `get_proposal` om de beslissing te volgen.',
  'Propositions de structure': 'Structuurvoorstellen',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Een agent wijzigt de structuur nooit zelf: hij **stelt voor**. Het voorstel wacht in de wachtrij “Agentvoorstellen” van de database, waar een persoon die de structuur mag wijzigen het goedkeurt of weigert; zonder beslissing verloopt het na 24 uur. Eenmaal goedgekeurd, wordt het toegepast namens de persoon die het token heeft aangemaakt — als die persoon daar nog steeds recht toe heeft — en verschijnt het in de geschiedenis als elke andere wijziging.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Hoogstens 5 voorstellen tegelijk in behandeling per token; een nieuw voorstel voor hetzelfde object vervangt het vorige (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Geen verwijderen, geen hernoemen, geen cascaderelatie (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Wat niet bestaat',
  'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    "Geen enkele tool verwijdert een rij, voert SQL uit of beheert rechten of tokens. Een agent die zo'n naam aanroept — `delete_record`, `run_sql`… — krijgt `MCP_OPERATION_EXCLUDED`, ongeacht welke database het betreft.",
  Bornes: 'Limieten',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: standaard 25 rijen, hoogstens 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Een filter telt hoogstens 10 predicaten, gecombineerd met EN; een sortering, hoogstens 3 velden.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'In een lijst wordt een tekst van meer dan 500 tekens afgekapt en vermeld in `_truncated_fields`; `get_record` met `full_fields` geeft de tekst volledig terug.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Een schrijfactie accepteert een `idempotency_key`: die opnieuw uitvoeren maakt geen duplicaat aan.',
  'Ce que voit un agent': 'Wat een agent ziet',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Een agent ziet nooit meer dan de persoon die zijn token heeft aangemaakt — en vaak minder.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Rechten**: die van het token, bij elke aanroep vergeleken met die van de maker ervan. Als de rechten van die persoon afnemen, nemen die van het token mee af; als het account van die persoon wordt gedeactiveerd, reageert het token niet meer.',
  '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Lezen, aanmaken, wijzigen** — nooit verwijderen. Een alleen-lezen token weigert elke schrijfactie (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Deze database**: open voor agents.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Deze database**: **gesloten voor agents** — geen enkele tool ziet die.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Kolommen die voorbehouden zijn aan mensen**: geen enkele in wat jij van deze database ziet.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Kolommen die voorbehouden zijn aan mensen**: {columns}. Voor een agent bestaan ze niet.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Gegevens, geen instructies**: beschrijvingen en inhoud worden weergegeven als gegevens die door gebruikers zijn ingevoerd, en de tools zeggen dat ook tegen de agent.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Logboek**: elke aanroep wordt gelogd met de vorm van zijn parameters, nooit met hun waarden.',
  obligatoire: 'verplicht',
  'calculé par l’IA': 'berekend door AI',
  'lecture seule': 'alleen-lezen',
  'HTML riche — **à assainir à l’affichage**': 'rijke HTML — **te ontsmetten bij weergave**',
  'invisible pour les agents': 'onzichtbaar voor agenten',
  'relation → {table}': 'relatie → {table}',
  'Valeurs : {values}.': 'Waarden: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'doel niet zichtbaar voor jou: de cel is altijd {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'verwijst naar {table} (geen weergavekolom aangewezen: de cel toont het ID)',
  'pointe vers {table}, affiché par {field}': 'verwijst naar {table}, weergegeven via {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'bij verwijderen: de doelrij verwijderen wordt geweigerd zolang ernaar wordt verwezen',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'bij verwijderen: de doelrij verwijderen maakt deze cel leeg',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'bij verwijderen: de doelrij verwijderen verwijdert ook deze rij',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'bij schrijven accepteer je een kale `uuid`, `null`, of `{"id": "…"}`; bij lezen altijd `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Rijen opvragen — filter, sortering, paginering via cursor',
  'Lire une ligne': 'Rij lezen',
  'Supprimer une ligne': 'Rij verwijderen',
  'Lister les lignes qui pointent vers celle-ci': 'Rijen opvragen die naar deze rij verwijzen',
  Méthode: 'Methode',
  Chemin: 'Pad',
  lire: 'lezen',
  créer: 'maken',
  modifier: 'wijzigen',
  supprimer: 'verwijderen',
  '**En SQL :** {sql}': '**In SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Je kunt {verbs}. Werkwoorden die niet in deze lijst staan, staan niet voor je open, en de bijbehorende paden worden niet beschreven.',
  'Points d’accès': 'Endpoints',
  Colonnes: 'Kolommen',
  Colonne: 'Kolom',
  Libellé: 'Label',
  Type: 'Type',
  Description: 'Beschrijving',
  'Champs relation': 'Relatievelden',
  'Colonnes système': 'Systeemkolommen',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Altijd leesbaar, nooit schrijfbaar. Ze dragen de paginering via cursor en de incrementele synchronisatie, en geen enkele instelling verbergt ze.',
  Expansion: 'Expansie',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — altijd diepte 1, zonder uitzondering. De gekoppelde objecten komen in `included`, geïndexeerd op tabelnaam en vervolgens op ID, en niet genest in de rij: 100 rijen die naar 3 doelen verwijzen, bevatten 3 objecten.',
  'Lignes référençantes': 'Verwijzende rijen',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} geeft de rijen die naar een bepaalde rij verwijzen. Een blok waarvan de brontabel niet zichtbaar is voor jou, komt er helemaal niet in voor — geen blok, geen teller, geen vermelding.',
  'une table que vous ne voyez pas': 'een tabel die je niet ziet',
  'Vue d’ensemble': 'Overzicht',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    "Deze database heet {name} — dat is de naam van het **PostgreSQL-schema**, en degene die je in je URL's en in je tool-aanroepen gebruikt. De tabellen en kolommen hebben hier en in SQL dezelfde namen: er is geen omzettingstabel om te raadplegen.",
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    "Twee toegangswegen, dezelfde rechten: de **REST-API** voor je programma's, de **MCP-server** voor AI-agents. Elke tabelpagina vertelt hoe je de tabel via de ene en de andere kunt bereiken.",
  Élément: 'Element',
  Valeur: 'Waarde',
  'Schéma PostgreSQL': 'PostgreSQL-schema',
  'Préfixe des routes REST': 'Prefix van de REST-routes',
  'ouverte — voir « Connecter un agent »': 'open — zie “Een agent aansluiten”',
  '**fermée aux agents**': '**gesloten voor agents**',
  'Tables visibles': 'Zichtbare tabellen',
  Format: 'Formaat',
  'JSON, dans une enveloppe {envelope}': 'JSON, in een envelop {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Deze documentatie beschrijft wat JIJ kunt zien.** Twee lezers krijgen er twee verschillende versies van, en dat is de regel, geen neveneffect. Publiceer ze niet zomaar.',
  Authentification: 'Authenticatie',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Alle routes voor gegevens vereisen een **token**, in de header `Authorization`. Het sessiecookie wordt hier nooit geaccepteerd: een browser stuurt dat bij elk verzoek mee, ook bij verzoeken die door een externe pagina worden veroorzaakt.',
  'Jeton d’intégration': 'Integratietoken',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Een programma — script, synchronisatie, andere applicatie — presenteert een **integratietoken**, dat begint met `bdb_`. Het geldt alleen voor deze database; het leest, en maakt aan en wijzigt als het met schrijfrechten is aangemaakt, maar **verwijdert nooit**; en het heeft nooit meer rechten dan de persoon die het heeft aangemaakt, bij elke aanroep opnieuw vergeleken. Beheer, de SQL-console en AI blijven voor dit token gesloten.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Om er een aan te maken: menu “⋯” van de database → **API en agents** → **API- en MCP-tokens…**, toegang **REST-API** aangevinkt. Het wordt maar één keer getoond.',
  Appel: 'Aanroep',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Als authenticatie ontbreekt, is het antwoord `401`, nooit `404`: je moet altijd opnieuw kunnen inloggen.',
  Conventions: 'Conventies',
  Enveloppe: 'Envelop',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Alle antwoorden hebben dezelfde vorm: {envelope}. Bij een fout komt in plaats van `data` de code, de details en het aanvraag-ID.',
  Nombres: 'Getallen',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Getallen zijn decimale tekenreeksen**, zonder uitzondering: {example}. Een float zou een bedrag stilzwijgend afronden.',
  montant: 'bedrag',
  'Ressource invisible': 'Onzichtbare resource',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Een onzichtbare resource en een niet-bestaande resource geven hetzelfde antwoord**, byte voor byte. Een `404` vertelt je nooit of het object bestaat.',
  Pagination: 'Paginering',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginering via cursor**: volg `meta.has_next_page` en geef `after` door. Er bestaat geen exportroute.',
  'Identifiants seuls': "Alleen ID's",
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    "Voor een integratie die alleen ID's nodig heeft, schakelt `?links=id` het omzetten van labels uit — en dus evenveel SQL-round-trips.",
  Relations: 'Relaties',
  'Aucune relation visible dans cette base.': 'Geen zichtbare relaties in deze database.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relaties zijn **echte PostgreSQL-foreign-keys**. Ze worden gecontroleerd door de database, niet door de applicatie: een `INSERT` in rechtstreekse SQL is aan dezelfde regels onderworpen.',
  'Codes de réponse': 'Antwoordcodes',
  Statut: 'Status',
  Signification: 'Betekenis',
  'Succès.': 'Succes.',
  'Ligne créée.': 'Rij aangemaakt.',
  'Suppression réussie, sans contenu.': 'Verwijdering geslaagd, zonder inhoud.',
  'Authentification absente ou refusée.': 'Ontbrekende of geweigerde authenticatie.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Niet-bestaande **of** onzichtbare resource — beide antwoorden zijn identiek.',
  'Suppression refusée : la ligne est encore référencée.':
    'Verwijdering geweigerd: er wordt nog naar de rij verwezen.',
  'Valeur refusée par la validation.': 'Waarde geweigerd door de validatie.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Een foutmelding heeft altijd deze vorm, en `request_id` is wat je aan de support moet doorgeven:',
  'La liste complète des codes est servie par {route}.':
    'De volledige lijst met codes wordt geleverd door {route}.',
  'Côté MCP': 'MCP-kant',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Een weigering komt binnen als een toolresultaat dat is gemarkeerd met `isError`, waarvan de tekst een stabiel JSON-object is: dezelfde `code` als de API, een vaste zin, en een `hint` die zegt hoe je de aanroep kunt corrigeren. `retryable` zegt of het de moeite waard is om het zo opnieuw te proberen.',
  'Écrire en SQL direct': 'Rechtstreeks in SQL schrijven',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Open `psql`: het werkt, dat is precies de bedoeling van het product.',
  'Ce qui vous attend :': 'Wat je te wachten staat:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'De constraints gelden — verplicht, lengte, foreign key. Een rij waarnaar wordt verwezen, kan niet worden verwijderd.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'De systeemkolommen vullen zichzelf niet in bij een handmatige `INSERT`: `_id`, `_created_at` en `_updated_at` hebben standaardwaarden, `_created_by` en `_updated_by` verwachten een gebruikers-ID.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**De rechten van basedb gelden niet in rechtstreekse SQL.** Ze regelen de oppervlakken van het product — API, interface, MCP. Een PostgreSQL-verbinding ziet alles wat zijn rol ziet. Dit staat hier omdat het tegendeel beloven erger zou zijn dan niets beloven.',
  '{base} — documentation API et MCP': '{base} — API- en MCP-documentatie',
}

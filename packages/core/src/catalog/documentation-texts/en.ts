import type { Catalog } from './catalog.js'

/** The API and MCP documentation in English: the French sentence of `documentation.ts` → its translation. */
export const en: Catalog = {
  'Prise en main': 'Getting started',
  'API REST': 'REST API',
  'Agents (MCP)': 'Agents (MCP)',
  Tables: 'Tables',
  Référence: 'Reference',
  texte: 'text',
  'texte long': 'long text',
  'nombre (chaîne décimale)': 'number (decimal string)',
  booléen: 'boolean',
  'date (`2026-09-18`)': 'date (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'UTC date-time (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'choice list',
  'choix multiple (liste de valeurs)': 'multiple choice (list of values)',
  'relation (`_id` de la ligne liée)': 'relation (linked row’s `_id`)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'multiple relation (list of linked rows’ `_id`, in their order)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL link (`https://…` or `mailto:…`)',
  'adresse e-mail': 'email address',
  'numéro automatique (lecture seule)': 'autonumber (read-only)',
  'personne (`id` d’un membre de l’espace)': 'person (a workspace member’s `id`)',
  formule: 'formula',
  'documents (liste de fichiers)': 'documents (list of files)',
  'images (liste de fichiers)': 'images (list of files)',
  'colonne système': 'system column',
  'Un texte plus long.': 'A longer text.',
  valeur: 'value',
  Exemple: 'Example',
  résultat: 'result',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'quote.pdf',
  Exemples: 'Examples',
  'Lister les lignes': 'List rows',
  Réponse: 'Response',
  'Créer une ligne': 'Create a row',
  'Déposer un fichier': 'Upload a file',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'The body is the file itself. The response gives back an `id`, to write next into {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'The token’s identity: who created it, its base, its effective permissions and its budgets.',
  'Les bases que le jeton peut lire.': 'The bases the token can read.',
  'Les tables d’une base et le graphe de leurs relations.':
    'A base’s tables and the graph of their relations.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'A table’s fields: type, whether required, options, relations, and which ones can be written.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Read rows: filter, sort, cursor pagination.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Read a row by its `_id`, long texts in full on request.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Find a row’s `_id` from its display value, before writing a relation.',
  'Créer une ligne.': 'Create a row.',
  'Modifier les champs nommés d’une ligne.': 'Update the named fields of a row.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Delete a row, with a token created to delete — the response returns it.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Restore a deleted row, by its `_id`, from the history.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Propose a table and its first fields — a person decides.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Propose a field, a choice list or a relation — a person decides.',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    'Propose the color and icon of a table and of the choices in its lists — a person decides.',
  recette: 'staging',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Look up one of the token’s proposals and find out what became of it.',
  'dépôt basedb': 'basedb repository',
  'Depuis un agent (MCP)': 'From an agent (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'This base is not open to agents: no MCP tool sees this table, whatever the token.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Know its fields, and which ones can be written',
  'Lire ses lignes — filtre, tri, pagination': 'Read its rows — filter, sort, pagination',
  'Lire une ligne par son `_id`': 'Read a row by its `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Find a row by its display value, {field}',
  'Modifier une ligne': 'Update a row',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Delete a row — with a token created to delete',
  'Ramener une ligne supprimée': 'Restore a deleted row',
  'Aucun outil ne vous est ouvert sur cette table.': 'No tool is open to you on this table.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'A token you create never has more permissions than you: these tools are a maximum.',
  Outil: 'Tool',
  Pour: 'For',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'An agent only deletes with a token created “Read, write and delete”, one row at a time; the deleted row comes back through `restore_record` or from the history.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Invisible to an agent:** {fields}. To it, these columns don’t exist: it can neither read, filter, nor write them.',
  'Arguments d’un appel': 'Arguments of a call',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Creating a token for this base requires **Manage** level, which you don’t have. Ask the person who manages it for one.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Connect an agent',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedb’s **MCP server** opens this base to an AI agent — Claude or any MCP client: it discovers it, reads it, and, if you decide to, creates, updates and deletes rows in it. It goes through the same permissions as the REST API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**This base is not open to agents.** As long as it isn’t, no tool sees it, whatever token is presented.',
  'Créer un jeton': 'Create a token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'In the interface, the base’s “⋯” menu → **API and agents** → **API and MCP tokens…**, with **MCP** access checked. The token opens **the whole base, all its environments** — production, staging… — or just one, if you limit it. It is **read-only** by default: write access, and delete access, are chosen explicitly. It is shown only once, and can be revoked from the same screen. Also checked for the **REST API**, the same token serves a program (see “Authentication”).',
  'Garder le jeton hors de la configuration': 'Keep the token out of the configuration',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'The token goes in the `BASEDB_TOKEN` environment variable, never in the client’s configuration file: that file is versioned, synced, and readable by every program in the session.',
  'Déclarer le serveur dans le client': 'Declare the server in the client',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    'A client that speaks MCP over HTTP — Claude Code, among others — targets the server’s address directly, `…/mcp`, with the {header} header. In a project’s `.mcp.json` file, `${BASEDB_TOKEN}` is read from the environment: the token is never written to the file. The same token can declare one server per environment.',
  'Client sans HTTP : le relais': 'A client without HTTP: the relay',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    'A client that only launches local programs (stdio) goes through the **relay** `relay.js`, which carries its messages to the server. It reads the token from the variable named by `--token-env` (`BASEDB_MCP_TOKEN` if none is given), the server’s address from `--url` (or `BASEDB_MCP_URL`), and the environment from `--environment` (or `BASEDB_MCP_ENVIRONMENT`).',
  'Autre client MCP': 'Other MCP client',
  'votre-instance': 'your-instance',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'A token is only accepted for the access checked when it was created: an “MCP”-only token is refused by the REST API, and vice versa.',
  'Choisir l’environnement': 'Choose the environment',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    'A base can have several environments — production, staging, development — each with its own tables and rows. A whole-base token opens all of them; the environment is chosen on each call, from the broadest to the most specific:',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**The base name**, on its own: {base} is the production, and each environment also keeps its own name.',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**The server address**: {address} — one server declared per environment.',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '**The `environment` argument** of every tool that names a base, for a single call: {example}.',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    'An environment is named by its badge, ignoring case and accents, or `production`. An environment the base doesn’t have answers `RESOURCE_NOT_FOUND`.',
  Vérifier: 'Verify',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    'Ask the agent to call `whoami`: it returns the person who created the token, the base it is scoped to, the environments it opens (`scope.available`), and its effective permissions.',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    'For the appearance: `color` and `icon` in `propose_create_table` and in the choices of `propose_add_field`, or `propose_update_look` for a table that already exists.',
  'Couleurs et pictogrammes': 'Colors and icons',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    'A table and each choice of a list have a color and an icon, as in the application. `color` is a `#rrggbb` color; `icon` is the name of one of the icons the application draws — the tool’s schema lists them. An omitted key keeps what is in place, `null` clears it. `describe_base` and `describe_table` return the current appearance.',
  Outils: 'Tools',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} tools, always the same ones: their name and description never depend on your data. The schema is discovered by calling them.',
  Rôle: 'Role',
  Écrit: 'Writes?',
  oui: 'yes',
  propose: 'proposes',
  non: 'no',
  'Enchaînement type': 'Typical sequence',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, then `describe_base`: what exists.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` before any read or write: the fields, their types, and which ones the token can write (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` with `filter`, `sort` and `limit`; continue with `cursor` as long as `has_more` is `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'To write a relation: `lookup_records` on the target table, then `create_record` or `update_record` with the `_id` found.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'To evolve the schema: `propose_create_table` or `propose_add_field`, then `get_proposal` to follow the decision.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'To delete: `get_record` first, to be sure of the row, then `delete_record` — which returns it in its response; `restore_record` restores it.',
  'Propositions de structure': 'Schema proposals',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'An agent never changes the schema itself: it **proposes**. The proposal waits in the base’s “Agent proposals” queue, where a person who can modify the schema approves or rejects it; without a decision, it expires after 24 hours. Once approved, it is applied on behalf of the person who created the token — if that person still has the right to do so — and appears in the history like any other change.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'At most 5 pending proposals per token; a new proposal on the same object replaces the previous one (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'No deletion, no renaming, no cascading relation (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'What doesn’t exist',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'No tool deletes several rows at once, a table, or a field, runs SQL, or manages permissions or tokens. An agent that calls such a name — `delete_records`, `run_sql`… — gets `MCP_OPERATION_EXCLUDED`, whatever base is targeted.',
  Bornes: 'Limits',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 25 rows by default, 100 at most.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'A filter has at most 10 predicates, combined with AND; a sort, at most 3 fields.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'In a list, a text longer than 500 characters is truncated and named in `_truncated_fields`; `get_record` with `full_fields` returns it in full.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'A write accepts an `idempotency_key`: replaying it does not create a duplicate.',
  'Ce que voit un agent': 'What an agent sees',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'An agent never sees more than the person who created its token — and often less.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Permissions**: the token’s own, cross-checked on every call against its creator’s. If that person’s permissions drop, the token’s drop with them; if their account is disabled, the token stops responding.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Read, create, update** — and delete, one row at a time, only with a token created for that. A read-only token refuses any write (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**This base**: open to agents.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**This base**: **closed to agents** — no tool sees it.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Columns reserved for humans**: none in what you see of this base.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Columns reserved for humans**: {columns}. To an agent, they don’t exist.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Data, not instructions**: descriptions and content are rendered as data entered by users, and the tools tell the agent so.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Log**: every call is logged by the shape of its parameters, never by their values.',
  obligatoire: 'required',
  'calculé par l’IA': 'computed by AI',
  'lecture seule': 'read-only',
  'HTML riche — **à assainir à l’affichage**': 'Rich HTML — **to sanitize on display**',
  'invisible pour les agents': 'invisible to agents',
  'relation → {table}': 'relation → {table}',
  'Valeurs : {values}.': 'Values: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'target not visible to you: the cell is always {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'points to {table} (no display column set: the cell shows the identifier)',
  'pointe vers {table}, affiché par {field}': 'points to {table}, displayed by {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'on deletion: deleting the target row is refused while it is referenced',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'on deletion: deleting the target row empties this cell',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'on deletion: deleting the target row also deletes this row',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'on write, accept a bare `uuid`, `null`, or `{"id": "…"}`; on read, always `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'List rows — filter, sort, cursor pagination',
  'Lire une ligne': 'Read a row',
  'Supprimer une ligne': 'Delete a row',
  'Lister les lignes qui pointent vers celle-ci': 'List the rows that point to this one',
  Méthode: 'Method',
  Chemin: 'Path',
  lire: 'read',
  créer: 'create',
  modifier: 'update',
  supprimer: 'delete',
  '**En SQL :** {sql}': '**In SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'You can {verbs}. Verbs absent from this list are not open to you, and the corresponding paths are not described.',
  'Points d’accès': 'Endpoints',
  Colonnes: 'Columns',
  Colonne: 'Column',
  Libellé: 'Label',
  Type: 'Type',
  Description: 'Description',
  'Champs relation': 'Relation fields',
  'Colonnes système': 'System columns',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Always readable, never writable. They carry cursor pagination and incremental sync, and no setting hides them.',
  Expansion: 'Expansion',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — depth 1, without exception. Linked objects arrive in `included`, indexed by table name then by identifier, and are not nested inside the row: 100 rows pointing to 3 targets carry 3 objects.',
  'Lignes référençantes': 'Referencing rows',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} lists the rows that point to a given row. A block whose source table is not visible to you does not appear there at all — no block, no count, no mention.',
  'une table que vous ne voyez pas': 'a table you cannot see',
  'Vue d’ensemble': 'Overview',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'This base is called {name} — that’s the name of the **PostgreSQL schema**, and the one you write in your URLs as well as in tool calls. Tables and columns carry the same names here and in SQL: there is no mapping table to consult.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Two doors, the same permissions: the **REST API** for your programs, the **MCP server** for AI agents. Each table page says how to reach it through either one.',
  Élément: 'Item',
  Valeur: 'Value',
  'Schéma PostgreSQL': 'PostgreSQL schema',
  'Préfixe des routes REST': 'REST route prefix',
  'ouverte — voir « Connecter un agent »': 'open — see “Connect an agent”',
  '**fermée aux agents**': '**closed to agents**',
  'Tables visibles': 'Visible tables',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, in an envelope {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**This documentation describes what YOU can see.** Two readers get two different versions of it, and that is the rule, not a side effect. Do not publish it as is.',
  Authentification: 'Authentication',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'All data routes require a **token**, in the `Authorization` header. The session cookie is never accepted here: a browser sends it on every request, including those triggered by a foreign page.',
  'Jeton d’intégration': 'Integration token',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'A program — a script, a sync, another application — presents an **integration token**, which starts with `bdb_`. It is only valid for this base — all its environments, or just one. It reads, creates and updates if it was created with write access, and **only deletes if it was created for that**; it never has more permissions than the person who created it, cross-checked on every call. Administration, the SQL console and AI remain closed to it.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'To create one: the base’s “⋯” menu → **API and agents** → **API and MCP tokens…**, with **REST API** access checked. It is shown only once.',
  Appel: 'Call',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Missing authentication answers `401`, never `404`: you must be able to sign in again.',
  Environnement: 'Environment',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    'A token created for the whole base opens all its environments. The path names the base — {base} is the production — and the {header} header chooses the environment; `?environment=` does the same for a client that doesn’t set a header. With neither, the environment is the one the base name designates.',
  Conventions: 'Conventions',
  Enveloppe: 'Envelope',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'All responses have the same shape: {envelope}. An error replaces `data` with the code, the details and the request identifier.',
  Nombres: 'Numbers',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Numbers are decimal strings**, without exception: {example}. A float would silently round an amount.',
  montant: 'amount',
  'Ressource invisible': 'Invisible resource',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**An invisible resource and a nonexistent resource answer the same thing**, byte for byte. A `404` never tells you whether the object exists.',
  Pagination: 'Pagination',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Cursor pagination**: follow `meta.has_next_page` and pass `after`. There is no export route.',
  'Identifiants seuls': 'Identifiers only',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'For an integration that only wants identifiers, `?links=id` removes label resolution — and just as many SQL round trips.',
  Relations: 'Relations',
  'Aucune relation visible dans cette base.': 'No relation visible in this base.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relations are **real PostgreSQL foreign keys**. They are checked by the database, not by the application: a direct SQL `INSERT` is subject to the same rules.',
  'Codes de réponse': 'Response codes',
  Statut: 'Status',
  Signification: 'Meaning',
  'Succès.': 'Success.',
  'Ligne créée.': 'Row created.',
  'Suppression réussie, sans contenu.': 'Deletion successful, no content.',
  'Authentification absente ou refusée.': 'Missing or refused authentication.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Nonexistent **or** invisible resource — both responses are identical.',
  'Suppression refusée : la ligne est encore référencée.':
    'Deletion refused: the row is still referenced.',
  'Valeur refusée par la validation.': 'Value refused by validation.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'An error always has this shape, and `request_id` is what to quote to support:',
  'La liste complète des codes est servie par {route}.':
    'The full list of codes is served by {route}.',
  'Côté MCP': 'On the MCP side',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'A refusal arrives as a tool result marked `isError`, whose text is a stable JSON object: the same `code` as the API, a fixed sentence, and a `hint` that says how to fix the call. `retryable` says whether it is worth retrying as is.',
  'Écrire en SQL direct': 'Writing in direct SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Open `psql`: it works, that’s the point of the product.',
  'Ce qui vous attend :': 'What awaits you:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Constraints apply — required, length, foreign key. A referenced row cannot be deleted.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'System columns do not fill themselves in a manual `INSERT`: `_id`, `_created_at` and `_updated_at` have default values, `_created_by` and `_updated_by` expect a user identifier.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedb’s permissions do not apply in direct SQL.** They govern the product’s surfaces — API, interface, MCP. A PostgreSQL connection sees everything its role sees. This is said here because promising otherwise would be worse than promising nothing.',
  '{base} — documentation API et MCP': '{base} — API and MCP documentation',
}

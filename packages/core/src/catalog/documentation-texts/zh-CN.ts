import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Simplified Chinese: the French sentence of `documentation.ts` → its translation. */
export const zhCN: Catalog = {
  'Prise en main': '快速上手',
  'API REST': 'REST API',
  'Agents (MCP)': '智能体 (MCP)',
  Tables: '数据表',
  Référence: '参考',
  texte: '文本',
  'texte long': '长文本',
  'nombre (chaîne décimale)': '数字（十进制字符串）',
  booléen: '布尔值',
  'date (`2026-09-18`)': '日期（`2026-09-18`）',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'UTC 日期时间（`2026-09-18T14:03:00.000Z`）',
  'liste de choix': '单选',
  'choix multiple (liste de valeurs)': '多选（值列表）',
  'relation (`_id` de la ligne liée)': '关联（所关联行的 `_id`）',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    '多重关联（按顺序排列的所关联行 `_id` 列表）',
  'lien URL (`https://…` ou `mailto:…`)': 'URL 链接（`https://…` 或 `mailto:…`）',
  'adresse e-mail': '电子邮件地址',
  'numéro automatique (lecture seule)': '自动编号（只读）',
  'personne (`id` d’un membre de l’espace)': '人员（工作区成员的 `id`）',
  formule: '公式',
  'documents (liste de fichiers)': '文档（文件列表）',
  'images (liste de fichiers)': '图片（文件列表）',
  'colonne système': '系统列',
  'Un texte plus long.': '一段更长的文本。',
  valeur: '值',
  Exemple: '示例',
  résultat: '结果',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'quote.pdf',
  Exemples: '示例',
  'Lister les lignes': '列出行',
  Réponse: '响应',
  'Créer une ligne': '创建一行',
  'Déposer un fichier': '上传文件',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    '请求体即为文件本身。响应会返回一个 `id`，之后需将其写入 {field}：{write}。',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    '令牌的身份信息：创建者、所属数据库、实际权限及配额。',
  'Les bases que le jeton peut lire.': '令牌可以读取的数据库。',
  'Les tables d’une base et le graphe de leurs relations.': '数据库中的数据表及其关联关系图。',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    '数据表的字段：类型、是否必填、选项、关联，以及哪些可以修改。',
  'Lire des lignes : filtre, tri, pagination par curseur.': '读取行：筛选、排序、游标分页。',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    '通过 `_id` 读取一行；如有需要，可返回完整的长文本内容。',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    '在写入关联之前，通过显示值查找一行的 `_id`。',
  'Créer une ligne.': '创建一行。',
  'Modifier les champs nommés d’une ligne.': '修改一行中指定的字段。',
  'Proposer une table et ses premiers champs — une personne décide.':
    '提议创建一个数据表及其初始字段——由人决定是否采纳。',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    '提议添加一个字段、一个单选列表，或一个关联——由人决定是否采纳。',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    '提议数据表的颜色和图标，以及其中列表各选项的颜色和图标——由人决定是否采纳。',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    '查看令牌提交的某个提议，了解其处理结果。',
  'dépôt basedb': 'basedb 仓库',
  'Depuis un agent (MCP)': '通过智能体 (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    '此数据库未对智能体开放：无论使用何种令牌，MCP 工具都无法看到此数据表。',
  'Connaître ses champs, et lesquels sont modifiables': '查看其字段，以及哪些可以修改',
  'Lire ses lignes — filtre, tri, pagination': '读取其行——筛选、排序、分页',
  'Lire une ligne par son `_id`': '通过 `_id` 读取一行',
  'Trouver une ligne par sa valeur d’affichage, {field}': '通过显示值查找一行，{field}',
  'Modifier une ligne': '修改一行',
  'Aucun outil ne vous est ouvert sur cette table.': '此数据表没有对您开放的工具。',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    '您创建的令牌权限永远不会超过您本人：以上工具已是上限。',
  Outil: '工具',
  Pour: '用途',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    '删除一行，使用专门为删除创建的令牌——响应中会返回该行。',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    '按 `_id` 从历史记录中恢复已删除的行。',
  'Supprimer une ligne — avec un jeton créé pour supprimer': '删除一行——使用专门为删除创建的令牌',
  'Ramener une ligne supprimée': '恢复已删除的行',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    '智能体只有在令牌被创建为“读写和删除”权限时才会删除，且一次只删除一行；已删除的行可以通过 `restore_record` 或从历史记录中恢复。',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**对智能体不可见：** {fields}。对它而言，这些列并不存在：它既不能读取，也不能筛选或写入。',
  'Arguments d’un appel': '调用参数',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    '为此数据库创建令牌需要**可管理**权限，而您目前没有该权限。请向管理此数据库的人申请。',
  '<jeton>': '<token>',
  'Connecter un agent': '连接智能体',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedb 的 **MCP 服务器**可以将此数据库开放给 AI 智能体——Claude 或任意 MCP 客户端：它会发现该数据库、读取其中的数据，并且如果您允许，还可以创建、修改和删除行。它使用与 REST API 相同的权限。',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**此数据库未对智能体开放。**在开放之前，无论提供何种令牌，任何工具都无法看到它。',
  'Créer un jeton': '创建令牌',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    '在界面中，依次点击数据库的“⋯”菜单 → **API 与智能体** → **API 和 MCP 令牌…**，勾选 **MCP** 访问权限。该令牌可开放**整个数据库及其所有环境**——生产、预发布……——如果您加以限制，也可以只开放其中一个环境。令牌默认**只读**：如需写入权限或删除权限，需显式勾选。它只会显示一次，并可在同一界面中撤销。同时勾选 **REST API** 时，同一个令牌也可供程序使用（参见“身份验证”）。',
  'Garder le jeton hors de la configuration': '让令牌远离配置文件',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    '令牌应保存在环境变量 `BASEDB_TOKEN` 中，绝不能放进客户端的配置文件：配置文件会被纳入版本管理、同步，并且可以被会话中的所有程序读取。',
  'Déclarer le serveur dans le client': '在客户端中声明服务器',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    '使用 HTTP 传输 MCP 的客户端（例如 Claude Code）可以直接访问服务器地址 `…/mcp`，并带上请求头 {header}。在项目的 `.mcp.json` 文件中，`${BASEDB_TOKEN}` 会从环境变量中读取：令牌不会写入该文件。同一个令牌可以为每个环境各声明一个服务器。',
  'Client sans HTTP : le relais': '不支持 HTTP 的客户端：中继程序',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    '只能启动本地程序（stdio）的客户端，通过**中继程序** `relay.js` 工作，由它将消息转发给服务器。它会从 `--token-env` 指定的变量中读取令牌——如果未指定，则默认使用 `BASEDB_MCP_TOKEN`——从 `--url`（或 `BASEDB_MCP_URL`）中获取服务器地址，并从 `--environment`（或 `BASEDB_MCP_ENVIRONMENT`）中获取环境。',
  'Autre client MCP': '其他 MCP 客户端',
  'votre-instance': 'your-instance',
  recette: 'staging',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    '令牌只在创建时勾选过的访问范围内有效：仅勾选“MCP”的令牌会被 REST API 拒绝，反之亦然。',
  'Choisir l’environnement': '选择环境',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    '一个数据库可以有多个环境——生产、预发布、开发——每个环境都有各自的数据表和行。覆盖整个数据库的令牌可以访问所有环境；环境在调用时选择，下面按范围从大到小列出：',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**数据库名称**，不加任何其他内容：{base} 即生产环境，而每个环境也都有各自的名称。',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**服务器地址**：{address}——每个环境声明一个服务器。',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '每个需要指定数据库的工具的 **`environment` 参数**，仅对单次调用生效：{example}。',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    '环境以其徽标上的名称指定，不区分大小写和重音符号，也可以写作 `production`。数据库中不存在的环境会返回 `RESOURCE_NOT_FOUND`。',
  Vérifier: '验证',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    '让智能体调用 `whoami`：它会返回创建该令牌的人、令牌所限定的数据库、令牌可访问的环境（`scope.available`），以及其实际权限。',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    '关于外观：在 `propose_create_table` 以及 `propose_add_field` 的选项中使用 `color` 和 `icon`；对已存在的数据表则使用 `propose_update_look`。',
  'Couleurs et pictogrammes': '颜色和图标',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    '与应用中一样，数据表以及列表的每个选项都有颜色和图标。`color` 是形如 `#rrggbb` 的颜色；`icon` 是应用所绘制图标之一的名称——工具的参数结构中列出了全部名称。省略某个键则保留现有值，`null` 则将其清除。`describe_base` 和 `describe_table` 会返回当前的外观。',
  Outils: '工具',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} 个工具，且始终固定不变：它们的名称和描述从不取决于您的数据。调用它们即可发现其参数结构。',
  Rôle: '作用',
  Écrit: '写入',
  oui: '是',
  propose: '提议',
  non: '否',
  'Enchaînement type': '典型调用流程',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`，然后 `describe_base`：了解现有的数据库和数据表。',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '在读取或写入之前先调用 `describe_table`：查看字段、类型，以及令牌可以写入的字段（`access: "write"`）。',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` 可以搭配 `filter`、`sort` 和 `limit` 使用；只要 `has_more` 为 `true`，就继续传入 `cursor` 分页。',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    '要写入一个关联：先在目标数据表上调用 `lookup_records`，然后使用查到的 `_id` 调用 `create_record` 或 `update_record`。',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    '要调整结构：调用 `propose_create_table` 或 `propose_add_field`，然后用 `get_proposal` 跟踪处理结果。',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    '要删除：先调用 `get_record` 确认是哪一行，然后调用 `delete_record`——它会在响应中返回该行；`restore_record` 可以将其恢复。',
  'Propositions de structure': '结构提议',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    '智能体从不会自行修改结构：它只能**提议**。提议会进入数据库的“智能体提议…”队列，等待有权修改结构的人批准或拒绝；如果一直没有决定，提议会在 24 小时后过期。一旦获批，系统会以创建该令牌的人的名义应用该提议——前提是此人仍拥有相应权限——并像其他任何修改一样出现在历史记录中。',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    '每个令牌最多同时有 5 个待处理提议；针对同一对象的新提议会替换之前的提议（`superseded`）。',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    '不支持删除、重命名，也不支持级联关联（`MCP_CASCADE_FORBIDDEN`）。',
  'Ce qui n’existe pas': '不存在的操作',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    '没有任何工具会一次删除多行、删除数据表或字段，也不会执行 SQL，或管理权限和令牌。智能体若调用此类名称——`delete_records`、`run_sql`…——无论目标数据库是哪一个，都会收到 `MCP_OPERATION_EXCLUDED`。',
  Bornes: '限制',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`：默认 25 行，最多 100 行。',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    '一个筛选条件最多包含 10 个谓词，以“与”组合；排序最多使用 3 个字段。',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    '在列表中，超过 500 个字符的文本会被截断，并记录在 `_truncated_fields` 中；使用 `full_fields` 调用 `get_record` 可获取完整内容。',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    '写入操作可以带上 `idempotency_key`：重复提交不会产生重复数据。',
  'Ce que voit un agent': '智能体能看到什么',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    '智能体看到的内容永远不会超过创建其令牌的人——通常还会更少。',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**权限**：即令牌自身的权限，每次调用都会与创建者当前的权限取交集。如果此人的权限降低，令牌的权限也会随之降低；如果此人的账户被停用，令牌将不再响应。',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**读取、创建、修改**——以及删除，一次一行，但仅限专门为此创建的令牌。只读令牌会拒绝任何写入操作（`TOKEN_READ_ONLY`）。',
  '**Cette base** : ouverte aux agents.': '**此数据库**：已对智能体开放。',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**此数据库**：**未对智能体开放**——没有任何工具能看到它。',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**仅限人类查看的列**：在您能看到的此数据库范围内，没有这样的列。',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**仅限人类查看的列**：{columns}。对智能体而言，这些列并不存在。',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**是数据，不是指令**：描述和内容都作为用户输入的数据呈现，工具会明确告知智能体这一点。',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**日志**：每次调用都只记录参数的结构，从不记录参数的值。',
  obligatoire: '必填',
  'calculé par l’IA': '由 AI 计算',
  'lecture seule': '只读',
  'HTML riche — **à assainir à l’affichage**': '富文本 HTML——**显示时需自行净化**',
  'invisible pour les agents': '对智能体不可见',
  'relation → {table}': '关联 → {table}',
  'Valeurs : {values}.': '取值：{values}。',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    '目标对您不可见：该单元格的值始终为 {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    '指向 {table}（未指定显示列：单元格显示的是标识符）',
  'pointe vers {table}, affiché par {field}': '指向 {table}，以 {field} 显示',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    '删除时：只要目标行仍被引用，就无法删除它',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    '删除时：删除目标行会清空此单元格',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    '删除时：删除目标行也会删除此行',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    '写入时，接受裸 `uuid`、`null`，或 `{"id": "…"}`；读取时，始终返回 `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur': '列出行——筛选、排序、游标分页',
  'Lire une ligne': '读取一行',
  'Supprimer une ligne': '删除一行',
  'Lister les lignes qui pointent vers celle-ci': '列出指向此行的所有行',
  Méthode: '方法',
  Chemin: '路径',
  lire: '读取',
  créer: '创建',
  modifier: '修改',
  supprimer: '删除',
  '**En SQL :** {sql}': '**在 SQL 中：** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    '您可以{verbs}。未包含在此列表中的操作您无权使用，相应路径也不会被说明。',
  'Points d’accès': '端点',
  Colonnes: '列',
  Colonne: '列',
  Libellé: '显示名称',
  Type: '类型',
  Description: '描述',
  'Champs relation': '关联字段',
  'Colonnes système': '系统列',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    '始终可读，从不可写。它们承载着游标分页和增量续传功能，且没有任何设置可以将其隐藏。',
  Expansion: '展开',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — 统一按 1 层展开，没有例外。关联对象出现在 `included` 中，先按数据表名称、再按标识符建立索引，而不嵌套在行内：100 行指向 3 个目标时，也只携带 3 个对象。',
  'Lignes référençantes': '反向引用行',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} 用于列出所有指向给定行的行。如果来源数据表对您不可见，相应的区块完全不会出现——没有区块、没有计数，也没有任何提示。',
  'une table que vous ne voyez pas': '一张您看不到的数据表',
  'Vue d’ensemble': '总览',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    '此数据库名为 {name}——这是它的 **PostgreSQL 模式**名称，也是您在 URL 和工具调用中所使用的名称。数据表和列在这里与在 SQL 中使用的是同一套名称：不存在需要查阅的对照表。',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    '两种访问方式，权限完全相同：**REST API** 供您的程序使用，**MCP 服务器** 供 AI 智能体使用。每个数据表页面都会说明如何通过这两种方式访问它。',
  Élément: '项目',
  Valeur: '值',
  'Schéma PostgreSQL': 'PostgreSQL 模式',
  'Préfixe des routes REST': 'REST 路由前缀',
  'ouverte — voir « Connecter un agent »': '已开放——参见“连接智能体”',
  '**fermée aux agents**': '**未对智能体开放**',
  'Tables visibles': '可见数据表',
  Format: '格式',
  'JSON, dans une enveloppe {envelope}': 'JSON，外层结构为 {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**本文档描述的是您本人能看到的内容。**不同的读者会得到不同版本的文档，这是设计使然，而非偶然现象。请不要原样对外发布本文档。',
  Authentification: '身份验证',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    '所有数据路由都需要在 `Authorization` 请求头中提供**令牌**。这里绝不接受会话 Cookie：因为浏览器会在每个请求中自动带上它，包括由外部页面触发的请求。',
  'Jeton d’intégration': '集成令牌',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    '程序——脚本、同步任务、其他应用——需要出示一个**集成令牌**，其前缀为 `bdb_`。它仅对此数据库有效——涵盖其所有环境，或仅限其中一个环境；可以读取，如果创建时授予了写入权限，还可以创建和修改，并且**只有在专门为删除而创建时才会删除**；它的权限永远不会超过创建它的人，且每次调用都会与此人的当前权限取交集。管理后台、SQL 控制台和 AI 功能对它始终关闭。',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    '创建方法：依次点击数据库的“⋯”菜单 → **API 与智能体** → **API 和 MCP 令牌…**，勾选 **REST API** 访问权限。它只会显示一次。',
  Appel: '调用',
  Environnement: '环境',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    '为整个数据库创建的令牌可以访问其所有环境。路径指明数据库——{base} 即生产环境——请求头 {header} 用于选择环境；对于不发送请求头的客户端，`?environment=` 的作用相同。两者都未提供时，使用的是数据库名称所对应的环境。',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    '缺少身份验证时会返回 `401`，绝不会返回 `404`：这样您才能重新登录。',
  Conventions: '约定',
  Enveloppe: '响应结构',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    '所有响应的结构都是一致的：{envelope}。发生错误时，`data` 会被替换为错误代码、详细信息和请求标识符。',
  Nombres: '数字',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**数字一律以十进制字符串表示**，没有例外：{example}。使用浮点数会在不知不觉中把金额四舍五入。',
  montant: 'amount',
  'Ressource invisible': '不可见的资源',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**不可见的资源和不存在的资源返回的内容完全相同**，逐字节一致。`404` 永远不会告诉您对象是否存在。',
  Pagination: '分页',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**游标分页**：请关注 `meta.has_next_page`，并传入 `after` 参数。系统没有提供任何导出路由。',
  'Identifiants seuls': '仅标识符',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    '如果集成只需要标识符，`?links=id` 可以取消显示名称的解析——从而减少相应的 SQL 往返查询。',
  Relations: '关联',
  'Aucune relation visible dans cette base.': '此数据库中没有可见的关联。',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    '关联都是**真正的 PostgreSQL 外键**。它们由数据库本身校验，而非应用程序：直接执行 SQL 的 `INSERT` 也要遵守相同的规则。',
  'Codes de réponse': '响应代码',
  Statut: '状态码',
  Signification: '含义',
  'Succès.': '成功。',
  'Ligne créée.': '行已创建。',
  'Suppression réussie, sans contenu.': '删除成功，无返回内容。',
  'Authentification absente ou refusée.': '缺少身份验证或验证被拒绝。',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    '资源不存在**或**不可见——两种情况的响应完全相同。',
  'Suppression refusée : la ligne est encore référencée.': '删除被拒绝：该行仍被引用。',
  'Valeur refusée par la validation.': '值未通过校验。',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    '错误始终采用这种形式，联系支持时请提供其中的 `request_id`：',
  'La liste complète des codes est servie par {route}.': '完整的错误代码列表由 {route} 提供。',
  'Côté MCP': 'MCP 端',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    '拒绝会以标记为 `isError` 的工具结果形式返回，其文本是一个格式稳定的 JSON 对象：包含与 API 相同的 `code`、一句固定的说明文字，以及说明如何修正调用的 `hint`。`retryable` 则表示是否值得原样重试。',
  'Écrire en SQL direct': '直接通过 SQL 写入',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    '打开 `psql` 就能使用：这正是本产品的设计目的。',
  'Ce qui vous attend :': '您需要注意的是：',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    '各项约束依然生效——必填、长度、外键。被引用的行无法删除。',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    '在手动执行 `INSERT` 时，系统列不会自动填充：`_id`、`_created_at` 和 `_updated_at` 有默认值，而 `_created_by` 和 `_updated_by` 则需要提供用户标识符。',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedb 的权限体系不适用于直接 SQL。**它们只管辖产品自身的入口——API、界面、MCP。PostgreSQL 连接能看到其角色所能看到的一切。之所以在此说明这一点，是因为做出相反的承诺，比什么都不承诺更糟糕。',
  '{base} — documentation API et MCP': '{base} — API 与 MCP 文档',
}

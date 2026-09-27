import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Japanese: the French sentence of `documentation.ts` → its translation. */
export const ja: Catalog = {
  'Prise en main': 'はじめに',
  'API REST': 'REST API',
  'Agents (MCP)': 'エージェント（MCP）',
  Tables: 'テーブル',
  Référence: 'リファレンス',
  texte: '短文テキスト',
  'texte long': '長文テキスト',
  'nombre (chaîne décimale)': '数値（10進数の文字列）',
  booléen: 'ブール値',
  'date (`2026-09-18`)': '日付（`2026-09-18`）',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'UTC日時（`2026-09-18T14:03:00.000Z`）',
  'liste de choix': '単一選択',
  'choix multiple (liste de valeurs)': '複数選択（値のリスト）',
  'relation (`_id` de la ligne liée)': 'リレーション（リンク先の行の `_id`）',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    '複数リレーション（リンク先の行の `_id` のリスト。順序を保持）',
  'lien URL (`https://…` ou `mailto:…`)': 'URL（`https://…` または `mailto:…`）',
  'adresse e-mail': 'メールアドレス',
  'numéro automatique (lecture seule)': '自動採番（読み取り専用）',
  'personne (`id` d’un membre de l’espace)': 'メンバー（ワークスペースのメンバーの `id`）',
  formule: '数式',
  'documents (liste de fichiers)': 'ドキュメント（ファイルのリスト）',
  'images (liste de fichiers)': '画像（ファイルのリスト）',
  'colonne système': 'システム列',
  'Un texte plus long.': 'もう少し長いテキストです。',
  valeur: '値',
  Exemple: '例',
  résultat: '結果',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'quote.pdf',
  Exemples: 'サンプル',
  'Lister les lignes': '行の一覧取得',
  Réponse: 'レスポンス',
  'Créer une ligne': '行の作成',
  'Déposer un fichier': 'ファイルのアップロード',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    '本文はファイルそのものです。レスポンスで返される `id` を、続けて {field} に書き込みます：{write}。',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'トークンの識別情報：作成者、対象のデータベース、実効権限、使用上限。',
  'Les bases que le jeton peut lire.': 'トークンが読み取れるデータベース。',
  'Les tables d’une base et le graphe de leurs relations.':
    'データベース内のテーブルと、その間のリレーションのグラフ。',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'テーブルのフィールド：型、必須かどうか、選択肢、リレーション、そして変更可能かどうか。',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    '行の読み取り：フィルター、並べ替え、カーソルによるページネーション。',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    '`_id` を指定して1行を読み取ります。長文テキストは、指定すれば全文が返されます。',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'リレーションを書き込む前に、表示値から行の `_id` を検索します。',
  'Créer une ligne.': '行を作成します。',
  'Modifier les champs nommés d’une ligne.': '行の指定したフィールドを変更します。',
  'Proposer une table et ses premiers champs — une personne décide.':
    'テーブルと最初のフィールドを提案します — 判断するのは人です。',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'フィールド、選択肢リスト、またはリレーションを提案します — 判断するのは人です。',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'トークンが行った提案を確認し、その後どうなったかを把握します。',
  'dépôt basedb': 'basedbのリポジトリ',
  'Depuis un agent (MCP)': 'エージェント（MCP）から',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'このデータベースはエージェントに公開されていません。トークンの種類にかかわらず、MCPツールからはこのテーブルが見えません。',
  'Connaître ses champs, et lesquels sont modifiables': 'フィールドとその変更可否を確認する',
  'Lire ses lignes — filtre, tri, pagination':
    '行を読み取る — フィルター、並べ替え、ページネーション',
  'Lire une ligne par son `_id`': '`_id` を指定して行を読み取る',
  'Trouver une ligne par sa valeur d’affichage, {field}': '表示値（{field}）から行を検索する',
  'Modifier une ligne': '行を変更する',
  'Aucun outil ne vous est ouvert sur cette table.':
    'このテーブルに対して使えるツールはありません。',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    '作成したトークンの権限が、自分自身の権限を超えることはありません。これらのツールが、その上限です。',
  Outil: 'ツール',
  Pour: '用途',
  'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.':
    '行の削除は、引き続きREST APIとインターフェースだけができます。MCPツールで削除できるものはありません。',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**エージェントには見えません：** {fields}。エージェントにとって、これらの列は存在しません。読み取ることも、フィルターに使うことも、書き込むこともできません。',
  'Arguments d’un appel': '呼び出しの引数',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'このデータベースでトークンを作成するには**管理**レベルの権限が必要ですが、現在その権限はありません。管理者に発行を依頼してください。',
  '<jeton>': '<token>',
  'Connecter un agent': 'エージェントをつなぐ',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedbの**MCPサーバー**は、このデータベースをAIエージェント — Claude、または任意のMCPクライアント — に公開します。エージェントはこれを検出し、読み取り、許可すればこの中の行を作成・変更します。使われる権限はREST APIと同じです。',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**このデータベースはエージェントに公開されていません。** 公開されるまでは、どのトークンを使ってもツールからは見えません。',
  'Créer un jeton': 'トークンを作成',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'インターフェースでは、データベースの「⋯」メニュー → **APIとエージェント** → **APIとMCPのトークン…** から、**MCP** アクセスにチェックを入れます。トークンはこのデータベースに限定され、既定では**読み取り専用**です。書き込みを行うには明示的に選択します。トークンは一度しか表示されず、同じ画面から取り消せます。**REST API** にもチェックを入れれば、同じトークンをプログラムから利用できます（「認証」を参照）。',
  'Garder le jeton hors de la configuration': 'トークンを設定ファイルの外に置く',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'トークンは環境変数 `BASEDB_TOKEN` に設定し、クライアントの設定ファイルには置きません。設定ファイルはバージョン管理され、同期され、そのセッションの全プログラムから読み取れるためです。',
  'Déclarer le serveur dans le client': 'クライアントにサーバーを登録する',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'クライアントは**中継プログラム**の `relay.js` を起動し、これがメッセージをサーバーまで転送します。トークンは `--token-env` で指定した変数から読み込まれます — 指定がなければ `BASEDB_MCP_TOKEN` です — サーバーのアドレスは `--url`（または `BASEDB_MCP_URL`）から読み込まれます。',
  'Autre client MCP': 'その他のMCPクライアント',
  'votre-instance': 'your-instance',
  'Sans relais': '中継プログラムを使わない場合',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'HTTPでMCPを話すクライアントは、ヘッダー {header} を付けてサーバーのアドレス `…/mcp` に直接アクセスします。トークンは、作成時にチェックを入れたアクセス種別でのみ有効です。「MCP」だけのトークンはREST APIに拒否され、その逆も同様です。',
  Vérifier: '確認する',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'エージェントに `whoami` を呼び出してもらってください。呼び出すと、トークンを作成した人、対象のデータベース、実効権限が返されます。',
  Outils: 'ツール',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} 個のツールがあり、常に同じ内容です。名前と説明はデータの内容によって変わることはありません。スキーマは呼び出すことで確認できます。',
  Rôle: '役割',
  Écrit: '書き込み',
  oui: 'はい',
  propose: '提案',
  non: 'いいえ',
  'Enchaînement type': '基本的な操作の流れ',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases` の後に `describe_base`：存在するものを確認します。',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '読み取りや書き込みの前に `describe_table` を呼び出します。フィールド、その型、そしてトークンが書き込めるフィールド（`access: "write"`）がわかります。',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`filter`、`sort`、`limit` を指定して `list_records` を呼び出します。`has_more` が `true` の間は `cursor` で読み進めます。',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'リレーションを書き込むには、対象テーブルに対して `lookup_records` を呼び出し、見つかった `_id` を使って `create_record` または `update_record` を呼び出します。',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    '構造を変更するには、`propose_create_table` または `propose_add_field` を呼び出し、`get_proposal` で判断結果を確認します。',
  'Propositions de structure': '構造の変更提案',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'エージェントが自ら構造を変更することはありません。エージェントは**提案する**だけです。提案はデータベースの「エージェントの提案」の一覧で待機し、構造を変更できる人が承認または却下します。判断がなければ24時間で失効します。承認されると、トークンを作成した人の名前で適用され — その人が今も権限を持っている場合に限り — 変更履歴には他の変更と同様に記録されます。',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    '1つのトークンにつき、保留中の提案は最大5件です。同じ対象への新しい提案は、直前の提案を置き換えます（`superseded`）。',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    '削除、名前変更、連鎖的なリレーションの追加はできません（`MCP_CASCADE_FORBIDDEN`）。',
  'Ce qui n’existe pas': '存在しない操作',
  'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    '行を削除したり、SQLを実行したり、権限やトークンを管理したりするツールはありません。`delete_record`、`run_sql`… のような名前を呼び出したエージェントは — 対象のデータベースにかかわらず — `MCP_OPERATION_EXCLUDED` を受け取ります。',
  Bornes: '上限',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`：既定は25行、最大100行です。',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'フィルターの述語は最大10個までで、AND で組み合わせます。並べ替えは最大3フィールドまでです。',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    '一覧では、500文字を超えるテキストは切り詰められ、`_truncated_fields` に名前が記録されます。`full_fields` を指定して `get_record` を呼び出すと、全文が返されます。',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    '書き込みには `idempotency_key` を指定できます。同じキーで再送しても重複は作成されません。',
  'Ce que voit un agent': 'エージェントから見えるもの',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'エージェントが見られる範囲は、トークンを作成した人の範囲を超えることはありません — むしろ、それより狭いことがほとんどです。',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**権限**：トークンの権限は、呼び出しのたびに作成者本人の権限と照合されます。その人の権限が下がれば、トークンの権限も一緒に下がります。アカウントが無効化されると、トークンは応答しなくなります。',
  '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**読み取り、作成、変更** — 削除は決してできません。読み取り専用のトークンは、あらゆる書き込みを拒否します（`TOKEN_READ_ONLY`）。',
  '**Cette base** : ouverte aux agents.': '**このデータベース**：エージェントに公開されています。',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**このデータベース**：**エージェントには非公開**です — どのツールからも見えません。',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**人専用の列**：このデータベースで見えている範囲には、該当する列はありません。',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**人専用の列**：{columns}。エージェントにとって、これらは存在しません。',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**指示ではなくデータ**：説明文や内容はユーザーが入力したデータとして渡され、ツールもエージェントにそう伝えます。',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**ログ**：各呼び出しは、パラメーターの値ではなく形だけが記録されます。',
  obligatoire: '必須',
  'calculé par l’IA': 'AIが計算',
  'lecture seule': '読み取り専用',
  'HTML riche — **à assainir à l’affichage**': 'リッチHTML — **表示時にサニタイズが必要**',
  'invisible pour les agents': 'エージェントには非表示',
  'relation → {table}': 'リレーション → {table}',
  'Valeurs : {values}.': '値：{values}。',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    '対象が見えない場合：セルの値は常に {cell} です',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    '{table} を指します（表示列が指定されていないため、セルには識別子が表示されます）',
  'pointe vers {table}, affiché par {field}': '{table} を指し、{field} で表示されます',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    '削除時の挙動：参照されている間は、対象の行を削除できません',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    '削除時の挙動：対象の行を削除すると、このセルは空になります',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    '削除時の挙動：対象の行を削除すると、この行も削除されます',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    '書き込み時は、`uuid` そのもの、`null`、または `{"id": "…"}` を指定できます。読み取り時は、常に `{"id": …, "display": …}` の形式です。',
  'Lister les lignes — filtre, tri, pagination par curseur':
    '行の一覧取得 — フィルター、並べ替え、カーソルによるページネーション',
  'Lire une ligne': '行の取得',
  'Supprimer une ligne': '行の削除',
  'Lister les lignes qui pointent vers celle-ci': 'この行を参照している行の一覧取得',
  Méthode: 'メソッド',
  Chemin: 'パス',
  lire: '読み取り',
  créer: '作成',
  modifier: '変更',
  supprimer: '削除',
  '**En SQL :** {sql}': '**SQLでは：** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    '{verbs} を行えます。このリストにない操作は許可されておらず、該当するパスも記載されていません。',
  'Points d’accès': 'エンドポイント',
  Colonnes: '列',
  Colonne: '列',
  Libellé: 'ラベル',
  Type: '型',
  Description: '説明',
  'Champs relation': 'リレーションフィールド',
  'Colonnes système': 'システム列',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    '常に読み取り可能で、書き込みはできません。カーソルによるページネーションと差分取得はこれらの列が支えており、設定によって非表示にすることもできません。',
  Expansion: '展開',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — 常に深さ1までです。リンクされたオブジェクトは行に埋め込まれず、`included` にテーブル名、続いて識別子でインデックスされて格納されます。3つの対象を指す100行があっても、転送されるオブジェクトは3つだけです。',
  'Lignes référençantes': '参照している行',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} は、指定した行を参照している行の一覧を返します。参照元のテーブルが見えない場合、そのブロックは一切表示されません — ブロックも、件数も、言及もありません。',
  'une table que vous ne voyez pas': '見えないテーブル',
  'Vue d’ensemble': '概要',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'このデータベースの名前は {name} です — これは**PostgreSQLのスキーマ**名であり、URLやツール呼び出しに指定する名前でもあります。テーブルと列は、ここでもSQLでも同じ名前を使うため、対応表を確認する必要はありません。',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'アクセス方法は2つありますが、権限は同じです。プログラム向けの**REST API**と、AIエージェント向けの**MCPサーバー**です。各テーブルのページには、両方からの到達方法が記載されています。',
  Élément: '項目',
  Valeur: '値',
  'Schéma PostgreSQL': 'PostgreSQLのスキーマ',
  'Préfixe des routes REST': 'RESTルートのプレフィックス',
  'ouverte — voir « Connecter un agent »': '公開されています — 「エージェントをつなぐ」を参照',
  '**fermée aux agents**': '**エージェントには非公開**',
  'Tables visibles': '表示可能なテーブル',
  Format: '形式',
  'JSON, dans une enveloppe {envelope}': 'JSON形式で、{envelope} というエンベロープに格納されます',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**このドキュメントは、閲覧者ご自身が見られる範囲を示しています。** 閲覧者が違えば内容も変わります。これは仕様であり、不具合ではありません。そのまま公開しないでください。',
  Authentification: '認証',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'すべてのデータ用ルートは、`Authorization` ヘッダーに**トークン**を必要とします。セッションクッキーはここでは一切受け付けられません。ブラウザは、外部のページが引き起こしたリクエストも含め、すべてのリクエストにクッキーを送信してしまうためです。',
  'Jeton d’intégration': '連携トークン',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'プログラム — スクリプト、連携、他のアプリケーションなど — は `bdb_` で始まる**連携トークン**を提示します。これはこのデータベースだけに有効です。読み取りを行い、書き込み権限で作成されていれば作成や変更も行いますが、**削除だけは決して行いません**。また、権限は作成した人の権限を、呼び出しのたびに照合したうえで、常にそれ以下です。管理画面、SQLコンソール、AIへのアクセスは閉じられています。',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    '作成するには、データベースの「⋯」メニュー → **APIとエージェント** → **APIとMCPのトークン…** から、**REST API** アクセスにチェックを入れます。表示されるのは一度きりです。',
  Appel: '呼び出し例',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    '認証がない場合は `401` が返り、`404` にはなりません。再ログインできる必要があるためです。',
  Conventions: '規約',
  Enveloppe: 'エンベロープ',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'すべてのレスポンスは同じ形式です：{envelope}。エラーの場合は `data` の代わりに、コード、詳細、リクエストIDが入ります。',
  Nombres: '数値',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**数値は例外なく10進数の文字列です**：{example}。浮動小数点数を使うと、金額が気づかないうちに丸められてしまいます。',
  montant: 'amount',
  'Ressource invisible': '見えないリソース',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**見えないリソースと存在しないリソースは、バイト単位でまったく同じ応答になります**。`404` だけでは対象の存在有無はわかりません。',
  Pagination: 'ページネーション',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**カーソルによるページネーション**：`meta.has_next_page` を確認し、`after` を渡します。エクスポート用のルートはありません。',
  'Identifiants seuls': '識別子のみ',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    '識別子だけを必要とする連携では、`?links=id` を指定するとラベルの解決が行われなくなります — その分のSQLの往復も省けます。',
  Relations: 'リレーション',
  'Aucune relation visible dans cette base.':
    'このデータベースに、見えるリレーションはありません。',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'リレーションは**本物のPostgreSQLの外部キー**です。検証はアプリケーションではなくデータベース側で行われるため、直接SQLで `INSERT` を行っても同じ制約が適用されます。',
  'Codes de réponse': 'レスポンスコード',
  Statut: 'ステータス',
  Signification: '意味',
  'Succès.': '成功しました。',
  'Ligne créée.': '行が作成されました。',
  'Suppression réussie, sans contenu.': '削除に成功しました。内容はありません。',
  'Authentification absente ou refusée.': '認証がないか、拒否されました。',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    '存在しない、**または**見えないリソースです — どちらの場合も応答は同じです。',
  'Suppression refusée : la ligne est encore référencée.':
    '削除が拒否されました：この行はまだ参照されています。',
  'Valeur refusée par la validation.': '値がバリデーションで拒否されました。',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'エラーは常にこの形式で返され、サポートに伝えるべきなのが `request_id` です：',
  'La liste complète des codes est servie par {route}.':
    'コードの一覧は {route} から取得できます。',
  'Côté MCP': 'MCP側',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    '拒否は `isError` を付けたツール結果として返され、その本文は決まった形のJSONオブジェクトです。APIと同じ `code`、固定の文言、そして呼び出しの直し方を示す `hint` が含まれます。`retryable` は、そのまま再試行する価値があるかどうかを示します。',
  'Écrire en SQL direct': '直接SQLで書き込む',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    '`psql` を開いてください。ちゃんと動きます — それがこの製品の狙いです。',
  'Ce qui vous attend :': '知っておくべきこと：',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    '制約は適用されます — 必須、長さ、外部キーなど。参照されている行は削除できません。',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    '手動での `INSERT` では、システム列は自動的には埋まりません。`_id`、`_created_at`、`_updated_at` には既定値がありますが、`_created_by` と `_updated_by` にはユーザーの識別子を指定する必要があります。',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedbの権限は、直接SQLには適用されません。** 権限が制御するのは、API、インターフェース、MCPといった製品の各面です。PostgreSQLの接続は、そのロールが見られる範囲をすべて見ることができます。ここであえてそう述べるのは、そうではないと約束することが、何も約束しないより悪い結果になるためです。',
  '{base} — documentation API et MCP': '{base} — APIとMCPのドキュメント',
}

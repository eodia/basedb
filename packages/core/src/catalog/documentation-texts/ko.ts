import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Korean: the French sentence of `documentation.ts` → its translation. */
export const ko: Catalog = {
  'Prise en main': '시작하기',
  'API REST': 'REST API',
  'Agents (MCP)': '에이전트(MCP)',
  Tables: '테이블',
  Référence: '참조',
  texte: '텍스트',
  'texte long': '긴 텍스트',
  'nombre (chaîne décimale)': '숫자(10진수 문자열)',
  booléen: '불리언',
  'date (`2026-09-18`)': '날짜(`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'UTC 날짜시간(`2026-09-18T14:03:00.000Z`)',
  'liste de choix': '단일 선택',
  'choix multiple (liste de valeurs)': '다중 선택(값 목록)',
  'relation (`_id` de la ligne liée)': '관계(연결된 행의 `_id`)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    '다중 관계(연결된 행들의 `_id` 목록, 순서대로)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL(`https://…` 또는 `mailto:…`)',
  'adresse e-mail': '이메일 주소',
  'numéro automatique (lecture seule)': '자동 번호(읽기 전용)',
  'personne (`id` d’un membre de l’espace)': '사람(워크스페이스 멤버의 `id`)',
  formule: '수식',
  'documents (liste de fichiers)': '파일(파일 목록)',
  'images (liste de fichiers)': '이미지(파일 목록)',
  'colonne système': '시스템 열',
  'Un texte plus long.': '더 긴 텍스트입니다.',
  valeur: '값',
  Exemple: '예시',
  résultat: '결과',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'quote.pdf',
  Exemples: '예시',
  'Lister les lignes': '행 목록 조회',
  Réponse: '응답',
  'Créer une ligne': '행 생성',
  'Déposer un fichier': '파일 업로드',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    '본문은 파일 자체입니다. 응답으로 받은 `id`를 {field}에 다음과 같이 기록하세요: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    '토큰의 신원: 만든 사람, 대상 데이터베이스, 실제 권한, 사용 한도.',
  'Les bases que le jeton peut lire.': '토큰이 읽을 수 있는 데이터베이스.',
  'Les tables d’une base et le graphe de leurs relations.':
    '데이터베이스의 테이블과 그 관계 그래프.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    '테이블의 필드: 유형, 필수 여부, 옵션, 관계, 수정 가능 여부.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    '행 읽기: 필터, 정렬, 커서 기반 페이지 매기기.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    '`_id`로 행 하나를 읽으며, 요청하면 긴 텍스트를 전체 길이로 반환합니다.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    '관계를 기록하기 전에, 표시 값으로 행의 `_id`를 찾습니다.',
  'Créer une ligne.': '행을 생성합니다.',
  'Modifier les champs nommés d’une ligne.': '행의 지정된 필드를 수정합니다.',
  'Proposer une table et ses premiers champs — une personne décide.':
    '테이블과 그 첫 필드들을 제안합니다 — 결정은 사람이 합니다.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    '필드, 선택 목록 또는 관계를 제안합니다 — 결정은 사람이 합니다.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    '토큰이 제출한 제안을 다시 확인하고 그 결과를 확인합니다.',
  'dépôt basedb': 'basedb 저장소',
  'Depuis un agent (MCP)': '에이전트(MCP)에서',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    '이 데이터베이스는 에이전트에 열려 있지 않습니다. 어떤 토큰을 사용하든 MCP 도구는 이 테이블을 볼 수 없습니다.',
  'Connaître ses champs, et lesquels sont modifiables': '필드와 수정 가능 여부 확인',
  'Lire ses lignes — filtre, tri, pagination': '행 읽기 — 필터, 정렬, 페이지 매기기',
  'Lire une ligne par son `_id`': '`_id`로 행 읽기',
  'Trouver une ligne par sa valeur d’affichage, {field}': '표시 값으로 행 찾기, {field}',
  'Modifier une ligne': '행 수정',
  'Aucun outil ne vous est ouvert sur cette table.':
    '이 테이블에서 사용할 수 있는 도구가 없습니다.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    '직접 만드는 토큰은 본인보다 많은 권한을 가질 수 없습니다. 이 도구들이 최대 범위입니다.',
  Outil: '도구',
  Pour: '용도',
  'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.':
    '행 삭제는 REST API와 인터페이스에서만 가능합니다. MCP 도구는 삭제를 지원하지 않습니다.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**에이전트에게 보이지 않음:** {fields}. 에이전트에게 이 열은 존재하지 않으며, 읽거나 필터링하거나 쓸 수 없습니다.',
  'Arguments d’un appel': '호출 인자',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    '이 데이터베이스의 토큰을 만들려면 **관리** 권한이 필요하지만, 회원님에게는 이 권한이 없습니다. 데이터베이스를 관리하는 사람에게 요청하세요.',
  '<jeton>': '<token>',
  'Connecter un agent': '에이전트 연결',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedb의 **MCP 서버**는 이 데이터베이스를 AI 에이전트에게 엽니다 — Claude든 다른 MCP 클라이언트든 상관없습니다. 에이전트는 데이터베이스를 찾아보고 읽으며, 원하는 경우 행을 생성하고 수정할 수 있습니다. 이때 적용되는 권한은 REST API와 동일합니다.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**이 데이터베이스는 에이전트에 열려 있지 않습니다.** 열리기 전까지는 어떤 토큰을 제시하더라도 어떤 도구도 이 데이터베이스를 볼 수 없습니다.',
  'Créer un jeton': '토큰 만들기',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    '인터페이스에서 데이터베이스의 “⋯” 메뉴 → **API 및 에이전트** → **API 및 MCP 토큰…**에서 **MCP** 액세스를 체크하세요. 토큰은 이 데이터베이스로 범위가 제한되며 기본적으로 **읽기 전용**이고, 쓰기 권한은 명시적으로 선택해야 합니다. 토큰은 한 번만 표시되며, 같은 화면에서 해지할 수 있습니다. **REST API**도 체크하면 같은 토큰을 프로그램에서도 사용할 수 있습니다(“인증” 참고).',
  'Garder le jeton hors de la configuration': '토큰을 설정 파일 밖에 두기',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    '토큰은 환경 변수 `BASEDB_TOKEN`에 저장하고, 클라이언트의 설정 파일에는 절대 넣지 마세요. 설정 파일은 버전 관리되고 동기화되며, 세션의 모든 프로그램이 읽을 수 있습니다.',
  'Déclarer le serveur dans le client': '클라이언트에 서버 등록',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    '클라이언트는 **릴레이** `relay.js`를 실행해 메시지를 서버까지 전달합니다. 릴레이는 `--token-env`로 지정한 변수(지정하지 않으면 `BASEDB_MCP_TOKEN`)에서 토큰을 읽고, `--url`(또는 `BASEDB_MCP_URL`)에서 서버 주소를 읽습니다.',
  'Autre client MCP': '다른 MCP 클라이언트',
  'votre-instance': 'your-instance',
  'Sans relais': '릴레이 없이',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'HTTP로 MCP와 통신하는 클라이언트는 헤더 {header}와 함께 서버 주소 `…/mcp`로 직접 접속합니다. 토큰은 만들 때 체크한 액세스에서만 허용됩니다. “MCP”만 체크된 토큰은 REST API에서 거부되며, 그 반대도 마찬가지입니다.',
  Vérifier: '확인',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    '에이전트에게 `whoami`를 호출하도록 요청하세요. 토큰을 만든 사람, 범위가 되는 데이터베이스, 실제 권한을 알려줍니다.',
  Outils: '도구',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '도구는 항상 같은 {count}개이며, 이름과 설명은 데이터에 따라 달라지지 않습니다. 스키마는 도구를 호출해야 알 수 있습니다.',
  Rôle: '역할',
  Écrit: '쓰기 여부',
  oui: '예',
  propose: '제안',
  non: '아니요',
  'Enchaînement type': '일반적인 호출 순서',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases` 다음 `describe_base`: 무엇이 있는지 확인합니다.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '읽거나 쓰기 전에 `describe_table`로 필드, 유형, 토큰이 쓸 수 있는 필드(`access: "write"`)를 확인합니다.',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records`를 `filter`, `sort`, `limit`과 함께 사용하고, `has_more`가 `true`인 동안 `cursor`로 계속 조회합니다.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    '관계를 기록하려면: 대상 테이블에 `lookup_records`를 사용한 다음, 찾은 `_id`로 `create_record` 또는 `update_record`를 호출합니다.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    '스키마를 변경하려면: `propose_create_table` 또는 `propose_add_field`를 사용한 다음, `get_proposal`로 결정 상황을 확인합니다.',
  'Propositions de structure': '스키마 변경 제안',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    '에이전트는 스키마를 직접 바꾸지 않고 **제안**만 합니다. 제안은 데이터베이스의 “에이전트 제안” 대기열에서 기다리며, 스키마를 수정할 수 있는 사람이 승인하거나 거부합니다. 결정이 없으면 24시간 후 만료됩니다. 승인되면 토큰을 만든 사람의 이름으로 적용되고 — 그 사람이 여전히 그럴 권한이 있는 경우에 한해 — 다른 변경 사항과 마찬가지로 기록에 나타납니다.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    '토큰당 대기 중인 제안은 최대 5개이며, 같은 대상에 대한 새 제안은 이전 제안을 대체합니다(`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    '삭제, 이름 변경, 연쇄 관계는 제안할 수 없습니다(`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': '존재하지 않는 기능',
  'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    '어떤 도구도 행을 삭제하거나 SQL을 실행하거나 권한·토큰을 관리하지 않습니다. 에이전트가 `delete_record`, `run_sql`… 같은 이름을 호출하면 대상 데이터베이스와 관계없이 `MCP_OPERATION_EXCLUDED`를 받습니다.',
  Bornes: '제한',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 기본값 25행, 최대 100행.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    '필터는 AND로 결합된 조건을 최대 10개까지, 정렬은 최대 3개 필드까지 사용할 수 있습니다.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    '목록 조회 시 500자를 넘는 텍스트는 잘리며 `_truncated_fields`에 표시됩니다. `full_fields`와 함께 `get_record`를 사용하면 전체 텍스트를 받을 수 있습니다.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    '쓰기 요청에는 `idempotency_key`를 사용할 수 있으며, 같은 요청을 다시 보내도 중복이 생기지 않습니다.',
  'Ce que voit un agent': '에이전트에게 보이는 범위',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    '에이전트는 토큰을 만든 사람보다 많이 볼 수 없으며, 대개는 더 적게 봅니다.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**권한**: 토큰의 권한이며, 호출할 때마다 만든 사람의 권한과 대조됩니다. 그 사람의 권한이 줄어들면 토큰의 권한도 함께 줄어들고, 계정이 비활성화되면 토큰도 응답을 멈춥니다.',
  '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**읽기, 생성, 수정**만 가능하며 삭제는 불가능합니다. 읽기 전용 토큰은 모든 쓰기를 거부합니다(`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**이 데이터베이스**: 에이전트에 열려 있습니다.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**이 데이터베이스**: **에이전트에 닫혀 있습니다** — 어떤 도구도 볼 수 없습니다.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**사람 전용 열**: 회원님이 보는 이 데이터베이스 범위에는 해당하는 열이 없습니다.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**사람 전용 열**: {columns}. 에이전트에게는 이 열이 존재하지 않습니다.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**지시가 아니라 데이터**: 설명과 내용은 사용자가 입력한 데이터로 전달되며, 도구는 이를 에이전트에게 명시합니다.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**로그**: 모든 호출은 매개변수의 형태로만 기록되며, 값은 절대 기록되지 않습니다.',
  obligatoire: '필수',
  'calculé par l’IA': 'AI가 계산',
  'lecture seule': '읽기 전용',
  'HTML riche — **à assainir à l’affichage**': '리치 HTML — **표시할 때 정제 필요**',
  'invisible pour les agents': '에이전트에게 숨김',
  'relation → {table}': '관계 → {table}',
  'Valeurs : {values}.': '값: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    '대상이 회원님에게 보이지 않음: 셀 값은 항상 {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    '{table}을(를) 가리킴(지정된 표시 열이 없어 셀에 식별자가 표시됨)',
  'pointe vers {table}, affiché par {field}': '{table}을(를) 가리키며 {field}로 표시됨',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    '삭제 시: 참조되는 동안에는 대상 행을 삭제할 수 없습니다',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    '삭제 시: 대상 행을 삭제하면 이 셀이 비워집니다',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    '삭제 시: 대상 행을 삭제하면 이 행도 함께 삭제됩니다',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    '쓸 때는 `uuid` 값 자체, `null`, 또는 `{"id": "…"}`를 받아들이고, 읽을 때는 항상 `{"id": …, "display": …}` 형식입니다',
  'Lister les lignes — filtre, tri, pagination par curseur':
    '행 목록 조회 — 필터, 정렬, 커서 기반 페이지 매기기',
  'Lire une ligne': '행 조회',
  'Supprimer une ligne': '행 삭제',
  'Lister les lignes qui pointent vers celle-ci': '이 행을 가리키는 행 목록 조회',
  Méthode: '메서드',
  Chemin: '경로',
  lire: '읽기',
  créer: '생성',
  modifier: '수정',
  supprimer: '삭제',
  '**En SQL :** {sql}': '**SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    '다음을 할 수 있습니다: {verbs}. 이 목록에 없는 동작은 허용되지 않으며, 해당 경로는 설명하지 않습니다.',
  'Points d’accès': '엔드포인트',
  Colonnes: '열',
  Colonne: '열',
  Libellé: '레이블',
  Type: '유형',
  Description: '설명',
  'Champs relation': '관계 필드',
  'Colonnes système': '시스템 열',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    '항상 읽을 수 있지만 쓸 수는 없습니다. 커서 기반 페이지 매기기와 증분 동기화를 담당하며, 어떤 설정으로도 숨길 수 없습니다.',
  Expansion: '확장',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — 예외 없이 깊이 1까지만 확장됩니다. 연결된 객체는 행에 중첩되지 않고 `included`에 테이블 이름, 그다음 식별자로 색인되어 담깁니다. 예를 들어 3개의 대상을 가리키는 100개의 행이 있어도 객체는 3개만 전달됩니다.',
  'Lignes référençantes': '참조하는 행',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route}는 지정한 행을 가리키는 행 목록을 반환합니다. 소스 테이블이 보이지 않는 경우 해당 블록은 전혀 표시되지 않습니다 — 블록도, 개수도, 언급도 없습니다.',
  'une table que vous ne voyez pas': '회원님에게 보이지 않는 테이블',
  'Vue d’ensemble': '개요',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    '이 데이터베이스의 이름은 {name}입니다 — 이는 **PostgreSQL 스키마**의 이름이며, URL과 도구 호출에서 그대로 사용하는 이름이기도 합니다. 테이블과 열은 여기서도 SQL에서도 같은 이름을 사용하므로, 별도로 참고할 대응표가 없습니다.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    '두 가지 접근 방식, 동일한 권한: 프로그램을 위한 **REST API**와 AI 에이전트를 위한 **MCP 서버**입니다. 각 테이블 페이지에서 두 방식으로 접근하는 방법을 모두 설명합니다.',
  Élément: '항목',
  Valeur: '값',
  'Schéma PostgreSQL': 'PostgreSQL 스키마',
  'Préfixe des routes REST': 'REST 경로 접두사',
  'ouverte — voir « Connecter un agent »': '열려 있음 — “에이전트 연결” 참고',
  '**fermée aux agents**': '**에이전트에 닫혀 있음**',
  'Tables visibles': '표시되는 테이블',
  Format: '형식',
  'JSON, dans une enveloppe {envelope}': 'JSON이며, {envelope} 형태로 감싸서 제공합니다',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**이 문서는 회원님이 볼 수 있는 내용만 설명합니다.** 두 사람이 보면 서로 다른 두 버전이 나오며, 이는 부작용이 아니라 규칙입니다. 이 문서를 그대로 공개하지 마세요.',
  Authentification: '인증',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    '모든 데이터 경로는 `Authorization` 헤더에 **토큰**을 요구합니다. 세션 쿠키는 여기서 절대 허용되지 않습니다. 브라우저는 다른 사이트가 유발한 요청을 포함해 모든 요청에 쿠키를 보내기 때문입니다.',
  'Jeton d’intégration': '연동 토큰',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    '스크립트, 동기화, 다른 애플리케이션 등 프로그램은 `bdb_`로 시작하는 **연동 토큰**을 사용합니다. 이 토큰은 해당 데이터베이스에만 유효합니다. 읽기를 하며, 쓰기 권한으로 만들어졌다면 생성과 수정도 하지만 **절대 삭제하지 않고**, 만든 사람의 권한을 호출할 때마다 대조하여 그보다 많은 권한을 갖지 않습니다. 관리, SQL 콘솔, AI 기능은 사용할 수 없습니다.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    '토큰을 만들려면: 데이터베이스의 “⋯” 메뉴 → **API 및 에이전트** → **API 및 MCP 토큰…**에서 **REST API** 액세스를 체크하세요. 토큰은 한 번만 표시됩니다.',
  Appel: '호출',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    '인증이 없으면 `404`가 아니라 항상 `401`이 반환됩니다. 다시 로그인할 수 있어야 하기 때문입니다.',
  Conventions: '규칙',
  Enveloppe: '봉투 구조',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    '모든 응답은 {envelope} 형태로 동일합니다. 오류 응답에서는 `data` 대신 코드, 세부 정보, 요청 식별자가 들어갑니다.',
  Nombres: '숫자',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**숫자는 예외 없이 10진수 문자열입니다**: {example}. 부동소수점을 사용하면 금액이 조용히 반올림될 수 있습니다.',
  montant: 'amount',
  'Ressource invisible': '보이지 않는 리소스',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**보이지 않는 리소스와 존재하지 않는 리소스는 한 바이트도 다르지 않게 동일한 응답을 반환합니다.** `404`만으로는 객체가 실제로 존재하는지 알 수 없습니다.',
  Pagination: '페이지 매기기',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**커서 기반 페이지 매기기**: `meta.has_next_page`를 확인하고 `after`를 전달하세요. 내보내기 전용 경로는 없습니다.',
  'Identifiants seuls': '식별자만',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    '식별자만 필요한 연동이라면 `?links=id`로 레이블 해석을 생략할 수 있으며, 그만큼 SQL 왕복도 줄어듭니다.',
  Relations: '관계',
  'Aucune relation visible dans cette base.': '이 데이터베이스에 표시되는 관계가 없습니다.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    '관계는 **실제 PostgreSQL 외래 키**입니다. 애플리케이션이 아니라 데이터베이스가 직접 검증하므로, SQL로 직접 실행하는 `INSERT`도 같은 규칙을 따릅니다.',
  'Codes de réponse': '응답 코드',
  Statut: '상태',
  Signification: '의미',
  'Succès.': '성공.',
  'Ligne créée.': '행이 생성되었습니다.',
  'Suppression réussie, sans contenu.': '삭제가 성공했으며 반환할 내용이 없습니다.',
  'Authentification absente ou refusée.': '인증이 없거나 거부되었습니다.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    '리소스가 존재하지 않거나 **또는** 보이지 않음 — 두 경우의 응답은 동일합니다.',
  'Suppression refusée : la ligne est encore référencée.':
    '삭제가 거부되었습니다. 행이 아직 참조되고 있습니다.',
  'Valeur refusée par la validation.': '값이 유효성 검사에서 거부되었습니다.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    '오류는 항상 다음과 같은 형태이며, 지원팀에 문의할 때는 `request_id`를 알려주세요:',
  'La liste complète des codes est servie par {route}.': '전체 코드 목록은 {route}에서 제공합니다.',
  'Côté MCP': 'MCP 쪽에서는',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    '거부는 `isError`로 표시된 도구 결과로 전달되며, 그 텍스트는 고정된 형태의 JSON 객체입니다: API와 같은 `code`, 고정된 문구, 호출을 수정하는 방법을 알려주는 `hint`가 담깁니다. `retryable`은 같은 호출을 다시 시도할 가치가 있는지 알려줍니다.',
  'Écrire en SQL direct': '직접 SQL로 쓰기',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    '`psql`을 여세요. 정상적으로 작동하며, 이것이 이 제품의 목적입니다.',
  'Ce qui vous attend :': '다음과 같은 점에 유의하세요:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    '필수 여부, 길이, 외래 키 같은 제약 조건이 그대로 적용됩니다. 참조되는 행은 삭제되지 않습니다.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    '수동 `INSERT`에서는 시스템 열이 저절로 채워지지 않습니다: `_id`, `_created_at`, `_updated_at`은 기본값이 있지만, `_created_by`와 `_updated_by`는 사용자 식별자를 필요로 합니다.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedb의 권한은 직접 SQL에는 적용되지 않습니다.** 권한은 API, 인터페이스, MCP 같은 제품의 접근 경로에만 적용됩니다. PostgreSQL 연결은 해당 역할이 볼 수 있는 모든 것을 볼 수 있습니다. 반대로 약속하는 것이 아무 약속도 하지 않는 것보다 나쁘기 때문에 여기서 이를 명시합니다.',
  '{base} — documentation API et MCP': '{base} — API 및 MCP 문서',
}

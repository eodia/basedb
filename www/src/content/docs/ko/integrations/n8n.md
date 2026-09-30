---
title: n8n
description: n8n 워크플로에서 basedb의 행을 읽고 쓰며, 행이 생성되거나 수정되거나 삭제될 때마다 워크플로를 실행합니다.
---

**n8n-nodes-basedb** 패키지는 n8n에 세 가지 노드를 추가합니다:

| 노드 | 역할 |
|---|---|
| **basedb** | 테이블의 행을 읽고 쓰며, 행에 댓글을 남김; n8n의 AI 에이전트가 도구로 쓸 수 있음 |
| **basedb Trigger** | 마지막 확인 이후 생성된 — 또는 생성되거나 수정된 — 행마다 워크플로를 실행 |
| **basedb Webhook Trigger** | 행이 생성되거나 수정되거나 삭제되는 순간 워크플로를 실행 |

## 설치

n8n에서: **Settings › Community Nodes › Install**, 그다음 `n8n-nodes-basedb`를 입력합니다.

인터페이스 없이 사용할 때 — 큐 모드, 미리 구성된 Docker 이미지 — 는 `~/.n8n/nodes` 폴더에서
`npm install n8n-nodes-basedb`를 실행한 다음 n8n을 다시 시작합니다.

## 인증 정보

n8n에서 **basedb API** 인증 정보를 만듭니다:

| 필드 | 값 |
|---|---|
| **Instance URL** | basedb를 여는 주소: `https://basedb.exemple.fr` |
| **Workspace** | 워크스페이스 식별자로, API 주소(`/api/v1/<espace>/…`)에 쓰이는 것과 같습니다: `t4z56fq`, 단 인스턴스가 `BASEDB_TENANT`를 지정한 경우는 예외 |
| **Token** | **연동 토큰**: 데이터베이스의 **⋯** 메뉴 → **API 및 에이전트** → **API 및 MCP 토큰…** |

토큰 하나는 데이터베이스 **하나만** 엽니다. 그 행을 읽고, 쓰기 권한으로 만들어졌다면 쓰기도
하지만, 만든 사람보다 더 많은 권한을 가지는 일은 없으며 **절대 삭제하지 않습니다**. 저장할 때
n8n이 연결을 시도해 토큰이 거부되는지 알려 줍니다.

## 읽기와 쓰기: basedb 노드

| 작업 | 하는 일 |
|---|---|
| **Row › Create** | 행을 추가함 |
| **Row › Create or Update** | 선택한 필드가 그 값을 가진 행을 수정하고, 그런 행이 없으면 새로 추가함 |
| **Row › Get** | `_id`로 행 하나를 읽음 |
| **Row › Get Many** | 필터에 맞는 행을 요청한 순서로, 지정한 개수까지 또는 전부, 페이지 단위로 읽음 |
| **Row › Update** | `_id`나 다른 필드로 찾은 행을 수정함 |
| **Comment › Create** | 행에 댓글을 남김; @멘션은 그 사람에게 알림을 보냄 |

**데이터베이스**와 **테이블**은 토큰이 열 수 있는 목록에서 고릅니다. 입력할 필드는 basedb에서
쓰는 이름으로 표시되며, 단일 선택 필드는 그 선택지와 함께, 사람 필드는 워크스페이스 멤버와
함께 나타납니다. 계산되는 필드 — 수식, 조회, 롤업, 자동 번호 — 는 basedb가 스스로 쓰므로
목록에 나타나지 않습니다. 필드가 거부하는 값을 넣으면 노드는 basedb의 오류 코드와 그 의미를
알려 주며 멈춥니다.

- **필터**와 **정렬**은 SQL에서 쓰는 필드의 기술 이름을 씁니다: `statut eq "gagne" and montant gte 10000`,
  `-montant,nom`. 문법은 [REST API](/basedb/ko/integrations/api-rest/#읽기)와 같습니다.
- **숫자**는 소수점을 하나도 잃지 않도록 10진 텍스트(`"1250.50"`)로 전달되며, **Numbers as
  Numbers** 옵션을 쓰면 숫자로 변환됩니다.
- **관계**는 `{ "id": …, "display": … }`로 읽히며, 연결할 행의 `_id`로 씁니다.
- **Create or Update**는 여러 행을 한꺼번에 수정하지 않습니다: 여러 행이 같은 값을 가지면
  노드는 짐작하는 대신 멈춥니다.
- **Delete** 작업은 없습니다: 토큰은 삭제하지 않습니다. 행을 없애려면 표시를 남기거나(상태를
  “Archivé”로) [자동화](/basedb/ko/fonctionnalites/automatisations/)에 삭제를 맡기세요.

## 워크플로 실행

### 확인할 때마다: basedb Trigger

이 노드는 선택한 주기(매분, 매시간…)로 basedb에 마지막 확인 이후 **생성된** — 또는 **생성되거나
수정된** — 행을 요청하며, 필요하면 필터를 추가로 씁니다. basedb가 n8n에 연결할 수 없는
환경에서도 어디서나 동작합니다. 처음 확인할 때는 테이블의 현재 위치만 기록하고 아무것도
내보내지 않으며, 편집기에서 시험 실행하면 다음 노드를 연결할 수 있도록 마지막 행을
돌려줍니다.

### 즉시: basedb Webhook Trigger

행이 생성되거나 수정되거나 삭제될 때마다 — PostgreSQL에 직접 쓴 SQL이라도 — 워크플로가
즉시 실행됩니다:

1. 노드를 추가하고 그 **Production URL**을 복사합니다.
2. basedb에서 데이터베이스의 **⋯** 메뉴 → **API 및 에이전트** → **웹훅…**: 이 주소로 향하는
   웹훅을 만들고, 대상 테이블과 이벤트를 선택합니다.
3. basedb가 **서명 비밀 키**를 한 번 표시합니다: 이 값을 n8n의 **basedb Webhook** 인증 정보에
   넣습니다.
4. 워크플로를 활성화합니다.

각 이벤트는 하나의 항목이 됩니다: `type`(`record.created`, `record.updated`,
`record.deleted`), 테이블, 행의 **이전** 값과 **이후** 값, 바뀐 필드(`changed`)입니다. 노드는
각 전달의 **서명**을 확인하며, 서명이 없거나 잘못됐거나 5분이 넘은 요청에는 `401`로
응답합니다. basedb는 **최소 한 번**은 전달합니다: 워크플로가 같은 이벤트를 두 번 처리하면 안
된다면 이벤트의 `id`로 중복을 제거하세요.

:::note
basedb는 **공개 HTTPS** 주소로만 웹훅을 보냅니다: 사설망에 있는 n8n은 **basedb Trigger**를
쓰는 것이 좋습니다. [웹훅](/basedb/ko/integrations/webhooks/)을 참고하세요.
:::

## 노드 없이

n8n의 **HTTP Request** 노드로도 basedb와 통신할 수 있습니다: `Authorization: Bearer <jeton>`
헤더, 요청과 응답 모두 JSON, `meta.next_cursor`를 `after`로 전달하는 페이지 나누기
(`{{ $response.body.meta.next_cursor }}`), 그리고 `_updated_at` 필터와
`…/<table>/deleted?since=`를 이용한 장애 후 재개입니다.

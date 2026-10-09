---
title: MCP 서버
description: Model Context Protocol로 AI 에이전트를 basedb에 연결합니다.
---

basedb는 **MCP 서버**(`POST /mcp`, 인터페이스와 같은 주소)를 제공합니다. Claude, 코딩
어시스턴트, 직접 만든 에이전트 등 어떤 에이전트든 여기서 데이터베이스를 찾아보고, 행을 읽고
쓰며, 허용하면 삭제도 하고, 스키마 변경을 **제안**합니다.

## 에이전트 연결

**API 및 MCP 토큰…**(데이터베이스 메뉴의 **API 및 에이전트** 아래)에서 MCP 액세스를 선택해
토큰을 만드세요. 같은 토큰을 REST API와 MCP에 함께 사용하며, 이 토큰은 **데이터베이스 전체**를
엽니다: 운영 환경과 그 밖의 환경 모두입니다(아래 참고).

토큰은 설정 파일이 아닌 환경 변수 `BASEDB_TOKEN`에 넣으세요. HTTP로 MCP와 통신하는
클라이언트(예: Claude Code)는 `…/mcp`에 직접 접속하며, 헤더는
`Authorization: Bearer <jeton>`입니다. Claude Code에서는 다음과 같이 합니다:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

이 명령은 프로젝트의 `.mcp.json` 파일을 작성하며, 여기서 `${BASEDB_TOKEN}`은 변수에 대한 참조로
남습니다. 토큰 자체는 파일에 들어가지 않습니다.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

로컬 프로그램(stdio)만 실행할 수 있는 클라이언트는 저장소의 릴레이를 거치며, 릴레이는
`--token-env`로 지정한 변수에서 토큰을 읽습니다:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

그런 다음 에이전트에게 `whoami`를 호출하도록 요청하세요. 토큰을 만든 사람, 토큰이 여는
데이터베이스, 그 환경과 권한을 알려줍니다.

## 환경 선택

데이터베이스에는 [환경](/basedb/ko/fonctionnalites/environnements/)을 여러 개 — 운영, 스테이징,
개발 — 둘 수 있으며, 환경마다 고유한 테이블과 행이 있습니다. 데이터베이스 전체용 토큰은 모든 환경을
열고, 환경은 다음과 같이 선택합니다. 범위가 넓은 방법부터 구체적인 방법 순서입니다:

- **데이터베이스 이름**만 사용합니다: `crm`은 운영, `crm_recette`는 스테이징입니다.
- **서버 주소**: `…/mcp?environment=recette`는 연결 전체에서 스테이징을 대상으로 합니다. 릴레이에서는
  `--environment recette`가 같은 일을 합니다. 이렇게 환경마다 서버를 하나씩, 모두 같은 토큰으로
  등록합니다:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **도구의 `environment` 인자**: 데이터베이스를 지정하는 모든 도구에 있으며, 호출 한 번에만
  적용됩니다: `list_records`에 `{"base": "crm", "table": "clients", "environment": "recette"}`를
  전달합니다.

환경은 배지에 표시된 이름으로 지정하며, 대소문자와 악센트는 구분하지 않습니다(`Recette`, `recette`,
“Développement”는 `developpement`). 또는 `production`으로 지정합니다. `whoami`는 토큰이 여는 환경을
나열하고, `list_bases`와 `describe_base`는 각 데이터베이스가 어느 환경인지 알려줍니다.

토큰은 만들 때 환경 하나로만 제한할 수도 있으며, 그러면 다른 환경은 전혀 보이지 않습니다.

## 15가지 도구

| 도구 | 역할 |
|---|---|
| `whoami` | 에이전트가 누구이며 어떤 권한을 가졌는지, 어느 환경에서 그런지 |
| `list_bases`, `describe_base`, `describe_table` | 스키마와 그 설명, 모양 살펴보기 |
| `list_records`, `get_record`, `lookup_records` | 읽기, 필터링, 표시 값 확인 |
| `create_record`, `update_record` | 행 쓰기 |
| `delete_record`, `restore_record` | 행 삭제 — 그 권한으로 만들어진 토큰 필요 — 와 복원 |
| `propose_create_table`, `propose_add_field`, `get_proposal` | 스키마 변경 제안 |
| `propose_update_look` | 테이블과 그 선택 항목의 색상과 아이콘 제안 |

## 색상과 아이콘

테이블과 단일 선택 필드의 각 선택 항목에는 인터페이스에서처럼 색상과 아이콘이 있습니다. 에이전트는
제안할 때 이를 고릅니다:

- `propose_create_table`은 테이블의 `color`와 `icon`을 받습니다.
- `propose_add_field`는 `select` 또는 `multi_select`의 각 옵션에서 `color`와 `icon`을 받습니다.
- `propose_update_look`은 이미 있는 테이블과 그 선택 항목의 색상과 아이콘을 바꿉니다. 생략한 키는
  현재 값을 유지하고, `null`은 값을 지웁니다.

`color`는 `#rrggbb` 형식의 색상입니다. `icon`은 인터페이스가 표시하는 [Lucide](https://lucide.dev/icons/)
아이콘 중 하나의 이름입니다 — `truck`, `circle-check`, `flame`… 도구의 스키마에 목록이 나열되어 있으며,
알 수 없는 이름은 거부됩니다. `describe_base`와 `describe_table`은 현재 모양을 반환합니다. 필드에는
고를 아이콘이 없습니다. 인터페이스가 필드 유형의 아이콘을 표시합니다.

## 행 삭제

**읽기, 쓰기 및 삭제** 권한으로 만들어진 토큰이 있으면 에이전트가 `_id`로 행을 **한 번에 한
개씩** 삭제할 수 있습니다. `delete_record`는 삭제되기 전 그대로의 행을 돌려주며, 삭제는 그
토큰의 이름으로 기록에 남습니다. `restore_record`는 같은 `_id`로 그 행을 되돌립니다 —
에이전트가 스스로 자신의 실수를 되돌릴 수도 있고, 사람이 기록에서 되돌릴 수도 있습니다.

에이전트가 삭제하지 않는 경우:

- 읽기 전용 토큰, 또는 읽기와 쓰기 권한만 있는 토큰일 때 — 거부 응답이 어떤 토큰을 만들어야
  하는지 알려줍니다.
- 연쇄 관계로 다른 행까지 함께 삭제될 행일 때(`TOKEN_CASCADE_FORBIDDEN`) — 이런 삭제는
  무엇이 함께 삭제되는지 보이는 사람이 인터페이스에서 수행합니다.
- 여러 행을 한 번에 삭제할 때 — 이를 수행하는 도구가 없습니다.

## 에이전트가 하지 않는 일

- **동의가 있을 때만 삭제합니다**: 그 목적으로 만들어진 토큰으로, 한 번에 한 행씩.
- **스키마도, 그 모양도 바꾸지 않습니다**. 제안만 합니다. 제안은 **에이전트 제안…**(데이터베이스
  메뉴)에서 대기하며, 스키마를 관리하는 사람이 승인하거나 거부합니다. 결정이 없으면 24시간 뒤에
  만료됩니다.
- 토큰을 만든 사람보다 **많은 권한을 절대 갖지 않습니다**. 토큰의 권한은 그 사람의 권한과
  환경마다 교집합으로 계산됩니다.
- 에이전트에게 보이지 않도록 표시한 필드와 MCP에 닫힌 데이터베이스는 보지 못합니다.

모든 호출은 매개변수의 형태로만 로그에 남으며, 값은 절대 기록되지 않습니다.

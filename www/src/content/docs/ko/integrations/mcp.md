---
title: MCP 서버
description: Model Context Protocol로 AI 에이전트를 basedb에 연결합니다.
---

basedb는 **MCP 서버**(`POST /mcp`, 인터페이스와 같은 주소)를 제공합니다. Claude, 코딩
어시스턴트, 직접 만든 에이전트 등 어떤 에이전트든 여기서 데이터베이스를 찾아보고, 행을 읽고
쓰며, 스키마 변경을 **제안**합니다.

## 에이전트 연결

**API 및 MCP 토큰…**(데이터베이스 메뉴의 **API 및 에이전트** 아래)에서 MCP 액세스를 선택해
토큰을 만드세요. 같은 토큰을 REST API와 MCP에 함께 사용합니다.

HTTP로 통신하는 클라이언트라면 주소는 `http://localhost:3000/mcp`이고, 헤더는
`Authorization: Bearer <jeton>`입니다. 프로세스를 실행하는 클라이언트(stdio)를 위해 저장소에는
토큰을 설정 파일이 아닌 환경 변수에서 읽는 릴레이가 들어 있습니다.

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## 12가지 도구

| 도구 | 역할 |
|---|---|
| `whoami` | 에이전트가 누구이며 어떤 권한을 가졌는지 |
| `list_bases`, `describe_base`, `describe_table` | 스키마와 그 설명 살펴보기 |
| `list_records`, `get_record`, `lookup_records` | 읽기, 필터링, 표시 값 확인 |
| `create_record`, `update_record` | 행 쓰기 |
| `propose_create_table`, `propose_add_field`, `get_proposal` | 스키마 변경 제안 |

## 에이전트가 하지 않는 일

- **아무것도 삭제하지 않습니다.**
- **스키마를 바꾸지 않습니다**. 제안만 합니다. 제안은 **에이전트 제안…**(데이터베이스 메뉴)에서
  대기하며, 스키마를 관리하는 사람이 승인하거나 거부합니다. 결정이 없으면 24시간 뒤에
  만료됩니다.
- 토큰을 만든 사람보다 **많은 권한을 절대 갖지 않습니다**. 토큰의 권한은 그 사람의 권한과
  교집합으로 계산됩니다.
- 에이전트에게 보이지 않도록 표시한 필드와 MCP에 닫힌 데이터베이스는 보지 못합니다.

모든 호출은 매개변수의 형태로만 로그에 남으며, 값은 절대 기록되지 않습니다.

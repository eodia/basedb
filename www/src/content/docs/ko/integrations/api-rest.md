---
title: REST API
description: 프로그램에서 basedb의 행을 읽고 씁니다.
---

REST API는 인터페이스가 사용하는 API와 같습니다. **비공개 경로는 없습니다**. URL에는 SQL에서도
보는 물리명이 들어갑니다.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## 토큰

인터페이스에서 데이터베이스 **⋯** 메뉴 → **API 및 에이전트** → **API 및 MCP 토큰…** 을
선택하세요. 비밀번호를 확인한 뒤, 이 데이터베이스로 범위가 제한되고 기본적으로 읽기 전용인
**연동 토큰**을 만듭니다. 토큰은 한 번만 표시되므로 환경 변수에 넣어 두세요.

토큰은 읽기를 하고, 쓰기 권한으로 만들어졌다면 생성과 수정도 하지만, **절대 삭제하지 않으며**
만든 사람보다 많은 권한을 갖지 않습니다.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## 읽기

| 매개변수 | 역할 |
|---|---|
| `filter` | 읽기 쉬운 식: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | 반환할 열 |
| `limit`, `cursor` | 암호화된 커서로 페이지 나누기(응답의 `next_cursor`) |
| `links=display` | 관계를 표시 값과 함께 반환 |
| `count=exact` | 전체 개수, 최대 100,000 |
| `variables=raw` | 긴 텍스트를 [행의 값](/basedb/ko/fonctionnalites/tables-et-champs/#서식-있는-텍스트와-변수)으로 채우지 않고 `{{colonne}}`를 포함해 작성한 그대로 반환 |

연산자: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`, `gt`,
`gte`, `lt`, `lte`, `between`이며, `and`, `or`, `not`과 괄호로 조합합니다. 필터는 관계를 거쳐
적용할 수 있습니다: `clients_id.ville eq "Lyon"`.

## 쓰기

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>`는 같은 본문 `{"values": {…}}`로 행을 수정합니다. 오류는 항상 같은
형태이며(`{ "code": "…", "details": {…}, "request_id": "…" }`), 원인마다 고정된 코드가
있습니다.

모든 쓰기는 `x-basedb-transaction` 헤더를 반환합니다. 이 값을
`POST /api/v1/<tenant>/history/undo`(`{"transaction": "…"}`)에 전달하면 인터페이스의 Ctrl+Z처럼
쓰기가 실행 취소됩니다. 그사이 행이 수정되었다면 거부됩니다.

## 행 너머

같은 토큰으로 다음을 사용할 수 있습니다.

| 경로 | 역할 |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | 필터에 해당하는 모든 행에 대한 요약: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | 행의 댓글 읽기와 쓰기 |
| `POST /api/v1/<tenant>/automations/<id>/run` | 버튼으로 트리거되는 자동화를 행 하나에 대해 실행(`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | 데이터베이스의 대시보드 |
| `GET /api/v1/<tenant>/meta/users` | 사람 필드에 쓸 워크스페이스 멤버 |
| `GET /api/v1/<tenant>/meta/templates` | 갤러리의 데이터베이스 템플릿 |

[공유 보기](/basedb/ko/fonctionnalites/vues-partagees/)는 계정 없이 읽을 수 있습니다.
`GET /api/v1/views/<jeton>`과 `…/rows`는 JSON으로, `…/calendar.ics`는 iCalendar로 제공됩니다.

자동화, 대시보드, 연동을 만드는 등의 구성 작업은 인터페이스 세션에서만 할 수 있습니다. 토큰은
행을 읽고 쓸 뿐, 데이터베이스 자체를 바꾸지는 않습니다.

## 자동 생성 문서

모든 데이터베이스에는 **API 및 MCP 문서** 페이지가 있습니다. 테이블마다 엔드포인트, 열, cURL과
JavaScript 예제를 보여 줍니다. 이 문서는 **내 권한에 따라 필터링되므로** 두 사람이 읽으면 두
가지 버전이 나오고, **화면의 언어로 작성되며**, OpenAPI 3.1 형식으로도 제공됩니다
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`). 이름, 경로, 오류 코드는 모든 언어에서
동일하게 유지됩니다.

![데이터베이스의 자동 생성 문서](../../../../assets/screens/documentation-api.png)

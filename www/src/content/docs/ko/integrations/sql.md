---
title: SQL 직접 사용
description: psql, BI 도구, 스크립트로 basedb의 테이블을 읽고 씁니다.
---

이것이 basedb가 존재하는 이유입니다. **테이블은 실제 테이블입니다**. 모든 PostgreSQL
클라이언트가 이름 그대로 테이블을 읽습니다.

## 이름

| 객체 | 물리명 | 예 |
|---|---|---|
| 데이터베이스 | 스키마 `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| 스테이징 환경 | 접미사가 붙은 스키마 | `b_t4z56fq_ventes_recette` |
| 테이블 | 슬러그화한 이름 | `opportunites` |
| 필드 | 슬러그화한 이름 | `echeance` |
| 관계 | `<table cible>_id` | `clients_id` |
| [SQL 뷰](/basedb/ko/fonctionnalites/requetes-et-vues-sql/) | 데이터베이스 스키마 안의 기술 이름 | `factures_a_encaisser` |

각 데이터베이스의 **API 및 MCP 문서** 페이지에서 모든 이름을 확인할 수 있으며, `psql`에서 `\d`를
실행하면 설명(`COMMENT ON`)이 표시됩니다.

## 인터페이스에서

탭 바의 **+** 버튼이나 데이터베이스 **⋯** 메뉴 → **SQL 쿼리**를 누르면 구문 강조와 자동
완성을 지원하는 편집기가 열리며, 결과는 테이블과 같은 그리드에 표시됩니다.

![저장된 쿼리, 그리고 테이블 사이에 놓인 SQL 뷰 두 개](../../../../assets/screens/requete-sql.png)

- **각자 자신의 권한으로 읽습니다**. 관리 권한이 있으면 쓰기를 포함해 데이터베이스 전체에
  접근하고, 다른 멤버는 읽기 전용 SQL을 작성하며, 접근할 수 없는 테이블은 존재하지 않고 숨겨진
  필드는 사라집니다.
- 쿼리는 테이블 아래에 **저장**할 수 있으며(나만, 데이터베이스 전체, 또는 일부 그룹용), 원하면
  **SQL 뷰**로 만들 수 있습니다. SQL 뷰는 테이블 사이에 놓이고 `psql`에서도 읽을 수 있는 실제
  PostgreSQL 뷰입니다.

자세한 내용은 [SQL 쿼리와 뷰](/basedb/ko/fonctionnalites/requetes-et-vues-sql/)를 참고하세요.

## psql에서

기본 제공 `docker-compose.yml`을 쓰면 PostgreSQL은 `127.0.0.1:5432`에 공개됩니다.

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## SQL로 쓰기

쓰기도 허용됩니다. 제약 조건(단일 선택, 관계, URL, 필수)은 PostgreSQL이 지키며, 인터페이스에서와
마찬가지로 잘못된 값을 거부합니다. 그리고 쓰기는 **기록에 남습니다**. 기록에는 쓰기를 수행한
세션과 함께 “직접 SQL 세션”으로 표시되며, 다른 쓰기처럼 실행 취소할 수 있습니다.

:::caution
SQL(`ALTER TABLE`)로 **스키마**를 바꾸면 basedb 카탈로그를 우회하게 되어, 카탈로그가 그 변경을
알지 못합니다. 인터페이스, API 또는 에이전트 제안을 이용하세요. 마이그레이션 엔진이 계획을
세우고, 잠금을 짧게 유지하며, 카탈로그를 정확하게 유지합니다.
:::

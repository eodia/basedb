---
title: 웹훅
description: 행이 생성, 수정, 삭제될 때마다 다른 시스템에 알립니다.
---

웹훅은 하나 이상의 테이블에서 발생한 **이벤트**를 HTTPS 주소로 보냅니다. 이벤트는
`record.created`, `record.updated`, `record.deleted`입니다. 웹훅은 데이터베이스 메뉴의
**API 및 에이전트** 아래에 있는 **웹훅…** 에서 관리합니다.

## 페이로드

본문은 항상 **이벤트 배열**이며, 각 이벤트에는 **변경 전**과 **변경 후**의 전체 행, 그리고 바뀐
필드 목록이 들어 있습니다.

```json
{ "events": [
  { "id": "0195e…", "type": "record.updated",
    "occurred_at": "2026-09-26T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "b_t4z56fq_ventes", "table": "opportunites",
    "record_id": "0195a…",
    "actor": { "kind": "user" },
    "before": { "statut": "negociation", "montant": "125000", … },
    "after":  { "statut": "gagne", "montant": "125000", … },
    "changed": ["statut"] } ] }
```

SQL로 직접 쓴 경우에도 이벤트가 발생합니다. 이벤트는 트리거가 기록한 기록에서 출발하기
때문입니다.

## 서명, 순서, 재시도

- **서명**: `X-Basedb-Signature: t=…,v1=…`. 원본 본문의 HMAC-SHA256이며, 역직렬화하기 전에
  검증해야 합니다.
- 행 단위로 **순서 보장**: 같은 행의 두 이벤트는 순서대로 도착합니다.
- 실패하면 **재시도**합니다. 재시도 한도를 넘으면 웹훅이 비활성화되며, 인터페이스에서 다시
  활성화할 수 있습니다. 대기열과 각 전송 내역을 확인하고, 다시 보내거나 포기할 수 있습니다.
- **최소 한 번** 전송: `X-Basedb-Delivery-Id` 또는 `events[].id`로 중복을 제거하세요.

## 대상

웹훅은 **공개 HTTPS** 주소로만 전송됩니다. 개발 환경에서는 `BASEDB_WEBHOOK_DEV=1`을 설정하면
HTTP와 로컬 주소도 허용됩니다.

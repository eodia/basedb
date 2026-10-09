---
title: TypeScript SDK
description: TypeScript에서 basedb의 행을 읽고 쓰며, 인스턴스에서 생성한 테이블 타입을 그대로 사용합니다.
---

**@basedb/sdk** 패키지는 TypeScript나 JavaScript에서 [REST API](/basedb/ko/integrations/api-rest/)를
호출합니다: 타입이 지정된 행, 모든 페이지, 파일, 코드가 붙은 거부 응답까지. 의존성은 전혀
없습니다 — 표준 `fetch`만 쓰며, Node 18 이상, Deno, Bun, 브라우저에서 모두 동작합니다.

```bash
npm install @basedb/sdk
```

## 테이블 타입

명령 하나로 여러분의 데이터베이스 구조를 읽어, 그 타입을 프로그램의 파일에 씁니다.

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

토큰이 여는 각 데이터베이스 — 또는 `--base`를 반복해 지정한 데이터베이스들 — 마다, 그리고
각 테이블마다 세 가지 형태가 만들어집니다: basedb가 **읽어 주는** 그대로의 행, **만들 때**의
행, **수정할 때**의 행입니다. 단일 선택은 그 값들의 합집합 타입이 되고, basedb가 계산하는
필드 — 수식, 조회, 롤업, 개수, 자동 번호 — 는 읽기만 되고 쓸 수 없으며, 기본값이 없는 필수
필드는 생성할 때 반드시 필요합니다. 테이블이 바뀌면 명령을 다시 실행하세요.

## 읽기와 쓰기

```ts
import { Basedb, BasedbError, filter } from '@basedb/sdk'
import type { Schema } from './basedb.js'

const db = new Basedb<Schema>({ url: 'https://basedb.exemple.fr', token: process.env.BASEDB_TOKEN! })
const opportunites = db.base('b_t4z56fq_ventes').table('opportunites')

const o = await opportunites.create({ titre: 'Audit', montant: 12500, statut: 'nouveau' })
await opportunites.update(o._id, { statut: 'gagne' })

for await (const ligne of opportunites.all({
  filter: filter`statut eq ${'gagne'} and montant gte ${10000}`,
  sort: '-montant',
})) {
  console.log(ligne.titre, ligne.montant)
}
```

존재하지 않는 테이블, 필드, 선택 값은 프로그램이 실행되기도 전에 **타입 오류**가 됩니다.

| 메서드 | 역할 |
|---|---|
| `list(options)` | 한 페이지, 그리고 다음 페이지를 위한 `next` |
| `all(options)` | 필터에 맞는 모든 행을, 페이지 단위로 읽는 즉시 순회 |
| `first(options)`, `count(filtre)` | 첫 번째 행, 행의 개수 |
| `get(id)` | 행 하나 |
| `create(valeurs)`, `createMany(lignes)` | 행 추가; 여러 개를 한꺼번에 모두 또는 전혀 |
| `update(id, valeurs)` | 필드 수정; 빠진 필드는 그대로 두고, `null`은 값을 비움 |
| `aggregate({ aggregates, filter, group })` | 필터에 맞는 모든 행에 대한 합계, 평균, 개수 |
| `comments(id).list()`, `.add(texte)` | 행의 댓글 목록과 추가; @멘션은 알림을 보냄 |
| `upload(champ, octets, { name, type })` | 파일을 올리고, 행이 그 `id`로 인용함 |
| `db.undo(ligne)` | 이 행을 만든 쓰기를 취소; 그 뒤 행이 바뀌었으면 거부됨 |

- **`filter`**는 삽입한 각 값을 값 그대로 씁니다: 사용자가 입력한 텍스트는 언제나 텍스트로
  남을 뿐, 필터 문법의 일부가 되지 않습니다.
- **숫자**는 자릿수를 잃지 않도록 10진 텍스트(`"12500.0000000000"`)로 읽히며, 쓸 때는 숫자나
  텍스트로 넣을 수 있습니다.
- **관계**는 `{ id, display }`로 읽히며, 연결할 행의 `_id`로 씁니다; `links: 'id'`는 `_id`만
  읽습니다.
- **거부**는 `BasedbError`입니다: 원인마다 고정되고 모든 언어에서 같은 `code`, 그리고
  `status`, `details`, `requestId`를 가집니다. 속도를 늦추라는 요청(`429`)은 basedb가 알려 준
  시간이 지난 뒤 다시 시도됩니다.

## 환경

[환경](/basedb/ko/fonctionnalites/environnements/)이 여러 개인 데이터베이스(운영, 스테이징…)는 환경이
달라도 이름과 타입이 같습니다. 데이터베이스 전체용으로 만든 토큰이면 `environment()`로 환경을 지정할 수
있으며, 같은 코드가 다른 환경에서 실행됩니다:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

생성자의 `environment` 옵션은 클라이언트 전체에 같은 일을 합니다. SDK는 `X-Basedb-Environment`
헤더를 보내며, 헤더가 없으면 각 데이터베이스 이름이 자신의 환경을 가리킵니다(`b_t4z56fq_ventes`는
운영 환경입니다).

## 토큰

**연동 토큰**은 인터페이스에서 만듭니다: 데이터베이스의 **⋯** 메뉴 → **API 및 에이전트** →
**API 및 MCP 토큰…**. 토큰은 데이터베이스 하나(모든 환경 또는 환경 하나)를 열어 그 행을 읽고, 쓰기 권한으로 만들어졌다면
쓰기도 하며, 만든 사람보다 많은 권한을 갖는 일은 없고, **그 목적으로 만들어진 경우에만
삭제합니다**(“읽기, 쓰기 및 삭제”): 그렇지 않으면 `delete()`는 거부됩니다.

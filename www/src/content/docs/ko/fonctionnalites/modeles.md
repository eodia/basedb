---
title: 데이터베이스 템플릿
description: 템플릿으로 시작하거나, AI에게 요청하거나, JSON으로 직접 작성하고, 모든 인스턴스에 게시합니다.
---

**템플릿**은 클릭 한 번으로 데이터베이스 전체를 만듭니다. 테이블과 그 관계, 예시 행, 보기,
대시보드, 자동화, 그리고 AI가 직접 채우는 필드까지 포함됩니다.
[템플릿 갤러리](/basedb/ko/modeles/)에서 basedb가 제공하는 템플릿을 볼 수 있습니다.

## 템플릿으로 시작하기

**새 데이터베이스**를 누른 다음 **템플릿으로 시작 또는 AI에게 요청**을 누르면 갤러리가
열립니다.

![앱 안의 템플릿 갤러리](../../../../assets/screens/modeles.png)

각 템플릿은 사용하기 전에 전체 내용을 살펴볼 수 있습니다. 테이블과 그 필드, 보기, 자동화,
각 AI 필드의 지시문까지 확인할 수 있습니다. **데이터베이스 만들기**를 누르면 레이블을 묻고,
AI 필드가 있으면 그 필드가 인용하는 값을 인스턴스의 AI 공급자에게 보내도 되는지 동의를
구합니다. 동의하지 않으면 AI 필드는 예시 값이 채워진 일반 필드가 됩니다.

빈 프로젝트에서는 **데모 데이터베이스**도 제안합니다. 작은 에이전시의 고객, 프로젝트, 작업,
청구서, 후기로 이루어져 있으며 basedb의 모든 면을 보여 줍니다.

## AI에게 요청하기

갤러리 맨 위에 필요한 것을 한 문장으로 설명하세요. 예: “고객 불만 처리 현황과 어조 분석”.
AI가 완전한 데이터베이스를 제안합니다. 테이블, 그럴듯한 예시 행, 보기, 대시보드, 그리고
용도에 맞으면 AI 필드도 포함됩니다. 이 제안은 템플릿처럼 살펴볼 수 있고, **다듬은**(“공급업체
테이블을 추가해 줘”) 다음 만들 수 있습니다. AI는 입력한 문장만 받으며 어떤 데이터베이스의
데이터도 받지 않고, 클릭하기 전에는 아무것도 만들어지지 않습니다.

## JSON으로 템플릿 작성하기

템플릿은 JSON 문서입니다. 기본 골격은 다음과 같습니다.

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

핵심 규칙은 다음과 같습니다.

- **모든 것은 레이블로 인용합니다**. 보기 안의 필드, 필터(`[Statut] ne "Résolu"`), 수식
  (`[Prix] * [Quantité]`), AI 지시문이나 메시지(`{{Titre}}`) 모두 마찬가지입니다. 선택 값도
  레이블로 지정합니다.
- 테이블의 **첫 번째 필드**가 표시 필드입니다. 텍스트, 숫자, 날짜, 이메일 또는 URL이어야
  합니다.
- **관계**는 필드가 아니라 `links`에 선언합니다. 행은 `"@clé"`, 즉 대상 테이블에 있는 행의
  `$key`로 관계를 가리킵니다.
- **날짜**는 템플릿을 적용하는 날을 기준으로 한 상대값일 수 있습니다. `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`처럼 쓰며, 날짜 및 시간은 `"+1d 14:30"`처럼 시각을 덧붙입니다. 사람은
  `"$moi"`로 씁니다.
- **AI 필드**에는 `"ai": { "prompt": "…" }`가 들어가며, 예시 값을 줄 수도 있습니다. 예시 값은
  AI를 사용하지 않을 때만 쓰입니다.
- 템플릿에는 공유, 권한, 웹훅, 파일, 그리고 `"$moi"` 이외의 사람이 **절대** 들어가지 않습니다.
  템플릿은 외부에서 올 수도 있으므로 아무것도 열어 두어서는 안 됩니다.

전체 참조(모든 필드 타입, 모든 보기 키, 제한값)는 저장소에 있는 아키텍처 문서 20장에
있습니다.

## 모든 인스턴스에 템플릿 게시하기

공식 갤러리의 템플릿은 저장소의
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
폴더에 있는 파일이며, 템플릿 하나당 파일 하나로 `key`에 따라 이름이 붙습니다. 공개 사이트는
이 파일들로 [갤러리](/basedb/ko/modeles/)를 만들고, 전체 카탈로그를
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json) 주소에 게시합니다. 각
인스턴스는 누군가 갤러리를 열 때 이 카탈로그를 읽고 1시간 동안 보관합니다. 파일을 수정하고
사이트를 다시 게시하기만 하면 모든 인스턴스의 갤러리가 바뀝니다.

각 템플릿은 사이트를 빌드할 때 서버와 같은 검증기로 검사됩니다. 잘못된 템플릿은 사용자에게
전달되는 대신 빌드를 실패시킵니다.

인스턴스는 `BASEDB_TEMPLATES_URL` 주소를 읽으며, 기본값은 공개 사이트 주소입니다. 직접
운영하는 카탈로그를 가리키게 하거나, `off`로 설정해 아무것도 읽지 않게 할 수 있습니다. 이
경우 인스턴스는 해당 버전에 내장된 템플릿을 제공합니다.

## 인스턴스의 템플릿

관리자는 갤러리에서(“JSON 가져오기”) 자신의 인스턴스로 **JSON 템플릿을 가져올** 수 있습니다.
가져온 템플릿은 모든 사용자의 갤러리에 추가되며, 키가 같은 템플릿을 대체합니다. AI의 제안도
클릭 한 번으로 추가할 수 있습니다.

모든 데이터베이스는 템플릿으로 만들 수도 있습니다. 데이터베이스 메뉴의 **기타 작업** 아래에
있는 **템플릿으로 저장**을 누르세요. 테이블, 필드, AI 지시문, 관계, 공유 보기, 대시보드,
자동화, 그리고 원하면 테이블당 최대 50개 행이 JSON으로 다운로드되며, 공식 카탈로그나
인스턴스 카탈로그에 바로 추가할 수 있습니다. 행을 찾거나, 분기를 사용하거나, 이전 단계를
인용하는 자동화는 현재 포함되지 않으며, 화면에 그 사실이 표시됩니다.

---
title: 인공지능
description: 필드의 AI 옵션, 초안, Copilot과 대시보드 Copilot, 그리고 공급자에게 전송되는 내용을 설명합니다.
---

AI는 **선택 사항**입니다. 공급자를 설정하지 않으면 어떤 데이터도 외부로 나가지 않습니다.
basedb는 사용자의 키로 **OpenAI**, **Anthropic**, **Mistral**과 통신할 수 있으며, OpenAI의 API를
쓰는 모든 서버(**Azure**, 기업용 게이트웨이, 직접 운영하는 모델)와도 통신할 수 있습니다.

## 공급자 설정

인터페이스에 저장된 설정이 없는 동안에는 API가 환경 변수를 읽습니다.

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral 또는 openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # 또는 BASEDB_AI_API_KEY
```

키는 `BASEDB_AI_API_KEY`에서 읽으며, 이 변수가 없으면 공급자별 일반적인 변수 이름
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`)에서 읽습니다.

### Azure, 게이트웨이, 로컬 모델

`BASEDB_AI_PROVIDER=openai_compatible`은 호출을 OpenAI 형식으로 `BASEDB_AI_BASE_URL`의 주소에
보냅니다. 이 주소는 `/chat/completions` 앞까지의 부분이며 매개변수도 포함합니다.
`BASEDB_AI_HEADERS`는 그 서버가 요구하는 헤더를 JSON 객체로 모든 호출에 추가합니다.

```bash
# Azure OpenAI: 모델에는 배포 이름을 쓰고, 키는 api-key 헤더에 넣음
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Azure의 이전 형식(배포별): 매개변수는 경로 뒤에 그대로 둠
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Ollama로 제공하는 모델, 키 없음
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

`openai_compatible`에서는 키가 선택 사항입니다. `BASEDB_AI_API_KEY`를 지정하면
`Authorization: Bearer`로 전송됩니다. `BASEDB_AI_HEADERS`의 헤더는 키로 만든 헤더를 대체합니다.
예를 들어 자체 `Authorization`을 요구하는 게이트웨이가 그렇습니다.

`BASEDB_AI_BASE_URL`과 `BASEDB_AI_HEADERS`는 게이트웨이를 통해 연결하는 나머지 세 공급자에도
쓸 수 있습니다. `anthropic`의 경우 주소는 `/messages` 앞까지의 부분입니다. 이 두 변수는 환경
변수로 지정한 공급자에만 적용됩니다. 다른 공급자를 선택한 워크스페이스는 주소도, 헤더도, 키도
받지 않습니다. API는 시작할 때 채택한 공급자를 기록하고, 잘못된 주소나 JSON 객체가 있으면
알려 줍니다.

TLS 인증서가 자체 서명된 내부 게이트웨이나 트래픽을 다시 서명하는 기업 프록시가 있으면 호출이
실패합니다. `BASEDB_AI_PROVIDER_SSL_VERIFY=false`는 **이 공급자의 인증서만** 검증하지 않습니다.
인스턴스의 다른 모든 외부 호출과, 워크스페이스가 선택했을 수 있는 공급자는 계속 검증됩니다.
시작할 때 이 사실이 알려집니다. 키가 모든 호출에 실려 가므로, 직접 통제하는 네트워크에서만
사용하세요.

## 필드의 AI 옵션

AI는 필드 타입이 아니라 **옵션**입니다. 필드 입력 창(텍스트, 긴 텍스트, URL, 숫자, 단일 선택,
불리언, 날짜)에서 **AI** 스위치를 켜면, 다른 열을 인용하는 지시문을 바탕으로 모델이 필드를
채웁니다.

```text
{{Notes}} 내용을 한 문장으로 요약하세요.
{{Description}} 내용의 카테고리를 목록의 선택지 중에서 고르세요.
```

- 필드는 행이 생기자마자 계산되고, 인용한 열이 바뀔 때마다 다시 계산됩니다. 원하면 일정에
  따라(최소 15분 간격) 계산할 수도 있습니다.
- 열은 **타입을 유지합니다**. 그 타입으로 읽을 수 있는 내용이 없는 응답(찾을 수 없는 숫자,
  존재하지 않는 선택 값)은 쓰지 않고 거부됩니다.
- 옵션을 끄면 값은 그대로 둔 채 필드를 다시 직접 수정할 수 있습니다.
- 인용된 값은 공급자에게 전송되므로 **옵션을 켤 때 명시적인 동의가 필요합니다**.

`BASEDB_AI_FIELD_QUOTA`는 이 계산을 워크스페이스별로 시간당 횟수로 제한합니다(기본값 300회).

## 자동화에서

[자동화](/basedb/ko/fonctionnalites/automatisations/#ai에게-질문)는 단계 중 하나에서 **AI에게
질문**할 수 있습니다. 행과 이전 단계를 인용하는 지시문을 보내고, 선택한 타입으로 응답을
읽으며, 이후 단계가 이 응답을 쓰거나 보내거나 인용합니다. 필드와 같은 규칙이 적용됩니다.
저장할 때 동의가 필요하고, 지시문이 인용한 내용만 전송되며, 모든 호출은 로그에 남고
`BASEDB_AI_FIELD_QUOTA`에 포함됩니다.

## 초안과 Copilot

- **초안**: 테이블이나 수식을 한 문장으로 설명하면 검토할 제안을 받습니다. 레이블, 타입,
  입력한 문장만 전송되며, 셀 값은 전송되지 않습니다.
- **템플릿**: 데이터베이스 전체를 설명하면(“고객 불만 처리 현황”) 테이블, 예시 행, 보기,
  대시보드, 자동화를 받아 다듬은 뒤 만들 수 있습니다. 문장만 전송됩니다.
  [데이터베이스 템플릿](/basedb/ko/fonctionnalites/modeles/#ai에게-요청하기)을 참고하세요.
- **Copilot**: 표시된 데이터베이스에 관한 대화입니다. 필터, 쿼리, 열, 테이블, 테스트 데이터를
  요청할 수 있으며, 각 제안은 카드로 도착하고 입력 창과 같은 경로를 거쳐 클릭 한 번으로
  적용됩니다.

기본적으로 공급자에게는 구조 정보만 전송됩니다. **데이터 읽기 허용** 확인란을 선택하면 해당
대화에서 Copilot이 행을 읽고(읽기당 최대 50행) 그 내용을 바탕으로 답할 수 있으며, 읽은
내용은 각 응답 아래에 나열됩니다.

## 대시보드 Copilot

[대시보드](/basedb/ko/fonctionnalites/tableaux-de-bord/#copilot) 섹션에서 Copilot은 질문,
대시보드 수정, 필터 값을 제안하며, 클릭 한 번으로 적용할 수 있습니다. 같은 규칙이
적용됩니다. 동의가 없으면 구조 정보만 전송됩니다. 테이블과 필드, 데이터베이스의 대시보드와
질문, 표시된 대시보드 카드의 정의(질문, 텍스트)이며, 결과나 필터에서 선택한 값은 절대
전송되지 않습니다. **데이터 읽기 허용** 확인란을 선택하면 이 값들과 표시된 필터를 적용한 카드
결과가 추가되며(읽기당 최대 50행), 읽은 내용은 각각 응답 아래에 나열됩니다.

## 자동화 Copilot

[자동화](/basedb/ko/fonctionnalites/automatisations/#copilot) 섹션에서 Copilot은 전체
자동화(화면의 자동화를 수정한 것 또는 새 자동화)를 제안해 편집기의 흐름에 올려놓지만, **절대
저장하지 않습니다**. 사용자가 검토한 뒤 저장합니다. 같은 규칙이 적용됩니다. 동의가 없으면
구조 정보만 전송됩니다. 테이블과 필드, 데이터베이스의 자동화, 화면의 자동화, 값이 전혀 없는
최근 실행, 표식으로 바뀐 사람과 Slack 채널입니다. **데이터 읽기 허용** 확인란을 선택하면 읽은
행이 추가됩니다(읽기당 최대 50행).

`BASEDB_AI_QUOTA`는 대화형 호출을 워크스페이스별로 시간당 횟수로 제한합니다(기본값 120회).

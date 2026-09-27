---
title: 환경 변수
description: basedb가 읽는 모든 변수와 그 기본값.
---

모든 변수는 `docker-compose.yml` 옆에 있는 `.env` 파일에 넣으며, `docker compose`가 이 파일을
읽습니다(주석이 달린 전체 예시는 `.env.example`에 있습니다). `docker run`을 쓴다면 `-e`로
전달하세요. **빈 값은 “설정되지 않음”으로 처리됩니다.**

## 필수

| 변수 | 역할 |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL 컨테이너의 비밀번호 |
| `BASEDB_ENCRYPTION_KEY` | 인스턴스 키: 세션에 서명하고 비밀 정보를 암호화합니다. `openssl rand -base64 32`로 한 번만 생성 |

## 데이터베이스

| 변수 | 기본값 | 역할 |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL 역할 |
| `POSTGRES_DB` | `basedb` | PostgreSQL 데이터베이스 |
| `POSTGRES_PORT` | `5432` | 127.0.0.1에 공개되는 포트 |
| `DATABASE_URL` | `db` 컨테이너 | 직접 운영하는 PostgreSQL 16 이상 데이터베이스 |

## 첫 시작

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | 빈 데이터베이스에 카탈로그 적용 |
| `BASEDB_BOOTSTRAP` | `1` | 첫 관리자 준비 |
| `BASEDB_TENANT` | `t4z56fq` | API URL에 들어가는 워크스페이스(테넌트) 식별자 |
| `BASEDB_ADMIN_EMAIL` | — | 시작할 때 만들어지는 첫 관리자의 주소. 비어 있으면 인터페이스를 처음 여는 사람이 관리자를 만듦 |
| `BASEDB_ADMIN_PASSWORD` | 생성되어 한 번 표시됨 | `BASEDB_ADMIN_EMAIL`과 함께 쓰는 관리자 비밀번호. 설정되어 있으면 **시작할 때마다** 관리자에게 다시 적용되므로, 로그인한 뒤에는 제거할 것 |

## Google, Microsoft 등으로 로그인(OIDC)

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | 제공할 공급자, 쉼표로 구분: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | 공급자에 등록한 애플리케이션 |
| `BASEDB_OIDC_<NOM>_ISSUER` | `google`, `gitlab`은 기본 제공 | OpenID Connect 발급자 |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | 공급자에 따라 다름 | 버튼 이름, 요청할 범위 |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: 첫 로그인 시 계정을 만들지 않음 |

[계정과 로그인](/basedb/ko/hebergement/connexion/)을 참고하세요.

## 주소

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_PORT` | `3000` | 127.0.0.1에 공개되는 포트: 인터페이스, `/api`, `/mcp` |
| `BASEDB_VERSION` | `latest` | `eodia/basedb` 이미지의 태그 |
| `BASEDB_PUBLIC_URL` | — | OIDC 리디렉션에 쓰이는 basedb의 공개 주소 |
| `BASEDB_DOMAIN` | — | Caddy 프록시가 HTTPS로 제공하는 도메인 |
| `BASEDB_ORIGINS` | — | 페이지가 브라우저에서 API를 호출하는 다른 사이트, 쉼표로 구분. 같은 주소로 제공되는 basedb 인터페이스에는 필요 없음 |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | 브라우저에서 본 API와 MCP 주소. 개발 스택(`pnpm start`)에서만 설정 |

## 파일

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | 파일 하나의 최대 크기 |
| `BASEDB_S3_BUCKET` | — | S3 저장소 활성화 |
| `BASEDB_S3_ENDPOINT` | — | S3 엔드포인트 |
| `BASEDB_S3_REGION` | `us-east-1` | 리전 |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | 자격 증명 |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | 호스트 방식 주소 지정에는 `0` |

## 데이터베이스 템플릿

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | 공개 사이트의 카탈로그 | 인스턴스가 갤러리 템플릿을 읽어 오는 주소. `off`로 설정하면 아무것도 읽지 않음(내장 템플릿은 유지). [템플릿](/basedb/ko/fonctionnalites/modeles/) 참고 |

## 인공지능

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` 또는 `mistral` |
| `BASEDB_AI_MODEL` | — | 모델 |
| `BASEDB_AI_API_KEY` | — | 키(없으면 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | 워크스페이스별 시간당 대화형 호출 수 |
| `BASEDB_AI_FIELD_QUOTA` | `300` | 워크스페이스별 시간당 AI 필드 계산 수 |
| `BASEDB_AI_WORKER` | `1` | `0`: 이 프로세스에서 백그라운드 계산을 하지 않음 |

## 공개 데모

[demo.basedb.eodia.com](https://demo.basedb.eodia.com)처럼 누구에게나 열려 있는 인스턴스에서는
로그인 화면에 공유 계정이 미리 채워지고, 방문자는 모든 것을 읽고 이미 있는 것을 수정할 수
있지만 데이터베이스, 테이블, 행, 파일, 댓글, 계정, 토큰, 링크 등 무엇도 새로 만들거나 삭제할
수 없습니다. AI는 자신이 데모에 포함되지 않는다고 답합니다. SQL 콘솔은 읽기만 합니다.
매일 밤 데이터베이스를 원래 상태로 되돌리는 일은 각자가 맡아야 합니다.

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: 인스턴스가 공개 데모가 됩니다 |
| `BASEDB_DEMO_ACCOUNTS` | — | 언어별 계정을 쉼표로 구분해 나열합니다: `fr=demo@demo.com,en=demo-en@demo.com`. 로그인 화면은 화면 언어에 맞는 계정을, 없으면 영어 계정을, 그마저 없으면 첫 번째 계정을 미리 채우고 나머지는 선택지로 보여 줍니다. 데모를 켜기 전에 각 계정과 그 프로젝트를 먼저 만들어야 합니다: 데모는 관리자를 포함한 누구의 생성도 거부합니다 |
| `BASEDB_DEMO_PASSWORD` | — | `BASEDB_DEMO_ACCOUNTS`와 함께 쓰는 공통 비밀번호이며, 계정과 함께 공개됩니다 |

`BASEDB_DEMO_ACCOUNTS`가 없으면 공유 계정은 `BASEDB_ADMIN_EMAIL`과 `BASEDB_ADMIN_PASSWORD`가
가리키는 관리자입니다. 데모의 계정은 무엇을 입력하든 공개된 비밀번호로 로그인되므로, 잘못된
시도가 있어도 다른 모든 사람에게는 잠기지 않습니다.

## 개발 전용

| 변수 | 역할 |
|---|---|
| `BASEDB_DEV_MAIL=1` | 이메일을 보내는 대신 로그에 표시 |
| `BASEDB_WEBHOOK_DEV=1` | HTTP와 로컬 주소로 웹훅 전송 허용 |

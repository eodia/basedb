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
| `BASEDB_BASE_PATH` | `BASEDB_PUBLIC_URL`의 경로 | 게이트웨이 뒤에서 basedb가 제공되는 경로. `https://passerelle.example.com/basedb/`라면 `/basedb`; [Docker Compose](/basedb/ko/hebergement/docker/#게이트웨이-뒤-하위-경로에서) 참고 |
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

## 이메일

발송 서버가 없으면 basedb는 이메일을 전혀 보내지 않습니다. 발송 서버가 있으면 10분 동안
읽지 않은 알림(각자 **설정 › 알림**에서 어떤 알림을 받을지 선택), 자동화의 **이메일 보내기**
단계가 보내는 이메일, 그리고 **비밀번호 찾기** 링크가 이메일로 발송됩니다. 링크는
`BASEDB_PUBLIC_URL`을 가리키며, 이 값이 없으면 이메일에 링크가 들어가지 않습니다.

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | SMTP 서버: 사용 중인 메일 서비스나 발송 대행 서비스의 서버 |
| `BASEDB_SMTP_PORT` | `587` | 처음부터 암호화된 연결을 쓰려면 `465` |
| `BASEDB_SMTP_SECURE` | `starttls`(465번 포트에서는 `tls`) | 같은 서버의 릴레이에만 `none`을 씁니다: 그렇지 않으면 비밀번호가 평문으로 전송됩니다 |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | 발송 계정에 인증이 필요한 경우 그 계정 정보 |
| `BASEDB_MAIL_FROM` | — | `BASEDB_SMTP_HOST`를 쓰면 필수: 보낸 사람 주소, 예를 들어 `basedb <no-reply@exemple.fr>` |

시작할 때 로그에 상태가 표시됩니다: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` 서버가 거부한 이메일은 1분, 5분, 30분, 120분, 마지막으로
360분 뒤에 다시 시도됩니다.

## 지도와 주소

**지도** 보기는 지오코딩 서비스를 이용해 주소를 위치로 바꿉니다. 기본값은 OpenStreetMap
(Nominatim)이며, 주소당 한 번, 초당 최대 한 번 요청하고, 응답은 모두 저장해 둡니다. 지도
배경은 각 사용자의 브라우저가 직접 불러오는 **타일**로 이루어집니다.

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | 같은 프로토콜을 쓰는 다른 서비스(자체 운영하는 Nominatim); `off`: 아무 서비스도 쓰지 않으며, 주소는 인스턴스 밖으로 나가지 않고 위도와 경도만으로 행이 배치됩니다 |
| `BASEDB_MAP_TILES` | OpenStreetMap의 타일 | 다른 타일 서버, `https://…/{z}/{x}/{y}.png` 형식 |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | 그 서버가 요구하는 출처 표시, 지도 오른쪽 아래에 표시 |

시작할 때 로그에 어떤 서비스가 쓰이는지 표시됩니다: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF 문서

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_PDF_FONTS` | 이미지에 포함된 Noto 글꼴 | 컨테이너에 마운트한 자체 폴더로, `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`를, 중국어·일본어·한국어를 위해서는 `NotoSansCJK-Regular.ttc`와 `-Bold.ttc`를 담습니다 |

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

## 내부 네트워크로의 웹훅

| 변수 | 기본값 | 역할 |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | 쉼표로 구분한 내부 서버 목록: 이름(`chat.intra.example.com`), 도메인과 그 하위 도메인(`*.intra.example.com`), 주소 또는 범위(`10.12.0.0/16`) |

웹훅, 자동화의 HTTP 요청, 동기화된 테이블은 공개 HTTPS 주소로만 나갑니다. 목록에 있는 대상은 주소,
포트, 스킴에 관계없이 — HTTP를 포함해 — 추가로 허용됩니다. 읽을 수 없는 항목이 있으면 시작이
차단됩니다. [웹훅](/basedb/ko/integrations/webhooks/#대상) 참고.

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

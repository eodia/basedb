---
title: Docker Compose
description: 이미지, 서비스, 볼륨, 그리고 일상적인 운영 방법을 설명합니다.
---

basedb는 amd64와 arm64용 **단일 이미지** [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)로
배포됩니다. 저장소의 `docker-compose.yml`이 이 이미지를 PostgreSQL과 함께 구성합니다. 모든 설정은
`.env` 파일로 합니다([환경 변수](/basedb/ko/hebergement/variables/) 참고).

## 이미지

이미지에는 basedb의 세 프로세스가 들어 있으며, 모두 **포트 하나(3000)** 로 제공됩니다.

| 경로 | 프로세스 |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST API, 로그인, 백그라운드 작업 |
| `/mcp` | 에이전트용 MCP 서버 |
| 나머지 전부(`/`, `/f/…`, `/v/…`) | 인터페이스 |

시작할 때는 API가 먼저 실행됩니다. 빈 데이터베이스라면 카탈로그를 적용하고 첫 관리자를
만들며, 이후 시작에서는 두 작업 모두 아무 영향이 없습니다. MCP 서버는 API가 응답하는 즉시
시작합니다. 프로세스 중 하나가 멈추면 컨테이너 전체가 멈추고, 재시작 정책이 컨테이너 전체를 다시
시작합니다.

이미지는 Node 22에서 `node` 사용자로 실행되며, 헬스 체크(`/healthz`)와 파일 필드 및 이미지
필드의 파일을 위한 볼륨 `/data`를 선언합니다.

| 태그 | 내용 |
|---|---|
| `latest` | 최신 배포 버전 |
| `0.3` | 최신 0.3.x 버전 |
| `0.3.2` | 정확히 이 버전 |

## 서비스

| 서비스 | 이미지 | 포트(127.0.0.1) | 볼륨 |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy`(선택) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## 유용한 명령

```bash
docker compose up -d                # 이미지를 내려받고 시작
docker compose logs -f basedb       # basedb 로그 보기(첫 시작 시 관리자 비밀번호)
docker compose ps                   # 서비스 상태와 헬스 체크
docker compose restart basedb       # basedb 재시작
docker compose down                 # 중지(볼륨은 유지됨)
```

저장소를 클론했다면 `docker compose up -d --build`로 이미지를 내려받는 대신 코드에서 빌드할 수
있습니다.

## 포트 변경

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## 기존 PostgreSQL 데이터베이스

`DATABASE_URL`을 설정하세요. basedb는 `db` 컨테이너 대신 이 데이터베이스에 연결합니다(`db`
컨테이너는 사용되지 않더라도 시작되므로, 원하면 `docker-compose.override.yml` 파일에서 제거하세요).
PostgreSQL 16 이상, 데이터베이스 소유자 역할, 그리고 `pg_trgm`과 `unaccent` 확장이 필요합니다.
이 경우 이미지만으로 충분합니다. [설치](/basedb/ko/guides/installation/)를 참고하세요.

---
title: 설치
description: Docker Compose로 basedb를 설치하거나 개발 스택을 실행합니다.
---

basedb는 **Docker 이미지 하나**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 및 arm64)에 모두 들어 있습니다. **인터페이스**, **API**, **MCP 서버**가 하나의 주소로
제공됩니다. **PostgreSQL 16** 데이터베이스가 필요하며, `docker-compose.yml`이 이를 함께
제공합니다.

## Docker Compose로 설치(권장)

사전 요구 사항: Compose v2가 포함된 Docker. 파일 두 개면 충분하며 코드는 필요 없습니다.

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

`.env`를 열고 필수 값 두 개를 입력하세요.

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# 한 번만 생성해 계속 사용: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

그런 다음 시작합니다.

```bash
docker compose up -d
```

처음 시작할 때 basedb가 카탈로그를 만듭니다. 그런 다음
[http://localhost:3000](http://localhost:3000)을 여세요. 첫 페이지에서 이름, 이메일 주소,
원하는 비밀번호를 입력해 **관리자 계정을 만들라는** 안내가 나오고, 만들고 나면 바로
로그인됩니다.

:::caution[첫 방문자가 관리자를 만듭니다]
관리자가 아직 없으면 인터페이스를 처음 여는 사람이 관리자를 만듭니다. 다른 사람이
인스턴스에 접속할 수 있게 하기 **전에**, 즉 도메인에 연결하거나 모든 네트워크 인터페이스에
포트를 공개하기 전에 관리자를 만드세요.
:::

사람의 개입 없이 설치하려면 `.env`의 `BASEDB_ADMIN_EMAIL`로 관리자를 지정하세요. basedb가
처음 시작할 때 관리자를 만들고, 그 비밀번호를 로그(`docker compose logs basedb`)에 **한 번만**
표시합니다. `BASEDB_ADMIN_PASSWORD`로 비밀번호를 직접 정할 수도 있습니다.

| 주소 | 역할 |
|---|---|
| http://localhost:3000 | 인터페이스 |
| http://localhost:3000/api | REST API와 그 문서 |
| http://localhost:3000/mcp | 에이전트용 MCP 서버 |
| localhost:5432 | `psql`과 사용 중인 도구를 위한 PostgreSQL |

포트는 `127.0.0.1`에만 공개됩니다. 도메인에서 basedb를 제공하려면
[도메인과 HTTPS](/basedb/ko/hebergement/https/)를 참고하세요.

## 기존 PostgreSQL 사용

PostgreSQL 16 이상 데이터베이스(데이터베이스 소유자 역할, `pg_trgm` 및 `unaccent` 확장 사용
가능)가 있으면 이미지만으로 충분합니다.

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

생성된 키는 꼭 보관하세요. 아래 안내를 참고하세요.

:::caution[인스턴스 키]
`BASEDB_ENCRYPTION_KEY`는 세션에 서명하고 저장된 비밀 정보(AI 키, 웹훅 시크릿, 양식 링크)를
암호화합니다. 이 키를 바꾸면 모든 사용자가 로그아웃되고 이 비밀 정보를 더 이상 읽을 수
없습니다. 한 번만 생성하고 데이터베이스와 함께 백업하세요.
:::

## 개발 환경

사전 요구 사항: Node 22 이상, Docker, `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start`는 사용 가능한 포트를 고르고, 일회용 PostgreSQL 16을 시작하고, 카탈로그를
적용하고, 개발용 관리자(`admin@basedb.local` / `developpement-basedb`, 로그인 화면에 주소가
미리 채워짐)를 만든 다음, API, MCP 서버, 인터페이스를 개발 모드로 실행합니다. `Ctrl+C`를
누르면 컨테이너를 포함해 모두 중지됩니다.

## 다음 단계

- [시작하기](/basedb/ko/guides/premiers-pas/): 데이터베이스, 테이블, 보기, 양식.
- [환경 변수](/basedb/ko/hebergement/variables/): 파일, AI, 주소.

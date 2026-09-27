---
title: 도메인과 HTTPS
description: 기본 제공되는 Caddy 프록시 뒤에서 도메인과 HTTPS로 basedb를 제공합니다.
---

운영 환경에서는 basedb를 **HTTPS**로 제공해야 합니다. 세션 쿠키가 `Secure`이고 `__Host-` 접두사가
붙어 있어, 브라우저는 `localhost`에서만 HTTP로 이 쿠키를 받아들입니다.

이미지는 이미 모든 것을 하나의 주소로 제공합니다. 인터페이스, `/api` 아래의 API, `/mcp` 아래의
MCP 서버입니다. 남은 일은 HTTPS 프록시 뒤에 두는 것뿐입니다. `docker-compose.yml`에는
Let’s Encrypt 인증서를 스스로 발급받고 갱신하는 **Caddy** 프록시가 들어 있습니다.

## 설정 방법

1. 도메인의 DNS가 서버를 가리키게 하고, 포트 80과 443을 여세요.
2. `.env`에 다음을 입력합니다.

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. `https` 프로필로 시작합니다.

   ```bash
   docker compose --profile https up -d
   ```

포트 3000은 계속 `127.0.0.1`에만 공개됩니다. 외부 트래픽은 모두 Caddy를 거칩니다.

## 이 변수들이 필요한 이유

- `BASEDB_DOMAIN`: Caddy가 인증서를 요청할 도메인입니다.
- `BASEDB_PUBLIC_URL`: OIDC 로그인의 리디렉션 주소로, ID 공급자에 등록된 주소와 한 글자씩
  비교됩니다.
- Caddy는 방문자의 실제 주소로 `X-Forwarded-For`를 설정하며, basedb는 이 헤더가 사설
  네트워크에서 올 때 이를 신뢰합니다. 그러면 API의 속도 제한(로그인, 공유 양식)이 방문자별로
  계산됩니다.

## 다른 프록시

Nginx, Traefik, 로드 밸런서도 사용할 수 있습니다. 도메인의 트래픽을 **모두** 컨테이너의 포트
3000으로 보내고, 응답을 버퍼링하지 마세요(MCP 서버와 실시간 기능은 응답을 스트리밍합니다). 또한
프록시가 `X-Forwarded-For`에 값을 덧붙이지 않고 **대체**하는지 확인하세요.

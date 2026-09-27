---
title: 계정과 로그인
description: 누가 계정을 만들 수 있는지, 그리고 Google, Microsoft 또는 회사 SSO로 로그인하는 방법을 설명합니다.
---

## 첫 로그인

새 인스턴스에서는 첫 페이지에서 **관리자 계정**을 만듭니다. 이름, 이메일 주소, 원하는
비밀번호를 입력합니다. 다른 사람이 인스턴스에 접속할 수 있게 하기 전에, 즉 도메인에 연결하거나
모든 네트워크 인터페이스에 포트를 공개하기 전에 관리자 계정을 만드세요.

## 계정 생성

기본적으로 인스턴스에 접속할 수 있는 사람은 누구나 **계정을 만들고** 자신의 프로젝트를 만들 수
있습니다. 그 밖에는 아무것도 보이지 않으며, 다른 사람의 프로젝트는 **초대**를 통해서만 접근할
수 있습니다.

**시스템 관리 → 사용자**의 “계정 생성” 카드에서 다음을 설정합니다.

- 계정 생성을 막습니다. 이 경우 초대받은 사람만 계정을 만들 수 있습니다.
- 또는 특정 도메인으로 제한합니다. `exemple.fr, autre.fr`로 설정하면 이 도메인의 주소만
  허용됩니다.

## 프로젝트나 데이터베이스에 초대

프로젝트나 데이터베이스에 **관리** 권한이 있는 사람은 이를 공유할 수 있습니다. 프로젝트(또는
데이터베이스) 메뉴 → **공유…** 에서 이메일 주소와 수준(읽기, 편집, 관리)을 지정합니다.
basedb는 7일 동안 유효한 **초대 링크**를 만들며, 원하는 방법으로 그 사람에게 보내면 됩니다.
받은 사람은 링크를 열어 로그인하거나 계정을 만듭니다. 같은 화면에서 누가 접근할 수 있는지
확인하고, 수준을 바꾸거나 액세스를 제거할 수 있으며, 대기 중인 링크를 다시 보낼 수 있도록
보관합니다.

관리자는 자신이 관리하는 범위를 넘어 권한을 줄 수 없습니다. 데이터베이스 관리자는 그
데이터베이스를 공유할 수 있지만, 그 프로젝트는 공유할 수 없습니다.

## Google, Microsoft 등으로 로그인

basedb는 **OpenID Connect**를 지원합니다. Google, Microsoft Entra ID, GitLab, Keycloak,
Authentik, Okta 등을 쓸 수 있습니다. 공급자를 등록할 때마다 로그인, 계정 생성, 초대 화면에
“…(으)로 계속” 버튼이 추가됩니다.

1. `.env`에 basedb의 공개 주소를 설정합니다.

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. 공급자에서 웹 애플리케이션을 만듭니다. **리디렉션 주소**는
   `https://basedb.example.com/auth/oidc/<nom>/callback`이며, `<nom>`은 아래에서 지정하는
   이름(`google`, `microsoft` 등)입니다.

3. `.env`에 공급자를 등록합니다.

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: 시작할 때 basedb는 사용할 공급자 목록을 표시하고, 제외한 공급자에는
   무엇이 빠졌는지 알려 줍니다.

| `<NOM>` 공급자용 변수 | 역할 |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | 공급자에 등록한 애플리케이션 |
| `BASEDB_OIDC_<NOM>_ISSUER` | 발급자. `google`과 `gitlab`에는 필요 없음 |
| `BASEDB_OIDC_<NOM>_LABEL` | 버튼에 표시할 이름. 기본값은 `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | 기본값은 `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: 기존 계정만 허용 |

**첫 로그인 시 계정이 만들어지는** 방식은 계정 생성 설정을 따릅니다. 계정 생성이 열려 있으면
허용되고, 특정 도메인으로 제한되어 있으면 그 도메인의 주소만 허용됩니다. 이미 비밀번호 계정이
사용 중인 주소는 절대 연결되지 않습니다. 이 경우 계정 소유자는 비밀번호로 로그인합니다. 비밀
정보는 환경 변수에만 남으며, 데이터베이스에는 전혀 기록되지 않습니다.

:::note
GitHub는 OpenID Connect 공급자가 아니므로 여기서 사용할 수 없습니다.
:::

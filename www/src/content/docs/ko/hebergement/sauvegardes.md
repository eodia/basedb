---
title: 백업과 업데이트
description: basedb 인스턴스를 백업하고, 복원하고, 업데이트합니다.
---

basedb의 모든 상태는 세 가지로 이루어집니다. **PostgreSQL 데이터베이스**, 파일 필드와 이미지
필드의 **파일**, 그리고 **인스턴스 키**입니다. 세 가지를 모두 백업하세요.

## 데이터베이스

basedb 인스턴스는 일반 PostgreSQL 데이터베이스이므로 `pg_dump`로 충분합니다.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

복원하려면 빈 데이터베이스에서 다음을 실행합니다.

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## 파일

디스크 저장소를 사용하면 파일은 `basedb` 서비스의 `files` 볼륨에 있습니다.

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

S3 저장소를 사용한다면 저장소 제공업체의 백업 정책(버전 관리, 복제)을 따르세요.

## 인스턴스 키

`BASEDB_ENCRYPTION_KEY`는 데이터베이스에 저장된 비밀 정보(AI 키, 웹훅 시크릿, 자동화의 시크릿
헤더, 양식 링크)를 암호화합니다. **키 없이 데이터베이스 백업만 있으면 이 비밀 정보는 복원되지
않습니다.** 키는 비밀 정보 관리 도구에 백업과 함께 보관하세요.

## 업데이트

먼저 데이터베이스를 백업한 다음 실행합니다.

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION`을 설정하면 최신 버전(`latest`) 대신 특정 버전(`0.7.0`)으로 고정합니다.

시작할 때 basedb는 **카탈로그를 스스로 업데이트합니다**. 현재 버전에 아직 없는 마이그레이션을
순서대로, 각각 자체 트랜잭션 안에서 적용하고 `_basedb.catalog_migration`에 기록합니다. 데이터는
그대로 유지됩니다. 로그에 다음과 같이 표시됩니다.

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

버전을 건너뛸 수도 있습니다. 빠진 마이그레이션이 모두 순서대로 한 번에 적용됩니다. 마이그레이션이
실패하면 카탈로그는 이전 버전 그대로 남고 basedb는 시작되지 않으며, 로그에 해당 마이그레이션과
오류가 표시됩니다.

**이전 버전으로 되돌릴 수 없습니다.** 이전 버전은 더 최신 버전이 업데이트한 카탈로그에서
시작을 거부합니다. 모르는 형식에 쓰는 일을 막기 위해서입니다. 되돌리려면 업데이트 전에 만든
백업을 복원하세요.

같은 데이터베이스에서 basedb 인스턴스 여러 개를 실행하면 하나만 카탈로그를 업데이트하고 나머지는
기다립니다. `BASEDB_MIGRATE=0`을 설정하면 인스턴스가 마이그레이션하지 않습니다. 이 경우
카탈로그가 올바른 버전인지 확인만 하고, 그렇지 않으면 시작을 거부합니다.

---
title: 파일
description: 파일 필드와 이미지 필드의 파일을 디스크나 S3 호환 저장소에 보관합니다.
---

**파일** 필드와 **이미지** 필드에는 파일을 올릴 수 있습니다. 바이트는 **PostgreSQL에 저장되지
않습니다**. 열에는 목록을 만드는 데 필요한 정보(식별자, 이름, 유형, 크기)만 남고, 파일 자체는
전용 저장소에 보관되며 서명된 링크로 제공됩니다.

## 디스크

기본적으로 API는 파일을 디렉터리에 씁니다. Docker 이미지에서는 `/data/files`에 마운트된
`files` 볼륨입니다. 호스트가 하나라면 이것으로 충분합니다. API는 시작할 때 파일이 저장되는
위치를 알려 줍니다.

## S3 호환 저장소

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO 등:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   호스트 방식 주소 지정을 쓰려면
```

`BASEDB_S3_BUCKET`만 설정하고 다른 값을 설정하지 않으면 API가 시작을 거부하고 빠진 값을
알려 줍니다.

## 크기

`BASEDB_FILES_MAX_MB`는 파일 하나의 크기를 제한합니다(기본값 25MB).

:::note
링크로 공유한 양식은 파일 질문과 이미지 질문을 묻지 않습니다. 모르는 사람에게 파일 업로드를
열어 두지 않기 위해서입니다.
:::

---
title: 文件
description: 文件和图片字段，存储在磁盘上或兼容 S3 的存储中。
---

**文件**和**图片**字段用于接收文件。文件内容**不会存入 PostgreSQL**：列中只保存列出文件所需的信息（标识符、名称、类型、大小），文件本身存放在专用存储中，通过签名链接提供访问。

## 磁盘存储

默认情况下，API 将文件写入一个目录——在 Docker 镜像中，即挂载到 `/data/files` 的 `files` 卷。单台主机这样就足够了；API 启动时会说明文件的存放位置。

## 兼容 S3 的存储

AWS、Scaleway、OVH、Cloudflare R2、Garage、SeaweedFS、MinIO……：

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   使用基于主机名的寻址
```

如果设置了 `BASEDB_S3_BUCKET` 而没有设置其他值，API 会拒绝启动，并说明缺少哪些值。

## 大小

`BASEDB_FILES_MAX_MB` 限制单个文件的大小（默认 25 MB）。

:::note
通过链接共享的表单不会包含文件和图片问题：它们不会向陌生人开放文件上传。
:::

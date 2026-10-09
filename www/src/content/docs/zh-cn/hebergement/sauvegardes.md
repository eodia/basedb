---
title: 备份与更新
description: 备份、恢复和更新 basedb 实例。
---

basedb 的全部状态由三部分组成：**PostgreSQL 数据库**、文件和图片字段的**文件**，以及**实例密钥**。这三者都要备份。

## 数据库

basedb 实例就是一个普通的 PostgreSQL 数据库：使用 `pg_dump` 即可。

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

恢复时，在一个空数据库中执行：

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## 文件

使用磁盘存储时，文件位于 `basedb` 服务的 `files` 卷中：

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

使用 S3 存储时，请遵循存储服务商的备份策略（版本控制、复制）。

## 实例密钥

`BASEDB_ENCRYPTION_KEY` 用于加密数据库中保存的机密信息（AI 密钥、Webhook 密钥、自动化保密标头、表单链接）。**没有密钥的数据库备份无法恢复这些机密信息。** 请将密钥保存在您的机密管理工具中，与备份放在一起。

## 更新

先备份数据库，然后执行：

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` 可以固定一个具体版本（`0.7.0`），而不是使用最新版本（`latest`）。

启动时，basedb 会**自动更新其目录（catalog）**：它会按顺序应用您的版本尚未包含的迁移，每个迁移都在各自的事务中执行，并记录在 `_basedb.catalog_migration` 中。您的数据保持不变。日志会显示这一过程：

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

可以跨版本升级：所有缺失的迁移会按顺序一次性执行。如果某个迁移失败，目录会保持在上一个版本且完好无损，basedb 也不会启动：日志会指明出错的迁移及错误信息。

**不支持回退。** 较旧的版本会拒绝在已被较新版本更新过的目录上启动，而不是以它不了解的格式写入数据。如需回退，请恢复更新前所做的备份。

当多个 basedb 实例共用同一个数据库时，只有一个实例会更新目录，其他实例会等待。`BASEDB_MIGRATE=0` 会禁止某个实例执行迁移：它只检查目录是否处于正确的版本，否则拒绝启动。

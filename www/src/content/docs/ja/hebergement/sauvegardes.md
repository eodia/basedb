---
title: バックアップとアップデート
description: basedbインスタンスのバックアップ、復元、アップデート。
---

basedbの状態は、3つのものですべてです：**PostgreSQLデータベース**、ファイルフィールドと画像フィールドの**ファイル**、そして**インスタンスキー**。この3つをすべてバックアップしてください。

## データベース

basedbのインスタンスは通常のPostgreSQLデータベースなので、`pg_dump`で十分です。

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

復元するには、空のデータベースに対して次を実行します：

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## ファイル

ディスクストレージの場合、ファイルは`basedb`サービスの`files`ボリュームにあります：

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

S3ストレージの場合は、プロバイダーのバックアップ方針（バージョニング、レプリケーション）に従ってください。

## インスタンスキー

`BASEDB_ENCRYPTION_KEY`は、データベースに保存されたシークレット（AIのキー、Webhookのシークレット、フォームのリンク）を暗号化します。**キーのないデータベースのバックアップでは、これらのシークレットは復元できません。** キーはシークレット管理ツールに、バックアップと一緒に保管してください。

## アップデート

まずデータベースをバックアップしてから、次を実行します：

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION`で、最新版（`latest`）ではなく特定のバージョン（`0.3.0`）に固定できます。

起動時に、basedbは**カタログを自動で更新**します。現在のバージョンにまだ適用されていないマイグレーションを、順番に、それぞれ独自のトランザクションで適用し、`_basedb.catalog_migration`に記録します。データはそのまま残ります。ログにはその旨が表示されます：

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

バージョンを飛ばしてアップデートすることもできます。不足しているマイグレーションは、すべて順番に一度に適用されます。マイグレーションが失敗すると、カタログは前のバージョンのまま損なわれずに残り、basedbは起動しません。ログには、そのマイグレーションとエラーが示されます。

**ダウングレードはできません。** 古いバージョンは、知らない形式に書き込むことを避けるため、新しいバージョンが更新したカタログでは起動を拒否します。元に戻すには、アップデート前に取ったバックアップを復元してください。

同じデータベースで複数のbasedbインスタンスを動かしている場合、カタログを更新するのは1つだけで、他のインスタンスはそれを待ちます。`BASEDB_MIGRATE=0`を設定したインスタンスはマイグレーションを行わず、カタログが正しいバージョンかどうかを確認するだけで、そうでなければ起動を拒否します。

---
title: ファイル
description: ファイルフィールドと画像フィールド。ディスク、またはS3互換ストレージに保存します。
---

**ファイル**フィールドと**画像**フィールドには、ファイルを添付できます。バイト列は**PostgreSQLには保存されません**。列には一覧表示に必要な情報（ID、名前、種類、サイズ）だけが保存され、ファイル本体は専用のストレージに置かれ、署名付きリンクで配信されます。

## ディスク

デフォルトでは、APIはファイルをディレクトリに書き込みます。Dockerイメージでは、`/data/files`にマウントされた`files`ボリュームです。ホストが1台ならこれで十分です。APIは起動時に、ファイルの保存先を表示します。

## S3互換ストレージ

AWS、Scaleway、OVH、Cloudflare R2、Garage、SeaweedFS、MinIOなど：

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   ホスト形式のアドレス指定にする場合
```

`BASEDB_S3_BUCKET`だけが設定され、他の値がない場合、APIは起動を拒否し、不足している値を示します。

## サイズ

`BASEDB_FILES_MAX_MB`で、1ファイルあたりのサイズの上限を設定します（デフォルトは25 MB）。

:::note
リンクで共有したフォームでは、ファイルと画像の質問は表示されません。見知らぬ人にファイルのアップロードを開放しないためです。
:::

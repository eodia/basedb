---
title: 直接SQL
description: psql、BIツール、スクリプトでbasedbのテーブルを読み書きします。
---

これこそがbasedbの存在理由です：**テーブルは本物のテーブルです**。どのPostgreSQLクライアントでも、その名前のまま読めます。

## 名前

| オブジェクト | 物理名 | 例 |
|---|---|---|
| データベース | スキーマ`b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| ステージング環境 | 接尾辞付きのスキーマ | `b_t4z56fq_ventes_recette` |
| テーブル | スラッグ化した名前 | `opportunites` |
| フィールド | スラッグ化した名前 | `echeance` |
| リレーション | `<table cible>_id` | `clients_id` |
| [SQLビュー](/basedb/ja/fonctionnalites/requetes-et-vues-sql/) | データベースのスキーマ内の技術名 | `factures_a_encaisser` |

各データベースの**APIとMCPのドキュメント**ページにすべての名前が載っており、`psql`の`\d`で説明（`COMMENT ON`）を確認できます。

## インターフェースで

タブバーの **+**、またはデータベースの **⋯** メニュー → **SQLクエリ**：シンタックスハイライトと補完付きのエディターで、結果はテーブルと同じグリッドに表示されます。

![保存済みクエリと、テーブルと並ぶ2つのSQLビュー](../../../../assets/screens/requete-sql.png)

- **各自が自分の権限で読みます**：管理レベルならデータベース全体を、書き込みも含めて扱えます。他のメンバーは読み取り専用のSQLを書き、閉じられたテーブルは存在せず、非表示のフィールドは消えます。
- クエリはテーブルの下に**保存**でき（自分用、データベース全体用、またはグループ用）、必要なら**SQLビュー**にできます。テーブルと並んで表示され、`psql`からも読める本物のPostgreSQLビューです。

詳しくは[クエリとSQLビュー](/basedb/ja/fonctionnalites/requetes-et-vues-sql/)をご覧ください。

## psqlから

付属の`docker-compose.yml`では、PostgreSQLは`127.0.0.1:5432`に公開されています：

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## SQLで書き込む

書き込みもできます。制約（単一選択、リレーション、URL、必須）はPostgreSQLが守っており、インターフェースと同じように無効な値を拒否します。そして書き込みは**履歴に記録**されます。履歴には、書き込んだセッションとともに「直接SQLセッション」として表示され、他の書き込みと同じように元に戻せます。

:::caution
SQLで**構造**を変更する（`ALTER TABLE`）と、basedbのカタログを迂回することになり、カタログはその変更を把握できません。インターフェース、API、またはエージェントの提案を使ってください。マイグレーションエンジンが計画を立て、ロックを短く保ち、カタログを正確に維持します。
:::

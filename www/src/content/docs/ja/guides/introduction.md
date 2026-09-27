---
title: はじめに
description: basedbとは何か、そして共同編集型スプレッドシートとどこが違うのか。
---

**basedb**は、共同編集型スプレッドシートの発想を受け継いだ、セルフホスト型の共同データベースです。そして、ほかのすべてを決定づける違いがひとつあります。**データは本物のPostgreSQLテーブルに、型付きで、わかりやすい名前のまま保存されます**。

![basedbのテーブルのグリッド](../../../../assets/screens/grille.png)

## シンプルな約束

汎用モデルも、何でも詰め込む`JSONB`も、`field_1837`もありません：

| basedbでは | PostgreSQLでは |
|---|---|
| データベース「Ventes」 | スキーマ`b_t4z56fq_ventes` |
| テーブル「Opportunités」 | テーブル`opportunites` |
| フィールド「Échéance」（日付） | 列`echeance date` |
| 単一選択「Statut」 | `text`列とその`CHECK`制約 |
| リレーション「Client」 | `clients_id uuid`列とその`FOREIGN KEY` |

そのため、`psql`やBIツール、Pythonスクリプトを開けば、製品を経由せずにデータを読めます。書き込むこともできます。制約はそのまま守られ、その書き込みも履歴に記録されます。

## 対象ユーザー

- **業務チーム**：開発を待たずに、グリッド、ビュー、フォームを使いたい人たち。
- **技術チーム**：データを独自形式に閉じ込められるのを嫌い、使い慣れたツールをつなぎたい人たち。
- **AIエージェント**：MCPサーバー、明確な権限、そして人が判断する提案のしくみが用意されています。

## basedbでできること

- 型付きの[テーブルとフィールド](/basedb/ja/fonctionnalites/tables-et-champs/)、本物の外部キーであるリレーション（複数リレーションも可）、PostgreSQLが計算する数式、リレーションをたどるルックアップとロールアップ。
- 8種類の[ビュー](/basedb/ja/fonctionnalites/vues/)：グリッド、カンバン、カレンダー、タイムライン、ギャラリー、リスト、フォーム、アンケート。コラボレーションビューにも個人ビューにもできます。
- リンクで共有する[フォーム](/basedb/ja/fonctionnalites/formulaires-partages/)と[ビュー](/basedb/ja/fonctionnalites/vues-partagees/)、そしてカレンダーアプリから購読できるカレンダー。
- [コラボレーション](/basedb/ja/fonctionnalites/collaboration/)：コメントとメンション、通知、リアルタイム更新。
- [オートメーション](/basedb/ja/fonctionnalites/automatisations/)と[ダッシュボード](/basedb/ja/fonctionnalites/tableaux-de-bord/)、そしてその質問。マウス操作でもSQLでも作れます。
- [誰もが使えるSQL](/basedb/ja/fonctionnalites/requetes-et-vues-sql/)。ただし各自の権限で実行されます：テーブルの下に保存するクエリと、テーブルと並んで表示される本物のPostgreSQLビュー。
- ギャラリーから選ぶか、AIに依頼して作る[データベーステンプレート](/basedb/ja/fonctionnalites/modeles/)。
- 比較や移行ができる[環境](/basedb/ja/fonctionnalites/environnements/)（本番、ステージング）。
- 直接SQLも含めた、すべての書き込みの[履歴](/basedb/ja/fonctionnalites/historique/)。Ctrl+Zで元に戻せます。
- グループ単位で、フィールドレベルまで設定できる[権限](/basedb/ja/fonctionnalites/droits/)。
- [REST API](/basedb/ja/integrations/api-rest/)、[MCPサーバー](/basedb/ja/integrations/mcp/)、[Webhook](/basedb/ja/integrations/webhooks/)、Slack、[同期テーブル](/basedb/ja/integrations/synchronisation/)。
- オプションの[AI](/basedb/ja/fonctionnalites/ia/)：モデルが計算するフィールド、Copilot。

## プロジェクトの状況

basedbは、AIネイティブなソフトウェアスタジオである[Eodia](https://eodia.com/fr/)が開発するフリーソフトウェア（AGPL-3.0）で、現在も活発に開発が続いています。コア、API、MCPサーバー、インターフェースはすでに動作しており、1,000件を超えるテストで検証されています。今後の予定は[ロードマップ](/basedb/ja/feuille-de-route/)で確認できます。20章ほどからなる[アーキテクチャ文書](https://github.com/eodia/basedb/tree/main/docs/architecture)が、すべての設計判断を定めています。

:::tip[試してみる]
リポジトリをクローンしたら、コマンドひとつで始められます：`docker compose up -d`。詳しくは[インストール](/basedb/ja/guides/installation/)をご覧ください。
:::

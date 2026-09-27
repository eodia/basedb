---
title: データベーステンプレート
description: テンプレートから始める、AIに作ってもらう、JSONで独自に書く、そしてすべてのインスタンス向けに公開する。
---

**テンプレート**を使うと、クリックひとつでデータベース全体を作成できます。テーブルとそのリレーション、サンプル行、ビュー、ダッシュボード、オートメーション、そしてAIが自動で埋めるフィールドまで含まれます。basedbが提供するテンプレートは、[テンプレートギャラリー](/basedb/ja/modeles/)で見られます。

## テンプレートから始める

**新しいデータベース**、続いて **テンプレートから始める、またはAIに依頼** を選ぶと、ギャラリーが開きます。

![アプリ内のテンプレートギャラリー](../../../../assets/screens/modeles.png)

各テンプレートは、使う前に全体を確認できます。テーブルとそのフィールド、ビュー、オートメーション、そして各AIフィールドの指示です。**データベースを作成**を押すとラベルを尋ねられ、AIフィールドがある場合は、それらが引用する値をインスタンスのAIプロバイダーに送ることへの同意を求められます。同意しない場合、それらは通常のフィールドとなり、サンプル値が入ります。

空のプロジェクトでは、**デモデータベース**も作成できます。小さなエージェンシーの顧客、プロジェクト、タスク、請求書、レビューが入っており、basedbのあらゆる機能を紹介します。

## AIに作ってもらう

ギャラリーの上部で、必要なものを一文で説明します（「顧客からのクレームの管理。トーン分析付き」）。AIが完全なデータベースを提案します：テーブル、現実的なサンプル行、ビュー、ダッシュボード、そして用途に合う場合はAIフィールド。テンプレートと同じように内容を確認し、**調整**（「仕入先のテーブルを追加して」）してから作成できます。AIが受け取るのは入力した文だけで、どのデータベースのデータも送られません。クリックするまで何も作成されません。

## JSONでテンプレートを書く

テンプレートはJSONドキュメントです。骨組みは次のとおりです：

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

主なルール：

- **すべてラベルで参照します**：ビュー内のフィールド、フィルター（`[Statut] ne "Résolu"`）、数式（`[Prix] * [Quantité]`）、AIの指示やメッセージ（`{{Titre}}`）。選択肢も、そのラベルで指定します。
- テーブルの**最初のフィールド**が、そのテーブルの表示フィールドになります：テキスト、数値、日付、メールアドレス、またはURL。
- **リレーション**はフィールドとしてではなく、`links`で宣言します。行からは`"@clé"`（対象テーブルの行の`$key`）で参照します。
- **日付**は、テンプレートを適用した日からの相対指定ができます：`"today"`、`"+3d"`、`"-2w"`、`"+1m"`。日時の場合は時刻を加えます：`"+1d 14:30"`。メンバーは`"$moi"`と書きます。
- **AIフィールド**は`"ai": { "prompt": "…" }`を持ち、サンプル値を持たせることもできます。サンプル値は、AIを使わない場合にのみ書き込まれます。
- テンプレートには、共有、権限、Webhook、ファイル、`"$moi"`以外のメンバーを**決して**含めません。テンプレートは外部から持ち込まれることもあるため、何も開放してはならないからです。

完全なリファレンス（すべてのフィールドの型、ビューのキー、上限値）は、リポジトリにあるアーキテクチャ文書の第20章にあります。

## すべてのインスタンス向けにテンプレートを公開する

公式ギャラリーのテンプレートは、リポジトリの[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)フォルダーにあるファイルです。テンプレートごとに1ファイルで、`key`にちなんだ名前が付いています。公開サイトはこれを[ギャラリー](/basedb/ja/modeles/)にし、カタログ全体を[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json)で公開しています。各インスタンスは、誰かがギャラリーを開いたときにこれを読み込み、1時間保持します。ファイルを変更してサイトを再公開するだけで、すべてのインスタンスのギャラリーが変わります。

各テンプレートは、サーバーと同じバリデーターで、サイトのビルド時に検証されます。無効なテンプレートがあるとビルドが失敗するため、ユーザーに届くことはありません。

インスタンスは`BASEDB_TEMPLATES_URL`のアドレスを読み込みます。デフォルトは公開サイトのアドレスです。独自のカタログを指定することも、`off`にして何も読み込まないようにすることもできます。その場合、インスタンスは自身のバージョンに組み込まれたテンプレートを提供します。

## インスタンス独自のテンプレート

管理者は、ギャラリーから（「JSONをインポート」）**JSONテンプレートをインスタンスにインポート**できます。インポートしたテンプレートはすべてのユーザーのギャラリーに加わり、同じキーのテンプレートを置き換えます。AIの提案も、クリックひとつで追加できます。

どのデータベースもテンプレートにできます。データベースのメニューの**その他の操作**にある**テンプレートとして保存**を使います。テーブル、フィールド、AIの指示、リレーション、共有ビュー、ダッシュボード、オートメーション、さらに必要に応じてテーブルごとに最大50行がJSONとしてダウンロードされ、公式カタログやインスタンスのカタログにそのまま追加できます。行を検索する、分岐する、前のステップを引用するオートメーションは、現時点では含まれず、画面にその旨が表示されます。

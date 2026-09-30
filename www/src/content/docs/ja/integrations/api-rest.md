---
title: REST API
description: プログラムからbasedbの行を読み書きします。
---

REST APIは、インターフェースが使っているものと同じです。**非公開のルートは存在しません**。URLには物理名が使われます。SQLで読むときと同じ名前です。

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## トークン

インターフェースで、データベースの **⋯** メニュー → **APIとエージェント** → **APIとMCPのトークン…** を開きます。パスワードを確認したうえで、このデータベースに限定された**連携トークン**を作成できます。デフォルトは読み取り専用です。トークンは一度しか表示されないので、環境変数に保存してください。

書き込み可能として作成したトークンは、読み取り、作成、変更ができますが、**削除は決してできません**。また、作成した人を超える権限を持つこともありません。

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## 読み取り

| パラメーター | 役割 |
|---|---|
| `filter` | 読みやすい式：`statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | 返す列 |
| `limit`、`after` | 暗号化されたカーソルによるページング：あるページの`meta.next_cursor`を`after`に渡すと次のページが得られます（`meta.has_next_page`） |
| `links=display` | リレーションを表示値付きで返します |
| `count=exact` | 総件数（上限は100,000） |
| `variables=raw` | 長文テキストを、[行の値](/basedb/ja/fonctionnalites/tables-et-champs/#リッチテキストと変数)に置き換えず、`{{colonne}}`を含めて書かれたとおりに返します |

演算子：`eq`、`ne`、`eq_ci`、`contains`、`starts_with`、`ends_with`、`in`、`is_null`、`gt`、`gte`、`lt`、`lte`、`between`。これらを`and`、`or`、`not`と括弧で組み合わせます。フィルターはリレーションをたどれます：`clients_id.ville eq "Lyon"`。

## 書き込み

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>`は、同じ本文`{"values": {…}}`で行を更新します。エラーの形式は1つに統一されています：`{ "code": "…", "details": {…}, "request_id": "…" }`。コードは原因ごとに固定です。

各書き込みは`x-basedb-transaction`ヘッダーを返します。これを`POST /api/v1/<tenant>/history/undo`（`{"transaction": "…"}`）に渡すと、インターフェースのCtrl+Zと同じように書き込みが元に戻ります。その後に行が変更されていた場合は拒否されます。

## 行以外の操作

同じトークンで、次の操作ができます：

| ルート | 役割 |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | フィルターに該当する全行の集計：`aggregates=montant:sum,nom:filled`、`group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`、`POST` | 行のコメントの読み書き |
| `POST /api/v1/<tenant>/automations/<id>/run` | ボタンをトリガーとするオートメーションを、行に対して実行します（`{"record": "…"}`） |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | データベースのダッシュボード |
| `GET /api/v1/<tenant>/meta/users` | ワークスペースのメンバー（メンバーフィールド用） |
| `GET /api/v1/<tenant>/meta/templates` | ギャラリーのデータベーステンプレート |

[共有ビュー](/basedb/ja/fonctionnalites/vues-partagees/)は、アカウントなしで読めます：`GET /api/v1/views/<jeton>`と`…/rows`はJSONで、`…/calendar.ics`はiCalendarで取得できます。

構築（オートメーション、ダッシュボード、連携の作成）は、インターフェースのセッションに限られます。トークンは行を読み書きするためのもので、データベースを変更するものではありません。

## 生成されるドキュメント

各データベースには、**APIとMCPのドキュメント**ページがあります。テーブルごとに、エンドポイント、列、cURLとJavaScriptの例が載っています。**自分の権限で絞り込まれる**ため、2人の閲覧者はそれぞれ別の版を見ることになり、**画面の言語で**書かれます。OpenAPI 3.1版（`/api/v1/<tenant>/meta/bases/<base>/openapi.json`）もあります。名前、パス、エラーコードは、どの言語でも変わりません。

![データベースの生成ドキュメント](../../../../assets/screens/ja/documentation-api.webp)

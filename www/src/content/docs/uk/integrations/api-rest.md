---
title: REST API
description: Читання й запис рядків basedb із програми.
---

REST API — той самий, яким користується інтерфейс: **приватних маршрутів не існує**. Його URL
містять фізичні назви — ті самі, які ви бачите і в SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Токен

В інтерфейсі: меню **⋯** бази → **API та агенти** → **Токени API та MCP…**: тут після
підтвердження пароля створюють **токен інтеграції**, обмежений цією базою і типово призначений
лише для читання. Він показується лише один раз; збережіть його у змінній середовища.

Токен читає, створює й змінює рядки, якщо його створено з правом запису, **ніколи нічого не
видаляє** і ніколи не має більше дозволів, ніж людина, яка його створила.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Читання

| Параметр | Призначення |
|---|---|
| `filter` | зрозумілий вираз: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | стовпці, які треба повернути |
| `limit`, `cursor` | пагінація зашифрованим курсором (`next_cursor` у відповіді) |
| `links=display` | зв’язки з їхнім значенням відображення |
| `count=exact` | загальна кількість, не більше 100 000 |
| `variables=raw` | довгі тексти в тому вигляді, як їх записано, разом із `{{colonne}}`, а не зі [значеннями рядка](/basedb/uk/fonctionnalites/tables-et-champs/#форматований-текст-і-змінні) |

Оператори: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, які поєднуються через `and`, `or`, `not` і дужки. Фільтр
проходить через зв’язок: `clients_id.ville eq "Lyon"`.

## Запис

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` змінює рядок із тим самим тілом `{"values": {…}}`. Помилки мають
єдину форму: `{ "code": "…", "details": {…}, "request_id": "…" }` зі стабільним кодом для
кожної причини.

Кожен запис повертає заголовок `x-basedb-transaction`: якщо передати його в
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`), запис буде скасовано, як за
Ctrl+Z в інтерфейсі, — або відхилено, якщо рядок відтоді змінився.

## Поза межами рядків

З тим самим токеном:

| Маршрут | Призначення |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | підсумки за всіма рядками фільтра: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | читання й запис коментарів рядка |
| `POST /api/v1/<tenant>/automations/<id>/run` | запуск автоматизації з тригером «кнопка» для рядка (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | інформаційні панелі бази |
| `GET /api/v1/<tenant>/meta/users` | учасники робочого простору для поля «Особа» |
| `GET /api/v1/<tenant>/meta/templates` | шаблони баз із галереї |

[Опубліковані подання](/basedb/uk/fonctionnalites/vues-partagees/) читаються без облікового
запису: `GET /api/v1/views/<jeton>` і `…/rows` у JSON, `…/calendar.ics` в iCalendar.

Побудова — створення автоматизації, інформаційної панелі, інтеграції — доступна лише в сеансі
інтерфейсу: токен читає й записує рядки, але не змінює базу.

## Згенерована документація

Кожна база має сторінку **Документація API та MCP**: для кожної таблиці — її кінцеві точки,
стовпці, приклади на cURL і JavaScript. Вона **відфільтрована за вашими дозволами** — двоє
читачів отримують дві різні версії, — написана **мовою вашого екрана**, і також доступна у
форматі OpenAPI 3.1 (`/api/v1/<tenant>/meta/bases/<base>/openapi.json`). Назви, шляхи та коди
помилок лишаються однаковими в усіх мовах.

![Згенерована документація бази](../../../../assets/screens/documentation-api.png)

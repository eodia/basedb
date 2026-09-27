---
title: Встановлення
description: Встановлення basedb за допомогою Docker Compose або запуск середовища розробки.
---

basedb вміщується в **один образ Docker**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 і arm64): **інтерфейс**, **API** та **сервер MCP**, що обслуговуються за однією
адресою. Йому потрібна база **PostgreSQL 16**, яку надає `docker-compose.yml`.

## За допомогою Docker Compose (рекомендовано)

Передумови: Docker із Compose v2. Достатньо двох файлів, код не потрібен:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Відкрийте `.env` і заповніть лише два обов’язкові значення:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# генерується один раз назавжди: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Потім запустіть:

```bash
docker compose up -d
```

Під час першого запуску basedb створює каталог. Потім відкрийте
[http://localhost:3000](http://localhost:3000): перша сторінка попросить вас **створити
обліковий запис адміністратора** — з вашим іменем, адресою та паролем на ваш вибір, — і ви
одразу ж увійдете в систему.

:::caution[Перший візит створює адміністратора]
Доки не існує жодного адміністратора, його створює перша людина, яка відкриє інтерфейс.
Створіть його **до того**, як екземпляр стане доступним для інших, — на домені або з портом,
відкритим на всіх інтерфейсах.
:::

Для встановлення без втручання вкажіть адміністратора в `.env` через
`BASEDB_ADMIN_EMAIL`: basedb створить його під час першого запуску й покаже його пароль **лише
один раз** у своїх журналах (`docker compose logs basedb`), якщо тільки ви не задасте його
через `BASEDB_ADMIN_PASSWORD`.

| Адреса | Роль |
|---|---|
| http://localhost:3000 | інтерфейс |
| http://localhost:3000/api | REST API та його документація |
| http://localhost:3000/mcp | сервер MCP для агентів |
| localhost:5432 | PostgreSQL для `psql` і ваших інструментів |

Порти відкриваються лише на `127.0.0.1`. Щоб обслуговувати basedb на домені, див.
[Домен і HTTPS](/basedb/uk/hebergement/https/).

## З вашим власним PostgreSQL

Достатньо самого образу й бази PostgreSQL 16 або новішої (роль — власник бази, доступні
розширення `pg_trgm` і `unaccent`):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Збережіть згенерований ключ: див. примітку нижче.

:::caution[Ключ екземпляра]
`BASEDB_ENCRYPTION_KEY` підписує сеанси й шифрує збережені секрети (ключі ШІ, секрети
вебхуків, посилання на форми). Його зміна виводить із системи всіх користувачів і робить ці
секрети нечитабельними. Згенеруйте його один раз і зберігайте резервну копію разом із базою.
:::

## Для розробки

Передумови: Node 22 або новіший, Docker і `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` вибирає вільні порти, запускає тимчасовий PostgreSQL 16, застосовує каталог,
створює адміністратора для розробки (`admin@basedb.local` / `developpement-basedb`, адресу
попередньо заповнено на сторінці входу), а потім запускає API, сервер MCP та інтерфейс у
режимі розробки. `Ctrl+C` зупиняє все, зокрема контейнер.

## Що далі?

- [Перші кроки](/basedb/uk/guides/premiers-pas/): база, таблиця, подання, форма.
- [Змінні середовища](/basedb/uk/hebergement/variables/): файли, ШІ, адреси.

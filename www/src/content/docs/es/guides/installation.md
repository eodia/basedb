---
title: Instalación
description: Instalar basedb con Docker Compose o lanzar la pila de desarrollo.
---

basedb cabe en **una sola imagen Docker**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 y arm64): la **interfaz**, la **API** y el **servidor MCP**, servidos en una sola
dirección. Necesita una base de datos **PostgreSQL 16**, que proporciona el `docker-compose.yml`.

## Con Docker Compose (recomendado)

Requisitos: Docker con Compose v2. Bastan dos archivos, no hace falta el código:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Abre `.env` y rellena los dos únicos valores obligatorios:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# se genera una sola vez: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Después, arranca:

```bash
docker compose up -d
```

En el primer arranque, basedb crea el catálogo. Abre después
[http://localhost:3000](http://localhost:3000): la primera página te pide **crear la
cuenta de administrador**, con tu nombre, tu dirección de correo y la contraseña que elijas, y
quedas conectado acto seguido.

:::caution[La primera visita crea el administrador]
Mientras no exista ningún administrador, la primera persona que abra la interfaz lo crea.
Créalo **antes** de hacer que la instancia sea accesible para otros, ya sea en un dominio o con
un puerto publicado en todas las interfaces.
:::

Para una instalación desatendida, indica el administrador en `.env` con
`BASEDB_ADMIN_EMAIL`: basedb lo crea en el primer arranque y muestra su contraseña **una
sola vez** en sus registros (`docker compose logs basedb`), a menos que la fijes
con `BASEDB_ADMIN_PASSWORD`.

| Dirección | Función |
|---|---|
| http://localhost:3000 | la interfaz |
| http://localhost:3000/api | la API REST y su documentación |
| http://localhost:3000/mcp | el servidor MCP, para los agentes |
| localhost:5432 | PostgreSQL, para `psql` y tus herramientas |

Los puertos se publican solo en `127.0.0.1`. Para servir basedb en un dominio, consulta
[Dominio y HTTPS](/basedb/es/hebergement/https/).

## Con tu propio PostgreSQL

Basta con la imagen, junto con una base de datos PostgreSQL 16 o superior (rol propietario de la
base de datos, extensiones `pg_trgm` y `unaccent` disponibles):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Guarda la clave generada: consulta el recuadro de abajo.

:::caution[La clave de instancia]
`BASEDB_ENCRYPTION_KEY` firma las sesiones y cifra los secretos guardados (claves de IA,
secretos de webhooks, enlaces de formularios). Cambiarla desconecta a todo el mundo y deja
ilegibles esos secretos. Genérala una sola vez y guárdala junto con la copia de seguridad de la
base de datos.
:::

## Para desarrollar

Requisitos: Node 22 o superior, Docker y `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` elige puertos libres, arranca un PostgreSQL 16 desechable, aplica el catálogo,
crea un administrador de desarrollo (`admin@basedb.local` / `developpement-basedb`,
dirección ya rellenada al iniciar sesión) y luego lanza la API, el servidor MCP y la interfaz en
modo desarrollo. `Ctrl+C` lo detiene todo, contenedor incluido.

## ¿Y después?

- [Primeros pasos](/basedb/es/guides/premiers-pas/): una base, una tabla, una vista, un formulario.
- [Variables de entorno](/basedb/es/hebergement/variables/): archivos, IA, direcciones.

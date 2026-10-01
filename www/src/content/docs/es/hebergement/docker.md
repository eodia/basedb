---
title: Docker Compose
description: La imagen, los servicios, los volúmenes y la operación diaria.
---

basedb se publica en **una sola imagen**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
para amd64 y arm64. El `docker-compose.yml` del repositorio la combina con PostgreSQL. Toda la
configuración pasa por un archivo `.env` (consulta
[Variables de entorno](/basedb/es/hebergement/variables/)).

## La imagen

Contiene los tres procesos de basedb y los sirve en **un solo puerto, el 3000**:

| Ruta | Proceso |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | la API REST, el inicio de sesión, las tareas en segundo plano |
| `/mcp` | el servidor MCP, para los agentes |
| todo lo demás: `/`, `/f/…`, `/v/…` | la interfaz |

Al arrancar, la API va primero: sobre una base de datos vacía, aplica el catálogo y crea el
primer administrador; en los arranques siguientes, ambas cosas no tienen efecto. El servidor MCP arranca
en cuanto ella responde. Si uno de los procesos se detiene, se detiene el contenedor entero, y la política
de reinicio lo vuelve a lanzar entero.

La imagen se ejecuta con el usuario `node`, sobre Node 22, y declara una comprobación de estado
(`/healthz`) y un volumen, `/data`, para los archivos de los campos Archivo e Imagen.

| Etiqueta | Contenido |
|---|---|
| `latest` | la última versión publicada |
| `0.5` | la última versión 0.5.x |
| `0.5.1` | exactamente esa versión |

## Los servicios

| Servicio | Imagen | Puerto (en 127.0.0.1) | Volumen |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (opcional) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Comandos útiles

```bash
docker compose up -d                # descargar la imagen y arrancar
docker compose logs -f basedb       # seguir basedb (contraseña de admin en el primer arranque)
docker compose ps                   # estado y salud de los servicios
docker compose restart basedb       # reiniciar basedb
docker compose down                 # detener (los volúmenes se conservan)
```

Desde un clon del repositorio, `docker compose up -d --build` construye la imagen a partir del código
en lugar de descargarla.

## Detrás de una pasarela, bajo una ruta

Cuando basedb se publica bajo una ruta —`https://passerelle.example.com/basedb/` en lugar de la
raíz de un dominio—, indica esa ruta:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# o, sin dirección pública:
BASEDB_BASE_PATH=/basedb
```

Todo pasa entonces por `/basedb`: la interfaz, `/basedb/api`, `/basedb/mcp`, los enlaces para
compartir y los de los correos electrónicos. La pasarela puede **conservar la ruta** al
transmitir la solicitud, o **quitarla**: basedb acepta ambas opciones. `BASEDB_BASE_PATH=/`
fuerza la raíz.

La imagen es la misma para todas las direcciones: la ruta se escribe en la interfaz al arrancar
el contenedor, y cambiar de ruta solo requiere un reinicio.

## Cambiar los puertos

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Una base de datos PostgreSQL existente

Define `DATABASE_URL`: basedb se conecta a ella en lugar de al contenedor `db` (que arranca de todos modos,
sin usarse; quítalo en un archivo `docker-compose.override.yml` si lo prefieres). Hace falta
PostgreSQL 16 o superior, un rol propietario de la base de datos y las extensiones `pg_trgm` y `unaccent`
disponibles. En ese caso basta con la imagen: consulta [Instalación](/basedb/es/guides/installation/).

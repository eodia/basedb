---
title: Variables de entorno
description: Todas las variables que lee basedb y su valor predeterminado.
---

Todas se colocan en el archivo `.env`, junto a `docker-compose.yml`, que lee `docker compose`
(el ejemplo completo y comentado es `.env.example`). Con `docker run`, pásalas con `-e`. **Un valor vacío equivale a «no definido».**

## Obligatorias

| Variable | Función |
|---|---|
| `POSTGRES_PASSWORD` | contraseña del contenedor PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | clave de instancia: firma las sesiones y cifra los secretos. `openssl rand -base64 32`, una sola vez |

## Base de datos

| Variable | Predeterminado | Función |
|---|---|---|
| `POSTGRES_USER` | `basedb` | rol PostgreSQL |
| `POSTGRES_DB` | `basedb` | base de datos PostgreSQL |
| `POSTGRES_PORT` | `5432` | puerto publicado en 127.0.0.1 |
| `DATABASE_URL` | el contenedor `db` | una base de datos PostgreSQL 16+ propia |

## Primer arranque

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | aplica el catálogo en una base de datos vacía |
| `BASEDB_BOOTSTRAP` | `1` | prepara el primer administrador |
| `BASEDB_TENANT` | `t4z56fq` | referencia del tenant, en las URL de la API |
| `BASEDB_ADMIN_EMAIL` | — | dirección del primer administrador, que se crea al arrancar; si está vacía, lo crea la primera persona que abra la interfaz |
| `BASEDB_ADMIN_PASSWORD` | generada, se muestra una vez | con `BASEDB_ADMIN_EMAIL`, su contraseña; si está definida, se vuelve a aplicar al administrador en **cada** arranque: quítala una vez que hayas iniciado sesión |

## Inicio de sesión con Google, Microsoft… (OIDC)

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | los proveedores ofrecidos, separados por comas: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | la aplicación registrada en el proveedor |
| `BASEDB_OIDC_<NOM>_ISSUER` | el de `google`, `gitlab` | el emisor OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | según el proveedor | el nombre del botón, los ámbitos solicitados |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: un primer inicio de sesión no crea una cuenta |

Consulta [Cuentas e inicio de sesión](/basedb/es/hebergement/connexion/).

## Direcciones

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_PORT` | `3000` | puerto publicado en 127.0.0.1: la interfaz, `/api` y `/mcp` |
| `BASEDB_VERSION` | `latest` | la etiqueta de la imagen `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | dirección pública de basedb, para el retorno OIDC |
| `BASEDB_DOMAIN` | — | el dominio servido en HTTPS por el proxy Caddy |
| `BASEDB_ORIGINS` | — | otros sitios cuyas páginas llaman a la API desde el navegador, separados por comas; innecesario para la interfaz de basedb, servida en la misma dirección |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | la API y el MCP vistos desde el navegador; solo hay que ajustarlos para la pila de desarrollo (`pnpm start`) |

## Archivos

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | tamaño máximo de un archivo |
| `BASEDB_S3_BUCKET` | — | activa el almacenamiento S3 |
| `BASEDB_S3_ENDPOINT` | — | endpoint S3 |
| `BASEDB_S3_REGION` | `us-east-1` | región |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | credenciales |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` para el direccionamiento por host |

## Plantillas de base

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | el catálogo del sitio público | de dónde lee la instancia las plantillas de su galería; `off` para no leer ninguna (las plantillas integradas se mantienen); consulta [Plantillas](/basedb/es/fonctionnalites/modeles/) |

## Inteligencia artificial

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` o `mistral` |
| `BASEDB_AI_MODEL` | — | el modelo |
| `BASEDB_AI_API_KEY` | — | la clave (si no, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | llamadas interactivas por hora y por tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | cálculos de campos de IA por hora y por tenant |
| `BASEDB_AI_WORKER` | `1` | `0`: sin cálculos en segundo plano en este proceso |

## Solo para desarrollo

| Variable | Función |
|---|---|
| `BASEDB_DEV_MAIL=1` | muestra los correos electrónicos en los registros en lugar de enviarlos |
| `BASEDB_WEBHOOK_DEV=1` | permite webhooks hacia HTTP y las direcciones locales |

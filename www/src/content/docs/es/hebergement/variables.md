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
| `BASEDB_BASE_PATH` | la ruta de `BASEDB_PUBLIC_URL` | la ruta bajo la que se sirve basedb detrás de una pasarela, `/basedb` para `https://passerelle.example.com/basedb/`; consulta [Docker Compose](/basedb/es/hebergement/docker/#detrás-de-una-pasarela-bajo-una-ruta) |
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

## Correos electrónicos

Sin servidor de envío, basedb no envía ningún correo electrónico. Con él se envían las
notificaciones que llevan diez minutos sin leerse (cada persona elige cuáles en
**Configuración › Notificaciones**), los correos del paso **Enviar un correo electrónico** de las
automatizaciones, y el enlace de una **contraseña olvidada**. Los enlaces apuntan a
`BASEDB_PUBLIC_URL`; sin ella, un correo no lleva ninguno.

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | el servidor SMTP: el de tu correo o el de un servicio de envío |
| `BASEDB_SMTP_PORT` | `587` | `465` para una conexión cifrada desde el principio |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` en el puerto 465) | `none` solo para un relé en la misma máquina: de lo contrario la contraseña iría en claro |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | el identificador de la cuenta de envío, si lo pide |
| `BASEDB_MAIL_FROM` | — | obligatoria con `BASEDB_SMTP_HOST`: el remitente, `basedb <no-reply@exemple.fr>` |

Al arrancar, el registro dice cómo está configurado: `Courriels : SMTP smtp.exemple.fr:587
(starttls), expéditeur no-reply@exemple.fr.` Un correo que el servidor rechaza se reintenta 1, 5,
30, 120 y luego 360 minutos después.

## Mapas y direcciones

La vista **Mapa** sitúa una dirección gracias a un servicio de geocodificación: el de
OpenStreetMap (Nominatim) de forma predeterminada, consultado una vez por dirección, una
solicitud por segundo como máximo, cada respuesta conservada. El fondo del mapa está hecho de
**teselas** que el navegador de cada lector carga directamente.

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | otro servicio que hable el mismo protocolo (un Nominatim propio); `off`: ninguno, las direcciones no salen de la instancia y solo la latitud y la longitud sitúan las filas |
| `BASEDB_MAP_TILES` | las teselas de OpenStreetMap | otro servidor de teselas, con el modelo `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | la mención que exige este servidor, abajo a la derecha del mapa |

Al arrancar, el registro dice qué servicio se está usando: `Géocodage : https://nominatim.openstreetmap.org.`

## Documentos PDF

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_PDF_FONTS` | las fuentes Noto de la imagen | una carpeta propia, montada en el contenedor, que contiene `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, y para el chino, el japonés y el coreano, `NotoSansCJK-Regular.ttc` y `-Bold.ttc` |

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

## Webhooks hacia la red interna

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | — | tus servidores internos, separados por comas: un nombre (`chat.intra.example.com`), un dominio y sus subdominios (`*.intra.example.com`), una dirección o un rango (`10.12.0.0/16`) |

Los webhooks, las solicitudes HTTP de las automatizaciones y las tablas sincronizadas solo se
envían a direcciones públicas en HTTPS. Además se acepta un destino de la lista, sea cual sea su
dirección, su puerto y su esquema —HTTP incluido—. Una entrada ilegible impide el arranque.
Consulta [Webhooks](/basedb/es/integrations/webhooks/#destinos).

## Demo pública

Una instancia abierta a todos, como [demo.basedb.eodia.com](https://demo.basedb.eodia.com):
la pantalla de inicio de sesión rellena una cuenta compartida, el visitante lee todo y modifica lo
que ya existe, pero no crea ni elimina nada —base, tabla, fila, archivo, comentario, cuenta,
token, enlace—, y la IA responde que no forma parte de la demo. La consola SQL solo lee ahí.
Devolver la base a su estado cada noche sigue siendo responsabilidad tuya.

| Variable | Predeterminado | Función |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: la instancia se convierte en una demo pública |
| `BASEDB_DEMO_ACCOUNTS` | — | una cuenta por idioma, separadas por comas: `fr=demo@demo.com,en=demo-en@demo.com`; la pantalla de inicio de sesión rellena la de su idioma, si no, la inglesa, si no, la primera, y ofrece las demás. Crea estas cuentas, cada una con su proyecto, antes de activar la demo: rechaza las creaciones a todos, administrador incluido |
| `BASEDB_DEMO_PASSWORD` | — | con `BASEDB_DEMO_ACCOUNTS`, su contraseña, la misma para todas, publicada junto a ellas |

Sin `BASEDB_DEMO_ACCOUNTS`, la cuenta compartida es el administrador que nombran
`BASEDB_ADMIN_EMAIL` y `BASEDB_ADMIN_PASSWORD`. Una dirección de la demo inicia sesión con la
contraseña publicada, se escriba lo que se escriba: los intentos fallidos no la bloquean para
todo el mundo.

## Solo para desarrollo

| Variable | Función |
|---|---|
| `BASEDB_DEV_MAIL=1` | muestra los correos electrónicos en los registros en lugar de enviarlos |
| `BASEDB_WEBHOOK_DEV=1` | permite webhooks hacia HTTP y las direcciones locales |

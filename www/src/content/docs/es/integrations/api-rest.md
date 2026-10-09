---
title: API REST
description: Leer y escribir las filas de basedb desde un programa.
---

La API REST es la misma que usa la interfaz: **no existe ninguna ruta privada**.
Sus URL llevan los nombres físicos, los mismos que lees en SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Un token

En la interfaz, menú **⋯** de la base → **API y agentes** → **Tokens de API y MCP…**: quien tiene
el nivel **Gestión** sobre la base, o sobre su proyecto, crea ahí un **token de integración**
limitado a esa base —todos sus entornos, o uno solo—, de solo lectura de forma predeterminada, tras
confirmar su contraseña — una cuenta sin contraseña, que inicia sesión mediante un proveedor de
identidad, todavía no puede hacerlo. Solo se muestra una vez; guárdalo en una variable de entorno.

Un token lee; crea y modifica si se ha creado con permiso de escritura, y **elimina si se ha creado
para ello** — permisos «Lectura, escritura y eliminación», salvo una fila que una relación en
cascada arrastraría junto con otras. Nunca tiene más permisos que la persona que lo creó.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Elegir el entorno

Una base que tiene varios [entornos](/basedb/es/fonctionnalites/environnements/) — producción,
preproducción… — sigue siendo **una** base para un token creado para toda la base. La ruta nombra la
base por el nombre de su producción, y la cabecera `X-Basedb-Environment` elige el entorno:

```bash
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  -H "X-Basedb-Environment: recette"
```

- Sin la cabecera, es el entorno que nombra la ruta: `b_t4z56fq_ventes` es la producción,
  `b_t4z56fq_ventes_recette` la preproducción — las dos formas de escribirlo siguen siendo válidas.
- `?environment=recette` hace lo mismo para un cliente que no envía cabecera.
- Un entorno se nombra por su insignia, sin distinguir mayúsculas ni acentos, o por
  `production`. Un entorno que la base no tiene responde `404`, como cualquier recurso ausente.
- `GET /api/v1/<tenant>/meta/bases` lista cada entorno con su bloque `environment`
  (`label`, `production`); con la cabecera, solo lista ese.

Un token limitado a un solo entorno al crearlo no abre ningún otro: la cabecera no cambia nada. Sus
permisos siempre se cruzan, entorno por entorno, con los de la persona que lo creó.

## Leer

| Parámetro | Función |
|---|---|
| `filter` | una expresión legible: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | las columnas que devolver |
| `limit`, `after` | paginación por cursor cifrado: `meta.next_cursor` de una página, pasado como `after`, da la siguiente (`meta.has_next_page`) |
| `links=display` | las relaciones con el valor de su campo principal |
| `count=exact` | el total, con un tope de 100 000 |
| `variables=raw` | los textos largos tal como se escribieron, `{{colonne}}` incluido, en lugar de con los [valores de la fila](/basedb/es/fonctionnalites/tables-et-champs/#texto-enriquecido-y-variables) |

Los operadores: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, combinados con `and`, `or`, `not` y paréntesis. Un
filtro atraviesa una relación: `clients_id.ville eq "Lyon"`.

## Escribir

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` modifica una fila con el mismo cuerpo `{"values": {…}}`. Los
errores tienen una forma única: `{ "code": "…", "details": {…}, "request_id": "…" }`, con un
código estable por causa.

Cada escritura devuelve la cabecera `x-basedb-transaction`: pasarla a
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`) la deshace, como Ctrl+Z en
la interfaz; se rechaza si la fila se ha modificado desde entonces.

## Más allá de las filas

Con el mismo token:

| Ruta | Función |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | resúmenes sobre todas las filas de un filtro: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | leer y escribir los comentarios de una fila |
| `POST /api/v1/<tenant>/automations/<id>/run` | lanzar una automatización desencadenada por un botón, sobre una fila (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | los paneles de una base |
| `GET /api/v1/<tenant>/meta/users` | los miembros del espacio de trabajo, para un campo Persona |
| `GET /api/v1/<tenant>/meta/templates` | las plantillas de base de la galería |
| `GET /api/v1/<tenant>/events?base=<base>&table=<table>` | seguir una tabla en tiempo real: señales, que luego se vuelven a leer con las rutas anteriores (consulta [Webhooks](/basedb/es/integrations/webhooks/#sin-webhook-seguir-una-tabla)) |

Las [vistas compartidas](/basedb/es/fonctionnalites/vues-partagees/) se leen sin cuenta:
`GET /api/v1/views/<jeton>` y `…/rows` en JSON, `…/calendar.ics` en iCalendar.

Construir (crear una automatización, un panel, una integración) sigue reservado a
una sesión de la interfaz: un token lee y escribe filas, no cambia la base.

## Colores e iconos

Una tabla y cada opción de una selección única tienen un color (`color`, `#rrggbb`) y un icono
(`icon`, el nombre de un icono de [Lucide](https://lucide.dev/icons/) que dibuja la interfaz:
`truck`, `circle-check`, `flame`…). `GET …/meta/bases/<base>` los devuelve para la base, sus tablas y
las opciones de sus campos.

Para elegirlos, con el token de acceso de una persona que puede modificar la estructura
(`POST /auth/session/access`) — un token de integración no cambia la base:

| Ruta | Cuerpo |
|---|---|
| `POST …/admin/bases/<base>/tables` | `{"label": "Tickets", "color": "#dc2626", "icon": "flame", "fields": […]}` |
| `PATCH …/admin/bases/<base>/tables/<table>` | `{"color": "#2563eb", "icon": "inbox"}` — las tres claves `color`, `icon`, `image` viajan juntas: nombrar una sustituye las tres |
| `POST …/admin/bases/<base>/tables/<table>/fields` | `{"label": "Priorité", "kind": "select", "options": [{"value": "haute", "color": "#dc2626", "icon": "flame"}, …]}` |
| `PUT …/admin/bases/<base>/tables/<table>/fields/<champ>/options` | la lista completa de opciones, en orden, cada una con su color y su icono |

Un agente pasa por el [servidor MCP](/basedb/es/integrations/mcp/#colores-e-iconos), donde
**propone** estos cambios. Un campo no tiene un icono que elegir: la interfaz dibuja el de su tipo.

## Crear una base a partir de una plantilla

Una aplicación que se instala crea su base en **una sola llamada**: el servidor aplica la
plantilla —tablas, campos, relaciones, filas de ejemplo, vistas, paneles, automatizaciones— y,
si un paso falla, no deja ninguna base sin terminar.

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/admin/bases" \
  -H "Authorization: Bearer $ACCES" -H "content-type: application/json" \
  -d '{"template": "crm", "label": "Ventes", "rows": false}'
```

`template` es la clave de una plantilla de la galería, o una plantilla completa en el
[formato de las plantillas](/basedb/es/fonctionnalites/modeles/). Con la cabecera
`Accept: application/x-ndjson`, la respuesta llega línea a línea: una línea `{"step": …}` por
paso, y luego la base creada. Esta llamada requiere el token de acceso de una persona que pueda
crear una base (`POST /auth/session/access`, tras iniciar sesión): un token de integración solo
abre una base existente.

## Verificar un token

Los tokens de basedb no se pueden verificar fuera de basedb. Una aplicación que recibe uno —una
herramienta abierta desde basedb con el token de la persona, por ejemplo— pregunta qué vale
(introspección, RFC 7662), con su propio token de integración:

```bash
curl -X POST "http://localhost:3000/auth/introspect" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  --data-urlencode "token=$JETON_RECU"
```

```json
{ "active": true, "token_type": "access_token",
  "sub": "0195a…", "email": "claire@example.com", "name": "Claire Martin",
  "tenant": "t4z56fq", "groups": ["Commerciaux"], "exp": 1790000000 }
```

Cualquier token que no sea válido —desconocido, caducado, revocado, sesión cerrada, otro espacio
de trabajo— responde `{"active": false}`, sin decir por qué. La respuesta se lee en vivo: una
desconexión se nota al instante. Para un token de integración, la respuesta también indica la
base que abre (`base`, su producción), si abre todos sus entornos (`environments`: `all`) o uno solo
(`one`), su acceso (`read`, `write` o `delete`) y sus superficies.

## La documentación generada

Cada base tiene su página **Documentación de API y MCP**: para cada tabla, sus endpoints, sus
columnas, ejemplos en cURL y en JavaScript. Está **filtrada por tus permisos** —dos
lectores obtienen dos versiones—, escrita **en el idioma de tu pantalla**, y existe también en
OpenAPI 3.1 (`/api/v1/<tenant>/meta/bases/<base>/openapi.json`), que declara el token Bearer y
la cabecera `X-Basedb-Environment`. Los nombres, las rutas y los códigos de error son los mismos en
todos los idiomas.

![La documentación generada de una base](../../../../assets/screens/es/documentation-api.webp)

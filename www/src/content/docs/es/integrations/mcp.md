---
title: Servidor MCP
description: Conectar un agente de IA a basedb mediante el Model Context Protocol.
---

basedb expone un **servidor MCP** (`POST /mcp`, en la misma dirección que la interfaz): un agente (Claude, un
asistente de código, tu propio agente) descubre en él las bases, lee y escribe filas, las
elimina si tú lo permites, y **propone** cambios de estructura.

## Conectar un agente

Crea un token desde **Tokens de API y MCP…** (menú de la base, en **API y agentes**), con el acceso MCP marcado. El mismo token
sirve para la API REST y para el MCP, y abre **toda la base**: su producción y sus demás entornos
(ver más abajo).

Pon el token en una variable de entorno, `BASEDB_TOKEN`, nunca en un archivo de configuración.
Un cliente que habla MCP por HTTP — Claude Code, entre otros — apunta directamente a `…/mcp` con la
cabecera `Authorization: Bearer <jeton>`. Con Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

El comando escribe el archivo `.mcp.json` del proyecto, donde `${BASEDB_TOKEN}` sigue siendo una
referencia a la variable: el token en sí no figura en él.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Un cliente que solo sabe lanzar programas locales (stdio) pasa por el relé del repositorio, que lee
el token de la variable que nombra `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Pide después al agente que llame a `whoami`: dice quién creó el token, qué base abre, sus
entornos y sus permisos.

## Elegir el entorno

Una base puede tener varios [entornos](/basedb/es/fonctionnalites/environnements/) — producción,
preproducción, desarrollo —, cada uno con sus tablas y sus filas. Un token de toda la base los abre
todos, y el entorno se elige, de lo más amplio a lo más preciso:

- **el nombre de la base**, sin nada más: `crm` es la producción, `crm_recette` la preproducción;
- **la dirección del servidor**: `…/mcp?environment=recette` apunta a la preproducción para toda la
  conexión. El relé hace lo mismo con `--environment recette`. Así se declara un servidor por
  entorno, todos con el mismo token:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **el argumento `environment`** de cada herramienta que nombra una base, para una sola llamada:
  `list_records` con `{"base": "crm", "table": "clients", "environment": "recette"}`.

Un entorno se nombra por su insignia, sin distinguir mayúsculas ni acentos
(`Recette`, `recette`, `developpement` para «Développement»), o por `production`. `whoami` lista los
que abre el token; `list_bases` y `describe_base` indican a qué entorno corresponde cada base.

Un token también puede limitarse a un solo entorno al crearlo: entonces no ve ningún otro.

## Las quince herramientas

| Herramienta | Función |
|---|---|
| `whoami` | quién es el agente, con qué permisos, en qué entornos |
| `list_bases`, `describe_base`, `describe_table` | descubrir la estructura, sus descripciones y su apariencia |
| `list_records`, `get_record`, `lookup_records` | leer, filtrar, resolver un valor del campo principal |
| `create_record`, `update_record` | escribir filas |
| `delete_record`, `restore_record` | eliminar una fila — con un token creado para ello — y restaurarla |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proponer un cambio de estructura |
| `propose_update_look` | proponer el color y el icono de una tabla y de sus opciones |

## Colores e iconos

Una tabla, y cada opción de una selección única, tienen un color y un icono, como en la
interfaz. El agente los elige al proponer:

- `propose_create_table` acepta `color` e `icon` para la tabla;
- `propose_add_field` acepta `color` e `icon` en cada opción de un `select` o de un `multi_select`;
- `propose_update_look` cambia los de una tabla existente y de sus opciones: una clave omitida
  conserva lo que hay, `null` lo borra.

`color` es un color `#rrggbb`. `icon` es el nombre de un icono de [Lucide](https://lucide.dev/icons/)
de los que dibuja la interfaz — `truck`, `circle-check`, `flame`…: el esquema de la herramienta los
enumera, y un nombre desconocido se rechaza. `describe_base` y `describe_table` devuelven la
apariencia actual. Un campo, en cambio, no tiene un icono que elegir: la interfaz dibuja el de su
tipo.

## Eliminar filas

Un token creado con los permisos **Lectura, escritura y eliminación** permite al agente eliminar
filas, **una a la vez**, por su `_id`. `delete_record` devuelve la fila tal como estaba, y la
eliminación queda registrada en el historial a nombre del token; `restore_record` restaura la
fila bajo su `_id` — el agente deshace así su propio error, y una persona también puede hacerlo
desde el historial.

El agente no elimina:

- con un token de lectura, o de lectura y escritura: el rechazo indica qué token crear;
- una fila que una relación en cascada arrastraría junto con otras (`TOKEN_CASCADE_FORBIDDEN`):
  esa eliminación se hace en la interfaz, por una persona que ve qué arrastra consigo;
- varias filas a la vez: ninguna herramienta lo hace.

## Lo que un agente no hace

- **Solo elimina con tu permiso**: un token creado para ello, una fila a la vez.
- **No cambia la estructura** — ni su apariencia: la propone. La propuesta espera en **Propuestas
  de los agentes…** (menú de la base), donde una persona que gestiona la estructura la aprueba o la rechaza;
  sin decisión, caduca a las 24 horas.
- **Nunca tiene más permisos** que la persona que creó su token: los permisos del token se
  intersecan con los suyos, entorno por entorno.
- No ve los campos marcados como invisibles para los agentes, ni las bases cerradas al MCP.

Cada llamada se registra por la forma de sus parámetros, nunca por sus valores.

---
title: Servidor MCP
description: Conectar un agente de IA a basedb mediante el Model Context Protocol.
---

basedb expone un **servidor MCP** (`POST /mcp`, en la misma dirección que la interfaz): un agente (Claude, un
asistente de código, tu propio agente) descubre en él las bases, lee y escribe filas, las
elimina si tú lo permites, y **propone** cambios de estructura.

## Conectar un agente

Crea un token desde **Tokens de API y MCP…** (menú de la base, en **API y agentes**), con el acceso MCP marcado. El mismo token
sirve para la API REST y para el MCP.

Para un cliente que habla HTTP, la dirección es `http://localhost:3000/mcp` con
`Authorization: Bearer <jeton>`. Para un cliente que lanza procesos (stdio), el repositorio incluye
un relé que lee el token de una variable de entorno, nunca de la configuración:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Las catorce herramientas

| Herramienta | Función |
|---|---|
| `whoami` | quién es el agente y con qué permisos |
| `list_bases`, `describe_base`, `describe_table` | descubrir la estructura y sus descripciones |
| `list_records`, `get_record`, `lookup_records` | leer, filtrar, resolver un valor del campo principal |
| `create_record`, `update_record` | escribir filas |
| `delete_record`, `restore_record` | eliminar una fila — con un token creado para ello — y restaurarla |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proponer un cambio de estructura |

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
- **No cambia la estructura**: la propone. La propuesta espera en **Propuestas
  de los agentes…** (menú de la base), donde una persona que gestiona la estructura la aprueba o la rechaza;
  sin decisión, caduca a las 24 horas.
- **Nunca tiene más permisos** que la persona que creó su token: los permisos del token se
  intersecan con los suyos.
- No ve los campos marcados como invisibles para los agentes, ni las bases cerradas al MCP.

Cada llamada se registra por la forma de sus parámetros, nunca por sus valores.

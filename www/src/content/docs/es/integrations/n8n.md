---
title: n8n
description: Leer y escribir las filas de basedb desde un workflow de n8n, y lanzar uno cada vez que se crea, modifica o elimina una fila.
---

El paquete **n8n-nodes-basedb** añade tres nodos a n8n:

| Nodo | Función |
|---|---|
| **basedb** | leer y escribir las filas de una tabla, comentar una fila; se puede usar como herramienta por un agente de IA de n8n |
| **basedb Trigger** | lanzar un workflow por cada fila creada —o creada o modificada— desde la última consulta |
| **basedb Webhook Trigger** | lanzar un workflow en el instante en que se crea, modifica o elimina una fila |

## Instalar

En n8n: **Settings › Community Nodes › Install**, y después `n8n-nodes-basedb`.

Sin la interfaz —modo de cola, imagen Docker ya montada—: `npm install
n8n-nodes-basedb` en la carpeta `~/.n8n/nodes`, y después reinicia n8n.

## Las credenciales

Crea en n8n una credencial **basedb API**:

| Campo | Valor |
|---|---|
| **Instance URL** | la dirección donde abres basedb: `https://basedb.exemple.fr` |
| **Workspace** | la referencia del espacio, la de las direcciones de la API (`/api/v1/<espacio>/…`): `t4z56fq`, salvo que la instancia fije `BASEDB_TENANT` |
| **Token** | un **token de integración**: menú **⋯** de la base → **API y agentes** → **Tokens de API y MCP…** |
| **Environment** | opcional: el entorno de la base en el que trabajar — `recette`, `production`… Vacío: la producción |

Un token abre **una** base — todos sus entornos, o uno solo si se limitó al crearlo. Lee sus
filas, las escribe si se ha creado con permiso de escritura, y nunca tiene más permisos que la persona
que lo creó. Al guardarlo, n8n prueba la conexión y dice si el token se rechaza.

Para trabajar en la producción y en la preproducción, crea dos credenciales con el mismo token, una
con **Environment** vacío y otra con `recette`. Si no se elige ningún entorno, la lista de bases del
nodo muestra cada entorno, con su nombre entre paréntesis.

## Leer y escribir: el nodo basedb

| Operación | Lo que hace |
|---|---|
| **Row › Create** | añade una fila |
| **Row › Create or Update** | modifica la fila cuyos campos elegidos tienen esos valores, o la añade si ninguna los tiene |
| **Row › Get** | lee una fila por su `_id` |
| **Row › Get Many** | lee las filas de un filtro, en el orden pedido, hasta un límite o todas, página a página |
| **Row › Update** | modifica una fila, encontrada por su `_id` o por otros campos |
| **Comment › Create** | comenta una fila; una @mención avisa a la persona |

La **base** y la **tabla** se eligen en listas, las que abre el token. Los campos que se pueden
escribir se muestran con su nombre en basedb, una selección única con sus opciones, un campo
Persona con los miembros del espacio; un campo calculado —fórmula, búsqueda, acumulado, número
automático— no aparece ahí, porque basedb lo escribe él mismo. Un valor que el campo rechaza
detiene el nodo con el código de basedb y lo que significa.

- El **filtro** y la **ordenación** usan los nombres técnicos de los campos, los del SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. La gramática es la de la
  [API REST](/basedb/es/integrations/api-rest/#leer).
- Los **números** llegan en texto decimal (`"1250.50"`), para no perder ninguna cifra; la
  opción **Numbers as Numbers** los convierte en números.
- Una **relación** se lee `{ "id": …, "display": … }` y se escribe con el `_id` de la fila
  vinculada.
- **Create or Update** nunca modifica varias filas: si varias tienen esos valores, el nodo se
  detiene en lugar de adivinar.
- Sin operación **Delete**: para retirar filas, márcalas (un estado «Archivado»), confía la
  eliminación a una [automatización](/basedb/es/fonctionnalites/automatisations/), o llama a la
  [API REST](/basedb/es/integrations/api-rest/) con un token creado para eliminar.

## Lanzar un workflow

### En cada consulta: basedb Trigger

El nodo pregunta a basedb, al ritmo elegido (cada minuto, cada hora…), las filas **creadas**
—o **creadas o modificadas**— desde la última vez, con un filtro adicional si se quiere.
Funciona en cualquier parte, incluso cuando basedb no puede contactar con n8n. En su primera
consulta, anota en qué punto está la tabla y no emite nada; una prueba desde el editor devuelve
la última fila, para tener algo con lo que conectar los siguientes nodos.

### Al instante: basedb Webhook Trigger

Cada fila creada, modificada o eliminada —incluso mediante SQL escrito directamente en
PostgreSQL— lanza el workflow al instante:

1. Añade el nodo y copia su **Production URL**.
2. En basedb, menú **⋯** de la base → **API y agentes** → **Webhooks…**: crea un webhook hacia
   esta dirección, elige sus tablas y sus eventos.
3. basedb muestra una vez el **secreto de firma**: colócalo en una credencial **basedb Webhook**
   de n8n.
4. Activa el workflow.

Cada evento se convierte en un elemento: su `type` (`record.created`, `record.updated`,
`record.deleted`), la tabla, la fila **antes** y **después**, y los campos cambiados
(`changed`). El nodo comprueba la **firma** de cada entrega y responde `401` a la que no tiene
ninguna, a la que tiene una falsa, o a la que tiene más de cinco minutos. basedb entrega **al
menos una vez**: elimina duplicados por el `id` del evento si el workflow no debe procesarlo dos
veces.

:::note
basedb solo envía un webhook a una dirección **HTTPS pública**: un n8n en una red privada usa
más bien **basedb Trigger**. Consulta [Webhooks](/basedb/es/integrations/webhooks/).
:::

## Sin el nodo

El nodo **HTTP Request** de n8n también habla con basedb: cabecera `Authorization: Bearer
<token>`, JSON de ida y vuelta, paginación mediante `meta.next_cursor` pasado como `after`
(`{{ $response.body.meta.next_cursor }}`), y reanudación tras un fallo mediante un filtro sobre
`_updated_at` y mediante `…/<table>/deleted?since=`.

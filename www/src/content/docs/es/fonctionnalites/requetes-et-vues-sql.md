---
title: Consultas y vistas SQL
description: SQL para cada uno, con sus propios permisos; consultas guardadas bajo las tablas, personales o compartidas; vistas PostgreSQL reales colocadas entre las tablas.
---

Tus tablas son tablas PostgreSQL reales, y la interfaz las consulta en SQL, con su nombre
real. Cada miembro de la base puede escribir una consulta y **guardarla** bajo las tablas (solo para
sí, para toda la base o para algunos grupos), y quien gestiona la base puede convertirla en una
**vista SQL**: una vista PostgreSQL real, colocada entre las tablas, que `psql` y tus herramientas
también leen.

![Una consulta guardada, abierta desde la sección «Consultas»; encima, dos vistas SQL colocadas entre las tablas](../../../../assets/screens/requete-sql.png)

## Cada uno con sus permisos

El **+** de la barra de pestañas, o el menú **⋯** de la base → **Nueva consulta SQL**, abre una
pestaña SQL: un editor con resaltado y autocompletado, **Ctrl+Intro** para ejecutar y el
resultado en la misma cuadrícula que tus tablas. Lo que la consulta puede leer depende de quién la lanza:

- con el nivel **Gestión** sobre la base, toda la base, escrituras incluidas;
- con los niveles **Lectura** o **Edición**, la consulta se ejecuta **en solo lectura, con tus
  propios permisos**. Una tabla que tienes cerrada no existe para ella; un campo que tienes
  oculto desaparece de `SELECT *` y se rechaza si lo nombras, incluso calificando la tabla;
  una escritura se rechaza. El resultado lleva la insignia **Tus permisos**.

![La insignia «Tus permisos»: la consulta solo ve las tablas y los campos abiertos a la persona](../../../../assets/screens/sql-vos-droits.png)

No es la pantalla la que filtra: el propio PostgreSQL aplica tus permisos, columna por columna, sobre
un rol que es solo tuyo. Por tanto, una consulta no puede mostrarte nada que la cuadrícula, la API o el
servidor MCP no te mostrarían.

## Guardar una consulta

**Guardar**, en la barra de la pestaña, coloca la consulta bajo las tablas de la base, en la
sección **Consultas**. Se vuelve a abrir con un clic; **⋯** → **Guardar como…** crea una
copia, y **Nombre y uso compartido…** (en la pestaña o en su menú de la barra lateral) le cambia el nombre,
cambia quién la ve o la elimina.

![Guardar una consulta: su nombre, lo que muestra y quién la ve](../../../../assets/screens/requete-enregistrer.png)

| Alcance | Quién la ve | Quién puede crearla y modificarla |
|---|---|---|
| **Personal**, con un candado | solo tú | cualquiera que vea la base, para sí |
| **Toda la base** | cualquiera que vea la base | el nivel **Gestión** sobre la base |
| **Algunos grupos** | los miembros de los grupos elegidos | el nivel **Gestión** sobre la base |

**Compartir una consulta comparte su texto, nunca lo que su autor puede leer.** Cada uno la ejecuta
con sus propios permisos: la misma consulta, abierta por dos personas, muestra a cada una lo que
tiene derecho a ver, o le dice que una columna no existe para ella.

Una consulta abierta desde la barra lateral **se ejecuta al instante, en solo lectura**: ves
su resultado sin haber decidido nada. **Ejecutar** la vuelve a lanzar después tal como está. Un punto
junto a su nombre indica que has cambiado su texto desde que se guardó; **Guardar**
guarda el cambio en ella si puedes modificarla y, si no, propone crear una nueva.

## Las vistas SQL

Una **vista SQL** es una vista PostgreSQL real del esquema de la base. Ocupa su lugar **entre las
tablas**, con su color y su icono como una tabla, y un pequeño **ojo** a la derecha que indica
que es una vista. Un clic la abre en una pestaña: sus filas en la cuadrícula, y **Actualizar** para
volver a leerlas.

![La vista «Factures à encaisser», abierta desde la barra lateral](../../../../assets/screens/vue-sql.png)

Se crea desde el menú **⋯** de la base → **Nueva vista SQL…**, o desde una pestaña SQL:
**⋯** → **Crear una vista SQL…**, y la consulta de la pestaña se convierte en su definición. El diálogo
pide:

- su **etiqueta** y su **apariencia**: color, icono o imagen, elegidos como para una
  tabla;
- su **nombre técnico**, derivado de la etiqueta si no das ninguno: el que se escribe después de
  `FROM`;
- su **consulta**: un solo `SELECT`, sobre las tablas y las demás vistas de la base. PostgreSQL
  rechaza lo que no admite, y el editor señala el lugar.

![El diálogo de una vista SQL: etiqueta y apariencia, nombre técnico, consulta, descripción](../../../../assets/screens/vue-sql-dialogue.png)

Después, la vista se lee con su nombre, tanto desde la interfaz como desde `psql` o tu herramienta de BI:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Una vista nunca muestra un campo que no puedes ver.** Cada uno la lee con sus propios permisos,
sobre cada tabla y cada columna que lee; la barra lateral solo la muestra a quien puede leer todo
lo que ella lee. Solo lee **su** base: otra base, o el catálogo de basedb,
se rechazan desde la creación. Crearla, modificarla o eliminarla requiere el nivel **Gestión**
sobre la base.

### Cuando cambia la estructura

- **Cambiar el nombre** de una tabla o de un campo no rompe una vista: PostgreSQL la sigue.
- **Cambiar la fórmula** de un campo calculado que lee la retira un instante y luego la vuelve a crear sobre la
  nueva columna. Si ya no se sostiene, queda **pendiente de corregir** (un triángulo lo indica en
  la barra lateral) con su definición guardada: **Editar la vista…**, corrige, guarda.
- Una tabla no se purga mientras una vista la lea, y una vista no se elimina mientras
  otra vista la lea: el rechazo nombra la vista en cuestión.

## ¿Consulta, vista SQL o pregunta?

| | Qué es | Dónde vive | Para qué |
|---|---|---|---|
| **Consulta guardada** | un texto SQL | bajo las tablas, sección «Consultas» | recuperar una consulta, compartirla como texto |
| **Vista SQL** | una vista PostgreSQL real | entre las tablas | dar nombre a una lectura, para la interfaz **y** para `psql`, tus scripts, tus herramientas |
| **Pregunta** | una lectura construida con el ratón o en SQL, y su visualización | en los [paneles](/basedb/es/fonctionnalites/tableaux-de-bord/) | una cifra, un gráfico, una tabla dinámica, con filtros |

## Límites

- La cuadrícula muestra como máximo el número de **filas por página** elegido en la parte inferior de la pantalla; «truncado»
  lo indica. Una consulta se detiene a los 15 segundos.
- Una vista SQL se lee en SQL y en la interfaz; la API REST y el servidor MCP no la exponen.
- Una vista SQL se queda en el entorno donde se creó: crear un entorno, comparar
  la estructura o guardar una plantilla todavía no la incluyen.

---
title: Paneles
description: Preguntas hechas con el ratón o en SQL, quince formas de mostrarlas y ajustarlas, paneles en cuadrícula, en pestañas y con filtros comunes, leídos con los permisos de cada uno y compartidos mediante un enlace.
---

Un **panel** reúne en una página lo que un equipo mira todos los días: las
cifras que importan, su evolución mes a mes, el reparto de un estado, los
próximos vencimientos. Cada tarjeta muestra una **pregunta** (una lectura de la base,
construida con el ratón o escrita en SQL) y unos **filtros** en la parte superior de la página controlan las
tarjetas vinculadas a ellos.

![El panel «Pilotage de l’agence»: tendencia del mes, objetivo, facturación apilada, sentimiento de las reseñas](../../../../assets/screens/tableaux-de-bord.png)

Todo se abre desde **Paneles**, en el bloque de la base abierta en la parte inferior de la barra
lateral. A la izquierda, los paneles y las preguntas guardadas de la base, y
**Explorar los datos** para hacer una pregunta sin guardar nada. Cualquier lector de la base
puede consultarlos y explorar; crear, modificar y guardar requieren el nivel **Gestión**.

## Hacer una pregunta con el ratón

Una pregunta se construye por etapas, una debajo de otra:

![El editor de una pregunta: los datos, los filtros, el resumen por mes](../../../../assets/screens/question-editeur.png)

| Etapa | Lo que se elige |
|---|---|
| **Datos** | la tabla de partida, y las columnas que se muestran cuando no se resume nada |
| **Combinar datos** | otra tabla de la base, vinculada por una relación (que se propone automáticamente) o por dos columnas de la misma naturaleza; combinación izquierda, interna, derecha o completa |
| **Filtro** | por columna, con lo que ofrece su tipo: es / no es, contiene, entre, vacío…; para una fecha, un **periodo**: hoy, los últimos 30 días, este mes, el trimestre pasado, del … al …; o una expresión escrita como en la barra de las vistas |
| **Resumir** | medidas (número de filas, suma, media, mediana, mínimo, máximo, valores distintos, desviación típica, acumulados) **por** una a tres columnas |
| **Ordenar**, **Limitar** | el orden de las filas, y cuántas como máximo |

Una fecha se agrupa **por día, semana, mes, trimestre o año**, o por posición: día de la
semana, mes del año, hora del día; un número, por tramos. Una selección múltiple
cuenta cada fila en cada una de sus opciones. Los periodos se leen en tu zona horaria y la
semana empieza el día indicado en tu configuración.

**Visualizar** lanza la pregunta. El resultado se muestra de la forma que mejor le conviene (una
cifra, una línea, barras, una tabla) y se cambia en la parte inferior de la pantalla:

| Visualización | Para mostrar |
|---|---|
| **Cifra**, **Tendencia**, **Progreso**, **Medidor** | un valor; el último periodo frente al anterior y frente al mismo del año pasado; el avance hacia un objetivo |
| **Histograma**, **Barras**, **Líneas**, **Áreas**, **Combinado** | medidas a lo largo de una dimensión, en series lado a lado, apiladas o al 100 % |
| **Sectores**, **Embudo** | partes, etapas |
| **Dispersión** | dos medidas una frente a otra, una tercera como tamaño |
| **Tabla**, **Tabla dinámica** | las filas, ordenables; las filas por una dimensión, las columnas por otra, con sus totales |
| **Mapa** | las regiones o departamentos de Francia, o los países, coloreados según un valor; o puntos por latitud y longitud |

**Ajustes** configura lo que se muestra, y el resultado se descarga en **CSV**.

### Personalizar un gráfico

| Visualización | Lo que ofrece **Ajustes** |
|---|---|
| **Barras, líneas, áreas, combinado** | el color y el nombre de cada serie; el apilamiento, con el total encima de las pilas; el ancho de las barras; líneas suavizadas o escalonadas, con o sin puntos; el orden de las categorías; los títulos de los ejes, las marcas, la inclinación de las etiquetas, los límites, una escala logarítmica; los valores sobre el gráfico; un objetivo |
| **Sectores** | un anillo y su grosor, un semicírculo, una rosa; el total en el centro; el número de partes antes de «Otros»; el color y el nombre de cada parte; las etiquetas sobre las partes o al lado; la posición de la leyenda |
| **Embudo** | el color y el nombre de cada etapa, su orden |
| **Cifra, tendencia, progreso, medidor** | el color, colores según el valor, un pie bajo la cifra, la comparación, y si una bajada es una buena noticia |
| **Tabla, tabla dinámica** | cambiar el nombre de las columnas y reordenarlas, barras en las celdas, colores según el valor (por celda o por fila), la densidad, las filas por página, los números de fila, los totales |
| **Mapa** | el tono, los nombres de las regiones |

Para todos, el formato de los números: decimales, prefijo y sufijo, abreviado como `1,2 k`.

## Explorar con un clic

Un clic en una barra, un punto o una parte abre lo que representa:

- **Ver estas filas**: las filas que hay detrás del punto, filtradas por lo que representa;
- **Detallar por semana**: un periodo desglosado en otro más fino, como un año en sus
  trimestres o un mes en sus semanas;
- **Desglosar por…**: la misma medida, para ese punto, por otra columna;
- **Solo este valor**, **Excluir este valor**.

Cada paso es una pregunta aparte, que se puede guardar si se quiere; la flecha de volver regresa
al paso anterior. Una fila de una tabla abre sus detalles.

En un panel, el mismo clic ofrece también **Filtrar el panel: «Lyon»**, con el
número de tarjetas afectadas: un filtro **temporal**, que nunca se guarda, que se muestra con línea discontinua
en la barra de filtros, se quita con un clic y se aplica a cada tarjeta cuya pregunta
lee la misma columna, por su tabla o por una combinación. Solo se ofrece si ningún filtro del
panel está ya vinculado a esa columna en la tarjeta, y permanece atenuado («única tarjeta») cuando
ninguna otra tarjeta la lee. Las preguntas SQL no lo tienen en cuenta.

## Escribir una pregunta en SQL

Una **pregunta SQL** es un `SELECT` sobre las tablas de la base, con su nombre real. Se
ejecuta **en solo lectura, con tus propios permisos** para todo el mundo, gestores
incluidos: una tabla que tienes cerrada no existe, un campo oculto se rechaza y una
escritura es imposible. Para guardar simplemente una consulta bajo las tablas, sin gráfico, o
convertirla en una vista PostgreSQL real, consulta [Consultas y vistas SQL](/basedb/es/fonctionnalites/requetes-et-vues-sql/).

Una **variable** se escribe `{{nom}}`; una parte que hay que quitar cuando no tiene valor, entre
`[[` y `]]`:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Una variable es un texto, un número, una fecha, o un **filtro de columna**: `{{periode}}`
se convierte entonces en toda una condición sobre la columna elegida, aquí `echeance`, o en `TRUE` cuando no
se elige nada. Es lo que permite que un filtro del panel controle una pregunta SQL
como las demás.

## Organizar un panel

**Editar** pone el panel en modo edición:

- **Pregunta** coloca una pregunta guardada, o crea una propia de la tarjeta;
- **Título** y **Texto** añaden un título de sección o un texto en Markdown;
- **Página insertada** muestra una dirección `https://` en un marco aislado, que no recibe ni
  sesión ni datos;
- **Pestaña** reparte las tarjetas en varias páginas; un doble clic cambia el nombre de una pestaña.

Las tarjetas se mueven por su tirador y se redimensionan por su esquina, sobre una cuadrícula de
24 columnas. **Guardar** lo conserva todo; **Cancelar** vuelve a la versión anterior. El título
de una tarjeta, en modo lectura, abre su pregunta para explorarla, filtros del panel incluidos.

## Los filtros

**Filtro** añade un control en la parte superior del panel: una **fecha** (un periodo), una
**categoría** (valores que marcar), un **texto**, un **número** o una **agrupación de
fecha** que hace pasar las líneas de mes a semana o a año.

Un filtro controla las tarjetas que se le vinculan: una, varias o todas. Al crearse, se
vincula por sí solo a las columnas que le corresponden; seleccionado, muestra en cada tarjeta la
columna que filtra, que se puede cambiar o quitar, y **Vincular a todas las tarjetas compatibles**
completa el resto. Puede tener un **valor predeterminado**, «Este año», por ejemplo.

En modo lectura, un clic en un punto también puede ajustar un filtro: **Filtrar por «Lyon»** en una
tarjeta cuya columna de ciudades está vinculada al filtro «Ville».

![La pestaña «Activité»: tareas por vencimiento apiladas por estado, embudo de proyectos, horas estimadas en tabla dinámica](../../../../assets/screens/tableaux-de-bord-activite.png)

## El Copilot

**Copilot**, en el encabezado de la sección Paneles, abre a la derecha una conversación en
lenguaje natural sobre la base: «la facturación por mes», «añade un filtro por cliente»,
«¿por qué baja agosto?». Cada propuesta llega como una tarjeta, que se aplica con un clic:

| Propuesta | Lo que hace |
|---|---|
| **Una pregunta** | ejecutada y dibujada en la conversación; se abre en el editor o se añade al panel |
| **Cambios en el panel**, o un panel nuevo | tarjetas añadidas, modificadas o quitadas, textos, filtros vinculados automáticamente a las tarjetas que tienen la columna, pestañas, nombre; un solo guardado, que se puede **deshacer** desde la tarjeta |
| **Valores para los filtros mostrados** | «muéstrame el mes pasado»: los filtros se ajustan y no se guarda nada |

Hacer una pregunta o ajustar los filtros está al alcance de cualquier lector de la base; modificar o crear
un panel requiere el nivel **Gestión**.

De forma predeterminada, **solo la estructura** se envía al proveedor de IA, junto con la conversación: las
tablas y sus campos, los paneles y las preguntas guardadas de la base, y el panel
mostrado, con sus pestañas, sus filtros y la definición de sus tarjetas (sus preguntas, sus textos).
Ni las filas, ni los resultados de las tarjetas, ni los **valores elegidos en los filtros**, que
pueden ser datos: de un filtro solo se envía el hecho de que tiene uno. Un campo marcado como
invisible para los agentes no se envía, ni tampoco la pregunta de una tarjeta que lo cite.

La casilla **Permitir la lectura de los datos** añade, durante la conversación, los valores de los
filtros mostrados y los resultados de las tarjetas con esos filtros (50 filas como máximo por lectura,
listadas bajo la respuesta), para comentar las cifras con datos concretos. Consulta
[Inteligencia artificial](/basedb/es/fonctionnalites/ia/).

## Compartir un panel

**Compartir**, en el encabezado de un panel, está disponible para quien tiene el nivel **Gestión** sobre la
base. Dos vías:

- **Compartir la base…** invita a personas a la base: abren el panel en basedb, y
  cada tarjeta lee con sus propios permisos;
- **Crear el enlace** da un enlace a **ese único** panel, que no requiere ningún permiso sobre la base.

| Acceso del enlace | Quién lee |
|---|---|
| **Público** | cualquiera que tenga el enlace, sin cuenta |
| **Miembros conectados** | un miembro del espacio de trabajo, tras iniciar sesión; si hace falta, solo de ciertos grupos |

La página del enlace muestra las pestañas, los filtros y las tarjetas del panel, **en solo lectura**:
sin exploración, sin acceso a las filas, sin preguntas propias. Sus tarjetas leen con los **permisos de la
persona que publicó el enlace**, que se vuelven a evaluar en cada lectura: si pierde el acceso a la base, el
enlace queda **suspendido**. El interruptor **Enlace activo** lo corta sin perderlo, y **Regenerar**
invalida el anterior.

Marca **Permitir la inserción en otro sitio web**: el diálogo proporciona un **código de inserción**
`<iframe>`, para mostrar el panel en una intranet o una wiki. Es el mismo mecanismo que el de las
[vistas compartidas](/basedb/es/fonctionnalites/vues-partagees/).

## Cada uno con sus permisos

Cada tarjeta lee **con los permisos de quien la mira**: el mismo panel muestra a cada uno lo que tiene
derecho a ver, salvo mediante un enlace compartido, que lee con los de la persona que lo publicó. Una tarjeta sobre una tabla o un campo que tienes cerrado muestra
«Dato inaccesible», en lugar de una cifra que mentiría por omisión. Guardar una
pregunta solo comparte la pregunta, nunca lo que su autor puede leer.

## Límites

- Una pregunta devuelve 2000 filas como máximo; a un resumen casi siempre le basta.
- Cada tarjeta hace su consulta al abrirse y con cada filtro, sin caché.
- Los mapas base cubren la Francia metropolitana (regiones, departamentos) y los países del
  mundo. Fuente: IGN, Admin Express (Licence ouverte); Natural Earth.

---
title: Tablas y campos
description: Los tipos de campo de basedb, su proyección en PostgreSQL, las fórmulas y los campos calculados.
---

Cada tabla de basedb es una tabla PostgreSQL; cada campo, una columna tipada. La etiqueta
que introduces («Échéance») se convierte en un nombre físico legible (`echeance`) mediante una
**slugificación** estable: sin acentos, en minúsculas, sin palabras reservadas.

## Los tipos

| Tipo | Columna PostgreSQL | Observaciones |
|---|---|---|
| Texto corto | `text` | una línea |
| Texto largo | `text` | Markdown: un extracto en la cuadrícula, el texto formateado al pasar el ratón, un editor propio; puede [citar una columna](#texto-enriquecido-y-variables) |
| Texto enriquecido | `text` + `CHECK` | HTML saneado al escribirse, redactado en un editor visual; [ver más abajo](#texto-enriquecido-y-variables) |
| Número | `numeric` | nunca de coma flotante: un importe no se desvía |
| Moneda, Porcentaje, Duración, Valoración | `numeric` | un número y su [formato de visualización](#formatos-de-visualización): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Casilla de verificación | `boolean` | |
| Fecha | `date` | |
| Fecha y hora | `timestamptz` | un instante absoluto, mostrado en la zona horaria de quien lo lee |
| Selección única | `text` + `CHECK` | color, icono o imagen por opción |
| Selección múltiple | `text[]` + `CHECK` | filtrable con los operadores de array |
| Correo electrónico | `text` + `CHECK` | una dirección validada por la base de datos, que se abre con un clic |
| Teléfono, Código de barras | `text` | un texto corto y su formato: enlace de llamada, fuente monoespaciada |
| URL | `text` + `CHECK` | se completa al escribir (`exemple.fr` → `https://exemple.fr`) |
| Persona | `uuid` | un miembro del espacio de trabajo; asignarlo le [avisa](/basedb/es/fonctionnalites/collaboration/) |
| Número automático | `bigint` de identidad | numera también las filas ya existentes; nadie lo introduce |
| Relación | `uuid` + `FOREIGN KEY` | una clave foránea real hacia la tabla de destino |
| Relación múltiple | `uuid[]` | varias filas vinculadas, cuya integridad mantiene un disparador |
| Fórmula | columna generada `STORED` | calculada por PostgreSQL, o en la lectura: consulta [Fórmulas](#fórmulas) |
| Búsqueda, Acumulado, Recuento | ninguna | calculados en la lectura, a través de una relación |
| Botón | ninguna | abre una dirección o lanza una [automatización](/basedb/es/fonctionnalites/automatisations/) |
| Archivo, Imagen | `jsonb` (metadatos) | los bytes van al [almacenamiento de archivos](/basedb/es/fonctionnalites/fichiers/) |

Cada tabla tiene además sus **columnas del sistema**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by`, mantenidas por un disparador y nunca modificables
desde la API. La cuadrícula las agrupa en **Información del sistema**, en el menú de las columnas:
están en todas las tablas y son útiles en pocas.

![La cuadrícula de una tabla, con una duración calculada, una búsqueda y un recuento](../../../../assets/screens/grille.png)

## Restricciones garantizadas por la base de datos

Lo que la interfaz promete, PostgreSQL lo garantiza. Una selección única es una restricción
`CHECK`; una relación, una `FOREIGN KEY`; una URL o una dirección de correo electrónico, una
expresión regular. Una escritura en SQL directo que las infrinja se rechaza, igual que en la
interfaz:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Formatos de visualización

Moneda, Porcentaje, Duración, Valoración, Teléfono y Código de barras se eligen como tipos,
pero son **formatos**: la columna sigue siendo un número o un texto; solo cambia la forma de leerla.

| Formato | Sobre | Se lee y se introduce |
|---|---|---|
| Moneda | un número | `12 500,00 €`: euro, dólar, libra, franco suizo, dólar canadiense, yen |
| Porcentaje | un número | `15 %` |
| Duración | un número de segundos | `1:30`, y se introduce `1h30`, `90 min` |
| Valoración | un número | de 1 a 10 estrellas, se ajusta con un clic |
| Teléfono | un texto corto | un enlace de llamada |
| Código de barras | un texto corto | en fuente monoespaciada |

Un formato se puede cambiar después (**Visualización**, al editar el campo) sin tocar los
valores guardados. No limita el valor: una valoración de 7 en una escala de 5 sigue siendo 7.

## Fórmulas

Una fórmula se escribe en francés, con los campos entre corchetes y los argumentos separados por `;`:

```text
ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)
SI([Payée]; FAUX; JOURS(AUJOURDHUI(); [Échéance]) > 0)
JOURS([Fin]; [Début])
```

El editor propone los campos que insertar y una lista de funciones; un error indica el campo o
el carácter que lo provoca.

| Familia | Funciones |
|---|---|
| Lógica | `SI`, `SIVIDE`, `ESTVIDE`, `ET`, `OU`, `NON`, `VRAI`, `FAUX` |
| Números | `ARRONDI`, `ABS`, `PLAFOND`, `PLANCHER`, `MIN`, `MAX` |
| Texto | `MAJUSCULE`, `MINUSCULE`, `SANSESPACES`, `GAUCHE`, `DROITE`, `LONGUEUR`, `TEXTE`, `NOMBRE` |
| Fechas | `ANNEE`, `MOIS`, `JOUR`, `JOURSEMAINE`, `JOURS`, `AJOUTER_JOURS`, `DATE`, `AUJOURDHUI`, `MAINTENANT` |
| Operadores | `+ - * /`, `&` para unir texto, `= <> < <= > >=` |

Una fórmula se convierte en una **columna generada** por PostgreSQL: `psql` y tus herramientas la leen
como las demás. La que depende del día (`AUJOURDHUI()`, `MAINTENANT()`) o que cita una
búsqueda o un acumulado se **calcula en la lectura**: se puede filtrar y ordenar en basedb, pero
no existe en SQL directo.

Una fórmula no cita ni otra fórmula ni una relación directamente; una búsqueda sí puede hacerlo.
Extraer o reemplazar una parte de un texto llegará más adelante.

## Búsquedas, acumulados y recuentos

Tres campos leen **a través de una relación**, en un sentido o en el otro: «el cliente del
proyecto», pero también «las tareas vinculadas por Proyecto»:

- una **búsqueda** trae un valor de la fila vinculada, o la lista de valores: la ciudad del
  cliente de un proyecto;
- un **acumulado** calcula sobre las filas vinculadas: número de valores, suma, media, mínimo,
  máximo; por ejemplo, la facturación de un cliente o la valoración media de sus reseñas;
- un **recuento** cuenta las filas vinculadas: el número de tareas de un proyecto.

Se calculan en cada lectura, **con los permisos de quien lee**: si la tabla vinculada te está
cerrada, el campo también. Se pueden filtrar y ordenar. Siguen una sola relación, no se
escriben y no tienen columna (así que no existen en SQL directo), y no aparecen ni
en la importación, ni en los formularios, ni en el historial.

## Las relaciones

Una **relación** vincula una fila con una fila de otra tabla de la misma base. La cuadrícula
muestra el **valor del campo principal** de la fila de destino (el campo que designas como tal
para su tabla) y los filtros atraviesan la relación (`clients_id.ville eq "Lyon"`). Las filas
que apuntan a una fila se muestran en los detalles de esa fila.

Marca **Varias filas por registro** y la relación pasa a ser **múltiple**: una tarea
depende de varias tareas, un artículo pertenece a varias categorías. Las filas vinculadas
se muestran como píldoras, se eligen mediante una búsqueda y se abren con un clic desde los
detalles de la fila. Eliminar una fila de destino la quita de las listas que la citaban, o se
rechaza, si así lo has elegido. Se aplican los filtros `has_any`, `has_all` e `is_null`, que
también atraviesan la relación (`taches_ids.titre contains "logo"`). Una relación múltiple no se
ordena, no agrupa y todavía no se importa.

## Botón

Un campo **Botón** no tiene valor: actúa. **Abre una dirección** (`https://` o
`mailto:`, que puede citar la fila: `mailto:{{E-mail}}`) o **lanza una automatización**
desencadenada por un botón en la misma tabla. Se muestra en la celda, en la tarjeta y en
los detalles de la fila.

## Descripciones

Una base, una tabla y un campo tienen una **descripción**, modificable sin migración. Se
copia en el `COMMENT ON` que lee `psql`, en la documentación generada y en lo que un
agente lee mediante `describe_table`.

## Texto enriquecido y variables

El **texto enriquecido** es la variante HTML del texto largo, que se elige al crear el campo
(«Texto enriquecido (HTML)»): títulos, negrita, cursiva, subrayado, tachado, listas, citas, código,
enlaces y separadores, en un editor visual. El HTML se **sanea al escribirse**, venga
de la interfaz, de la API, del servidor MCP o de una importación, y además una restricción `CHECK` rechaza
las formas peligrosas escritas directamente en SQL (`<script>`, atributos `on…`, `javascript:`).
Ni imágenes, ni tablas, ni colores: lo que la base de datos no conservaría no se ofrece.

Un texto largo, simple o enriquecido, puede **citar una columna de su fila**. El menú **Columna** del
editor inserta la cita en el cursor: una píldora en el texto enriquecido, `{{Ville}}` en el
Markdown.

> Entrega prevista el `{{Livraison}}` en `{{Ville}}`.

- La columna guarda la cita tal como se escribió, `{{ville}}`, por su nombre físico: es lo
  que lee `psql`.
- En todos los demás sitios (la cuadrícula, los detalles de la fila, la API, el servidor MCP, las
  vistas compartidas, las automatizaciones), el texto se lee **con el valor de la fila**: «Entrega
  prevista el 02/10/2026 en Lyon». Cambiar la ciudad cambia el texto.
- Una selección única se lee por su etiqueta, una persona por su nombre, una fecha en tu
  formato; un valor insertado en texto enriquecido nunca se interpreta como marcado.
- Una columna que el lector no puede leer no da nada: ni su valor, ni su nombre.

El texto enriquecido no puede rellenarlo la IA: un modelo escribe texto, no HTML saneado.

## Modificar la estructura

La pantalla **Estructura** de la base, en su menú **⋯** de la barra lateral, lista las tablas y sus campos: añadir, cambiar el nombre, hacer obligatorio, reordenar,
describir, designar el campo principal.

![La pantalla Estructura de una base](../../../../assets/screens/structure.png)

Cambiar la estructura requiere el nivel **Gestión**. Sin él, la pantalla se puede consultar y no ofrece
nada: ni botón, ni lápiz, ni tirador; la obligatoriedad y el campo principal se indican, pero no
se ofrecen. De todos modos, el servidor rechaza cada cambio; la pantalla ya no finge
aceptarlo.

Añadir un campo, cambiarle el nombre o cambiar su tipo pasa por el **motor de migraciones**: un plan por
etapas, bloqueos cortos y un rechazo explícito cuando un dato no se puede convertir.

**Cambiar el nombre** de una base, una tabla o un campo se hace en un solo diálogo. La etiqueta cambia
siempre, sin migración. Un administrador ve debajo «Cambiar también el nombre en la base de datos:
`clients` → `comptes`»: si la marca, cambia también el nombre físico y se muestra el análisis de impacto,
con las consultas, las vistas SQL y las automatizaciones que citan el nombre antiguo. El nombre
antiguo se sigue sirviendo mediante un **alias de compatibilidad** (una vista) mientras actualizas tus
consultas.

Eliminar no borra nada de inmediato: la tabla o la base se relega
(`zz_supprime_…`) y sigue siendo legible en SQL. Una base eliminada se puede restaurar; recuperar una tabla
sola desde la interfaz [llegará más adelante](/basedb/es/feuille-de-route/). La **purga** definitiva está
reservada a la administración, treinta días después, y empieza con una exportación CSV verificada.

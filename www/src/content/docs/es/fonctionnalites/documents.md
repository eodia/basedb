---
title: Documentos PDF
description: Una fila convertida en factura, presupuesto, ficha o certificado con tus colores, con logotipo, filas vinculadas y totales.
---

Una fila se convierte en un **PDF**: una factura con sus líneas y su total, un presupuesto, un
albarán, una ficha de producto, un certificado. En los detalles de una fila, el botón
**Documento PDF** lo abre en una nueva pestaña, desde donde el navegador lo imprime o lo guarda.

## Detalles de la fila, sin configurar nada

Sin plantilla, una fila se imprime como **detalles de la fila**: su nombre como título y,
después, todos los campos que puedes leer, en tu idioma.

## Crear una plantilla

Quien construye la tabla —el nivel Gestión— crea las plantillas desde los detalles de una
fila: **Documento PDF › Plantillas de documento…**. Una plantilla nueva parte de un **punto de
partida**:

| Punto de partida | Lo que incluye |
|---|---|
| **Factura** | encabezado con logotipo y datos de contacto, «FACTURA», número y fecha; cliente; líneas facturadas y su total; resumen de importe sin impuestos / total con impuestos; condiciones de pago; menciones legales al pie |
| **Presupuesto** | título sobre una franja de color, información en cuadrícula, servicios, validez, zona «Visto bueno» |
| **Ficha** | título grande a todo lo ancho, foto del campo de imagen, campos en cuadrícula, textos largos |
| **Certificado** | página horizontal con marco, texto centrado, firma |
| **Página en blanco** | un título y los campos de la fila |

Se construye con **las columnas de tu tabla** —su número, su fecha, sus importes, su foto, las
filas que están vinculadas a ella— y lo que la tabla no tiene simplemente se deja de lado. Todo
se puede cambiar después; la vista previa, a la derecha, muestra el PDF de la fila abierta y se
actualiza con cada modificación.

## El contenido: bloques

Los bloques se suceden de arriba abajo; se **arrastran** por su asa para reordenarlos, y se
abren para ajustarlos.

| Bloque | Lo que muestra |
|---|---|
| **Título** | un título grande y un subtítulo, sobrio, en color, subrayado, o sobre una franja de color —hasta los bordes de la página |
| **Texto** | texto enriquecido —títulos, negrita, listas, enlaces— que cita las columnas de la fila con el menú **Columna**: «Factura `{{numero}}` del `{{date}}`»; alineado o justificado, sobre fondo de color, con marco o marcado con una barra de color |
| **Imagen** | un logotipo, un sello, o la foto de un campo de imagen de la fila |
| **Campos de la fila** | los campos elegidos, o todos: etiqueta a la izquierda, etiqueta encima en cuadrícula de 2 o 3, o **resumen** —valores a la derecha, el último (el total adeudado) en negrita—; los campos vacíos se pueden ocultar |
| **Tabla de filas vinculadas** | las filas que designan esta —las líneas de una factura— o las que designa un enlace múltiple, con sus **totales**; encabezado de color, una fila de cada dos con fondo de color, encabezados, anchos y alineaciones de columna a tu gusto («Cant.» en vez de «Cantidad») |
| **Columnas** | dos o tres columnas en paralelo, cada una con sus bloques: «Facturar a» por un lado, las referencias por el otro |
| **Separador**, **Espacio** | una línea —corta para una firma— o un espacio en blanco |
| **Salto de página** | lo que sigue, en una página nueva |

## El estilo y la página

- **Color de acento** —el de tu marca: títulos, franjas, encabezados de tabla, enlaces. El
  texto que va encima es blanco u oscuro, según lo que se lea mejor.
- **Color del texto**, **fuente** del texto y de los títulos (con o sin serifa), **tamaño**
  del texto, estilo de los subtítulos.
- **Formato** (A4 o Letter), **orientación**, **márgenes**, **marco** simple o doble alrededor
  de la página, contenido **centrado verticalmente** —para un certificado.
- **Idioma de los valores**: los importes se escriben con su moneda («1 234,50 €»), las fechas
  en letras («30 de septiembre de 2026»), sí y no, la etiqueta de una opción, el nombre de una
  persona. El texto se compone con fuentes integradas que cubren los veinte idiomas de basedb,
  ideogramas incluidos.

## Encabezado y pie de página

El **encabezado** lleva tu **logo** —una imagen que subas (PNG, JPEG o SVG; una imagen
demasiado pesada se reduce) o el campo de imagen de la fila—, un texto a la izquierda (tus
datos de contacto) y un texto a la derecha (qué es el documento, su número, su fecha), en la
primera página o en todas. El **pie de página** lleva tus menciones legales y los números de
página. Ambos citan las columnas de la fila, como un texto.

## Cada uno con sus permisos

Un documento se lee **con los permisos de quien lo imprime**: un campo que tiene oculto no
aparece en él —ni en un texto, ni en una imagen—, una fila vinculada que no puede ver no está en
la tabla, ni en el total. Así, dos personas pueden obtener dos documentos distintos de la misma
fila: cada una tiene el suyo.

## Por la API

```bash
# El PDF de una fila con una plantilla, o «detalles de la fila»
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lista las plantillas de la tabla.

## Límites

- Una imagen que subas pesa 300 KB como máximo, ocho por plantilla; una imagen de un campo se
  utiliza si es un PNG o un JPEG.
- El valor de una fila vinculada se cita fuera de la tabla mediante una **búsqueda** sobre la
  tabla del documento; un total con impuestos es un campo de la tabla.
- Un documento por fila: todavía no hay PDF de varias filas. Una
  [automatización](/basedb/es/fonctionnalites/automatisations/#un-pdf-y-un-correo-electrónico)
  puede hacerlo por ti —**Generar un PDF**— y enviarlo como archivo adjunto.

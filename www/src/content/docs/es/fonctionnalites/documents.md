---
title: Documentos PDF
description: Una fila convertida en factura, presupuesto o ficha imprimible, con sus filas vinculadas y sus totales.
---

Una fila se convierte en un **PDF**: una factura con sus líneas y su total, un presupuesto, un
albarán, una ficha. En los detalles de una fila, el botón **Documento PDF** lo abre en una
nueva pestaña, desde donde el navegador lo imprime o lo guarda.

## Detalles de la fila, sin configurar nada

Sin plantilla, una fila se imprime como **detalles de la fila**: su nombre como título y,
después, todos los campos que puedes leer, en tu idioma.

## Las plantillas

Quien construye la tabla —el nivel Gestión— las escribe, desde los detalles de una fila:
**Documento PDF › Plantillas de documento…**. Una plantilla es una página (A4 o Letter, vertical
u horizontal), un idioma para los valores, un pie de página y una serie de bloques:

| Bloque | Lo que muestra |
|---|---|
| **Texto** | texto enriquecido —títulos, negrita, listas, enlaces— que cita las columnas de la fila con el menú **Columna**: «Factura `{{numero}}` del `{{date}}`» |
| **Campos de la fila** | los campos elegidos, o todos: etiqueta a la izquierda, valor a la derecha |
| **Tabla de filas vinculadas** | las filas que designan esta —las líneas de una factura—, o las que designa un enlace múltiple, con las columnas elegidas y sus **totales** |
| **Salto de página** | lo que sigue en una página nueva |

El editor muestra al lado el PDF que la plantilla hace de la fila abierta, con los cambios
incluidos.

Los valores se escriben **en el idioma de la plantilla**: un importe con su moneda («1 234,50 €»),
una fecha en letras («30 de septiembre de 2026»), sí y no, la etiqueta de una opción, el nombre
de una persona. El texto se compone con fuentes integradas que cubren los veinte idiomas de
basedb, ideogramas incluidos.

## Cada uno con sus permisos

Un documento se lee **con los permisos de quien lo imprime**: un campo que tiene oculto no
aparece en él, una fila vinculada que no puede ver no está en la tabla, ni en el total. Así, dos
personas pueden obtener dos documentos distintos de la misma fila: cada una tiene el suyo.

## Por la API

```bash
# El PDF de una fila con una plantilla, o «detalles de la fila»
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lista las plantillas de la tabla.

## Límites

- Sin imagen (logo) ni color elegido en un documento, sin encabezado distinto del pie.
- Un documento por fila: todavía no hay PDF de varias filas, ni generación mediante una
  automatización.

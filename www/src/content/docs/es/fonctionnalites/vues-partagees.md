---
title: Vistas compartidas
description: Mostrar una vista en solo lectura mediante un enlace, insertarla en un sitio web, suscribirse a un calendario.
---

Una vista de datos (cuadrícula, kanban, calendario, cronología, galería, lista) se **comparte en
solo lectura**: un enlace `/v/<jeton>` la muestra a quien no puede abrir basedb, sin
permitir escribir nada. Es la contrapartida de los [formularios compartidos](/basedb/es/fonctionnalites/formulaires-partages/),
que permiten responder sin dejar leer nada. Un [panel](/basedb/es/fonctionnalites/tableaux-de-bord/#compartir-un-panel)
se comparte de la misma manera.

## Compartir

Menú de la vista → **Compartir…**, y después:

| Acceso | Quién lee |
|---|---|
| **Público** | cualquiera que tenga el enlace, sin cuenta |
| **Miembros conectados** | un miembro del espacio de trabajo, tras iniciar sesión; si hace falta, solo de ciertos grupos |

![Compartir un calendario](../../../../assets/screens/partage-vue.png)

El interruptor **Enlace activo** suspende el enlace sin perderlo. La página se abre fuera de
la aplicación: sin barra lateral, sin nombre de base, sin nombre de tabla; solo la vista, sus filtros, sus
columnas y nada más. Un calendario o una cronología se lee ahí como una agenda.

![El mismo calendario, abierto mediante su enlace](../../../../assets/screens/vue-partagee.png)

## En nombre de quién se lee

La vista se lee con los **permisos de la persona que la publicó**, que se vuelven a evaluar en cada lectura:
un campo que esa persona tiene oculto no se muestra y, si pierde el acceso a la tabla, el enlace deja
de mostrar nada.

## Insertar en otro sitio web

Marca **Permitir la inserción en otro sitio web**: el diálogo proporciona un **código
de inserción** `<iframe>`, para pegarlo en una intranet, una wiki o un sitio corporativo. Sin esa
casilla, la página se niega a mostrarse dentro del marco de otro sitio web.

## Un calendario en tu agenda

Para un calendario o una cronología compartidos en modo **público**, el diálogo proporciona la **dirección del
feed de agenda**: un feed iCalendar (`…/calendar.ics`, 1000 eventos como máximo) al que
pueden suscribirse Google Calendar, Outlook o Apple Calendar. Los vencimientos del equipo aparecen
en la agenda de cada uno y siguen a la tabla.

## Una fuente para otras bases

Un enlace público proporciona también la **dirección de la API de la vista**: las filas que muestra, en
JSON. Una [tabla sincronizada](/basedb/es/integrations/synchronisation/), en esta instancia o
en otra, puede tomarla como fuente.

## Límites

- La lectura está limitada a 120 solicitudes por minuto, por dirección IP y por enlace.
- Un formulario no se comparte en lectura: se comparte [para recibir respuestas](/basedb/es/fonctionnalites/formulaires-partages/).

---
title: Historial
description: Cada escritura, venga de donde venga, con los valores anteriores.
---

basedb registra en el historial **cada escritura**, venga de donde venga: la interfaz, la API, un agente MCP,
un formulario público, e incluso una consulta SQL escrita a mano en `psql`.

![El historial de una base](../../../../assets/screens/historique.png)

## Cómo se captura

No lo hace la aplicación, sino **disparadores de PostgreSQL**, dentro de la propia transacción de
la escritura. Una escritura que falla no deja ningún rastro; una escritura que tiene éxito no puede
dejar de dejarlo. Después, las revisiones se vuelcan en registros inmutables, particionados por
mes.

La identidad viaja mediante variables de sesión establecidas al principio de cada transacción. Una
escritura que no las lleva (SQL directo) se registra como tal, con la sesión que
la hizo (`psql`, dirección, proceso): no por ello se rechaza nunca.

| Actor | Se muestra como |
|---|---|
| una persona | su nombre |
| un programa (API) o un agente (MCP) | la persona que creó el token, «con el token…» |
| un formulario público | «Formulario “…” · respuesta pública» |
| una automatización | «Automatización “…” · en nombre de» la persona responsable |
| SQL directo | «Sesión SQL directa» |

## Qué se puede hacer con él

- **Leer** el historial de una fila (pestaña «Historial» de sus detalles), de una tabla o de una
  base (**Historial**, en el menú **⋯** de la base), filtrado por tabla.
- **Deshacer** un cambio: los valores anteriores se vuelven a aplicar campo por campo.
- **Restaurar** una fila eliminada desde su entrada «ha eliminado».
- Seguir el **historial de estructuras** (pestaña «Estructura»): tablas y campos creados,
  modificados, eliminados.

## Deshacer (Ctrl+Z)

En la cuadrícula, **Ctrl+Z** (⌘Z en Mac) deshace tu última escritura; **Ctrl+Mayús+Z** o
**Ctrl+Y** la rehace. Un mensaje confirma lo que se ha deshecho («Deshecho: modificación de
“Montant”») con un botón para revertir la acción.

Se deshacen así una celda, una tarjeta o una barra desplazada, una fila creada o eliminada, un
pegado, e incluso una importación entera, contada como un solo gesto. Hasta cincuenta gestos, pestaña por
pestaña.

No es una vuelta atrás de la pantalla: es una **nueva escritura**, hecha por el
servidor a partir del historial, y registrada también en él. Se rechaza si alguien ha
modificado la fila desde entonces («No se puede deshacer: “Statut” se ha modificado desde entonces») en lugar
de sobrescribir su trabajo. Así solo se deshacen las escrituras propias de las últimas
veinticuatro horas, y nunca la estructura. En una celda que se está editando, Ctrl+Z sigue siendo
el del texto.

## Permisos

El historial sigue los permisos de lectura: un campo oculto para ti no aparece en las
revisiones que lees.

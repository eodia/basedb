---
title: Búsqueda
description: Un solo campo para encontrarlo todo —tablas, vistas, paneles, filas, comandos— y para hacerle una pregunta al Copilot. Ctrl+K.
---

El campo **Buscar tablas, filas, comandos…**, en el centro de la barra superior, abre la
búsqueda: un solo campo para todo lo que puedes alcanzar en basedb. **Ctrl+K**
(**⌘K** en Mac) la abre o la cierra desde cualquier pantalla —salvo en un editor de texto,
donde inserta un enlace.

## Lo que encuentra

| | |
|---|---|
| **Tablas y objetos** | los proyectos y las bases que ves; las tablas, vistas SQL y consultas guardadas; las vistas de las tablas de la base abierta, personales incluidas; las preguntas, paneles y automatizaciones de las bases del proyecto; las columnas de las tablas; las pestañas abiertas |
| **Filas** | los datos en sí, en las tablas de la base abierta: el texto de las columnas, las opciones de las listas, un número exacto —a partir de dos caracteres. Un identificador de fila pegado encuentra su fila |
| **Comandos** | lo que la aplicación sabe hacer: ir a la estructura, al historial, a los paneles de la base; crear una tabla, una pregunta, una consulta SQL, una base, un proyecto, partir de una plantilla; importar en una tabla; deshacer o rehacer la última escritura; cerrar o cambiar de pestaña; cambiar de tema; abrir el Copilot; **Copiar el enlace de esta página**; abrir una pestaña de la configuración o de la administración; cerrar sesión |
| **Copilot** | una pregunta en lenguaje natural, confiada al Copilot |

**Intro** abre el resultado elegido: una fila se abre en su tabla, en sus detalles. En una
pantalla grande, un panel a la derecha muestra su vista previa —los valores de una fila, las
columnas y la descripción de una tabla, la descripción de un panel o de una automatización. Pega
una dirección de basedb: **Abrir este enlace** te lleva allí (consulta
[un enlace a cada pantalla](/basedb/es/fonctionnalites/collaboration/#un-enlace-a-cada-pantalla)).

El campo vacío propone tus **recientes**, las pestañas abiertas, las tablas de la base y algunas
sugerencias.

## Escribe como piensas

- **Ni acentos ni mayúsculas**: `malaga` encuentra «Málaga».
- **Principios de palabra e iniciales**: `nc` para «Nuevo cliente», `nuevtab` para «Nueva tabla».
- **Una errata perdonada** —una letra olvidada, duplicada, cambiada o invertida, dos en una
  palabra de más de siete letras—, nunca en la primera letra.
- **Cada palabra escrita debe encontrarse en algún sitio**, en el nombre o en lo que lo contiene:
  `ventas clientes` encuentra la tabla «Clientes» de la base «Ventas». El tipo también se
  escribe: `vista`, `auto`, `panel`.
- **Una tabla, y después lo que buscas en ella**: `clientes valencia` busca «valencia» en las
  filas de la tabla «Clientes».

En primer lugar, el **mejor resultado**; lo que abres a menudo y recientemente sube arriba. Esta
memoria se queda en tu navegador.

## Restringir la búsqueda

Las pastillas debajo del campo —**Todo**, **Tablas y objetos**, **Filas**, **Comandos**,
**Copilot**— restringen lo que se busca. Un primer carácter hace lo mismo:

| Escribe primero | Para buscar |
|---|---|
| `#` | solo las tablas y los objetos |
| `/` | solo las filas |
| `>` | solo los comandos |
| `?` | una pregunta al Copilot |

**Tab**, sobre una tabla o una base, busca **dentro**: su nombre aparece en el campo, y la
búsqueda ya solo abarca sus filas, sus vistas, sus columnas y sus comandos. El campo vacío
muestra entonces las veinte filas modificadas más recientemente. **⌫**, con el campo vacío, sale
de ahí; **Esc** retrocede un paso, y después cierra.

## Preguntar al Copilot

Cada búsqueda termina con **Preguntar al Copilot: «…»**, colocado en primer lugar cuando el
texto se lee como una pregunta —termina en «?», empieza por «cuántos», «cuál», «muestra»…, o
tiene cinco palabras o más. El Copilot se abre sobre la base y recibe la pregunta como si la
hubieras escrito tú. Lee la estructura, no las filas, salvo que marques **Permitir la lectura de
los datos**, y propone: nada cambia hasta que lo apliques. Hace falta que la IA esté configurada
en la instancia —consulta [Inteligencia artificial](/basedb/es/fonctionnalites/ia/).

## Permisos y límites

La búsqueda pasa por las mismas rutas que el resto de la pantalla, **con tus permisos**: una
tabla o una columna que tienes cerrada no aparece, ni entre los objetos ni en las filas. Las
automatizaciones solo se ofrecen a quien tiene el nivel **Gestión** sobre su base.

- Las filas se buscan en la base abierta, o en la base o la tabla en la que has entrado con Tab:
  tres filas por tabla, en veinticuatro tablas como máximo; veinte filas en una tabla.
- Las preguntas, paneles y automatizaciones son los del proyecto abierto (ocho bases como
  máximo), releídos cada dos minutos como máximo.
- Cada grupo muestra algunos resultados, y después **N resultados más**, que lo abre entero.

## Atajos de teclado

**Atajos**, en la parte inferior de la búsqueda, o el comando **Atajos de teclado**, los muestra
todos. **Ctrl** se lee **⌘** en Mac.

| Teclas | Efecto |
|---|---|
| **Ctrl+K** | abrir o cerrar la búsqueda |
| **↑** **↓**, **Intro** | recorrer los resultados, abrir el resultado |
| **Alt+W** | cerrar la pestaña |
| **Ctrl+Tab**, **Ctrl+Mayús+Tab** | pestaña siguiente, pestaña anterior |
| clic central | cerrar una pestaña |
| **Ctrl+A**, **Ctrl+C** | en la cuadrícula, seleccionar todo, copiar las celdas elegidas |
| **Ctrl+clic** | seguir una relación |
| **Ctrl+Z**, **Ctrl+Y** | deshacer la última escritura, rehacerla |
| **Ctrl+Intro** | enviar un comentario, guardar una descripción |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | en un texto: negrita, cursiva, enlace |

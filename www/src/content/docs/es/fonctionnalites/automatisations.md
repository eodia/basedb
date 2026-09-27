---
title: Automatizaciones
description: Cuando cambia una fila, a una hora fija o con un clic; modificar, crear, buscar, bifurcar, preguntar a la IA, avisar, llamar a un webhook, escribir en Slack.
---

Una automatización dice **cuándo**, **si** y **entonces**: cuando una tarea pasa a «Fait», anotar
la hora; cuando llega una reseña negativa, avisar a la responsable y escribir en Slack; cada
lunes a las 9:00, crear la fila de la reunión de equipo. Y cuando una acción no basta, sigue un
**flujo**: buscar una fila, tomar una rama u otra según lo que diga, reutilizar
en un paso lo que un paso anterior ha encontrado o escrito.

Se abren desde **Automatizaciones**, en el bloque de la base abierta en la parte inferior de la barra
lateral, y requieren el nivel **Gestión**.

![Un flujo y una de sus ejecuciones, superpuesta](../../../../assets/screens/automatisations.png)

## El flujo

El flujo se dibuja de arriba abajo: el desencadenador y luego cada paso. Un **+** sobre una línea
añade un paso en ese punto; una tarjeta abre sus ajustes a la derecha. Una automatización
sencilla (un desencadenador y una acción) cabe en dos tarjetas y se configura como antes.

## Cuándo

| Desencadenador | Ajustes |
|---|---|
| **Se crea una fila** | la tabla |
| **Se modifica una fila** | la tabla y, si hace falta, solo los campos que vigilar |
| **A una hora fija** | cada hora, cada día o cada semana, a la hora y en la zona horaria elegidas |
| **Se hace clic en un botón** | un [campo Botón](/basedb/es/fonctionnalites/tables-et-champs/#botón) de la tabla |

Un desencadenador sobre las filas ve **todas** las escrituras: la interfaz, la API, un agente, un
formulario compartido e incluso el SQL directo, porque las automatizaciones parten del historial, que las
captura todas.

## Solo si

Una condición opcional, en el [lenguaje de los filtros](/basedb/es/integrations/api-rest/#leer)
(`statut eq "fait"`, `montant gte 10000 and payee eq false`), evaluada sobre la fila **en el momento
de actuar**. Una ejecución cuya condición no se cumple queda «descartada», y lo indica.

## Entonces

Hasta treinta pasos, en orden; el primero que falla detiene los siguientes.

| Paso | Lo que hace |
|---|---|
| **Modificar una fila** | escribe valores en la fila que lo ha desencadenado, o en la que un paso ha encontrado o creado |
| **Crear una fila** | en esta tabla o en otra de la base |
| **Buscar una fila** | la primera fila de una tabla que cumple un filtro, para que los pasos siguientes la citen o la modifiquen |
| **Avisar a alguien** | una [notificación](/basedb/es/fonctionnalites/collaboration/#notificaciones) a personas elegidas, o a la de un campo Persona |
| **Llamar a un webhook** | un `POST` por HTTPS a la dirección que elijas; su respuesta se puede citar después |
| **Enviar a Slack** | un mensaje en un canal [conectado](/basedb/es/integrations/synchronisation/#slack) |
| **Preguntar a la IA** | una respuesta del [proveedor de IA](/basedb/es/fonctionnalites/ia/) a una instrucción que cita la fila y los pasos anteriores (redactar, resumir, clasificar), leída como un texto, un número, sí o no, una fecha o una opción de una lista |
| **Condición** | varias ramas: se toma la primera cuya condición se cumple, y «Si no» cuando no se cumple ninguna; después, las ramas vuelven a unirse |

Una búsqueda que no encuentra nada no detiene el flujo: los pasos que debían modificar su
fila se omiten. Para hacer otra cosa en ese caso, una condición lo comprueba: una rama
con el filtro vacío se toma en cuanto la búsqueda ha encontrado algo.

## Preguntar a la IA

Como un [campo de IA](/basedb/es/fonctionnalites/ia/#la-opción-de-ia-de-un-campo), el paso envía al
proveedor su instrucción, en la que cada cita se sustituye por su valor:

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

Se elige la **respuesta esperada**: un texto libre o corto, un número, sí o no, una fecha,
una dirección web o una opción de una lista, que se puede tomar de un campo de selección. Se avisa de ello
al modelo, y una respuesta que no la contenga hace fallar el paso. Los pasos siguientes
la citan con `{{e1.reponse}}`: en el título de una tarea creada, en un mensaje o en un campo de selección,
donde se asigna a la opción con la misma etiqueta.

Lo que cita la instrucción se envía al proveedor: el paso pide tu **consentimiento**, que hay que volver a dar
cuando cambia la instrucción. Cada llamada se registra y cuenta, junto con los campos de IA, en
`BASEDB_AI_FIELD_QUOTA` (300 por hora de forma predeterminada). La IA no hace nada por sí misma: son los
pasos colocados después de ella los que escriben o avisan.

## Citar

Los valores, los mensajes y los filtros citan lo anterior, desde el botón **{ }** junto
a cada texto:

- `{{Titre}}`, `{{_id}}`: la fila que ha desencadenado la automatización;
- `{{e2.titre}}`, `{{e2._id}}`: la fila encontrada, creada o modificada por el paso `e2`; cada
  paso lleva su identificador en su tarjeta;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: lo que ha respondido el webhook `e3`;
- `{{e4.reponse}}`: la respuesta del paso de IA `e4`;
- `{{_maintenant}}`: el instante de la ejecución.

Un valor formado por una sola cita pasa el propio valor: una relación, una persona, una
opción. Así es como una fila creada se vincula con la que ha encontrado una búsqueda. En un
filtro, una cita es siempre un valor comparado, nunca lenguaje de filtro.

Un paso solo puede citar lo que con seguridad ha ocurrido antes que él: lo que una rama ha encontrado
ya no se puede citar después de la condición. El editor lo señala en la tarjeta antes de guardar.

## El Copilot

**Copilot**, en el encabezado, abre a la derecha una conversación en lenguaje natural sobre las
automatizaciones de la base: «cuando una tarea pase a revisión, avisa a la persona
asignada», «añade un resumen hecho por la IA en las notas», «¿por qué ha fallado la última
ejecución?». Responde y **propone** una automatización completa (la que tienes en pantalla,
modificada, o una nueva), con la lista de lo que cambia.

El Copilot no guarda nada: **Colocar en el flujo** muestra la propuesta en el editor,
donde la revisas antes de guardar, y **Deshacer**, en la tarjeta, devuelve el flujo a como
estaba. Una automatización nueva se abre en el editor, lista para crearse. Cada propuesta se
valida como se validaría un guardado; lo que no se sostiene se descarta, y se indica.

De forma predeterminada, **solo la estructura** se envía al proveedor de IA, junto con la conversación: las tablas
y sus campos, las automatizaciones de la base, la que está en pantalla tal como la muestra el editor, y
sus últimas ejecuciones, con sus estados y sus códigos de error, nunca un valor. Las personas
y los canales de Slack se envían con marcadores (`p1`, `s1`), nunca con su identificador. La casilla
**Permitir la lectura de los datos** permite al Copilot, durante la conversación, leer filas
(50 como máximo por lectura), y cada lectura aparece bajo su respuesta.

## Probar y seguir

**Probar con una fila** ejecuta la automatización guardada sobre una fila elegida, de
verdad. La pestaña **Ejecuciones** conserva las 50 últimas durante 30 días: en espera, en curso, completada,
descartada con su motivo, fallida con su código. Al elegir una, se superpone al flujo: la rama
tomada queda trazada, cada paso ejecutado indica lo que hizo y cuánto tardó, y el resto aparece
atenuado.

## En nombre de quién actúa

Una automatización actúa con los **permisos de la persona que la guardó por última vez**,
que se vuelven a evaluar en cada ejecución: si esa persona pierde un permiso, el paso que lo necesitaba
falla en lugar de saltárselo, y una búsqueda solo encuentra lo que ella puede leer.
El historial la muestra como «Automatización “Tâche terminée” · en nombre de…», y sus escrituras
se deshacen como las demás.

## Límites

- Lo que escribe una automatización no desencadena ninguna otra: lo que deba encadenarse se escribe
  en un solo flujo.
- Una búsqueda da una fila, la primera; todavía no hay «para cada fila», ni
  esperas («tres días después»).
- Sin correo electrónico, sin scripts.
- Una condición comprueba una fila: para tomar una rama según la respuesta de la IA, escríbela
  primero en un campo de la fila.
- Una [plantilla de base](/basedb/es/fonctionnalites/modeles/) solo incluye las automatizaciones sin
  búsqueda, condición ni paso de IA.
- 100 ejecuciones por hora y por automatización; una ejecución programada que no se haya realizado solo se recupera
  una vez.
- El retraso entre la escritura y la acción es del orden de un segundo.

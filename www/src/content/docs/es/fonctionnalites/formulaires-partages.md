---
title: Formularios compartidos
description: Compartir un formulario mediante un enlace, público o reservado a los miembros conectados.
---

Un formulario o una encuesta se **comparte mediante un enlace** `/f/<jeton>`. La persona que
responde no necesita **ningún permiso sobre la tabla**: cada respuesta añade una fila, y no se
le muestra nada más de la tabla. Para mostrar filas en lugar de recibirlas, una vista
se comparte [en solo lectura](/basedb/es/fonctionnalites/vues-partagees/).

![El diálogo para compartir](../../../../assets/screens/partage-formulaire.png)

## Quién puede responder

| Acceso | Quién responde | Lo que se muestra |
|---|---|---|
| **Público** | cualquiera que tenga el enlace, sin cuenta | solo el formulario |
| **Miembros conectados** | un miembro del espacio de trabajo, si hace falta solo de ciertos grupos | el inicio de sesión, y después el formulario y «Respondes como…» |

La página del enlace está fuera de la aplicación: sin barra lateral, sin nombre de base, sin otras filas.
Lleva la apariencia del formulario —su tema, su color, su fuente— y solo hace las preguntas
que las respuestas anteriores piden.

![Un formulario público](../../../../assets/screens/formulaire-public.png)

## En nombre de quién se escribe la respuesta

La fila se escribe con la **autoridad de la persona que publicó el formulario compartido**, es decir, la última en
haberlo guardado. Su permiso para crear filas se comprueba **en cada respuesta**, limitado a las
preguntas del formulario: si lo pierde, el formulario queda suspendido hasta que alguien
que lo tenga lo vuelva a guardar.

El historial indica quién respondió, no quién publicó:

- la respuesta de un **miembro** se atribuye a esa persona;
- una respuesta **pública** se atribuye al propio formulario: «Formulario “Demande de
  devis” · respuesta pública · publicado por Camille».

## Abrir y cerrar

El diálogo permite ajustar:

- el interruptor **Enlace activo**;
- una **fecha de cierre**;
- un **número máximo de respuestas**, exacto incluso con respuestas simultáneas;
- **Regenerar el enlace**: el antiguo deja de funcionar al instante;
- **Dejar de compartir**: el enlace desaparece y las respuestas se quedan en la tabla.

Un formulario cerrado lo indica en una frase, antes incluso de pedir que se inicie sesión.

## Límites

- Las preguntas de tipo **relación**, **archivo** e **imagen** no se plantean mediante un enlace
  compartido; el diálogo las señala.
- El envío está limitado a 20 respuestas por minuto, por dirección IP y por enlace. Detrás del proxy incluido
  (Caddy), la dirección IP es la del visitante.

El detalle está en el [capítulo 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
del documento de arquitectura.

---
title: Slack, agendas y tablas sincronizadas
description: Avisar a un canal de Slack, conectar una agenda, mantener una tabla actualizada desde un CSV, una agenda u otra base.
---

La pantalla **Integraciones** de una base se abre desde el menú del perfil, abajo a la izquierda.
Requiere el nivel **Gestión** y reúne lo que conecta la base con el resto de tus herramientas.

![La pantalla Integraciones de una base](../../../../assets/screens/integrations.png)

## Slack

**Conectar un canal**: en Slack, crea un *webhook entrante* para el canal que quieras y pega
su dirección (`https://hooks.slack.com/…`, único origen aceptado). **Probar** envía un mensaje
de prueba. La dirección se cifra al guardarse y nunca vuelve a mostrarse.

El canal conectado pasa a ser una acción de las [automatizaciones](/basedb/es/fonctionnalites/automatisations/):
**Enviar a Slack**, con un mensaje que cita la fila: «Nueva reseña negativa de
{{Auteur}}: {{Avis}}».

## Agendas

Dos sentidos, dos medios:

- **Ver una vista en una agenda**: comparte públicamente una vista de calendario o de cronología; su
  diálogo para compartir da la dirección de un **feed iCalendar**, al que puedes suscribirte desde Google
  Calendar («Otros calendarios» → «Desde URL»), Outlook o Apple Calendar. Consulta
  [Vistas compartidas](/basedb/es/fonctionnalites/vues-partagees/#un-calendario-en-tu-agenda).
- **Importar una agenda**: crea una tabla sincronizada con la fuente «Agenda» y la dirección
  iCal secreta de la agenda.

## Tablas sincronizadas

Una tabla sincronizada se **mantiene actualizada desde una fuente**: se lee, se filtra y se
muestra en vistas como las demás, pero no se escribe a mano; una insignia
«Sincronizada» lo recuerda, y la API rechaza cualquier escritura (`TABLE_SYNCED`).

| Fuente | En qué se convierte la tabla |
|---|---|
| **Archivo CSV en línea** | una columna por cada columna del archivo, con el tipo deducido de su contenido: número, fecha o texto |
| **Agenda** (Google Calendar, iCalendar) | un evento por fila: título, inicio, fin, lugar, descripción |
| **Vista compartida de un basedb** | las filas de una [vista compartida](/basedb/es/fonctionnalites/vues-partagees/#una-fuente-para-otras-bases), en esta instancia o en otra |

**Nueva tabla sincronizada** elige la fuente y el intervalo, de cada 15 minutos a una
vez al día; **Sincronizar** la vuelve a leer de inmediato. Cada pasada crea, modifica y
elimina lo necesario para que la tabla se parezca a la fuente, guiándose por un campo
**Clave de sincronización**. Todas estas escrituras pasan por el historial.

**Detener** la sincronización convierte la tabla en una tabla normal: sus filas se quedan y vuelven a
escribirse a mano.

## Límites

- Una fuente se lee con un límite de 5 MB, 10 000 filas y 10 segundos.
- Una fuente que falla no borra nada: la tabla conserva sus filas hasta la pasada siguiente.
- Una columna que aparece en la fuente después de la creación no se añade.
- Slack se conecta mediante un webhook entrante, todavía no mediante una aplicación de Slack.

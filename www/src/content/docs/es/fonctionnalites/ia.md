---
title: Inteligencia artificial
description: La opción de IA de un campo, los borradores, el Copilot y el de los paneles, y lo que se envía al proveedor.
---

La IA es **opcional**. Sin proveedor configurado, no se envía nada a ninguna parte. basedb sabe
hablar con **OpenAI**, **Anthropic** y **Mistral**, con tu propia clave.

## Configurar un proveedor

Mientras no haya ningún ajuste guardado en la interfaz, la API lee su entorno:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic o mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # o BASEDB_AI_API_KEY
```

La clave se lee en `BASEDB_AI_API_KEY` o, en su defecto, con el nombre habitual del proveedor
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## La opción de IA de un campo

La IA no es un tipo de campo, sino una **opción**: el interruptor **IA** del formulario de un
campo (texto, texto largo, URL, número, selección única, booleano, fecha) hace que lo rellene
un modelo, a partir de una instrucción que cita otras columnas:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- El campo se calcula en cuanto existe la fila, y después cada vez que cambia una columna citada;
  y, si se quiere, también según una programación (como mucho cada 15 minutos).
- La columna **conserva su tipo**: una respuesta en la que no se puede leer nada de ese tipo (un número
  que no aparece, una opción que no existe) se rechaza en lugar de escribirse.
- Desactivar la opción vuelve a hacer el campo modificable a mano, conservando los valores.
- Los valores citados se envían al proveedor: **la activación requiere un consentimiento
  explícito**.

`BASEDB_AI_FIELD_QUOTA` limita estos cálculos por hora y por tenant (300 de forma predeterminada).

## En una automatización

Una [automatización](/basedb/es/fonctionnalites/automatisations/#preguntar-a-la-ia) puede **preguntar
a la IA** en uno de sus pasos: una instrucción que cita la fila y los pasos anteriores,
una respuesta leída en el tipo elegido, que los pasos siguientes escriben, envían o citan. Las mismas
reglas que para un campo: consentimiento al guardar, solo se envía lo que cita la instrucción,
y cada llamada se registra y cuenta en `BASEDB_AI_FIELD_QUOTA`.

## Borradores y Copilot

- **Borradores**: describir una tabla o una fórmula en una frase y recibir una propuesta para
  revisar. Solo se envían las etiquetas, los tipos y la frase escrita, ningún valor de celda.
- **Plantillas**: describir una base entera («el seguimiento de las reclamaciones de mis clientes») y
  recibir tablas, filas de ejemplo, vistas, un panel y automatizaciones, para afinar y después
  crear. Solo se envía la frase. Consulta [Plantillas de base](/basedb/es/fonctionnalites/modeles/#pedírselo-a-la-ia).
- **Copilot**: una conversación sobre la base mostrada. Se le pide un filtro, una consulta,
  columnas, una tabla, un juego de datos de prueba; cada propuesta llega como una tarjeta y se aplica
  con un clic, por las mismas rutas que los formularios.

De forma predeterminada, solo se envía la estructura al proveedor. La casilla **«Permitir la lectura de los
datos»** permite al Copilot, durante la conversación, leer filas (50 como máximo por lectura)
y responder a partir de ellas; cada lectura aparece bajo su respuesta.

## El Copilot de los paneles

En la sección [Paneles](/basedb/es/fonctionnalites/tableaux-de-bord/#el-copilot), el
Copilot propone preguntas, cambios en el panel y valores para sus filtros, que se
aplican con un clic. Las mismas reglas: sin consentimiento, solo se envía la estructura (tablas y
campos, paneles y preguntas de la base, definición de las tarjetas del panel mostrado, con sus
preguntas y sus textos), nunca los resultados ni los valores elegidos en los filtros. La casilla
**«Permitir la lectura de los datos»** añade esos valores y los resultados de las tarjetas con los
filtros mostrados, 50 filas como máximo por lectura, cada una listada bajo la respuesta.

## El Copilot de las automatizaciones

En la sección [Automatizaciones](/basedb/es/fonctionnalites/automatisations/#el-copilot), el Copilot
propone una automatización completa (la que está en pantalla, modificada, o una nueva) que coloca en el
flujo del editor, **sin guardarla nunca**: tú la revisas y después la guardas. Las mismas reglas:
sin consentimiento, solo se envía la estructura (tablas y campos, automatizaciones de la base, la que está
en pantalla, sus últimas ejecuciones sin ningún valor, personas y canales de Slack con marcadores),
y la casilla **«Permitir la lectura de los datos»** añade filas leídas, 50 como máximo por lectura.

`BASEDB_AI_QUOTA` limita las llamadas interactivas por hora y por tenant (120 de forma predeterminada).
